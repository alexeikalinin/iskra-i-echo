/**
 * SaveManager.js — Менеджер сохранений «Искра и Эхо»
 * Единственная точка доступа к localStorage в проекте.
 * Все остальные файлы работают с сохранениями только через этот класс.
 */

class SaveManagerClass {
  constructor() {
    this._mainKey     = SAVE_KEYS.MAIN;
    this._settingsKey = SAVE_KEYS.SETTINGS;
  }

  // ─── Основное сохранение ────────────────────────────────────────────────────

  /** Сохранить объект игровых данных */
  save(data) {
    try {
      localStorage.setItem(this._mainKey, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('[SaveManager] Ошибка при сохранении:', e);
      return false;
    }
  }

  /** Загрузить игровые данные. Возвращает null если сохранения нет */
  load() {
    try {
      const raw = localStorage.getItem(this._mainKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[SaveManager] Ошибка при загрузке:', e);
      return null;
    }
  }

  /** Проверить наличие сохранения */
  hasSave() {
    return localStorage.getItem(this._mainKey) !== null;
  }

  /** Удалить сохранение (для отладки и сброса прогресса) */
  deleteSave() {
    localStorage.removeItem(this._mainKey);
    console.log('[SaveManager] Сохранение удалено');
  }

  // ─── Настройки ──────────────────────────────────────────────────────────────

  saveSettings(settings) {
    try {
      localStorage.setItem(this._settingsKey, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SaveManager] Ошибка сохранения настроек:', e);
    }
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(this._settingsKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ─── Дебаг-утилиты ──────────────────────────────────────────────────────────

  /** Показать текущее сохранение в консоли */
  debug() {
    const data = this.load();
    console.log('[SaveManager] Текущее сохранение:', data);
    return data;
  }
}

// Глобальный синглтон
window.SaveManager = new SaveManagerClass();
