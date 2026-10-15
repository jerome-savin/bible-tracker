import type {BackupDocument,ReadingEvent,ReadingPreferences,ReadingRepository,ReadingState,RecoveryBackup} from '../domain/models';
import {effectiveReading} from '../domain/reading';
import {createBackup,previewImport,sameData,validateBackup,validatePreferences,validateState} from './backups';

export const STORAGE_VERSION=2;
const STORES=['state','metadata','events','preferences','recoveries'];
type StoredState=Omit<ReadingState,'events'>;
interface Metadata {storageVersion:2; datasetId:string; revision:number; state:StoredState}
interface EventRow {datasetId:string; id:string; sequence:number; event:ReadingEvent}

function request<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??new Error('Requête IndexedDB refusée.'));});}
async function atomic<T>(db:IDBDatabase,stores:string[],mode:IDBTransactionMode,work:(tx:IDBTransaction)=>Promise<T>):Promise<T>{
 const tx=db.transaction(stores,mode);
 const complete=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Transaction annulée, aucune modification appliquée.'));tx.onerror=()=>{/* onabort porte le résultat final */};});
 // Installer immédiatement un gestionnaire, même si une requête échoue avant l'attente finale.
 void complete.catch(()=>{});
 try{const value=await work(tx);await complete;return value;}
 catch(error){try{tx.abort();}catch{/* transaction déjà terminée */}await complete.catch(()=>{});throw error;}
}
function withoutEvents(state:ReadingState):StoredState {const {events:_,...metadata}=state;return metadata;}

/** Aucune API React/DOM : cet adaptateur pourra être remplacé par un repository distant. */
export class IndexedDBReadingRepository implements ReadingRepository {
 constructor(private readonly name='bible-tracker',private readonly factory:IDBFactory=indexedDB){}

 private async connect():Promise<IDBDatabase>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const r=this.factory.open(this.name,STORAGE_VERSION);
   let blocked=false;
   r.onblocked=()=>{blocked=true;reject(new Error('Mise à jour bloquée : fermez les autres onglets de Bible Tracker puis réessayez.'));};
   r.onupgradeneeded=()=>{
    const db=r.result;
    for(const name of ['state','metadata','preferences','recoveries'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name);
    if(!db.objectStoreNames.contains('events')){const store=db.createObjectStore('events',{keyPath:['datasetId','id']});store.createIndex('datasetId','datasetId');}
   };
   r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};
   r.onerror=()=>reject(r.error??new Error('Impossible d’ouvrir le stockage local.'));
  });
  try{
   await atomic(db,STORES,'readwrite',async tx=>{
    if(await request(tx.objectStore('metadata').get('current')))return;
    const legacy=await request(tx.objectStore('state').get('current'));
    if(legacy===undefined)return;
    // Toute erreur laisse l'original intact et ne crée aucun marqueur de migration.
    const state=validateState(legacy);
    await this.recovery(tx,state,{},'migration');
    await this.insertDataset(tx,state,{});
   });
   return db;
  }catch(error){db.close();throw error;}
 }

 private async run<T>(mode:IDBTransactionMode,work:(tx:IDBTransaction)=>Promise<T>):Promise<T>{
  const db=await this.connect();try{return await atomic(db,STORES,mode,work);}finally{db.close();}
 }
 private async metadata(tx:IDBTransaction):Promise<Metadata|undefined>{return request(tx.objectStore('metadata').get('current'));}
 private async state(tx:IDBTransaction,meta:Metadata):Promise<ReadingState>{
  const rows=await request(tx.objectStore('events').index('datasetId').getAll(meta.datasetId)) as EventRow[];
  rows.sort((a,b)=>a.sequence-b.sequence);
  return validateState({...meta.state,events:rows.map(row=>row.event)});
 }
 private async preferences(tx:IDBTransaction,meta:Metadata):Promise<ReadingPreferences>{return validatePreferences(await request(tx.objectStore('preferences').get(meta.datasetId))??{});}
 private async insertDataset(tx:IDBTransaction,state:ReadingState,preferences:ReadingPreferences):Promise<void>{
  const datasetId=crypto.randomUUID();
  for(let sequence=0;sequence<state.events.length;sequence++){
   const event=state.events[sequence];await request(tx.objectStore('events').add({datasetId,id:event.id,sequence,event} satisfies EventRow));
  }
  await request(tx.objectStore('preferences').put(preferences,datasetId));
  await request(tx.objectStore('metadata').put({storageVersion:2,datasetId,revision:0,state:withoutEvents(state)} satisfies Metadata,'current'));
 }
 private async recovery(tx:IDBTransaction,state:ReadingState,preferences:ReadingPreferences,reason:RecoveryBackup['reason']):Promise<RecoveryBackup>{
  const createdAt=new Date().toISOString();const recovery:RecoveryBackup={id:crypto.randomUUID(),createdAt,reason,backup:createBackup(state,preferences,new Date(createdAt))};
  await request(tx.objectStore('recoveries').add(recovery,recovery.id));return recovery;
 }
 private async append(tx:IDBTransaction,meta:Metadata,current:ReadingState,events:ReadingEvent[]):Promise<ReadingState>{
  if(new Set(events.map(e=>e.id)).size!==events.length)throw new Error('Le lot contient des UUID dupliqués.');
  const known=new Map(current.events.map(e=>[e.id,e]));const additions:ReadingEvent[]=[];
  for(const event of events){
   const previous=known.get(event.id);
   if(previous){if(!sameData(previous,event))throw new Error('Conflit : un UUID existant porte un événement différent.');continue;}
   if(event.modelVersion!==2)throw new Error('Les nouveaux événements doivent utiliser le modèle du lot A.');
   additions.push(event);
  }
  if(!additions.length)return current;
  const candidate={...current,legacyContext:current.legacyContext??{progress:structuredClone(current.progress)},events:[...current.events,...additions]};
  const next=validateState({...candidate,progress:effectiveReading(candidate).progress});
  for(let i=0;i<additions.length;i++){
   const event=additions[i];await request(tx.objectStore('events').add({datasetId:meta.datasetId,id:event.id,sequence:current.events.length+i,event} satisfies EventRow));
  }
  await request(tx.objectStore('metadata').put({...meta,revision:meta.revision+1,state:withoutEvents(next)},'current'));
  return next;
 }

 async load():Promise<ReadingState|null>{return this.run('readonly',async tx=>{const meta=await this.metadata(tx);return meta?this.state(tx,meta):null;});}

 async save(input:ReadingState):Promise<ReadingState>{
  const incoming=validateState(input);
  return this.run('readwrite',async tx=>{
   const meta=await this.metadata(tx);
   if(!meta){await this.insertDataset(tx,incoming,{});return incoming;}
   const current=await this.state(tx,meta);
   if(current.demo&&!incoming.demo&&incoming.userId!==current.userId&&incoming.events.length===0&&Object.keys(incoming.progress).length===0){
    await this.recovery(tx,current,await this.preferences(tx,meta),'nouveau-carnet');await this.insertDataset(tx,incoming,{});return incoming;
   }
   if(incoming.userId!==current.userId||incoming.demo!==current.demo)throw new Error('Un autre carnet est actif. Rechargez la page.');
   if(incoming.events.length<current.events.length||current.events.some((event,i)=>!sameData(event,incoming.events[i])))throw new Error('Le carnet a changé dans un autre onglet. Rechargez avant de réessayer.');
   if(!sameData(incoming.legacyContext??{progress:incoming.progress},current.legacyContext??{progress:current.progress}))throw new Error('Le contexte historique ne peut pas être remplacé par une simple sauvegarde.');
   const next=await this.append(tx,meta,current,incoming.events.slice(current.events.length));
   if(!sameData(next,incoming))throw new Error('État incohérent : utilisez la restauration pour remplacer un carnet.');
   return next;
  });
 }
 async appendEvents(userId:string,events:ReadingEvent[]):Promise<ReadingState>{return this.run('readwrite',async tx=>{
  const meta=await this.metadata(tx);if(!meta||meta.state.userId!==userId)throw new Error('Utilisateur actif introuvable.');
  return this.append(tx,meta,await this.state(tx,meta),structuredClone(events));
 });}
 async readEvents(userId:string):Promise<ReadingEvent[]>{const state=await this.load();if(!state||state.userId!==userId)throw new Error('Utilisateur actif introuvable.');return state.events;}
 async reconstructProgress(userId:string):Promise<Record<string,number[]>>{
  const state=await this.load();if(!state||state.userId!==userId)throw new Error('Utilisateur actif introuvable.');
  return effectiveReading(state).progress;
 }
 async loadPreferences():Promise<ReadingPreferences>{return this.run('readonly',async tx=>{const meta=await this.metadata(tx);return meta?this.preferences(tx,meta):{};});}
 async savePreferences(input:ReadingPreferences):Promise<void>{const preferences=validatePreferences(input);await this.run('readwrite',async tx=>{
  const meta=await this.metadata(tx);if(!meta)throw new Error('Aucun carnet enregistré.');await request(tx.objectStore('preferences').put(preferences,meta.datasetId));
 });}
 async exportBackup(fallback?:ReadingState):Promise<BackupDocument>{return this.run('readonly',async tx=>{
  const meta=await this.metadata(tx);if(meta)return createBackup(await this.state(tx,meta),await this.preferences(tx,meta));
  if(fallback)return createBackup(fallback);throw new Error('Aucun carnet à exporter.');
 });}
 previewImport(json:string){return previewImport(json);}
 async restore(input:BackupDocument,options:{confirmed:boolean;expectedState:ReadingState|null}){
  if(options.confirmed!==true)throw new Error('La restauration doit être explicitement confirmée.');
  const backup=validateBackup(input);
  return this.run('readwrite',async tx=>{
   const meta=await this.metadata(tx);const current=meta?await this.state(tx,meta):null;
   if(!sameData(current,options.expectedState))throw new Error('Le carnet a changé depuis la prévisualisation. Rechargez et recommencez.');
   const recovery=current&&meta?await this.recovery(tx,current,await this.preferences(tx,meta),'restauration'):null;
   // Nouveau jeu de données : aucun ancien événement ni ancien jeu n'est supprimé.
   await this.insertDataset(tx,backup.state,backup.preferences);
   return {state:backup.state,recovery};
  });
 }
 async listRecoveries():Promise<RecoveryBackup[]>{return this.run('readonly',async tx=>{
  const backups=await request(tx.objectStore('recoveries').getAll()) as RecoveryBackup[];
  return backups.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
 });}
}
