const CACHE_NAME = 'magic-calendar-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './astronomy.min.js',
    './icon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
