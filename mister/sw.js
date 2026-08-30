const CACHE='fantasy-os-v30-rich-market-sheet';
const SHELL=['./','./index.html','./native.css','./mister-polish.css','./fidelity-v17.css','./insights-v18.css','./ux-v19.css','./ux-v22.css','./player-detail-v24.css','./player-detail-v25.css','./stability-v26.css','./privacy-v28.css','./offers-v28.css','./ux-v29.css','./market-sheet-v30.css','./bootstrap-v27.js','./native.js','./mister-polish.js','./privacy-v28.js','./insights-v18.js','./ux-v19.js','./coverage-v20.js','./snapshot-v21.js','./ux-v22.js','./media-v27.js','./offers-v28.js','./player-detail-v25.js','./ux-v29.js','./market-sheet-v30.js','./manifest.webmanifest','./icon.svg'];
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
