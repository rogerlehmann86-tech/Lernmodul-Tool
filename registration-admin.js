/* Übersicht der Anmeldungen und kontrollierte Nachmeldungen durch die Schulverwaltung */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const report=document.createElement('div');report.className='tool-section';
 report.innerHTML='<h3>Anmeldestand und Nachmeldungen</h3>'+
   '<label>Ausschreibung<select id="registrationCampaign"></select></label>'+
   '<button type="button" id="registrationLoad" class="secondary">Anmeldestand anzeigen</button>'+
   '<p id="registrationInfo" class="muted"></p><div class="alloc-scroll"><table id="registrationTable"></table></div>'+
   '<button type="button" id="registrationExportMissing" class="secondary">Fehlende Anmeldungen als CSV</button>'+
   '<button type="button" id="registrationExportAll" class="secondary">Alle Anmeldungen als CSV</button>'+
   '<div id="registrationOverride" class="alloc-editor">'+
    '<h3>Nachmeldung / Wünsche korrigieren</h3>'+
    '<p class="muted">Nur die Schulverwaltung kann nach der Anmeldefrist noch Wünsche erfassen. Vorhandene Wünsche werden dabei vollständig ersetzt.</p>'+
    '<label>Schüler<select id="registrationStudent"></select></label>'+
    '<div id="registrationWishes"></div>'+
    '<button type="button" id="registrationSubmit">Nachmeldung speichern</button>'+
   '</div>';
 $('students').appendChild(report);
 let current=null,all=[],missing=[],modules=[],registered=new Map(),campaigns=[];
 function csvQuote(v){let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(name,rows){
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(csvQuote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 function message(t,err=false){$('registrationInfo').textContent=t;$('registrationInfo').style.color=err?'#a02b28':'#226d4d';}
 async function rows(table,fields,id,order='id'){
   const list=[];
   for(let start=0;start<3500;start+=500){
     const {data,error}=await db.from(table).select(fields).eq('campaign_id',id).order(order).range(start,start+499);
     if(error)throw error;list.push(...(data||[]));
     if((data||[]).length<500)return list;
   }
   throw Error('Zu viele Datensätze.');
 }
 async function loadCampaigns(){
   const old=window.learningCurrentCampaignId||$('registrationCampaign').value;
   const {data,error}=await db.from('campaigns').select('id,title,status,max_preferences').order('created_at',{ascending:false});
   if(error)return;
   campaigns=data||[];
   $('registrationCampaign').innerHTML=campaigns.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+' ('+esc(window.learningStatusLabel(c.status))+')</option>').join('');
   if(campaigns.some(c=>c.id===old))$('registrationCampaign').value=old;
 }
 async function load(){
  const id=$('registrationCampaign').value;
  current=campaigns.find(c=>c.id===id);
  if(!current)return message('Noch keine Ausschreibung vorhanden.');
  message('Anmeldungen werden geladen …');
  try{
    const [eligible,regs,mods,prefs]=await Promise.all([
      rows('campaign_students','student_id',id,'student_id'),
      rows('registrations','id,student_id,submitted_at',id,'id'),
      rows('modules','id,title,active',id,'id'),
      rows('preferences','registration_id,module_id,rank',id,'id')
    ]);
    const studentIDs=[...new Set(eligible.map(s=>s.student_id))],studentRows=[];
    for(let i=0;i<studentIDs.length;i+=100){
      const {data,error}=await db.from('students').select('id,external_id,first_name,last_name,active,classes(name)').in('id',studentIDs.slice(i,i+100));
      if(error)throw error;studentRows.push(...(data||[]));
    }
    const byStudent=new Map(studentRows.map(s=>[s.id,s]));
    const byReg=new Map(regs.map(r=>[r.student_id,r]));
    const moduleMap=new Map(mods.map(m=>[m.id,m]));
    const wishMap=new Map();
    for(const w of prefs){
      if(!wishMap.has(w.registration_id))wishMap.set(w.registration_id,[]);
      wishMap.get(w.registration_id).push(w);
    }
    modules=mods.filter(m=>m.active);
    registered=new Map(regs.map(r=>[r.student_id,r]));
    all=studentRows.sort((a,b)=>a.last_name.localeCompare(b.last_name,'de-CH')||a.first_name.localeCompare(b.first_name,'de-CH'));
    missing=all.filter(s=>!registered.has(s.id));
    const details=all.map(s=>{
      const r=byReg.get(s.id);
      const preferences=r?(wishMap.get(r.id)||[]).sort((a,b)=>a.rank-b.rank).map(w=>w.rank+'. '+(moduleMap.get(w.module_id)?.title||'?')).join(' | '):'';
      return {s,registered:!!r,wishes:preferences};
    });
    report._rows=details;
    $('registrationTable').innerHTML='<thead><tr><th>Schüler</th><th>Klasse</th><th>Status</th><th>Wünsche</th></tr></thead><tbody>'+
      details.map(({s,registered,wishes})=>'<tr><td>'+esc(s.last_name+' '+s.first_name)+'</td>'+
      '<td>'+esc(s.classes?.name||'')+'</td>'+
      '<td>'+(registered?'Angemeldet':'Fehlt')+'</td><td>'+esc(wishes)+'</td></tr>').join('')+'</tbody>';
    $('registrationStudent').innerHTML=all.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.last_name+' '+s.first_name+' ('+s.external_id+')')+'</option>').join('');
    renderWishes();
    $('registrationOverride').hidden=!['open','closed'].includes(current.status);
    message(registered.size+' von '+all.length+' zugelassenen Schülern angemeldet · '+missing.length+' fehlen.');
  }catch(e){message(e.message||'Anmeldestand nicht verfügbar.',true)}
 }
 function renderWishes(){
   $('registrationWishes').innerHTML='';
   if(!current)return;
   for(let i=0;i<current.max_preferences;i++){
     const label=document.createElement('label');label.textContent='Wunsch '+(i+1);
     const select=document.createElement('select');select.className='registration-wish';select.required=true;
     select.innerHTML='<option value="">Modul auswählen</option>'+modules.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+'</option>').join('');
     label.appendChild(select);$('registrationWishes').appendChild(label);
   }
 }
 $('registrationCampaign').addEventListener('change',load);
 $('registrationLoad').addEventListener('click',load);
 $('registrationExportMissing').addEventListener('click',()=>{
   if(!current)return;
   csv('lernmodule-fehlende-'+current.id.slice(0,8)+'.csv',
     [['Schueler_ID','Nachname','Vorname','Klasse','Status'],...missing.map(s=>[s.external_id,s.last_name,s.first_name,s.classes?.name||'','Nicht angemeldet'])]);
 });
 $('registrationExportAll').addEventListener('click',()=>{
   if(!current)return;
   csv('lernmodule-anmeldestand-'+current.id.slice(0,8)+'.csv',
     [['Schueler_ID','Nachname','Vorname','Klasse','Status','Wunschliste'],...(report._rows||[]).map(r=>[
       r.s.external_id,r.s.last_name,r.s.first_name,r.s.classes?.name||'',r.registered?'Angemeldet':'Fehlt',r.wishes
     ])]);
 });
 $('registrationSubmit').addEventListener('click',async()=>{
   if(!current||!['open','closed'].includes(current.status))return message('Nachmeldung für diese Ausschreibung nicht möglich.',true);
   const student_id=$('registrationStudent').value,ids=[...document.querySelectorAll('.registration-wish')].map(e=>e.value);
   if(!student_id||ids.some(x=>!x)||new Set(ids).size!==ids.length)return message('Bitte für alle Wünsche unterschiedliche Module auswählen.',true);
   if(!confirm('Wünsche dieses Schülers speichern? Vorhandene Wünsche werden ersetzt.'))return;
   const button=$('registrationSubmit');button.disabled=true;
   try{
     const {error}=await db.rpc('admin_override_student_preferences',{
       p_campaign_id:current.id,p_student_id:student_id,p_module_ids:ids
     });
     if(error)throw error;
     await load();
     message('Nachmeldung bzw. Korrektur gespeichert und im Änderungsprotokoll festgehalten.');
   }catch(e){message(e.message||'Nachmeldung fehlgeschlagen.',true)}
   finally{button.disabled=false;}
 });
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN')setTimeout(loadCampaigns,500)});
 const original=window.refresh;
 if(typeof original==='function')window.refresh=async(...args)=>{await original(...args);await loadCampaigns();};
 loadCampaigns();
})();