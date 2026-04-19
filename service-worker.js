/**
 * service-worker.js — Service Worker «Искра и Эхо»
 *
 * Стратегия: Cache First для статических ассетов, Network First для index.html.
 * При обновлении — старый кэш удаляется автоматически.
 */

const CACHE_VERSION = 'iskra-echo-v2';

// Ресурсы для предварительного кэширования при установке SW
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/config.js',
  '/js/main.js',
  '/js/utils/SaveManager.js',
  '/js/managers/Analytics.js',
  '/js/managers/GameState.js',
  '/js/scenes/BootScene.js',
  '/js/scenes/PreloadScene.js',
  '/js/scenes/MainMenuScene.js',
  '/js/scenes/ShopScene.js',
  '/js/scenes/CompanionSelectScene.js',
  // Этап 7
  '/js/data/dialogues.js',
  '/js/managers/DialogueManager.js',
  '/js/scenes/ChapterScene.js',
  '/js/scenes/PlaceholderMiniGameScene.js',
  // Этап 8: мини-игры
  '/js/scenes/Match3Scene.js',
  '/js/scenes/MemoryPairsScene.js',
  '/js/scenes/MazeScene.js',
  '/js/scenes/SlidingPuzzleScene.js',
  '/js/scenes/SpotDiffScene.js',
  '/js/scenes/HiddenObjectScene.js',
  '/js/scenes/CrosswordScene.js',
  '/js/scenes/BubbleShooterScene.js',
  // Phaser с CDN кэшируется отдельно через runtime caching
];

// ─── Установка: предкэшируем статику ─────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        console.log('[SW] Установлен, версия:', CACHE_VERSION);
        return self.skipWaiting();
      })
  );
});

// ─── Активация: удаляем старые версии кэша ───────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log('[SW] Удаляю старый кэш:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Перехват запросов ────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // JS/HTML — всегда сначала сеть, чтобы изменения кода применялись без ручного сброса кэша
  if (url.pathname.endsWith('.js') || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Phaser CDN и прочие внешние ресурсы — cache first
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Статические ассеты (изображения, звуки) — cache first
  event.respondWith(cacheFirst(request));
});

// ─── Стратегии ────────────────────────────────────────────────────────────────

/** Network First: сеть → кэш при ошибке */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response('Нет подключения', { status: 503 });
  }
}

/** Cache First: кэш → сеть при промахе */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Ресурс недоступен', { status: 503 });
  }
}
