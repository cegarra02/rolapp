const CACHE = 'rolapp-v53';
const ASSETS = [
  '/rolapp/',
  '/rolapp/index.html',
  '/rolapp/css/style.css?v=50',
  '/rolapp/js/state.js?v=50',
  '/rolapp/js/utils.js?v=50',
  '/rolapp/js/ui.js?v=50',
  '/rolapp/js/sliders.js?v=50',
  '/rolapp/js/api.js?v=50',
  '/rolapp/js/cropper.js?v=50',
  '/rolapp/js/chars.js?v=50',
  '/rolapp/js/profile.js?v=50',
  '/rolapp/js/scenes.js?v=50',
  '/rolapp/js/inbox.js?v=50',
  '/rolapp/js/missions.js?v=50',
  '/rolapp/js/hitos.js?v=50',
  '/rolapp/js/chat.js?v=50',
  '/rolapp/js/main.js?v=50',
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
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
