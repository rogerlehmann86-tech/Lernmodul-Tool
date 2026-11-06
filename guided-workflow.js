/* Verwaltung: zuerst Ausschreibung wählen, danach schrittweise bearbeiten. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const steps=[
    {id:'campaign',title:'Ausschreibung',hint:'Zeitraum, Modulanzahl und Wünsche prüfen oder einen Entwurf bearbeiten.'},
    {id:'modules',title:'Module und Zeitblöcke',hint:'Module erfassen, bearbeiten oder löschen und Zeitblöcke zuordnen.'},
    {id:'students',title:'Schülerdatenbank prüfen',hint:'Schüler und Klassen zentral erfassen oder per CSV importieren – auch vor einer neuen Ausschreibung.'},
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

  chooser.insertAdjacentHTML('beforeend',
    '<dialog id="campaignDeleteDialog" class="campaign-delete-dialog" aria-labelledby="campaignDeleteTitle">'+
    '<div class="delete-dialog-head"><h3 id="campaignDeleteTitle">Ausschreibung löschen</h3>'+
    '<button type="button" class="secondary" id="campaignDeleteClose" aria-label="Schliessen">Abbrechen</button></div>'+
    '<div id="campaignDeleteStepOne">'+
    '<p><strong>Schritt 1 von 2 – Löschung prüfen</strong></p>'+
    '<p>Die Ausschreibung <strong id="campaignDeleteName"></strong> und ihre Module, Zeitblöcke und Teilnahmefreigaben werden endgültig entfernt.</p>'+
    '<p id="campaignDeleteStatistics" class="muted" role="status"></p>'+
    '<p class="delete-warning">Schülerdaten und persönliche Zugangscodes bleiben erhalten. Ausschreibungen mit Anmeldungen oder Zuteilungen können nicht gelöscht werden.</p>'+
    '<button type="button" id="campaignDeleteNext" class="danger">Weiter zur Sicherheitsbestätigung</button></div>'+
    '<div id="campaignDeleteStepTwo" hidden>'+
    '<p><strong>Schritt 2 von 2 – Endgültige Bestätigung</strong></p>'+
    '<p>Gib den vollständigen Namen der Ausschreibung exakt ein. Erst danach wird die Schaltfläche zum endgültigen Löschen freigegeben.</p>'+
    '<label>Ausschreibungsname zur Bestätigung<input type="text" id="campaignDeleteTyped" autocomplete="off" spellcheck="false"></label>'+
    '<button type="button" id="campaignDeleteBack" class="secondary">Zurück</button>'+
    '<button type="button" id="campaignDeleteCommit" class="danger" disabled>Endgültig löschen</button></div>'+
    '<p id="campaignDeleteMessage" role="alert" class="delete-dialog-error"></p></dialog>');

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

  /* Einheitliche Fehlermeldungen direkt im jeweiligen Arbeitsschritt. */
  const names={
    title:'Titel',starts_at:'Beginn',ends_at:'Ende',
    modules_per_student:'Module pro Schüler',max_preferences:'Anzahl Wünsche',
    campaign_id:'Ausschreibung',description:'Beschreibung',
    min_capacity:'Mindestplätze',max_capacity:'Maximalplätze',
    time_slot_id:'Zeitblock'
  };
  function formOfStep(step){
    return step==='campaign'?$('campaignForm'):step==='modules'?$('moduleForm'):null;
  }
  function stepOfForm(form){
    return form?.closest('.guide-step')?.dataset.step||
      (form?.id==='campaignForm'?'campaign':form?.id==='moduleForm'||form?.id==='slotForm'?'modules':null);
  }
  function fieldName(field){
    return names[field.name]||field.closest('label')?.firstChild?.textContent?.trim()||field.name||'Eingabe';
  }
  function feedback(field){
    const v=field.validity;
    if(v.valueMissing)return fieldName(field)+': Bitte ausfüllen.';
    if(v.rangeUnderflow)return fieldName(field)+': Mindestens '+field.min+' eingeben.';
    if(v.rangeOverflow)return fieldName(field)+': Höchstens '+field.max+' eingeben.';
    if(v.badInput||v.typeMismatch||v.stepMismatch||v.patternMismatch)
      return fieldName(field)+': Bitte einen gültigen Wert eingeben.';
    return fieldName(field)+': '+(field.validationMessage||'Bitte Eingabe überprüfen.');
  }
  function clearError(step){
    const elem=detailsMap.get(step);
    if(!elem)return;
    elem.classList.remove('guide-has-error');
    delete elem.dataset.guideErrorKind;
    const msg=elem.querySelector('.guide-error-summary');
    if(msg){msg.textContent='';msg.hidden=true;}
    elem.querySelectorAll('.guide-invalid-field').forEach(field=>{
      field.classList.remove('guide-invalid-field');
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    });
    elem.querySelectorAll('.guide-field-error').forEach(node=>node.remove());
    const status=elem.querySelector('.guide-status-error');
    if(status)status.hidden=true;
  }
  function reportError(step,text,issues=[]){
    const elem=detailsMap.get(step);
    if(!elem)return;
    clearError(step);
    elem.classList.add('guide-has-error');
    elem.dataset.guideErrorKind=issues.length?'fields':'step';
    let summary=elem.querySelector('.guide-error-summary');
    if(!summary){
      summary=document.createElement('div');
      summary.className='guide-error-summary';
      summary.setAttribute('role','alert');
      summary.setAttribute('aria-live','assertive');
      innerMap.get(step).prepend(summary);
    }
    summary.textContent=text||'Bitte die markierten Angaben prüfen.';
    summary.hidden=false;
    let tag=elem.querySelector('.guide-status-error');
    if(!tag){
      tag=document.createElement('span');
      tag.className='guide-status-error';
      tag.textContent='Bitte prüfen';
      elem.querySelector('.guide-heading').appendChild(tag);
    }
    tag.hidden=false;
    for(const item of issues){
      const field=item.field;
      if(!(field instanceof HTMLElement))continue;
      field.classList.add('guide-invalid-field');
      field.setAttribute('aria-invalid','true');
      const id='guide-error-'+step+'-'+String(field.name||'value').replace(/[^a-z0-9_-]/gi,'');
      const small=document.createElement('small');
      small.id=id;small.className='guide-field-error';
      small.textContent=item.message;
      field.setAttribute('aria-describedby',id);
      field.insertAdjacentElement('afterend',small);
    }
  }
  function validateForm(form,{focus=true}={}){
    const step=stepOfForm(form);
    if(!step)return true;
    const issues=[];
    for(const field of [...form.elements]){
      if(!(field instanceof HTMLElement)||!field.willValidate||field.disabled)continue;
      if(!field.validity.valid)issues.push({field,message:feedback(field)});
    }
    function add(fieldName,message){
      const field=form.elements.namedItem(fieldName);
      if(field instanceof HTMLElement&&!issues.some(x=>x.field===field))issues.push({field,message});
    }
    if(form.id==='campaignForm'){
      const title=form.elements.namedItem('title');
      if(title?.value.trim()==='')add('title','Bitte einen Titel für die Ausschreibung eingeben.');
      const start=form.elements.namedItem('starts_at')?.value;
      const end=form.elements.namedItem('ends_at')?.value;
      if(start&&end&&new Date(end).getTime()<=new Date(start).getTime())
        add('ends_at','Das Ende muss nach dem Beginn liegen.');
      const wish=Number(form.elements.namedItem('max_preferences')?.value);
      const count=Number(form.elements.namedItem('modules_per_student')?.value);
      if(wish<count)add('max_preferences','Mindestens so viele Wünsche wie Module pro Schüler angeben.');
    }
    if(form.id==='moduleForm'){
      const min=Number(form.elements.namedItem('min_capacity')?.value);
      const max=Number(form.elements.namedItem('max_capacity')?.value);
      if(Number.isFinite(min)&&Number.isFinite(max)&&max<min)
        add('max_capacity','Die Maximalplätze dürfen nicht kleiner als die Mindestplätze sein.');
    }
    if(issues.length){
      reportError(step,'Bitte korrigiere die rot markierten Felder, bevor du diesen Schritt speicherst.',issues);
      if(focus){
        const detail=detailsMap.get(step);
        if(detail)detail.open=true;
        issues[0].field.focus();
      }
      return false;
    }
    clearError(step);
    return true;
  }
  window.learningGuideReportError=reportError;
  window.learningGuideClearError=clearError;
  window.learningGuideValidateForm=validateForm;
  guide.addEventListener('input',event=>{
    const form=event.target.closest('form');
    const step=stepOfForm(form);
    if(step&&form&&detailsMap.get(step)?.dataset.guideErrorKind==='fields'){
      // Rot bleibt bestehen, bis auch die übrigen Felder stimmen.
      validateForm(form,{focus:false});
    }
  });
  guide.addEventListener('change',event=>{
    const form=event.target.closest('form');
    const step=stepOfForm(form);
    if(step&&form&&detailsMap.get(step)?.dataset.guideErrorKind==='fields')
      validateForm(form,{focus:false});
  });
  function rememberForm(form){
    if(form)form.dataset.guideSnapshot=JSON.stringify([...new FormData(form).entries()]);
  }
  function isFormDirty(form){
    return !!form?.dataset.guideSnapshot&&
      form.dataset.guideSnapshot!==JSON.stringify([...new FormData(form).entries()]);
  }
  async function mayProceedFrom(step){
    const campaignId=selectedId;
    if(step==='campaign'){
      const form=$('campaignForm');
      if(!campaignId){
        if(!validateForm(form))return false;
        reportError('campaign','Alle Angaben sind ausgefüllt. Bitte zuerst «Entwurf erstellen» klicken, damit die Ausschreibung gespeichert wird.');
        return false;
      }
      if(selectedCampaign?.status==='draft'&&!form.hidden&&isFormDirty(form)){
        if(!validateForm(form))return false;
        reportError('campaign','Es gibt ungespeicherte Änderungen. Bitte zuerst «Änderungen speichern» klicken.');
        return false;
      }
      return true;
    }
    if(!campaignId)return false;
    if(step==='modules'){
      if(window.learningEditingModuleId){
        reportError('modules','Du bearbeitest gerade ein Modul. Bitte zuerst speichern oder die Bearbeitung abbrechen.');
        return false;
      }
      const {data,error}=await db.from('campaigns').select('max_preferences').eq('id',campaignId).single();
      if(error){reportError('modules',error.message);return false;}
      const n=await count('modules',q=>q.eq('campaign_id',campaignId).eq('active',true));
      if(n<data.max_preferences){
        reportError('modules','Noch '+(data.max_preferences-n)+' aktive Module erfassen. Für '+
          data.max_preferences+' Wünsche braucht es mindestens ebenso viele auswählbare Module.');
        return false;
      }
      return true;
    }
    if(step==='students'){
      const n=await count('students',q=>q.eq('active',true));
      if(n===0){
        reportError('students','Es sind noch keine aktiven Schüler erfasst. Öffne die Schülerdatenbank und importiere zuerst eine Klasse oder erfasse einzelne Schüler.');
        return false;
      }
      return true;
    }
    if(step==='codes'){
      const {count:n,error}=await db.from('student_access_codes')
        .select('student_id,students!inner(active)',{count:'exact',head:true})
        .eq('students.active',true);
      if(error){reportError('codes',error.message);return false;}
      const students=await count('students',q=>q.eq('active',true));
      if((n??0)<students){
        reportError('codes','Es fehlen Zugangscodes für '+(students-(n??0))+' aktive Schüler. Bitte zuerst Codes ausstellen.');
        return false;
      }
      return true;
    }
    if(step==='eligibility'){
      const n=await count('campaign_students',q=>q.eq('campaign_id',campaignId));
      if(n===0){
        reportError('eligibility','Für diese Ausschreibung wurde noch kein Schüler zugelassen. Bitte zuerst die Teilnehmenden auswählen und speichern.');
        return false;
      }
      return true;
    }
    if(step==='publish'){
      const {data,error}=await db.from('campaigns').select('status').eq('id',campaignId).single();
      if(error){reportError('publish',error.message);return false;}
      if(data.status==='draft'){
        reportError('publish','Die Ausschreibung ist noch im Status «Entwurf». Bitte die Anmeldung zuerst freigeben.');
        return false;
      }
      return true;
    }
    return true;
  }

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

  for(const form of guide.querySelectorAll('form')){
    form.noValidate=true;
    form.addEventListener('submit',event=>{
      if(!validateForm(form)){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  }

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
      rememberForm(form);
      clearError('campaign');
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
    rememberForm(form);
    clearError('campaign');
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
  let campaignRows=[];
  let deleteCandidate=null;
  let deleteInspectionSerial=0;
  async function listCampaigns(){
    const {data,error}=await db.from('campaigns')
      .select('id,title,status,starts_at,ends_at,created_at')
      .order('created_at',{ascending:false});
    if(error)throw error;
    campaignRows=data||[];
    $('campaignCards').innerHTML=campaignRows.length?
      '<div class="campaign-card-list">'+campaignRows.map(c=>{
        const deletable=['draft','open'].includes(c.status);
        return '<div class="campaign-card-row">'+
          '<button type="button" class="campaign-card" data-select-campaign="'+esc(c.id)+'">'+
          '<span class="campaign-card-main"><strong>'+esc(c.title)+'</strong><small>'+
          new Date(c.starts_at).toLocaleDateString('de-CH')+' – '+
          new Date(c.ends_at).toLocaleDateString('de-CH')+
          '</small></span><span class="campaign-status">'+esc(window.learningStatusLabel(c.status))+
          '</span><span aria-hidden="true">›</span></button>'+
          (deletable?'<button type="button" class="danger campaign-delete-button" data-delete-campaign="'+esc(c.id)+'" aria-label="Ausschreibung '+esc(c.title)+' löschen">Löschen</button>':
          '<span class="campaign-delete-locked" title="Bereits abgeschlossene oder zugeteilte Ausschreibungen können nicht gelöscht werden.">Geschützt</span>')+
          '</div>';
      }).join('')+'</div>':
      '<p class="muted">Noch keine Ausschreibungen vorhanden. Du kannst jetzt einen neuen Entwurf anlegen.</p>';
  }
  function deleteMessage(message,error=false){
    const text=$('campaignDeleteMessage');
    text.textContent=message||'';
    text.style.color=error?'#a02b28':'var(--muted)';
  }
  function closeDeleteDialog(){
    deleteInspectionSerial++;
    const dialog=$('campaignDeleteDialog');
    if(dialog.open)dialog.close();
    deleteCandidate=null;
    $('campaignDeleteTyped').value='';
    $('campaignDeleteCommit').disabled=true;
    deleteMessage('');
  }
  async function openDeleteDialog(id){
    const inspection=++deleteInspectionSerial;
    const candidate=campaignRows.find(c=>c.id===id);
    if(!candidate)return;
    deleteCandidate=null;
    const dialog=$('campaignDeleteDialog');
    $('campaignDeleteStepOne').hidden=false;
    $('campaignDeleteStepTwo').hidden=true;
    $('campaignDeleteNext').disabled=true;
    $('campaignDeleteTyped').value='';
    $('campaignDeleteCommit').disabled=true;
    $('campaignDeleteName').textContent=candidate.title;
    $('campaignDeleteStatistics').textContent='Ausschreibung und Auswirkungen werden geprüft …';
    deleteMessage('');
    if(!dialog.open)dialog.showModal();
    const checks=await Promise.all([
      db.from('campaigns').select('id,title,status').eq('id',id).maybeSingle(),
      db.from('modules').select('*',{count:'exact',head:true}).eq('campaign_id',id),
      db.from('campaign_students').select('*',{count:'exact',head:true}).eq('campaign_id',id),
      db.from('registrations').select('*',{count:'exact',head:true}).eq('campaign_id',id),
      db.from('assignments').select('*',{count:'exact',head:true}).eq('campaign_id',id),
      db.from('allocation_runs').select('*',{count:'exact',head:true}).eq('campaign_id',id)
    ]);
    if(!dialog.open||inspection!==deleteInspectionSerial)return;
    const error=checks.find(r=>r.error)?.error;
    if(error){$('campaignDeleteStatistics').textContent='Prüfung nicht möglich.';return deleteMessage(error.message,true);}
    const fresh=checks[0].data;
    if(!fresh||fresh.title!==candidate.title||!['draft','open'].includes(fresh.status)){
      $('campaignDeleteStatistics').textContent='Die Ausschreibung wurde zwischenzeitlich geändert.';
      return deleteMessage('Bitte die Übersicht aktualisieren und erneut prüfen.',true);
    }
    const modules=checks[1].count??0;
    const allowed=checks[2].count??0;
    const registered=checks[3].count??0;
    const assigned=checks[4].count??0;
    const runs=checks[5].count??0;
    $('campaignDeleteStatistics').textContent=
      window.learningStatusLabel(fresh.status)+' · '+modules+' Module · '+allowed+
      ' zugelassene Schüler · '+registered+' Anmeldungen · '+assigned+' Zuteilungen';
    if(registered||assigned||runs){
      return deleteMessage('Löschung gesperrt: Es liegen bereits Anmeldungen oder Zuteilungsberechnungen vor.',true);
    }
    deleteCandidate={id,title:fresh.title};
    $('campaignDeleteNext').disabled=false;
  }
  $('campaignDeleteClose').addEventListener('click',closeDeleteDialog);
  $('campaignDeleteDialog').addEventListener('close',()=>{
    deleteInspectionSerial++;
    deleteCandidate=null;
    $('campaignDeleteTyped').value='';
    $('campaignDeleteCommit').disabled=true;
  });
  $('campaignDeleteNext').addEventListener('click',()=>{
    if(!deleteCandidate)return;
    $('campaignDeleteStepOne').hidden=true;
    $('campaignDeleteStepTwo').hidden=false;
    $('campaignDeleteTyped').focus();
  });
  $('campaignDeleteBack').addEventListener('click',()=>{
    $('campaignDeleteStepTwo').hidden=true;
    $('campaignDeleteStepOne').hidden=false;
    $('campaignDeleteTyped').value='';
    $('campaignDeleteCommit').disabled=true;
    deleteMessage('');
  });
  $('campaignDeleteTyped').addEventListener('input',()=>{
    $('campaignDeleteCommit').disabled=
      !deleteCandidate||$('campaignDeleteTyped').value!==deleteCandidate.title;
  });
  $('campaignDeleteCommit').addEventListener('click',async()=>{
    if(!deleteCandidate||$('campaignDeleteTyped').value!==deleteCandidate.title)return;
    const candidate={...deleteCandidate};
    const button=$('campaignDeleteCommit');
    button.disabled=true;
    $('campaignDeleteClose').disabled=true;
    $('campaignDeleteBack').disabled=true;
    deleteMessage('Ausschreibung wird gelöscht …');
    try{
      const {data,error}=await db.rpc('delete_unused_learning_campaign',{
        p_campaign_id:candidate.id,
        p_confirmation_title:candidate.title
      });
      if(error)throw error;
      if(data!==true)throw Error('Die Datenbank hat die Löschung nicht bestätigt.');
      closeDeleteDialog();
      await overview();
      const notice=document.getElementById('notice');
      if(notice){notice.textContent='Ausschreibung «'+candidate.title+'» wurde gelöscht.';notice.style.color='#24664e';}
    }catch(error){
      deleteMessage(error.message||'Ausschreibung konnte nicht gelöscht werden.',true);
    }finally{
      $('campaignDeleteClose').disabled=false;
      $('campaignDeleteBack').disabled=false;
      // Only re-enable after typing the exact title; server always checks again.
      $('campaignDeleteCommit').disabled=
        !deleteCandidate||$('campaignDeleteTyped').value!==deleteCandidate.title;
    }
  });
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
    const deleteButton=event.target.closest('[data-delete-campaign]');
    if(deleteButton){
      openDeleteDialog(deleteButton.dataset.deleteCampaign)
        .catch(err=>deleteMessage(err.message||'Prüfung fehlgeschlagen.',true));
      return;
    }
    const button=event.target.closest('[data-select-campaign]');
    if(button)choose(button.dataset.selectCampaign).catch(err=>alert(err.message));
  });
  guide.addEventListener('click',async event=>{
    const button=event.target.closest('[data-guide-nav]');
    if(!button)return;
    button.disabled=true;
    try{
      const from=button.closest('.guide-step')?.dataset.step;
      if(button.dataset.guideNav===steps[steps.findIndex(s=>s.id===from)+1]?.id){
        const ready=await mayProceedFrom(from);
        if(!ready)return;
      }
      openStep(button.dataset.guideNav,true);
    }catch(err){
      const from=button.closest('.guide-step')?.dataset.step;
      if(from)reportError(from,err?.message||'Der nächste Schritt konnte nicht geprüft werden.');
    }finally{button.disabled=false;}
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
        const missing=data.max_preferences-n;
        $('guideProgress').textContent='Noch '+missing+
          ' Modul(e) erfassen, damit alle Wünsche möglich sind.';
        reportError('modules','Noch '+missing+' aktive Module erfassen, bevor du mit den Schülern fortfahren kannst.');
        return;
      }
      clearError('modules');
    }
    if(next){
      if(['students','codes','eligibility','publish'].includes(completedStep)){
        const ready=await mayProceedFrom(completedStep);
        if(!ready)return;
      }
      clearError(completedStep);
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