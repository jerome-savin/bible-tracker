import {NavLink,Link} from 'react-router-dom';
import {BookOpen,House,ChartNoAxesCombined} from 'lucide-react';
export default function Navigation({readingUrl}:{readingUrl:string}){
 const items=[['/','Accueil',House],[readingUrl,'Lecture',BookOpen],['/statistiques','Statistiques',ChartNoAxesCombined]] as const;
 return <aside><Link className="brand" to="/" aria-label="Au fil des pages — Accueil"><span className="brand-icon"><BookOpen/></span><span>Au fil des pages</span></Link><nav aria-label="Navigation principale">{items.map(([url,label,Icon])=><NavLink key={label} to={url} end={url==='/'} aria-label={label} title={label}><Icon size={20} aria-hidden="true"/><span>{label}</span></NavLink>)}</nav></aside>;
}
