import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link,Route,Routes,useLocation} from 'react-router-dom';
import type {ReadingPreferences,ReadingRepository,ReadingState} from '../domain/models';
import {demoState} from '../data/demo';
import {readingRepository} from '../services/readingRepository';
import {passageUrl} from '../services/passageNavigation';
import Navigation from '../components/Navigation';
import PwaStatus from '../components/PwaStatus';
import Dashboard from './Dashboard';
import {createReadingWriter} from '../services/readingActions';
const Reading=lazy(()=>import('./Reading'));
const Statistics=lazy(()=>import('./Statistics'));
const Settings=lazy(()=>import('./Settings'));
const Plans=lazy(()=>import('./Plans'));

export default function App({repository=readingRepository}:{repository?:ReadingRepository}){
 const [state,setState]=useState<ReadingState|null>(null),[preferences,setPreferences]=useState<ReadingPreferences>({});
 const [error,setError]=useState(''),[preferenceError,setPreferenceError]=useState(''),[busy,setBusy]=useState(false);
 const prefs=useRef<ReadingPreferences>({}),queue=useRef(Promise.resolve()),epoch=useRef(0);
 const location=useLocation();
 const current=useRef<ReadingState|null>(null);
 const change=useMemo(()=>createReadingWriter(()=>{
  if(!current.current)throw new Error('Carnet indisponible.');return current.current;
 },async next=>{const saved=await repository.save(next);current.current=saved;setState(saved);return saved;},setBusy),[repository]);
 useEffect(()=>{
  let active=true;
  void (async()=>{try{
   let loadedState=await repository.load();if(!active)return;
   // Sur un nouvel appareil seulement : démonstration identifiée, stable et mémorisable.
   if(!loadedState)loadedState=await repository.save(demoState());
   const loaded=await repository.loadPreferences();if(!active)return;
   current.current=loadedState;prefs.current=loaded;setPreferences(loaded);setState(loadedState);setError('');
  }catch(e){if(active)setError(`${e instanceof Error?e.message:'Stockage local indisponible.'} Les données existantes sont conservées.`);}})();
  return()=>{active=false;};
 },[repository]);
 useEffect(()=>{document.querySelector<HTMLElement>('#main-content')?.focus();},[location.pathname]);
 async function save(next:ReadingState){return change(()=>next);}
 const visit=useCallback((passage:NonNullable<ReadingPreferences['lastPassage']>)=>{
  const generation=epoch.current;const next={...prefs.current,lastPassage:passage};prefs.current=next;setPreferences(next);
  queue.current=queue.current.catch(()=>{}).then(async()=>{if(generation!==epoch.current)return;await repository.savePreferences(next);setPreferenceError('');}).catch(e=>setPreferenceError(`Dernier passage non mémorisé : ${e instanceof Error?e.message:'écriture indisponible'}`));
 },[repository]);
 function restored(next:ReadingState){
  epoch.current++;current.current=next;setState(next);prefs.current={};setPreferences({});setPreferenceError('');
  void repository.loadPreferences().then(loaded=>{prefs.current=loaded;setPreferences(loaded);}).catch(()=>setPreferenceError('Les préférences n’ont pas pu être rechargées.'));
 }
 if(!state)return <main className="loading" role="status">{error||'Ouverture de votre carnet…'}</main>;
 const readingUrl=preferences.lastPassage?passageUrl(preferences.lastPassage):'/lecture';
 return <><a className="skip-link" href="#main-content">Aller au contenu</a><div className="shell"><Navigation readingUrl={readingUrl}/><div className="workspace"><header><span>Au fil des pages</span><details className="secondary-menu" key={location.pathname}><summary>Menu</summary><nav aria-label="Menu secondaire"><Link to="/parcours">Parcours</Link><Link to="/parametres">Paramètres</Link></nav></details></header><main id="main-content" tabIndex={-1}>
  {state.demo&&<div className="demo">Mode démonstration · Les lectures affichées sont fictives. <Link to="/parametres">Commencer mon carnet</Link></div>}
  {preferenceError&&<p className="error" role="alert">{preferenceError}</p>}
  <Suspense fallback={<p role="status">Ouverture de cet espace…</p>}><Routes>
   <Route path="/" element={<Dashboard state={state} change={change} busy={busy}/>}/>
   <Route path="/lecture" element={<Reading state={state} change={change} busy={busy} lastPassage={preferences.lastPassage} onVisit={visit}/>}/>
   <Route path="/statistiques" element={<Statistics state={state}/>}/>
   <Route path="/parametres" element={<Settings state={state} repository={repository} save={save} onRestored={restored} busy={busy}/>}/>
   <Route path="/parcours" element={<Plans/>}/>
   <Route path="*" element={<><h1>Cette page n’existe pas</h1><Link to="/">Retour à l’accueil</Link></>}/>
  </Routes></Suspense>
  <PwaStatus busy={busy} expanded={location.pathname==='/parametres'}/>
 </main></div></div></>;
}
