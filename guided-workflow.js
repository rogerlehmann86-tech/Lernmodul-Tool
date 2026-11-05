/* Geführte Administration: aufklappbare, jederzeit manuell bedienbare Schritte. */
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const stepDefinitions = [
    {id:'campaign', title:'Ausschreibung anlegen', help:'Lege zuerst Zeitraum, Modulanzahl und Anzahl der Wünsche fest.'},
    {id:'modules', title:'Module und Zeitblöcke erfassen', help:'Erfasse alle angebotenen Module. Optional kannst du Zeitblöcke für die spätere Zuteilung anlegen.'},
    {id:'students', title:'Schüler importieren', help:'Importiere eine Schülerliste als CSV. Bereits vorhandene Schüler werden über ihre eindeutige ID aktualisiert.'},
    {id:'codes', title:'Persönliche Zugangscodes', help:'Erzeuge die Zugangscodes und bewahre die heruntergeladene Datei geschützt auf.'},
    {id:'eligibility', title:'Teilnehmende auswählen', help:'Wähle die Klassen oder einzelnen Schüler, die an dieser Ausschreibung teilnehmen dürfen.'},
    {id:'publish', title:'Anmeldung freigeben', help:'Prüfe die Angaben und gib dann die Anmeldung zum vorgesehenen Zeitraum frei.'},
    {id:'registration', title:'Anmeldungen kontrollieren', help:'Kontrolliere die abgegebenen Wünsche, fehlende Anmeldungen und nötige Nachmeldungen.'},
    {id:'allocation', title:'Module zuteilen und Ergebnisse freigeben', help:'Berechne die Verteilung, kontrolliere sie und veröffentliche die Resultate erst nach der Prüfung.'}
  ];
  const guide = new Map();
  let manuallyNavigated = false;
  let currentUserId = null;

  const admin = byId('admin');
  const topPanel = admin?.querySelector(':scope > .panel');
  if (!admin || !topPanel || !byId('campaign') || !byId('modules') || !byId('students') || !byId('allocation')) return;

  const area = document.createElement('div');
  area.id = 'learningGuide';
  area.className = 'guide';
  area.innerHTML =
    '<div class="guide-intro"><div><h2>Geführte Einrichtung</h2>' +
    '<p>Schritt für Schritt zur fertigen Ausschreibung. Jeder Bereich lässt sich jederzeit manuell öffnen oder schliessen.</p></div>' +
    '<button class="secondary" type="button" id="guideSuggested">Nächsten sinnvollen Schritt anzeigen</button></div>' +
    '<p id="guideProgress" class="guide-progress" role="status" aria-live="polite"></p>';
  topPanel.insertAdjacentElement('afterend',area);

  const bodies = new Map();
  stepDefinitions.forEach((step,i) => {
    const details = document.createElement('details');
    details.className = 'guide-step';
    details.dataset.step = step.id;
    details.innerHTML =
      '<summary><span class="guide-number">'+(i+1)+'</span>'+
      '<span class="guide-heading"><strong>'+step.title+'</strong><small>'+step.help+'</small></span>'+
      '<span class="guide-chevron" aria-hidden="true"></span></summary>' +
      '<div class="guide-content"><div class="guide-inner"></div>'+
      '<div class="guide-actions">'+
      (i>0?'<button type="button" class="secondary" data-guide-nav="'+stepDefinitions[i-1].id+'">Zurück</button>':'')+
      (i<stepDefinitions.length-1?'<button type="button" data-guide-nav="'+stepDefinitions[i+1].id+'">Weiter: '+stepDefinitions[i+1].title+'</button>':'')+
      '</div></div>';
    const body = details.querySelector('.guide-inner');
    area.appendChild(details);
    guide.set(step.id,details);
    bodies.set(step.id,body);
    details.addEventListener('toggle',()=>{
      if(details.open) {
        details.classList.add('guide-open');
        for(const other of guide.values())if(other!==details)other.open=false;
      } else {
        details.classList.remove('guide-open');
      }
    });
  });

  // Vorhandene Formulare und ihre Event-Listener bleiben intakt: Wir verschieben nur DOM-Knoten.
  for(const id of ['campaign','modules','allocation']){
    const elem=byId(id);
    elem.classList.remove('hidden');
    elem.classList.add('guide-original');
    bodies.get(id).appendChild(elem);
  }
  const studentSection = byId('students');
  const subSections = Array.from(studentSection.querySelectorAll(':scope > .tool-section'));
  const subTarget = [
    ['codes','#generateCodes'],
    ['eligibility','#eligibleSave'],
    ['publish','#publishNow'],
    ['registration','#registrationLoad']
  ];
  for(const [step,childSelector] of subTarget) {
    const matching=subSections.find(el=>el.querySelector(childSelector));
    if(matching) {
      matching.classList.add('guide-original');
      bodies.get(step).appendChild(matching);
    } else {
      const warning=document.createElement('p');
      warning.className='muted';
      warning.textContent='Dieser Verwaltungsbereich konnte nicht geladen werden. Bitte die Seite neu laden.';
      bodies.get(step).appendChild(warning);
    }
  }
  studentSection.classList.remove('hidden');
  studentSection.classList.add('guide-original');
  bodies.get('students').appendChild(studentSection);

  function openStep(id,{manual=false,focus=false}={}) {
    const chosen=guide.get(id);
    if(!chosen)return;
    if(manual)manuallyNavigated=true;
    for(const [key,details] of guide)details.open=key===id;
    document.querySelectorAll('#admin [data-view]').forEach(button=>{
      const target=button.dataset.view;
      button.classList.toggle('guide-nav-active',
        target===(id==='codes'||id==='eligibility'||id==='publish'||id==='registration'?'students':id));
      button.setAttribute('aria-pressed',String(button.classList.contains('guide-nav-active')));
    });
    if(focus){
      chosen.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    }
  }
  // Bereits vorhandene Register-Buttons bleiben als Direktnavigation zu den Schritten erhalten.
  document.querySelectorAll('#admin [data-view]').forEach(button=>{
    button.onclick=()=>{
      const target=button.dataset.view;
      const next=target==='students'?'students':target;
      openStep(next,{manual:true,focus:true});
    };
  });
  area.addEventListener('click',event=>{
    const button=event.target.closest('[data-guide-nav]');
    if(!button)return;
    openStep(button.dataset.guideNav,{manual:true,focus:true});
  });
  area.addEventListener('click',event=>{
    if(event.target.closest('summary'))manuallyNavigated=true;
  });

  async function getCount(table,filter){
    let query=db.from(table).select('*',{count:'exact',head:true});
    if(filter)query=filter(query);
    const {count,error}=await query;
    if(error)throw error;
    return count??0;
  }
  async function suggest({force=false}={}){
    const {data:{user}}=await db.auth.getUser();
    if(!user) return;
    const {data:adminRow,error:adminError}=await db.from('admin_users')
      .select('user_id').eq('user_id',user.id).maybeSingle();
    if(adminError||!adminRow) return;
    currentUserId=user.id;
    if(manuallyNavigated&&!force)return;
    const {data:campaigns,error}=await db.from('campaigns')
      .select('id,title,status,max_preferences').order('created_at',{ascending:false}).limit(1);
    if(error)throw error;
    const progress=byId('guideProgress');
    if(!campaigns?.length){
      progress.textContent='Noch keine Ausschreibung vorhanden. Beginne bei Schritt 1.';
      openStep('campaign');
      return;
    }
    const campaign=campaigns[0];
    const [moduleCount,studentCount,allowedCount,registrationCount,codeCount] = await Promise.all([
      getCount('modules',q=>q.eq('campaign_id',campaign.id).eq('active',true)),
      getCount('students',q=>q.eq('active',true)),
      getCount('campaign_students',q=>q.eq('campaign_id',campaign.id)),
      getCount('registrations',q=>q.eq('campaign_id',campaign.id)),
      getCount('student_access_codes')
    ]);
    let next;
    if(campaign.status==='draft'){
      if(moduleCount<campaign.max_preferences)next='modules';
      else if(!studentCount)next='students';
      else if(codeCount<studentCount)next='codes';
      else if(!allowedCount)next='eligibility';
      else next='publish';
    } else if(campaign.status==='open') {
      next=codeCount<studentCount?'codes':'registration';
    } else if(campaign.status==='closed'||campaign.status==='allocated'){
      next='allocation';
    } else if(campaign.status==='published'){
      next='allocation';
    } else next='campaign';

    progress.textContent='Aktuelle Ausschreibung: '+campaign.title+' · '+moduleCount+' Module · '+
      allowedCount+' zugelassene Schüler · '+registrationCount+' Anmeldungen · Status: '+campaign.status+'.';
    openStep(next,{focus:force});
  }

  byId('guideSuggested').addEventListener('click',()=>{
    manuallyNavigated=false;
    suggest({force:true}).catch(err=>{
      byId('guideProgress').textContent='Schritt konnte nicht ermittelt werden: '+err.message;
    });
  });

  window.learningGuideAdvance=async function(completedStep,options={}) {
    const next={
      campaign:'modules',
      modules:'students',
      students:'codes',
      codes:'eligibility',
      eligibility:'publish',
      publish:'registration',
      registration:'allocation'
    }[completedStep];
    // Bei mehreren Modulen erst zum Import wechseln, wenn die geforderte Wunschanzahl erreicht ist.
    if(completedStep==='modules'&&!options.force){
      const campaignId=byId('moduleCampaign')?.value;
      if(!campaignId)return;
      const {data:campaign,error:campaignError}=await db.from('campaigns')
        .select('max_preferences').eq('id',campaignId).maybeSingle();
      if(campaignError||!campaign)return;
      const moduleCount=await getCount('modules',q=>q.eq('campaign_id',campaignId).eq('active',true));
      if(moduleCount<campaign.max_preferences){
        byId('guideProgress').textContent='Modul gespeichert: '+moduleCount+' von mindestens '+
          campaign.max_preferences+' Modulen erfasst. Du kannst weitere Module hinzufügen.';
        return;
      }
    }
    if(next) {
      manuallyNavigated=false;
      openStep(next,{focus:true});
      byId('guideProgress').textContent='Schritt gespeichert. Als Nächstes: '+
        (stepDefinitions.find(step=>step.id===next)?.title||next)+
        '. Du kannst jeden Abschnitt später erneut öffnen.';
    }
  };

  // Erste Stufe als sanfter Standard. Bestehende Daten entscheiden über den passenden Start.
  openStep('campaign');
  db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_IN'){
      Promise.resolve().then(()=>suggest()).catch(()=>{});
    }
  });
  suggest().catch(()=>{});

  // Exakt eine offene Stufe bleibt übersichtlich; summary selbst darf diese auch schliessen.
  window.learningGuideOpenStep=openStep;
})();
