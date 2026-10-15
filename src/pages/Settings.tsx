import {useState} from 'react';
import type {ReadingState,ReadingRepository} from '../domain/models';
import {emptyState} from '../data/demo';
import BackupPanel from '../components/BackupPanel';
export default function Settings({state,repository,save,onRestored,busy}:{state:ReadingState;repository:ReadingRepository;save:(state:ReadingState)=>Promise<ReadingState>;onRestored:(state:ReadingState)=>void;busy:boolean}){
 const [error,setError]=useState('');
 return <section className="settings"><h1>Paramètres</h1><article className="card"><h2>Mon carnet</h2><p>{state.demo?'Les lectures affichées sont fictives.':'Vos lectures sont conservées sur cet appareil.'}</p>{state.demo&&<button disabled={busy} onClick={async()=>{try{const saved=await save(emptyState());onRestored(saved);setError('');}catch{setError('Carnet non créé. Réessayez.');}}}>Commencer mon carnet</button>}{error&&<p role="alert">{error}</p>}
 <details><summary>Avancé</summary><h2>Sauvegarder mes données</h2><BackupPanel repository={repository} state={state} onRestored={onRestored}/><h2>À propos des références</h2><p>La numérotation complète de l’édition NWT reste à vérifier.</p><a href="https://github.com/bkuhl/bible-verse-counts-per-chapter" target="_blank" rel="noreferrer">Source du référentiel</a></details>
 <details><summary>Installer l’application</summary><p>Android : menu du navigateur → Installer l’application. iPad : Safari → Partager → Sur l’écran d’accueil.</p><p>Attendez « Interface prête hors connexion » avant de couper le réseau. Le texte biblique reste dans JW Library.</p></details></article></section>;
}
