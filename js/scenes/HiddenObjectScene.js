/**
 * HiddenObjectScene.js — Мини-игра «Найди предметы» («Искра и Эхо»)
 *
 * Механика: на экране нарисована ночная комната с магическими предметами.
 * Среди декора спрятаны интерактивные предметы. Игрок нажимает на предмет —
 * тот подсвечивается и вычёркивается из списка внизу экрана.
 * Промах — штраф к счёту и красная вспышка.
 * Через 45 секунд без нахождения — мерцает подсказка.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 */

class HiddenObjectScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.HIDDEN_OBJECT });
  }

  // ─── Константы ─────────────────────────────────────────────────────────────

  // Радиус хит-зоны вокруг центра интерактивного предмета (px)
  static get HIT_RADIUS()     { return 35; }

  // Штраф за промах
  static get MISS_PENALTY()   { return 20; }

  // Базовые очки за прохождение + бонус за каждый предмет
  static get BASE_SCORE()     { return 500; }
  static get ITEM_SCORE()     { return 200; }

  // Задержка до показа подсказки (мс)
  static get HINT_DELAY()     { return 45000; }

  // Высота HUD сверху
  static get HUD_H()          { return 76; }

  // Высота панели предметов снизу
  static get LIST_H()         { return 110; }

  // Пул всех возможных предметов
  static get ITEMS_POOL() {
    return [
      { id: 'orb',     label: 'Орб',     symbol: '◎', color: COLORS.SVETLYA       },
      { id: 'crystal', label: 'Кристалл',symbol: '◈', color: COLORS.DUH           },
      { id: 'scroll',  label: 'Свиток',  symbol: '▦', color: COLORS.ACCENT        },
      { id: 'star',    label: 'Звезда',  symbol: '✦', color: COLORS.STAR          },
      { id: 'potion',  label: 'Зелье',   symbol: '◉', color: COLORS.TEN           },
      { id: 'book',    label: 'Книга',   symbol: '▣', color: COLORS.BTN_PRIMARY   },
      { id: 'feather', label: 'Перо',    symbol: '◌', color: COLORS.DUH_LIGHT     },
      { id: 'candle',  label: 'Свеча',   symbol: '✶', color: COLORS.SVETLYA_LIGHT },
    ];
  }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || (typeof GameState !== 'undefined'
                          ? GameState.get('firstCompanion')
                          : null) || 'svetlya';
    this._difficulty  = data.difficulty   || 'normal';
    this._startTime   = Date.now();

    // Параметры сложности: количество предметов и таймер
    const DIFF = {
      easy:   { itemCount: 4, timeSec: 180 },
      normal: { itemCount: 6, timeSec: 120 },
      hard:   { itemCount: 8, timeSec: 90  },
    };
    const cfg = DIFF[this._difficulty] || DIFF.normal;
    this._itemCount   = cfg.itemCount;
    this._timeLeft    = cfg.timeSec;
    this._maxTime     = cfg.timeSec;

    this._score       = 0;
    this._misses      = 0;
    this._found       = 0;     // количество найденных предметов
    this._gameOver    = false;

    // Массив интерактивных предметов: { id, label, symbol, color, x, y, gfx, found }
    this._interactiveItems = [];

    // Графика подсказки (мерцающий предмет)
    this._hintGfx     = null;
    this._hintTween   = null;

    // Таймер до подсказки
    this._hintTimer   = null;

    // Все декоративные объекты (чтобы уничтожить при необходимости)
    this._decorObjects = [];
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    try {
      this._buildScene(W, H);
      this._buildHUD(W);
      this._buildItemList(W, H);
      this._buildCompanion(W, H);
      this._setupInput(W, H);

      // Таймер стартует только после туториала
      this._timerStarted = false;

      this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
      this._showTutorial(W, H);
    } catch (err) {
      const g = this.add.graphics().setDepth(9999);
      g.fillStyle(0xFF0000, 0.9);
      g.fillRect(0, 0, W, H);
      this.add.text(W / 2, H / 2, 'ОШИБКА:\n' + err.message, {
        fontFamily: 'Arial', fontSize: '16px', color: '#ffffff',
        align: 'center', wordWrap: { width: W - 40 },
      }).setOrigin(0.5).setDepth(10001);
      console.error('[HiddenObjectScene] create() crashed:', err);
    }
  }

  /** Показывает обучающий экран перед началом игры */
  _showTutorial(W, H) {
    const companion = COMPANIONS[this._companionId];

    // Затемняющий оверлей
    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x050210, 0.88);
    overlay.fillRect(0, 0, W, H);

    // Карточка туториала
    const cardX = W / 2;
    const cardY = H / 2;
    const cardW = W - 40;
    const cardH = 340;

    const card = this.add.graphics().setDepth(201);
    card.fillStyle(0x110830, 1);
    card.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 18);
    card.lineStyle(1.5, companion.color, 0.6);
    card.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 18);

    const textStyle = { fontFamily: 'Georgia, serif', color: '#FFF4E0', align: 'center' };

    // Заголовок
    this.add.text(cardX, cardY - cardH / 2 + 24, '✦  Найди предметы  ✦', {
      ...textStyle, fontSize: '18px', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202);

    // Разделитель
    const div = this.add.graphics().setDepth(202);
    div.lineStyle(1, companion.color, 0.3);
    div.lineBetween(cardX - cardW / 2 + 20, cardY - cardH / 2 + 56,
                    cardX + cardW / 2 - 20, cardY - cardH / 2 + 56);

    // Инструкция
    const instrY = cardY - cardH / 2 + 72;
    const instructions = [
      { icon: '👁', text: 'Посмотри на список предметов внизу экрана' },
      { icon: '👆', text: 'Нажми на предмет в комнате, чтобы его найти' },
      { icon: '✓',  text: 'Найди все предметы до истечения времени' },
      { icon: '⚠',  text: 'Промах = штраф к очкам, будь внимателен!' },
    ];

    instructions.forEach((instr, i) => {
      const y = instrY + i * 48;
      // Иконка
      this.add.text(cardX - cardW / 2 + 22, y + 14, instr.icon, {
        fontFamily: 'Arial', fontSize: '20px',
      }).setOrigin(0, 0.5).setDepth(202);
      // Текст
      this.add.text(cardX - cardW / 2 + 54, y + 14, instr.text, {
        ...textStyle, fontSize: '13px', wordWrap: { width: cardW - 70 },
      }).setOrigin(0, 0.5).setDepth(202);
    });

    // Кнопка «Начать»
    const btnY  = cardY + cardH / 2 - 34;
    const btnW  = 160;
    const btnH  = 44;
    const btnBg = this.add.graphics().setDepth(202);
    btnBg.fillStyle(companion.color, 0.9);
    btnBg.fillRoundedRect(cardX - btnW / 2, btnY - btnH / 2, btnW, btnH, 14);

    const btnTxt = this.add.text(cardX, btnY, 'Начать игру', {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
      color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(203);

    // Пульсация кнопки
    this.tweens.add({
      targets:  [btnBg, btnTxt],
      alpha:    { from: 0.85, to: 1 },
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Интерактивная зона кнопки
    const btnZone = this.add.zone(cardX, btnY, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(204);

    const startGame = () => {
      btnZone.removeInteractive();
      this.tweens.add({
        targets:  [overlay, card, div, btnBg, btnTxt, btnZone],
        alpha:    0,
        duration: 300,
        onComplete: () => {
          [overlay, card, div, btnBg, btnTxt, btnZone].forEach(o => o.destroy());
          // Уничтожаем текстовые объекты туториала (они не в массиве)
          // Запускаем таймер и подсказку
          this._timerEvent = this.time.addEvent({
            delay:         1000,
            callback:      this._onTick,
            callbackScope: this,
            loop:          true,
          });
          this._scheduleHint();
          this._timerStarted = true;
        },
      });
      // Анимируем остальные UI-объекты туториала
      this.tweens.killTweensOf([btnBg, btnTxt]);
    };

    btnZone.on('pointerdown', startGame);
    btnZone.on('pointerover',  () => { btnBg.setAlpha(1.0); });
    btnZone.on('pointerout',   () => { btnBg.setAlpha(0.9); });
  }

  // ─── Построение игровой сцены ───────────────────────────────────────────────

  /**
   * Рисует фон ночной комнаты, декоративные объекты и прячет интерактивные
   * предметы среди декора.
   */
  _buildScene(W, H) {
    const SCENE_TOP = HiddenObjectScene.HUD_H;
    const SCENE_BOT = H - HiddenObjectScene.LIST_H;
    const SCENE_H   = SCENE_BOT - SCENE_TOP;

    // ── Фон: ночная комната ──
    const bg = this.add.graphics().setDepth(0);

    // Тёмный градиент
    bg.fillGradientStyle(0x0A0618, 0x0A0618, COLORS.BG_NIGHT, COLORS.BG_NIGHT, 1);
    bg.fillRect(0, SCENE_TOP, W, SCENE_H);

    // Пол (чуть светлее)
    bg.fillStyle(0x130A22, 1);
    bg.fillRect(0, SCENE_BOT - 80, W, 80);

    // Линия пола
    bg.lineStyle(1, COLORS.TEN, 0.25);
    bg.lineBetween(0, SCENE_BOT - 80, W, SCENE_BOT - 80);

    // Окно слева (лунный свет)
    this._drawWindow(bg, 30, SCENE_TOP + 30, 80, 110);

    // Лунный блик на полу
    bg.fillStyle(COLORS.DUH_LIGHT, 0.04);
    bg.fillEllipse(110, SCENE_BOT - 40, 160, 40);

    // Полка (горизонтальная линия)
    bg.fillStyle(0x2A1A3E, 1);
    bg.fillRect(0, SCENE_TOP + 140, W, 10);
    bg.lineStyle(1, COLORS.TEN_LIGHT, 0.2);
    bg.lineBetween(0, SCENE_TOP + 140, W, SCENE_TOP + 140);

    // Вторая полка
    bg.fillStyle(0x2A1A3E, 1);
    bg.fillRect(0, SCENE_TOP + 280, W * 0.6, 8);
    bg.lineStyle(1, COLORS.TEN_LIGHT, 0.15);
    bg.lineBetween(0, SCENE_TOP + 280, W * 0.6, SCENE_TOP + 280);

    // Стол
    bg.fillStyle(0x1E102E, 1);
    bg.fillRect(W * 0.3, SCENE_BOT - 80, W * 0.7, 12);
    bg.fillRect(W * 0.35, SCENE_BOT - 68, 14, 68);
    bg.fillRect(W - 30, SCENE_BOT - 68, 14, 68);

    // Паутина в углу
    this._drawCobweb(bg, W - 10, SCENE_TOP + 5, 45);

    // ── Декоративные объекты («шум») ──
    this._spawnDecor(W, SCENE_TOP, SCENE_BOT);

    // ── Выбираем и размещаем интерактивные предметы ──
    this._spawnInteractiveItems(W, SCENE_TOP, SCENE_BOT);
  }

  /** Рисует стилизованное окно с лунным светом */
  _drawWindow(gfx, x, y, w, h) {
    // Рама
    gfx.lineStyle(3, 0x3A2850, 1);
    gfx.strokeRect(x, y, w, h);

    // Лунное свечение внутри
    gfx.fillStyle(COLORS.DUH_LIGHT, 0.08);
    gfx.fillRect(x + 2, y + 2, w - 4, h - 4);

    // Перекладины
    gfx.lineStyle(2, 0x3A2850, 1);
    gfx.lineBetween(x + w / 2, y, x + w / 2, y + h);
    gfx.lineBetween(x, y + h / 2, x + w, y + h / 2);

    // Лунный диск
    gfx.fillStyle(COLORS.DUH_LIGHT, 0.3);
    gfx.fillCircle(x + w / 2, y + h * 0.3, 14);
    gfx.fillStyle(COLORS.DUH_GLOW, 0.12);
    gfx.fillCircle(x + w / 2, y + h * 0.3, 22);
  }

  /** Рисует паутину в углу */
  _drawCobweb(gfx, x, y, size) {
    gfx.lineStyle(0.5, COLORS.DUH_LIGHT, 0.15);
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI / 2) * (i / 4);
      gfx.lineBetween(x, y, x - Math.cos(angle) * size, y + Math.sin(angle) * size);
    }
    // Дуги паутины (strokeArc не существует в Phaser 3 — рисуем через arc + strokePath)
    for (let r = 10; r <= size; r += 12) {
      gfx.beginPath();
      gfx.arc(x, y, r, Math.PI / 2, Math.PI, false);
      gfx.strokePath();
    }
  }

  /**
   * Генерирует 25-35 декоративных объектов — «шум» комнаты.
   * Декор рисуется тем же набором символов/форм, но чуть темнее.
   */
  _spawnDecor(W, sceneTop, sceneBot) {
    const count = Phaser.Math.Between(25, 32);
    const pool  = HiddenObjectScene.ITEMS_POOL;

    // Безопасные зоны размещения (исключаем края HUD и панели)
    const margin = 20;
    const zones  = [
      // Верхняя зона (над первой полкой)
      { x1: margin, x2: W - margin, y1: sceneTop + 10, y2: sceneTop + 130 },
      // Полка 1 (на полке и чуть выше)
      { x1: margin, x2: W - margin, y1: sceneTop + 115, y2: sceneTop + 200 },
      // Полка 2 (левая)
      { x1: margin, x2: W * 0.6 - margin, y1: sceneTop + 255, y2: sceneTop + 310 },
      // Средняя зона
      { x1: margin, x2: W - margin, y1: sceneTop + 200, y2: sceneBot - 100 },
      // Стол (правая часть)
      { x1: W * 0.3 + margin, x2: W - margin, y1: sceneBot - 120, y2: sceneBot - 85 },
    ];

    for (let i = 0; i < count; i++) {
      const zone  = Phaser.Utils.Array.GetRandom(zones);
      const item  = Phaser.Utils.Array.GetRandom(pool);
      const x     = Phaser.Math.Between(zone.x1, zone.x2);
      const y     = Phaser.Math.Between(zone.y1, zone.y2);
      const size  = Phaser.Math.Between(14, 22);

      const gfx = this.add.graphics().setDepth(2);
      this._drawItemShape(gfx, item, 0, 0, size, false);
      gfx.setPosition(x, y);
      this._decorObjects.push(gfx);

      // Символ декора (тусклее)
      const txt = this.add.text(x, y - 1, item.symbol, {
        fontFamily: 'Georgia, serif',
        fontSize:   `${size}px`,
        color:      this._colorToHex(item.color, 0.35),
        alpha:      0.35,
      }).setOrigin(0.5).setDepth(3);
      this._decorObjects.push(txt);
    }
  }

  /**
   * Выбирает нужное количество предметов из пула и размещает их
   * как интерактивные объекты среди декора.
   */
  _spawnInteractiveItems(W, sceneTop, sceneBot) {
    const margin  = 40;
    const pool    = HiddenObjectScene.ITEMS_POOL.slice(); // копия пула
    Phaser.Utils.Array.Shuffle(pool);
    const chosen  = pool.slice(0, this._itemCount);

    // Минимальное расстояние между интерактивными предметами
    const MIN_DIST = 70;
    const placed   = [];

    // Зоны размещения (те же, что и у декора)
    const zones = [
      { x1: margin, x2: W - margin, y1: sceneTop + 10,  y2: sceneTop + 130 },
      { x1: margin, x2: W - margin, y1: sceneTop + 115, y2: sceneTop + 200 },
      { x1: margin, x2: W * 0.55,   y1: sceneTop + 255, y2: sceneTop + 310 },
      { x1: margin, x2: W - margin, y1: sceneTop + 200, y2: sceneBot - 100 },
      { x1: W * 0.3 + margin, x2: W - margin, y1: sceneBot - 120, y2: sceneBot - 85 },
    ];

    for (const itemDef of chosen) {
      // Ищем позицию, достаточно далёкую от уже размещённых предметов
      let x, y;
      let attempts = 0;
      do {
        const zone = Phaser.Utils.Array.GetRandom(zones);
        x = Phaser.Math.Between(zone.x1, zone.x2);
        y = Phaser.Math.Between(zone.y1, zone.y2);
        attempts++;
      } while (attempts < 30 && placed.some(p => Phaser.Math.Distance.Between(p.x, p.y, x, y) < MIN_DIST));

      // Рисуем интерактивный предмет (чуть ярче декора)
      const size = 24;
      const gfx  = this.add.graphics().setDepth(4);
      this._drawItemShape(gfx, itemDef, 0, 0, size, true);
      gfx.setPosition(x, y);

      // Символ предмета (чуть ярче)
      const txt = this.add.text(x, y - 1, itemDef.symbol, {
        fontFamily: 'Georgia, serif',
        fontSize:   `${size + 2}px`,
        color:      this._colorToHex(itemDef.color, 0.85),
        alpha:      0.85,
      }).setOrigin(0.5).setDepth(5);

      // Слабое «ауральное» свечение вокруг предмета
      const glowGfx = this.add.graphics().setDepth(3);
      glowGfx.fillStyle(itemDef.color, 0.07);
      glowGfx.fillCircle(0, 0, size + 8);
      glowGfx.setPosition(x, y);

      // Слабая пульсация свечения (едва заметная)
      this.tweens.add({
        targets:  glowGfx,
        alpha:    { from: 0.5, to: 1 },
        duration: Phaser.Math.Between(1800, 3000),
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
      });

      const itemData = {
        ...itemDef,
        x,
        y,
        gfx,
        txt,
        glowGfx,
        found: false,
      };

      this._interactiveItems.push(itemData);
      placed.push({ x, y });
    }
  }

  /**
   * Рисует форму предмета через Graphics относительно (0,0).
   * isInteractive = true → чуть ярче/насыщеннее.
   */
  _drawItemShape(gfx, item, cx, cy, size, isInteractive) {
    const alpha = isInteractive ? 0.5 : 0.18;
    const strokeAlpha = isInteractive ? 0.7 : 0.25;

    gfx.lineStyle(1, item.color, strokeAlpha);
    gfx.fillStyle(item.color, alpha);

    switch (item.id) {
      case 'orb':
        // Орб — круг с двойным контуром
        gfx.fillCircle(cx, cy, size);
        gfx.strokeCircle(cx, cy, size);
        gfx.fillStyle(item.color, alpha * 0.4);
        gfx.fillCircle(cx, cy, size * 1.5);
        break;

      case 'crystal':
        // Кристалл — вытянутый ромб
        gfx.fillTriangle(
          cx,           cy - size * 1.4,
          cx + size,    cy,
          cx - size,    cy
        );
        gfx.fillTriangle(
          cx - size,    cy,
          cx + size,    cy,
          cx,           cy + size * 0.8
        );
        gfx.strokeTriangle(
          cx,           cy - size * 1.4,
          cx + size,    cy,
          cx - size,    cy
        );
        break;

      case 'scroll':
        // Свиток — прямоугольник со скруглёнными краями
        gfx.fillRoundedRect(cx - size, cy - size * 0.7, size * 2, size * 1.4, size * 0.4);
        gfx.strokeRoundedRect(cx - size, cy - size * 0.7, size * 2, size * 1.4, size * 0.4);
        // Строки текста
        gfx.lineStyle(0.5, item.color, strokeAlpha * 0.5);
        for (let l = -1; l <= 1; l++) {
          gfx.lineBetween(cx - size * 0.6, cy + l * size * 0.3, cx + size * 0.6, cy + l * size * 0.3);
        }
        break;

      case 'star':
        // Звезда — пять треугольников
        this._drawStar(gfx, cx, cy, size, item.color, alpha, strokeAlpha);
        break;

      case 'potion':
        // Зелье — округлый флакон с горлышком
        gfx.fillEllipse(cx, cy + size * 0.3, size * 1.4, size * 1.2);
        gfx.strokeEllipse(cx, cy + size * 0.3, size * 1.4, size * 1.2);
        gfx.fillStyle(item.color, alpha * 1.5);
        gfx.fillRect(cx - size * 0.25, cy - size * 0.5, size * 0.5, size * 0.6);
        gfx.lineStyle(1, item.color, strokeAlpha);
        gfx.strokeRect(cx - size * 0.25, cy - size * 0.5, size * 0.5, size * 0.6);
        // Пробочка
        gfx.fillStyle(item.color, alpha * 1.2);
        gfx.fillRect(cx - size * 0.2, cy - size * 0.6, size * 0.4, size * 0.15);
        break;

      case 'book':
        // Книга — два прямоугольника (обложка и страницы)
        gfx.fillRoundedRect(cx - size, cy - size * 0.8, size * 2, size * 1.6, 3);
        gfx.strokeRoundedRect(cx - size, cy - size * 0.8, size * 2, size * 1.6, 3);
        // Корешок
        gfx.fillStyle(item.color, alpha * 1.4);
        gfx.fillRect(cx - size * 0.1, cy - size * 0.8, size * 0.2, size * 1.6);
        break;

      case 'feather':
        // Перо — вытянутый эллипс с линией
        gfx.fillEllipse(cx, cy, size * 0.7, size * 2.2);
        gfx.strokeEllipse(cx, cy, size * 0.7, size * 2.2);
        gfx.lineStyle(1, item.color, strokeAlpha * 0.8);
        gfx.lineBetween(cx, cy - size, cx, cy + size);
        break;

      case 'candle':
        // Свеча — прямоугольник + пламя-эллипс
        gfx.fillRect(cx - size * 0.3, cy, size * 0.6, size * 1.2);
        gfx.strokeRect(cx - size * 0.3, cy, size * 0.6, size * 1.2);
        // Пламя
        gfx.fillStyle(COLORS.SVETLYA, (isInteractive ? 0.8 : 0.3));
        gfx.fillEllipse(cx, cy - size * 0.5, size * 0.5, size * 0.9);
        gfx.fillStyle(COLORS.SVETLYA_LIGHT, (isInteractive ? 0.6 : 0.2));
        gfx.fillEllipse(cx, cy - size * 0.6, size * 0.25, size * 0.5);
        break;

      default:
        // Запасной вариант — кружок
        gfx.fillCircle(cx, cy, size * 0.8);
        gfx.strokeCircle(cx, cy, size * 0.8);
    }
  }

  /** Рисует пятиконечную звезду */
  _drawStar(gfx, cx, cy, size, color, fillAlpha, strokeAlpha) {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle  = (Math.PI / 5) * i - Math.PI / 2;
      const r      = (i % 2 === 0) ? size : size * 0.45;
      points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    gfx.fillPoints(points, true);
    gfx.strokePoints(points, true);
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD(W) {
    const companion = COMPANIONS[this._companionId];

    // Фон HUD
    const hudBg = this.add.graphics().setDepth(10);
    hudBg.fillStyle(0x0A0618, 0.9);
    hudBg.fillRect(0, 0, W, HiddenObjectScene.HUD_H);
    hudBg.lineStyle(1, companion.color, 0.18);
    hudBg.lineBetween(0, HiddenObjectScene.HUD_H, W, HiddenObjectScene.HUD_H);

    // Название игры
    this.add.text(W / 2, 14, 'Найди предметы', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(11);

    // ── Счёт (слева) ──
    this.add.text(20, 14, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0).setDepth(11);

    this._scoreTxt = this.add.text(20, 28, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      this._colorToHex(companion.color),
    }).setOrigin(0, 0).setDepth(11);

    // Прогресс найдено/всего
    this.add.text(20, 54, 'Найдено:', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0).setDepth(11);

    this._progressTxt = this.add.text(80, 54, `0 / ${this._itemCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      this._colorToHex(companion.color),
    }).setOrigin(0, 0).setDepth(11);

    // ── Таймер (справа) ──
    this.add.text(W - 20, 14, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0).setDepth(11);

    this._timerTxt = this.add.text(W - 20, 28, this._formatTime(this._timeLeft), {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0).setDepth(11);

    // Полоса таймера
    const barW  = 80;
    const barBg = this.add.graphics().setDepth(11);
    barBg.fillStyle(0x1A1030, 1);
    barBg.fillRoundedRect(W - barW - 20, 54, barW, 10, 5);

    this._timerBarGfx = this.add.graphics().setDepth(12);
    this._timerBarW   = barW;
    this._timerBarX   = W - barW - 20;
    this._updateTimerBar(companion.color);
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _updateTimerBar(companionColor) {
    const ratio = Math.max(0, this._timeLeft / this._maxTime);
    let barColor = companionColor || COMPANIONS[this._companionId].color;
    if (ratio < 0.3)      barColor = 0xFF4444;
    else if (ratio < 0.6) barColor = COLORS.BTN_PRIMARY;

    this._timerBarGfx.clear();
    this._timerBarGfx.fillStyle(barColor, 0.8);
    this._timerBarGfx.fillRoundedRect(
      this._timerBarX, 54,
      Math.max(4, Math.floor(this._timerBarW * ratio)), 10,
      5
    );
  }

  // ─── Панель предметов снизу ─────────────────────────────────────────────────

  _buildItemList(W, H) {
    const companion = COMPANIONS[this._companionId];
    const panelY    = H - HiddenObjectScene.LIST_H;
    const panelH    = HiddenObjectScene.LIST_H;

    // Фон панели
    const panelBg = this.add.graphics().setDepth(10);
    panelBg.fillStyle(0x08041A, 0.95);
    panelBg.fillRect(0, panelY, W, panelH);
    panelBg.lineStyle(1, companion.color, 0.2);
    panelBg.lineBetween(0, panelY, W, panelY);

    // Заголовок
    this.add.text(W / 2, panelY + 8, 'Найди все предметы', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      fontStyle:  'italic',
      color:      '#9A8AAA',
    }).setOrigin(0.5, 0).setDepth(11);

    // Иконки предметов
    const items    = this._interactiveItems;
    const cols     = Math.min(items.length, 4);
    const rows     = Math.ceil(items.length / cols);
    const cellW    = W / cols;
    const cellH    = (panelH - 30) / rows;

    this._listCells = []; // для обновления при нахождении

    items.forEach((item, idx) => {
      const col  = idx % cols;
      const row  = Math.floor(idx / cols);
      const cx   = cellW * col + cellW / 2;
      const cy   = panelY + 30 + row * cellH + cellH / 2;

      // Фон ячейки
      const cellBg = this.add.graphics().setDepth(10);
      cellBg.fillStyle(item.color, 0.07);
      cellBg.fillRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 2, cellW - 8, cellH - 4, 8);

      // Иконка-символ
      const iconTxt = this.add.text(cx, cy - 12, item.symbol, {
        fontFamily: 'Georgia, serif',
        fontSize:   '22px',
        color:      this._colorToHex(item.color),
      }).setOrigin(0.5).setDepth(11);

      // Подпись
      const labelTxt = this.add.text(cx, cy + 13, item.label, {
        fontFamily: 'Georgia, serif',
        fontSize:   '12px',
        fontStyle:  'bold',
        color:      '#C0B0D0',
      }).setOrigin(0.5).setDepth(11);

      // Галочка (скрыта до нахождения)
      const checkTxt = this.add.text(cx + 14, cy - 16, '✓', {
        fontFamily: 'Georgia, serif',
        fontSize:   '16px',
        color:      '#' + COLORS.SVETLYA.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(12).setAlpha(0);

      this._listCells.push({ item, iconTxt, labelTxt, checkTxt });
    });
  }

  // ─── Компаньон (орб в HUD) ──────────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];
    const ORB_SIZE  = 50;

    // Орб размещён в HUD — центр по вертикали
    const orbX = W / 2;
    const orbY = HiddenObjectScene.HUD_H / 2 - 4;

    // Свечение орба
    this._orbGlow = this.add.ellipse(orbX, orbY + 10, 60, 22, companion.color, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(12);

    // Орб компаньона (программный кружок с символом)
    this._orbGfx = this.add.graphics().setDepth(13);
    this._drawCompanionOrb(this._orbGfx, orbX, orbY, ORB_SIZE / 2, companion);

    // Пульсация
    this.tweens.add({
      targets:  this._orbGfx,
      scaleX:   1 + ANIM.PULSE_SCALE,
      scaleY:   1 + ANIM.PULSE_SCALE,
      duration: ANIM.PULSE_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    this._orbX = orbX;
    this._orbY = orbY;

    // Текст реакции (появляется рядом с правым краем HUD)
    this._reactionTxt = this.add.text(W - 16, HiddenObjectScene.HUD_H / 2, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      fontStyle:  'italic',
      color:      this._colorToHex(companion.color),
      align:      'right',
      wordWrap:   { width: W * 0.35 },
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(13);
  }

  /** Рисует программный орб компаньона */
  _drawCompanionOrb(gfx, x, y, r, companion) {
    gfx.clear();
    // Внешнее свечение
    gfx.fillStyle(companion.color, 0.12);
    gfx.fillCircle(x, y, r + 10);
    // Тело орба
    gfx.fillStyle(companion.color, 0.55);
    gfx.fillCircle(x, y, r);
    // Блик
    gfx.fillStyle(COLORS.WHITE, 0.25);
    gfx.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35);
    // Контур
    gfx.lineStyle(1.5, companion.color, 0.9);
    gfx.strokeCircle(x, y, r);
  }

  /** Анимация радости компаньона при нахождении предмета */
  _companionReact(text) {
    // Подпрыгивание орба
    this.tweens.add({
      targets:  this._orbGfx,
      y:        this._orbGfx.y - 12,
      duration: 180,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });

    // Краткое увеличение
    this.tweens.add({
      targets:  this._orbGfx,
      scaleX:   1.2, scaleY: 1.2,
      duration: 150,
      yoyo:     true,
    });

    // Показ реплики
    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1800,
      delay:    700,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Ввод ──────────────────────────────────────────────────────────────────

  _setupInput(W, H) {
    const sceneTop = HiddenObjectScene.HUD_H;
    const sceneBot = H - HiddenObjectScene.LIST_H;
    const sceneH   = sceneBot - sceneTop;

    // Интерактивная зона над игровой сценой
    const zone = this.add.zone(W / 2, sceneTop + sceneH / 2, W, sceneH)
      .setInteractive()
      .setDepth(8);

    zone.on('pointerdown', (pointer) => {
      if (this._gameOver || !this._timerStarted) return;
      this._onSceneTap(pointer.x, pointer.y);
    });
  }

  /** Обработчик нажатия на игровую сцену */
  _onSceneTap(tapX, tapY) {
    const HR = HiddenObjectScene.HIT_RADIUS;

    // Проверяем попадание в один из интерактивных предметов
    for (const item of this._interactiveItems) {
      if (item.found) continue;
      const dist = Phaser.Math.Distance.Between(tapX, tapY, item.x, item.y);
      if (dist <= HR) {
        this._onItemFound(item.id);
        return;
      }
    }

    // Промах
    this._onMiss(tapX, tapY);
  }

  // ─── Нахождение предмета ────────────────────────────────────────────────────

  _onItemFound(itemId) {
    const item = this._interactiveItems.find(i => i.id === itemId);
    if (!item || item.found) return;

    item.found = true;
    this._found++;

    // Начисляем очки
    this._score += HiddenObjectScene.ITEM_SCORE;
    this._updateHUD();

    // ── Анимация предмета на сцене ──
    // Вспышка подсветки
    const flashGfx = this.add.graphics().setDepth(6);
    flashGfx.fillStyle(item.color, 0.6);
    flashGfx.fillCircle(item.x, item.y, HiddenObjectScene.HIT_RADIUS + 8);
    flashGfx.setPosition(0, 0);

    // Кольцо расширяется и гаснет
    this.tweens.add({
      targets:  flashGfx,
      scaleX:   2.2,
      scaleY:   2.2,
      alpha:    0,
      duration: 500,
      ease:     'Quad.easeOut',
      onComplete: () => flashGfx.destroy(),
    });

    // Символ взлетает вверх и гаснет
    this.tweens.add({
      targets:  item.txt,
      y:        item.y - 50,
      alpha:    0,
      scaleX:   1.5,
      scaleY:   1.5,
      duration: 600,
      ease:     'Quad.easeOut',
      onComplete: () => {
        item.gfx.destroy();
        item.txt.destroy();
        item.glowGfx.destroy();
      },
    });

    this.tweens.add({
      targets:  item.gfx,
      alpha:    0,
      scaleX:   1.5,
      scaleY:   1.5,
      duration: 600,
      ease:     'Quad.easeOut',
    });

    // ── Обновление панели предметов ──
    const cell = this._listCells.find(c => c.item.id === itemId);
    if (cell) {
      // Зачёркиваем иконку
      this.tweens.add({
        targets:  cell.iconTxt,
        alpha:    0.3,
        duration: 300,
      });
      this.tweens.add({
        targets:  cell.labelTxt,
        alpha:    0.3,
        duration: 300,
      });
      // Показываем галочку
      cell.checkTxt.setAlpha(0);
      this.tweens.add({
        targets:  cell.checkTxt,
        alpha:    1,
        scaleX:   { from: 0, to: 1 },
        scaleY:   { from: 0, to: 1 },
        duration: 350,
        ease:     'Back.easeOut',
      });
    }

    // ── Реакция компаньона ──
    const companion = COMPANIONS[this._companionId];
    const reactions = [
      'Нашёл!',
      'Вот оно!',
      'Молодец!',
      companion.reactions.win.split(',')[0],
    ];
    this._companionReact(Phaser.Utils.Array.GetRandom(reactions));

    // ── Сбрасываем таймер подсказки ──
    this._scheduleHint();

    // ── Проверяем победу ──
    if (this._found >= this._itemCount) {
      this.time.delayedCall(600, () => this._endGame(true));
    }
  }

  // ─── Промах ────────────────────────────────────────────────────────────────

  _onMiss(x, y) {
    this._misses++;
    this._score = Math.max(0, this._score - HiddenObjectScene.MISS_PENALTY);
    this._updateHUD();

    // Красная вспышка в месте нажатия
    const flashGfx = this.add.graphics().setDepth(9);
    flashGfx.fillStyle(0xFF2244, 0.55);
    flashGfx.fillCircle(x, y, 18);

    this.tweens.add({
      targets:  flashGfx,
      scaleX:   2,
      scaleY:   2,
      alpha:    0,
      duration: 350,
      ease:     'Quad.easeOut',
      onComplete: () => flashGfx.destroy(),
    });

    // Крестик
    const crossTxt = this.add.text(x, y - 18, '✕', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#FF2244',
    }).setOrigin(0.5).setDepth(9).setAlpha(0.9);

    this.tweens.add({
      targets:  crossTxt,
      y:        crossTxt.y - 24,
      alpha:    0,
      duration: 700,
      ease:     'Quad.easeOut',
      onComplete: () => crossTxt.destroy(),
    });

    // Штраф текст
    const penaltyTxt = this.add.text(x + 10, y + 4, `-${HiddenObjectScene.MISS_PENALTY}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#FF6677',
    }).setOrigin(0.5).setDepth(9).setAlpha(0.9);

    this.tweens.add({
      targets:  penaltyTxt,
      y:        penaltyTxt.y - 20,
      alpha:    0,
      duration: 800,
      ease:     'Quad.easeOut',
      onComplete: () => penaltyTxt.destroy(),
    });
  }

  // ─── Подсказка ──────────────────────────────────────────────────────────────

  /** Планирует таймер подсказки; отменяет предыдущий если был */
  _scheduleHint() {
    // Гасим предыдущую подсказку
    if (this._hintTween) {
      this._hintTween.stop();
      this._hintTween = null;
    }
    if (this._hintGfx) {
      this._hintGfx.destroy();
      this._hintGfx = null;
    }
    if (this._hintTimer) {
      this._hintTimer.remove();
    }

    this._hintTimer = this.time.delayedCall(
      HiddenObjectScene.HINT_DELAY,
      this._showHint,
      [],
      this
    );
  }

  /** Показывает мерцание одного ненайденного предмета */
  _showHint() {
    if (this._gameOver) return;

    // Выбираем случайный ненайденный предмет
    const notFound = this._interactiveItems.filter(i => !i.found);
    if (notFound.length === 0) return;

    const target = Phaser.Utils.Array.GetRandom(notFound);

    // Рисуем мерцающее кольцо подсказки
    this._hintGfx = this.add.graphics().setDepth(7);
    this._hintGfx.lineStyle(2.5, COLORS.SVETLYA, 0.9);
    this._hintGfx.strokeCircle(target.x, target.y, HiddenObjectScene.HIT_RADIUS + 4);

    // Мерцание
    this._hintTween = this.tweens.add({
      targets:  this._hintGfx,
      alpha:    { from: 0, to: 1 },
      duration: 500,
      yoyo:     true,
      repeat:   5,
      ease:     'Sine.easeInOut',
      onComplete: () => {
        if (this._hintGfx) {
          this._hintGfx.destroy();
          this._hintGfx = null;
        }
      },
    });

    // Реакция компаньона: намекает
    const companion = COMPANIONS[this._companionId];
    this._companionReact('Поищи тут...');
  }

  // ─── Таймер ────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;

    this._timeLeft--;
    this._timerTxt.setText(this._formatTime(this._timeLeft));
    this._updateTimerBar(COMPANIONS[this._companionId].color);

    // Цвет таймера меняется при мало времени
    if (this._timeLeft <= 10) {
      this._timerTxt.setColor('#FF4444');
    } else if (this._timeLeft <= 20) {
      this._timerTxt.setColor('#FF9B4E');
    }

    if (this._timeLeft <= 0) {
      this._endGame(false);
    }
  }

  // ─── Обновление HUD ─────────────────────────────────────────────────────────

  _updateHUD() {
    this._scoreTxt.setText(this._score.toString());
    this._progressTxt.setText(`${this._found} / ${this._itemCount}`);

    // Анимация счёта
    this.tweens.add({
      targets:  this._scoreTxt,
      scaleX:   1.25, scaleY: 1.25,
      duration: 80,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Конец игры ─────────────────────────────────────────────────────────────

  _endGame(completed) {
    if (this._gameOver) return;
    this._gameOver = true;

    if (this._timerEvent) this._timerEvent.remove();
    if (this._hintTimer)  this._hintTimer.remove();
    if (this._hintTween)  this._hintTween.stop();
    if (this._hintGfx)    this._hintGfx.destroy();

    // Итоговый счёт
    if (completed) {
      this._score += HiddenObjectScene.BASE_SCORE;
    }
    this._score = Math.max(0, this._score - this._misses * HiddenObjectScene.MISS_PENALTY);

    // ── Звёзды ──
    // 3★ — все найдены за ≤40% времени
    // 2★ — все найдены
    // 1★ — ≥50% найдено
    let stars = 0;
    const elapsed   = this._maxTime - this._timeLeft;
    const ratio40   = this._maxTime * 0.4;

    if (completed && elapsed <= ratio40) {
      stars = 3;
    } else if (completed) {
      stars = 2;
    } else if (this._found >= Math.ceil(this._itemCount * 0.5)) {
      stars = 1;
    }

    this.time.delayedCall(400, () => this._showResultOverlay(stars, completed));
  }

  _showResultOverlay(stars, completed) {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.7, duration: 300 });

    // Карточка результата
    const cardY = H / 2 - 110;
    const cardH = 290;
    const card  = this.add.graphics().setDepth(31);
    card.fillStyle(0x0D0820, 0.97);
    card.fillRoundedRect(W / 2 - 145, cardY, 290, cardH, 20);
    card.lineStyle(1.5, companion.color, 0.55);
    card.strokeRoundedRect(W / 2 - 145, cardY, 290, cardH, 20);

    // Заголовок
    const title = completed ? 'Все предметы найдены!' : 'Время вышло';
    this.add.text(W / 2, cardY + 26, title, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#AA7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 60, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '36px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 108, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Статистика
    this.add.text(W / 2, cardY + 136, `Найдено: ${this._found} из ${this._itemCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    this.add.text(W / 2, cardY + 158, `Промахов: ${this._misses}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      this._misses > 0 ? '#BB6677' : '#6A9A6A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реакция компаньона
    const reactionKey = completed ? (stars === 3 ? 'win' : 'idle') : 'lose';
    const reaction    = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 186, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      this._colorToHex(companion.color),
      align:      'center',
      wordWrap:   { width: 240 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + cardH - 36, 'Продолжить', companion.color, stars, completed);

    // Частицы победы
    if (stars >= 2) {
      this._spawnWinParticles(W, H, companion.color);
    }
  }

  _buildResultBtn(x, y, label, color, stars, completed) {
    const BW = 200;
    const BH = 44;

    const bg = this.add.graphics().setDepth(33);
    bg.fillStyle(color, 0.28);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 22);
    bg.lineStyle(1.5, color, 0.7);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 22);

    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#FFF4E0',
    }).setOrigin(0.5).setDepth(34);

    const container = this.add.container(x, y, [bg, txt]).setDepth(33);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(35);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._finishGame(stars, completed);
    });
  }

  /** Частицы победы — символы предметов разлетаются */
  _spawnWinParticles(W, H, color) {
    const symbols  = HiddenObjectScene.ITEMS_POOL.map(i => i.symbol);
    const graphics = this.add.graphics().setDepth(29);
    const particles = [];

    for (let i = 0; i < 22; i++) {
      particles.push({
        x:      Phaser.Math.Between(60, W - 60),
        y:      Phaser.Math.Between(H * 0.25, H * 0.55),
        vx:     Phaser.Math.FloatBetween(-2, 2),
        vy:     Phaser.Math.FloatBetween(-3.5, -1),
        size:   Phaser.Math.FloatBetween(4, 9),
        color:  HiddenObjectScene.ITEMS_POOL[i % HiddenObjectScene.ITEMS_POOL.length].color,
        life:   1,
      });
    }

    let elapsed = 0;
    const updateFn = (time, delta) => {
      elapsed += delta;
      if (elapsed > 2200) {
        graphics.destroy();
        this.events.off('update', updateFn);
        return;
      }
      graphics.clear();
      for (const p of particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.06;
        p.life = Math.max(0, 1 - elapsed / 2200);
        graphics.fillStyle(p.color, p.life * 0.75);
        graphics.fillCircle(p.x, p.y, p.size * p.life);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Завершение и возврат ────────────────────────────────────────────────────

  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = { stars, score: this._score, timeMs, completed };

    if (typeof GameState !== 'undefined') {
      GameState.saveMiniGameResult
        ? GameState.saveMiniGameResult(this._chapter, this._mgIndex, result)
        : null;
    }

    this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);
    this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
      this.scene.start(GAME_CONFIG.SCENES.CHAPTER, {
        chapter:        this._chapter,
        miniGameIndex:  this._mgIndex,
        miniGameResult: result,
      });
    });
  }

  // ─── Вспомогательные методы ─────────────────────────────────────────────────

  /**
   * Конвертирует числовой цвет Phaser (0xRRGGBB) в CSS hex-строку '#rrggbb'.
   * opacity не применяется к строке цвета, но используется для визуальной
   * прозрачности через setAlpha() — здесь игнорируется.
   */
  _colorToHex(color, opacity) {
    return '#' + color.toString(16).padStart(6, '0');
  }
}
