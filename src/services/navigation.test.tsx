import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {parsePassage,passageUrl,adjacentChapter} from './passageNavigation';
import {emptyState} from '../data/demo';
import books from '../data/books.json';
import {record,selectRange} from '../domain/reading';
import Dashboard from '../pages/Dashboard';
import Reading from '../pages/Reading';
import {jwWebChapterLink} from './jw';
import Navigation from '../components/Navigation';

describe('Navigation biblique par URL',()=>{
 it('utilise Genèse 1 sans dernière consultation',()=>{expect(parsePassage('')).toEqual({passage:{bookId:1,chapter:1},explicit:false});});
 it('reprend le dernier passage consulté sans confondre la progression',()=>{
  const last={bookId:43,chapter:3,verse:16};expect(parsePassage('',last)).toEqual({passage:last,explicit:false});
 });
 it('donne priorité à un lien direct sur la dernière consultation',()=>{
  expect(parsePassage('?livre=1&chapitre=3&verset=9&fin=24',{bookId:43,chapter:3})).toEqual({passage:{bookId:1,chapter:3,verse:9,end:24},explicit:true});
 });
 it('produit une URL partageable et réversible',()=>{
  const passage={bookId:19,chapter:119,verse:150,end:176};const url=passageUrl(passage);
  expect(parsePassage(url.split('?')[1])).toEqual({passage,explicit:true});
 });
 it.each(['?livre=67&chapitre=1','?livre=1&chapitre=51','?livre=1','?chapitre=1','?livre=1&chapitre=1.5','?livre=1&chapitre=0','?livre=1&chapitre=1&verset=32','?livre=1&chapitre=3&verset=9&fin=8','?livre=1&chapitre=3&fin=5','?livre=1&livre=2&chapitre=1','?livre=1&chapitre=1&extra=1','?livre=&chapitre=1'])('signale proprement %s',search=>{
  expect(parsePassage(search)).toHaveProperty('error');
 });
 it('traverse les limites de livres dans les deux sens',()=>{
  expect(adjacentChapter({bookId:1,chapter:50},1)).toEqual({bookId:2,chapter:1});
  expect(adjacentChapter({bookId:2,chapter:1},-1)).toEqual({bookId:1,chapter:50});
  expect(adjacentChapter({bookId:1,chapter:1},-1)).toBeNull();expect(adjacentChapter({bookId:66,chapter:22},1)).toBeNull();
 });
 it('propose un repli HTTPS sur le chapitre en ligne',()=>{
  expect(jwWebChapterLink(1,3)).toBe('https://wol.jw.org/fr/wol/b/r30/lp-f/nwtsty/1/3');expect(()=>jwWebChapterLink(67,1)).toThrow();
 });
});

describe('Rendu des interfaces connectées au lot A',()=>{
 it('conserve un nom accessible sur la navigation réduite aux icônes',()=>{
  const html=renderToStaticMarkup(<MemoryRouter><Navigation readingUrl="/lecture?livre=2&chapitre=2"/></MemoryRouter>);
  for(const name of ['Accueil','Lecture','Statistiques'])expect(html).toContain(`aria-label="${name}"`);
 });
 it('branche le bouton de l’Accueil au premier trou et à son segment exact',()=>{
  const state=record(emptyState(),{bookId:1,chapter:1,verses:[1,2,5]},'lecture',31);
  const html=renderToStaticMarkup(<MemoryRouter><Dashboard state={state} change={vi.fn()} busy={false}/></MemoryRouter>);
  expect(html).toContain('/lecture?livre=1&amp;chapitre=1&amp;verset=3&amp;fin=4');expect(html).toContain('Marquer comme lu');expect(state.events).toHaveLength(1);
 });
 it('affiche une fin de parcours adaptée sans nouvelle lecture suggérée',()=>{
  const state=emptyState();books.forEach(b=>b.chapters.forEach((max,i)=>state.progress[`${b.id}:${i+1}`]=selectRange(1,max,max)));
  const html=renderToStaticMarkup(<MemoryRouter><Dashboard state={state} change={vi.fn()} busy={false}/></MemoryRouter>);
  expect(html).toContain('Toute la Bible est parcourue.');expect(html).not.toContain('Marquer comme lu');
 });
 it('ouvre le lien direct sans sélection temporaire ni validation automatique',()=>{
  const state=emptyState(),save=vi.fn(async()=>state),visit=vi.fn();
  const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/lecture?livre=1&chapitre=3&verset=9&fin=11']}><Reading state={state} change={save} busy={false} onVisit={visit}/></MemoryRouter>);
  expect(html).toMatch(/aria-label="Verset 9, non lu" aria-pressed="false" aria-current="location"/);expect(html).toMatch(/aria-label="Verset 12, non lu" aria-pressed="false"/);
  expect(save).not.toHaveBeenCalled();expect(state.events).toEqual([]);
 });
 it('rend une URL invalide sans sauvegarde ni préférence inventée',()=>{
  const state=emptyState(),save=vi.fn(async()=>state),visit=vi.fn();
  const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/lecture?livre=999&chapitre=1']}><Reading state={state} change={save} busy={false} onVisit={visit}/></MemoryRouter>);
  expect(html).toContain('Ce passage est introuvable');expect(save).not.toHaveBeenCalled();expect(visit).not.toHaveBeenCalled();
 });
});
