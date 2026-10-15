import {useEffect,useRef,useState} from 'react';
import {observePwa,type PwaState} from '../services/pwa';
export default function PwaStatus({busy}:{busy:boolean}){
 const [status,setStatus]=useState<PwaState>({offline:false,ready:false,waiting:null,changedElsewhere:false,error:''});
 const observer=useRef<ReturnType<typeof observePwa>|null>(null);
 useEffect(()=>{observer.current=observePwa(setStatus,import.meta.env.PROD,__PWA_RELEASE__);return()=>observer.current?.dispose();},[]);
 if(!import.meta.env.PROD)return null;
 return <section className="pwa-status" aria-label="État de l’application"><p role="status">{status.offline?'Hors connexion · ':''}{status.ready?'Interface prête hors connexion.':status.error?'Mode hors connexion non confirmé.':'Préparation du mode hors connexion…'} Le texte biblique reste dans JW Library.</p>
 {(status.waiting||status.changedElsewhere)&&<div className="update-notice"><p>{status.changedElsewhere?'Une nouvelle version a été activée dans un autre onglet.':'Une nouvelle version est prête.'} Les sélections non validées seront perdues au rechargement ; vos lectures enregistrées sont conservées.</p><button disabled={busy} onClick={()=>observer.current?.update()}>Mettre à jour et recharger</button></div>}
 {status.error&&<p role="status">{status.error}</p>}<button className="text-button" disabled={busy||status.offline} onClick={()=>void observer.current?.check()}>Rechercher une mise à jour</button></section>;
}
