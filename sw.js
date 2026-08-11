const CACHE='finanzmonat-v1.1.0';
const VENDOR_CACHE='finanzmonat-vendor-v1';
const JSQR_CDN='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const CORE=[
  './','./index.html','./offline.html','./manifest.webmanifest','./css/app.css',
  './js/app.js','./js/router.js','./js/utils.js','./js/services/storage.js','./js/services/sync.js','./js/services/finance.js','./js/services/qr.js',
  './js/views/month.js','./js/views/transactions.js','./js/views/sync-view.js','./js/views/settings.js',
  './assets/vendor/qrcode.min.js','./assets/vendor/jsQR.js','./assets/icons/icon.svg','./assets/icons/icon-180.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/icon-maskable-512.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>![CACHE,VENDOR_CACHE].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.href===JSQR_CDN){
    event.respondWith(caches.open(VENDOR_CACHE).then(async cache=>{
      const cached=await cache.match(event.request);if(cached)return cached;
      const response=await fetch(event.request);if(response.ok||response.type==='opaque')await cache.put(event.request,response.clone());return response;
    }));return;
  }
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const clone=response.clone();caches.open(CACHE).then(c=>c.put('./index.html',clone));return response;}).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./offline.html')))); return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}return response;})));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
