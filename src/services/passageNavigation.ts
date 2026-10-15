import books from '../data/books.json';
import {chapterLength} from '../domain/references';
import type {ReadingPreferences} from '../domain/models';

export interface ViewedPassage {bookId:number;chapter:number;verse?:number;end?:number}
export function passageUrl(p:ViewedPassage):string {
 const max=chapterLength(p.bookId,p.chapter);
 if(p.verse!==undefined&&(!Number.isInteger(p.verse)||p.verse<1||p.verse>max))throw new Error('Verset d’URL invalide.');
 if(p.end!==undefined&&(p.verse===undefined||!Number.isInteger(p.end)||p.end<p.verse||p.end>max))throw new Error('Fin de passage invalide.');
 const params=new URLSearchParams({livre:String(p.bookId),chapitre:String(p.chapter)});
 if(p.verse!==undefined)params.set('verset',String(p.verse));
 if(p.end!==undefined)params.set('fin',String(p.end));
 return `/lecture?${params}`;
}
export function parsePassage(search:string,last?:ReadingPreferences['lastPassage']):{passage:ViewedPassage;explicit:boolean}|{error:string}{
 const params=new URLSearchParams(search);
 if(!params.size)return {passage:last??{bookId:1,chapter:1},explicit:false};
 const allowed=['livre','chapitre','verset','fin'];
 if([...params.keys()].some(k=>!allowed.includes(k)||params.getAll(k).length!==1))return {error:'Cette URL contient des paramètres inconnus ou répétés.'};
 const integer=(key:string)=>{const v=params.get(key);return v!==null&&/^[1-9]\d*$/.test(v)?Number(v):NaN;};
 const p:ViewedPassage={bookId:integer('livre'),chapter:integer('chapitre')};
 if(params.has('verset'))p.verse=integer('verset');if(params.has('fin'))p.end=integer('fin');
 try{passageUrl(p);return {passage:p,explicit:true};}catch{return {error:'Ce lien ne correspond pas à un livre, chapitre ou verset valide du référentiel.'};}
}
export function adjacentChapter(p:ViewedPassage,direction:-1|1):ViewedPassage|null {
 chapterLength(p.bookId,p.chapter);const book=books[p.bookId-1];
 if(p.chapter+direction>=1&&p.chapter+direction<=book.chapters.length)return {bookId:p.bookId,chapter:p.chapter+direction};
 const next=books[p.bookId-1+direction];if(!next)return null;
 return {bookId:next.id,chapter:direction===1?1:next.chapters.length};
}
