'use strict';
const VERSION='1.2.1';
const CACHE='minimal-player-shell-v'+VERSION;
const SHELL=['./index.html','./style.css?v='+VERSION,'./app.js?v='+VERSION,'./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const absolute=p=>new URL(p,self.registration.scope).href;
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const responses=await Promise.all(SHELL.map(async p=>{
    const request=new Request(absolute(p),{cache:'reload'});
    const response=await fetch(request);
    if(!response.ok)throw new Error('Shell unavailable: '+p);
    if(p==='./index.html'&&!(await response.clone().text()).includes('app.js?v='+VERSION))throw new Error('Release mismatch');
    return [request,response];
  }));
  await Promise.all(responses.map(([request,response])=>cache.put(request,response)));
  await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('minimal-player-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('message',e=>{if(e.data?.type==='GET_VERSION'&&e.ports[0])e.ports[0].postMessage({version:VERSION});});
async function navigation(request){
  const cache=await caches.open(CACHE);
  // Use the online document for new launches, preserving the installed shell offline.
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3500);
  try{const response=await fetch(request,{cache:'no-store',signal:controller.signal});
    if(response.ok&&(await response.clone().text()).includes('app.js?v='+VERSION))return response;
  }catch{}finally{clearTimeout(timer);}
  return await cache.match(absolute('./index.html'))||Response.error();
}
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  if(r.mode==='navigate'){e.respondWith(navigation(r));return;}
  if(SHELL.some(p=>absolute(p)===u.href))e.respondWith(caches.open(CACHE).then(c=>c.match(r)).then(x=>x||fetch(r)));
});
