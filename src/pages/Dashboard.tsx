import {useState} from 'react';
import {Link} from 'react-router-dom';
import books from '../data/books.json';
import type {ReadingState} from '../domain/models';
import {metrics,nextUnread,record} from '../domain/reading';
import {passageUrl} from '../services/passageNavigation';
import type {ChangeReading} from '../services/readingActions';
import JwLinks from '../components/JwLinks';

export default function Dashboard({state,change,busy}:{state:ReadingState;change:ChangeReading;busy:boolean}){
 const m=metrics(state,books),next=nextUnread(state,books);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const passage=next?{bookId:next.bookId,chapter:next.chapter,verse:next.start,end:next.end}:null;
 async function mark(){
  if(!next)return;const segment=next;setError('');setMessage('');
  try{await change(current=>{const read=current.progress[`${segment.bookId}:${segment.chapter}`]??[];const verses=segment.verses.filter(v=>!read.includes(v));return verses.length?record(current,{bookId:segment.bookId,chapter:segment.chapter,verses},'lecture'):current;});setMessage('Lecture enregistrée.');}
  catch{setError('Lecture non enregistrée. Réessayez. Si un autre onglet est ouvert, rechargez cette page.');}
 }
 return <section className="simple-home"><h1>Ma progression</h1><div className="home-progress"><strong>{m.percent.toLocaleString('fr-FR',{maximumFractionDigits:1})} %</strong><div className="track" role="progressbar" aria-label="Progression biblique" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.percent}><i style={{width:`${m.percent}%`}}/></div></div>
  {next&&passage?<article className="card next-reading"><p>Prochaine lecture</p><h2>{books[next.bookId-1].name} {next.chapter}:{next.start}{next.end!==next.start?`–${next.end}`:''}</h2><JwLinks passage={passage} label="Ouvrir JW Library"/><button disabled={busy} onClick={()=>void mark()}>Marquer comme lu</button><Link className="text-button" to={passageUrl(passage)}>Continuer dans la Bible</Link></article>:<article className="card"><h2>Toute la Bible est parcourue.</h2><Link to="/lecture">Parcourir la Bible</Link></article>}
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
 </section>;
}
