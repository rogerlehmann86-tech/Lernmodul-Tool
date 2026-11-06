/* Geschütztes Lernmodul-Schülerportal. Zugangsdaten bleiben nur bis zum Schliessen/Neuladen im Arbeitsspeicher. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=s=>({open:'Anmeldung offen',closed:'Anmeldung abgeschlossen',allocated:'Zuteilung wird vorbereitet',published:'Zuteilung veröffentlicht'})[s]||'In Bearbeitung';
 const date=s=>new Date(s).toLocaleString('de-CH',{dateStyle:'medium',timeStyle:'short'});
 const login=$('studentPortalLogin'),form=$('studentPortalLoginForm'),content=$('studentPortalContent'),cards=$('studentCampaigns');
 if(!form||!cards)return;
 let credential=null;
 let currentData=null;
 let seq=0;
 const info=(msg,isError=false)=>{
   $('studentPortalNotice').textContent=msg;
   $('studentPortalNotice').style.color=isError?'#a02b28':'#326e45';
 };
 function empty(){cards.replaceChildren();$('studentPortalWelcome').textContent='';currentData=null;}
 function logout(){
   seq++;
   credential=null;
   empty();
   $('studentPortalId').value='';
   $('studentPortalCode').value='';
   login.hidden=false;content.hidden=true;
   info('Melde dich mit deiner Schüler-ID und deinem persönlichen Zugangscode an.');
 }
 async function refresh(){
   if(!credential)return;
   const thisSeq=++seq;
   const {data,error}=await db.rpc('student_portal_login',{
     p_external_id:credential.id,p_access_code:credential.code
   });
   if(thisSeq!==seq)return;
   if(error||!data?.ok){
     logout();
     info('Die Anmeldung ist nicht mehr gültig. Bitte erneut anmelden.',true);
     return;
   }
   currentData=data;
   login.hidden=true;content.hidden=false;
   $('studentPortalWelcome').textContent='Hallo '+data.student.first_name+' '+data.student.last_name;
   render(data.campaigns||[]);
 }
 function moduleLabel(m){
   return '<strong>'+esc(m.title)+'</strong>'+(m.description?'<p>'+esc(m.description)+'</p>':'');
 }
 function render(list){
   if(!list.length){
     cards.innerHTML='<div class="portal-empty"><h3>Zurzeit keine zugewiesenen Ausschreibungen</h3>'+
       '<p>Du bist momentan keiner freigegebenen Lernmodul-Ausschreibung zugeteilt. Falls du eine erwartest, melde dich bei deiner Lehrperson.</p></div>';
     return;
   }
   cards.innerHTML=list.map(c=>{
     const now=Date.now(),start=new Date(c.starts_at).getTime(),end=new Date(c.ends_at).getTime();
     const open=c.status==='open'&&start<=now&&now<end;
     let body='';
     if(c.status==='published'){
       body='<h4>Deine Modulzuteilung</h4>'+
         ((c.results||[]).length?'<div class="portal-module-list">'+c.results.map(m=>
           '<div class="portal-module"><strong>'+esc(m.module)+'</strong>'+
           (m.time_slot?'<p>'+esc(m.time_slot)+'</p>':'')+
           '<span class="muted">'+(m.rank?'Dein Wunsch '+esc(m.rank):'Zuteilung durch die Schule')+'</span></div>').join('')+'</div>':
           '<p>Für dich ist kein Modul eingetragen. Bitte melde dich bei deiner Lehrperson.</p>');
     }else if(c.registered){
       body='<p><strong>Deine Modulwünsche wurden gespeichert.</strong></p>'+
         '<ol>'+((c.preferences||[]).map(w=>'<li>'+esc(w.module)+'</li>').join(''))+'</ol>'+
         (c.status!=='open'?'<p class="muted">Die Schule prüft die Zuteilung. Hier siehst du das Resultat nach der Freigabe.</p>':'');
     }else if(c.can_submit&&open){
       body='<p>Wähle '+Number(c.max_preferences)+' unterschiedliche Module. Wunsch 1 hat die höchste Priorität.</p>'+
         '<form class="portal-wish-form" data-campaign="'+esc(c.id)+'">'+
         '<div class="portal-module-list">'+(c.modules||[]).map(m=>'<article class="portal-module">'+moduleLabel(m)+'</article>').join('')+'</div>'+
         '<div class="portal-preferences">'+Array.from({length:c.max_preferences},(_,i)=>
           '<label>Wunsch '+(i+1)+'<select class="portal-preference" required>'+
           '<option value="">Modul auswählen</option>'+
           (c.modules||[]).map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+'</option>').join('')+
           '</select></label>').join('')+'</div>'+
         '<button type="submit">Modulwünsche verbindlich speichern</button></form>';
     }else if(c.status==='open'&&start>now){
       body='<p>Die Anmeldung öffnet am '+date(c.starts_at)+'.</p>';
     }else{
       body='<p>Die Anmeldung ist abgeschlossen. '+(c.status==='allocated'?'Die Schule arbeitet an der Zuteilung.':'Bitte wende dich bei Fragen an deine Lehrperson.')+'</p>';
     }
     return '<section class="panel portal-campaign"><div class="portal-campaign-top"><div>'+
       '<h3>'+esc(c.title)+'</h3><p class="muted">'+(c.status==='published'?'Ergebnisse verfügbar':
       'Anmeldezeitraum: '+date(c.starts_at)+' – '+date(c.ends_at))+'</p></div>'+
       '<span class="portal-status">'+(c.status==='open'&&!open?(start>now?'Bald geöffnet':'Anmeldung beendet'):status(c.status))+
       '</span></div>'+body+'</section>';
   }).join('');
 }
 form.addEventListener('submit',async e=>{
   e.preventDefault();
   const id=$('studentPortalId').value.trim();
   const code=$('studentPortalCode').value.trim();
   const button=$('studentPortalSignIn');button.disabled=true;
   info('Zugang wird geprüft …');
   try{
     const {data,error}=await db.rpc('student_portal_login',{p_external_id:id,p_access_code:code});
     if(error)throw error;
     if(!data?.ok){info(data?.message||'Schüler-ID oder Zugangscode ungültig.',true);return;}
     credential={id,code};
     $('studentPortalCode').value='';
     login.hidden=true;content.hidden=false;
     currentData=data;
     $('studentPortalWelcome').textContent='Hallo '+data.student.first_name+' '+data.student.last_name;
     info('');
     render(data.campaigns||[]);
   }catch(_err){info('Anmeldung zurzeit nicht möglich. Bitte erneut versuchen.',true)}
   finally{button.disabled=false;}
 });
 cards.addEventListener('submit',async e=>{
   const wishForm=e.target.closest('.portal-wish-form');
   if(!wishForm)return;
   e.preventDefault();
   if(!credential)return info('Bitte erneut anmelden.',true);
   const c=currentData?.campaigns?.find(x=>x.id===wishForm.dataset.campaign);
   if(!c||!c.can_submit)return info('Für diese Ausschreibung ist keine Anmeldung möglich.',true);
   const moduleIds=[...wishForm.querySelectorAll('.portal-preference')].map(x=>x.value);
   if(moduleIds.length!==c.max_preferences||moduleIds.some(x=>!x)||new Set(moduleIds).size!==moduleIds.length)
     return info('Bitte für alle Wünsche unterschiedliche Module auswählen.',true);
   const button=wishForm.querySelector('button[type=submit]');button.disabled=true;
   try{
     const {error}=await db.rpc('submit_student_preferences',{
       p_campaign_id:c.id,p_external_id:credential.id,p_access_code:credential.code,p_module_ids:moduleIds
     });
     if(error)throw error;
     info('Deine Modulwünsche wurden gespeichert.');
     await refresh();
   }catch(err){info(err.message||'Die Wünsche konnten nicht gespeichert werden.',true)}
   finally{button.disabled=false;}
 });
 $('studentPortalSignOut').addEventListener('click',logout);
 $('studentPortalReload').addEventListener('click',()=>refresh().catch(()=>info('Aktualisierung fehlgeschlagen.',true)));
 window.reloadStudentPortal=refresh;
 window.loadLearningSignup=refresh;
 window.reloadPublishedResults=refresh;
 logout();
})();
