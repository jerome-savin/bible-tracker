import type {ReadingState} from '../domain/models';
import {keyOf,record,selectRange} from '../domain/reading';
import books from '../data/books.json';
export type ReadingChange=(state:ReadingState)=>ReadingState;
export type ChangeReading=(change:ReadingChange)=>Promise<ReadingState>;
/** Chaque intention est calculée sur le dernier état effectivement sauvegardé. */
export function createReadingWriter(get:()=>ReadingState,save:(state:ReadingState)=>Promise<ReadingState>,onBusy:(busy:boolean)=>void):ChangeReading {
 let queue:Promise<unknown>=Promise.resolve();let pending=0;
 return change=>{
  pending++;onBusy(true);
  const result=queue.catch(()=>{}).then(()=>save(change(get())));queue=result;
  return result.finally(()=>{pending--;onBusy(pending>0);});
 };
}
export function toggleVerse(state:ReadingState,bookId:number,chapter:number,verse:number){
 const read=state.progress[keyOf(bookId,chapter)]??[],max=books[bookId-1]?.chapters[chapter-1];
 return read.includes(verse)
  ?record(state,{bookId,chapter,verses:read.filter(v=>v!==verse)},'correction',max)
  :record(state,{bookId,chapter,verses:[verse]},'lecture',max);
}
export function markChapter(state:ReadingState,bookId:number,chapter:number,reread=false){
 const max=books[bookId-1]?.chapters[chapter-1];
 const all=selectRange(1,max,max),read=state.progress[keyOf(bookId,chapter)]??[];
 const verses=reread?all:all.filter(v=>!read.includes(v));
 return verses.length?record(state,{bookId,chapter,verses},'lecture',max):state;
}
