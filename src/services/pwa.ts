export interface PwaState {offline:boolean;ready:boolean;waiting:ServiceWorker|null;changedElsewhere:boolean;error:string}
export function observePwa(onChange:(state:PwaState)=>void,enabled:boolean,release:string){
 let state:PwaState={offline:!navigator.onLine,ready:false,waiting:null,changedElsewhere:false,error:''};
 let stopped=false,requested=false,registration:ServiceWorkerRegistration|undefined;
 const cleanups:(()=>void)[]=[];
 const emit=(patch:Partial<PwaState>)=>{if(!stopped){state={...state,...patch};onChange(state);}};
 const listen=(target:EventTarget,event:string,fn:EventListener)=>{target.addEventListener(event,fn);cleanups.push(()=>target.removeEventListener(event,fn));};
 async function status(){
  const worker=navigator.serviceWorker.controller;if(!worker)return;
  const channel=new MessageChannel();
  const timer=setTimeout(()=>{channel.port1.close();},2500);
  cleanups.push(()=>{clearTimeout(timer);channel.port1.close();});
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();if(e.data?.type==='PWA_STATUS')emit({ready:e.data.ready===true&&e.data.build===release});};
  worker.postMessage({type:'STATUS'},[channel.port2]);
 }
 async function check(){
  if(!registration||!navigator.onLine)return;
  try{await registration.update();emit({error:''});await status();}catch{emit({error:'Recherche de mise à jour indisponible. Réessayez avec le réseau.'});}
 }
 if(enabled&&'serviceWorker' in navigator){
  listen(window,'online',()=>{emit({offline:false});void check();});
  listen(window,'offline',()=>emit({offline:true}));
  listen(document,'visibilitychange',()=>{if(document.visibilityState==='visible')void check();});
  listen(navigator.serviceWorker,'controllerchange',()=>{
   emit({waiting:null});
   if(requested){window.location.reload();return;}
   void status();if(state.ready)emit({changedElsewhere:true});
  });
  void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
   if(stopped)return;registration=reg;
   const inspect=()=>emit({waiting:reg.waiting?.state==='installed'?reg.waiting:null});
   const watch=()=>{const worker=reg.installing;if(worker)listen(worker,'statechange',()=>{inspect();if(worker.state==='activated')void status();});};
   listen(reg,'updatefound',watch);watch();inspect();void status();void check();
  }).catch(()=>emit({error:'Le mode hors connexion n’a pas pu être préparé. Gardez le réseau et réessayez.'}));
 }else if(enabled)state.error='Ce navigateur ne prend pas en charge le mode hors connexion. Utilisez un navigateur compatible en HTTPS.';
 onChange(state);
 return {
  check,
  update(){if(state.changedElsewhere){window.location.reload();return;}if(state.waiting){requested=true;state.waiting.postMessage({type:'SKIP_WAITING'});}},
  dispose(){stopped=true;cleanups.forEach(fn=>fn());}
 };
}
