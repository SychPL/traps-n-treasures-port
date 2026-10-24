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
    const name = u.pathname.slice(base.length + 7), hit = await caches.open(CACHE).then(async c =>
      /^level[^/]*$/.test(name) && !await c.match(u.origin + base + 'assets/level1.json') ? null : c.match(u.origin + u.pathname)).catch(() => null);   // stage files only as a complete set
    if (hit) return hit;
    const r = await fetch(e.request).catch(() => null);
    if (r && r.ok) return r;
    const demo = await fetch(base + 'assets-demo/' + u.pathname.slice(base.length + 7)).catch(() => null);
    if (!demo || !demo.ok) return r || demo || Response.error();
    const h = new Headers(demo.headers); h.set('X-TNT-Demo', '1');   // the game page offers to load the disks
    return new Response(demo.body, {status: demo.status, statusText: demo.statusText, headers: h});
  })());
});
