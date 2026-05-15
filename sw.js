const CACHE = 'rolapp-v32';
const ASSETS = [
  '/rolapp/',
  '/rolapp/index.html',
  '/rolapp/css/style.css?v=32',
  '/rolapp/js/state.js?v=32',
  '/rolapp/js/utils.js?v=32',
  '/rolapp/js/ui.js?v=32',
  '/rolapp/js/sliders.js?v=32',
  '/rolapp/js/api.js?v=32',
  '/rolapp/js/cropper.js?v=32',
  '/rolapp/js/chars.js?v=32',
  '/rolapp/js/profile.js?v=32',
  '/rolapp/js/scenes.js?v=32',
  '/rolapp/js/inbox.js?v=32',
  '/rolapp/js/missions.js?v=32',
  '/rolapp/js/hitos.js?v=32',
  '/rolapp/js/chat.js?v=32',
  '/rolapp/js/main.js?v=32',
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
