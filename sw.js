const CACHE = 'storym-v193';
const ASSETS = [
  '/rolapp/',
  '/rolapp/index.html',
  '/rolapp/css/style.css?v=146',
  '/rolapp/js/icons.js?v=146',
  '/rolapp/js/state.js?v=146',
  '/rolapp/js/utils.js?v=146',
  '/rolapp/js/ui.js?v=146',
  '/rolapp/js/sliders.js?v=146',
  '/rolapp/js/supabase.js?v=146',
  '/rolapp/js/sync.js?v=146',
  '/rolapp/js/api.js?v=146',
  '/rolapp/js/cropper.js?v=146',
  '/rolapp/js/chars.js?v=146',
  '/rolapp/js/profile.js?v=146',
  '/rolapp/js/scenes.js?v=146',
  '/rolapp/js/inbox.js?v=146',
  '/rolapp/js/missions.js?v=146',
  '/rolapp/js/hitos.js?v=146',
  '/rolapp/js/explore.js?v=146',
  '/rolapp/js/moderation.js?v=146',
  '/rolapp/js/gemshop.js?v=146',
  '/rolapp/js/chat.js?v=146',
  '/rolapp/js/main.js?v=146',
  '/rolapp/js/rewards.js?v=146',
  '/rolapp/manifest.json',
  '/rolapp/icon-192.png',
  '/rolapp/icon-512.png'
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
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
