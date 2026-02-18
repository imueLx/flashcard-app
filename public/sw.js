const CACHE_NAME = "fun-flashcards-v6";
const STATIC_APP_SHELL = [
  "/",
  "/quiz",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/screenshots/home-narrow.png",
  "/screenshots/quiz-wide.png",
  "/audio/background-audio.mp3",
];

const ROUTES_TO_WARM = [
  "/",
  "/quiz",
  "/quiz?level=easy",
  "/quiz?level=medium",
  "/quiz?level=hard",
];

const FLASHCARD_IMAGE_IDS = Array.from({ length: 40 }, (_, index) => index + 1);

function getFlashcardImageCandidates() {
  return FLASHCARD_IMAGE_IDS.map((id) => `/images/flashcards/${id}.webp`);
}

const ASSET_URL_PATTERN = /(?:src|href)=["']([^"']+)["']/g;

async function precacheUrls(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch {
        return;
      }
    }),
  );
}

function getAssetUrlsFromHtml(html) {
  const assets = new Set();
  ASSET_URL_PATTERN.lastIndex = 0;

  for (const match of html.matchAll(ASSET_URL_PATTERN)) {
    const assetUrl = match[1];
    if (!assetUrl) {
      continue;
    }

    const isCoreAsset =
      assetUrl.startsWith("/_next/") ||
      assetUrl.startsWith("/icon") ||
      assetUrl.startsWith("/apple-touch-icon") ||
      assetUrl.startsWith("/favicon") ||
      assetUrl.startsWith("/manifest");

    if (isCoreAsset) {
      assets.add(assetUrl);
    }
  }

  return [...assets];
}

async function warmRouteAndAssets(cache, route) {
  try {
    const response = await fetch(route, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    await cache.put(route, response.clone());

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return;
    }

    const html = await response.text();
    const assetUrls = getAssetUrlsFromHtml(html);
    await precacheUrls(cache, assetUrls);
  } catch {
    return;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await precacheUrls(cache, STATIC_APP_SHELL);
      await precacheUrls(cache, getFlashcardImageCandidates());
      await Promise.all(
        ROUTES_TO_WARM.map((route) => warmRouteAndAssets(cache, route)),
      );
    })(),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Navigation requests — network-first, fallback to cached shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cachedRoute = await caches.match(event.request, {
            ignoreSearch: true,
          });
          if (cachedRoute) {
            return cachedRoute;
          }

          return caches.match("/");
        }),
    );
    return;
  }

  // Next.js static assets — cache-first (immutable hashed filenames)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/images/flashcards/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(event.request, clone));
            }

            return response;
          })
          .catch(() => cached || new Response("", { status: 503 }));
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(event.request, clone));
            }

            return response;
          })
          .catch(() => cached || new Response("", { status: 503 }));
      }),
    );
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});
