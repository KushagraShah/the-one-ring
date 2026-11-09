import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const assets = [...Object.keys(bundle).filter(name => !name.endsWith('.map')), 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png']
      const files = [...new Set(assets.map(name => `./${name}`))]
      const html = bundle['index.html']
      const fingerprint = files.join('|') + (html?.type === 'asset' ? String(html.source) : '')
      const version = [...fingerprint].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE_PREFIX = 'one-ring-shell-';
const CACHE = CACHE_PREFIX + ${JSON.stringify(String(version))};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(new URL('./index.html', self.registration.scope))).then(response => response || fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(response => response || fetch(event.request)));
});` })
    },
  }
}

export default defineConfig({ plugins: [react(), offlineShell()], base: './' })
