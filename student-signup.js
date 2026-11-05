/* Schüleranmeldung – persönliche Codes, keine Schülerdaten im Browser */
(() => {
  const get=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notice=(s,bad=false)=>{get('notice').textContent=s;get('notice').style.color=bad?'#9b3030':'#24664e';};
  let campaigns=[];
  const form=get('studentSignup'),select=get('signupCampaign'),fields=get('preferenceFields');
  async function load(){
    const {data,error}=await db.from('campaigns').select('id,title,max_preferences,ends_at,modules(id,title,description)').eq('status','open').order('ends_at');
    if(error){get('studentSignupInfo').textContent='Anmeldung zurzeit nicht verfügbar.';return;}
    campaigns=(data||[]).filter(c=>new Date(c.ends_at)>new Date());
    if(!campaigns.length){get('studentSignupInfo').textContent='Zurzeit ist keine Anmeldung offen.';form.hidden=true;return;}
    get('studentSignupInfo').textContent='Wähle deine Module in der gewünschten Reihenfolge. Du benötigst die Schüler-ID und den persönlichen Code der Schule.';
    form.hidden=false;
    select.innerHTML=campaigns.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('');
    render();
  }
  function render(){
    const c=campaigns.find(x=>x.id===select.value);if(!c)return;
    fields.innerHTML='';const mods=c.modules||[];
    if(mods.length<c.max_preferences){fields.textContent='Es sind noch nicht genügend Module verfügbar.';get('submitPreferences').disabled=true;return;}
    get('submitPreferences').disabled=false;
    const p=document.createElement('p');p.className='muted';p.textContent='Wunsch 1 ist dein Favorit. Wähle '+c.max_preferences+' unterschiedliche Module.';fields.appendChild(p);
    for(let i=0;i<c.max_preferences;i++){
      const label=document.createElement('label');label.textContent='Wunsch '+(i+1);
      const el=document.createElement('select');el.required=true;el.className='preference-select';
      el.innerHTML='<option value="">Bitte auswählen</option>'+mods.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+'</option>').join('');
      label.appendChild(el);fields.appendChild(label);
    }
  }
  select.addEventListener('change',render);
  form.addEventListener('submit',async e=>{
    e.preventDefault();const ids=Array.from(document.querySelectorAll('.preference-select')).map(s=>s.value);
    if(ids.some(x=>!x)||new Set(ids).size!==ids.length)return notice('Bitte unterschiedliche Module für alle Wünsche wählen.',true);
    const button=get('submitPreferences');button.disabled=true;
    try{
      const {data,error}=await db.rpc('submit_student_preferences',{p_campaign_id:select.value,p_external_id:get('studentExternalId').value.trim(),p_access_code:get('studentAccessCode').value.trim(),p_module_ids:ids});
      if(error)throw error;notice(data||'Deine Wünsche wurden gespeichert.');form.reset();render();
    }catch(e){notice(e.message||'Anmeldung fehlgeschlagen.',true);}
    finally{button.disabled=false;}
  });
  get('reloadSignups').addEventListener('click',load);
  load();
})();