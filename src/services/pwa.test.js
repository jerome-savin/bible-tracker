import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {renderWorker} from '../../scripts/build-pwa.mjs';

const template=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8');
const resources=['/index.html','/assets/main.js','/assets/Reading.js','/assets/Statistics.js','/assets/Settings.css','/icon-192.png'];
function worker(release='new'){
 const listeners={},stores=new Map();
 const fetch=vi.fn(async request=>new Response(typeof request==='string'?request:request.url));
 const caches={
  async open(name){
   if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
   return {async addAll(paths){const responses=await Promise.all(paths.map(path=>fetch(path)));paths.forEach((path,i)=>store.set(path,responses[i]));},async match(path){return store.get(path);}};
  },async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}
 };
 const self={location:{origin:'https://example.test'},clients:{claim:vi.fn(async()=>{})},skipWaiting:vi.fn(async()=>{}),addEventListener(type,fn){listeners[type]=fn;}};
 runInNewContext(renderWorker(template,resources,release),{self,caches,fetch,URL});
 async function dispatch(type,extra={}){let pending;listeners[type]({...extra,waitUntil(promise){pending=promise;}});await pending;}
 function request(path,extra={}){let response;listeners.fetch({request:{url:new URL(path,self.location.origin).href,method:'GET',mode:'cors',...extra},respondWith(value){response=value;}});return response;}
 return {stores,caches,self,fetch,dispatch,request};
}

describe('Précache et cycle de vie PWA',()=>{
 it('génère un worker versionné et refuse un shell incomplet',()=>{
  expect(renderWorker(template,resources,'a')).not.toBe(renderWorker(template,resources,'b'));
  expect(()=>renderWorker(template,['/index.html'],'a')).toThrow();
  expect(()=>renderWorker(template,['/assets/main.js'],'a')).toThrow();
 });
 it('précache toutes les pages différées avant de déclarer l’installation réussie',async()=>{
  const w=worker();await w.dispatch('install');expect([...w.stores.get('bible-tracker-shell-new').keys()]).toEqual([...resources].sort());
  expect(w.self.skipWaiting).not.toHaveBeenCalled();
 });
 it('laisse l’ancienne version disponible si une ressource manque',async()=>{
  const w=worker();w.stores.set('bible-tracker-shell-old',new Map());w.fetch.mockRejectedValueOnce(new Error('asset absent'));
  await expect(w.dispatch('install')).rejects.toThrow('asset absent');expect(w.stores.has('bible-tracker-shell-old')).toBe(true);expect(w.self.skipWaiting).not.toHaveBeenCalled();
 });
 it('sert un chapitre et des pages non visitées sans réseau',async()=>{
  const w=worker();await w.dispatch('install');w.fetch.mockRejectedValue(new Error('hors ligne'));
  expect(await (await w.request('/lecture?livre=1&chapitre=3',{mode:'navigate'})).text()).toBe('/index.html');
  expect(await (await w.request('/assets/Statistics.js')).text()).toBe('/assets/Statistics.js');
  expect(await (await w.request('/assets/Settings.css')).text()).toBe('/assets/Settings.css');
 });
 it('ne prend jamais en charge les liens JW externes ou les requêtes d’écriture',async()=>{
  const w=worker();expect(w.request('https://www.jw.org/finder?bible=01003001')).toBeUndefined();expect(w.request('/lecture',{method:'POST'})).toBeUndefined();
 });
 it('ne nettoie que ses propres caches, en gardant le build précédent',async()=>{
  const w=worker();for(const name of ['autre-application','bible-tracker-v1','bible-tracker-shell-ancien','bible-tracker-shell-old'])w.stores.set(name,new Map());
  await w.dispatch('install');await w.dispatch('activate');
  expect([...w.stores.keys()]).toEqual(['autre-application','bible-tracker-shell-old','bible-tracker-shell-new']);expect(w.self.clients.claim).toHaveBeenCalledOnce();
  expect(template).not.toMatch(/indexedDB\s*\.|deleteDatabase/);
 });
 it('sert encore un asset du build précédent à un ancien onglet hors ligne',async()=>{
  const w=worker();w.stores.set('bible-tracker-shell-old',new Map([['/assets/ancien.js',new Response('ancienne version')]]));await w.dispatch('install');w.fetch.mockRejectedValue(new Error('offline'));
  expect(await (await w.request('/assets/ancien.js')).text()).toBe('ancienne version');
 });
 it('n’active une mise à jour anticipée que sur demande explicite',async()=>{
  const w=worker();await w.dispatch('install');expect(w.self.skipWaiting).not.toHaveBeenCalled();
  await w.dispatch('message',{data:{type:'SKIP_WAITING'}});expect(w.self.skipWaiting).toHaveBeenCalledOnce();
 });
 it('confirme au client la version entièrement installée',async()=>{
  const w=worker('v42'),postMessage=vi.fn();await w.dispatch('install');await w.dispatch('message',{data:{type:'STATUS'},ports:[{postMessage}]});
  expect(postMessage).toHaveBeenCalledWith({type:'PWA_STATUS',build:'v42',ready:true});
 });
 it('ne déclare pas l’interface prête si le cache a été évincé',async()=>{
  const w=worker(),postMessage=vi.fn();await w.dispatch('install');w.stores.get('bible-tracker-shell-new').delete('/assets/Statistics.js');
  await w.dispatch('message',{data:{type:'STATUS'},ports:[{postMessage}]});expect(postMessage).toHaveBeenCalledWith({type:'PWA_STATUS',build:'new',ready:false});
 });
});
