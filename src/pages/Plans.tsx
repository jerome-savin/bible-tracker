import {Link} from 'react-router-dom';
import {Route} from 'lucide-react';
import {plans} from '../data/demo';
import Heading from '../components/Heading';
export default function Plans(){return <><Heading title="Choisissez votre chemin" text="L’ordre biblique classique utilise votre progression commune."/><div className="lower-grid">{plans.map(p=><article className="card" key={p.id}><Route/><h2>{p.name}</h2><p>{p.status==='available'?'Les 66 livres, de la Genèse à la Révélation.':'Passages entrelacés : référentiel chronologique à intégrer et vérifier dans une prochaine phase.'}</p>{p.status==='available'?<Link className="button" to="/">Reprendre au premier verset non lu</Link>:<span className="badge">À venir</span>}</article>)}</div></>;}
