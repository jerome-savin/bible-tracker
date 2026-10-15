import type {ReadingState} from '../domain/models';
import {metrics} from '../domain/reading';
import books from '../data/books.json';
export default function Statistics({state}:{state:ReadingState}){
 const m=metrics(state,books);
 return <section className="simple-statistics"><h1>Ma progression</h1><div className="simple-stats">
  <article className="card"><h2>Bible lue</h2><strong>{m.percent.toLocaleString('fr-FR',{maximumFractionDigits:1})} %</strong></article>
  <article className="card"><h2>Chapitres terminés</h2><strong>{m.chapters.toLocaleString('fr-FR')}</strong></article>
  <article className="card"><h2>Jours de lecture</h2><strong>{m.days30} / 30</strong><p>{m.days7} sur les 7 derniers jours</p></article>
  <article className="card"><h2>Fin estimée</h2><p className="stat-value">{m.finish?m.finish.toLocaleDateString('fr-FR'):m.projectionStatus==='terminée'?'Bible terminée':'Encore un peu de lecture pour l’estimer'}</p></article>
 </div><details><summary>Mon rythme</summary><p>{m.verses.toLocaleString('fr-FR')} versets lus · {m.activityVerses.toLocaleString('fr-FR')} versets lus ou relus ces 30 derniers jours.</p><p>{m.pace.toLocaleString('fr-FR',{maximumFractionDigits:1})} nouveaux versets par jour. Pour lire la Bible en un an, environ {Math.ceil(m.total/365)} versets par jour, à votre rythme.</p></details></section>;
}
