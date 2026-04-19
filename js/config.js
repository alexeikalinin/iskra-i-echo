/**
 * config.js — Конфигурация игры «Искра и Эхо»
 * Централизованные константы, палитра и данные персонажей (Character Bible)
 */

// ─── Основная конфигурация ────────────────────────────────────────────────────

const GAME_CONFIG = {
  WIDTH: 390,
  HEIGHT: 844,

  // Ключи всех сцен
  SCENES: {
    BOOT:             'BootScene',
    PRELOAD:          'PreloadScene',
    MAIN_MENU:        'MainMenuScene',
    COMPANION_SELECT: 'CompanionSelectScene',
    CHAPTER:          'ChapterScene',
    // Мини-игры (добавляются в следующих этапах)
    MATCH3:           'Match3Scene',
    MAZE:             'MazeScene',
    HIDDEN_OBJECT:    'HiddenObjectScene',
    CROSSWORD:        'CrosswordScene',
    SPOT_DIFF:        'SpotDiffScene',
    MEMORY_PAIRS:     'MemoryPairsScene',
    SLIDING:          'SlidingPuzzleScene',
    BUBBLE:           'BubbleShooterScene',
    // Служебная сцена-заглушка (пока мини-игры не реализованы)
    PLACEHOLDER_MG:   'PlaceholderMiniGameScene',
    SHOP:             'ShopScene',
  },

  TOTAL_CHAPTERS: 15,

  /** Версия схемы сохранения (см. GameState._applyMigrations) */
  SAVE_SCHEMA_VERSION: 2,

  // Доступные для выбора в начале (Тень появляется в главе 3)
  INITIAL_COMPANIONS: ['svetlya', 'duh'],
};

// ─── Цветовая палитра (Visual & Audio Bible) ─────────────────────────────────

const COLORS = {
  // Фоны
  BG_NIGHT:       0x1A0F2E,
  BG_DAWN:        0x2D1B4E,
  BG_WARM:        0xFFF4E0,
  BG_CARD:        0xFFF8EE,

  // Светля — свет, энергия, надежда
  SVETLYA:        0xFFD166,
  SVETLYA_LIGHT:  0xFFE9A0,
  SVETLYA_DARK:   0xE8A020,
  SVETLYA_GLOW:   0xFFF4C2,

  // Дух — память, мудрость, воспоминания
  DUH:            0xA8C5DA,
  DUH_LIGHT:      0xCDE0F0,
  DUH_DARK:       0x6895B2,
  DUH_GLOW:       0xE0EEF8,

  // Тень — защита, покой, забота
  TEN:            0x7B5EA7,
  TEN_LIGHT:      0xB09FCC,
  TEN_DARK:       0x4A2A7A,
  TEN_GLOW:       0xD4C9EE,

  // Текст
  TEXT_DARK:      0x3D2B1F,
  TEXT_WARM:      0x6B4226,
  TEXT_LIGHT:     0xFFF8EE,
  TEXT_MUTED:     0x9E8A7A,

  // UI
  BTN_PRIMARY:    0xFF9B4E,
  BTN_HOVER:      0xFFB57A,
  BTN_SHADOW:     0xC85E1A,
  BTN_TEXT:       0xFFFFFF,

  CARD_BORDER:    0xE8D0B0,
  CARD_SELECTED:  0xFFD166,

  ACCENT:         0xE8956D,
  STAR:           0xFFE566,

  WHITE:          0xFFFFFF,
  BLACK:          0x000000,
};

// ─── Данные персонажей (Character Bible) ─────────────────────────────────────

const COMPANIONS = {
  svetlya: {
    id:          'svetlya',
    name:        'Светля',
    essence:     'Свет · Энергия · Надежда',
    description: 'Живая, искрящаяся и неугомонная. Светля — первой бросается вперёд, первой смеётся и первой протягивает руку помощи. Её присутствие согревает всех вокруг.',
    shortDesc:   'Тёплая и искрящаяся,\nкак первый луч рассвета',
    personality: 'Энергичная · Оптимистичная · Открытая',
    quote:       '«Смотри! Там что-то светится!\nИдём скорее!»',

    color:       COLORS.SVETLYA,
    colorLight:  COLORS.SVETLYA_LIGHT,
    colorDark:   COLORS.SVETLYA_DARK,
    colorGlow:   COLORS.SVETLYA_GLOW,
    colorHex:    '#FFD166',
    glowHex:     '#FFF4C2',

    // 5 стадий эволюции
    stages: [
      { name: 'Искра',    desc: 'Маленький огонёк, только проснувшийся' },
      { name: 'Пламя',    desc: 'Растущий огонь с тёплым сиянием' },
      { name: 'Свет',     desc: 'Яркое существо из чистого света' },
      { name: 'Заря',     desc: 'Живое воплощение рассвета' },
      { name: 'Солнце',   desc: 'Вечное, бесконечное тепло' },
    ],

    // Реакции в мини-играх
    reactions: {
      win:    'Светля радостно вспыхивает, рассыпая искры!',
      lose:   'Светля на мгновение тускнеет, но тут же взбадривается.',
      idle:   'Светля нетерпеливо подпрыгивает.',
      think:  'Светля задумчиво кружится на месте.',
    },

    stats: { energy: 10, wisdom: 4, protection: 5 },
  },

  duh: {
    id:          'duh',
    name:        'Дух',
    essence:     'Память · Мудрость · Воспоминания',
    description: 'Тихий и глубокий, как лесное озеро. Дух помнит всё — каждый закат, каждый смех, каждую потерю. Его слова редки, но всегда точны.',
    shortDesc:   'Мудрый хранитель\nвсех воспоминаний',
    personality: 'Задумчивый · Мудрый · Надёжный',
    quote:       '«Я помню это место…\nздесь когда-то пели птицы.»',

    color:       COLORS.DUH,
    colorLight:  COLORS.DUH_LIGHT,
    colorDark:   COLORS.DUH_DARK,
    colorGlow:   COLORS.DUH_GLOW,
    colorHex:    '#A8C5DA',
    glowHex:     '#E0EEF8',

    stages: [
      { name: 'Эхо',      desc: 'Едва слышный отзвук прошлого' },
      { name: 'Шёпот',    desc: 'Голос, несущий воспоминания' },
      { name: 'Память',   desc: 'Живое хранилище прошлого' },
      { name: 'Мудрость', desc: 'Древнее знание, принявшее форму' },
      { name: 'Вечность', desc: 'То, что будет помнить всегда' },
    ],

    reactions: {
      win:    'Дух тихо светлеет, вокруг него кружатся воспоминания.',
      lose:   'Дух на миг погружается в себя, затем кивает — он знает, что делать.',
      idle:   'Дух задумчиво смотрит вдаль.',
      think:  'Дух медленно пульсирует, перебирая воспоминания.',
    },

    stats: { energy: 4, wisdom: 10, protection: 5 },
  },

  ten: {
    id:          'ten',
    name:        'Тень',
    essence:     'Защита · Покой · Забота',
    description: 'Молчаливый страж. Тень появляется там, где нужна защита. Немногословен, но его присутствие — это броня и убежище для друзей.',
    shortDesc:   'Тихий защитник,\nприходящий в нужный момент',
    personality: 'Молчаливый · Заботливый · Стойкий',
    quote:       '«...»  *(просто встаёт рядом)*',

    color:       COLORS.TEN,
    colorLight:  COLORS.TEN_LIGHT,
    colorDark:   COLORS.TEN_DARK,
    colorGlow:   COLORS.TEN_GLOW,
    colorHex:    '#7B5EA7',
    glowHex:     '#D4C9EE',

    stages: [
      { name: 'Тень',     desc: 'Едва различимый силуэт за спиной' },
      { name: 'Силуэт',   desc: 'Чёткая фигура в темноте' },
      { name: 'Страж',    desc: 'Надёжная защита от любой угрозы' },
      { name: 'Щит',      desc: 'Живое воплощение защиты' },
      { name: 'Покров',   desc: 'Бесконечная забота, окутывающая всё' },
    ],

    reactions: {
      win:    '...  *(Тень чуть заметно светлеет по краям)*',
      lose:   '...  *(Тень становится ещё плотнее, защищая от неудачи)*',
      idle:   '...  *(Тень неподвижна, как скала)*',
      think:  '...  *(Тень медленно сгущается)*',
    },

    stats: { energy: 5, wisdom: 5, protection: 10 },
  },
};

// ─── Настройки анимаций ───────────────────────────────────────────────────────

const ANIM = {
  FADE_IN:          400,
  FADE_OUT:         300,
  TRANSITION:       500,
  FLOAT_AMPLITUDE:  8,     // пикселей вверх-вниз при парении
  FLOAT_DURATION:   2500,  // мс на цикл парения
  PULSE_SCALE:      0.04,  // 4% при пульсации
  PULSE_DURATION:   1800,
  BTN_PRESS:        100,
  COMPANION_SWITCH: 250,   // смена компаньона на экране выбора
};

// ─── Ключи localStorage ───────────────────────────────────────────────────────

const SAVE_KEYS = {
  MAIN:     'iskra_echo_v1',
  SETTINGS: 'iskra_echo_settings_v1',
};

/**
 * Дистрибуция и монетизация (план: веб-first, без pay-to-win).
 * Целевой канал по умолчанию — PWA в браузере; при обёртке в TWA/Capacitor
 * подставляются нативные SDK (Play Billing / StoreKit) и верификация на сервере.
 */
const DISTRIBUTION = {
  /** Текущая сборка: web_pwa | google_play | app_store (меняется при публикации) */
  CHANNEL: 'web_pwa',
};

/**
 * Витрина: косметика и пакет поддержки. Не влияют на сложность мини-игр.
 * paymentUrl — заглушка; замените на реальный Stripe/Paddle/страницу оферты.
 */
const MONETIZATION = {
  /** Базовый URL оплаты (веб-MVP). Пустая строка — кнопка покажет подсказку вместо перехода */
  CHECKOUT_BASE_URL: '',

  /** Юридические ссылки (заполните перед приёмом платежей) */
  LEGAL: {
    OFFER_URL:    '#',
    PRIVACY_URL:  '#',
    TERMS_URL:    '#',
  },

  /**
   * Показать в лавке тестовые кнопки выдачи предметов (grant/revoke).
   * Включается: ?shopdebug=1 в URL или localStorage iskra_echo_shopdebug=1
   */
  isShopDebugEnabled() {
    try {
      if (typeof window === 'undefined' || !window.location) return false;
      const q = new URLSearchParams(window.location.search).get('shopdebug');
      if (q === '1' || q === 'true') return true;
      return window.localStorage.getItem('iskra_echo_shopdebug') === '1';
    } catch (e) {
      return false;
    }
  },
};

/**
 * Каталог лавки: id совпадают с ключами entitlements в GameState.
 */
const SHOP_CATALOG = [
  {
    id:          'supporter_pack',
    kind:        'bundle',
    title:       'Пакет поддержки',
    description: 'Эксклюзивная косметика и благодарность в титрах. Сюжет не продаём — только тепло.',
    priceLabel:  'от 299 ₽',
    grants:      ['cosmetic_title_patron', 'cosmetic_house_memory_stone'],
  },
  {
    id:          'cosmetic_house_lantern',
    kind:        'cosmetic',
    title:       'Фонарики для дома',
    description: 'Мягкий свет в «Доме воспоминаний».',
    priceLabel:  '149 ₽',
    grants:      ['cosmetic_house_lantern'],
  },
  {
    id:          'cosmetic_house_cushions',
    kind:        'cosmetic',
    title:       'Подушки у камина',
    description: 'Уютные акценты обстановки.',
    priceLabel:  '149 ₽',
    grants:      ['cosmetic_house_cushions'],
  },
  {
    id:          'cosmetic_svetlya_aurora',
    kind:        'cosmetic',
    title:       'Светля: след зари',
    description: 'Лёгкая дорожка частиц за компаньоном (визуал).',
    priceLabel:  '199 ₽',
    grants:      ['cosmetic_svetlya_aurora'],
  },
  {
    id:          'cosmetic_duh_motes',
    kind:        'cosmetic',
    title:       'Дух: светлячки памяти',
    description: 'Крошечные огоньки вокруг Духа.',
    priceLabel:  '199 ₽',
    grants:      ['cosmetic_duh_motes'],
  },
  {
    id:          'cosmetic_ten_veil',
    kind:        'cosmetic',
    title:       'Тень: мягкий покров',
    description: 'Деликатное свечение контура.',
    priceLabel:  '199 ₽',
    grants:      ['cosmetic_ten_veil'],
  },
];

// ─── Цепочки мини-игр по главам (Story & Scene Breakdown) ────────────────────
// Используется ChapterScene для запуска нужных мини-игр в правильном порядке

const CHAPTER_MINI_GAMES = {
  1:  ['match3', 'hidden_object', 'memory_pairs', 'match3'],
  2:  ['maze', 'spot_diff', 'match3', 'bubble'],
  3:  ['memory_pairs', 'crossword', 'sliding', 'match3'],
  4:  ['hidden_object', 'maze', 'bubble', 'memory_pairs'],
  5:  ['match3', 'crossword', 'spot_diff', 'sliding', 'match3'],
  // Главы 6-15 будут заполнены при разработке соответствующих этапов
};
