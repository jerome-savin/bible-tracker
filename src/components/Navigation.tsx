import {NavLink,Link} from 'react-router-dom';
import {BookOpen,House,Route,ChartNoAxesCombined,Settings,Leaf} from 'lucide-react';
export default function Navigation({readingUrl}:{readingUrl:string}){
 const items=[['/','Accueil',House],[readingUrl,'Ma lecture',BookOpen],['/parcours','Parcours',Route],['/statistiques','Statistiques',ChartNoAxesCombined],['/parametres','Paramètres',Settings]] as const;
 return <aside><Link className="brand" to="/" aria-label="Au fil des pages — Accueil"><span className="brand-icon"><BookOpen/></span><span>Au fil des pages<small>MON CARNET BIBLIQUE</small></span></Link><p className="nav-label">MON ESPACE</p><nav aria-label="Navigation principale">{items.map(([url,label,Icon])=><NavLink key={label} to={url} end={url==='/'} aria-label={label} title={label}><Icon size={20} aria-hidden="true"/><span>{label}</span></NavLink>)}</nav><div className="sidebar-note"><Leaf size={23}/><p>Un peu chaque jour,<br/>un chemin qui grandit.</p><small>À votre rythme, tout simplement.</small></div><div className="local"><span/> Données conservées sur cet appareil</div></aside>;
}
