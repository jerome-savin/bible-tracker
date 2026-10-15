import {ArrowUpRight} from 'lucide-react';
import {jwLink,jwWebChapterLink} from '../services/jw';
import type {ViewedPassage} from '../services/passageNavigation';
export default function JwLinks({passage,label='Ouvrir dans JW Library'}:{passage:ViewedPassage;label?:string}){
 const start=passage.verse??1;const end=passage.end??start;
 return <div className="jw-links"><a className="external-link" href={jwLink(passage.bookId,passage.chapter,start,end)} target="_blank" rel="noreferrer">{label}<ArrowUpRight size={17}/></a><details><summary>Si JW Library ne s’ouvre pas</summary><p>Le navigateur peut afficher jw.org à la place de l’application. Vous pouvez lire le chapitre dans la bibliothèque en ligne ci-dessous, ou rechercher cette référence dans JW Library. L’ouverture sur iPad reste à vérifier sur un appareil réel.</p><a href={jwWebChapterLink(passage.bookId,passage.chapter)} target="_blank" rel="noreferrer">Voir le chapitre dans le navigateur <ArrowUpRight size={15}/></a></details></div>;
}
