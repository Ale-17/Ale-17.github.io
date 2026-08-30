const CACHE='fantasy-os-v15-visible-decisions';
const SHELL=['./','./index.html','./native.css','./mister-polish.css','./native.js','./mister-polish.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isAsset=/\.(?:html|css|js)$/.test(url.pathname);
  const networkFirst=url.pathname.endsWith('/')||url.pathname.endsWith('/index.html')||url.pathname.includes('/data/')||isAsset;
  if(networkFirst){event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r;}).catch(()=>caches.match(event.request).then(r=>r||caches.match(url.pathname.replace(/^.*\/mister\//,'./')))));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r;})));
});
