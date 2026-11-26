const CACHE = 'zal-v3';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/base.css',
  './styles/screens.css',
  './js/app.js',
  './js/router.js',
  './js/state.js',
  './js/storage.js',
  './js/timer.js',
  './js/sound.js',
  './js/wakelock.js',
  './js/util.js',
  './js/screens/workout.js',
  './js/screens/rest.js',
  './js/screens/summary.js',
  './js/screens/history.js',
  './js/screens/programs.js',
  './js/screens/exercises.js',
  './js/screens/report.js',
  './js/screens/analysis.js',
  './js/screens/settings.js',
  './js/screens/import.js',
  './js/logic/progression.js',
  './js/logic/analytics.js',
  './js/logic/exportImport.js',
  './js/logic/report.js',
  './audio/ready.wav',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Сеть вперёд, кэш как запасной вариант: обновления приложения приходят сразу,
// а без интернета всё продолжает работать.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches
          .open(CACHE)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
