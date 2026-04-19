/**
 * GameState.js — Центральный менеджер состояния «Искра и Эхо»
 *
 * Хранит всё игровое состояние: выбранные компаньоны, прогресс глав,
 * эмоции, стадии эволюции, пост-гейм и настройки.
 *
 * Использование:
 *   GameState.load()                      // загрузить сохранение при старте
 *   GameState.setFirstCompanion('svetlya') // установить первого компаньона
 *   GameState.get('story.currentChapter')  // получить значение по пути
 *   GameState.save()                       // записать в localStorage
 */

class GameStateClass {

  constructor() {
    this._state = this._buildDefaultState();
  }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  /** Схема состояния новой игры */
  _buildDefaultState() {
    return {
      version: GAME_CONFIG.SAVE_SCHEMA_VERSION,
      firstVisit: true,

      // Компаньоны
      firstCompanion: null,          // 'svetlya' | 'duh'
      companions: {
        svetlya: { unlocked: false, stage: 1, bond: 0, emotion: 'calm' },
        duh:     { unlocked: false, stage: 1, bond: 0, emotion: 'calm' },
        ten:     { unlocked: false, stage: 1, bond: 0, emotion: 'calm' },
      },

      // Сюжетный прогресс
      story: {
        currentChapter:    1,
        completedChapters: [],
        currentMiniGame:   0,    // индекс внутри текущей цепочки
        miniGameResults:   {},   // { 'ch1_mg0': { score, stars }, ... }
      },

      // Пост-гейм «Дом Воспоминаний»
      postGame: {
        unlocked:          false,
        houseLevel:        1,
        lastDailyActivity: null,  // ISO-строка даты
        collectedItems:    [],
      },

      // Настройки
      settings: {
        musicVolume: 0.7,
        sfxVolume:   1.0,
        language:    'ru',
      },

      // Монетизация: только косметика / пакеты поддержки (см. MONETIZATION, SHOP_CATALOG)
      monetization: {
        entitlements: {},
        /** Локальная история транзакций для справки и отладки (не замена чеку юрлица) */
        receipts:     [],
      },

      createdAt: Date.now(),
      savedAt:   null,
    };
  }

  // ─── Загрузка / Сохранение ──────────────────────────────────────────────────

  /**
   * Загрузить из SaveManager.
   * Применяет глубокое слияние со схемой по умолчанию — безопасно
   * при обновлении версии (новые поля получат дефолтные значения).
   */
  load() {
    const saved = SaveManager.load();
    if (saved) {
      this._state = this._deepMerge(this._buildDefaultState(), saved);
      console.log('[GameState] Сохранение загружено, глава:', this._state.story.currentChapter);
    } else {
      console.log('[GameState] Новая игра');
    }
    this._applyMigrations();
    return this;
  }

  /** Записать текущее состояние в localStorage */
  save() {
    this._state.savedAt = Date.now();
    const ok = SaveManager.save(this._state);
    if (ok) console.log('[GameState] Сохранено');
    return ok;
  }

  // ─── Универсальный доступ ───────────────────────────────────────────────────

  /**
   * Получить значение по точечному пути.
   * Пример: GameState.get('companions.svetlya.stage')
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  /**
   * Установить значение по точечному пути.
   * Пример: GameState.set('settings.musicVolume', 0.5)
   */
  set(path, value) {
    const keys    = path.split('.');
    const lastKey = keys.pop();
    const target  = keys.reduce((obj, key) => {
      if (obj && key in obj) return obj[key];
      // создать промежуточный объект если не существует
      if (obj) { obj[key] = {}; return obj[key]; }
      return null;
    }, this._state);
    if (target !== null && target !== undefined) {
      target[lastKey] = value;
    }
  }

  /** Вернуть полную копию состояния (для отладки) */
  getAll() {
    return JSON.parse(JSON.stringify(this._state));
  }

  // ─── Высокоуровневые методы ─────────────────────────────────────────────────

  /** Первый визит — компаньон ещё не выбран */
  isFirstVisit() {
    return !this._state.firstCompanion;
  }

  /**
   * Выбрать первого компаньона и сохранить.
   * @param {string} id  'svetlya' | 'duh'
   */
  setFirstCompanion(id) {
    if (!COMPANIONS[id]) {
      console.error('[GameState] Неизвестный компаньон:', id);
      return;
    }
    this._state.firstCompanion                  = id;
    this._state.firstVisit                      = false;
    this._state.companions[id].unlocked         = true;
    console.log('[GameState] Первый компаньон:', COMPANIONS[id].name);
    if (window.Analytics) {
      window.Analytics.track('companion_selected', { companionId: id });
    }
    this.save();
  }

  /** Получить данные состояния компаньона */
  getCompanion(id) {
    return this._state.companions[id] ?? null;
  }

  /**
   * Обновить эмоцию компаньона.
   * Используется после мини-игр для изменения визуального состояния.
   */
  setEmotion(id, emotion) {
    if (this._state.companions[id]) {
      this._state.companions[id].emotion = emotion;
    }
  }

  /** Добавить очки привязанности (0–100) */
  addBond(id, amount) {
    const c = this._state.companions[id];
    if (c) c.bond = Math.min(100, c.bond + amount);
  }

  /**
   * Завершить главу: обновить прогресс, разблокировать Тень (гл. 3),
   * пост-гейм (гл. 15).
   */
  completeChapter(num) {
    const s = this._state.story;
    if (!s.completedChapters.includes(num)) {
      s.completedChapters.push(num);
    }
    s.currentChapter = num + 1;
    s.currentMiniGame = 0;

    // Тень присоединяется после главы 3
    if (num >= 3 && !this._state.companions.ten.unlocked) {
      this._state.companions.ten.unlocked = true;
      console.log('[GameState] Тень разблокирована!');
    }

    // Пост-гейм после финала
    if (num >= GAME_CONFIG.TOTAL_CHAPTERS) {
      this._state.postGame.unlocked = true;
      console.log('[GameState] Дом Воспоминаний разблокирован!');
      if (window.Analytics) {
        window.Analytics.trackPostGameUnlocked();
      }
    }

    if (window.Analytics) {
      window.Analytics.track('chapter_completed', { chapter: num });
    }

    this.save();
  }

  /**
   * Повысить стадию эволюции компаньона (1→5).
   * Возвращает true если эволюция произошла.
   */
  evolveCompanion(id) {
    const c = this._state.companions[id];
    if (c && c.stage < 5) {
      c.stage += 1;
      console.log(`[GameState] ${COMPANIONS[id].name} → стадия ${c.stage}`);
      this.save();
      return true;
    }
    return false;
  }

  /** Сохранить результат мини-игры */
  saveMiniGameResult(chapterNum, miniGameIndex, result) {
    const key = `ch${chapterNum}_mg${miniGameIndex}`;
    this._state.story.miniGameResults[key] = result;
  }

  // ─── Монетизация: entitlements ─────────────────────────────────────────────

  /**
   * Есть ли право на косметический объект.
   * @param {string} entitlementId id из SHOP_CATALOG.grants
   */
  hasEntitlement(entitlementId) {
    return !!this._state.monetization?.entitlements?.[entitlementId];
  }

  /** Список выданных id (для UI) */
  getEntitlementIds() {
    return Object.keys(this._state.monetization?.entitlements || {});
  }

  /**
   * Выдать entitlement (покупка, промо или тест).
   * @param {string} entitlementId
   * @param {string} [source] 'purchase' | 'debug' | 'promo'
   */
  grantEntitlement(entitlementId, source = 'purchase') {
    if (!this._state.monetization) {
      this._state.monetization = { entitlements: {}, receipts: [] };
    }
    this._state.monetization.entitlements[entitlementId] = {
      grantedAt: Date.now(),
      source,
    };
    if (window.Analytics) {
      window.Analytics.trackEntitlementGranted(null, entitlementId);
    }
    this.save();
  }

  /**
   * Отозвать entitlement (только для отладки / отката теста).
   */
  revokeEntitlement(entitlementId) {
    if (this._state.monetization?.entitlements) {
      delete this._state.monetization.entitlements[entitlementId];
    }
    this.save();
  }

  /**
   * Записать факт оплаты (веб: ссылка на чек; стор: token позже).
   * @param {object} data
   * @param {string} [data.productId]
   * @param {string} [data.transactionRef]
   * @param {string} [data.platform] 'web' | 'play' | 'appstore'
   * @param {string} [data.note]
   */
  addPurchaseReceipt(data) {
    if (!this._state.monetization) {
      this._state.monetization = { entitlements: {}, receipts: [] };
    }
    const row = {
      at: Date.now(),
      productId:       data.productId || null,
      transactionRef:  data.transactionRef || null,
      platform:        data.platform || (DISTRIBUTION && DISTRIBUTION.CHANNEL) || 'web',
      note:            data.note || null,
    };
    this._state.monetization.receipts.push(row);
    const max = 50;
    if (this._state.monetization.receipts.length > max) {
      this._state.monetization.receipts =
        this._state.monetization.receipts.slice(-max);
    }
    this.save();
    return row;
  }

  /** Миграции схемы сохранения между версиями */
  _applyMigrations() {
    const target = GAME_CONFIG.SAVE_SCHEMA_VERSION;
    let v = this._state.version;
    if (v == null || v === undefined) v = 1;

    if (v < target) {
      if (!this._state.monetization) {
        this._state.monetization = { entitlements: {}, receipts: [] };
      } else {
        if (!this._state.monetization.entitlements) {
          this._state.monetization.entitlements = {};
        }
        if (!Array.isArray(this._state.monetization.receipts)) {
          this._state.monetization.receipts = [];
        }
      }
      this._state.version = target;
      console.log('[GameState] Миграция сохранения:', v, '→', target);
      this.save();
    }
  }

  // ─── Утилита: глубокое слияние ──────────────────────────────────────────────

  _deepMerge(target, source) {
    const result = Object.assign({}, target);
    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = target[key];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
          tv && typeof tv === 'object' && !Array.isArray(tv)) {
        result[key] = this._deepMerge(tv, sv);
      } else {
        result[key] = sv;
      }
    }
    return result;
  }
}

// Глобальный синглтон — доступен во всех сценах через window.GameState
window.GameState = new GameStateClass();
