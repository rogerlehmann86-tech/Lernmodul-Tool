/* Schüler sehen freigegebene Resultate nur mit ihrem persönlichen Code. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const section=$('publishedResults');
  if(!section)return;
  section.innerHTML='<h2>Deine Zuteilung ansehen</h2><p class="muted" id="publishedInfo">Freigegebene Ergebnisse werden geladen …</p>'+
    '<form id="resultsForm" hidden>'+
      '<label>Ausschreibung<select id="resultsCampaign" required></select></label>'+
      '<div class="student-auth-grid">'+
       '<label>Schüler-ID<input id="resultsStudentId" autocomplete="off" required></label>'+
       '<label>Persönlicher Zugangscode<input id="resultsAccessCode" autocomplete="off" required placeholder="XXXX-XXXX-XXXX-XXXX"></label>'+
      '</div><button type="submit">Zuteilung anzeigen</button>'+
    '</form><div id="resultsOutput" role="status" aria-live="polite"></div>';
  async function load(){
    const {data,error}=await db.from('campaigns').select('id,title').eq('status','published').order('created_at',{ascending:false});
    if(error){$('publishedInfo').textContent='Ergebnisse können derzeit nicht geladen werden.';return;}
    $('resultsForm').hidden=!data?.length;
    $('publishedInfo').textContent=data?.length?'Nach Freigabe durch die Schulverwaltung kannst du hier deine persönliche Modulzuteilung ansehen.':'Es sind noch keine Zuteilungsergebnisse veröffentlicht.';
    $('resultsCampaign').innerHTML=(data||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('');
  }
  $('resultsForm').addEventListener('submit',async e=>{
    e.preventDefault();
    $('resultsOutput').textContent='Ergebnis wird geprüft …';
    try{
      const {data,error}=await db.rpc('read_published_learning_results',{
        p_campaign_id:$('resultsCampaign').value,
        p_external_id:$('resultsStudentId').value.trim(),
        p_access_code:$('resultsAccessCode').value.trim()
      });
      if(error)throw error;
      if(!Array.isArray(data))throw Error('Unerwartetes Ergebnisformat.');
      $('resultsOutput').innerHTML=!data.length?'<p>Dir wurde kein Modul zugeteilt. Bitte melde dich beim Sekretariat.</p>':
        '<h3>Deine Module</h3><div class="modules">'+data.map(m=>
          '<article class="module"><strong>'+esc(m.module)+'</strong>'+
          (m.time_slot?'<p>'+esc(m.time_slot)+'</p>':'')+
          '<p class="muted">'+(m.rank?'Dein Wunsch '+esc(m.rank):'Manuelle Zuteilung')+'</p></article>'
        ).join('')+'</div>';
      $('resultsAccessCode').value='';
    }catch(e){
      $('resultsOutput').textContent='Keine Resultate gefunden. Bitte Schüler-ID, Zugangscode und Ausschreibung prüfen.';
    }
  });
  window.reloadPublishedResults=load;
  load();
})();