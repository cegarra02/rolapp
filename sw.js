const CACHE = 'rolapp-v73';
const ASSETS = [
  '/rolapp/',
  '/rolapp/index.html',
  '/rolapp/css/style.css?v=71',
  '/rolapp/js/state.js?v=71',
  '/rolapp/js/utils.js?v=71',
  '/rolapp/js/ui.js?v=71',
  '/rolapp/js/sliders.js?v=71',
  '/rolapp/js/supabase.js?v=71',
  '/rolapp/js/api.js?v=71',
  '/rolapp/js/cropper.js?v=71',
  '/rolapp/js/chars.js?v=71',
  '/rolapp/js/profile.js?v=71',
  '/rolapp/js/scenes.js?v=71',
  '/rolapp/js/inbox.js?v=71',
  '/rolapp/js/missions.js?v=71',
  '/rolapp/js/hitos.js?v=71',
  '/rolapp/js/explore.js?v=71',
  '/rolapp/js/moderation.js?v=71',
  '/rolapp/js/chat.js?v=71',
  '/rolapp/js/main.js?v=71',
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
