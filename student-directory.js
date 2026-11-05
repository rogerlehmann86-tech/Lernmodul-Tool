/* Unabhängige Schülerdatenbank mit geschütztem Kartendruck */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions=document.querySelector('#admin .admin-toolbar-actions');
if(!actions)return;
const open=document.createElement('button');
open.id='openStudentDirectory';open.type='button';open.className='secondary';open.textContent='Schülerdatenbank';
actions.insertBefore(open,$('selectedCampaignLabel'));
const panel=document.createElement('section');panel.id='studentDirectory';panel.className='panel';panel.hidden=true;
panel.innerHTML=
'<div class="directory-top"><div><h2>Schülerdatenbank</h2><p class="muted">Alle Schüler unabhängig von Ausschreibungen verwalten.</p></div>'+
'<button type="button" id="directoryAdd">Neuer Schüler</button></div>'+
'<div class="directory-filters"><label>Schüler suchen<input id="directorySearch" type="search" placeholder="Name oder Schüler-ID"></label>'+
'<label>Klasse<select id="directoryClass"><option value="">Alle Klassen</option></select></label>'+
'<label>Status<select id="directoryStatus"><option value="active">Aktiv</option><option value="all">Alle</option><option value="inactive">Inaktiv</option></select></label></div>'+
'<p id="directoryMessage" class="muted" role="status"></p>'+
'<div id="directoryEditor" class="directory-editor" hidden><h3 id="directoryEditorTitle">Schüler erfassen</h3>'+
'<form id="directoryForm"><div class="directory-filters">'+
'<label>Schüler-ID<input name="external_id" maxlength="80" required></label>'+
'<label>Vorname<input name="first_name" maxlength="100" required></label>'+
'<label>Nachname<input name="last_name" maxlength="100" required></label>'+
'<label>Klasse<input name="class_name" list="directoryClassNames" maxlength="80" required></label>'+
'<datalist id="directoryClassNames"></datalist></div>'+
'<button type="submit" id="directorySave">Speichern</button><button type="button" class="secondary" id="directoryCancel">Abbrechen</button></form></div>'+
'<div class="alloc-scroll"><table id="directoryTable"></table></div>'+
'<section class="directory-print"><h3>Zugangskarten als A4-PDF</h3>'+
'<p class="muted">Mit Name, Klasse, Schüler-ID und Zugangscode. Bitte PDFs vertraulich behandeln.</p>'+
'<div class="directory-filters"><label>Wer soll gedruckt werden?<select id="directoryPrintScope">'+
'<option value="filtered">Alle angezeigten Schüler (Suche/Klasse)</option><option value="all">Alle aktiven Schüler</option></select></label>'+
'<label>A4-Drucklayout<select id="directoryPrintLayout"><option value="8">8 Karten auf einem A4-Blatt</option>'+
'<option value="1">Eine Karte pro A4-Seite</option></select></label></div>'+
'<button type="button" id="directoryPrint">PDF erstellen</button>'+
'<button type="button" id="directoryIssue" class="secondary">Fehlende Zugangscodes erzeugen</button>'+
'<button type="button" id="directoryReplace" class="danger">Codes für Auswahl neu ausstellen</button>'+
'<p class="muted">Bestehende Zugangscodes werden dabei nicht geändert.</p>'+
'<details><summary>Vorhandene Zugangscodes aus der ursprünglichen CSV übernehmen</summary>'+
'<p class="muted">Code-CSV mit Schueler_ID und Zugangscode auswählen. Die Codes werden überprüft und verschlüsselt für spätere Druckaufträge gespeichert.</p>'+
'<input type="file" id="directoryCodeCsv" accept=".csv,text/csv">'+
'<button type="button" class="secondary" id="directoryImportCodes">Codes übernehmen</button></details></section>';
actions.closest('.panel').insertAdjacentElement('afterend',panel);
let pupils=[],classes=[],codes=new Set(),editId=null;
function info(t,error=false){$('directoryMessage').textContent=t;$('directoryMessage').style.color=error?'#a02b28':'var(--muted)'}
async function getRows(table,columns){
 const out=[];
 for(let start=0;start<5000;start+=500){
  const {data,error}=await db.from(table).select(columns).order(table==='students'?'last_name':table==='classes'?'name':'student_id').range(start,start+499);
  if(error)throw error;out.push(...(data||[]));
  if((data||[]).length<500)return out;
 }
 throw Error('Die Liste ist zu gross für diese Testversion.');
}
async function reload(){
 info('Schüler werden geladen …');
 [pupils,classes]=await Promise.all([
  getRows('students','id,external_id,first_name,last_name,active,class_id,classes(name)'),
  getRows('classes','id,name')]);
 codes=new Set((await getRows('student_access_codes','student_id')).map(v=>v.student_id));
 const current=$('directoryClass').value;
 $('directoryClass').innerHTML='<option value="">Alle Klassen</option>'+classes.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('');
 if(classes.some(c=>c.name===current))$('directoryClass').value=current;
 $('directoryClassNames').innerHTML=classes.map(c=>'<option value="'+esc(c.name)+'"></option>').join('');
 render();
}
function filtered(){
 const term=$('directorySearch').value.trim().toLocaleLowerCase('de-CH');
 const group=$('directoryClass').value,status=$('directoryStatus').value;
 return pupils.filter(s=>(!group||s.classes?.name===group)&&
  (status==='all'||(status==='active'?s.active:!s.active))&&
  (!term||[s.external_id,s.first_name,s.last_name].join(' ').toLocaleLowerCase('de-CH').includes(term)));
}
function render(){
 const shown=filtered();
 info(shown.length+' angezeigt · '+pupils.filter(s=>s.active).length+' aktive Schüler · '+pupils.length+' insgesamt.');
 $('directoryTable').innerHTML='<thead><tr><th>ID</th><th>Name</th><th>Klasse</th><th>Status</th><th>Aktion</th></tr></thead><tbody>'+
 shown.slice(0,1200).map(s=>'<tr><td>'+esc(s.external_id)+'</td><td>'+esc(s.last_name+' '+s.first_name)+'</td>'+
 '<td>'+esc(s.classes?.name||'')+'</td><td>'+(s.active?'Aktiv':'Inaktiv')+'</td>'+
 '<td class="directory-buttons"><button type="button" class="secondary" data-edit="'+s.id+'">Bearbeiten</button>'+
 '<button type="button" class="secondary" data-card="'+s.id+'">Karte PDF</button>'+
 '<button type="button" class="secondary" data-toggle="'+s.id+'">'+(s.active?'Deaktivieren':'Aktivieren')+'</button></td></tr>').join('')+'</tbody>';
}
function edit(s){
 editId=s?.id||null;
 const form=$('directoryForm');form.reset();
 $('directoryEditorTitle').textContent=s?'Schüler bearbeiten':'Neuen Schüler erfassen';
 if(s){
  for(const key of ['external_id','first_name','last_name'])form.elements.namedItem(key).value=s[key];
  form.elements.namedItem('class_name').value=s.classes?.name||'';
 }
 $('directoryEditor').hidden=false;
 $('directoryEditor').scrollIntoView({block:'start',behavior:'smooth'});
}
$('directoryAdd').onclick=()=>edit();
$('directoryCancel').onclick=()=>{$('directoryEditor').hidden=true;editId=null};
for(const id of ['directoryClass','directorySearch','directoryStatus'])
 $(id).addEventListener(id==='directorySearch'?'input':'change',render);
$('directoryForm').onsubmit=async e=>{
 e.preventDefault();
 const payload=Object.fromEntries(new FormData(e.target));
 for(const key in payload)payload[key]=payload[key].trim();
 if(Object.values(payload).some(x=>!x))return info('Alle Felder ausfüllen.',true);
 const btn=$('directorySave');btn.disabled=true;
 try{
  const old=pupils.find(s=>s.id===editId);
  if(old&&old.external_id!==payload.external_id&&!confirm('Die Schüler-ID wird geändert. Alte Zugriffskarten funktionieren danach nicht mehr. Weiter?'))return;
  let klass=classes.find(c=>c.name===payload.class_name);
  if(!klass){
   const r=await db.from('classes').upsert({name:payload.class_name},{onConflict:'name'}).select('id,name').single();
   if(r.error)throw r.error;klass=r.data;
  }
  const values={external_id:payload.external_id,first_name:payload.first_name,last_name:payload.last_name,class_id:klass.id};
  const r=editId?await db.from('students').update(values).eq('id',editId).select('id').single():
   await db.from('students').insert({...values,active:true}).select('id').single();
  if(r.error)throw r.error;
  editId=null;$('directoryEditor').hidden=true;
  await reload();info('Schülerdaten gespeichert.');
 }catch(error){info(error.message||'Speichern fehlgeschlagen.',true)}
 finally{btn.disabled=false;}
};
$('directoryTable').onclick=async event=>{
 const button=event.target.closest('[data-edit],[data-card],[data-toggle]');
 if(!button)return;
 const key=button.dataset.edit||button.dataset.card||button.dataset.toggle;
 const pupil=pupils.find(s=>s.id===key);if(!pupil)return;
 if(button.dataset.edit){edit(pupil);return;}
 if(button.dataset.card){await print([pupil.id],'Schuelerkarte');return;}
 if(!confirm((pupil.active?'Deaktivieren':'Aktivieren')+': '+pupil.first_name+' '+pupil.last_name+'?'))return;
 button.disabled=true;
 try{
  if(pupil.active){
   const {count,error}=await db.from('registrations').select('id',{count:'exact',head:true}).eq('student_id',pupil.id);
   if(error)throw error;
   if(count)throw Error('Es gibt bereits Anmeldungen für diesen Schüler. Eine Deaktivierung ist hier gesperrt.');
  }
  const {error}=await db.from('students').update({active:!pupil.active}).eq('id',pupil.id);
  if(error)throw error;
  await reload();info('Schülerstatus gespeichert.');
 }catch(err){info(err.message,true)}finally{button.disabled=false}
};
function downloadCsv(rows){
 const quote=v=>{let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='lernmodule-zugangscodes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function scopeIds(){return $('directoryPrintScope').value==='all'?
 pupils.filter(s=>s.active).map(s=>s.id):filtered().map(s=>s.id);}
async function issue(ids,replace){
 const {data,error}=await db.rpc('issue_learning_student_codes',{p_student_ids:ids,p_replace:replace});
 if(error)throw error;
 if(data?.length)downloadCsv([['Schueler_ID','Vorname','Nachname','Klasse','Zugangscode'],
 ...data.map(s=>[s.external_id,s.first_name,s.last_name,s.class_name||'',s.access_code])]);
 return data||[];
}
$('directoryIssue').onclick=async()=>{
 const ids=scopeIds();if(!ids.length)return info('Keine Schüler ausgewählt.',true);
 if(!confirm('Fehlende Zugangscodes ausstellen? Bestehende Codes bleiben unverändert.'))return;
 const button=$('directoryIssue');button.disabled=true;
 try{
  const created=await issue(ids,false);await reload();
  info(created.length?created.length+' neue Codes erstellt, CSV heruntergeladen. Jetzt PDF-Druck möglich.':
   'Alle haben bereits einen Code. Für alte Codes muss ggf. die ursprüngliche CSV übernommen werden.');
 }catch(e){info(e.message,true)}finally{button.disabled=false}
};
$('directoryReplace').onclick=async()=>{
 const ids=scopeIds();
 if(!ids.length)return info('Keine Schüler ausgewählt.',true);
 if(!confirm('ACHTUNG: Alle bestehenden Zugangscodes der ausgewählten '+ids.length+' Schüler werden sofort ungültig. Neue Karten müssen verteilt werden. Fortfahren?'))return;
 const phrase=prompt('Zur Bestätigung exakt NEU AUSSTELLEN eingeben:');
 if(phrase!=='NEU AUSSTELLEN')return info('Codewechsel abgebrochen.');
 const button=$('directoryReplace');button.disabled=true;
 try{
  const created=await issue(ids,true);
  await reload();
  info(created.length+' Codes neu ausgestellt. Alte Karten sind ungültig. Die neuen Codes sind als CSV heruntergeladen. Bitte jetzt die neuen PDFs erstellen.');
 }catch(err){info(err.message||'Codewechsel fehlgeschlagen.',true)}
 finally{button.disabled=false}
};
async function readCards(ids){
 const result=[];
 for(let i=0;i<ids.length;i+=200){
  const {data,error}=await db.rpc('read_learning_student_cards',{p_student_ids:ids.slice(i,i+200)});
  if(error)throw error;result.push(...data);
 }
 return result;
}
function createPdf(cards,title){
 const PDF=window.jspdf?.jsPDF;
 if(!PDF)throw Error('PDF-Komponente fehlt. Bitte Strg + F5 drücken.');
 const doc=new PDF({unit:'mm',format:'a4',orientation:'portrait'});
 const one=$('directoryPrintLayout').value==='1';
 const n=one?1:8;
 function card(s,x,y,w,h){
  doc.setFillColor(222,241,221);doc.setDrawColor(72,147,89);doc.setLineWidth(.35);
  doc.roundedRect(x,y,w,h,2,2,'FD');
  doc.setFillColor(200,230,235);doc.rect(x+.5,y+.5,w-1,one?22:12,'F');
  doc.setFont('helvetica','bold');doc.setTextColor(46,119,68);doc.setFontSize(one?16:9);
  doc.text('OBERSTUFENZENTRUM RAPPERSWIL',x+5,y+(one?12:7));
  doc.setFontSize(one?13:9);doc.text('ZUGANGSKARTE LERNMODULE',x+5,y+(one?19:11));
  const top=y+(one?41:23);
  doc.setTextColor(39,66,43);doc.setFont('helvetica','bold');doc.setFontSize(one?20:12);
  const name=s.first_name+' '+s.last_name;
  while(doc.getTextWidth(name)>w-10&&doc.getFontSize()>8)doc.setFontSize(doc.getFontSize()-1);
  doc.text(name,x+5,top);
  doc.setFont('helvetica','normal');doc.setFontSize(one?12:9);
  doc.text('Klasse: '+(s.class_name||'–'),x+5,top+(one?13:9));
  doc.text('Schüler-ID: '+s.external_id,x+5,top+(one?25:17));
  doc.setFont('courier','bold');doc.setFontSize(one?20:12);doc.setTextColor(38,107,54);
  doc.text(s.access_code,x+5,top+(one?45:27));
  doc.setFont('helvetica','normal');doc.setTextColor(74,94,78);doc.setFontSize(one?9:6.3);
  doc.text('Persönlichen Code sicher aufbewahren',x+5,y+h-(one?11:6));
 }
 cards.forEach((s,i)=>{
  if(i>0&&i%n===0)doc.addPage();
  if(one)card(s,18,66,174,114);
  else card(s,11+(i%2)*97,11+Math.floor((i%8)/2)*70,91,63);
 });
 doc.save(title+'-'+new Date().toISOString().slice(0,10)+'.pdf');
}
async function print(ids,title){
 if(!ids.length)return info('Keine Schüler zum Drucken ausgewählt.',true);
 try{
  const cards=await readCards(ids),missing=cards.filter(s=>!s.access_code);
  if(missing.length){
   const old=missing.filter(s=>s.has_code).length;
   const newer=missing.length-old;
   info((old?old+' bereits vergebene Codes müssen aus der ursprünglichen CSV übernommen werden. ':'')+
    (newer?newer+' Schüler benötigen zuerst neue Zugangscodes.':''),true);
   if(ids.length===1&&old&&confirm('Für diesen Schüler einen NEUEN Code ausstellen? Der bisherige Code wird dadurch ungültig.')){
    await issue(ids,true);await reload();info('Neuer Code erstellt und als CSV ausgegeben. Bitte jetzt Karte PDF klicken.');
   }
   return;
  }
  createPdf(cards,title);
  info(cards.length+' Zugangskarte(n) als A4-PDF erstellt. PDF vertraulich behandeln.');
 }catch(err){info(err.message||'PDF-Druck fehlgeschlagen.',true)}
}
$('directoryPrint').onclick=()=>print(scopeIds(),'Lernmodule-Zugangskarten');
function parseCsv(text){
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/,1)[0],sep=first.includes(';')?';':first.includes('\t')?'\t':',';
 const rows=[];let row=[],v='',inside=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(inside&&text[i+1]==='"'){v+='"';i++}else inside=!inside}
  else if(c===sep&&!inside){row.push(v.trim());v=''}
  else if((c==='\n'||c==='\r')&&!inside){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(v.trim());if(row.some(Boolean))rows.push(row);row=[];v='';
  }else v+=c;
 }
 if(inside)throw Error('Unvollständige Anführungszeichen in CSV.');
 row.push(v.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error('CSV enthält keine Codes.');
 const keys=rows.shift().map(x=>x.toLowerCase().replace(/[^a-z0-9_]/g,''));
 const id=keys.findIndex(x=>['schueler_id','schuelerid','external_id','id'].includes(x));
 const code=keys.findIndex(x=>['zugangscode','access_code','code'].includes(x));
 if(id<0||code<0)throw Error('CSV-Spalten Schueler_ID und Zugangscode fehlen.');
 return rows.map(r=>({id:r[id],code:r[code]})).filter(r=>r.id&&r.code);
}
$('directoryImportCodes').onclick=async()=>{
 const file=$('directoryCodeCsv').files[0];
 if(!file)return info('Bitte zuerst eine Code-CSV auswählen.',true);
 const button=$('directoryImportCodes');button.disabled=true;
 try{
  const entries=parseCsv(await file.text());
  if(entries.length>1200)throw Error('Maximal 1200 Codes pro Datei.');
  if(!confirm(entries.length+' vorhandene Codes prüfen und verschlüsselt hinterlegen?'))return;
  const byId=new Map(pupils.map(s=>[s.external_id,s.id]));
  let ok=0,errors=[];
  for(const entry of entries){
   const student_id=byId.get(entry.id);
   if(!student_id){errors.push(entry.id+' nicht gefunden');continue}
   const {error}=await db.rpc('import_learning_student_code',{p_student_id:student_id,p_existing_code:entry.code});
   if(error)errors.push(entry.id+': '+error.message);else ok++;
  }
  $('directoryCodeCsv').value='';
  info(ok+' Codes übernommen.'+(errors.length?' Fehler: '+errors.join(', ').slice(0,350):''),!!errors.length);
 }catch(err){info(err.message,true)}finally{button.disabled=false}
};
async function show(){
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {data,error}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
 if(error||!data)return;
 $('campaignOverview').hidden=true;$('learningGuide').hidden=true;panel.hidden=false;
 $('selectedCampaignLabel').textContent='Schülerdatenbank (unabhängig von Ausschreibungen)';
 try{await reload()}catch(err){info(err.message||'Laden fehlgeschlagen.',true)}
}
window.learningOpenStudentDirectory=show;
window.learningCloseStudentDirectory=()=>{panel.hidden=true;$('directoryEditor').hidden=true;editId=null;};
open.addEventListener('click',show);
$('chooseCampaigns').addEventListener('click',()=>window.learningCloseStudentDirectory(),{capture:true});
db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){panel.hidden=true;pupils=[];codes.clear()}});
})();