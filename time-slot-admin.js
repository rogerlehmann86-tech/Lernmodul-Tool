/* Zeitblöcke für Modulüberschneidungen */
(() => {
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msg=(s,error=false)=>{$('notice').textContent=s;$('notice').style.color=error?'#a02b28':'#236747';};
  const form=$('moduleForm'),campaign=$('moduleCampaign'),select=$('moduleTimeSlot');
  const area=document.createElement('div');
  area.className='tool-section';
  area.innerHTML='<h3>Zeitblöcke</h3><p class="muted">Module im gleichen Zeitblock können nicht demselben Schüler zugeteilt werden. Bei verschiedenen, aber überlappenden Zeitblöcken behandelt die automatische Verteilung sie vorsichtshalber als Konflikt.</p>'+
    '<form id="slotForm"><label>Bezeichnung<input name="title" placeholder="z. B. Montag, 1. Lektion" required></label>'+
    '<label>Beginn (optional)<input name="starts_at" type="datetime-local"></label>'+
    '<label>Ende (optional)<input name="ends_at" type="datetime-local"></label>'+
    '<button>Neuen Zeitblock speichern</button></form><div id="timeSlotList"></div>';
  form.insertAdjacentElement('afterend',area);
  async function load(){
    const id=campaign.value;
    if(!id){select.innerHTML='<option value="">Kein Zeitblock</option>';$('timeSlotList').textContent='Zuerst eine Ausschreibung erstellen.';return;}
    const {data,error}=await db.from('time_slots').select('id,title,starts_at,ends_at').eq('campaign_id',id).order('title');
    if(error){msg(error.message,true);return;}
    const chosen=select.value;
    select.innerHTML='<option value="">Kein Zeitblock</option>'+(data||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title)+'</option>').join('');
    if((data||[]).some(t=>t.id===chosen))select.value=chosen;
    $('timeSlotList').innerHTML=(data||[]).map(t=>'<p>'+esc(t.title)+
      (t.starts_at&&t.ends_at?' · '+esc(new Date(t.starts_at).toLocaleString('de-CH'))+' – '+esc(new Date(t.ends_at).toLocaleString('de-CH')):' · ohne Uhrzeit')+'</p>').join('')||'<p class="muted">Noch keine Zeitblöcke erfasst.</p>';
  }
  campaign.addEventListener('change',load);
  $('slotForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!campaign.value)return msg('Bitte eine Ausschreibung wählen.',true);
    const raw=Object.fromEntries(new FormData(e.target));
    if(Boolean(raw.starts_at)!==Boolean(raw.ends_at))return msg('Beginn und Ende gemeinsam ausfüllen oder beide leer lassen.',true);
    const starts_at=raw.starts_at?new Date(raw.starts_at).toISOString():null;
    const ends_at=raw.ends_at?new Date(raw.ends_at).toISOString():null;
    if(starts_at&&ends_at<=starts_at)return msg('Ende muss nach Beginn liegen.',true);
    const {error}=await db.from('time_slots').insert({campaign_id:campaign.value,title:raw.title,starts_at,ends_at});
    if(error)return msg(error.message,true);
    e.target.reset();await load();msg('Zeitblock gespeichert.');
  });
  const original=window.refresh;
  if(typeof original==='function')window.refresh=async(...args)=>{await original(...args);await load();};
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN')setTimeout(load,500)});
  load();
})();