'use strict';
// Assets extracted from the player's own disks (extractor/) live in Cache Storage 'tnt-assets-v1' under the URL of
// the game file (origin + /game/assets/...). Requests for game/assets/* are served from there first, then from the
// server (game/assets), and finally from the demo pack (game/assets-demo) - so a partial extraction mixes with the demo.
const CACHE = 'tnt-assets-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url), base = new URL('./', self.location).pathname;
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || !u.pathname.startsWith(base + 'assets/')) return;
  e.respondWith((async () => {
    const hit = await caches.open(CACHE).then(c => c.match(u.origin + u.pathname)).catch(() => null);
    if (hit) return hit;
    const r = await fetch(e.request).catch(() => null);
    if (r && r.ok) return r;
    const demo = await fetch(base + 'assets-demo/' + u.pathname.slice(base.length + 7)).catch(() => null);
    return demo && demo.ok ? demo : r || demo || Response.error();
  })());
});
