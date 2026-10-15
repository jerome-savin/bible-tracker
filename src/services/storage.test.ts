import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {emptyState,demoState} from '../data/demo';
import {record,correctValidation,effectiveReading,metrics} from '../domain/reading';
import books from '../data/books.json';
import type {ReadingState,BackupDocument} from '../domain/models';
import {createBackup,previewImport,validateBackup,validateState,serializeBackup,MAX_BACKUP_BYTES} from './backups';
import {IndexedDBReadingRepository,STORAGE_VERSION} from './repository';

const p=(verses:number[])=>({bookId:1,chapter:1,verses});
const read=(s=emptyState(),verses=[1])=>record(s,p(verses),'lecture',31);
function richState(){let s=read();s=read(s,[1,2]);return correctValidation(s,s.events[1].id,[2]);}

describe('Sauvegardes versionnées et validation stricte',()=>{
 it('exporte et réimporte sans perte un carnet avec corrections, relectures et préférences',()=>{
  const state=richState(),preferences={activePlan:'canonical' as const,lastPassage:{bookId:1,chapter:1,verse:3}};
  const backup=createBackup(state,preferences);const imported=previewImport(serializeBackup(backup));
  expect(imported.backup).toEqual(backup);expect(imported.summary).toMatchObject({events:4,corrections:1,rereadings:1});
  expect(metrics(imported.backup.state,books)).toEqual(metrics(state,books));
 });
 it('accepte les exports bruts de phase 1 et signale la progression sans historique',()=>{
  const state=emptyState();state.progress['1:1']=[1,2];
  const preview=previewImport(JSON.stringify(state));
  expect(preview.source).toBe('phase-1');expect(preview.backup.state).toEqual(state);
  expect(preview.backup.preferences).toEqual({});expect(preview.warnings).toHaveLength(2);expect(state.events).toEqual([]);
 });
 it('accepte un ancien événement et une correction instantanée sans champs du lot A',()=>{
  const state=emptyState();state.progress['1:1']=[2];state.events=[
   {...p([1,2]),id:crypto.randomUUID(),userId:state.userId,kind:'lecture',occurredAt:'2026-10-01T12:00:00.000Z'},
   {...p([2]),id:crypto.randomUUID(),userId:state.userId,kind:'correction',occurredAt:'2026-10-02T12:00:00.000Z'}];
  const preview=previewImport(JSON.stringify(state));expect(preview.backup.state).toEqual(state);
  expect(preview.warnings.some(w=>w.includes('instantanés'))).toBe(true);
 });
 it('accepte les exports bruts introduits au lot A',()=>{const state=richState();expect(previewImport(JSON.stringify(state)).backup.state).toEqual(state);});
 it('refuse un JSON illisible, tronqué ou une racine incorrecte',()=>{for(const raw of ['{','null','[]','"texte"','{"schemaVersion":1}'])expect(()=>previewImport(raw)).toThrow();});
 it('refuse une version inconnue du document ou du carnet',()=>{
  expect(()=>validateBackup({...createBackup(read()),version:999})).toThrow(/version/);
  expect(()=>validateState({...read(),schemaVersion:999})).toThrow(/version/);
 });
 it('refuse les champs inconnus et les sauvegardes incomplètes',()=>{
  const full=createBackup(read());for(const field of Object.keys(full)){const partial={...full} as Record<string,unknown>;delete partial[field];expect(()=>validateBackup(partial)).toThrow();}
  expect(()=>validateState({...read(),surprise:true})).toThrow(/inconnu/);
 });
 it('détecte même les doublons d’UUID strictement identiques',()=>{const s=read();s.events.push(structuredClone(s.events[0]));expect(()=>validateState(s)).toThrow(/dupliqué/);});
 it('détecte un doublon d’UUID malgré une différence de casse',()=>{const s=read();s.events.push({...s.events[0],id:s.events[0].id.toUpperCase()});expect(()=>validateState(s)).toThrow(/dupliqué/);});
 it('refuse un fichier trop volumineux avant de le parser',()=>{expect(()=>previewImport(' '.repeat(MAX_BACKUP_BYTES+1))).toThrow(/10 Mo/);});
 it.each(['hier','2026-02-30T12:00:00.000Z','2026-13-01T00:00:00.000Z','2026-10-01'])('refuse la date %s',date=>{
  const s=read();s.events[0].occurredAt=date;expect(()=>validateState(s)).toThrow(/date/);
 });
 it('refuse un UUID invalide ou un autre utilisateur',()=>{
  const s=read();expect(()=>validateState({...s,userId:'personne'})).toThrow(/UUID/);
  s.events[0].userId=crypto.randomUUID();expect(()=>validateState(s)).toThrow(/autre utilisateur/);
 });
 it('refuse les références, clés ou doublons de versets invalides',()=>{
  for(const progress of [{'1:1':[32]},{'67:1':[1]},{'1:1:2':[1]},{'1:1':[1,1]}])expect(()=>validateState({...emptyState(),progress})).toThrow();
  const s=read();s.events[0].chapter=51;expect(()=>validateState(s)).toThrow(/référence/);
 });
 it('refuse une correction sans cible ou concernant un verset absent de sa cible',()=>{
  const s=richState();s.events.at(-1)!.cancellations![0].eventId=crypto.randomUUID();expect(()=>validateState(s)).toThrow(/cible/);
  const other=richState();other.events.at(-1)!.cancellations![0].verses=[31];expect(()=>validateState(other)).toThrow();
 });
 it('refuse une progression incohérente, un contexte lot A manquant ou un mauvais référentiel',()=>{
  const s=read();expect(()=>validateState({...s,progress:{'1:1':[2]}})).toThrow(/progression/);
  const noContext={...s};delete noContext.legacyContext;expect(()=>validateState(noContext)).toThrow(/contexte/);
  expect(()=>validateBackup({...createBackup(s),reference:'inconnu'})).toThrow(/référentiel/);
 });
 it('refuse des annulations portées par une lecture et des préférences invalides',()=>{
  const s=read();s.events[0].cancellations=[];expect(()=>validateState(s)).toThrow(/annulation/);
  expect(()=>createBackup(read(),{lastPassage:{bookId:1,chapter:51}})).toThrow();
 });
 it('ne modifie pas l’objet validé et ne retourne pas de références partagées',()=>{
  const original=createBackup(richState());const copy=structuredClone(original);const validated=validateBackup(original);
  validated.state.events[0].verses.push(30);expect(original).toEqual(copy);
 });
});

let factory:IDBFactory,name:string,repo:IndexedDBReadingRepository;
function req<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function seedLegacy(state:ReadingState){
 const open=factory.open(name,1);open.onupgradeneeded=()=>open.result.createObjectStore('state');const db=await req(open);
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,'current');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
}
async function inspect(store:string,key?:IDBValidKey){
 const db=await req(factory.open(name));try{return await req(key===undefined?db.transaction(store).objectStore(store).getAll():db.transaction(store).objectStore(store).get(key));}finally{db.close();}
}
beforeEach(()=>{factory=new IDBFactory();name=`test-${crypto.randomUUID()}`;repo=new IndexedDBReadingRepository(name,factory);});
afterEach(()=>vi.restoreAllMocks());

describe('Migration IndexedDB réelle sur simulateur standard',()=>{
 it('migre la phase 1 sans réécrire ni supprimer l’original et conserve UUID/dates/ordre',async()=>{
  const original=demoState();await seedLegacy(original);expect(await repo.load()).toEqual(original);
  expect(await inspect('state','current')).toEqual(original);expect((await inspect('events')).length).toBe(original.events.length);
  const recoveries=await repo.listRecoveries();expect(recoveries).toHaveLength(1);expect(recoveries[0].backup.state).toEqual(original);
  expect((await inspect('metadata','current')).storageVersion).toBe(STORAGE_VERSION);
 });
 it('migre également un état du lot A et conserve toutes les corrections et relectures',async()=>{
  const original=richState();await seedLegacy(original);expect(await repo.load()).toEqual(original);expect(await repo.readEvents(original.userId)).toEqual(original.events);
 });
 it('réouvre sans doubler les événements ni recommencer la migration',async()=>{
  const original=demoState();await seedLegacy(original);await repo.load();
  repo=new IndexedDBReadingRepository(name,factory);expect(await repo.load()).toEqual(original);await repo.load();
  expect((await inspect('events')).length).toBe(original.events.length);expect(await repo.listRecoveries()).toHaveLength(1);
 });
 it('refuse un ancien état invalide, sans suppression ni marqueur de réussite',async()=>{
  const original=demoState();original.events.push(structuredClone(original.events[0]));await seedLegacy(original);
  await expect(repo.load()).rejects.toThrow(/dupliqué/);expect(await inspect('state','current')).toEqual(original);
  expect(await inspect('metadata','current')).toBeUndefined();expect(await inspect('events')).toEqual([]);
 });
 it('annule une migration interrompue puis la reprend sans doublon',async()=>{
  const original=richState();await seedLegacy(original);const add=IDBObjectStore.prototype.add;let count=0;
  const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
   if(this.name==='events'&&++count===2)throw new Error('Interruption simulée');return add.apply(this,args);
  });
  await expect(repo.load()).rejects.toThrow(/Interruption/);spy.mockRestore();
  expect(await inspect('state','current')).toEqual(original);expect(await inspect('events')).toEqual([]);expect(await inspect('recoveries')).toEqual([]);
  expect(await repo.load()).toEqual(original);expect(await repo.listRecoveries()).toHaveLength(1);
 });
 it('signale un ancien onglet bloquant puis migre après sa fermeture',async()=>{
  const original=read();await seedLegacy(original);const oldConnection=await req(factory.open(name,1));
  await expect(repo.load()).rejects.toThrow(/bloquée/);oldConnection.close();
  expect(await repo.load()).toEqual(original);expect(await repo.listRecoveries()).toHaveLength(1);
 });
});

describe('Repository incrémental, transactions et restauration',()=>{
 it('conserve les données et préférences après réouverture',async()=>{
  const state=richState();await repo.save(state);await repo.savePreferences({activePlan:'canonical',lastPassage:{bookId:1,chapter:1,verse:3}});
  const reopened=new IndexedDBReadingRepository(name,factory);
  expect(await reopened.load()).toEqual(state);expect((await reopened.loadPreferences()).lastPassage?.verse).toBe(3);
 });
 it('ajoute seulement les nouveaux événements sans réécrire les anciens',async()=>{
  const initial=read();await repo.save(initial);const add=vi.spyOn(IDBObjectStore.prototype,'add');const put=vi.spyOn(IDBObjectStore.prototype,'put');
  const next=read(initial,[2]);expect(await repo.save(next)).toEqual(next);
  expect((add.mock.contexts as unknown as IDBObjectStore[]).filter(store=>store.name==='events')).toHaveLength(1);
  expect((put.mock.contexts as unknown as IDBObjectStore[]).some(store=>store.name==='events')).toBe(false);
 });
 it('rend un nouvel envoi identique idempotent mais refuse une collision d’UUID',async()=>{
  const initial=read();await repo.save(initial);const next=read(initial,[2]);const addition=next.events.at(-1)!;
  await repo.appendEvents(initial.userId,[addition]);await repo.appendEvents(initial.userId,[addition]);
  expect(await repo.readEvents(initial.userId)).toHaveLength(2);
  await expect(repo.appendEvents(initial.userId,[{...addition,occurredAt:'2026-01-01T00:00:00.000Z'}])).rejects.toThrow(/Conflit/);
  expect(await repo.load()).toEqual(next);
 });
 it('reconstruit la progression effective après lecture, relecture et correction',async()=>{
  const initial=read();await repo.save(initial);let next=read(initial,[1,2]);next=correctValidation(next,next.events[1].id,[2]);
  const stored=await repo.appendEvents(initial.userId,next.events.slice(initial.events.length));
  expect(stored.progress).toEqual(effectiveReading(next).progress);expect(await repo.load()).toEqual(next);
  expect(await repo.reconstructProgress(initial.userId)).toEqual(next.progress);
 });
 it('annule tout le lot si la seconde écriture échoue',async()=>{
  const initial=read();await repo.save(initial);const next=read(initial,[1,2]);const add=IDBObjectStore.prototype.add;let count=0;
  const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
   if(this.name==='events'&&++count===2)throw new Error('Écriture interrompue');return add.apply(this,args);
  });
  await expect(repo.save(next)).rejects.toThrow(/interrompue/);spy.mockRestore();
  expect(await repo.load()).toEqual(initial);expect((await inspect('events')).length).toBe(1);
 });
 it('annule également les écritures précédentes sur une erreur IndexedDB asynchrone',async()=>{
  const initial=read();await repo.save(initial);const next=read(initial,[1,2]);const add=IDBObjectStore.prototype.add;let count=0;
  const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
   if(this.name==='events'&&++count===2){const row=args[0] as {id:string};return add.call(this,{...row,id:initial.events[0].id});}
   return add.apply(this,args);
  });
  await expect(repo.save(next)).rejects.toThrow();spy.mockRestore();expect(await repo.load()).toEqual(initial);
  expect((await inspect('events')).length).toBe(1);
 });
 it('refuse une sauvegarde périmée provenant d’un autre onglet',async()=>{
  const initial=read();await repo.save(initial);const current=read(initial,[2]);await repo.save(current);
  await expect(repo.save(read(initial,[3]))).rejects.toThrow(/autre onglet/);expect(await repo.load()).toEqual(current);
 });
 it('prévisualise sans modifier le stockage et exige une confirmation explicite',async()=>{
  const initial=read();await repo.save(initial);const preview=repo.previewImport(JSON.stringify(createBackup(richState())));
  expect(await repo.load()).toEqual(initial);
  await expect(repo.restore(preview.backup,{confirmed:false,expectedState:initial})).rejects.toThrow(/confirmée/);expect(await repo.load()).toEqual(initial);
 });
 it('refuse une restauration invalide et ne crée aucune récupération superflue',async()=>{
  const initial=read();await repo.save(initial);const invalid={...createBackup(richState()),version:99} as unknown as BackupDocument;
  await expect(repo.restore(invalid,{confirmed:true,expectedState:initial})).rejects.toThrow();
  expect(await repo.load()).toEqual(initial);expect(await repo.listRecoveries()).toEqual([]);
 });
 it('remplace transactionnellement et conserve une copie préalable téléchargeable avec préférences',async()=>{
  const initial=read();await repo.save(initial);await repo.savePreferences({activePlan:'canonical'});const imported=richState();
  const result=await repo.restore(createBackup(imported,{lastPassage:{bookId:2,chapter:1}}),{confirmed:true,expectedState:initial});
  expect(result.recovery?.backup.state).toEqual(initial);expect(result.recovery?.backup.preferences).toEqual({activePlan:'canonical'});
  expect(await repo.load()).toEqual(imported);expect((await repo.loadPreferences()).lastPassage?.bookId).toBe(2);
  expect((await inspect('events')).length).toBe(initial.events.length+imported.events.length);
  expect(previewImport(JSON.stringify(result.recovery!.backup)).backup).toEqual(result.recovery!.backup);
 });
 it('annule la restauration si la copie préalable échoue',async()=>{
  const initial=read();await repo.save(initial);const add=IDBObjectStore.prototype.add;
  const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
   if(this.name==='recoveries')throw new Error('Quota de récupération atteint');return add.apply(this,args);
  });
  await expect(repo.restore(createBackup(richState()),{confirmed:true,expectedState:initial})).rejects.toThrow(/Quota/);spy.mockRestore();
  expect(await repo.load()).toEqual(initial);expect(await repo.listRecoveries()).toEqual([]);
 });
 it('conserve aussi le carnet initial si l’écriture du nouveau échoue après sa copie préalable',async()=>{
  const initial=read();await repo.save(initial);const add=IDBObjectStore.prototype.add;
  const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
   if(this.name==='events')throw new Error('Quota événements atteint');return add.apply(this,args);
  });
  await expect(repo.restore(createBackup(richState()),{confirmed:true,expectedState:initial})).rejects.toThrow(/Quota/);spy.mockRestore();
  expect(await repo.load()).toEqual(initial);expect(await repo.listRecoveries()).toEqual([]);
 });
 it('refuse une restauration si les données ont changé depuis sa prévisualisation',async()=>{
  const initial=read();await repo.save(initial);const changed=read(initial,[2]);await repo.save(changed);
  await expect(repo.restore(createBackup(richState()),{confirmed:true,expectedState:initial})).rejects.toThrow(/changé/);expect(await repo.load()).toEqual(changed);
 });
 it('permet de restaurer une ancienne copie après un remplacement',async()=>{
  const initial=read();await repo.save(initial);const imported=richState();
  const result=await repo.restore(createBackup(imported),{confirmed:true,expectedState:initial});
  await repo.restore(result.recovery!.backup,{confirmed:true,expectedState:imported});expect(await repo.load()).toEqual(initial);
 });
 it('préserve la démonstration lors du démarrage d’un carnet personnel',async()=>{
  const demo=demoState();await repo.save(demo);const personal=emptyState();await repo.save(personal);
  expect(await repo.load()).toEqual(personal);expect((await repo.listRecoveries())[0].backup.state).toEqual(demo);
 });
 it('exporte le carnet complet stocké et permet un aller-retour via la restauration',async()=>{
  const original=richState();await repo.save(original);const backup=await repo.exportBackup();const preview=repo.previewImport(JSON.stringify(backup));
  await repo.restore(preview.backup,{confirmed:true,expectedState:original});expect(await repo.load()).toEqual(original);
 });
 it('restaure sur une base vierge sans inventer de carnet antérieur',async()=>{
  const original=richState();const result=await repo.restore(createBackup(original),{confirmed:true,expectedState:null});
  expect(result.recovery).toBeNull();expect(await repo.load()).toEqual(original);
 });
 it('ne modifie rien à la suite d’un JSON invalide ou d’un lot dupliqué',async()=>{
  const original=read();await repo.save(original);expect(()=>repo.previewImport('{')).toThrow();
  const next=read(original,[2]).events.at(-1)!;
  await expect(repo.appendEvents(original.userId,[next,next])).rejects.toThrow(/dupliqués/);
  expect(await repo.load()).toEqual(original);
 });
});
