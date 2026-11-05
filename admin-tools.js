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
    '<div class="tool-section"><h3>Für Ausschreibung zulassen</h3><label>Ausschreibung'+
    '<select id="eligibleCampaign"></select></label><button id="enrollAll" class="secondary">Alle aktiven Schüler zulassen</button></div>'+
    '<div class="tool-section"><h3>Ausschreibung veröffentlichen</h3><label>Ausschreibung'+
    '<select id="publishCampaign"></select></label><button id="publishNow">Zur geplanten Zeit freigeben</button></div>'
  );
  async function campaigns(){
    const {data,error}=await db.from('campaigns').select('id,title,status').order('created_at',{ascending:false});
    if(error)return;
    for(const id of ['eligibleCampaign','publishCampaign']){
      const el=$(id),saved=el.value;
      el.innerHTML=(data||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+' ('+esc(c.status)+')</option>').join('');
      if(data.some(c=>c.id===saved))el.value=saved;
    }
  }
  $('generateCodes').addEventListener('click',async()=>{
    const button=$('generateCodes');button.disabled=true;
    try{
      const {data:students,error:a}=await db.from('students').select('id,external_id,first_name,last_name,classes(name)').eq('active',true).limit(1000);
      if(a)throw a;if(!students.length)return message('Bitte zuerst Schüler importieren.',true);
      const {data:codes,error:b}=await db.from('student_access_codes').select('student_id').limit(1000);
      if(b)throw b;
      const known=new Set((codes||[]).map(c=>c.student_id));
      const missing=students.filter(s=>!known.has(s.id));
      if(!missing.length)return message('Für alle Schüler sind bereits Codes hinterlegt.');
      const insert=[],rows=[['Schueler_ID','Vorname','Nachname','Klasse','Zugangscode']];
      for(const s of missing){
        const code=await newCode();
        insert.push({student_id:s.id,code_hash:code.hash});
        rows.push([s.external_id,s.first_name,s.last_name,s.classes?.name||'',code.value]);
      }
      const {error}=await db.from('student_access_codes').insert(insert);if(error)throw error;
      exportCsv('lernmodule-zugangscodes-'+new Date().toISOString().slice(0,10)+'.csv',rows);
      message(missing.length+' persönliche Zugangscodes erstellt. Die CSV-Datei sicher aufbewahren.');
    }catch(e){message(e.message||'Code-Erstellung fehlgeschlagen.',true)}
    finally{button.disabled=false;}
  });
  $('rotateCode').addEventListener('click',async()=>{
    const id=$('rotateStudent').value.trim();if(!id)return message('Schüler-ID eingeben.',true);
    if(!confirm('Der bisherige Zugangscode wird ungültig. Neuen Code erstellen?'))return;
    try{
      const {data:s,error:e}=await db.from('students').select('id,external_id,first_name,last_name').eq('external_id',id).single();
      if(e||!s)throw new Error('Schüler-ID nicht gefunden.');
      const code=await newCode();
      const {error}=await db.from('student_access_codes').upsert({student_id:s.id,code_hash:code.hash},{onConflict:'student_id'});if(error)throw error;
      exportCsv('lernmodule-code-'+s.external_id+'.csv',[['Schueler_ID','Vorname','Nachname','Zugangscode'],[s.external_id,s.first_name,s.last_name,code.value]]);
      message('Der Zugangscode wurde ersetzt und heruntergeladen.');
    }catch(e){message(e.message||'Code-Ersetzung fehlgeschlagen.',true)}
  });
  $('enrollAll').addEventListener('click',async()=>{
    const campaign_id=$('eligibleCampaign').value;
    if(!campaign_id)return message('Bitte zuerst eine Ausschreibung erstellen.',true);
    if(!confirm('Alle aktiven Schüler für die Ausschreibung zulassen?'))return;
    const button=$('enrollAll');button.disabled=true;
    try{
      const {data:students,error:e}=await db.from('students').select('id').eq('active',true).limit(1000);
      if(e)throw e;if(!students.length)return message('Keine aktiven Schüler vorhanden.',true);
      for(let i=0;i<students.length;i+=100){
        const part=students.slice(i,i+100).map(s=>({campaign_id,student_id:s.id}));
        const {error}=await db.from('campaign_students').upsert(part,{onConflict:'campaign_id,student_id',ignoreDuplicates:true});
        if(error)throw error;
      }
      message(students.length+' Schüler für die Ausschreibung zugelassen.');
    }catch(e){message(e.message||'Zulassung fehlgeschlagen.',true)}
    finally{button.disabled=false;}
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
    }catch(e){message(e.message||'Freigabe fehlgeschlagen.',true)}
  });
  const origRefresh=window.refresh;
  if(typeof origRefresh==='function')window.refresh=async(...args)=>{await origRefresh(...args);await campaigns();};
  db.auth.onAuthStateChange(e=>{if(e==='SIGNED_IN')setTimeout(campaigns,600);});
  campaigns();
})();