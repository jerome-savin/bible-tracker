import {useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import books from '../data/books.json';
import type {ReadingPreferences,ReadingState} from '../domain/models';
import {keyOf} from '../domain/reading';
import {adjacentChapter,parsePassage,passageUrl,type ViewedPassage} from '../services/passageNavigation';
import {markChapter,toggleVerse,type ChangeReading} from '../services/readingActions';
import JwLinks from '../components/JwLinks';
interface Props {state:ReadingState;change:ChangeReading;busy:boolean;lastPassage?:ReadingPreferences['lastPassage'];onVisit:(passage:NonNullable<ReadingPreferences['lastPassage']>)=>void}
export default function Reading(props:Props){
 const location=useLocation(),navigate=useNavigate(),parsed=parsePassage(location.search,props.lastPassage);
 const canonical='passage' in parsed?passageUrl(parsed.passage):null;
 useEffect(()=>{if(canonical&&'explicit' in parsed&&!parsed.explicit)navigate(canonical,{replace:true});},[canonical,navigate,'explicit' in parsed&&parsed.explicit]);
 if('error' in parsed)return <><h1>Ce passage est introuvable</h1><p role="alert">Vérifiez le livre et le chapitre.</p><Link className="button" to="/lecture?livre=1&chapitre=1">Ouvrir Genèse 1</Link></>;
 return <Reader key={canonical} {...props} passage={parsed.passage}/>;
}
function Reader({state,change,busy,onVisit,passage}:Props&{passage:ViewedPassage}){
 const navigate=useNavigate(),{bookId,chapter}=passage,book=books[bookId-1],max=book.chapters[chapter-1];
 const read=state.progress[keyOf(bookId,chapter)]??[],previous=adjacentChapter(passage,-1),following=adjacentChapter(passage,1);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{onVisit({bookId,chapter,...(passage.verse?{verse:passage.verse}:{})});},[bookId,chapter,passage.verse,onVisit]);
 async function toggle(verse:number){
  setError('');setMessage('');let removing=false;
  try{const saved=await change(current=>{removing=(current.progress[keyOf(bookId,chapter)]??[]).includes(verse);return toggleVerse(current,bookId,chapter,verse);});
   const kept=(saved.progress[keyOf(bookId,chapter)]??[]).includes(verse);
   setMessage(removing?(kept?'Ce verset reste lu : une autre lecture est encore enregistrée. Touchez-le à nouveau pour la retirer.':'Verset marqué non lu.'):'Verset marqué lu.');
  }catch{setError('Modification non enregistrée. Réessayez. Si un autre onglet est ouvert, rechargez cette page.');}
 }
 async function chapterAction(reread=false){
  setError('');setMessage('');
  try{await change(current=>markChapter(current,bookId,chapter,reread));setMessage(reread?'Relecture enregistrée.':'Chapitre marqué lu.');}
  catch{setError('Lecture non enregistrée. Réessayez. Si un autre onglet est ouvert, rechargez cette page.');}
 }
 return <section className="simple-reading"><h1>{book.name} {chapter}</h1><div className="passage-controls"><label>Livre<select disabled={busy} value={bookId} onChange={e=>navigate(passageUrl({bookId:Number(e.target.value),chapter:1}))}>{books.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Chapitre<select disabled={busy} value={chapter} onChange={e=>navigate(passageUrl({bookId,chapter:Number(e.target.value)}))}>{book.chapters.map((_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div>
  <div className="chapter-navigation"><button className="secondary" disabled={busy||!previous} onClick={()=>previous&&navigate(passageUrl(previous))}><ArrowLeft size={17}/>Précédent</button><button className="secondary" disabled={busy||!following} onClick={()=>following&&navigate(passageUrl(following))}>Suivant<ArrowRight size={17}/></button></div>
  <JwLinks passage={{...passage,verse:passage.verse??1,end:passage.end??(passage.verse??max)}} label="Ouvrir JW Library"/>
  <p className="reading-count">{read.length} / {max} versets lus</p>
  <div className="verse-grid" aria-label="Versets">{Array.from({length:max},(_,i)=>i+1).map(v=><button key={v} disabled={busy} aria-label={`Verset ${v}, ${read.includes(v)?'lu':'non lu'}`} aria-pressed={read.includes(v)} aria-current={passage.verse===v?'location':undefined} className={read.includes(v)?'complete':''} onClick={()=>void toggle(v)}>{v}{read.includes(v)&&<span className="verse-check" aria-hidden="true">✓</span>}</button>)}</div>
  <div className="reading-actions"><button disabled={busy||read.length===max} onClick={()=>void chapterAction()}>Tout marquer comme lu</button><button className="secondary" disabled={busy||read.length!==max} onClick={()=>void chapterAction(true)}>Relire ce chapitre</button></div>
  {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
 </section>;
}
