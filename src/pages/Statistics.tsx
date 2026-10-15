import {ResponsiveContainer,BarChart,Bar,XAxis,Tooltip} from 'recharts';
import type {ReadingState} from '../domain/models';
import {metrics} from '../domain/reading';
import books from '../data/books.json';
import Heading from '../components/Heading';
export default function Statistics({state}:{state:ReadingState}){
 const m=metrics(state,books);
 return <><Heading title="Votre lecture en perspective" text="Des repères pour avancer sereinement."/>
  <div className="stats-grid"><article className="card"><span>Progression unique actuelle</span><strong>{m.verses.toLocaleString('fr-FR')}</strong><small>versets distincts validés, corrections appliquées</small></article><article className="card"><span>Activité réelle sur 30 jours</span><strong>{m.activityVerses.toLocaleString('fr-FR')}</strong><small>versets lus et relus, validations annulées exclues</small></article><article className="card"><span>Rythme de progression unique</span><strong>{m.pace.toLocaleString('fr-FR',{maximumFractionDigits:1})}</strong><small>nouveaux versets par jour sur {m.observedDays} jours observés, au plus 30 jours ; relectures exclues</small></article></div>
  <div className="lower-grid"><article className="card"><h2>Fin estimée au rythme actuel</h2><p className="stat-value">{m.finish?m.finish.toLocaleDateString('fr-FR'):m.projectionStatus==='terminée'?'Parcours terminé':'Données encore insuffisantes'}</p><p>La projection utilise uniquement la nouvelle progression. Elle demande au moins sept jours d’observation et deux jours de progression unique.</p></article><article className="card"><h2>Régularité</h2><p className="stat-value">{m.days7} / 7 jours · {m.days30} / 30 jours</p><p>Une journée de correction seule n’ajoute pas d’activité.</p></article></div>
  <article className="card chart"><h2>Vos jours de lecture</h2><p>Lecture ou relecture effective ; une journée ne compte qu’une fois.</p><ResponsiveContainer width="100%" height={230}><BarChart data={m.activity}><XAxis dataKey="label" tick={{fontSize:11}} interval={5}/><Tooltip formatter={(v)=>[v?'Lecture enregistrée':'Pas de lecture','Activité']}/><Bar dataKey="active" fill="#796397" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer><details><summary>Consulter les jours sous forme de liste</summary><ul>{m.activity.map(d=><li key={d.label}>{d.label} : {d.active?'lecture ou relecture':'aucune lecture enregistrée'}</li>)}</ul></details></article>
 </>;
}
