import {chapterLength} from '../domain/references';
export function jwLink(bookId:number,chapter:number,start:number,end:number){
 const max=chapterLength(bookId,chapter);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>max)throw new Error('Référence JW invalide.');
 const code=(v:number)=>`${String(bookId).padStart(2,'0')}${String(chapter).padStart(3,'0')}${String(v).padStart(3,'0')}`;
 return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=F&prefer=lang&bible=${code(start)}-${code(end)}&pub=nwtsty`;
}
export function jwWebChapterLink(bookId:number,chapter:number){
 chapterLength(bookId,chapter);
 return `https://wol.jw.org/fr/wol/b/r30/lp-f/nwtsty/${bookId}/${chapter}`;
}
