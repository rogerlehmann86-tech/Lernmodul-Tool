/* Administration: prüfbare Zuteilungsentwürfe und CSV-Export */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msg=(s,error=false)=>{
    const e=$('allocationNotice');e.textContent=s;e.style.color=error?'#a02b28':'#226d4d';
    if(error)window.learningGuideReportError?.('allocation',s);
  };
  let campaign=null,preview=null,students=new Map(),modules=new Map(),preferred=new Map(),lockedIds=new Map();
  const panel=$('allocation');
  if(!panel)return;
  panel.innerHTML=
    '<h2>Modulzuteilung</h2>'+
    '<p class="muted">Die Berechnung erstellt zuerst einen Entwurf. Du kannst die Resultate prüfen und manuell korrigieren, bevor du sie speicherst. Eine Veröffentlichung an die Schüler erfolgt hier noch nicht.</p>'+
    '<label>Ausschreibung<select id="allocationCampaign"></select></label>'+
    '<button type="button" class="secondary" id="allocationReload">Daten neu laden</button>'+
    '<button type="button" class="secondary" id="allocationClose">Anmeldung schliessen</button>'+
    '<button type="button" id="allocationCalculate">Faire Zuteilung berechnen</button>'+
    '<button type="button" class="secondary" id="allocationLoadSaved">Gespeicherten Entwurf laden</button>'+
    '<p id="allocationNotice" role="status" aria-live="polite"></p>'+
    '<div id="allocationApprove" class="alloc-editor" hidden><h3>Endresultate veröffentlichen</h3><p id="allocationApprovalWarning"></p>'+
    '<label><input type="checkbox" id="allocationAllowIncomplete" style="width:auto;display:inline"> Unvollständige Zuteilung bewusst freigeben</label>'+
    '<button type="button" id="allocationPublish">Zuteilung für Schüler freigeben</button></div>'+
    '<div id="allocationLocks" class="alloc-editor" hidden></div>'+
    '<div id="allocationResult" hidden>'+
      '<div id="allocationSummary"></div>'+
      '<div class="alloc-scroll"><table id="allocationTable"></table></div>'+
      '<div class="alloc-editor">'+
        '<h3>Zusätzliche manuelle Zuteilung</h3>'+
        '<label>Schüler<select id="allocationStudent"></select></label>'+
        '<label>Modul<select id="allocationModule"></select></label>'+
        '<button type="button" class="secondary" id="allocationAdd">Zuteilung hinzufügen</button>'+
      '</div>'+
      '<button type="button" id="allocationSave">Entwurf speichern</button>'+
      '<button type="button" class="secondary" id="allocationExport">CSV-Export</button>'+
    '</div>';
  const selector=$('allocationCampaign');
  function csvQuote(v){
    let s=String(v??'');
    if(/^\s*[=+\-@]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function download(name,rows){
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvQuote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function getAll(table,fields,eqName,eqValue,order='id'){
    let all=[];
    for(let i=0;i<3500;i+=500){
      let query=db.from(table).select(fields).order(order).range(i,i+499);
      if(eqName)query=query.eq(eqName,eqValue);
      const {data,error}=await query;
      if(error)throw error;
      all.push(...(data||[]));if((data||[]).length<500)return all;
    }
    throw Error('Zu viele Datensätze. Bitte Schulverwaltung kontaktieren.');
  }
  async function loadCampaigns(){
    const old=window.learningCurrentCampaignId||selector.value;
    const {data,error}=await db.from('campaigns').select('id,title,status,ends_at,modules_per_student,max_preferences').order('created_at',{ascending:false});
    if(error){msg(error.message,true);return;}
    selector.innerHTML=(data||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+' ('+esc(window.learningStatusLabel(c.status))+')</option>').join('');
    if((data||[]).some(c=>c.id===old))selector.value=old;
    await loadDetails();
  }
  async function loadDetails(){
    const id=selector.value;
    preview=null;$('allocationResult').hidden=true;
    if(!id){msg('Bitte zuerst eine Ausschreibung erstellen.');return;}
    try{
      const {data:c,error}=await db.from('campaigns').select('*').eq('id',id).single();
      if(error)throw error;campaign=c;
      const [studentRows,mods,registrations,prefs,assignmentRows]=await Promise.all([
        getAll('students','id,external_id,first_name,last_name,classes(name)',null,null,'id'),
        getAll('modules','id,title,max_capacity,min_capacity,time_slot_id,active','campaign_id',id,'id'),
        getAll('registrations','id,student_id','campaign_id',id,'id'),
        getAll('preferences','registration_id,module_id,rank','campaign_id',id,'id'),
        getAll('assignments','id,student_id,module_id,source,locked','campaign_id',id,'id')
      ]);
      students=new Map(studentRows.map(s=>[s.id,s]));
      modules=new Map(mods.filter(m=>m.active).map(m=>[m.id,m]));
      const ids=new Map(registrations.map(r=>[r.id,r.student_id]));
      preferred=new Map(prefs.map(p=>[ids.get(p.registration_id)+':'+p.module_id,p.rank]));
      lockedIds=new Map(assignmentRows.filter(a=>a.locked).map(a=>[a.student_id+':'+a.module_id,a.id]));
      $('allocationApprove').hidden=c.status!=='allocated';
      const counted=new Map();
      for(const a of assignmentRows)counted.set(a.student_id,(counted.get(a.student_id)||0)+1);
      const missingForPublish=registrations.reduce((n,r)=>n+Math.max(0,c.modules_per_student-(counted.get(r.student_id)||0)),0);
      $('allocationApprovalWarning').textContent=missingForPublish?
        'Achtung: Es fehlen '+missingForPublish+' Modulplätze. Für die Freigabe ist eine bewusste Bestätigung erforderlich.':
        'Alle angemeldeten Schüler haben die vorgesehene Anzahl Module erhalten.';
      $('allocationAllowIncomplete').checked=false;
      $('allocationLocks').hidden=!(c.status==='allocated'&&lockedIds.size);
      $('allocationLocks').innerHTML='<h3>Gesperrte Zuteilungen</h3>'+
        assignmentRows.filter(a=>a.locked).map(a=>
          '<p>'+esc((students.get(a.student_id)?.last_name||'')+' '+(students.get(a.student_id)?.first_name||''))+
          ': '+esc(modules.get(a.module_id)?.title||a.module_id)+
          ' <button type="button" class="secondary" data-unlock="'+esc(a.id)+'">Sperre lösen</button></p>').join('');
      const registered=registrations.length;
      msg('Status: '+window.learningStatusLabel(c.status)+' · '+registered+' Anmeldungen · '+assignmentRows.length+' bestehende Zuteilungen');
      $('allocationStudent').innerHTML=registrations.map(r=>students.get(r.student_id)).filter(Boolean).sort((a,b)=>a.last_name.localeCompare(b.last_name)).map(s=>
        '<option value="'+esc(s.id)+'">'+esc(s.last_name+' '+s.first_name+' ('+s.external_id+')')+'</option>').join('');
      $('allocationModule').innerHTML=[...modules.values()].map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+'</option>').join('');
    }catch(e){msg(e.message||'Fehler beim Laden',true)}
  }
  function rowName(id){const s=students.get(id);return s?(s.last_name+' '+s.first_name+' · '+s.external_id):id;}
  function render(){
    if(!preview)return;
    $('allocationResult').hidden=false;
    const countByModule=new Map(),countByStudent=new Map(),ranks={};
    for(const p of preview.plan){
      countByModule.set(p.module_id,(countByModule.get(p.module_id)||0)+1);
      countByStudent.set(p.student_id,(countByStudent.get(p.student_id)||0)+1);
      const rank=preferred.get(p.student_id+':'+p.module_id);
      const key=rank?'Wunsch '+rank:'Ohne Wunsch / manuell';
      ranks[key]=(ranks[key]||0)+1;
    }
    const need=campaign.modules_per_student;
    const numberStudents=$('allocationStudent').options.length;
    const missing=numberStudents*need-preview.plan.length;
    const counts=[...modules.values()].map(m=>esc(m.title)+': '+(countByModule.get(m.id)||0)+'/'+m.max_capacity).join(' · ');
    const warnings=(preview.warnings||[]).map(w=>'<p class="muted">'+esc(w)+'</p>').join('');
    const blocked=(preview.blocked_modules||[]).map(m=>esc(m.title)).join(', ');
    $('allocationSummary').innerHTML='<h3>Berechnungsübersicht</h3><p><strong>'+
      preview.plan.length+' von '+(numberStudents*need)+' vorgesehenen Modulplätzen</strong> belegt. '+
      Math.max(0,missing)+' fehlen. '+[...countByStudent.values()].filter(n=>n>=need).length+'/'+numberStudents+' Schüler vollständig zugeteilt.</p>'+
      '<p>'+Object.entries(ranks).map(([r,n])=>esc(r)+': '+n).join(' · ')+'</p>'+
      '<p class="muted">'+counts+'</p>'+(blocked?'<p><strong>Wegen Mindestzahl nicht berücksichtigt:</strong> '+blocked+'</p>':'')+warnings;
    const optionRows=[...modules.values()].map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+'</option>').join('');
    $('allocationTable').innerHTML='<thead><tr><th>Schüler</th><th>Modul</th><th>Wunsch</th><th>Sperre</th><th>Aktion</th></tr></thead><tbody>'+
      preview.plan.map((p,i)=>'<tr><td>'+esc(rowName(p.student_id))+'</td><td><select data-index="'+i+'" class="alloc-select">'+
        optionRows.replace('value="'+esc(p.module_id)+'"','value="'+esc(p.module_id)+'" selected')+
        '</select></td><td>'+esc(preferred.get(p.student_id+':'+p.module_id)||'manuell')+
        '</td><td><input type="checkbox" class="alloc-lock" data-index="'+i+'"'+(p.locked?' checked':'')+
        (lockedIds.has(p.student_id+':'+p.module_id)?' disabled':'')+'></td>'+
        '<td><button type="button" class="secondary alloc-remove" data-index="'+i+'"'+
        (lockedIds.has(p.student_id+':'+p.module_id)?' disabled':'')+'>Entfernen</button></td></tr>').join('')+'</tbody>';
    $('allocationTable').querySelectorAll('.alloc-select').forEach(el=>{
      el.addEventListener('change',()=>{
        const i=Number(el.dataset.index),p=preview.plan[i],old=p.module_id;
        if(lockedIds.has(p.student_id+':'+old)){msg('Diese Zuteilung ist gesperrt. Zuerst im gespeicherten Entwurf entsperren.',true);render();return;}
        p.module_id=el.value;p.source='manual';render();
      });
    });
    $('allocationTable').querySelectorAll('.alloc-lock').forEach(el=>el.addEventListener('change',()=>{
      const p=preview.plan[Number(el.dataset.index)];p.locked=el.checked;p.source='manual';render();
    }));
    $('allocationTable').querySelectorAll('.alloc-remove').forEach(el=>el.addEventListener('click',()=>{
      preview.plan.splice(Number(el.dataset.index),1);render();
    }));
  }
  selector.addEventListener('change',loadDetails);
  $('allocationReload').addEventListener('click',loadCampaigns);
  $('allocationClose').addEventListener('click',async()=>{
    if(!campaign||campaign.status!=='open')return msg('Nur offene Ausschreibungen können geschlossen werden.',true);
    if(!confirm('Die Anmeldung wird sofort geschlossen. Schüler können danach keine Wünsche mehr einreichen. Fortfahren?'))return;
    const {error}=await db.from('campaigns').update({status:'closed'}).eq('id',campaign.id).eq('status','open');
    if(error)return msg(error.message,true);await loadCampaigns();
    msg('Anmeldefrist wurde geschlossen.');
  });
  $('allocationCalculate').addEventListener('click',async()=>{
    if(!campaign)return;
    const button=$('allocationCalculate');button.disabled=true;msg('Berechnung läuft …');
    try{
      const {data,error}=await db.functions.invoke('calculate-allocation',{body:{campaign_id:campaign.id}});
      if(error)throw error;
      if(data?.error)throw Error(data.error);
      if(!data?.plan)throw Error('Keine gültigen Berechnungsergebnisse.');
      preview=data;render();msg('Berechnung abgeschlossen. Ergebnisse prüfen und erst danach speichern.');
    }catch(e){msg(e.message||'Berechnung nicht möglich. Bitte Anmeldung und Zeitfenster prüfen.',true)}
    finally{button.disabled=false;}
  });
  $('allocationLoadSaved').addEventListener('click',async()=>{
    if(!campaign)return;
    try{
      const items=await getAll('assignments','id,student_id,module_id,source,locked','campaign_id',campaign.id);
      if(!items.length)return msg('Es liegt noch kein gespeicherter Entwurf vor.',true);
      preview={seed:'manual-edit-'+new Date().toISOString(),algorithm_version:'manual-review-v0.2',
        plan:items.map(a=>({student_id:a.student_id,module_id:a.module_id,source:a.source,locked:a.locked})),
        blocked_modules:[],warnings:['Dieser Entwurf wurde aus gespeicherten Zuteilungen geladen. Änderungen werden beim Speichern erneut geprüft.']};
      render();msg('Gespeicherter Entwurf geladen.');
    }catch(e){msg(e.message||'Laden fehlgeschlagen',true);}
  });
  $('allocationAdd').addEventListener('click',()=>{
    if(!preview)return msg('Bitte zuerst eine Berechnung durchführen oder einen Entwurf laden.',true);
    const student_id=$('allocationStudent').value,module_id=$('allocationModule').value;
    if(!student_id||!module_id)return msg('Schüler und Modul auswählen.',true);
    if(preview.plan.some(p=>p.student_id===student_id&&p.module_id===module_id))return msg('Diese Zuteilung existiert bereits.',true);
    preview.plan.push({student_id,module_id,source:'manual',locked:false});render();
  });
  $('allocationSave').addEventListener('click',async()=>{
    if(!campaign||!preview)return;
    if(campaign.status!=='closed'&&campaign.status!=='allocated'&&!(campaign.status==='open'&&new Date(campaign.ends_at)<new Date()))
      return msg('Die Anmeldung muss zuerst geschlossen sein.',true);
    if(!confirm('Den geprüften Zuteilungsentwurf verbindlich in der Datenbank speichern?'))return;
    const button=$('allocationSave');button.disabled=true;
    try{
      const {data,error}=await db.rpc('save_allocation_draft',{
        p_campaign_id:campaign.id,
        p_seed:preview.seed,
        p_algorithm:preview.algorithm_version,
        p_plan:preview.plan.map(p=>({student_id:p.student_id,module_id:p.module_id,
          source:p.source,locked:!!p.locked}))
      });
      if(error)throw error;
      await loadCampaigns();msg('Zuteilungsentwurf gespeichert ('+data.assignments+' Plätze).');
    }catch(e){msg(e.message||'Speichern fehlgeschlagen.',true)}
    finally{button.disabled=false;}
  });
  $('allocationExport').addEventListener('click',async()=>{
    if(!campaign)return;
    try{
      const rows=preview?.plan||await getAll('assignments','student_id,module_id,source,locked','campaign_id',campaign.id);
      if(!rows.length)return msg('Es sind noch keine Zuteilungen vorhanden.',true);
      const csv=[['Schueler_ID','Nachname','Vorname','Klasse','Modul','Wunsch_Rang','Quelle','Gesperrt']];
      for(const row of rows){
        const s=students.get(row.student_id)||{},m=modules.get(row.module_id)||{};
        csv.push([s.external_id||'',s.last_name||'',s.first_name||'',s.classes?.name||'',m.title||'',
          preferred.get(row.student_id+':'+row.module_id)||'',row.source||'',row.locked?'Ja':'Nein']);
      }
      download('lernmodule-zuteilung-'+campaign.id.slice(0,8)+'.csv',csv);
      msg('CSV exportiert. Enthält Schülerdaten – bitte geschützt aufbewahren.');
    }catch(e){msg(e.message||'Export fehlgeschlagen.',true);}
  });
  $('allocationLocks').addEventListener('click',async e=>{
    const button=e.target.closest('button[data-unlock]');
    if(!button)return;
    if(!confirm('Diese Zuteilung entsperren? Sie kann danach bei einer Neuberechnung geändert werden.'))return;
    button.disabled=true;
    const {error}=await db.rpc('set_assignment_lock',{p_assignment_id:button.dataset.unlock,p_locked:false});
    if(error){msg(error.message,true);button.disabled=false;return;}
    await loadDetails();msg('Sperre gelöst.');
  });
  $('allocationPublish').addEventListener('click',async()=>{
    if(!campaign||campaign.status!=='allocated')return msg('Zunächst einen Zuteilungsentwurf speichern.',true);
    if(!confirm('Die Resultate sind danach für Schüler mit Zugangscode sichtbar und nicht mehr bearbeitbar. Wirklich veröffentlichen?'))return;
    const button=$('allocationPublish');button.disabled=true;
    try{
      const {data,error}=await db.rpc('publish_allocation_results',{
        p_campaign_id:campaign.id,
        p_allow_incomplete:$('allocationAllowIncomplete').checked
      });
      if(error)throw error;
      await loadCampaigns();
      if(typeof window.reloadPublishedResults==='function')await window.reloadPublishedResults();
      msg('Ergebnisse veröffentlicht: '+data.assigned+' Plätze, '+data.missing+' fehlend.');
    }catch(e){msg(e.message||'Freigabe fehlgeschlagen.',true)}
    finally{button.disabled=false;}
  });
  // Leichtgewichtig: nur in der angemeldeten Administratoransicht verwenden.
  db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_IN')setTimeout(loadCampaigns,500);
    if(event==='SIGNED_OUT'){preview=null;$('allocationResult').hidden=true;}
  });
  window.reloadAllocationCampaigns=loadCampaigns;
  loadCampaigns();
})();