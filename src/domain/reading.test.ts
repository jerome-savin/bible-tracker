import {describe,it,expect} from 'vitest';
import books from '../data/books.json';
import {emptyState} from '../data/demo';
import {selectRange,record,metrics,status} from './reading';
import {jwLink} from '../services/jw';
describe('Référentiel vérifiable',()=>{
 it('contient 66 livres, 1189 chapitres et 31102 versets',()=>{expect(books).toHaveLength(66);expect(books.reduce((s,b)=>s+b.chapters.length,0)).toBe(1189);expect(books.flatMap(b=>b.chapters).reduce((s,n)=>s+n,0)).toBe(31102);});
 it('contient des identifiants consécutifs et des nombres positifs',()=>{books.forEach((b,i)=>{expect(b.id).toBe(i+1);expect(b.chapters.every(n=>Number.isInteger(n)&&n>0)).toBe(true);});expect(books[18].chapters[118]).toBe(176);expect(books[0].chapters[2]).toBe(24);});
});
describe('Sélection et progression',()=>{
 it('sélectionne une plage inclusive et refuse les bornes invalides',()=>{expect(selectRange(3,5,24)).toEqual([3,4,5]);for(const p of [[0,2],[3,2],[1,25],[1.5,3]])expect(()=>selectRange(p[0],p[1],24)).toThrow();});
 it('conserve les relectures sans doubler la progression',()=>{let s=emptyState();s=record(s,{bookId:1,chapter:1,verses:[1,2,2]},'lecture',31);s=record(s,{bookId:1,chapter:1,verses:[1,2]},'lecture',31);expect(s.events).toHaveLength(2);expect(metrics(s,books).verses).toBe(2);expect(s.events[0].id).not.toBe(s.events[1].id);});
 it('corrige sans effacer l’historique',()=>{let s=record(emptyState(),{bookId:1,chapter:1,verses:selectRange(1,31,31)},'lecture',31);expect(metrics(s,books).chapters).toBe(1);s=record(s,{bookId:1,chapter:1,verses:[2]},'correction',31);expect(metrics(s,books).chapters).toBe(0);expect(s.events).toHaveLength(2);expect(metrics(s,books).verses).toBe(1);});
 it('calcule les trois états',()=>{expect(status([],3)).toBe('non lu');expect(status([1],3)).toBe('partiellement lu');expect(status([1,2,3],3)).toBe('terminé');});
 it('ne prédit pas de date sans rythme',()=>{const m=metrics(emptyState(),books);expect(m.percent).toBe(0);expect(m.finish).toBeNull();expect(m.days30).toBe(0);});
 it('refuse un verset hors chapitre',()=>{expect(()=>record(emptyState(),{bookId:1,chapter:1,verses:[32]},'lecture',31)).toThrow();});
 it('reproduit exactement le lien Android fourni',()=>{expect(jwLink(1,3,1,24)).toBe('https://www.jw.org/finder?srcid=jwlshare&wtlocale=F&prefer=lang&bible=01003001-01003024&pub=nwtsty');});
});
