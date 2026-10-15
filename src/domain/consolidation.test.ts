import {describe,it,expect} from 'vitest';
import books from '../data/books.json';
import {emptyState,demoState} from '../data/demo';
import {record,correctValidation,effectiveReading,metrics,nextUnread,selectRange} from './reading';
import {chapterLength,validatePassage} from './references';
import {jwLink} from '../services/jw';
import type {ReadingState} from './models';

const at=(day:number)=>new Date(`2026-10-${String(day).padStart(2,'0')}T12:00:00Z`);
const now=at(15);
const p=(verses:number[])=>({bookId:1,chapter:1,verses});
const read=(s:ReadingState,verses:number[],day=8)=>record(s,p(verses),'lecture',31,{now:at(day)});
const stats=(s:ReadingState)=>metrics(s,books,now);

describe('Lot A : lectures, relectures et corrections ciblées',()=>{
 it('valide un verset inédit avec UUID, date ISO et utilisateur stable',()=>{
  const initial=emptyState();const s=read(initial,[1]);
  expect(s.progress['1:1']).toEqual([1]);expect(s.userId).toBe(initial.userId);
  expect(s.events[0]).toMatchObject({kind:'lecture',modelVersion:2,userId:s.userId,occurredAt:at(8).toISOString()});
  expect(s.events[0].id).toMatch(/^[0-9a-f-]{36}$/);expect(initial.events).toEqual([]);
 });
 it('distingue la relecture sans doubler la progression',()=>{
  const s=read(read(emptyState(),[1]),[1],9);
  expect(s.events.map(e=>e.kind)).toEqual(['lecture','relecture']);
  expect(stats(s)).toMatchObject({verses:1,activityVerses:2,uniqueVerses30:1,days30:2});
 });
 it('attribue la progression à la lecture même à timestamp identique',()=>{
  let s=read(read(emptyState(),[1],8),[1],8);
  // UUID inversés pour vérifier que leur ordre ne transforme pas la relecture en progression.
  s={...s,events:s.events.map((e,i)=>({...e,id:i===0?'ffffffff-ffff-4fff-afff-ffffffffffff':'00000000-0000-4000-a000-000000000000'}))};
  expect(stats(s)).toMatchObject({uniqueVerses30:1,activityVerses:2});
 });
 it('sépare les parties nouvelles et relues d’une sélection mixte',()=>{
  const s=read(read(emptyState(),[1]),[1,2,2],9);
  expect(s.events.slice(1).map(e=>[e.kind,e.verses])).toEqual([['lecture',[2]],['relecture',[1]]]);
  expect(stats(s)).toMatchObject({verses:2,activityVerses:3,uniqueVerses30:2});
 });
 it('annule une erreur sans supprimer l’audit ni créer une activité de correction',()=>{
  const original=read(emptyState(),[1,2]);
  const s=correctValidation(original,original.events[0].id,[1,2],{now:at(15)});
  expect(s.events).toHaveLength(2);expect(s.events[0]).toEqual(original.events[0]);
  expect(stats(s)).toMatchObject({verses:0,activityVerses:0,days7:0,days30:0,pace:0,finish:null});
 });
 it('annule seulement les versets concernés lors d’une correction partielle',()=>{
  const original=read(emptyState(),[1,2,3]);const s=correctValidation(original,original.events[0].id,[2],{now:at(15)});
  expect(s.progress['1:1']).toEqual([1,3]);expect(stats(s)).toMatchObject({activityVerses:2,uniqueVerses30:2,days30:1,days7:0});
 });
 it('conserve la progression couverte par une autre validation active',()=>{
  const original=read(read(emptyState(),[1]),[1],9);
  const s=correctValidation(original,original.events[0].id,[1]);
  expect(stats(s)).toMatchObject({verses:1,activityVerses:1,uniqueVerses30:0});
 });
 it('peut corriger une relecture sans annuler la première lecture',()=>{
  const original=read(read(emptyState(),[1]),[1],9);
  const s=correctValidation(original,original.events[1].id,[1]);
  expect(stats(s)).toMatchObject({verses:1,activityVerses:1,uniqueVerses30:1});
 });
 it('rend une correction répétée idempotente sur les statistiques',()=>{
  let s=read(emptyState(),[1,2]);const id=s.events[0].id;
  s=correctValidation(s,id,[1]);s=correctValidation(s,id,[1]);
  expect(s.events).toHaveLength(3);expect(stats(s)).toMatchObject({verses:1,activityVerses:1});
 });
 it('applique les corrections même si elles précèdent leur cible dans le tableau',()=>{
  let s=read(emptyState(),[1]);s=correctValidation(s,s.events[0].id,[1]);
  expect(effectiveReading({...s,events:[...s.events].reverse()}).progress).toEqual(s.progress);
 });
 it('garde une correction dont la cible est encore absente sans effet parasite',()=>{
  let s=read(emptyState(),[1]);s=correctValidation(s,s.events[0].id,[1]);
  const partial={...s,events:[s.events[1]]};
  expect(stats(partial)).toMatchObject({verses:0,activityVerses:0});expect(partial.events).toHaveLength(1);
 });
 it('l’adaptateur de l’ancien écran annule la dernière validation seulement',()=>{
  const s=record(read(read(emptyState(),[1]),[1],9),p([]),'correction',31,{now});
  expect(stats(s)).toMatchObject({verses:1,activityVerses:1});expect(s.events.at(-1)?.cancellations?.[0].eventId).toBe(s.events[1].id);
 });
 it('refuse les corrections hors cible et les relectures inédites',()=>{
  const s=read(emptyState(),[1]);
  expect(()=>correctValidation(s,'inconnu',[1])).toThrow();
  expect(()=>correctValidation(s,s.events[0].id,[2])).toThrow();
  expect(()=>record(s,p([2]),'relecture',31)).toThrow();
  expect(()=>record(s,p([2]),'correction',31)).toThrow();
 });
});

describe('Statistiques et projection',()=>{
 it('ne projette pas à partir d’une seule séance ou de moins de sept jours',()=>{
  expect(stats(read(emptyState(),[1]))).toMatchObject({finish:null,projectionStatus:'données insuffisantes'});
  expect(stats(read(read(emptyState(),[1],14),[2],15))).toMatchObject({finish:null});
 });
 it('exclut les relectures du rythme et de la date estimée',()=>{
  const base=read(read(emptyState(),[1,2],8),[3,4],10);const repeated=read(base,[1,2,3,4],14);
  expect(stats(base).finish).not.toBeNull();expect(stats(repeated).finish).toEqual(stats(base).finish);
  expect(stats(repeated).pace).toBe(stats(base).pace);expect(stats(repeated).activityVerses).toBe(8);
 });
 it('ne recompte pas comme nouvelle progression un verset lu avant la fenêtre',()=>{
  let s=record(emptyState(),p([1]),'lecture',31,{now:new Date('2026-08-01T12:00:00Z')});s=read(s,[1],14);
  expect(stats(s)).toMatchObject({activityVerses:1,uniqueVerses30:0,pace:0,finish:null});
 });
 it('compte une journée une seule fois malgré plusieurs séances',()=>{
  const s=read(read(emptyState(),[1],14),[2],14);expect(stats(s).days30).toBe(1);
 });
 it('ignore les événements futurs dans l’activité et la projection',()=>{
  expect(stats(read(emptyState(),[1],20))).toMatchObject({activityVerses:0,days30:0,pace:0,finish:null});
 });
 it('ne crée pas de jour actif lorsque seule une correction a eu lieu',()=>{
  let s=read(emptyState(),[1,2],8);s=correctValidation(s,s.events[0].id,[1],{now:at(15)});
  expect(stats(s).activity.at(-1)?.active).toBe(0);expect(stats(s).days30).toBe(1);
 });
});

describe('Prochaine lecture classique',()=>{
 it('commence à Genèse 1:1 dans un carnet vide',()=>{expect(nextUnread(emptyState(),books)).toMatchObject({bookId:1,chapter:1,start:1,end:31});});
 it('reprend exactement au premier trou d’un chapitre partiel',()=>{
  const s=read(emptyState(),[1,2,5,8]);expect(nextUnread(s,books)).toMatchObject({chapter:1,start:3,end:4,verses:[3,4]});
 });
 it('saute un chapitre terminé et tolère un ordre de lecture inhabituel',()=>{
  let s=read(emptyState(),selectRange(1,31,31));s=record(s,{bookId:1,chapter:2,verses:[1,3,4]},'lecture',25);
  expect(nextUnread(s,books)).toMatchObject({chapter:2,start:2,end:2});
 });
 it('retourne un état de fin sans suggérer de nouveau passage',()=>{
  const s=emptyState();books.forEach(b=>b.chapters.forEach((max,i)=>s.progress[`${b.id}:${i+1}`]=selectRange(1,max,max)));
  expect(nextUnread(s,books)).toBeNull();expect(stats(s)).toMatchObject({verses:31102,chapters:1189,percent:100,finish:null,projectionStatus:'terminée'});
 });
});

describe('Compatibilité métier phase 1, sans migration de stockage',()=>{
 it('préserve une progression sans historique sans inventer d’activité datée',()=>{
  const s=emptyState();s.progress['1:1']=[1,2];const next=read(s,[3]);
  expect(next.progress['1:1']).toEqual([1,2,3]);expect(stats(next).activityVerses).toBe(1);
  expect(s.events).toEqual([]);
 });
 it('interprète une ancienne correction comme un instantané conservé',()=>{
  const s=emptyState();s.progress['1:1']=[2];
  s.events=[{...p([1,2]),id:crypto.randomUUID(),userId:s.userId,occurredAt:at(8).toISOString(),kind:'lecture'},
   {...p([2]),id:crypto.randomUUID(),userId:s.userId,occurredAt:at(15).toISOString(),kind:'correction'}];
  expect(stats(s)).toMatchObject({verses:1,activityVerses:1,days30:1});
  const snapshot=structuredClone(s);read(s,[3],14);expect(s).toEqual(snapshot);
 });
 it('ne transforme pas une relecture historique en vitesse après annulation de sa première lecture',()=>{
  const s=emptyState();s.progress['1:1']=[1];
  s.events=[8,9].map(d=>({...p([1]),id:crypto.randomUUID(),userId:s.userId,occurredAt:at(d).toISOString(),kind:'lecture' as const}));
  const corrected=correctValidation(s,s.events[0].id,[1]);
  expect(stats(corrected)).toMatchObject({verses:1,activityVerses:1,uniqueVerses30:0});
 });
 it('permet de corriger la progression héritée sans événement inventé',()=>{
  const s=emptyState();s.progress['1:1']=[1,2];
  const next=record(s,p([2]),'correction',31);
  expect(next.progress['1:1']).toEqual([2]);expect(next.events).toHaveLength(1);
  expect(stats(next)).toMatchObject({activityVerses:0,days30:0});
 });
 it('conserve les 64 versets de démonstration lors d’une première écriture v2',()=>{
  const s=record(demoState(),{bookId:1,chapter:3,verses:[9]},'lecture',24);expect(stats(s).verses).toBe(65);
 });
});

describe('Références et liens JW',()=>{
 it('vérifie le nombre de chapitres de chaque livre, pas seulement leur total',()=>{
  expect(books.map(b=>b.chapters.length)).toEqual([50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22]);
 });
 it.each([[0,1,1],[67,1,1],[1,0,1],[1,51,1],[1.5,1,1],[1,1.5,1],[1,1,0],[1,1,32],[1,1,1.5]])('refuse %s:%s:%s', (bookId,chapter,verse)=>{
  expect(()=>record(emptyState(),{bookId,chapter,verses:[verse]},'lecture')).toThrow();
  expect(()=>jwLink(bookId,chapter,verse,verse)).toThrow();
 });
 it('refuse un maximum mensonger et une plage JW inversée',()=>{
  expect(()=>record(emptyState(),p([32]),'lecture',40)).toThrow();
  expect(()=>record(emptyState(),p([1]),'lecture',40)).toThrow();
  expect(()=>jwLink(1,3,8,2)).toThrow();
 });
 it('vérifie les derniers versets et leur encodage pour les 1189 chapitres',()=>{
  for(const b of books)for(let chapter=1;chapter<=b.chapters.length;chapter++){
   const max=chapterLength(b.id,chapter);expect(validatePassage({bookId:b.id,chapter,verses:[1,max]})).toBe(max);
   const code=`${String(b.id).padStart(2,'0')}${String(chapter).padStart(3,'0')}${String(max).padStart(3,'0')}`;
   expect(jwLink(b.id,chapter,max,max)).toContain(`bible=${code}-${code}`);
   expect(()=>validatePassage({bookId:b.id,chapter,verses:[max+1]})).toThrow();
  }
 });
 it('conserve les constats numériques vérifiés sans déclarer la NWT entièrement validée',()=>{
  expect(chapterLength(64,1)).toBe(14);expect(chapterLength(40,17)).toBe(27);
 });
});
