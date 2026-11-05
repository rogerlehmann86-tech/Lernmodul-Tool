/* Administration: persönliche Codes, Zulassung, Freigabe */
(() => {
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const message=(s,bad=false)=>{$('notice').textContent=s;$('notice').style.color=bad?'#9b3030':'#24664e';};
  const quote=v=>{let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const exportCsv=(name,rows)=>{
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  const hex=buffer=>Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
  async function newCode(){
    const raw=hex(crypto.getRandomValues(new Uint8Array(8))).toUpperCase();
    return {value:raw.match(/.{1,4}/g).join('-'),hash:hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))};
  }
  const admin=$('students');
  admin.insertAdjacentHTML('beforeend',
    '<div class="tool-section"><h3>Zugangscodes</h3>'+
    '<p class="muted">Neue Codes werden nur einmal angezeigt und als CSV heruntergeladen. Bitte die Datei sicher aufbewahren und nicht ins GitHub-Repository hochladen.</p>'+
    '<button class="secondary" id="generateCodes">Fehlende Zugangscodes erzeugen</button>'+
    '<label>Schüler-ID für Ersatzcode<input id="rotateStudent" placeholder="Schüler-ID"></label>'+
    '<button class="secondary" id="rotateCode">Einzelnen Code ersetzen</button></div>'+
    '<div class="tool-section"><h3>Teilnehmende der Ausschreibung</h3>'+
    '<p class="muted">Wähle einzelne Schüler, eine bestimmte Klasse oder alle aus. Die Auswahl gilt nur für diese Ausschreibung.</p>'+
    '<label>Ausschreibung<select id="eligibleCampaign"></select></label>'+
    '<div class="eligibility-filters"><label>Klasse<select id="eligibleClass"><option value="">Alle Klassen</option></select></label>'+
    '<label>Schüler suchen<input id="eligibleSearch" placeholder="Name oder Schüler-ID" autocomplete="off"></label></div>'+
    '<div class="eligibility-actions"><button type="button" id="eligibleSelectVisible" class="secondary">Angezeigte auswählen</button>'+
    '<button type="button" id="eligibleDeselectVisible" class="secondary">Angezeigte abwählen</button></div>'+
    '<p id="eligibleSummary" class="muted" role="status">Schülerliste wird geladen …</p>'+
    '<div id="eligibleList" class="eligibility-list"></div>'+
    '<button type="button" id="eligibleSave">Auswahl speichern</button>'+
    '<p class="muted"><small>Bereits angemeldete Schüler sind gesperrt und können nicht aus der Ausschreibung entfernt werden.</small></p></div>'+
    '<div class="tool-section"><h3>Ausschreibung veröffentlichen</h3><label>Ausschreibung'+
    '<select id="publishCampaign"></select></label><button id="publishNow">Zur geplanten Zeit freigeben</button></div>'
  );
  async function campaigns(){
    const {data,error}=await db.from('campaigns').select('id,title,status').order('created_at',{ascending:false});
    if(error)return;
    for(const id of ['eligibleCampaign','publishCampaign']){
      const el=$(id),saved=window.learningCurrentCampaignId||el.value;
      el.innerHTML=(data||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+' ('+esc(window.learningStatusLabel(c.status))+')</option>').join('');
      if(data.some(c=>c.id===saved))el.value=saved;
    }
    await loadEligible();
  }
  // Zugangscodes zentral auf dem Server ausgeben und für spätere PDFs verschlüsselt speichern.
  $('generateCodes').addEventListener('click',async()=>{
    const button=$('generateCodes');button.disabled=true;
    try{
      const students=await fetchActiveForCodes();
      if(!students.length)return message('Bitte zuerst Schüler importieren.',true);
      const {data,error}=await db.rpc('issue_learning_student_codes',{
        p_student_ids:students.map(s=>s.id),p_replace:false
      });
      if(error)throw error;
      if(!data?.length)return message('Alle Schüler haben bereits einen Code. Bereits erstellte Codes können in der Schülerdatenbank aus der bisherigen CSV übernommen werden.');
      exportCsv('lernmodule-neue-zugangscodes.csv',[
        ['Schueler_ID','Vorname','Nachname','Klasse','Zugangscode'],
        ...data.map(s=>[s.external_id,s.first_name,s.last_name,s.class_name||'',s.access_code])
      ]);
      message(data.length+' neue Codes erstellt und verschlüsselt gespeichert. Druck unter «Schülerdatenbank».');
      window.learningGuideAdvance?.('codes');
    }catch(e){message(e.message||'Code-Erstellung fehlgeschlagen.',true)}
    finally{button.disabled=false;}
  });
  async function fetchActiveForCodes(){
    const all=[];
    for(let i=0;i<1500;i+=500){
      const {data,error}=await db.from('students').select('id').eq('active',true).order('id').range(i,i+499);
      if(error)throw error;all.push(...(data||[]));if((data||[]).length<500)return all;
    }
    throw Error('Zu viele Schüler für diese Stapelverarbeitung.');
  }
  $('rotateCode').addEventListener('click',async()=>{
    const id=$('rotateStudent').value.trim();
    if(!id)return message('Schüler-ID eingeben.',true);
    if(!confirm('Neuen Code ausstellen? Der bisherige Zugangscode wird UNGÜLTIG.'))return;
    try{
      const {data:student,error:e}=await db.from('students')
        .select('id,external_id,first_name,last_name').eq('external_id',id).single();
      if(e)throw e;
      const {data,error}=await db.rpc('issue_learning_student_codes',{
        p_student_ids:[student.id],p_replace:true
      });
      if(error)throw error;
      const item=data[0];
      exportCsv('lernmodule-code-'+student.external_id+'.csv',[
        ['Schueler_ID','Vorname','Nachname','Zugangscode'],
        [student.external_id,student.first_name,student.last_name,item.access_code]
      ]);
      message('Neuer Zugangscode gespeichert. Der alte ist ungültig. Karte unter Schülerdatenbank drucken.');
    }catch(e){message(e.message||'Codewechsel fehlgeschlagen.',true)}
  });
  // Eine unabhängige Auswahl pro Ausschreibung mit Klassen- und Namensfilter.
  let eligibleStudents=[],currentAllowed=new Set(),chosen=new Set(),alreadyRegistered=new Set();
  let eligibleStatus='',eligibleReady=false;
  async function fetchPaged(table,fields,filter,order){
    const all=[];
    for(let offset=0;offset<=3500;offset+=500){
      let query=db.from(table).select(fields).range(offset,offset+499);
      if(order)query=query.order(order);
      if(filter)query=filter(query);
      const {data,error}=await query;
      if(error)throw error;
      all.push(...(data||[]));
      if((data||[]).length<500)return all;
    }
    throw Error('Mehr als 3500 Datensätze. Bitte Schulverwaltung kontaktieren.');
  }
  function shownStudents(){
    const klass=$('eligibleClass').value;
    const term=$('eligibleSearch').value.trim().toLocaleLowerCase('de-CH');
    return eligibleStudents.filter(s=>{
      if(klass&&s.classes?.name!==klass)return false;
      return !term||[s.external_id,s.first_name,s.last_name].join(' ').toLocaleLowerCase('de-CH').includes(term);
    });
  }
  function renderEligible(){
    const view=shownStudents();
    const selectedCount=eligibleStudents.filter(s=>chosen.has(s.id)).length;
    $('eligibleSummary').textContent=selectedCount+' von '+eligibleStudents.length+' aktiven Schülern ausgewählt · '+
      alreadyRegistered.size+' bereits angemeldet · '+view.length+' angezeigt'+
      (eligibleStatus==='allocated'||eligibleStatus==='published'||eligibleStatus==='archived'?' · Auswahl gesperrt':'');
    $('eligibleList').innerHTML=view.length?view.map(s=>{
      const locked=alreadyRegistered.has(s.id);
      return '<label class="eligible-item"><input type="checkbox" data-student="'+esc(s.id)+'" '+
        (chosen.has(s.id)?'checked ':'')+(locked||!['draft','open'].includes(eligibleStatus)?'disabled ':'')+'>'+
        '<span><strong>'+esc(s.last_name+' '+s.first_name)+'</strong><small>'+
        esc(' · '+(s.classes?.name||'ohne Klasse')+' · '+s.external_id)+
        (locked?' · Bereits angemeldet':'')+'</small></span></label>';
    }).join(''):'<p class="muted">Keine Schüler für diesen Filter gefunden.</p>';
    const editable=eligibleReady&&['draft','open'].includes(eligibleStatus);
    $('eligibleSave').disabled=!editable;
    $('eligibleSelectVisible').disabled=!editable;
    $('eligibleDeselectVisible').disabled=!editable;
  }
  async function loadEligible(){
    const id=$('eligibleCampaign').value;
    eligibleReady=false;
    $('eligibleSave').disabled=true;
    $('eligibleSummary').textContent='Schüler und Zulassungen werden geladen …';
    $('eligibleList').innerHTML='';
    chosen=new Set();currentAllowed=new Set();alreadyRegistered=new Set();eligibleStudents=[];
    if(!id){$('eligibleSummary').textContent='Bitte zuerst eine Ausschreibung erstellen.';return;}
    try{
      const [campaign,students,allowed,registrations]=await Promise.all([
        db.from('campaigns').select('status').eq('id',id).single(),
        fetchPaged('students','id,external_id,first_name,last_name,classes(name)',
          q=>q.eq('active',true),'last_name'),
        fetchPaged('campaign_students','student_id',q=>q.eq('campaign_id',id),'student_id'),
        fetchPaged('registrations','student_id',q=>q.eq('campaign_id',id),'student_id')
      ]);
      if(campaign.error)throw campaign.error;
      eligibleStatus=campaign.data.status;
      eligibleStudents=students;
      currentAllowed=new Set(allowed.map(x=>x.student_id));
      chosen=new Set(currentAllowed);
      alreadyRegistered=new Set(registrations.map(x=>x.student_id));
      const oldClass=$('eligibleClass').value;
      const classes=[...new Set(eligibleStudents.map(x=>x.classes?.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de-CH'));
      $('eligibleClass').innerHTML='<option value="">Alle Klassen</option>'+
        classes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
      if(classes.includes(oldClass))$('eligibleClass').value=oldClass;
      for(const student of eligibleStudents)if(alreadyRegistered.has(student.id))chosen.add(student.id);
      eligibleReady=true;
      renderEligible();
    }catch(err){
      eligibleReady=false;
      $('eligibleSummary').textContent='Fehler beim Laden: '+(err.message||'Unbekannter Fehler');
      $('eligibleSave').disabled=true;
      message(err.message||'Teilnehmerliste konnte nicht geladen werden.',true);
    }
  }
  $('eligibleCampaign').addEventListener('change',loadEligible);
  $('eligibleClass').addEventListener('change',renderEligible);
  $('eligibleSearch').addEventListener('input',renderEligible);
  $('eligibleList').addEventListener('change',e=>{
    const checkbox=e.target.closest('input[data-student]');
    if(!checkbox)return;
    const id=checkbox.dataset.student;
    if(alreadyRegistered.has(id)){checkbox.checked=true;return;}
    if(checkbox.checked)chosen.add(id);else chosen.delete(id);
    renderEligible();
  });
  $('eligibleSelectVisible').addEventListener('click',()=>{
    for(const s of shownStudents())chosen.add(s.id);
    renderEligible();
  });
  $('eligibleDeselectVisible').addEventListener('click',()=>{
    for(const s of shownStudents())if(!alreadyRegistered.has(s.id))chosen.delete(s.id);
    renderEligible();
  });
  $('eligibleSave').addEventListener('click',async()=>{
    const campaign_id=$('eligibleCampaign').value;
    if(!eligibleReady||!campaign_id)return;
    const ids=eligibleStudents.filter(s=>chosen.has(s.id)).map(s=>s.id);
    const additions=ids.filter(id=>!currentAllowed.has(id)).length;
    const removals=eligibleStudents.filter(s=>currentAllowed.has(s.id)&&!chosen.has(s.id)).length;
    if(!additions&&!removals)return message('Keine Änderungen an der Teilnehmerliste.');
    if(!confirm(additions+' Schüler zulassen und '+removals+' entfernen?\nBereits angemeldete Schüler bleiben geschützt.'))return;
    const button=$('eligibleSave');button.disabled=true;
    try{
      const {data,error}=await db.rpc('set_campaign_participants',{
        p_campaign_id:campaign_id,p_student_ids:ids
      });
      if(error)throw error;
      message('Teilnehmerliste gespeichert: '+data.added+' hinzugefügt, '+data.removed+' entfernt, '+data.total+' insgesamt zugelassen.');
      await loadEligible();
      window.learningGuideAdvance?.('eligibility');
    }catch(err){
      message(err.message||'Speichern der Auswahl fehlgeschlagen.',true);
    }finally{button.disabled=!eligibleReady;}
  });
  $('publishNow').addEventListener('click',async()=>{
    const id=$('publishCampaign').value;if(!id)return message('Ausschreibung fehlt.',true);
    try{
      const {data:c,error:e}=await db.from('campaigns').select('title,status,max_preferences,starts_at,ends_at').eq('id',id).single();
      if(e)throw e;if(c.status!=='draft')return message('Nur Entwürfe können freigegeben werden.',true);
      if(new Date(c.ends_at)<new Date())return message('Enddatum liegt in der Vergangenheit.',true);
      const {count:mods,error:m}=await db.from('modules').select('id',{count:'exact',head:true}).eq('campaign_id',id).eq('active',true);
      if(m)throw m;
      const {count:participants,error:p}=await db.from('campaign_students').select('student_id',{count:'exact',head:true}).eq('campaign_id',id);
      if(p)throw p;
      if(mods<c.max_preferences)return message('Es braucht mindestens '+c.max_preferences+' aktive Module.',true);
      if(!participants)return message('Zuerst Schüler für diese Ausschreibung zulassen.',true);
      if(!confirm('Ausschreibung "'+c.title+'" freigeben?'))return;
      const {error}=await db.from('campaigns').update({status:'open'}).eq('id',id).eq('status','draft');
      if(error)throw error;
      message('Freigegeben: sichtbar ab '+new Date(c.starts_at).toLocaleString('de-CH')+'.');
      await campaigns();await window.refresh();await window.catalog();
      if(typeof window.loadLearningSignup==='function')await window.loadLearningSignup();
      window.learningGuideAdvance?.('publish');
    }catch(e){message(e.message||'Freigabe fehlgeschlagen.',true)}
  });
  const origRefresh=window.refresh;
  if(typeof origRefresh==='function')window.refresh=async(...args)=>{await origRefresh(...args);await campaigns();};
  db.auth.onAuthStateChange(e=>{if(e==='SIGNED_IN')setTimeout(campaigns,600);});
  campaigns();
})();