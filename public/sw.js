// Service Worker — SelfOS PWA
// v8 — Stale-while-revalidate assets, offline fallback, local notifications

const CACHE_STATIC = "sb-static-v8";
const CACHE_PAGES  = "sb-pages-v8";
const CACHE_ASSETS = "sb-assets-v8";

const OFFLINE_URL = "/offline";
const PUBLIC_NAVIGATION_PATHS = new Set([
  "/",
  "/offline",
  "/login",
  "/auth/login",
]);

// App shell — precached on install
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Patterns that must NEVER be cached
const NETWORK_ONLY = [
  /supabase\.co/,
  /\/api\//,
  /\/auth\//,
  /\.env/,
];

/* ── Install ──────────────────────────────────────────────── */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

/* ── Activate — clean old caches ──────────────────────────── */

self.addEventListener("activate", (event) => {
  const validCaches = [CACHE_STATIC, CACHE_PAGES, CACHE_ASSETS];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !validCaches.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch ────────────────────────────────────────────────── */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. Network-only: API, auth, Supabase — never cache sensitive data
  if (NETWORK_ONLY.some((re) => re.test(url.href))) {
    return;
  }

  // 2. Navigation (HTML pages): network-first → public cache → offline fallback.
  // Protected app routes render user data in HTML, so never store them.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && PUBLIC_NAVIGATION_PATHS.has(url.pathname)) {
            const clone = response.clone();
            caches.open(CACHE_PAGES).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          if (PUBLIC_NAVIGATION_PATHS.has(url.pathname)) {
            const cached = await caches.match(request);
            if (cached) return cached;
          }
          const fallback = await caches.match(OFFLINE_URL);
          return fallback || new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // 3. Static assets (JS/CSS chunks): stale-while-revalidate
  //    Serve cached instantly, update in background for next load
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_ASSETS).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch;
      })
    );
    return;
  }

  // 4. Google Fonts / external assets: cache-first (they're immutable)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_ASSETS).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 5. Default: network-first (safe fallback for everything else)
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/* ── Messages ─────────────────────────────────────────────── */

self.addEventListener("message", (event) => {
  // Clear all caches on logout
  if (event.data?.type === "LOGOUT") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }

  // Force update when new version detected
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ── Notifications ───────────────────────────────────────── */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/home";
  const url = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
