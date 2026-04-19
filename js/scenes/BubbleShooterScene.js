/**
 * BubbleShooterScene.js — Мини-игра «Пузырьковый шутер» для «Искра и Эхо»
 *
 * Механика: игрок стреляет цветными пузырями вверх, 3+ одного цвета → лопаются.
 * Пузыри прилипают к hex-сетке, «висячие» (без связи с потолком) падают вниз.
 * Каждые N секунд сетка опускается на строку вниз. При достижении нижней зоны — проигрыш.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 */

class BubbleShooterScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.BUBBLE });
  }

  // ─── Константы ──────────────────────────────────────────────────────────────

  // Размер пузыря (радиус)
  static get BUBBLE_R()      { return 22; }
  // Количество колонок hex-сетки
  static get COLS()          { return 8; }
  // Максимальное число строк в сетке
  static get MAX_ROWS()      { return 14; }
  // Y-координата «опасной зоны» — ниже неё пузыри недопустимы
  static get DANGER_Y()      { return GAME_CONFIG.HEIGHT - 160; }
  // Высота HUD сверху
  static get HUD_H()         { return 80; }
  // Y верхнего края игрового поля (под HUD)
  static get FIELD_TOP()     { return BubbleShooterScene.HUD_H + 8; }
  // Скорость снаряда (пикс/мс в update)
  static get PROJ_SPEED()    { return 0.55; }

  // Очки
  static get SCORE_POP()     { return 10; }   // за один лопнувший пузырь
  static get SCORE_FLOAT()   { return 25; }   // за один падающий (висячий)
  static get COMBO_MULT()    { return 1.3; }  // множитель при каждом последующем combo

  // Цвета пузырей (индекс → hex-цвет из COLORS)
  static get BUBBLE_COLORS() {
    return [
      COLORS.SVETLYA,     // 0 — золотой
      COLORS.DUH,         // 1 — голубой
      COLORS.TEN,         // 2 — фиолетовый
      COLORS.BTN_PRIMARY, // 3 — оранжевый
      COLORS.ACCENT,      // 4 — коралловый (только hard)
    ];
  }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || (GameState ? GameState.get('firstCompanion') : null) || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    // Параметры сложности
    const DIFF_CFG = {
      easy:   { initRows: 8,  colorCount: 4, addRowSec: 20, timeSec: 180 },
      normal: { initRows: 10, colorCount: 4, addRowSec: 15, timeSec: 150 },
      hard:   { initRows: 12, colorCount: 5, addRowSec: 10, timeSec: 120 },
    };
    const cfg = DIFF_CFG[this._difficulty] || DIFF_CFG.easy;
    this._initRows   = cfg.initRows;
    this._colorCount = cfg.colorCount;
    this._addRowSec  = cfg.addRowSec;
    this._timeSec    = cfg.timeSec;
    this._timeLeft   = cfg.timeSec;

    this._score        = 0;
    this._totalBubbles = 0;  // сколько пузырей было изначально
    this._poppedTotal  = 0;  // сколько всего лопнуло / упало
    this._comboCount   = 0;  // текущее combo
    this._gameOver     = false;
    this._shooting     = false; // снаряд в полёте

    // 2D сетка: _grid[row][col] = colorIdx (0-4) или -1 (пусто)
    // row=0 — верхняя строка (потолок)
    this._grid = [];

    // Визуальные объекты пузырей: _bubbleGfx[row][col] = Graphics или null
    this._bubbleGfx = [];

    // Снаряд: { x, y, vx, vy, colorIdx, gfx }
    this._projectile = null;

    // Следующий цвет снаряда
    this._nextColorIdx = 0;

    // Счётчик до добавления новой строки (тики таймера)
    this._addRowCounter = 0;

    // Графика для прицельной линии
    this._aimGraphics  = null;

    // Пушка: X центр, Y позиция
    this._gunX = GAME_CONFIG.WIDTH / 2;
    this._gunY = BubbleShooterScene.DANGER_Y + 30;

    // Флаг — блокировать ввод пока сетка анимируется
    this._gridBusy = false;
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    this._drawBackground(W, H);
    this._buildHUD(W);
    this._buildGrid();
    this._drawDangerLine(W);
    this._buildGun(W);
    this._buildCompanion(W, H);
    this._buildSurrenderBtn(W, H);

    // Линия прицела
    this._aimGraphics = this.add.graphics().setDepth(8);

    // Подготавливаем первые два снаряда
    this._currentColorIdx = this._randomColor();
    this._nextColorIdx    = this._randomColor();
    this._drawCurrentBubble();
    this._drawNextBubble();

    // Ввод (tap/click)
    this.input.on('pointerdown', this._onPointerDown, this);
    this.input.on('pointermove', this._onPointerMove, this);

    // Таймер: тикает раз в секунду
    this._timerEvent = this.time.addEvent({
      delay:         1000,
      callback:      this._onTick,
      callbackScope: this,
      loop:          true,
    });

    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Фон ────────────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const companion = COMPANIONS[this._companionId];

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x08041A, 0x08041A, 0x120828, 0x120828, 1);
    bg.fillRect(0, 0, W, H);

    // Тонкое свечение компаньона по всему фону
    const glow = this.add.graphics();
    glow.fillStyle(companion.color, 0.03);
    glow.fillRect(0, 0, W, H);

    // Подложка под игровое поле
    const fieldBg = this.add.graphics();
    fieldBg.fillStyle(0x05020F, 0.6);
    fieldBg.fillRoundedRect(8, BubbleShooterScene.FIELD_TOP - 4, W - 16, BubbleShooterScene.DANGER_Y - BubbleShooterScene.FIELD_TOP, 10);
    fieldBg.lineStyle(1, companion.color, 0.15);
    fieldBg.strokeRoundedRect(8, BubbleShooterScene.FIELD_TOP - 4, W - 16, BubbleShooterScene.DANGER_Y - BubbleShooterScene.FIELD_TOP, 10);
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD(W) {
    const companion = COMPANIONS[this._companionId];

    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x080418, 0.9);
    hudBg.fillRect(0, 0, W, BubbleShooterScene.HUD_H);
    hudBg.lineStyle(1, companion.color, 0.15);
    hudBg.lineBetween(0, BubbleShooterScene.HUD_H, W, BubbleShooterScene.HUD_H);

    // Название
    this.add.text(W / 2, 12, 'Пузырьковый шутер', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0);

    // Счёт (слева)
    this.add.text(16, 12, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._scoreTxt = this.add.text(16, 26, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#' + COLORS.SVETLYA.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Прогресс (убрано пузырей)
    this._progressTxt = this.add.text(16, 54, 'Убрано: 0%', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Таймер (справа)
    this.add.text(W - 16, 12, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0);

    this._timerTxt = this.add.text(W - 16, 26, this._formatTime(this._timeLeft), {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0);

    // Полоска таймера
    this._timerBarBg = this.add.graphics();
    this._timerBarBg.fillStyle(0x1A0F30, 1);
    this._timerBarBg.fillRoundedRect(W - 82, 54, 66, 10, 5);

    this._timerBar = this.add.graphics();
    this._drawTimerBar();
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _drawTimerBar() {
    const W = GAME_CONFIG.WIDTH;
    const companion = COMPANIONS[this._companionId];
    const ratio = Math.max(0, this._timeLeft / this._timeSec);

    let barColor = companion.color;
    if (ratio < 0.25) barColor = 0xFF4444;
    else if (ratio < 0.5) barColor = COLORS.BTN_PRIMARY;

    this._timerBar.clear();
    this._timerBar.fillStyle(barColor, 0.85);
    this._timerBar.fillRoundedRect(W - 82, 54, Math.ceil(66 * ratio), 10, 5);
  }

  // ─── Построение начальной сетки ─────────────────────────────────────────────

  _buildGrid() {
    const COLS = BubbleShooterScene.COLS;

    // Инициализируем пустую сетку
    for (let r = 0; r < BubbleShooterScene.MAX_ROWS; r++) {
      this._grid[r]      = new Array(COLS).fill(-1);
      this._bubbleGfx[r] = new Array(COLS).fill(null);
    }

    // Заполняем начальные строки случайными пузырями
    for (let r = 0; r < this._initRows; r++) {
      for (let c = 0; c < COLS; c++) {
        // Нечётные строки сдвинуты — крайний правый пузырь может выходить за экран,
        // поэтому для нечётных строк используем COLS-1 пузырей
        const isOdd  = (r % 2 === 1);
        const maxCol = isOdd ? COLS - 1 : COLS;
        if (c >= maxCol) continue;

        this._grid[r][c] = this._randomColor();
      }
    }

    // Считаем начальное количество пузырей
    this._totalBubbles = this._countBubbles();

    // Отрисовываем все пузыри
    this._redrawAllBubbles();
  }

  /** Возвращает количество пузырей в сетке */
  _countBubbles() {
    let count = 0;
    for (let r = 0; r < BubbleShooterScene.MAX_ROWS; r++) {
      for (let c = 0; c < BubbleShooterScene.COLS; c++) {
        if (this._grid[r][c] >= 0) count++;
      }
    }
    return count;
  }

  /** Перерисовывает все пузыри с нуля (используется при сдвиге сетки) */
  _redrawAllBubbles() {
    // Уничтожаем старые объекты
    for (let r = 0; r < BubbleShooterScene.MAX_ROWS; r++) {
      for (let c = 0; c < BubbleShooterScene.COLS; c++) {
        if (this._bubbleGfx[r][c]) {
          this._bubbleGfx[r][c].destroy();
          this._bubbleGfx[r][c] = null;
        }
      }
    }

    // Рисуем заново
    for (let r = 0; r < BubbleShooterScene.MAX_ROWS; r++) {
      for (let c = 0; c < BubbleShooterScene.COLS; c++) {
        if (this._grid[r][c] >= 0) {
          const pos = this._cellToXY(c, r);
          this._bubbleGfx[r][c] = this._drawBubble(pos.x, pos.y, this._grid[r][c]);
        }
      }
    }
  }

  // ─── Координатные утилиты ────────────────────────────────────────────────────

  /**
   * Возвращает пиксельные координаты центра ячейки hex-сетки.
   * Нечётные строки сдвинуты на половину ширины ячейки вправо.
   */
  _cellToXY(col, row) {
    const R    = BubbleShooterScene.BUBBLE_R;
    const diam = R * 2;
    // Вертикальный шаг hex-сетки (строки «прижаты» — высота * 0.866)
    const rowH  = diam * 0.88;
    const isOdd = (row % 2 === 1);
    const offsetX = isOdd ? R : 0;

    // Горизонтальный шаг = диаметр (без зазора, пузыри касаются)
    const startX = 8 + R;
    const x = startX + col * diam + offsetX;
    const y = BubbleShooterScene.FIELD_TOP + R + row * rowH;
    return { x, y };
  }

  /**
   * По пиксельным координатам возвращает ближайшую свободную ячейку сетки.
   * Перебирает все ячейки и находит ближайшую пустую.
   */
  _snapToGrid(px, py) {
    const R    = BubbleShooterScene.BUBBLE_R;
    const COLS = BubbleShooterScene.COLS;
    const ROWS = BubbleShooterScene.MAX_ROWS;
    let bestDist = Infinity;
    let bestR = 0, bestC = 0;

    for (let r = 0; r < ROWS; r++) {
      const maxCol = (r % 2 === 1) ? COLS - 1 : COLS;
      for (let c = 0; c < maxCol; c++) {
        if (this._grid[r][c] >= 0) continue; // занята
        const pos  = this._cellToXY(c, r);
        const dist = Math.hypot(pos.x - px, pos.y - py);
        if (dist < bestDist) {
          bestDist = dist;
          bestR = r;
          bestC = c;
        }
      }
    }

    // Принимаем ячейку, только если она достаточно близко
    if (bestDist <= R * 2.5) {
      return { row: bestR, col: bestC };
    }
    return null;
  }

  // ─── Отрисовка одного пузыря ─────────────────────────────────────────────────

  /**
   * Рисует пузырь как Graphics-объект по центру (x, y).
   * Возвращает Graphics для последующего управления.
   */
  _drawBubble(x, y, colorIdx, scale = 1, alpha = 1) {
    const R     = Math.round(BubbleShooterScene.BUBBLE_R * scale);
    const color = BubbleShooterScene.BUBBLE_COLORS[colorIdx];
    const gfx   = this.add.graphics().setDepth(5).setAlpha(alpha);

    // Тень-свечение снаружи
    gfx.fillStyle(color, 0.18);
    gfx.fillCircle(x, y, R + 5);

    // Основной круг с заливкой
    gfx.fillStyle(color, 0.75);
    gfx.fillCircle(x, y, R);

    // Внутренний тёмный «объём»
    gfx.fillStyle(0x000000, 0.15);
    gfx.fillCircle(x + 2, y + 3, R - 4);

    // Обводка
    gfx.lineStyle(1.5, color, 0.9);
    gfx.strokeCircle(x, y, R);

    // Блик (белый эллипс сверху-слева, 30% alpha)
    gfx.fillStyle(COLORS.WHITE, 0.30);
    gfx.fillEllipse(x - R * 0.28, y - R * 0.30, R * 0.55, R * 0.32);

    return gfx;
  }

  // ─── Пушка и снаряды ────────────────────────────────────────────────────────

  _buildGun(W) {
    const gx = this._gunX;
    const gy = this._gunY;

    // Подставка пушки
    this._gunGraphics = this.add.graphics().setDepth(7);
    this._gunGraphics.fillStyle(0x1A0F35, 0.9);
    this._gunGraphics.fillRoundedRect(gx - 30, gy - 10, 60, 20, 10);
    this._gunGraphics.lineStyle(1, 0x4A3060, 0.8);
    this._gunGraphics.strokeRoundedRect(gx - 30, gy - 10, 60, 20, 10);

    // Ствол (будет вращаться — рисуем отдельно)
    this._barrelGraphics = this.add.graphics().setDepth(7);
    this._drawBarrel(gx, gy, -Math.PI / 2); // по умолчанию смотрит вверх
  }

  _drawBarrel(gx, gy, angle) {
    const LEN = 28;
    const THICK = 5;
    this._barrelGraphics.clear();
    this._barrelGraphics.lineStyle(THICK, 0x8070A0, 0.9);
    this._barrelGraphics.lineBetween(
      gx, gy,
      gx + Math.cos(angle) * LEN,
      gy + Math.sin(angle) * LEN
    );
    this._barrelGraphics.lineStyle(THICK - 2, 0xC0A0E0, 0.6);
    this._barrelGraphics.lineBetween(
      gx, gy,
      gx + Math.cos(angle) * LEN,
      gy + Math.sin(angle) * LEN
    );
  }

  /** Рисует текущий пузырь-снаряд у пушки */
  _drawCurrentBubble() {
    if (this._currentBubbleGfx) this._currentBubbleGfx.destroy();
    this._currentBubbleGfx = this._drawBubble(this._gunX, this._gunY - 6, this._currentColorIdx);
    this._currentBubbleGfx.setDepth(8);
  }

  /** Рисует следующий пузырь (маленький, справа от пушки) */
  _drawNextBubble() {
    if (this._nextBubbleGfx) this._nextBubbleGfx.destroy();
    if (this._nextLabelTxt)  this._nextLabelTxt.destroy();

    const nx = this._gunX + 52;
    const ny = this._gunY;

    this._nextBubbleGfx = this._drawBubble(nx, ny, this._nextColorIdx, 0.55, 0.8);
    this._nextBubbleGfx.setDepth(8);

    this._nextLabelTxt = this.add.text(nx, ny + 20, 'след.', {
      fontFamily: 'Georgia, serif',
      fontSize:   '9px',
      color:      '#6A5A7A',
    }).setOrigin(0.5, 0).setDepth(8);
  }

  // ─── Прицельная линия ────────────────────────────────────────────────────────

  /**
   * Рисует пунктирную прицельную линию от пушки до первого препятствия.
   * Учитывает отражение от боковых стен.
   */
  _drawAimLine(targetX, targetY) {
    if (!this._aimGraphics) return;
    this._aimGraphics.clear();

    // Ограничиваем угол: не стрелять вниз
    const dx = targetX - this._gunX;
    const dy = targetY - this._gunY;
    const angle = Math.atan2(dy, dx);

    // Запрещаем стрельбу вниз (угол от -15° до -165°, т.е. dy < 0 нужно)
    if (dy >= -10) return; // целимся слишком горизонтально или вниз

    // Вращаем ствол
    this._drawBarrel(this._gunX, this._gunY, angle);

    const W    = GAME_CONFIG.WIDTH;
    const R    = BubbleShooterScene.BUBBLE_R;
    const WALL_LEFT  = 8 + R;
    const WALL_RIGHT = W - 8 - R;

    // Трассируем луч с отражениями
    let rx = this._gunX;
    let ry = this._gunY;
    let rdx = Math.cos(angle);
    let rdy = Math.sin(angle);
    const speed  = 6; // шаг трассировки
    const maxLen = 600;
    let   trav   = 0;

    const DOT_LEN = 8, DOT_GAP = 6;
    let   dotPhase = 0; // пикселей от начала текущего сегмента

    this._aimGraphics.lineStyle(2, 0xFFFFFF, 0.35);

    let prevX = rx;
    let prevY = ry;
    let drawing = true; // чередуем тире/пробел

    while (trav < maxLen) {
      const nx = rx + rdx * speed;
      const ny = ry + rdy * speed;

      // Отражение от стен
      let reflected = false;
      if (nx < WALL_LEFT || nx > WALL_RIGHT) {
        rdx = -rdx;
        reflected = true;
      }

      if (!reflected) {
        // Проверяем столкновение с пузырями сетки
        const hit = this._rayHitsBubble(nx, ny);
        if (hit) break;

        // Проверяем выход за потолок
        if (ny < BubbleShooterScene.FIELD_TOP) break;

        // Рисуем пунктирный сегмент
        dotPhase += speed;
        if (drawing) {
          if (dotPhase > DOT_LEN) {
            // Рисуем линию от prevX,prevY до nx,ny
            this._aimGraphics.lineBetween(prevX, prevY, nx, ny);
            drawing = false;
            dotPhase = 0;
          }
        } else {
          if (dotPhase > DOT_GAP) {
            drawing  = true;
            dotPhase = 0;
            prevX    = nx;
            prevY    = ny;
          }
        }

        rx = nx;
        ry = ny;
      } else {
        prevX = rx;
        prevY = ry;
      }

      trav += speed;
    }
  }

  /** Проверяет, попадает ли точка (px, py) в радиус любого пузыря сетки */
  _rayHitsBubble(px, py) {
    const R    = BubbleShooterScene.BUBBLE_R;
    const COLS = BubbleShooterScene.COLS;
    const ROWS = BubbleShooterScene.MAX_ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this._grid[r][c] < 0) continue;
        const pos  = this._cellToXY(c, r);
        const dist = Math.hypot(pos.x - px, pos.y - py);
        if (dist < R * 1.9) return true;
      }
    }
    return false;
  }

  // ─── Ввод ──────────────────────────────────────────────────────────────────

  _onPointerMove(pointer) {
    if (this._gameOver) return;
    this._drawAimLine(pointer.x, pointer.y);
  }

  _onPointerDown(pointer) {
    if (this._gameOver || this._shooting || this._gridBusy) return;
    // Не стрелять в зону HUD
    if (pointer.y < BubbleShooterScene.HUD_H + 10) return;
    // Не стрелять вниз
    if (pointer.y >= this._gunY - 10) return;

    this._shoot(pointer.x, pointer.y);
  }

  // ─── Выстрел ────────────────────────────────────────────────────────────────

  _shoot(targetX, targetY) {
    const dx    = targetX - this._gunX;
    const dy    = targetY - this._gunY;
    const len   = Math.hypot(dx, dy);
    if (len < 1) return;

    const vx = (dx / len) * BubbleShooterScene.PROJ_SPEED;
    const vy = (dy / len) * BubbleShooterScene.PROJ_SPEED;

    this._shooting = true;
    this._aimGraphics.clear();

    // Уничтожаем статичный пузырь у пушки
    if (this._currentBubbleGfx) {
      this._currentBubbleGfx.destroy();
      this._currentBubbleGfx = null;
    }

    // Создаём Graphics снаряда
    const projGfx = this._drawBubble(this._gunX, this._gunY - 6, this._currentColorIdx);
    projGfx.setDepth(10);

    this._projectile = {
      x:        this._gunX,
      y:        this._gunY - 6,
      vx:       vx,
      vy:       vy,
      colorIdx: this._currentColorIdx,
      gfx:      projGfx,
    };

    // Следующий становится текущим
    this._currentColorIdx = this._nextColorIdx;
    this._nextColorIdx    = this._randomColor();
    this._drawNextBubble();
  }

  // ─── Цикл обновления ────────────────────────────────────────────────────────

  update(time, delta) {
    if (this._gameOver || !this._projectile) return;
    this._updateProjectile(delta);
  }

  _updateProjectile(delta) {
    const proj = this._projectile;
    const W    = GAME_CONFIG.WIDTH;
    const R    = BubbleShooterScene.BUBBLE_R;

    const WALL_LEFT  = 8 + R;
    const WALL_RIGHT = W - 8 - R;

    // Движение
    proj.x += proj.vx * delta;
    proj.y += proj.vy * delta;

    // Отражение от боковых стен
    if (proj.x <= WALL_LEFT) {
      proj.x  = WALL_LEFT;
      proj.vx = Math.abs(proj.vx);
    } else if (proj.x >= WALL_RIGHT) {
      proj.x  = WALL_RIGHT;
      proj.vx = -Math.abs(proj.vx);
    }

    // Отражение от потолка — прилипаем к верхней строке
    if (proj.y <= BubbleShooterScene.FIELD_TOP + R) {
      proj.y = BubbleShooterScene.FIELD_TOP + R;
      this._attachProjectile();
      return;
    }

    // Обновляем позицию Graphics (перерисовываем)
    proj.gfx.destroy();
    proj.gfx = this._drawBubble(proj.x, proj.y, proj.colorIdx);
    proj.gfx.setDepth(10);

    // Проверяем столкновение с сеткой
    if (this._checkCollision(proj.x, proj.y)) {
      this._attachProjectile();
      return;
    }

    // Снаряд вышел за нижнюю границу (на всякий случай)
    if (proj.y > BubbleShooterScene.DANGER_Y + 40) {
      proj.gfx.destroy();
      this._projectile = null;
      this._shooting   = false;
      this._drawCurrentBubble();
    }
  }

  /** Проверяет столкновение снаряда с пузырями сетки */
  _checkCollision(px, py) {
    const R    = BubbleShooterScene.BUBBLE_R;
    const COLS = BubbleShooterScene.COLS;
    const ROWS = BubbleShooterScene.MAX_ROWS;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this._grid[r][c] < 0) continue;
        const pos  = this._cellToXY(c, r);
        const dist = Math.hypot(pos.x - px, pos.y - py);
        // Расстояние чуть больше диаметра — прилипание
        if (dist < R * 1.85) return true;
      }
    }
    return false;
  }

  // ─── Прилипание снаряда ──────────────────────────────────────────────────────

  _attachProjectile() {
    const proj = this._projectile;
    if (!proj) return;

    // Ищем ближайшую свободную ячейку
    const cell = this._snapToGrid(proj.x, proj.y);

    proj.gfx.destroy();
    this._projectile = null;
    this._shooting   = false;

    if (!cell) {
      // Нет места — игнорируем (редкий случай)
      this._drawCurrentBubble();
      return;
    }

    // Помещаем пузырь в сетку
    this._grid[cell.row][cell.col] = proj.colorIdx;
    const pos = this._cellToXY(cell.col, cell.row);
    this._bubbleGfx[cell.row][cell.col] = this._drawBubble(pos.x, pos.y, proj.colorIdx);
    this._bubbleGfx[cell.row][cell.col].setDepth(5);

    // Анимация приземления (лёгкое сжатие)
    this.tweens.add({
      targets:  this._bubbleGfx[cell.row][cell.col],
      scaleX:   1.15, scaleY: 0.88,
      duration: 80,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });

    // Ищем совпадения
    const matches = this._findMatches(cell.col, cell.row, proj.colorIdx);
    if (matches.length >= 3) {
      this._comboCount++;
      this._popBubbles(matches);
    } else {
      this._comboCount = 0;
      this._drawCurrentBubble();
      this._checkLoseCondition();
    }
  }

  // ─── Поиск совпадений (BFS) ─────────────────────────────────────────────────

  /**
   * BFS: находит все пузыри того же цвета, связанные с ячейкой (col, row).
   * Возвращает массив { row, col }, если их >= 3.
   */
  _findMatches(col, row, colorIdx) {
    const COLS   = BubbleShooterScene.COLS;
    const ROWS   = BubbleShooterScene.MAX_ROWS;
    const visited = new Set();
    const queue   = [{ row, col }];
    const result  = [];

    while (queue.length > 0) {
      const cur = queue.shift();
      const key = `${cur.row}_${cur.col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (cur.row < 0 || cur.row >= ROWS || cur.col < 0 || cur.col >= COLS) continue;
      if (this._grid[cur.row][cur.col] !== colorIdx) continue;

      result.push(cur);

      // Соседи в hex-сетке
      for (const nb of this._hexNeighbors(cur.col, cur.row)) {
        const nbKey = `${nb.row}_${nb.col}`;
        if (!visited.has(nbKey)) queue.push(nb);
      }
    }

    return result;
  }

  /**
   * Возвращает список соседних ячеек для hex-сетки.
   * В чётных строках и нечётных строках соседи разные (со сдвигом).
   */
  _hexNeighbors(col, row) {
    const isOdd = (row % 2 === 1);
    const neighbors = [
      { col: col - 1, row: row     },   // лево
      { col: col + 1, row: row     },   // право
      { col: col,     row: row - 1 },   // верх-центр
      { col: col,     row: row + 1 },   // низ-центр
    ];

    if (isOdd) {
      neighbors.push({ col: col + 1, row: row - 1 }); // верх-право
      neighbors.push({ col: col + 1, row: row + 1 }); // низ-право
    } else {
      neighbors.push({ col: col - 1, row: row - 1 }); // верх-лево
      neighbors.push({ col: col - 1, row: row + 1 }); // низ-лево
    }

    const COLS = BubbleShooterScene.COLS;
    const ROWS = BubbleShooterScene.MAX_ROWS;
    return neighbors.filter(n => n.col >= 0 && n.col < COLS && n.row >= 0 && n.row < ROWS);
  }

  // ─── Поиск «висячих» пузырей ────────────────────────────────────────────────

  /**
   * BFS от потолка: находит все пузыри, НЕ связанные с верхней строкой.
   * Возвращает массив { row, col }.
   */
  _findFloating() {
    const COLS    = BubbleShooterScene.COLS;
    const ROWS    = BubbleShooterScene.MAX_ROWS;
    const visited = new Set();
    const queue   = [];

    // Стартуем от всех пузырей в строке 0 (потолок)
    for (let c = 0; c < COLS; c++) {
      if (this._grid[0][c] >= 0) {
        const key = `0_${c}`;
        visited.add(key);
        queue.push({ row: 0, col: c });
      }
    }

    // BFS
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const nb of this._hexNeighbors(cur.col, cur.row)) {
        const nbKey = `${nb.row}_${nb.col}`;
        if (visited.has(nbKey)) continue;
        if (this._grid[nb.row][nb.col] < 0) continue;
        visited.add(nbKey);
        queue.push(nb);
      }
    }

    // Все пузыри, которые НЕ попали в visited — висячие
    const floating = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this._grid[r][c] < 0) continue;
        if (!visited.has(`${r}_${c}`)) {
          floating.push({ row: r, col: c });
        }
      }
    }
    return floating;
  }

  // ─── Лопание пузырей ────────────────────────────────────────────────────────

  /**
   * Анимирует и удаляет группу пузырей (matches).
   * После удаления ищет висячие и тоже удаляет их.
   */
  _popBubbles(cells) {
    this._gridBusy = true;
    let done = 0;
    const total = cells.length;

    // Очки с учётом combo
    let pts = total * BubbleShooterScene.SCORE_POP;
    if (this._comboCount > 1) {
      pts = Math.floor(pts * Math.pow(BubbleShooterScene.COMBO_MULT, this._comboCount - 1));
    }
    this._score      += pts;
    this._poppedTotal += total;

    // Реакция компаньона при combo
    if (this._comboCount >= 2) {
      this._playCompanionReaction(`Комбо ×${this._comboCount}!`);
    }

    const onBubbleDone = () => {
      done++;
      if (done < total) return;

      // Удаляем из сетки
      for (const cell of cells) {
        this._grid[cell.row][cell.col] = -1;
        if (this._bubbleGfx[cell.row][cell.col]) {
          this._bubbleGfx[cell.row][cell.col].destroy();
          this._bubbleGfx[cell.row][cell.col] = null;
        }
      }

      // Ищем висячие
      const floating = this._findFloating();
      if (floating.length > 0) {
        this._dropFloating(floating);
      } else {
        this._afterPop();
      }
    };

    // Анимация лопания для каждого пузыря
    for (const cell of cells) {
      const gfx = this._bubbleGfx[cell.row][cell.col];
      if (!gfx) { onBubbleDone(); continue; }

      const pos   = this._cellToXY(cell.col, cell.row);
      const color = BubbleShooterScene.BUBBLE_COLORS[this._grid[cell.row][cell.col]];

      // Мини-частицы лопания
      this._spawnPopParticles(pos.x, pos.y, color);

      this.tweens.add({
        targets:    gfx,
        scaleX:     1.6,
        scaleY:     1.6,
        alpha:      0,
        duration:   220,
        ease:       'Quad.easeOut',
        onComplete: onBubbleDone,
      });
    }

    this._updateHUD();
  }

  /** Падение висячих пузырей */
  _dropFloating(floating) {
    let done = 0;
    const total = floating.length;

    const pts = total * BubbleShooterScene.SCORE_FLOAT;
    this._score       += pts;
    this._poppedTotal += total;
    this._updateHUD();

    for (const cell of floating) {
      const gfx = this._bubbleGfx[cell.row][cell.col];
      this._grid[cell.row][cell.col] = -1;
      this._bubbleGfx[cell.row][cell.col] = null;

      if (!gfx) { done++; if (done >= total) this._afterPop(); continue; }

      this.tweens.add({
        targets:    gfx,
        y:          gfx.y + 300,
        alpha:      0,
        duration:   500,
        ease:       'Quad.easeIn',
        onComplete: () => {
          gfx.destroy();
          done++;
          if (done >= total) this._afterPop();
        },
      });
    }
  }

  /** Вызывается после завершения всех анимаций лопания */
  _afterPop() {
    this._gridBusy = false;
    this._updateHUD();

    // Проверяем победу: поле очищено?
    if (this._countBubbles() === 0) {
      this._endGame(true, true); // completed + cleared
      return;
    }

    this._checkLoseCondition();
    this._drawCurrentBubble();
  }

  // ─── Частицы ─────────────────────────────────────────────────────────────────

  _spawnPopParticles(x, y, color) {
    const gfx     = this.add.graphics().setDepth(12);
    const COUNT   = 8;
    const parts   = [];

    for (let i = 0; i < COUNT; i++) {
      const angle = (Math.PI * 2 / COUNT) * i;
      parts.push({
        x, y,
        vx:   Math.cos(angle) * Phaser.Math.FloatBetween(1.5, 3),
        vy:   Math.sin(angle) * Phaser.Math.FloatBetween(1.5, 3),
        r:    Phaser.Math.FloatBetween(2, 5),
        life: 1,
      });
    }

    let elapsed = 0;
    const updateFn = (time, delta) => {
      elapsed += delta;
      const t = Math.min(elapsed / 400, 1);

      gfx.clear();
      for (const p of parts) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.12;
        p.life = 1 - t;
        gfx.fillStyle(color, p.life * 0.9);
        gfx.fillCircle(p.x, p.y, p.r * p.life);
      }

      if (t >= 1) {
        gfx.destroy();
        this.events.off('update', updateFn);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Добавление новой строки ─────────────────────────────────────────────────

  /**
   * Сдвигает всю сетку на одну строку вниз (row+1) и добавляет новую строку сверху (row=0).
   */
  _addNewRow() {
    if (this._gameOver || this._gridBusy) return;
    this._gridBusy = true;

    const COLS = BubbleShooterScene.COLS;
    const ROWS = BubbleShooterScene.MAX_ROWS;

    // Сдвигаем данные вниз
    for (let r = ROWS - 1; r > 0; r--) {
      for (let c = 0; c < COLS; c++) {
        this._grid[r][c] = this._grid[r - 1][c];
      }
    }

    // Новая строка сверху
    const newRow = 0;
    for (let c = 0; c < COLS; c++) {
      const maxCol = (newRow % 2 === 1) ? COLS - 1 : COLS;
      this._grid[newRow][c] = (c < maxCol) ? this._randomColor() : -1;
    }

    // Анимируем сдвиг: перерисовываем с задержкой
    const R    = BubbleShooterScene.BUBBLE_R;
    const rowH = R * 2 * 0.88;

    // Сдвигаем все Graphics вниз через Tween
    const allGfx = [];
    for (let r = ROWS - 1; r > 0; r--) {
      for (let c = 0; c < COLS; c++) {
        if (this._bubbleGfx[r][c]) {
          // Скоро пересоздадим, поэтому уничтожаем после анимации
          allGfx.push(this._bubbleGfx[r][c]);
          this._bubbleGfx[r][c] = null;
        }
      }
    }

    if (allGfx.length > 0) {
      this.tweens.add({
        targets:    allGfx,
        y:          '+=' + rowH,
        duration:   250,
        ease:       'Quad.easeOut',
        onComplete: () => {
          for (const g of allGfx) g.destroy();
          this._redrawAllBubbles();
          this._gridBusy = false;
          this._checkLoseCondition();
        },
      });
    } else {
      this._redrawAllBubbles();
      this._gridBusy = false;
      this._checkLoseCondition();
    }
  }

  // ─── Проверка проигрыша ──────────────────────────────────────────────────────

  _checkLoseCondition() {
    // Проигрыш, если хотя бы один пузырь находится в нижней зоне
    const ROWS = BubbleShooterScene.MAX_ROWS;
    const COLS = BubbleShooterScene.COLS;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this._grid[r][c] < 0) continue;
        const pos = this._cellToXY(c, r);
        if (pos.y + BubbleShooterScene.BUBBLE_R >= BubbleShooterScene.DANGER_Y) {
          this._endGame(false, false);
          return;
        }
      }
    }
  }

  // ─── Линия опасности ─────────────────────────────────────────────────────────

  _drawDangerLine(W) {
    const dy = BubbleShooterScene.DANGER_Y;
    const lineGfx = this.add.graphics().setDepth(4);

    // Красная пунктирная линия
    lineGfx.lineStyle(1.5, 0xFF4444, 0.5);
    const segLen = 10, gapLen = 6;
    let x = 8;
    while (x < W - 8) {
      lineGfx.lineBetween(x, dy, Math.min(x + segLen, W - 8), dy);
      x += segLen + gapLen;
    }

    // Подпись
    this.add.text(W / 2, dy + 4, 'опасная зона', {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      color:      '#FF4444',
      alpha:      0.5,
    }).setOrigin(0.5, 0).setDepth(4).setAlpha(0.45);
  }

  // ─── Компаньон ───────────────────────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];
    const ORB_SIZE  = 50;
    const orbX = 38;
    const orbY = H - 70;

    // Свечение
    this._orbGlow = this.add.ellipse(orbX, orbY + 10, 60, 22, companion.color, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(4);

    // Орб
    this._orbSprite = this.add.image(orbX, orbY, `orb_${this._companionId}`)
      .setDisplaySize(ORB_SIZE, ORB_SIZE).setDepth(5);

    // Парение
    this.tweens.add({
      targets:  this._orbSprite,
      y:        orbY - ANIM.FLOAT_AMPLITUDE,
      duration: ANIM.FLOAT_DURATION,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Пульсация свечения
    this.tweens.add({
      targets:  this._orbGlow,
      alpha:    { from: 0.06, to: 0.20 },
      duration: 2200,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Текст реакции
    this._reactionTxt = this.add.text(orbX + ORB_SIZE / 2 + 8, orbY, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      wordWrap:   { width: W - ORB_SIZE - 60 },
    }).setOrigin(0, 0.5).setAlpha(0).setDepth(6);
  }

  _playCompanionReaction(text) {
    // Подпрыгивание
    this.tweens.add({
      targets:  this._orbSprite,
      y:        this._orbSprite.y - 18,
      duration: 180,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });

    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1200,
      delay:    700,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Кнопка «Сдаться» ────────────────────────────────────────────────────────

  _buildSurrenderBtn(W, H) {
    const BW = 110, BH = 34;
    const x  = W - 64, y = H - 70;

    const bg = this.add.graphics();
    bg.fillStyle(0x1A0830, 0.8);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);
    bg.lineStyle(1, 0x3A1850, 0.6);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);

    const txt = this.add.text(0, 0, 'Сдаться', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#6A4A7A',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]).setDepth(10);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true }).setDepth(11);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._endGame(false, false);
    });
  }

  // ─── Таймер ──────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;

    this._timeLeft--;
    this._timerTxt.setText(this._formatTime(this._timeLeft));
    this._drawTimerBar();

    if (this._timeLeft <= 10) {
      this._timerTxt.setColor('#FF4444');
    } else if (this._timeLeft <= 30) {
      this._timerTxt.setColor('#FF9B4E');
    }

    // Счётчик добавления строк
    this._addRowCounter++;
    if (this._addRowCounter >= this._addRowSec) {
      this._addRowCounter = 0;
      this._addNewRow();
    }

    if (this._timeLeft <= 0) {
      this._endGame(false, false);
    }
  }

  // ─── Обновление HUD ──────────────────────────────────────────────────────────

  _updateHUD() {
    if (!this._scoreTxt) return;
    this._scoreTxt.setText(this._score.toString());

    // Процент убранных пузырей
    const total = Math.max(1, this._totalBubbles);
    const pct   = Math.min(100, Math.round((this._poppedTotal / total) * 100));
    this._progressTxt.setText(`Убрано: ${pct}%`);

    // Анимация счёта
    this.tweens.add({
      targets:  this._scoreTxt,
      scaleX:   1.2, scaleY: 1.2,
      duration: 70,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Вспомогательные ─────────────────────────────────────────────────────────

  _randomColor() {
    return Phaser.Math.Between(0, this._colorCount - 1);
  }

  // ─── Конец игры ──────────────────────────────────────────────────────────────

  _endGame(completed, fullyClear) {
    if (this._gameOver) return;
    this._gameOver = true;

    if (this._timerEvent) this._timerEvent.remove();
    if (this._aimGraphics) this._aimGraphics.clear();

    // Считаем процент убранных
    const total = Math.max(1, this._totalBubbles);
    const pct   = Math.min(100, Math.round((this._poppedTotal / total) * 100));

    // Звёзды
    let stars = 0;
    if (fullyClear) {
      stars = 3;
    } else if (pct >= 70) {
      stars = 2;
    } else if (pct >= 40) {
      stars = 1;
    }

    // Реакция компаньона
    const companion  = COMPANIONS[this._companionId];
    const reactionKey = stars === 3 ? 'win' : (stars > 0 ? 'idle' : 'lose');
    this._playCompanionReaction(companion.reactions[reactionKey]);

    this.time.delayedCall(400, () => {
      this._showResultOverlay(stars, completed || fullyClear, pct);
    });
  }

  _showResultOverlay(stars, completed, pct) {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.65, duration: 300 });

    // Карточка
    const cardY = H / 2 - 110;
    const card  = this.add.graphics().setDepth(31);
    card.fillStyle(0x080418, 0.96);
    card.fillRoundedRect(W / 2 - 145, cardY, 290, 270, 20);
    card.lineStyle(1.5, companion.color, 0.5);
    card.strokeRoundedRect(W / 2 - 145, cardY, 290, 270, 20);

    // Заголовок
    const title = completed ? (stars === 3 ? 'Поле очищено!' : 'Уровень пройден!') : 'Время вышло';
    this.add.text(W / 2, cardY + 26, title, {
      fontFamily: 'Georgia, serif',
      fontSize:   '19px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#AA7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 60, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '38px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 112, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Убрано %
    this.add.text(W / 2, cardY + 140, `Убрано пузырей: ${pct}%`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реплика компаньона
    const reactionKey  = stars === 3 ? 'win' : (stars > 0 ? 'idle' : 'lose');
    const reactionText = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 168, `«${reactionText}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: 250 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка
    this._buildResultBtn(W / 2, cardY + 242, 'Продолжить', companion.color, stars, completed);

    // Победные частицы
    if (stars >= 2) {
      this._spawnWinParticles(W, H, companion.color);
    }
  }

  _buildResultBtn(x, y, label, color, stars, completed) {
    const BW = 200, BH = 44;

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
      .setInteractive({ useHandCursor: true }).setDepth(35);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._finishGame(stars, completed);
    });
  }

  /** Победные частицы-пузыри */
  _spawnWinParticles(W, H, color) {
    const gfx   = this.add.graphics().setDepth(29);
    const COUNT = 20;
    const parts = [];

    for (let i = 0; i < COUNT; i++) {
      parts.push({
        x:    Phaser.Math.Between(30, W - 30),
        y:    H * 0.85,
        vy:   Phaser.Math.FloatBetween(-2.5, -0.8),
        vx:   Phaser.Math.FloatBetween(-1.2, 1.2),
        r:    Phaser.Math.FloatBetween(4, 10),
        life: 1,
      });
    }

    let elapsed = 0;
    const updateFn = (time, delta) => {
      elapsed += delta;
      const t = Math.min(elapsed / 2500, 1);

      gfx.clear();
      for (const p of parts) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.life = 1 - t;
        if (p.life <= 0) continue;

        // Пузырь с бликом
        gfx.fillStyle(color, p.life * 0.55);
        gfx.fillCircle(p.x, p.y, p.r);
        gfx.lineStyle(1, color, p.life * 0.8);
        gfx.strokeCircle(p.x, p.y, p.r);
        gfx.fillStyle(COLORS.WHITE, p.life * 0.25);
        gfx.fillEllipse(p.x - p.r * 0.25, p.y - p.r * 0.28, p.r * 0.5, p.r * 0.28);
      }

      if (t >= 1) {
        gfx.destroy();
        this.events.off('update', updateFn);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Завершение и возврат ─────────────────────────────────────────────────────

  /**
   * Сохраняет результат и возвращает в ChapterScene.
   */
  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = { stars, score: this._score, timeMs, completed };

    // Сохраняем через GameState если доступен
    if (typeof GameState !== 'undefined' && GameState.saveMiniGameResult) {
      GameState.saveMiniGameResult(this._chapter, this._mgIndex, result);
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
}
