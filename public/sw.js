const CACHE="colorbreak-v4.1.0";
const CORE=["./","./manifest.webmanifest","./icon.svg","./data/products.json","./data/corrections.json"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(!url.pathname.startsWith(self.location.pathname.replace(/\/[^/]*$/, "/")))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(!response.ok)return response;
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request)));
});
