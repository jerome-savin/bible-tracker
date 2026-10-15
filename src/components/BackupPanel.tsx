import {useEffect,useRef,useState} from 'react';
import type {BackupDocument,BackupPreview,ReadingRepository,ReadingState,RecoveryBackup} from '../domain/models';
import {MAX_BACKUP_BYTES,sameData,serializeBackup} from '../services/backups';
import './backup-panel.css';

function download(backup:BackupDocument,prefix='bible-tracker'){
 const url=URL.createObjectURL(new Blob([serializeBackup(backup)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=`${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const messageOf=(error:unknown)=>error instanceof Error?error.message:'Opération impossible. Les données existantes sont conservées.';

/** Ajout fonctionnel du lot B, sans refonte de la page Paramètres. */
export default function BackupPanel({repository,state,onRestored}:{repository:ReadingRepository;state:ReadingState;onRestored:(state:ReadingState)=>void}){
 const [preview,setPreview]=useState<BackupPreview|null>(null);
 const [expected,setExpected]=useState<ReadingState|null>(null);
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [recoveries,setRecoveries]=useState<RecoveryBackup[]>([]);
 const fileRef=useRef<HTMLInputElement>(null);
 const selection=useRef(0);
 useEffect(()=>{repository.listRecoveries().then(setRecoveries).catch(error=>setMessage(messageOf(error)));},[repository]);

 async function selectFile(file:File|undefined){
  const version=++selection.current;setPreview(null);setConfirmed(false);setMessage('');
  if(!file)return;
  setBusy(true);
  try{
   if(file.size>MAX_BACKUP_BYTES)throw new Error('Ce fichier dépasse la limite de 10 Mo.');
   const next=repository.previewImport(await file.text());
   const current=await repository.load();
   if(version!==selection.current)return;
   if(current&&!sameData(current,state))throw new Error('Le carnet a changé. Rechargez la page avant de restaurer.');
   setExpected(current);setPreview(next);
  }catch(error){if(version===selection.current)setMessage(messageOf(error));}
  finally{if(version===selection.current)setBusy(false);}
 }
 async function restore(){
  if(!preview||!confirmed)return;
  setBusy(true);setMessage('');
  try{
   const result=await repository.restore(preview.backup,{confirmed,expectedState:expected});
   onRestored(result.state);setPreview(null);setConfirmed(false);
   if(fileRef.current)fileRef.current.value='';
   setMessage('Restauration terminée. Le carnet précédent reste disponible dans les copies de récupération.');
   // Ne pas transformer une erreur d'affichage des copies en échec de restauration.
   try{setRecoveries(await repository.listRecoveries());}catch{if(result.recovery)setRecoveries(old=>[result.recovery!,...old]);}
  }catch(error){setMessage(messageOf(error));}
  finally{setBusy(false);}
 }
 return <section className="backup-panel" aria-labelledby="backup-title">
  <h2 id="backup-title">Sauvegarde et restauration</h2>
  <p>Exportez un carnet complet, avec ses lectures, relectures, corrections et préférences.</p>
  <button disabled={busy} onClick={async()=>{try{download(await repository.exportBackup(state));setMessage('Sauvegarde préparée pour le téléchargement.');}catch(error){setMessage(messageOf(error));}}}>Exporter mon carnet JSON</button>
  <p><label htmlFor="backup-file">Choisir une sauvegarde JSON à prévisualiser (10 Mo maximum)</label></p>
  <input ref={fileRef} id="backup-file" type="file" accept=".json,application/json" disabled={busy} onChange={e=>void selectFile(e.target.files?.[0])}/>
  {message&&<p role="status" aria-live="polite">{message}</p>}
  {preview&&<div className="card" aria-label="Prévisualisation de la restauration">
   <h3>Contenu du fichier — aucune restauration effectuée</h3>
   <p>{preview.summary.verses} versets validés · {preview.summary.events} événements : {preview.summary.readings} lectures, {preview.summary.rereadings} relectures, {preview.summary.corrections} corrections.</p>
   <p>Carnet {preview.summary.demo?'de démonstration':'personnel'} · format {preview.source==='phase-1'?'ancien export phase 1':'de sauvegarde version 2'}.</p>
   <p>Identité du carnet : {preview.summary.userId}</p>
   {preview.warnings.length>0&&<ul>{preview.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
   <p>La restauration remplacera le carnet actif sur cet appareil. Une copie complète de l’état enregistré sera conservée automatiquement avant le remplacement ; si sa sauvegarde échoue, la restauration sera annulée.</p>
   <button className="secondary" disabled={busy} onClick={async()=>{try{download(await repository.exportBackup(state),'avant-restauration');}catch(error){setMessage(messageOf(error));}}}>Télécharger mon carnet actuel avant remplacement</button>
   <p><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> Je confirme le remplacement de mon carnet par cette sauvegarde.</label></p>
   <button disabled={busy||!confirmed} onClick={()=>void restore()}>Confirmer et restaurer ce carnet</button>{' '}
   <button className="secondary" disabled={busy} onClick={()=>{selection.current++;setPreview(null);setConfirmed(false);if(fileRef.current)fileRef.current.value='';}}>Annuler</button>
  </div>}
  {recoveries.length>0&&<details><summary>Copies de récupération ({recoveries.length})</summary>
   <p>Ces copies restent sur cet appareil. Téléchargez-en une puis sélectionnez son fichier ci-dessus pour la restaurer avec confirmation.</p>
   {recoveries.map(r=><p key={r.id}><button className="secondary" disabled={busy} onClick={()=>{try{download(r.backup,'recuperation-bible-tracker');}catch(error){setMessage(messageOf(error));}}}>Télécharger la copie du {new Date(r.createdAt).toLocaleString('fr-FR')} — {r.reason}</button></p>)}
  </details>}
 </section>;
}
