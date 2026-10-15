import type {Book, ReadingState, Passage, ReadingEvent} from './models';
import {validatePassage} from './references';

export const keyOf=(bookId:number,chapter:number)=>`${bookId}:${chapter}`;
const sorted=(values:Iterable<number>)=>[...new Set(values)].sort((a,b)=>a-b);

export function selectRange(start:number,end:number,max:number):number[]{
 if(!Number.isInteger(max)||max<1||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>max||start>end)throw new Error('Plage de versets invalide.');
 return Array.from({length:end-start+1},(_,i)=>start+i);
}
export function status(verses:number[],max:number){
 if(verses.some(v=>!Number.isInteger(v)||v<1||v>max))throw new Error('Verset invalide.');
 const n=new Set(verses).size;
 return n===0?'non lu':n===max?'terminé':'partiellement lu';
}

interface Contribution {event:ReadingEvent; verses:Set<number>; progressionVerses:Set<number>}

/** Reconstituer les lectures effectives sans supprimer ni modifier l'audit. */
export function effectiveReading(state:ReadingState){
 const contributions:Contribution[]=[];
 const snapshot=state.legacyContext?.progress??state.progress;
 for(const event of state.events.filter(e=>e.modelVersion!==2)){
  validatePassage(event);
  const key=keyOf(event.bookId,event.chapter);
  if(event.kind==='correction'){
   // Les anciennes corrections étaient des instantanés des versets conservés.
   for(const c of contributions.filter(c=>keyOf(c.event.bookId,c.event.chapter)===key))c.verses=new Set([...c.verses].filter(v=>event.verses.includes(v)));
  }else {
   const covered=new Set(contributions.filter(c=>keyOf(c.event.bookId,c.event.chapter)===key).flatMap(c=>[...c.verses]));
   contributions.push({event,verses:new Set(event.verses),progressionVerses:new Set(event.verses.filter(v=>!covered.has(v)))});
  }
 }
 for(const c of contributions){const allowed=snapshot[keyOf(c.event.bookId,c.event.chapter)]??[];c.verses=new Set([...c.verses].filter(v=>allowed.includes(v)));}
 const baseline:Record<string,Set<number>>={};
 for(const [key,verses] of Object.entries(snapshot)){
  const [bookId,chapter]=key.split(':').map(Number);validatePassage({bookId,chapter,verses});
  const covered=new Set(contributions.filter(c=>keyOf(c.event.bookId,c.event.chapter)===key).flatMap(c=>[...c.verses]));
  baseline[key]=new Set(verses.filter(v=>!covered.has(v)));
 }
 const modern=state.events.filter(e=>e.modelVersion===2);
 const ids=new Set(contributions.map(c=>c.event.id));
 for(const event of modern){
  validatePassage(event);
  if(ids.has(event.id))throw new Error('Événement dupliqué.');
  ids.add(event.id);
  if(event.kind!=='correction')contributions.push({event,verses:new Set(event.verses),progressionVerses:new Set(event.kind==='lecture'?event.verses:[])});
 }
 // Les annulations ciblées sont des ensembles : ordre indifférent et application idempotente.
 for(const event of modern.filter(e=>e.kind==='correction')){
  const key=keyOf(event.bookId,event.chapter);
  for(const cancellation of event.cancellations??[]){
   validatePassage({...event,verses:cancellation.verses});
   const target=contributions.find(c=>c.event.id===cancellation.eventId);
   if(!target)continue; // En attente de sa cible lors d'une future fusion partielle.
   if(target.event.userId!==event.userId||keyOf(target.event.bookId,target.event.chapter)!==key)throw new Error('Cible de correction incompatible.');
   for(const v of cancellation.verses)target.verses.delete(v);
  }
  validatePassage({...event,verses:event.baselineVerses??[]});
  for(const v of event.baselineVerses??[])baseline[key]?.delete(v);
 }
 const progress:Record<string,number[]>={};
 for(const [key,vs] of Object.entries(baseline))progress[key]=sorted(vs);
 for(const c of contributions){const key=keyOf(c.event.bookId,c.event.chapter);progress[key]=sorted([...(progress[key]??[]),...c.verses]);}
 return {contributions,baseline,progress};
}

interface RecordOptions {now?:Date}
function eventBase(state:ReadingState,p:Passage,options:RecordOptions):Omit<ReadingEvent,'kind'>{
 return {...p,verses:sorted(p.verses),id:crypto.randomUUID(),userId:state.userId,occurredAt:(options.now??new Date()).toISOString(),modelVersion:2};
}
function append(state:ReadingState,events:ReadingEvent[]):ReadingState{
 const next={...state,legacyContext:state.legacyContext??{progress:structuredClone(state.progress)},events:[...state.events,...events]};
 return {...next,progress:effectiveReading(next).progress};
}

/** Annuler uniquement les versets désignés d'une validation précise. */
export function correctValidation(state:ReadingState,eventId:string,verses:number[],options:RecordOptions={}):ReadingState{
 const target=state.events.find(e=>e.id===eventId);
 if(!target||target.kind==='correction'||target.userId!==state.userId)throw new Error('Validation à corriger introuvable.');
 const p={bookId:target.bookId,chapter:target.chapter,verses:sorted(verses)};validatePassage(p);
 if(!verses.length||verses.some(v=>!target.verses.includes(v)))throw new Error('Versets absents de cette validation.');
 return append(state,[{...eventBase(state,p,options),kind:'correction',cancellations:[{eventId,verses:p.verses}]}]);
}

/** Compatibilité avec l'écran v1 ; une correction y transmet les versets à conserver. */
export function record(state:ReadingState,p:Passage,kind:'lecture'|'relecture'|'correction',max?:number,options:RecordOptions={}):ReadingState{
 const expected=validatePassage(p);
 if(max!==undefined&&max!==expected)throw new Error('Longueur de chapitre incohérente.');
 const effective=effectiveReading(state);const key=keyOf(p.bookId,p.chapter);const current=effective.progress[key]??[];
 if(kind==='correction'){
  if(p.verses.some(v=>!current.includes(v)))throw new Error('Une correction ne peut ajouter de versets.');
  const removed=current.filter(v=>!p.verses.includes(v));
  if(!removed.length)return state;
  const cancellations=new Map<string,number[]>();const baselineVerses:number[]=[];
  for(const v of removed){
   // Annuler la plus récente validation couvrante ; les autres restent effectives.
   const candidates=effective.contributions.filter(c=>keyOf(c.event.bookId,c.event.chapter)===key&&c.verses.has(v)).sort((a,b)=>a.event.occurredAt.localeCompare(b.event.occurredAt)||a.event.id.localeCompare(b.event.id));
   const target=candidates.at(-1);
   if(target)cancellations.set(target.event.id,[...(cancellations.get(target.event.id)??[]),v]);
   else baselineVerses.push(v);
  }
  return append(state,[{...eventBase(state,{...p,verses:removed},options),kind:'correction',cancellations:[...cancellations].map(([eventId,verses])=>({eventId,verses})),baselineVerses}]);
 }
 if(!p.verses.length)throw new Error('Sélectionnez au moins un verset.');
 const selected=sorted(p.verses);const fresh=selected.filter(v=>!current.includes(v));const repeated=selected.filter(v=>current.includes(v));
 if(kind==='relecture'&&fresh.length)throw new Error('Une relecture concerne des versets déjà lus.');
 const events:ReadingEvent[]=[];
 if(fresh.length)events.push({...eventBase(state,{...p,verses:fresh},options),kind:'lecture'});
 if(repeated.length)events.push({...eventBase(state,{...p,verses:repeated},options),kind:'relecture'});
 return append(state,events);
}

/** Premier segment continu non lu du parcours biblique classique ; null à la fin. */
export function nextUnread(state:ReadingState,books:Book[]){
 const progress=effectiveReading(state).progress;
 for(const book of books)for(let chapter=1;chapter<=book.chapters.length;chapter++){
  const max=book.chapters[chapter-1];const read=new Set(progress[keyOf(book.id,chapter)]??[]);
  for(let start=1;start<=max;start++)if(!read.has(start)){
   let end=start;while(end<max&&!read.has(end+1))end++;
   return {bookId:book.id,chapter,start,end,verses:selectRange(start,end,max)};
  }
 }
 return null;
}

const day=(d:Date)=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const calendarDays=(a:Date,b:Date)=>Math.floor((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000)+1;

export function metrics(state:ReadingState,books:Book[],now=new Date()){
 const effective=effectiveReading(state);let verses=0,chapters=0;
 const total=books.reduce((s,b)=>s+b.chapters.reduce((a,n)=>a+n,0),0);
 books.forEach(b=>b.chapters.forEach((max,i)=>{const n=effective.progress[keyOf(b.id,i+1)]?.length??0;verses+=n;if(n===max)chapters++;}));
 const reads=effective.contributions.filter(c=>c.verses.size&&new Date(c.event.occurredAt)<=now);
 const days=new Set(reads.map(c=>day(new Date(c.event.occurredAt))));
 const activity=Array.from({length:30},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-29+i);return {label:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}),active:days.has(day(d))?1:0};});
 const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-29);cutoff.setHours(0,0,0,0);
 const recent=reads.filter(c=>new Date(c.event.occurredAt)>=cutoff);
 const activityVerses=recent.reduce((s,c)=>s+c.verses.size,0);
 const attributed=new Set<string>();
 for(const [key,vs] of Object.entries(effective.baseline))for(const v of vs)attributed.add(`${key}:${v}`);
 let uniqueVerses30=0;const uniqueDays=new Set<string>();
 for(const c of [...reads].sort((a,b)=>a.event.occurredAt.localeCompare(b.event.occurredAt)||Number(b.progressionVerses.size>0)-Number(a.progressionVerses.size>0)||a.event.id.localeCompare(b.event.id))){
  for(const v of c.verses){const key=`${keyOf(c.event.bookId,c.event.chapter)}:${v}`;if(attributed.has(key))continue;attributed.add(key);
   if(c.progressionVerses.has(v)&&new Date(c.event.occurredAt)>=cutoff){uniqueVerses30++;uniqueDays.add(day(new Date(c.event.occurredAt)));}
  }
 }
 const first=reads.length?new Date(Math.min(...reads.map(c=>new Date(c.event.occurredAt).getTime()))):null;
 const observedDays=first?Math.min(30,calendarDays(now,first)):0;
 const pace=observedDays?uniqueVerses30/observedDays:0;
 const projectionReady=observedDays>=7&&uniqueDays.size>=2&&pace>0;
 const finish=verses===total?null:projectionReady?new Date(now.getTime()+(total-verses)/pace*86400000):null;
 return {verses,chapters,total,percent:verses/total*100,activity,days7:activity.slice(-7).reduce((s,d)=>s+d.active,0),days30:activity.reduce((s,d)=>s+d.active,0),pace,finish,activityVerses,activityPace:observedDays?activityVerses/observedDays:0,uniqueVerses30,observedDays,projectionReady,projectionStatus:verses===total?'terminée':projectionReady?'disponible':'données insuffisantes'};
}
