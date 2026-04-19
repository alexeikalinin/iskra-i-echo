/**
 * main.js — Точка входа «Искра и Эхо»
 * Инициализирует Phaser 3 и регистрирует все сцены.
 *
 * Чтобы добавить новую сцену:
 *  1. Создать файл js/scenes/NewScene.js
 *  2. Подключить его в index.html (перед main.js)
 *  3. Добавить ключ в GAME_CONFIG.SCENES (config.js)
 *  4. Добавить класс в массив scene: [...] ниже
 */

const PhaserConfig = {
  type:            Phaser.AUTO,    // WebGL → Canvas fallback
  backgroundColor: '#1A0F2E',

  // Адаптивный масштаб — игровое поле 390×844, растягивается на весь экран
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:      GAME_CONFIG.WIDTH,
    height:     GAME_CONFIG.HEIGHT,
    parent:     'game-container',
  },

  // Физика не нужна для puzzle-игры (включается только в нужных сценах)
  physics: {
    default: 'arcade',
    arcade:  { debug: false },
  },

  // Сцены в порядке: первая в массиве запускается автоматически
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    ShopScene,
    CompanionSelectScene,
    // ── Этап 7 ──
    ChapterScene,
    PlaceholderMiniGameScene,
    // ── Этап 8+ (добавляются по мере реализации) ──
    Match3Scene,
    MazeScene,
    HiddenObjectScene,
    CrosswordScene,
    SpotDiffScene,
    MemoryPairsScene,
    SlidingPuzzleScene,
    BubbleShooterScene,
  ],
};

// Запуск игры
const game = new Phaser.Game(PhaserConfig);

// Убираем HTML-сплэш после инициализации Phaser
game.events.once('ready', () => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 600);
  }
});

// Регистрация Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg  => console.log('[SW] Зарегистрирован:', reg.scope))
      .catch(err => console.warn('[SW] Ошибка регистрации:', err));
  });
}
