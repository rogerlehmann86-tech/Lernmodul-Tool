/* Verwaltung: zuerst Ausschreibung wählen, danach schrittweise bearbeiten. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const steps=[
    {id:'campaign',title:'Ausschreibung',hint:'Zeitraum, Modulanzahl und Wünsche prüfen oder einen Entwurf bearbeiten.'},
    {id:'modules',title:'Module und Zeitblöcke',hint:'Module erfassen, bearbeiten oder löschen und Zeitblöcke zuordnen.'},
    {id:'students',title:'Schüler importieren',hint:'Schülerstammdaten verwalten und die CSV-Liste aktualisieren.'},
    {id:'codes',title:'Persönliche Zugangscodes',hint:'Zugangscodes für die Schüler erzeugen oder ersetzen.'},
    {id:'eligibility',title:'Teilnehmende auswählen',hint:'Klassen und einzelne Schüler für diese Ausschreibung zulassen.'},
    {id:'publish',title:'Anmeldung freigeben',hint:'Den Entwurf nach der Kontrolle für Schüler öffnen.'},
    {id:'registration',title:'Anmeldungen kontrollieren',hint:'Wunschlisten, fehlende und verspätete Anmeldungen prüfen.'},
    {id:'allocation',title:'Zuteilung und Ergebnisse',hint:'Berechnen, kontrollieren, exportieren und veröffentlichen.'}
  ];
  const admin=$('admin'),bar=admin?.querySelector(':scope > .admin-toolbar');
  if(!admin||!bar||!$('campaign')||!$('modules')||!$('students')||!$('allocation'))return;
  const chooser=document.createElement('section');
  chooser.id='campaignOverview';
  chooser.className='panel campaign-overview';
  chooser.hidden=true;
  chooser.innerHTML='<div class="campaign-header"><div><h2>Ausschreibungen</h2>'+
    '<p class="muted">Wähle eine Ausschreibung zum Bearbeiten oder erstelle eine neue.</p></div>'+
    '<button id="newCampaign" type="button">Neue Ausschreibung</button></div>'+
    '<div id="campaignCards"></div>';
  bar.insertAdjacentElement('afterend',chooser);
  const guide=document.createElement('section');
  guide.id='learningGuide';guide.className='guide';guide.hidden=true;
  guide.innerHTML='<div class="guide-intro"><div><h2 id="guideTitle">Ausschreibung</h2>'+
    '<p id="guideSubtitle" class="muted">Bearbeite die folgenden Abschnitte in beliebiger Reihenfolge.</p></div>'+
    '<button class="secondary" type="button" id="guideSuggested">Nächsten sinnvollen Schritt anzeigen</button></div>'+
    '<p id="guideProgress" class="guide-progress" role="status" aria-live="polite"></p>';
  chooser.insertAdjacentElement('afterend',guide);
  const detailsMap=new Map(),innerMap=new Map();
  steps.forEach((step,i)=>{
    const details=document.createElement('details');
    details.className='guide-step';details.dataset.step=step.id;
    details.innerHTML='<summary><span class="guide-number">'+(i+1)+'</span>'+
      '<span class="guide-heading"><strong>'+step.title+'</strong><small>'+step.hint+'</small></span>'+
      '<span class="guide-chevron" aria-hidden="true"></span></summary>'+
      '<div class="guide-content"><div class="guide-inner"></div>'+
      '<div class="guide-actions">'+
      (i>0?'<button type="button" class="secondary" data-guide-nav="'+steps[i-1].id+'">Zurück</button>':'')+
      (i+1<steps.length?'<button type="button" data-guide-nav="'+steps[i+1].id+'">Weiter: '+steps[i+1].title+'</button>':'')+
      '</div></div>';
    guide.appendChild(details);
    detailsMap.set(step.id,details);
    innerMap.set(step.id,details.querySelector('.guide-inner'));
    details.addEventListener('toggle',()=>{
      if(details.open)for(const other of detailsMap.values())if(other!==details)other.open=false;
    });
  });
  // DOM-Knoten behalten ihre bestehenden Listener und Berechtigungen.
  for(const key of ['campaign','modules','allocation']){
    const el=$(key);
    el.classList.remove('hidden');el.classList.add('guide-original');
    innerMap.get(key).appendChild(el);
  }
  const studentPanel=$('students'),sections=[...studentPanel.querySelectorAll(':scope > .tool-section')];
  const targets=[['codes','#generateCodes'],['eligibility','#eligibleSave'],['publish','#publishNow'],['registration','#registrationLoad']];
  for(const [step,selector] of targets){
    const el=sections.find(x=>x.querySelector(selector));
    if(el){el.classList.add('guide-original');innerMap.get(step).appendChild(el);}
    else innerMap.get(step).textContent='Der Abschnitt konnte nicht geladen werden.';
  }
  studentPanel.classList.remove('hidden');studentPanel.classList.add('guide-original');
  innerMap.get('students').appendChild(studentPanel);

  // Jede Ausschreibung wird nur über die gemeinsame Auswahl gesteuert.
  let selectedId=null,selectedCampaign=null,operationSerial=0;
  window.learningCurrentCampaignId=null;
  window.learningCampaignEditing=false;
  window.learningEditingModuleId=null;
  const selectors=['moduleCampaign','eligibleCampaign','publishCampaign','registrationCampaign','allocationCampaign'];
  for(const id of selectors){
    const el=$(id);
    if(el?.closest('label'))el.closest('label').hidden=true;
  }
  function openStep(id,focus=false){
    if(!guide.hidden&&detailsMap.has(id)){
      for(const [name,elem] of detailsMap)elem.open=name===id;
      if(focus){
        detailsMap.get(id).scrollIntoView({
          behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
          block:'start'
        });
      }
    }
  }
  function updateForm(){
    const title=$('campaignFormTitle'),form=$('campaignForm');
    const info=$('campaignFormInfo');
    if(!selectedCampaign){
      title.textContent='Neue Ausschreibung';
      info.textContent='Erstelle eine neue Ausschreibung. Danach kannst du die Module erfassen.';
      form.hidden=false;form.reset();
      $('campaignSave').textContent='Entwurf erstellen';
      $('deleteCampaign').hidden=true;
      $('campaignCancelEdit').hidden=true;
      window.learningCampaignEditing=false;
      return;
    }
    title.textContent=selectedCampaign.status==='draft'?'Ausschreibung bearbeiten':'Ausschreibung im Überblick';
    info.textContent='Status: '+window.learningStatusLabel(selectedCampaign.status)+
      ' · Nach der Freigabe bleiben die Stammdaten zunächst gesperrt.';
    const draft=selectedCampaign.status==='draft';
    form.hidden=!draft;
    window.learningCampaignEditing=draft;
    $('campaignSave').textContent='Änderungen speichern';
    $('deleteCampaign').hidden=!draft;
    $('campaignCancelEdit').hidden=false;
    if(draft){
      for(const name of ['title','modules_per_student','max_preferences']){
        form.elements.namedItem(name).value=selectedCampaign[name]??'';
      }
      const dateValue=v=>{
        const d=new Date(v);
        return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
      };
      form.elements.namedItem('starts_at').value=dateValue(selectedCampaign.starts_at);
      form.elements.namedItem('ends_at').value=dateValue(selectedCampaign.ends_at);
    }
  }
  function resetModuleForm(){
    window.learningEditingModuleId=null;
    const f=$('moduleForm');
    if(f)f.reset();
    if($('moduleSave'))$('moduleSave').textContent='Modul speichern';
    if($('moduleCancelEdit'))$('moduleCancelEdit').hidden=true;
  }
  async function syncForms(){
    // refresh() baut bestehende Auswahllisten neu; danach wird die gemeinsame Auswahl gesetzt.
    if(typeof window.refresh==='function')await window.refresh();
    const campaignId=selectedId;
    if(!campaignId)return;
    for(const id of selectors){
      const el=$(id);
      if(!el)continue;
      if([...el.options].some(o=>o.value===campaignId)){
        el.value=campaignId;
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
  }
  async function listCampaigns(){
    const {data,error}=await db.from('campaigns').select('id,title,status,starts_at,ends_at,created_at')
      .order('created_at',{ascending:false});
    if(error)throw error;
    $('campaignCards').innerHTML=data?.length?
      '<div class="campaign-card-list">'+data.map(c=>
        '<button type="button" class="campaign-card" data-select-campaign="'+esc(c.id)+'">'+
        '<span class="campaign-card-main"><strong>'+esc(c.title)+'</strong><small>'+
        new Date(c.starts_at).toLocaleDateString('de-CH')+' – '+new Date(c.ends_at).toLocaleDateString('de-CH')+
        '</small></span><span class="campaign-status">'+esc(window.learningStatusLabel(c.status))+
        '</span><span aria-hidden="true">›</span></button>'
      ).join('')+'</div>':'<p class="muted">Noch keine Ausschreibungen vorhanden. Du kannst jetzt einen neuen Entwurf anlegen.</p>';
  }
  async function overview(){
    window.learningCloseStudentDirectory?.();
    operationSerial++;
    selectedId=null;selectedCampaign=null;
    window.learningCurrentCampaignId=null;
    window.learningCampaignEditing=false;
    resetModuleForm();
    guide.hidden=true;chooser.hidden=false;
    $('selectedCampaignLabel').textContent='Bitte Ausschreibung auswählen';
    await listCampaigns();
  }
  window.learningOpenCampaignOverview=overview;
  function selectNew(){
    window.learningCloseStudentDirectory?.();
    operationSerial++;
    selectedId=null;selectedCampaign=null;
    window.learningCurrentCampaignId=null;
    window.learningCampaignEditing=false;
    resetModuleForm();
    chooser.hidden=true;guide.hidden=false;
    for(const [key,details] of detailsMap)details.hidden=key!=='campaign';
    $('selectedCampaignLabel').textContent='Neue Ausschreibung';
    $('guideTitle').textContent='Neue Ausschreibung';
    $('guideSubtitle').textContent='Beginne mit den Angaben zur neuen Ausschreibung.';
    $('guideProgress').textContent='Schritt 1: Ausschreibung als Entwurf speichern.';
    updateForm();
    openStep('campaign',true);
  }
  window.learningChooseNewCampaign=selectNew;
  async function choose(id,{step=null}={}){
    window.learningCloseStudentDirectory?.();
    if(!id)return overview();
    const request=++operationSerial;
    const {data,error}=await db.from('campaigns').select('*').eq('id',id).single();
    if(request!==operationSerial)return;
    if(error||!data){alert('Ausschreibung wurde nicht gefunden.');return overview();}
    selectedId=data.id;selectedCampaign=data;
    window.learningCurrentCampaignId=data.id;
    window.learningCampaignEditing=data.status==='draft';
    resetModuleForm();
    chooser.hidden=true;guide.hidden=false;
    for(const details of detailsMap.values())details.hidden=false;
    $('selectedCampaignLabel').textContent=data.title+' · '+window.learningStatusLabel(data.status);
    $('guideTitle').textContent=data.title;
    $('guideSubtitle').textContent='Status: '+window.learningStatusLabel(data.status)+
      ' · Öffne einen Abschnitt, um die Ausschreibung zu bearbeiten.';
    updateForm();
    await syncForms();
    if(request!==operationSerial)return;
    if(step)openStep(step,true);
    else await suggest();
  }
  window.learningChooseCampaign=choose;
  async function count(table,filter){
    let query=db.from(table).select('*',{count:'exact',head:true});
    if(filter)query=filter(query);
    const {count,error}=await query;
    if(error)throw error;
    return count??0;
  }
  async function suggest(){
    if(!selectedId||!selectedCampaign)return;
    const id=selectedId,c=selectedCampaign;
    const [modules,students,allowed,registrations,codes]=await Promise.all([
      count('modules',q=>q.eq('campaign_id',id).eq('active',true)),
      count('students',q=>q.eq('active',true)),
      count('campaign_students',q=>q.eq('campaign_id',id)),
      count('registrations',q=>q.eq('campaign_id',id)),
      count('student_access_codes')
    ]);
    if(selectedId!==id)return;
    let next='campaign';
    if(c.status==='draft'){
      if(modules<c.max_preferences)next='modules';
      else if(!students)next='students';
      else if(codes<students)next='codes';
      else if(!allowed)next='eligibility';
      else next='publish';
    }else if(c.status==='open')next=codes<students?'codes':'registration';
    else if(['closed','allocated','published'].includes(c.status))next='allocation';
    $('guideProgress').textContent=modules+' aktive Module · '+allowed+
      ' zugelassene Schüler · '+registrations+' Anmeldungen · '+window.learningStatusLabel(c.status);
    openStep(next);
  }
  $('chooseCampaigns').addEventListener('click',()=>overview().catch(err=>alert(err.message)));
  $('newCampaign').addEventListener('click',selectNew);
  $('campaignCards').addEventListener('click',event=>{
    const button=event.target.closest('[data-select-campaign]');
    if(button)choose(button.dataset.selectCampaign).catch(err=>alert(err.message));
  });
  guide.addEventListener('click',event=>{
    const button=event.target.closest('[data-guide-nav]');
    if(button)openStep(button.dataset.guideNav,true);
  });
  $('guideSuggested').addEventListener('click',()=>{
    suggest().catch(err=>$('guideProgress').textContent=err.message);
  });
  window.learningGuideOpenStep=openStep;
  window.learningGuideAdvance=async function(completedStep){
    const next={
      campaign:'modules',modules:'students',students:'codes',codes:'eligibility',
      eligibility:'publish',publish:'registration',registration:'allocation'
    }[completedStep];
    if(!selectedId)return;
    if(completedStep==='modules'){
      const {data}=await db.from('campaigns').select('max_preferences').eq('id',selectedId).single();
      const n=await count('modules',q=>q.eq('campaign_id',selectedId).eq('active',true));
      if(data&&n<data.max_preferences){
        $('guideProgress').textContent='Noch '+(data.max_preferences-n)+
          ' Modul(e) erfassen, damit alle Wünsche möglich sind.';
        return;
      }
    }
    if(next){
      openStep(next,true);
      $('guideProgress').textContent='Nächster Schritt: '+steps.find(s=>s.id===next)?.title;
    }
  };
  // Bei jeder Sitzung zuerst die Ausschreibung wählen – keine Vermischung von Kampagnen.
  async function init(){
    const {data:{user}}=await db.auth.getUser();
    if(!user)return;
    const {data}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
    if(data)await overview();
  }
  db.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_IN')Promise.resolve().then(init).catch(()=>{});
    if(event==='SIGNED_OUT'){
      chooser.hidden=true;guide.hidden=true;
      selectedId=null;window.learningCurrentCampaignId=null;
    }
  });
  init().catch(()=>{});
})();