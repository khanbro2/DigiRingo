/* DGRINGO service worker — minimal, network-first. Its main job is to make the
 * app installable (PWA / wrappable as an APK). The server stays the source of
 * truth: we never cache /api/* and always try the network first, falling back to
 * cache only when offline. */
const CACHE = "dgringo-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch API calls — always live.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/webhooks/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache same-origin static assets for an offline fallback.
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/app")))
  );
});

/* ---- Web Push: incoming-call alerts even when the tab is backgrounded ---- */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore */ }
  const title = data.title || "Incoming call";
  const body = data.body || "Someone is calling you";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: "dg-incoming-call",
      renotify: true,
      requireInteraction: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200, 100, 200],
      data: { url: "/app", from: data.from || "" },
      actions: [
        { action: "open", title: "Answer" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes("/app")) { try { await c.focus(); return; } catch { /* fall through */ } }
    }
    await self.clients.openWindow("/app");
  })());
});
