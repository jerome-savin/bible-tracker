import {Link} from 'react-router-dom';
import {BookOpen,Check,ChevronRight,CalendarDays,Flame,Target} from 'lucide-react';
import books from '../data/books.json';
import type {ReadingState} from '../domain/models';
import {metrics,nextUnread} from '../domain/reading';
import {passageUrl} from '../services/passageNavigation';
import JwLinks from '../components/JwLinks';

export default function Dashboard({state}:{state:ReadingState}){
 const m=metrics(state,books);const next=nextUnread(state,books);
 const passage=next?{bookId:next.bookId,chapter:next.chapter,verse:next.start,end:next.end}:null;
 return <>
  <div className="page-heading"><div><p className="eyebrow">UN MOMENT POUR L’ESSENTIEL</p><h1>Chaque lecture est un pas.</h1><p>Retrouvez votre fil, et continuez à votre rythme.</p></div><span className="date"><CalendarDays size={17}/>{new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span></div>
  <section className="hero"><div><span className="pill"><span/>{next?'VOTRE PROCHAINE LECTURE':'VOTRE PARCOURS EST TERMINÉ'}</span>
   {next&&passage?<><h2>{books[next.bookId-1].name} {next.chapter}</h2><p>Versets {next.start} à {next.end} · Ordre biblique classique</p><p className="hero-description">Voici le premier segment qui reste à découvrir.<br/>Son ouverture ne valide aucun verset.</p><div className="hero-actions"><Link className="button" to={passageUrl(passage)}>Continuer ma lecture <ChevronRight size={18}/></Link></div><JwLinks passage={passage} label="Ouvrir le prochain segment dans JW Library"/></>:
    <><h2>Toute la Bible est parcourue.</h2><p className="hero-description">Vous pouvez revenir librement sur un passage.<br/>Vos prochaines lectures seront conservées comme relectures.</p><Link className="button" to="/lecture">Choisir un passage à relire <ChevronRight size={18}/></Link></>}
  </div><div className="book-art" aria-hidden="true"><div className="halo"/><BookOpen strokeWidth={0.8}/><span>une page à la fois</span></div></section>
  <div className="section-title"><h2>Votre chemin jusqu’ici</h2><span>Chaque pas compte.</span></div>
  <div className="stats-grid"><article className="card progress-card"><span className="stat-icon"><BookOpen size={19}/></span><span>Progression unique de la Bible</span><strong>{m.percent.toLocaleString('fr-FR',{maximumFractionDigits:1})}<small> %</small></strong><div className="track"><i style={{width:`${m.percent}%`}}/></div><small>{m.verses.toLocaleString('fr-FR')} / {m.total.toLocaleString('fr-FR')} versets distincts</small></article><article className="card"><span className="stat-icon green"><Check size={19}/></span><span>Chapitres terminés</span><strong>{m.chapters}<small> / 1 189</small></strong><small>Un chapitre, une nouvelle découverte.</small></article><article className="card"><span className="stat-icon amber"><Flame size={19}/></span><span>Votre régularité</span><strong>{m.days7}<small> jours sur 7</small></strong><small>{m.days30} jours actifs sur les 30 derniers jours</small></article></div>
  <div className="lower-grid"><article className="card"><div className="section-title"><h2>Une habitude qui prend racine</h2><span>7 derniers jours</span></div><div className="week">{m.activity.slice(-7).map((d,i)=><div key={d.label}><span className={d.active?'day active':'day'} aria-label={d.active?'Jour avec lecture':'Jour sans lecture'}>{d.active?<Check size={19}/>:<span/>}</span><small>{['J−6','J−5','J−4','J−3','J−2','Hier','Auj.'][i]}</small></div>)}</div><p className="muted">L’important, c’est de revenir. Même pour quelques versets.</p></article><article className="card goal"><span className="stat-icon"><Target size={20}/></span><h2>La Bible en une année</h2><p>Un repère pour vous accompagner : environ {Math.ceil(m.total/365)} versets par jour.</p><p>Votre rythme unique : {m.pace.toLocaleString('fr-FR',{maximumFractionDigits:1})} nouveaux versets par jour.<br/>{m.finish?`Fin indicative : ${m.finish.toLocaleDateString('fr-FR')}.`:next?'Encore un peu d’observation avant une estimation de fin.':'Parcours terminé.'}</p><Link to="/statistiques">Découvrir mon rythme <ChevronRight size={16}/></Link></article></div>
 </>;
}
