import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';

export function renderWorker(template,paths,release) {
 if(!paths.includes('/index.html')||!paths.some(p=>p.endsWith('.js')))throw new Error('Le précache PWA ne contient pas le shell complet.');
 return template.replace("'__BUILD_ID__'",JSON.stringify(release)).replace('/*__PRECACHE__*/[]',JSON.stringify([...new Set(paths)].sort()));
}
/** @returns {import('vite').Plugin} */
export function pwaPlugin(release) {
 let config;
 return {name:'bible-tracker-pwa',apply:'build',configResolved(c){config=c;},closeBundle(){
  const out=resolve(config.root,config.build.outDir);
  function files(dir){return readdirSync(dir).flatMap(name=>{const path=resolve(dir,name);return statSync(path).isDirectory()?files(path):[path];});}
  const paths=files(out).filter(path=>/\.(html|js|css|svg|png|webmanifest)$/.test(path)&&relative(out,path)!=='sw.js').map(path=>'/'+relative(out,path).replaceAll('\\','/'));
  for(const required of ['/icon-192.png','/icon-512.png','/icon-maskable-512.png','/apple-touch-icon.png','/manifest.webmanifest'])if(!paths.includes(required))throw new Error(`Ressource PWA absente : ${required}`);
  const worker=renderWorker(readFileSync(resolve(config.root,'public/sw.js'),'utf8'),paths,release);
  writeFileSync(resolve(out,'sw.js'),worker);
  writeFileSync(resolve(out,'pwa-build.json'),JSON.stringify({release,resources:paths.sort(),digest:createHash('sha256').update(worker).digest('hex')},null,2));
 }};
}
