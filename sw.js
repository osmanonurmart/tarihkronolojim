/* Çevrimdışı yedek. Önce ağdan alır, ancak internet yoksa kayıtlı kopyaya
   düşer — böylece yeni sürüm bir sonraki açılışı beklemeden gelir. */
const CACHE = 'kronolojim-v6';
const ASSETS = [
  './', './index.html', './css/app.css', './icon.svg', './manifest.webmanifest',
  './js/util.js', './js/model.js', './js/textimport.js', './js/store.js', './js/firebase-config.js',
  './js/cloud.js', './js/srs.js', './js/app.js',
  './js/views/timeline.js', './js/views/editor.js', './js/views/study.js', './js/views/panels.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
