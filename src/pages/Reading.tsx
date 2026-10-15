import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Check} from 'lucide-react';
import books from '../data/books.json';
import type {ReadingPreferences,ReadingState} from '../domain/models';
import {correctValidation,effectiveReading,keyOf,nextUnread,record,selectRange,status} from '../domain/reading';
import {adjacentChapter,parsePassage,passageUrl,type ViewedPassage} from '../services/passageNavigation';
import {jwLink} from '../services/jw';
import Heading from '../components/Heading';
import JwLinks from '../components/JwLinks';

interface Props {
 state:ReadingState;save:(state:ReadingState)=>Promise<ReadingState>;busy:boolean;
 lastPassage?:ReadingPreferences['lastPassage'];onVisit:(passage:NonNullable<ReadingPreferences['lastPassage']>)=>void;
}
export default function Reading(props:Props){
 const location=useLocation(),navigate=useNavigate();const parsed=parsePassage(location.search,props.lastPassage);
 const canonical='passage' in parsed?passageUrl(parsed.passage):null;
 useEffect(()=>{if(canonical&&'explicit' in parsed&&!parsed.explicit)navigate(canonical,{replace:true});},[canonical,navigate,'explicit' in parsed&&parsed.explicit]);
 if('error' in parsed)return <><Heading title="Ce passage est introuvable" text={parsed.error}/><p role="alert">Votre progression n’a pas été modifiée.</p><Link className="button" to="/lecture?livre=1&chapitre=1">Ouvrir Genèse 1</Link><Link className="text-button" to="/">Retour à l’accueil</Link></>;
 return <Reader key={canonical} {...props} passage={parsed.passage}/>;
}

function Reader({state,save,busy,onVisit,passage}:Props&{passage:ViewedPassage}){
 const navigate=useNavigate();const {bookId,chapter}=passage;const book=books[bookId-1],max=book.chapters[chapter-1];
 const read=state.progress[keyOf(bookId,chapter)]??[];
 const [selected,setSelected]=useState<number[]>(()=>passage.verse?selectRange(passage.verse,passage.end??passage.verse,max):[]);
 const [start,setStart]=useState(String(passage.verse??1)),[end,setEnd]=useState(String(passage.end??passage.verse??1));
 const [pending,setPending]=useState<{kind:'lecture'|'correction';verses:number[];target:string}|null>(null);
 const [target,setTarget]=useState('latest'),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const effective=useMemo(()=>effectiveReading(state),[state]);
 const next=useMemo(()=>nextUnread(state,books),[state]);
 const currentContributions=effective.contributions.filter(c=>c.event.bookId===bookId&&c.event.chapter===chapter);
 const previous=adjacentChapter(passage,-1),following=adjacentChapter(passage,1);
 useEffect(()=>{onVisit({bookId,chapter,...(passage.verse?{verse:passage.verse}:{})});},[bookId,chapter,passage.verse,onVisit]);
 const selectedSorted=[...selected].sort((a,b)=>a-b);
 const correctionVerses=target==='latest'?selectedSorted.filter(v=>read.includes(v)):selectedSorted.filter(v=>currentContributions.find(c=>c.event.id===target)?.verses.has(v));
 function select(values:number[]){setSelected(values);setPending(null);setError('');setSuccess('');}
 function prepare(kind:'lecture'|'correction',verses=selectedSorted){
  const affected=kind==='correction'?correctionVerses:verses;
  if(!affected.length){setError('Sélectionnez au moins un verset concerné par cette action.');return;}
  setPending({kind,verses:affected,target});setError('');setSuccess('');
 }
 async function confirm(){
  if(!pending)return;setError('');
  try{
   const p={bookId,chapter,verses:pending.verses};
   const nextState=pending.kind==='lecture'?record(state,p,'lecture',max):pending.target==='latest'?
    record(state,{...p,verses:read.filter(v=>!pending.verses.includes(v))},'correction',max):correctValidation(state,pending.target,pending.verses);
   const stored=await save(nextState);
   const kept=pending.verses.filter(v=>(stored.progress[keyOf(bookId,chapter)]??[]).includes(v)).length;
   setSuccess(pending.kind==='correction'?`Correction enregistrée.${kept?` ${kept} verset(s) restent validés par d’autres lectures.`:''}`:'Lecture enregistrée. Votre progression et votre historique sont sauvegardés.');
   setSelected([]);setPending(null);
  }catch(e){setError(`${e instanceof Error?e.message:'Enregistrement impossible.'} La sélection est conservée ; aucune validation n’a été appliquée.`);}
 }
 const pendingNew=pending?.verses.filter(v=>!read.includes(v)).length??0;
 return <><Heading title="Un chapitre à la fois" text="Lisez dans JW Library, puis retrouvez ici le fil de votre progression."/>
  <div className="reading-layout"><article className="card book-list"><h2>Votre passage</h2>
   <label htmlFor="book">Livre</label><select id="book" disabled={busy} value={bookId} onChange={e=>navigate(passageUrl({bookId:Number(e.target.value),chapter:1}))}>{books.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
   <label htmlFor="chapter">Chapitre</label><select id="chapter" disabled={busy} value={chapter} onChange={e=>navigate(passageUrl({bookId,chapter:Number(e.target.value)}))}>{book.chapters.map((_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select>
   <div className="chapter-navigation"><button className="secondary" disabled={busy||!previous} onClick={()=>previous&&navigate(passageUrl(previous))}><ArrowLeft size={16}/> Précédent</button><button className="secondary" disabled={busy||!following} onClick={()=>following&&navigate(passageUrl(following))}>Suivant <ArrowRight size={16}/></button></div>
   <details className="chapter-picker"><summary>Tous les chapitres de {book.name}</summary><div className="chapter-grid">{book.chapters.map((n,i)=>{const value=status(state.progress[keyOf(bookId,i+1)]??[],n);return <button key={i} disabled={busy} aria-label={`Chapitre ${i+1}, ${value}`} aria-pressed={chapter===i+1} className={`${chapter===i+1?'chosen':''} ${value==='terminé'?'complete':value==='partiellement lu'?'partial':''}`} onClick={()=>navigate(passageUrl({bookId,chapter:i+1}))}>{i+1}</button>;})}</div></details>
   <p className="muted">Le dernier passage consulté est mémorisé. « Continuer ma lecture » sur l’Accueil reprend, lui, au premier verset non lu.</p>
  </article><article className="card verse-panel"><div className="section-title"><div><p className="eyebrow">VOTRE LECTURE</p><h2>{book.name} {chapter}</h2></div><span className="badge">{read.length} / {max} versets</span></div><div className="track" role="progressbar" aria-label="Progression du chapitre" aria-valuemin={0} aria-valuemax={max} aria-valuenow={read.length}><i style={{width:`${read.length/max*100}%`}}/></div>
   {passage.verse&&<p className="selection-notice">Passage ouvert : {book.name} {chapter}:{passage.verse}{passage.end&&passage.end!==passage.verse?`–${passage.end}`:''}. Les versets sont mis en évidence, sans validation automatique.</p>}
   <JwLinks passage={{bookId,chapter,verse:selected.length?Math.min(...selected):1,end:selected.length?Math.max(...selected):max}} label="Lire le passage sélectionné dans JW Library"/>
   <p className="muted">Sans sélection : chapitre entier. Une sélection discontinue ouvre la plage allant du premier au dernier verset choisi.</p>
   {next&&<a className="text-button" href={jwLink(next.bookId,next.chapter,next.start,next.end)} target="_blank" rel="noreferrer">Prochain segment non lu : {books[next.bookId-1].name} {next.chapter}:{next.start}–{next.end}</a>}
   <h3>Quels versets avez-vous lus ?</h3><p className="verse-legend"><span>○ Non lu</span><span>✓ Déjà lu</span><span>● Sélectionné</span></p>
   <div className="range"><label>De<input aria-label="Premier verset" type="number" min="1" max={max} disabled={busy} value={start} onChange={e=>setStart(e.target.value)}/></label><label>à<input aria-label="Dernier verset" type="number" min="1" max={max} disabled={busy} value={end} onChange={e=>setEnd(e.target.value)}/></label><button disabled={busy} onClick={()=>{try{select(selectRange(Number(start),Number(end),max));}catch{setError(`Choisissez une plage valide entre 1 et ${max}.`);}}}>Sélectionner</button></div>
   <div className="verse-grid" aria-label="Sélection des versets">{Array.from({length:max},(_,i)=>i+1).map(v=><button key={v} disabled={busy} aria-label={`Verset ${v}, ${read.includes(v)?'déjà lu':'non lu'}`} aria-pressed={selected.includes(v)} className={`${read.includes(v)?'complete':''} ${selected.includes(v)?'chosen':''}`} onClick={()=>select(selected.includes(v)?selected.filter(n=>n!==v):[...selected,v])}><span>{v}</span>{read.includes(v)&&<span className="verse-check" aria-hidden="true">✓</span>}</button>)}</div>
   <div className="reading-actions"><button disabled={busy||!selected.length} onClick={()=>prepare('lecture')}><Check size={17}/> {selected.length&&selected.every(v=>read.includes(v))?'Préparer une relecture':'Préparer la validation'}</button><button className="secondary" disabled={busy} onClick={()=>{const all=selectRange(1,max,max);select(all);prepare('lecture',all);}}>Valider le chapitre entier</button><button className="text-button" disabled={busy||!selected.length} onClick={()=>select([])}>Effacer la sélection</button></div>
   <details className="correction-panel"><summary>Corriger une validation erronée</summary><p>Les corrections restent dans l’audit et ne créent pas de jour de lecture. Une autre validation active peut maintenir les mêmes versets lus.</p><label htmlFor="correction-target">Validation concernée</label><select id="correction-target" disabled={busy} value={target} onChange={e=>{setTarget(e.target.value);setPending(null);}}><option value="latest">Dernière validation active de chaque verset sélectionné</option>{currentContributions.filter(c=>c.verses.size>0).map(c=><option key={c.event.id} value={c.event.id}>{new Date(c.event.occurredAt).toLocaleString('fr-FR')} · {c.event.kind==='relecture'?'Relecture':'Lecture'} · {c.verses.size} verset(s) effectif(s) · {c.event.id.slice(0,8)}</option>)}</select><button className="secondary" disabled={busy||!correctionVerses.length} onClick={()=>prepare('correction')}>Préparer la correction des versets sélectionnés</button></details>
   {pending&&<section className="confirmation-card" aria-label="Récapitulatif avant enregistrement"><h3>{pending.kind==='correction'?'Correction à confirmer':pendingNew===0?'Relecture à confirmer':pendingNew===pending.verses.length?'Nouvelle lecture à confirmer':'Lecture et relecture à confirmer'}</h3><p>{book.name} {chapter} · versets {pending.verses.join(', ')}</p><p>{pending.kind==='correction'?`${pending.verses.length} verset(s) à neutraliser dans la validation choisie ; l’audit est conservé.`:`${pendingNew} nouveau(x) verset(s), ${pending.verses.length-pendingNew} verset(s) relu(s). Les relectures n’accélèrent pas la projection de première lecture.`}</p><button disabled={busy} onClick={()=>void confirm()}>{busy?'Enregistrement…':pending.kind==='correction'?'Confirmer la correction':'Confirmer la lecture'}</button>{' '}<button className="secondary" disabled={busy} onClick={()=>setPending(null)}>Annuler cette action</button></section>}
   {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
   <details><summary>Historique de ce chapitre</summary>{state.events.filter(e=>e.bookId===bookId&&e.chapter===chapter).slice().reverse().map(e=>{const remaining=currentContributions.find(c=>c.event.id===e.id)?.verses.size??0;return <p key={e.id}>{new Date(e.occurredAt).toLocaleString('fr-FR')} · {e.kind==='correction'?(e.modelVersion===2?`Correction de ${e.verses.length} verset(s)`:`Correction ancienne : ${e.verses.length} verset(s) conservé(s)`):`${e.kind==='relecture'?'Relecture':'Lecture'} de ${e.verses.length} verset(s) · ${remaining} effectif(s)${remaining===0?' · annulée':''}`}</p>;})}</details>
  </article></div></>;
}
