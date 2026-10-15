export function jwLink(bookId:number,chapter:number,start:number,end:number){
 const code=(v:number)=>`${String(bookId).padStart(2,'0')}${String(chapter).padStart(3,'0')}${String(v).padStart(3,'0')}`;
 return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=F&prefer=lang&bible=${code(start)}-${code(end)}&pub=nwtsty`;
}
