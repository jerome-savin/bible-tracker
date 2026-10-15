import {describe,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createReadingWriter,markChapter,toggleVerse} from './readingActions';
import {IndexedDBReadingRepository} from './repository';
import {emptyState} from '../data/demo';
import {metrics,record} from '../domain/reading';
import books from '../data/books.json';
import Reading from '../pages/Reading';
import Dashboard from '../pages/Dashboard';
import Settings from '../pages/Settings';

async function setup(){
 const factory=new IDBFactory(),name=crypto.randomUUID(),repo=new IndexedDBReadingRepository(name,factory);
 let state=await repo.save(emptyState());
 const write=createReadingWriter(()=>state,async next=>{state=await repo.save(next);return state;},()=>{});
 return {repo,write,get:()=>state,reopen:()=>new IndexedDBReadingRepository(name,factory)};
}
describe('Actions directes du lot D',()=>{
 it('un clic enregistre puis un clic retire avec correction et persistance',async()=>{
  const c=await setup();await c.write(s=>toggleVerse(s,1,1,1));
  expect((await c.repo.load())?.progress['1:1']).toEqual([1]);
  await c.write(s=>toggleVerse(s,1,1,1));
  const reopened=await c.reopen().load();expect(reopened?.progress['1:1']).toEqual([]);
  expect(reopened?.events.map(e=>e.kind)).toEqual(['lecture','correction']);
 });
 it('sérialise une rafale sans perdre de verset ni dupliquer un UUID',async()=>{
  const c=await setup();
  await Promise.all(Array.from({length:10},(_,i)=>c.write(s=>toggleVerse(s,1,1,i+1))));
  expect(c.get().progress['1:1']).toEqual([1,2,3,4,5,6,7,8,9,10]);
  expect(new Set(c.get().events.map(e=>e.id)).size).toBe(10);
  expect(await c.reopen().load()).toEqual(c.get());
 });
 it('deux intentions rapides sur le même verset font lecture puis correction',async()=>{
  const c=await setup();await Promise.all([c.write(s=>toggleVerse(s,1,1,1)),c.write(s=>toggleVerse(s,1,1,1))]);
  expect(c.get().progress['1:1']).toEqual([]);expect(c.get().events).toHaveLength(2);
 });
 it('tout marquer ajoute seulement les manquants et ne crée pas une relecture implicite',async()=>{
  const c=await setup();await c.write(s=>toggleVerse(s,1,1,1));await c.write(s=>markChapter(s,1,1));await c.write(s=>markChapter(s,1,1));
  expect(c.get().progress['1:1']).toHaveLength(31);expect(c.get().events.map(e=>e.kind)).toEqual(['lecture','lecture']);
 });
 it('la relecture explicite conserve le rythme et une correction ne masque pas une autre lecture',async()=>{
  const c=await setup();await c.write(s=>markChapter(s,1,1));
  const before=metrics(c.get(),books);await c.write(s=>markChapter(s,1,1,true));
  expect(c.get().events.at(-1)?.kind).toBe('relecture');expect(metrics(c.get(),books).pace).toBe(before.pace);
  await c.write(s=>toggleVerse(s,1,1,1));expect(c.get().progress['1:1']).toContain(1);
  await c.write(s=>toggleVerse(s,1,1,1));expect(c.get().progress['1:1']).not.toContain(1);
  expect((await c.reopen().load())?.events).toHaveLength(4);
 });
 it('préserve un socle hérité et le corrige sans inventer sa lecture',async()=>{
  const s=emptyState();s.progress['1:1']=[1,2];const next=toggleVerse(s,1,1,1);
  expect(next.progress['1:1']).toEqual([2]);expect(next.events.map(e=>e.kind)).toEqual(['correction']);
 });
 it('refuse une référence invalide sans modifier le carnet',async()=>{
  const c=await setup();await expect(c.write(s=>toggleVerse(s,1,1,32))).rejects.toThrow();
  expect(await c.repo.load()).toEqual(c.get());expect(c.get().events).toEqual([]);
 });
 it('une erreur de stockage garde le dernier état et permet de réessayer',async()=>{
  const c=await setup(),original=c.get();let state=original;
  const save=vi.fn().mockRejectedValueOnce(new Error('Quota')).mockImplementation(async s=>{state=await c.repo.save(s);return state;});
  const busy=vi.fn(),write=createReadingWriter(()=>state,save,busy);
  await expect(write(s=>toggleVerse(s,1,1,1))).rejects.toThrow('Quota');
  expect(state).toBe(original);expect(await c.repo.load()).toEqual(original);expect(busy).toHaveBeenLastCalledWith(false);
  await write(s=>toggleVerse(s,1,1,1));expect(state.progress['1:1']).toEqual([1]);
 });
 it('un échec ne bloque pas la prochaine action en attente et ne lui transmet pas de faux état',async()=>{
  let state=emptyState();const save=vi.fn().mockRejectedValueOnce(new Error('Erreur')).mockImplementation(async s=>{state=s;return s;});
  const busy=vi.fn(),write=createReadingWriter(()=>state,save,busy);
  const outcomes=await Promise.allSettled([write(s=>toggleVerse(s,1,1,1)),write(s=>toggleVerse(s,1,1,2))]);
  expect(outcomes.map(o=>o.status)).toEqual(['rejected','fulfilled']);expect(state.progress['1:1']).toEqual([2]);expect(busy.mock.calls.map(c=>c[0])).toEqual([true,true,true,false]);
 });
 it('un onglet périmé ne remplace pas une sauvegarde concurrente',async()=>{
  const c=await setup();await c.repo.save(record(c.get(),{bookId:1,chapter:1,verses:[2]},'lecture'));
  await expect(c.write(s=>toggleVerse(s,1,1,1))).rejects.toThrow();
  expect((await c.reopen().load())?.progress['1:1']).toEqual([2]);expect(c.get().progress).toEqual({});
 });
 it('rend des boutons directs, sans sélection ni récapitulatif, désactivés pendant une sauvegarde',()=>{
  const html=renderToStaticMarkup(<MemoryRouter><Reading state={emptyState()} change={vi.fn()} busy={true} onVisit={vi.fn()}/></MemoryRouter>);
  expect(html).toMatch(/disabled="" aria-label="Verset 1, non lu" aria-pressed="false"/);
  expect(html).toContain('Tout marquer comme lu');expect(html).toContain('Relire ce chapitre');
  for(const text of ['Préparer','Récapitulatif','Premier verset','Corriger la lecture'])expect(html).not.toContain(text);
 });
 it('garde l’Accueil minimal et la sauvegarde derrière Avancé fermé',async()=>{
  const c=await setup();
  const home=renderToStaticMarkup(<MemoryRouter><Dashboard state={c.get()} change={c.write} busy={false}/></MemoryRouter>);
  expect(home).toContain('Marquer comme lu');expect(home).not.toContain('Jours de lecture');expect(home).not.toContain('Fin estimée');
  const settings=renderToStaticMarkup(<Settings state={c.get()} repository={c.repo} save={s=>c.repo.save(s)} onRestored={vi.fn()} busy={false}/>);
  expect(settings).toContain('<details><summary>Avancé</summary>');expect(settings).not.toContain('<details open');
 });
});
