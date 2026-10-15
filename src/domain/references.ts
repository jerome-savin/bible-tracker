import books from '../data/books.json';
import type {Passage} from './models';

/** Validation dans le référentiel actuel ; ne certifie pas la versification NWT. */
export function chapterLength(bookId:number,chapter:number):number {
 if(!Number.isInteger(bookId)||!Number.isInteger(chapter))throw new Error('Livre ou chapitre invalide.');
 const book=books.find(b=>b.id===bookId);
 if(!book||chapter<1||chapter>book.chapters.length)throw new Error('Livre ou chapitre inexistant.');
 return book.chapters[chapter-1];
}
export function validatePassage(p:Passage):number {
 const max=chapterLength(p.bookId,p.chapter);
 if(!Array.isArray(p.verses)||p.verses.some(v=>!Number.isInteger(v)||v<1||v>max))throw new Error('Verset inexistant dans ce chapitre.');
 return max;
}
