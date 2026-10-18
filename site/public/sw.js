// AIHOT 的 service worker：让站点可安装（manifest 已在 head 接入），并在离线时保留一个可读的外壳。
//
// 策略（AIHOT 是 SSR + 实时数据站点，不是静态 webapp，所以按 DB-driven 规则来）：
// - 导航（navigate，SSR HTML）：network-first，成功即更新 cache；失败回退 cache，再失败回退 '/'
//   —— 数据实时性优先，绝不能 cache-first，否则读者会看到旧首页/旧文章（PWA 坑 8 的血泪）
// - 构建产物（/assets/*，文件名带 hash）：cache-first， immutable
// - 图标/manifest/SW 自己：cache-first，但 SW 与 manifest 由服务器发 no-cache，不会被强缓存
// - /api/*：network-only，失败透传——离线时前端自己显示错误，不伪造数据
// - 其余同源 GET：stale-while-revalidate
// 跨域请求一律不拦截（图片走 CDN/信源站，缓存会爆磁盘）。

const VERSION = "v1.0.0-20261015";
const SHELL_CACHE = `aihot-shell-${VERSION}`;
const ASSET_CACHE = `aihot-assets-${VERSION}`;

// install 时预热外壳：首页 + manifest + 图标。失败不阻塞安装（离线安装时网络本来就没有）。
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon.png",
  "/apple-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** 只缓存同源、只缓存 GET；跨域与写请求直接放行。 */
function cacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!cacheable(request)) return;

  const url = new URL(request.url);

  // API 数据：不缓存。离线时让前端拿到真实网络错误，自己展示降级 UI——伪造一份旧数据比报错更糟。
  if (url.pathname.startsWith("/api/")) return;

  // 导航：network-first（见顶部注释的理由）。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response("离线且没有可用缓存", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }),
    );
    return;
  }

  // 构建产物与静态资源：cache-first。文件名带 content hash，不会被更新覆盖。
  if (url.pathname.startsWith("/assets/") || SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // 其余同源 GET（如 /feed.xml、/robots.txt）：stale-while-revalidate。
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// 主线程可手动触发「新 SW 立即接管」（注册处会监听 updatefound）。
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
