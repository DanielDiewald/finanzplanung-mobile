const VERSION='2.2.2a';
const CACHE=`capyt-v${VERSION}`;
const VENDOR_CACHE='capyt-vendor-v1';
const JSQR_CDN='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const CORE=[
  './','./index.html','./offline.html','./assets/favicons/site.webmanifest','./css/capyt-tokens.css','./css/app.css','./css/desktop.css',
  './js/theme.js','./js/pwa-update.js','./js/app.js','./js/router.js','./js/utils.js','./js/services/storage.js','./js/services/sync.js','./js/services/finance.js','./js/services/qr.js','./js/services/buffer-status.js',
  './js/views/month.js','./js/views/transactions.js','./js/views/sync-view.js','./js/views/settings.js',
  './assets/vendor/qrcode.min.js','./assets/vendor/jsQR.js',
  './assets/branding/capyt-logo-master.png','./assets/branding/capyt-32.png','./assets/branding/capyt-48.png','./assets/branding/capyt-180.png','./assets/branding/capyt-192.png','./assets/branding/capyt-512.png',
  './assets/vault/vault-0.webp','./assets/vault/vault-almost-empty.webp','./assets/vault/vault-10.webp','./assets/vault/vault-25.webp','./assets/vault/vault-50.webp','./assets/vault/vault-75.webp','./assets/vault/vault-100.webp',
  './capy/','./capy/index.html','./capy/desktop.html','./capy/css/capy.css','./capy/css/desktop.css','./capy/css/desktop-host.css','./capy/js/app.js','./capy/js/config.js','./capy/js/engine.js','./capy/js/interactions.js','./capy/js/naming.js','./capy/js/finance-adapter.js','./capy/js/shared-state.js','./capy/js/desktop-page.js','./capy/js/desktop-bridge.js','./capy/settings/behavior.json','./capy/settings/economy.json','./capy/settings/items.json','./capy/assets/capy/capy-celebrate.png','./capy/assets/capy/capy-eating.png','./capy/assets/capy/capy-happy.png','./capy/assets/capy/capy-hungry.png','./capy/assets/capy/capy-neutral.png','./capy/assets/capy/capy-sleeping.png','./capy/assets/capy/capy-sleepy.png','./capy/assets/effects/coin.png','./capy/assets/effects/confetti.png','./capy/assets/effects/heart.png','./capy/assets/effects/sparkle.png','./capy/assets/effects/zzz.png','./capy/assets/items/apple.png','./capy/assets/items/carrot.png','./capy/assets/items/cucumber.png','./capy/assets/items/melon.png','./capy/assets/items/pumpkin.png','./capy/assets/items/snack.png','./capy/assets/ui/capy-brand.png','./capy/assets/ui/safe-closed.png',
  './desktop-integration/Finanzplanung_v10_mobile-sync.html','./desktop-integration/mobile-sync-addon.js','./desktop-integration/qrcode.min.js'
];

async function precacheCore(){
  const cache=await caches.open(CACHE);
  const requests=CORE.map(url=>new Request(new URL(url,self.location.href),{cache:'reload'}));
  await cache.addAll(requests);
}

async function networkFirst(request){
  try{
    const response=await fetch(request);
    if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(request,clone));}
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('install',event=>event.waitUntil(precacheCore()));
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
  if(url.pathname.endsWith('/version.json')){
    event.respondWith(fetch(new Request(event.request,{cache:'no-store'})));return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request).catch(async()=>{
      const exact=await caches.match(event.request);if(exact)return exact;
      return (await caches.match('./index.html'))||(await caches.match('./offline.html'));
    }));return;
  }
  if(['script','style','worker','manifest'].includes(event.request.destination)){
    event.respondWith(networkFirst(event.request));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}return response;})));
});
self.addEventListener('message',event=>{
  const type=typeof event.data==='string'?event.data:event.data?.type;
  if(type==='SKIP_WAITING')self.skipWaiting();
});
