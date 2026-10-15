import {afterEach,describe,it,expect,vi} from 'vitest';
import {observePwa} from './pwa';

afterEach(()=>vi.unstubAllGlobals());
function browser(){
 const worker=new EventTarget();worker.state='activated';worker.postMessage=vi.fn((message,ports)=>{if(message.type==='STATUS')ports[0].postMessage({type:'PWA_STATUS',build:'current',ready:true});});
 const registration=new EventTarget();registration.waiting=null;registration.installing=null;registration.update=vi.fn(async()=>{});
 const serviceWorker=new EventTarget();serviceWorker.controller=worker;serviceWorker.register=vi.fn(async()=>registration);
 const navigator={onLine:true,serviceWorker};const window=new EventTarget();window.location={reload:vi.fn()};const document=new EventTarget();document.visibilityState='visible';
 vi.stubGlobal('navigator',navigator);vi.stubGlobal('window',window);vi.stubGlobal('document',document);
 const states=[];const observer=observePwa(state=>states.push(state),true,'current');
 return {worker,registration,serviceWorker,navigator,window,document,states,observer};
}

describe('Détection et confirmation des mises à jour côté interface',()=>{
 it('reconnaît un précache complet et ne recharge pas automatiquement',async()=>{
  const b=browser();try{await vi.waitFor(()=>expect(b.states.at(-1).ready).toBe(true));expect(b.window.location.reload).not.toHaveBeenCalled();}finally{b.observer.dispose();}
 });
 it('retire l’avis d’attente lorsque le worker devient actif',async()=>{
  const b=browser();try{
   await vi.waitFor(()=>expect(b.states.at(-1).ready).toBe(true));
   const next=new EventTarget();next.state='installing';next.postMessage=vi.fn();b.registration.installing=next;b.registration.dispatchEvent(new Event('updatefound'));
   b.registration.waiting=next;next.state='installed';next.dispatchEvent(new Event('statechange'));expect(b.states.at(-1).waiting).toBe(next);
   b.registration.waiting=null;next.state='activated';next.dispatchEvent(new Event('statechange'));expect(b.states.at(-1).waiting).toBeNull();
  }finally{b.observer.dispose();}
 });
 it('attend l’action explicite avant de demander l’activation puis recharge',async()=>{
  const b=browser();try{
   await vi.waitFor(()=>expect(b.states.at(-1).ready).toBe(true));
   const next=new EventTarget();next.state='installed';next.postMessage=vi.fn();b.registration.installing=next;b.registration.waiting=next;b.registration.dispatchEvent(new Event('updatefound'));next.dispatchEvent(new Event('statechange'));
   expect(next.postMessage).not.toHaveBeenCalled();b.observer.update();expect(next.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});
   b.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(b.window.location.reload).toHaveBeenCalledOnce();
  }finally{b.observer.dispose();}
 });
 it('signale le changement d’un autre onglet sans perdre la sélection par rechargement',async()=>{
  const b=browser();try{await vi.waitFor(()=>expect(b.states.at(-1).ready).toBe(true));b.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(b.states.at(-1).changedElsewhere).toBe(true);expect(b.window.location.reload).not.toHaveBeenCalled();}finally{b.observer.dispose();}
 });
 it('signale le mode hors ligne et nettoie ses écouteurs',async()=>{
  const b=browser();await vi.waitFor(()=>expect(b.states.at(-1).ready).toBe(true));b.navigator.onLine=false;b.window.dispatchEvent(new Event('offline'));expect(b.states.at(-1).offline).toBe(true);
  b.observer.dispose();const length=b.states.length;b.window.dispatchEvent(new Event('online'));expect(b.states).toHaveLength(length);
 });
});
