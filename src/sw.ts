/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// App shell + data files are precached at build time (injectManifest), so both phones work offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const BASE = new URL(self.registration.scope).pathname; // "/recepten/" or "/recepten/next/"
const SHARE_PATH = BASE + 'share/';
const SHARE_INBOX = BASE + 'share/inbox';

// Web Share Target (Android Chrome): WhatsApp hands us a message (title/text/url) or a document
// as a POST multipart form. We stash it in a cache entry and redirect to the import route, which
// reads and deletes it. iOS never calls this (no share target on iOS) — that is by design.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== SHARE_PATH) return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const text = ['title', 'text', 'url']
        .map((k) => form.get(k))
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .join('\n');
      const files = form.getAll('files').filter((f): f is File => f instanceof File);
      const payload = {
        at: Date.now(),
        text,
        files: await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, text: await f.text() }))),
      };
      const cache = await caches.open('share-inbox');
      await cache.put(SHARE_INBOX, new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }));
      return Response.redirect(BASE + '#/import?from=share', 303);
    })(),
  );
});

// SPA navigation fallback: any in-scope navigation serves the precached index.html.
// The main scope (/recepten/) contains the /next/ channel (/recepten/next/), so the main worker must
// leave those navigations alone: otherwise the NEXT URL would run main's bundle and the NEXT worker
// (and its manifest/icon) would never get installed (PLAN.md §4 "/next/ channel, safe").
// Workbox tests the denylist against `pathname + search`, so the pattern is anchored on the path.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const denylist: RegExp[] = [/\/share\/?$/];
if (!/\/next\/$/.test(BASE)) denylist.push(new RegExp('^' + escapeRe(BASE) + 'next/'));
registerRoute(new NavigationRoute(createHandlerBoundToURL(BASE + 'index.html'), { denylist }));

// Update flow: the page shows "Nieuwe versie — vernieuwen"; only then do we skipWaiting.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
