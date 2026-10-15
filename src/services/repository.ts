import type {ReadingRepository,ReadingState} from '../domain/models';
export class IndexedDBReadingRepository implements ReadingRepository {
 private async db(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('bible-tracker',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async load(){const db=await this.db();try{return await new Promise<ReadingState|null>((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});}finally{db.close();}}
 async save(state:ReadingState){const db=await this.db();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
}
