/**
 * BootScene.js — Загрузочная сцена «Искра и Эхо»
 *
 * Первая сцена при запуске игры:
 *  1. Загружает сохранение через GameState
 *  2. Настраивает registry Phaser (масштаб, ссылки на синглтоны)
 *  3. Переходит в PreloadScene
 *
 * Нет никакого UI — это чисто инициализация.
 */

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.BOOT });
  }

  // ─── Phaser lifecycle ───────────────────────────────────────────────────────

  init() {
    // Загружаем состояние игры из localStorage
    GameState.load();
  }

  create() {
    // Записываем синглтоны в registry — доступны из любой сцены как:
    //   this.registry.get('gameState')
    //   this.registry.get('saveManager')
    this.registry.set('gameState',   GameState);
    this.registry.set('saveManager', SaveManager);

    if (window.Analytics) {
      window.Analytics.trackSessionStart();
      window.Analytics.trackAppBoot();
    }

    // Вычисляем коэффициент масштабирования для адаптивности
    this._setupScale();

    // Небольшая пауза для плавности перехода (HTML-сплэш ещё виден)
    this.time.delayedCall(100, () => {
      this.scene.start(GAME_CONFIG.SCENES.PRELOAD);
    });
  }

  // ─── Приватные методы ───────────────────────────────────────────────────────

  /**
   * Записывает в registry коэффициент масштаба и смещения центрирования.
   * Используется сценами при позиционировании элементов, если нужна
   * точная привязка к игровым координатам (390×844).
   */
  _setupScale() {
    const sw     = this.scale.width;
    const sh     = this.scale.height;
    const scaleX = sw / GAME_CONFIG.WIDTH;
    const scaleY = sh / GAME_CONFIG.HEIGHT;
    const scale  = Math.min(scaleX, scaleY);

    this.registry.set('uiScale',  scale);
    this.registry.set('offsetX',  (sw - GAME_CONFIG.WIDTH  * scale) / 2);
    this.registry.set('offsetY',  (sh - GAME_CONFIG.HEIGHT * scale) / 2);

    console.log(`[BootScene] Масштаб UI: ${scale.toFixed(3)}, экран: ${sw}×${sh}`);
  }
}
