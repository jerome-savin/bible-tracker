import type {Book, ReadingState, Passage} from './models';
export const keyOf=(bookId:number,chapter:number)=>`${bookId}:${chapter}`;
export function selectRange(start:number,end:number,max:number):number[]{
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>max||start>end) throw new Error('Plage de versets invalide.');
 return Array.from({length:end-start+1},(_,i)=>start+i);
}
export function status(verses:number[],max:number){return verses.length===0?'non lu':verses.length===max?'terminé':'partiellement lu';}
export function record(state:ReadingState,p:Passage,kind:'lecture'|'correction',max:number):ReadingState{
 const verses=[...new Set(p.verses)].sort((a,b)=>a-b);
 if(verses.some(v=>!Number.isInteger(v)||v<1||v>max))throw new Error('Verset invalide.');
 const k=keyOf(p.bookId,p.chapter);
 return {...state,progress:{...state.progress,[k]:kind==='correction'?verses:[...new Set([...(state.progress[k]??[]),...verses])].sort((a,b)=>a-b)},events:[...state.events,{...p,verses,id:crypto.randomUUID(),userId:state.userId,occurredAt:new Date().toISOString(),kind}]};
}
export function metrics(state:ReadingState,books:Book[],now=new Date()){
 let verses=0,chapters=0; const total=books.reduce((s,b)=>s+b.chapters.reduce((a,n)=>a+n,0),0);
 books.forEach(b=>b.chapters.forEach((max,i)=>{const n=state.progress[keyOf(b.id,i+1)]?.length??0;verses+=n;if(n===max)chapters++;}));
 const day=(d:Date)=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
 const reads=state.events.filter(e=>e.kind==='lecture'&&e.verses.length>0);
 const days=new Set(reads.map(e=>day(new Date(e.occurredAt))));
 const activity=Array.from({length:30},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-29+i);return {label:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}),active:days.has(day(d))?1:0};});
 const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-29);cutoff.setHours(0,0,0,0);
 const recent=reads.filter(e=>new Date(e.occurredAt)>=cutoff&&new Date(e.occurredAt)<=now).reduce((s,e)=>s+e.verses.length,0);
 const pace=recent/30; const finish=pace?new Date(now.getTime()+(total-verses)/pace*86400000):null;
 return {verses,chapters,total,percent:verses/total*100,activity,days7:activity.slice(-7).reduce((s,d)=>s+d.active,0),days30:activity.reduce((s,d)=>s+d.active,0),pace,finish};
}
