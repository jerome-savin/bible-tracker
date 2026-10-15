/* Remplacés lors du build : toutes les pages différées sont précachées. */
const BUILD_ID='__BUILD_ID__';
const PRECACHE=/*__PRECACHE__*/[];
const PREFIX='bible-tracker-shell-';
const CACHE=PREFIX+BUILD_ID;

self.addEventListener('install',event=>{
 // Si un fichier manque, l'installation échoue : l'ancien worker reste utilisable.
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='STATUS')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const ready=(await Promise.all(PRECACHE.map(path=>cache.match(path)))).every(Boolean);
  event.ports?.[0]?.postMessage({type:'PWA_STATUS',build:BUILD_ID,ready});
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  // Garder le build précédent pour les autres onglets. Ne jamais toucher à IndexedDB.
  const own=(await caches.keys()).filter(key=>key.startsWith(PREFIX));
  const previous=own.filter(key=>key!==CACHE).at(-1);
  await Promise.all(own.filter(key=>key!==CACHE&&key!==previous).map(key=>caches.delete(key)));
  await caches.delete('bible-tracker-v1');
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(request.mode==='navigate'){
   // Une coque cohérente par build, jusqu'à la mise à jour explicitement acceptée.
   return await cache.match('/index.html')||fetch(request);
  }
  if(PRECACHE.includes(url.pathname))return await cache.match(url.pathname)||fetch(request);
  if(url.pathname.startsWith('/assets/')){
   // Onglet resté sur un build précédent, éventuellement hors connexion.
   for(const key of (await caches.keys()).filter(k=>k.startsWith(PREFIX)).reverse()){
    const cached=await (await caches.open(key)).match(url.pathname);if(cached)return cached;
   }
  }
  return fetch(request);
 })());
});
