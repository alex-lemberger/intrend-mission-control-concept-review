'use strict';
window.Feedback = (() => {
 const KEY='intrend.concept-review.feedback.v1';
 const CATEGORIES=['','Frage','Korrektur','Ergänzung','Zustimmung'];
 const iso=v=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString()===v;
 function create(targets,version){
  let comments=[],raw=null,memory=false,warning='';
  const fail=msg=>{throw new Error(msg)};
  function validate(data){
   if(!data || typeof data!=='object' || Array.isArray(data) || data.schemaVersion!==1 || data.conceptVersion!==version || !iso(data.exportedAt) || !Array.isArray(data.comments) || data.comments.length>1000) fail('Ungültiges Feedback-Format oder andere Konzeptversion. Erwartet wird Version '+version+' mit höchstens 1.000 Kommentaren.');
   if(Object.keys(data).some(k=>!['schemaVersion','conceptVersion','exportedAt','comments'].includes(k)))fail('Unbekannte Felder im Feedback-Format.');
   const ids=new Set();
   return data.comments.map(x=>{
    const fields=['id','targetId','targetLabel','targetType','conceptVersion','createdAt','updatedAt','reviewer','category','text'];
    if(!x || typeof x!=='object' || Array.isArray(x) || Object.keys(x).some(k=>!fields.includes(k)))fail('Ungültiger Kommentareintrag.');
    if(typeof x.id!=='string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(x.id) || ids.has(x.id))fail('Ungültige oder doppelte Kommentar-ID.');
    ids.add(x.id);
    const t=targets.get(x.targetId);
    if(!t || t.title!==x.targetLabel || t.type!==x.targetType || x.conceptVersion!==version)fail('Kommentarziel oder Konzeptversion passt nicht zu diesem Zielbild.');
    if(!iso(x.createdAt) || (x.updatedAt!==undefined && (!iso(x.updatedAt) || x.updatedAt<x.createdAt)))fail('Ungültiger Zeitstempel.');
    if(typeof x.reviewer!=='string' || x.reviewer.length>100 || !CATEGORIES.includes(x.category) || typeof x.text!=='string' || !x.text.trim() || x.text.length>5000 || /\u0000/.test(x.text+x.reviewer))fail('Ungültiger Kommentartext, Name oder Kategorie.');
    return {id:x.id,targetId:x.targetId,targetLabel:t.title,targetType:t.type,conceptVersion:version,createdAt:x.createdAt,...(x.updatedAt?{updatedAt:x.updatedAt}:{}),reviewer:x.reviewer,category:x.category,text:x.text};
   });
  }
  const envelope=items=>({schemaVersion:1,conceptVersion:version,exportedAt:new Date().toISOString(),comments:items});
  try{raw=localStorage.getItem(KEY);if(raw)comments=validate(JSON.parse(raw));}
  catch(e){memory=true;warning='Lokaler Speicher ist nicht verfügbar oder enthält unlesbare Daten. Diese bleiben unverändert. Neue Kommentare gelten nur für diese Sitzung: bitte vor dem Schließen exportieren.';}
  function commit(next){
   validate(envelope(next));
   if(!memory){
    let current;
    try{current=localStorage.getItem(KEY);}catch{memory=true;warning='Speichern im Browser ist nicht möglich. Kommentare bleiben nur in dieser Sitzung. Bitte exportieren.';}
    if(!memory && current!==raw)fail('Die Sammlung wurde in einem anderen Fenster verändert. Bitte offene Texte sichern und diese Seite neu laden, bevor Sie speichern.');
    if(!memory){const serialized=JSON.stringify(envelope(next));try{localStorage.setItem(KEY,serialized);raw=serialized;}catch{memory=true;warning='Der Browserspeicher ist voll oder gesperrt. Neue Änderungen bleiben nur in dieser Sitzung. Bitte jetzt exportieren.';}}
   }
   comments=next;
  }
  function add(targetId,reviewer,category,text,id){
   const t=targets.get(targetId);if(!t)fail('Unbekanntes Kommentarziel.');
   const prior=id?comments.find(c=>c.id===id):null;if(id&&!prior)fail('Der Kommentar ist nicht mehr vorhanden.');
   const now=new Date().toISOString();
   const x={id:prior?.id||('c_'+crypto.randomUUID()),targetId,targetLabel:t.title,targetType:t.type,conceptVersion:version,createdAt:prior?.createdAt||now,...(prior?{updatedAt:now}:{}),reviewer:reviewer.trim(),category,text:text.trim()};
   commit(prior?comments.map(c=>c.id===id?x:c):[...comments,x]);return x;
  }
  function planImport(data){
   const incoming=validate(data);let duplicates=0;const added=[];
   for(const c of incoming){const old=comments.find(x=>x.id===c.id);if(old){if(JSON.stringify(old)!==JSON.stringify(c))fail('Die Kommentar-ID '+c.id+' existiert mit anderem Inhalt. Import abgebrochen; nichts wurde geändert.');duplicates++;}else added.push(c);}
   if(comments.length+added.length>1000)fail('Die gemeinsame Sammlung überschreitet 1.000 Kommentare.');
   return {added,duplicates,total:incoming.length};
  }
  function importData(data){const p=planImport(data);commit([...comments,...p.added]);return p;}
  // Keep feedback transport separate from UI and local persistence.
  const escapeMD=s=>s.replace(/[\\`*_{}\[\]()#+.!|>~-]/g,'\\$&').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r/g,'');
  function markdown(){return '# inTrend – Konzeptfeedback '+version+'\n\nEntwurf zur Validierung. Kommentare sind keine formale Freigabe.\n\n'+(comments.length?comments.map(c=>'## '+escapeMD(c.targetLabel)+'\n\n- Ziel-ID: `'+c.targetId+'`\n- Kommentar-ID: `'+c.id+'`\n- Konzeptversion: '+c.conceptVersion+'\n- Erstellt: '+c.createdAt+(c.updatedAt?'\n- Bearbeitet: '+c.updatedAt:'')+'\n- Name: '+escapeMD(c.reviewer||'Ohne Namen')+'\n- Kategorie: '+escapeMD(c.category||'Ohne Kategorie')+'\n\n'+escapeMD(c.text)+'\n').join('\n'):'Noch keine Kommentare.\n');}
  return {get comments(){return comments.slice()},get warning(){return warning},get memory(){return memory},add,remove:id=>commit(comments.filter(c=>c.id!==id)),validate,planImport,importData,exportData:()=>envelope(comments),markdown};
 }
 return {create,KEY};
})();
