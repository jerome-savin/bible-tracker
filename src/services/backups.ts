import type {BackupDocument,BackupPreview,ReadingEvent,ReadingPreferences,ReadingState} from '../domain/models';
import {effectiveReading,keyOf} from '../domain/reading';
import {chapterLength,validatePassage} from '../domain/references';

export const REFERENCE='bkuhl-2cbb2c0e2a00db458bf3af8636a725a65c8cc3fe' as const;
export const MAX_BACKUP_BYTES=10*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(message:string):never {throw new Error(`Sauvegarde invalide : ${message}`);}
function object(value:unknown,label:string):Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value))fail(`${label} doit être un objet.`);
 return value as Record<string,unknown>;
}
function keys(obj:Record<string,unknown>,allowed:string[],required:string[],label:string){
 if(Object.keys(obj).some(k=>!allowed.includes(k)))fail(`champ inconnu dans ${label}.`);
 if(required.some(k=>!Object.hasOwn(obj,k)))fail(`champ manquant dans ${label}.`);
}
function identifier(value:unknown,label:string){if(typeof value!=='string'||!uuid.test(value))fail(`${label} n’est pas un UUID valide.`);}
function timestamp(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('date ISO UTC invalide.');
}
function verses(value:unknown){
 if(!Array.isArray(value)||value.some(v=>!Number.isInteger(v))||new Set(value).size!==value.length)fail('liste de versets invalide ou dupliquée.');
}
function progress(value:unknown){
 const map=object(value,'progression');
 for(const [key,vs] of Object.entries(map)){
  if(!/^[1-9]\d*:[1-9]\d*$/.test(key))fail('clé de progression invalide.');
  verses(vs);const [bookId,chapter]=key.split(':').map(Number);
  try{validatePassage({bookId,chapter,verses:vs as number[]});}catch{fail('référence de progression inexistante.');}
 }
}
export function sameData(a:unknown,b:unknown):boolean {
 function canonical(v:unknown):unknown {
  if(Array.isArray(v))return v.map(canonical);
  if(v!==null&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)]));
  return v;
 }
 return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
function sameProgress(a:Record<string,number[]>,b:Record<string,number[]>){
 const normalized=(map:Record<string,number[]>)=>Object.fromEntries(Object.entries(map).filter(([,vs])=>vs.length).map(([key,vs])=>[key,[...vs].sort((a,b)=>a-b)]));
 return sameData(normalized(a),normalized(b));
}

export function validateState(value:unknown):ReadingState {
 const s=object(value,'carnet');
 keys(s,['schemaVersion','userId','demo','progress','events','legacyContext'],['schemaVersion','userId','demo','progress','events'],'carnet');
 if(s.schemaVersion!==1)fail('version du carnet inconnue.');
 identifier(s.userId,'utilisateur');if(typeof s.demo!=='boolean')fail('indicateur de démonstration manquant.');progress(s.progress);
 if(s.legacyContext!==undefined){const c=object(s.legacyContext,'contexte historique');keys(c,['progress'],['progress'],'contexte historique');progress(c.progress);}
 if(!Array.isArray(s.events)||s.events.length>100000)fail('historique absent ou trop volumineux.');
 const seen=new Set<string>();
 for(const raw of s.events){
  const e=object(raw,'événement');
  keys(e,['id','userId','occurredAt','kind','bookId','chapter','verses','modelVersion','cancellations','baselineVerses'],['id','userId','occurredAt','kind','bookId','chapter','verses'],'événement');
  identifier(e.id,'événement');identifier(e.userId,'utilisateur de l’événement');timestamp(e.occurredAt);
  if(e.userId!==s.userId)fail('événement appartenant à un autre utilisateur.');
  const eventId=(e.id as string).toLowerCase();
  if(seen.has(eventId))fail('UUID d’événement dupliqué.');seen.add(eventId);
  if(!['lecture','relecture','correction'].includes(e.kind as string))fail('type d’événement inconnu.');
  if(e.modelVersion!==undefined&&e.modelVersion!==2)fail('version d’événement inconnue.');
  verses(e.verses);try{validatePassage(e as unknown as ReadingEvent);}catch{fail('référence biblique d’événement inexistante.');}
  if(e.kind!=='correction'&&(e.verses as number[]).length===0)fail('lecture vide.');
  if(e.modelVersion!==2){
   if(e.kind==='relecture'||e.cancellations!==undefined||e.baselineVerses!==undefined)fail('événement ancien incohérent.');
  }else{
   if(s.legacyContext===undefined)fail('contexte historique du lot A manquant.');
   if(e.kind!=='correction'&&(e.cancellations!==undefined||e.baselineVerses!==undefined))fail('annulation portée par une lecture.');
   if(e.kind==='correction'){
    if(!Array.isArray(e.cancellations))fail('cibles de correction manquantes.');
    const targets=new Set<string>();const affected=new Set<number>();
    for(const rawTarget of e.cancellations){
     const c=object(rawTarget,'annulation');keys(c,['eventId','verses'],['eventId','verses'],'annulation');identifier(c.eventId,'cible');verses(c.verses);
     if(targets.has(c.eventId as string)||(c.verses as number[]).length===0)fail('cible dupliquée ou vide.');targets.add(c.eventId as string);
     for(const v of c.verses as number[])affected.add(v);
    }
    if(e.baselineVerses!==undefined){verses(e.baselineVerses);for(const v of e.baselineVerses as number[])affected.add(v);}
    if(!affected.size||!sameData([...affected].sort((a,b)=>a-b),[...(e.verses as number[])].sort((a,b)=>a-b)))fail('versets et cibles de correction incohérents.');
   }
  }
 }
 const state=structuredClone(s) as unknown as ReadingState;
 const byId=new Map(state.events.map(e=>[e.id,e]));
 for(const e of state.events.filter(e=>e.modelVersion===2&&e.kind==='correction')){
  for(const c of e.cancellations??[]){
   const target=byId.get(c.eventId);
   if(!target||target.kind==='correction'||target.userId!==e.userId||target.bookId!==e.bookId||target.chapter!==e.chapter||c.verses.some(v=>!target.verses.includes(v)))fail('cible de correction absente ou incompatible.');
  }
  const base=state.legacyContext?.progress[keyOf(e.bookId,e.chapter)]??[];
  if(e.baselineVerses?.some(v=>!base.includes(v)))fail('retrait de progression héritée injustifié.');
 }
 try{
  const derived=effectiveReading(state).progress;
  if(state.events.some(e=>e.modelVersion===2)&&!sameProgress(state.progress,derived))fail('progression incompatible avec les événements.');
 }catch(error){if(error instanceof Error&&error.message.startsWith('Sauvegarde invalide'))throw error;fail('historique incohérent.');}
 return state;
}

export function validatePreferences(value:unknown):ReadingPreferences {
 const p=object(value,'préférences');keys(p,['activePlan','lastPassage'],[],'préférences');
 if(p.activePlan!==undefined&&p.activePlan!=='canonical')fail('parcours inconnu.');
 if(p.lastPassage!==undefined){
  const passage=object(p.lastPassage,'dernier passage');keys(passage,['bookId','chapter','verse'],['bookId','chapter'],'dernier passage');
  let max:number;try{max=chapterLength(passage.bookId as number,passage.chapter as number);}catch{fail('dernier passage inexistant.');}
  if(passage.verse!==undefined&&(!Number.isInteger(passage.verse)||(passage.verse as number)<1||(passage.verse as number)>max))fail('dernier verset inexistant.');
 }
 return structuredClone(p) as ReadingPreferences;
}
export function createBackup(state:ReadingState,preferences:ReadingPreferences={},now=new Date()):BackupDocument {
 return {format:'bible-tracker-backup',version:2,reference:REFERENCE,exportedAt:now.toISOString(),state:validateState(state),preferences:validatePreferences(preferences)};
}
export function validateBackup(value:unknown):BackupDocument {
 const b=object(value,'sauvegarde');
 keys(b,['format','version','exportedAt','reference','state','preferences'],['format','version','exportedAt','reference','state','preferences'],'sauvegarde');
 if(b.format!=='bible-tracker-backup'||b.version!==2)fail('format ou version de sauvegarde inconnue.');
 if(b.reference!==REFERENCE)fail('référentiel non pris en charge.');timestamp(b.exportedAt);
 return {...b,state:validateState(b.state),preferences:validatePreferences(b.preferences)} as unknown as BackupDocument;
}
export function serializeBackup(backup:BackupDocument):string {
 const json=JSON.stringify(validateBackup(backup),null,2);
 if(new TextEncoder().encode(json).length>MAX_BACKUP_BYTES)throw new Error('La sauvegarde dépasse 10 Mo. Les données sont conservées sur cet appareil ; aucun fichier incomplet n’a été produit.');
 return json;
}
export function previewImport(json:string):BackupPreview {
 if(new TextEncoder().encode(json).length>MAX_BACKUP_BYTES)fail('fichier supérieur à 10 Mo.');
 let value:unknown;try{value=JSON.parse(json);}catch{fail('le fichier n’est pas un JSON lisible.');}
 const raw=object(value,'sauvegarde');const source=Object.hasOwn(raw,'format')?'version-2':'phase-1';
 const backup=source==='version-2'?validateBackup(value):createBackup(validateState(value));
 const warnings:string[]=[];
 if(source==='phase-1')warnings.push('Ancien export brut : aucune préférence ni date d’export d’origine disponible.');
 if(backup.state.events.some(e=>e.modelVersion!==2))warnings.push('Historique phase 1 conservé : ses corrections restent des instantanés, sans cible précise récupérable. Les annulations ciblées ne peuvent pas être reconstituées fidèlement ; la progression enregistrée reste la référence.');
 const effective=effectiveReading(backup.state);
 if(Object.values(effective.baseline).some(v=>v.size>0))warnings.push('Une partie de la progression n’a pas d’événement justificatif. Elle sera conservée sans inventer de lecture datée.');
 const events=backup.state.events;
 return {backup,source,warnings,summary:{userId:backup.state.userId,demo:backup.state.demo,events:events.length,readings:events.filter(e=>e.kind==='lecture').length,rereadings:events.filter(e=>e.kind==='relecture').length,corrections:events.filter(e=>e.kind==='correction').length,verses:Object.values(backup.state.progress).reduce((s,v)=>s+v.length,0)}};
}
