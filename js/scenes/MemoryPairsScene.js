/**
 * MemoryPairsScene.js — Мини-игра «Пары памяти» («Искра и Эхо»)
 *
 * Механика: открыть две карточки → если символы совпадают — пара найдена,
 *           карточки исчезают с анимацией; если нет — закрываются через 800 мс.
 *           Нельзя нажать третью карточку, пока две открыты.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 *
 * Сетки:
 *   easy   — 4×3  (12 карт, 6 пар)
 *   normal — 4×4  (16 карт, 8 пар)
 *   hard   — 5×4  (20 карт, 10 пар)
 */

class MemoryPairsScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.MEMORY_PAIRS });
  }

  // ─── Константы ─────────────────────────────────────────────────────────────

  // Тайминг переворота (одна половина): scaleX 1→0 или 0→1
  static get T_FLIP_HALF()   { return 150; }
  // Пауза перед закрытием несовпавшей пары (мс)
  static get T_WRONG_DELAY() { return 800; }
  // Тайминг исчезновения найденной пары
  static get T_MATCH_OUT()   { return 300; }

  // Размеры карточки
  static get CARD_W()        { return 68; }
  static get CARD_H()        { return 80; }
  // Зазор между карточками
  static get CARD_GAP()      { return 8; }

  // Начисляемые очки
  static get SCORE_MATCH()   { return 100; }  // за найденную пару
  static get SCORE_MISS()    { return -10; }   // штраф за промах

  // Символы карточек (Unicode, 10 штук для hard)
  static get SYMBOLS() {
    return ['✦', '◈', '◎', '▦', '◉', '▣', '◌', '✿', '❋', '✶'];
  }

  // Цвета пар (используем именованные значения из COLORS)
  static get PAIR_COLORS() {
    return [
      COLORS.SVETLYA,      // золотой
      COLORS.DUH,          // голубой
      COLORS.TEN,          // фиолетовый
      COLORS.BTN_PRIMARY,  // оранжевый
      COLORS.ACCENT,       // коралловый
      COLORS.SVETLYA_DARK, // тёмно-золотой
      COLORS.DUH_DARK,     // тёмно-голубой
      COLORS.TEN_LIGHT,    // светло-фиолетовый
      COLORS.STAR,         // жёлтый
      COLORS.CARD_BORDER,  // тёплый бежевый
    ];
  }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || GameState.get('firstCompanion') || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    // Параметры сетки по сложности
    const GRIDS = {
      easy:   { cols: 4, rows: 3 },   // 12 карт = 6 пар
      normal: { cols: 4, rows: 4 },   // 16 карт = 8 пар
      hard:   { cols: 5, rows: 4 },   // 20 карт = 10 пар
    };
    const gridCfg = GRIDS[this._difficulty] || GRIDS.easy;
    this._cols = gridCfg.cols;
    this._rows = gridCfg.rows;
    this._totalPairs = (this._cols * this._rows) / 2;

    // Игровое состояние
    this._score        = 0;
    this._misses       = 0;       // число промахов
    this._foundPairs   = 0;       // найдено пар
    this._busy         = false;   // заблокирован ли ввод
    this._gameOver     = false;
    this._elapsed      = 0;       // секунд прошло

    // Данные карточек: массив объектов { pairId, symbol, color, faceUp, matched, container, gfx, txt }
    this._cards = [];

    // Две открытые (ожидающие проверки) карточки
    this._openCards = [];
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    // Вычисляем положение поля по центру экрана
    const STEP_X = MemoryPairsScene.CARD_W + MemoryPairsScene.CARD_GAP;
    const STEP_Y = MemoryPairsScene.CARD_H + MemoryPairsScene.CARD_GAP;
    const fieldW = this._cols * STEP_X - MemoryPairsScene.CARD_GAP;
    const fieldH = this._rows * STEP_Y - MemoryPairsScene.CARD_GAP;

    // Поле центруется вертикально между HUD (76px) и нижней панелью (110px)
    const topOffset = 86;       // нижняя граница HUD + небольшой отступ
    const bottomPad = 120;      // зона компаньона и кнопки «Сдаться»
    const availH = H - topOffset - bottomPad;
    this._fieldX = Math.floor((W - fieldW) / 2);
    this._fieldY = topOffset + Math.floor((availH - fieldH) / 2);

    // ── Фон ──
    this._drawBackground(W, H);

    // ── HUD ──
    this._buildHUD(W);

    // ── Карточки ──
    this._generateCards();
    this._drawCards();

    // ── Компаньон ──
    this._buildCompanion(W, H);

    // ── Кнопка «Сдаться» ──
    this._buildSurrenderBtn(W, H);

    // ── Таймер (счётчик времени, не ограничение) ──
    this._timerEvent = this.time.addEvent({
      delay:         1000,
      callback:      this._onTick,
      callbackScope: this,
      loop:          true,
    });

    // ── Fade-in ──
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Фон ────────────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const companion = COMPANIONS[this._companionId];

    // Тёмный градиент
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0D0820, 0x0D0820, 0x1A0F35, 0x1A0F35, 1);
    bg.fillRect(0, 0, W, H);

    // Слабый цветовой тон компаньона
    const glow = this.add.graphics();
    glow.fillStyle(companion.color, 0.04);
    glow.fillRect(0, 0, W, H);

    // Подложка под игровое поле
    const STEP_X = MemoryPairsScene.CARD_W + MemoryPairsScene.CARD_GAP;
    const STEP_Y = MemoryPairsScene.CARD_H + MemoryPairsScene.CARD_GAP;
    const fieldW = this._cols * STEP_X - MemoryPairsScene.CARD_GAP;
    const fieldH = this._rows * STEP_Y - MemoryPairsScene.CARD_GAP;
    const pad = 10;

    const fieldBg = this.add.graphics();
    fieldBg.fillStyle(0x0A0618, 0.6);
    fieldBg.fillRoundedRect(
      this._fieldX - pad,
      this._fieldY - pad,
      fieldW + pad * 2,
      fieldH + pad * 2,
      14
    );
    fieldBg.lineStyle(1, companion.color, 0.18);
    fieldBg.strokeRoundedRect(
      this._fieldX - pad,
      this._fieldY - pad,
      fieldW + pad * 2,
      fieldH + pad * 2,
      14
    );
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD(W) {
    const companion = COMPANIONS[this._companionId];
    const colorHex  = '#' + companion.color.toString(16).padStart(6, '0');

    // Фоновая полоса HUD
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0A0618, 0.85);
    hudBg.fillRect(0, 0, W, 76);
    hudBg.lineStyle(1, companion.color, 0.15);
    hudBg.lineBetween(0, 76, W, 76);

    // Название игры
    this.add.text(W / 2, 14, 'Пары памяти', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0);

    // Счёт (слева)
    this.add.text(16, 14, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._scoreTxt = this.add.text(16, 28, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      colorHex,
    }).setOrigin(0, 0);

    // Прогресс пар (внизу слева)
    this.add.text(16, 52, 'Найдено', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._pairsTxt = this.add.text(80, 52, `0 / ${this._totalPairs}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      colorHex,
    }).setOrigin(0, 0);

    // Таймер (справа) — считает сколько прошло
    this.add.text(W - 16, 14, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0);

    this._timerTxt = this.add.text(W - 16, 28, '0:00', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0);

    // Промахи (внизу справа)
    this.add.text(W - 16, 52, 'Промахи', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0);

    this._missesTxt = this.add.text(W - 80, 52, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#FF9B4E',
    }).setOrigin(1, 0);
  }

  // ─── Генерация карточек ─────────────────────────────────────────────────────

  /**
   * Создаёт массив данных карточек: каждый символ повторяется дважды (пара),
   * затем массив перемешивается алгоритмом Фишера-Йетса.
   */
  _generateCards() {
    const symbols = MemoryPairsScene.SYMBOLS;
    const colors  = MemoryPairsScene.PAIR_COLORS;
    const data    = [];

    for (let pairId = 0; pairId < this._totalPairs; pairId++) {
      const symbol = symbols[pairId % symbols.length];
      const color  = colors[pairId % colors.length];
      // Добавляем обе карточки пары
      data.push({ pairId, symbol, color });
      data.push({ pairId, symbol, color });
    }

    // Перемешиваем (Fisher-Yates)
    for (let i = data.length - 1; i > 0; i--) {
      const j = Phaser.Math.Between(0, i);
      [data[i], data[j]] = [data[j], data[i]];
    }

    this._cardData = data;
  }

  // ─── Отрисовка карточек ─────────────────────────────────────────────────────

  _drawCards() {
    const STEP_X = MemoryPairsScene.CARD_W + MemoryPairsScene.CARD_GAP;
    const STEP_Y = MemoryPairsScene.CARD_H + MemoryPairsScene.CARD_GAP;
    const CW     = MemoryPairsScene.CARD_W;
    const CH     = MemoryPairsScene.CARD_H;

    this._cards = [];

    for (let i = 0; i < this._cardData.length; i++) {
      const col = i % this._cols;
      const row = Math.floor(i / this._cols);

      const cx = this._fieldX + col * STEP_X + CW / 2;
      const cy = this._fieldY + row * STEP_Y + CH / 2;

      const cardObj = this._createCardObject(i, cx, cy);
      this._cards.push(cardObj);
    }
  }

  /**
   * Создаёт один визуальный объект карточки.
   * faceUp=false → рубашка, faceUp=true → лицо с символом.
   */
  _createCardObject(index, cx, cy) {
    const { pairId, symbol, color } = this._cardData[index];
    const CW = MemoryPairsScene.CARD_W;
    const CH = MemoryPairsScene.CARD_H;

    // ── Рубашка ──
    const backGfx = this.add.graphics();
    this._drawCardBack(backGfx, CW, CH);

    // ── Лицо карточки ──
    const faceGfx = this.add.graphics();
    this._drawCardFace(faceGfx, CW, CH, color);

    // Символ на лице
    const faceTxt = this.add.text(0, 2, symbol, {
      fontFamily: 'Georgia, serif',
      fontSize:   '26px',
      color:      '#' + color.toString(16).padStart(6, '0'),
      align:      'center',
    }).setOrigin(0.5);

    // По умолчанию лицо скрыто
    faceGfx.setVisible(false);
    faceTxt.setVisible(false);

    // Контейнер = вся карточка
    const container = this.add.container(cx, cy, [backGfx, faceGfx, faceTxt]).setDepth(5);

    // Интерактивная зона (вся карточка)
    const hitZone = this.add.zone(0, 0, CW, CH)
      .setInteractive({ useHandCursor: true });

    container.add(hitZone);

    hitZone.on('pointerdown', () => this._onCardClick(index));

    const cardObj = {
      index,
      pairId,
      symbol,
      color,
      faceUp:    false,
      matched:   false,
      container,
      backGfx,
      faceGfx,
      faceTxt,
      hitZone,
    };

    return cardObj;
  }

  /** Рисует рубашку карточки (тёмно-фиолетовая с узором) */
  _drawCardBack(gfx, CW, CH) {
    const halfW = CW / 2;
    const halfH = CH / 2;
    const r     = 10; // радиус скругления

    // Основной фон рубашки
    gfx.fillStyle(COLORS.BG_DAWN, 1);
    gfx.fillRoundedRect(-halfW, -halfH, CW, CH, r);

    // Обводка
    gfx.lineStyle(1.5, COLORS.TEN, 0.5);
    gfx.strokeRoundedRect(-halfW, -halfH, CW, CH, r);

    // Декоративный маленький ромб в центре
    gfx.lineStyle(1, COLORS.TEN_LIGHT, 0.35);
    const ds = 10;
    gfx.strokeRect(-ds, -ds, ds * 2, ds * 2); // упрощённый квадрат-ромб

    // Четыре точки по углам
    gfx.fillStyle(COLORS.TEN_LIGHT, 0.2);
    const dp = 6;
    gfx.fillCircle(-halfW + dp, -halfH + dp, 2.5);
    gfx.fillCircle( halfW - dp, -halfH + dp, 2.5);
    gfx.fillCircle(-halfW + dp,  halfH - dp, 2.5);
    gfx.fillCircle( halfW - dp,  halfH - dp, 2.5);
  }

  /** Рисует лицо карточки с уникальным цветом пары */
  _drawCardFace(gfx, CW, CH, color) {
    const halfW = CW / 2;
    const halfH = CH / 2;
    const r     = 10;

    // Светлый фон лица
    gfx.fillStyle(0x0D0820, 1);
    gfx.fillRoundedRect(-halfW, -halfH, CW, CH, r);

    // Цветовое заполнение (тон пары)
    gfx.fillStyle(color, 0.18);
    gfx.fillRoundedRect(-halfW, -halfH, CW, CH, r);

    // Обводка цветом пары
    gfx.lineStyle(2, color, 0.75);
    gfx.strokeRoundedRect(-halfW, -halfH, CW, CH, r);

    // Внутренняя тонкая рамка
    gfx.lineStyle(1, color, 0.3);
    gfx.strokeRoundedRect(-halfW + 4, -halfH + 4, CW - 8, CH - 8, r - 2);
  }

  // ─── Обработка нажатий ──────────────────────────────────────────────────────

  _onCardClick(index) {
    if (this._busy || this._gameOver) return;

    const card = this._cards[index];

    // Нельзя нажать на уже открытую или совпавшую карточку
    if (card.faceUp || card.matched) return;

    // Нельзя выбрать третью карточку, пока открыты две
    if (this._openCards.length >= 2) return;

    // Открываем карточку
    this._flipCard(card, true, () => {
      this._openCards.push(card);

      if (this._openCards.length === 2) {
        // Блокируем ввод на время проверки
        this._busy = true;
        this._checkPair();
      }
    });
  }

  // ─── Анимация переворота ────────────────────────────────────────────────────

  /**
   * Анимация переворота карточки.
   * @param {Object} card    — объект карточки
   * @param {boolean} toFace — true = открыть лицо, false = закрыть (рубашка)
   * @param {Function} [onComplete]
   */
  _flipCard(card, toFace, onComplete) {
    const T = MemoryPairsScene.T_FLIP_HALF;

    // Первая половина: scaleX 1 → 0
    this.tweens.add({
      targets:  card.container,
      scaleX:   0,
      duration: T,
      ease:     'Quad.easeIn',
      onComplete: () => {
        // Меняем видимость граней
        if (toFace) {
          card.backGfx.setVisible(false);
          card.faceGfx.setVisible(true);
          card.faceTxt.setVisible(true);
        } else {
          card.backGfx.setVisible(true);
          card.faceGfx.setVisible(false);
          card.faceTxt.setVisible(false);
        }
        card.faceUp = toFace;

        // Вторая половина: scaleX 0 → 1
        this.tweens.add({
          targets:  card.container,
          scaleX:   1,
          duration: T,
          ease:     'Quad.easeOut',
          onComplete: () => {
            if (onComplete) onComplete();
          },
        });
      },
    });
  }

  // ─── Проверка пары ──────────────────────────────────────────────────────────

  _checkPair() {
    const [cardA, cardB] = this._openCards;

    if (cardA.pairId === cardB.pairId) {
      // ── Совпадение ──
      this._score = Math.max(0, this._score + MemoryPairsScene.SCORE_MATCH);
      this._foundPairs++;
      this._updateHUD();

      // Реакция компаньона: подпрыгнуть
      this._companionReact('win');

      // Небольшая пауза, затем убираем пару
      this.time.delayedCall(400, () => {
        this._removePair(cardA, cardB, () => {
          this._openCards = [];
          this._busy = false;

          // Проверяем победу
          if (this._foundPairs >= this._totalPairs) {
            this._endGame(true);
          }
        });
      });
    } else {
      // ── Промах ──
      this._misses++;
      this._score = Math.max(0, this._score + MemoryPairsScene.SCORE_MISS);
      this._updateHUD();

      // Реакция компаньона: покачаться
      this._companionReact('miss');

      // Лёгкое потряхивание карточек при промахе
      this._shakeCards([cardA, cardB]);

      // Закрываем через 800 мс
      this.time.delayedCall(MemoryPairsScene.T_WRONG_DELAY, () => {
        let flipsLeft = 2;
        const onFlipDone = () => {
          flipsLeft--;
          if (flipsLeft === 0) {
            this._openCards = [];
            this._busy = false;
          }
        };
        this._flipCard(cardA, false, onFlipDone);
        this._flipCard(cardB, false, onFlipDone);
      });
    }
  }

  /** Анимация исчезновения найденной пары */
  _removePair(cardA, cardB, onComplete) {
    const T   = MemoryPairsScene.T_MATCH_OUT;
    let done  = 0;
    const check = () => { if (++done >= 2) onComplete(); };

    const removeCard = (card) => {
      card.matched = true;
      card.hitZone.disableInteractive();

      // Вспышка свечения цветом пары
      this.tweens.add({
        targets:  card.container,
        scaleX:   1.15,
        scaleY:   1.15,
        duration: T / 2,
        yoyo:     true,
        ease:     'Quad.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets:  card.container,
            alpha:    0,
            scaleX:   0.6,
            scaleY:   0.6,
            duration: T,
            ease:     'Quad.easeIn',
            onComplete: () => {
              card.container.setVisible(false);
              check();
            },
          });
        },
      });
    };

    removeCard(cardA);
    removeCard(cardB);
  }

  /** Небольшое горизонтальное дрожание карточек при промахе */
  _shakeCards(cards) {
    for (const card of cards) {
      const origX = card.container.x;
      this.tweens.add({
        targets:  card.container,
        x:        origX + 5,
        duration: 60,
        yoyo:     true,
        repeat:   2,
        ease:     'Sine.easeInOut',
        onComplete: () => {
          card.container.x = origX;
        },
      });
    }
  }

  // ─── Компаньон ──────────────────────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];
    const ORB_SIZE  = 60;
    const orbX      = W - 50;
    const orbY      = H - 80;

    // Тень-свечение под орбом
    this._orbGlow = this.add.ellipse(orbX, orbY + 12, 70, 26, companion.color, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);

    // Орб компаньона
    this._orbSprite = this.add.graphics().setDepth(5);
    this._drawOrb(this._orbSprite, orbX, orbY, ORB_SIZE, companion);
    this._orbX = orbX;
    this._orbY = orbY;

    // Парение
    this.tweens.add({
      targets:  this._orbSprite,
      y:        -ANIM.FLOAT_AMPLITUDE,
      duration: ANIM.FLOAT_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Пульсация свечения
    this.tweens.add({
      targets:  this._orbGlow,
      alpha:    { from: 0.08, to: 0.22 },
      duration: 2000,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Текст реакции
    this._reactionTxt = this.add.text(orbX - ORB_SIZE / 2 - 10, orbY, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'right',
      wordWrap:   { width: W - ORB_SIZE - 60 },
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(6);
  }

  /** Рисует орб (окружность с цветом компаньона) */
  _drawOrb(gfx, x, y, size, companion) {
    const r = size / 2;
    gfx.fillStyle(companion.color, 0.3);
    gfx.fillCircle(x, y, r + 4);
    gfx.fillStyle(companion.colorLight || companion.color, 0.6);
    gfx.fillCircle(x, y, r);
    gfx.fillStyle(COLORS.WHITE, 0.15);
    gfx.fillCircle(x - r * 0.25, y - r * 0.25, r * 0.35);
  }

  /**
   * Реакция компаньона:
   *   'win'  — подпрыгнуть (пара найдена)
   *   'miss' — покачаться вправо-влево (промах)
   */
  _companionReact(type) {
    const companion = COMPANIONS[this._companionId];

    if (type === 'win') {
      // Подпрыгивание
      this.tweens.add({
        targets:  this._orbSprite,
        y:        `-=${ANIM.FLOAT_AMPLITUDE * 2.5}`,
        duration: 180,
        yoyo:     true,
        ease:     'Quad.easeOut',
      });
      this._showReaction(companion.reactions.win);
    } else {
      // Покачивание
      this.tweens.add({
        targets:  this._orbSprite,
        x:        `+=${6}`,
        duration: 90,
        yoyo:     true,
        repeat:   2,
        ease:     'Sine.easeInOut',
        onComplete: () => {
          this._orbSprite.x = 0; // возврат (Graphics позиционирован абсолютно)
        },
      });
      this._showReaction(companion.reactions.think);
    }
  }

  _showReaction(text) {
    if (!text) return;
    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1500,
      delay:    900,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Кнопка «Сдаться» ───────────────────────────────────────────────────────

  _buildSurrenderBtn(W, H) {
    const BW = 120;
    const BH = 36;
    const x  = 64;
    const y  = H - 80;

    const bg = this.add.graphics();
    bg.fillStyle(0x2A1530, 0.8);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 18);
    bg.lineStyle(1, 0x4A2A5A, 0.6);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 18);

    const txt = this.add.text(0, 0, 'Сдаться', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#6A4A7A',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]).setDepth(10);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._endGame(false);
    });
  }

  // ─── Таймер ─────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;
    this._elapsed++;
    this._timerTxt.setText(this._formatTime(this._elapsed));
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ─── Обновление HUD ─────────────────────────────────────────────────────────

  _updateHUD() {
    this._scoreTxt.setText(this._score.toString());
    this._pairsTxt.setText(`${this._foundPairs} / ${this._totalPairs}`);
    this._missesTxt.setText(this._misses.toString());

    // Анимация «подпрыгивания» счёта
    this.tweens.add({
      targets:  this._scoreTxt,
      scaleX:   1.25,
      scaleY:   1.25,
      duration: 80,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Конец игры ─────────────────────────────────────────────────────────────

  _endGame(completed) {
    if (this._gameOver) return;
    this._gameOver = true;
    this._busy     = true;

    if (this._timerEvent) this._timerEvent.remove();

    // Вычисляем звёзды:
    //   3★ — 0 или 1 промах
    //   2★ — промахов ≤ N пар / 2
    //   1★ — игра завершена (все пары) или сдался с > 0 найденными
    let stars = 0;
    if (completed) {
      if (this._misses <= 1)                           stars = 3;
      else if (this._misses <= this._totalPairs / 2)   stars = 2;
      else                                             stars = 1;
    } else if (this._foundPairs > 0) {
      stars = 1; // сдался, но хоть что-то нашёл
    }

    this.time.delayedCall(350, () => {
      this._showResultOverlay(stars, completed);
    });
  }

  // ─── Оверлей результата ─────────────────────────────────────────────────────

  _showResultOverlay(stars, completed) {
    const W        = GAME_CONFIG.WIDTH;
    const H        = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.7, duration: 300 });

    // Карточка результата
    const cardY  = H / 2 - 100;
    const cardGfx = this.add.graphics().setDepth(31);
    cardGfx.fillStyle(0x0D0820, 0.96);
    cardGfx.fillRoundedRect(W / 2 - 145, cardY, 290, 280, 20);
    cardGfx.lineStyle(1.5, companion.color, 0.5);
    cardGfx.strokeRoundedRect(W / 2 - 145, cardY, 290, 280, 20);

    // Заголовок
    const titleText = completed ? 'Все пары найдены!' : 'Игра завершена';
    this.add.text(W / 2, cardY + 28, titleText, {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#AA7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 64, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '36px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 114, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Детали
    this.add.text(W / 2, cardY + 144, `Пары: ${this._foundPairs} / ${this._totalPairs}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    this.add.text(W / 2, cardY + 166, `Промахи: ${this._misses}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#7A6A5A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Время
    this.add.text(W / 2, cardY + 188, `Время: ${this._formatTime(this._elapsed)}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#7A6A5A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реплика компаньона
    const reactionKey = completed ? (stars === 3 ? 'win' : 'idle') : 'lose';
    const reaction    = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 212, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: 250 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + 252, 'Продолжить', companion.color, stars, completed);

    // Частицы при хорошем результате
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

  // ─── Частицы победы ─────────────────────────────────────────────────────────

  _spawnWinParticles(W, H, color) {
    const graphics = this.add.graphics().setDepth(29);
    const particles = [];

    for (let i = 0; i < 30; i++) {
      particles.push({
        x:    Phaser.Math.Between(40, W - 40),
        y:    Phaser.Math.Between(H * 0.15, H * 0.55),
        vx:   Phaser.Math.FloatBetween(-1.8, 1.8),
        vy:   Phaser.Math.FloatBetween(-3.5, -1),
        size: Phaser.Math.FloatBetween(3, 8),
        life: 1,
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
      const t = elapsed / 2200;
      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.06;
        p.life = Math.max(0, 1 - t);
        graphics.fillStyle(color, p.life * 0.85);
        graphics.fillCircle(p.x, p.y, p.size * p.life);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Завершение и возврат ────────────────────────────────────────────────────

  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = {
      stars,
      score:     this._score,
      timeMs,
      completed,
    };

    this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);
    this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
      this.scene.start(GAME_CONFIG.SCENES.CHAPTER, {
        chapter:        this._chapter,
        miniGameIndex:  this._mgIndex,
        miniGameResult: result,
      });
    });
  }
}
