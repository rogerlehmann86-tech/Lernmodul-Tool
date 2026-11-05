/**
 * Zuteilungsalgorithmus 0.2.
 * Min-Cost-Max-Flow optimiert die Summe erfüllter Wünsche innerhalb der Kapazitäten.
 * Erste Plätze pro Schüler werden bei Engpässen vor Zweitplätzen bevorzugt.
 * Gleichstände werden durch einen wiederholbaren Seed aufgelöst.
 * Mindestgrössen: iterative Schliessung unterfüllter Module (heuristisch).
 * Überschneidende Zeitblöcke: konservative Konfliktgruppen (sicher, aber evtl. restriktiver).
 */
export function calculateAllocation(input) {
  const {campaign,modules,slots,registrations,preferences,locked,seed}=input;
  const k=campaign.modules_per_student;
  if(!Number.isInteger(k)||k<1||k>20)throw Error('Ungültige Modulanzahl.');
  if(!registrations.length)throw Error('Für diese Ausschreibung liegen noch keine Anmeldungen vor.');
  if(registrations.length>1500)throw Error('Für mehr als 1500 Anmeldungen ist eine gesonderte Berechnung notwendig.');
  if(modules.length>250)throw Error('Für mehr als 250 Module ist eine gesonderte Berechnung notwendig.');
  const moduleMap=new Map(modules.filter(m=>m.active).map(m=>[m.id,m]));
  const participants=[...new Set(registrations.map(r=>r.student_id))].sort();
  const students=new Set(participants);
  const prefMap=new Map();
  const regMap=new Map(registrations.map(r=>[r.id,r.student_id]));
  for(const p of preferences){
    const sid=regMap.get(p.registration_id);
    if(!sid||!moduleMap.has(p.module_id))continue;
    if(!prefMap.has(sid))prefMap.set(sid,[]);
    prefMap.get(sid).push({module_id:p.module_id,rank:p.rank});
  }
  for(const items of prefMap.values())items.sort((a,b)=>a.rank-b.rank||a.module_id.localeCompare(b.module_id));
  const occupied=new Map();
  const lockedCounts=new Map();
  const lockedModules=new Map();
  const slotParent=new Map(slots.map(s=>[s.id,s.id]));
  function root(s){if(slotParent.get(s)===s)return s;const x=root(slotParent.get(s));slotParent.set(s,x);return x;}
  function unite(a,b){a=root(a);b=root(b);if(a!==b)slotParent.set(a<b?b:a,a<b?a:b);}
  const warnings=[];
  const slotList=slots.filter(s=>s.starts_at&&s.ends_at);
  for(let i=0;i<slotList.length;i++){
    for(let j=i+1;j<slotList.length;j++){
      const a=slotList[i],b=slotList[j];
      if(new Date(a.starts_at)<new Date(b.ends_at)&&new Date(b.starts_at)<new Date(a.ends_at)){
        unite(a.id,b.id);
        if(a.id!==b.id&&!warnings.includes('Überlappende Zeitblöcke wurden vorsichtshalber zusammengefasst.'))warnings.push('Überlappende Zeitblöcke wurden vorsichtshalber zusammengefasst.');
      }
    }
  }
  function group(m){return m.time_slot_id?'slot:'+root(m.time_slot_id):'module:'+m.id;}
  for(const l of locked) {
    if(!students.has(l.student_id)||!moduleMap.has(l.module_id))throw Error('Eine gesperrte Zuteilung betrifft einen nicht zugelassenen Schüler oder ein inaktives Modul.');
    const seen=occupied.get(l.student_id)||new Set();
    const g=group(moduleMap.get(l.module_id));
    if(seen.has(g))throw Error('Bestehende gesperrte Zuteilungen haben einen Zeitkonflikt.');
    seen.add(g);occupied.set(l.student_id,seen);
    lockedCounts.set(l.student_id,(lockedCounts.get(l.student_id)||0)+1);
    lockedModules.set(l.module_id,(lockedModules.get(l.module_id)||0)+1);
  }
  for(const [sid,count] of lockedCounts)if(count>k)throw Error('Ein Schüler hat mehr gesperrte Module als vorgesehen.');
  for(const [mid,count] of lockedModules)if(count>moduleMap.get(mid).max_capacity)throw Error('Gesperrte Zuteilungen überschreiten die Modulkapazität.');
  function lottery(key) {
    let h=2166136261;
    for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  function solve(blocked){
    const graph=[];
    const node=()=>{graph.push([]);return graph.length-1;};
    const edge=(a,b,cap,cost)=>{
      const forward={to:b,rev:graph[b].length,cap,cost};
      const backward={to:a,rev:graph[a].length,cap:0,cost:-cost};
      graph[a].push(forward);graph[b].push(backward);return forward;
    };
    const source=node(),sink=node();
    const mNodes=new Map();
    for(const m of modules.filter(m=>m.active&&!blocked.has(m.id)).sort((a,b)=>a.id.localeCompare(b.id))){
      const mNode=node();mNodes.set(m.id,mNode);
      edge(mNode,sink,m.max_capacity-(lockedModules.get(m.id)||0),0);
    }
    const choices=[];
    for(const sid of participants){
      const used=lockedCounts.get(sid)||0,need=k-used;
      if(need<=0)continue;
      const sNode=node();
      if(used===0){edge(source,sNode,1,-1000000000);if(need>1)edge(source,sNode,need-1,0);}
      else edge(source,sNode,need,0);
      const groups=new Map();
      for(const p of prefMap.get(sid)||[]){
        const m=moduleMap.get(p.module_id);
        if(!m||blocked.has(m.id)||!mNodes.has(m.id))continue;
        if(locked.some(l=>l.student_id===sid&&l.module_id===m.id))continue;
        const g=group(m);
        if(occupied.get(sid)?.has(g))continue;
        if(!groups.has(g)){const gNode=node();groups.set(g,gNode);edge(sNode,gNode,1,0);}
        const rankValue=Math.max(1,campaign.max_preferences-p.rank+1);
        const cost= -rankValue*1000 +(lottery(seed+':'+sid+':'+m.id)%97);
        const e=edge(groups.get(g),mNodes.get(m.id),1,cost);
        choices.push({sid,module_id:m.id,rank:p.rank,edge:e});
      }
    }
    let flow=0,cost=0;
    while(flow<4000){
      const dist=new Float64Array(graph.length).fill(Infinity);
      const inQ=new Uint8Array(graph.length),prevNode=new Int32Array(graph.length).fill(-1),prevEdge=new Int32Array(graph.length).fill(-1);
      const q=[source];let head=0;dist[source]=0;inQ[source]=1;
      while(head<q.length){
        const u=q[head++];inQ[u]=0;
        for(let i=0;i<graph[u].length;i++){
          const e=graph[u][i],d=dist[u]+e.cost;
          if(e.cap>0&&d<dist[e.to]){
            dist[e.to]=d;prevNode[e.to]=u;prevEdge[e.to]=i;
            if(!inQ[e.to]){q.push(e.to);inQ[e.to]=1;}
          }
        }
      }
      if(prevNode[sink]===-1)break;
      let add=Infinity;
      for(let v=sink;v!==source;v=prevNode[v]){
        const e=graph[prevNode[v]][prevEdge[v]];add=Math.min(add,e.cap);
      }
      for(let v=sink;v!==source;v=prevNode[v]){
        const e=graph[prevNode[v]][prevEdge[v]];e.cap-=add;graph[v][e.rev].cap+=add;
      }
      flow+=add;cost+=dist[sink]*add;
    }
    const auto=choices.filter(x=>x.edge.cap===0).map(x=>({student_id:x.sid,module_id:x.module_id,rank:x.rank,source:'automatic',locked:false}));
    const plan=[...locked.map(l=>({student_id:l.student_id,module_id:l.module_id,source:l.source||'manual',locked:true})),...auto];
    const counts=new Map();
    for(const row of plan)counts.set(row.module_id,(counts.get(row.module_id)||0)+1);
    const below=modules.filter(m=>m.active&&!blocked.has(m.id)&&counts.has(m.id)&&counts.get(m.id)>0&&counts.get(m.id)<m.min_capacity);
    return {plan,counts,below,flow,cost,auto};
  }
  const blocked=new Set();
  let outcome;
  for(let attempts=0;attempts<=modules.length;attempts++){
    outcome=solve(blocked);
    if(outcome.below.length===0)break;
    const removable=outcome.below.filter(m=>!lockedModules.get(m.id)).sort((a,b)=>{
      const fa=outcome.counts.get(a.id)/Math.max(1,a.min_capacity),fb=outcome.counts.get(b.id)/Math.max(1,b.min_capacity);
      return fa-fb||a.id.localeCompare(b.id);
    });
    if(!removable.length)throw Error('Ein gesperrtes Modul unterschreitet die Mindestteilnehmerzahl. Bitte Mindestzahl oder Sperren prüfen.');
    blocked.add(removable[0].id);
    if(attempts===modules.length)throw Error('Mindestteilnehmerzahlen konnten nicht eingehalten werden.');
  }
  const perStudent=new Map();
  const rankTotals={};
  for(const row of outcome.plan){
    perStudent.set(row.student_id,(perStudent.get(row.student_id)||0)+1);
    const rank=row.rank??(prefMap.get(row.student_id)||[]).find(p=>p.module_id===row.module_id)?.rank;
    const key=rank?'Wunsch '+rank:'Manuell/ohne Wunsch';
    rankTotals[key]=(rankTotals[key]||0)+1;
  }
  const notFull=participants.filter(sid=>(perStudent.get(sid)||0)<k).map(student_id=>({student_id,missing:k-(perStudent.get(student_id)||0)}));
  return {
    seed,algorithm_version:'mincost-flow-v0.2',
    plan:outcome.plan.sort((a,b)=>a.student_id.localeCompare(b.student_id)||a.module_id.localeCompare(b.module_id)),
    summary:{registered:participants.length,assigned:outcome.plan.length,requested:participants.length*k,fully_assigned:participants.length-notFull.length,missing:participants.length*k-outcome.plan.length,ranks:rankTotals},
    gaps:notFull,
    blocked_modules:modules.filter(m=>blocked.has(m.id)).map(m=>({id:m.id,title:m.title,minimum:m.min_capacity})),
    warnings:[...warnings,'Mindestteilnehmerzahlen werden durch iterative Modulschliessung berücksichtigt; die Optimierung ist dafür nicht garantiert global optimal.']
  };
}
