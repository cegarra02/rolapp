const CACHE = 'storym-v267';
const ASSETS = [
  '/rolapp/',
  '/rolapp/index.html',
  '/rolapp/css/style.css?v=183',
  '/rolapp/js/icons.js?v=183',
  '/rolapp/js/i18n.js?v=183',
  '/rolapp/js/state.js?v=183',
  '/rolapp/js/utils.js?v=183',
  '/rolapp/js/ui.js?v=183',
  '/rolapp/js/sliders.js?v=183',
  '/rolapp/js/supabase.js?v=183',
  '/rolapp/js/storage.js?v=183',
  '/rolapp/js/sync.js?v=183',
  '/rolapp/js/api.js?v=183',
  '/rolapp/js/cropper.js?v=183',
  '/rolapp/js/chars.js?v=183',
  '/rolapp/js/profile.js?v=183',
  '/rolapp/js/scenes.js?v=183',
  '/rolapp/js/inbox.js?v=183',
  '/rolapp/js/missions.js?v=183',
  '/rolapp/js/hitos.js?v=183',
  '/rolapp/js/explore.js?v=183',
  '/rolapp/js/moderation.js?v=183',
  '/rolapp/js/gemshop.js?v=183',
  '/rolapp/js/chat.js?v=183',
  '/rolapp/js/main.js?v=183',
  '/rolapp/js/rewards.js?v=183',
  '/rolapp/manifest.json',
  '/rolapp/icon-192.png?v=183',
  '/rolapp/icon-512.png?v=183'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Solo interceptar recursos del propio dominio (GitHub Pages)
  // Las peticiones a APIs externas (Supabase, Anthropic, Google) las gestiona el navegador directamente
  if (!e.request.url.startsWith(self.location.origin)) return;

  // El documento HTML (navegación) se sirve NETWORK-FIRST: así el usuario
  // siempre recibe el index.html más reciente, que referencia los ?v= correctos
  // de cada JS/CSS. Evita el desajuste "index nuevo + assets viejos cacheados"
  // que dejaba la app en una versión rota. Cae a caché solo si no hay red (offline).
  const isHTML = e.request.mode === 'navigate' ||
                 (e.request.destination === 'document') ||
                 e.request.url.endsWith('/') ||
                 e.request.url.endsWith('index.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/rolapp/index.html')))
    );
    return;
  }

  // Assets versionados (?v=NN): cache-first. El query string cambia en cada
  // release, así que la caché nunca devuelve un archivo obsoleto por error.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
