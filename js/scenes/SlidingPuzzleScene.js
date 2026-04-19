/**
 * SlidingPuzzleScene.js — Мини-игра «Скользящий пазл» для «Искра и Эхо»
 *
 * Механика: классический 15-puzzle (n²-1 плиток + 1 пустая).
 *   Нажатие на плитку рядом с пустой → плитка скользит на место пустой.
 *   Цель: восстановить картину (привести все плитки в порядок 1..N²-1, 0=пустая).
 *
 * Сложность:
 *   easy   → 3×3 (8 плиток),  таймер 180с, перемешивание 200 ходов
 *   normal → 4×4 (15 плиток), таймер 120с, перемешивание 400 ходов
 *   hard   → 5×5 (24 плитки), таймер  90с, перемешивание 600 ходов
 *
 * Счёт: 1000 - (ходы × 5) + (оставшееся время × 2), минимум 50
 * Звёзды: 3★ ≤ N², 2★ ≤ N²×2, 1★ — просто решил
 *
 * Получает: { chapter, miniGameIndex, companionId, difficulty }
 * Возвращает в ChapterScene: { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 */

class SlidingPuzzleScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.SLIDING });
  }

  // ─── Параметры по сложности ─────────────────────────────────────────────────

  static get DIFF_CONFIG() {
    return {
      easy:   { size: 3, timeSec: 180, shuffleMoves: 200 },
      normal: { size: 4, timeSec: 120, shuffleMoves: 400 },
      hard:   { size: 5, timeSec:  90, shuffleMoves: 600 },
    };
  }

  // Длительность анимации скольжения плитки (мс)
  static get T_SLIDE()   { return 150; }
  // Задержка подсветки подсказки (мс)
  static get T_HINT()    { return 1800; }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || (window.GameState ? GameState.get('firstCompanion') : null) || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    const cfg = SlidingPuzzleScene.DIFF_CONFIG[this._difficulty] || SlidingPuzzleScene.DIFF_CONFIG.easy;
    this._size         = cfg.size;        // N (сторона поля)
    this._timeLeft     = cfg.timeSec;     // секунд
    this._shuffleMoves = cfg.shuffleMoves;

    this._moves       = 0;   // ходов совершено игроком
    this._gameOver    = false;
    this._busy        = false; // анимация в процессе

    // _board: плоский массив длиной N², значение 0 = пустая клетка
    // Правильное состояние: [1,2,...,N²-1,0]
    this._board = [];

    // _hintTile: индекс в _board плитки, подсвеченной подсказкой (или -1)
    this._hintActive = false;
    this._hintGfx    = null;

    // Визуальные объекты плиток: массив длиной N² (null для пустой)
    this._tileContainers = [];
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    // Размер плитки подбираем так, чтобы поле умещалось в зону ~390×480
    const maxFieldW = W - 32;
    const maxFieldH = H - 220; // место под HUD и компаньона
    const tileSize  = Math.floor(Math.min(maxFieldW, maxFieldH) / this._size);
    this._tileSize  = tileSize;
    this._tileGap   = 3;

    const step     = tileSize + this._tileGap;
    const fieldW   = this._size * step - this._tileGap;
    const fieldH   = this._size * step - this._tileGap;
    this._fieldX   = Math.floor((W - fieldW) / 2); // левый край поля
    this._fieldY   = 96;                             // под HUD

    // ── Фон ──
    this._drawBackground(W, H);

    // ── HUD ──
    this._buildHUD(W);

    // ── Генерация и отрисовка поля ──
    this._generateBoard();
    this._shuffle(this._shuffleMoves);
    this._drawBoard();

    // ── Компаньон ──
    this._buildCompanion(W, H);

    // ── Кнопка «Подсказка» ──
    this._buildHintBtn(W, H);

    // ── Кнопка «Сдаться» ──
    this._buildSurrenderBtn(W, H);

    // ── Ввод ──
    this._setupInput();

    // ── Таймер ──
    this._timerEvent = this.time.addEvent({
      delay:         1000,
      callback:      this._onTick,
      callbackScope: this,
      loop:          true,
    });

    // ── Fade-in ──
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Фон сцены ──────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const companion = COMPANIONS[this._companionId];

    // Тёмный градиентный фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0A0618, 0x0A0618, 0x150D2A, 0x150D2A, 1);
    bg.fillRect(0, 0, W, H);

    // Слабый оттенок цвета компаньона
    const glow = this.add.graphics();
    glow.fillStyle(companion.color, 0.03);
    glow.fillRect(0, 0, W, H);

    // Несколько декоративных звёздочек на фоне
    const starGfx = this.add.graphics();
    const rng = new Phaser.Math.RandomDataGenerator(['sliding-bg']);
    for (let i = 0; i < 40; i++) {
      const sx = rng.between(0, W);
      const sy = rng.between(0, H);
      const sr = rng.realInRange(0.5, 2);
      starGfx.fillStyle(companion.colorLight || companion.color, rng.realInRange(0.1, 0.4));
      starGfx.fillCircle(sx, sy, sr);
    }

    // Подложка под игровое поле
    const step   = this._tileSize + this._tileGap;
    const fieldW = this._size * step - this._tileGap;
    const fieldH = this._size * step - this._tileGap;
    const pad    = 10;

    const fieldBg = this.add.graphics();
    fieldBg.fillStyle(0x080514, 0.75);
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

    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0A0618, 0.88);
    hudBg.fillRect(0, 0, W, 82);
    hudBg.lineStyle(1, companion.color, 0.12);
    hudBg.lineBetween(0, 82, W, 82);

    // Название
    this.add.text(W / 2, 12, 'Скользящий пазл', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0);

    // Ходы (слева)
    this.add.text(16, 12, 'Ходов', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._movesTxt = this.add.text(16, 26, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Цель — N² ходов для 3 звёзды
    const goalMoves = this._size * this._size;
    this.add.text(16, 52, `Цель: ≤${goalMoves} ходов`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
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

    // Полоса таймера
    this._timerBarBg = this.add.graphics();
    this._timerBarBg.fillStyle(0x1A1030, 1);
    this._timerBarBg.fillRoundedRect(W - 84, 54, 68, 10, 5);

    this._timerBarFg = this.add.graphics();
    this._redrawTimerBar();
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _redrawTimerBar() {
    const W      = GAME_CONFIG.WIDTH;
    const companion = COMPANIONS[this._companionId];
    const maxSec = SlidingPuzzleScene.DIFF_CONFIG[this._difficulty].timeSec;
    const ratio  = Math.max(0, this._timeLeft / maxSec);

    let barColor = companion.color;
    if (ratio < 0.3)      barColor = 0xFF4444;
    else if (ratio < 0.6) barColor = COLORS.BTN_PRIMARY;

    this._timerBarFg.clear();
    this._timerBarFg.fillStyle(barColor, 0.85);
    this._timerBarFg.fillRoundedRect(W - 84, 54, Math.max(2, Math.floor(68 * ratio)), 10, 5);
  }

  // ─── Логика поля ────────────────────────────────────────────────────────────

  /**
   * Генерирует начальную доску в правильном состоянии:
   * [1, 2, 3, ..., N²-1, 0]  (0 = пустая клетка, стоит в конце)
   */
  _generateBoard() {
    const total = this._size * this._size;
    this._board = [];
    for (let i = 0; i < total - 1; i++) {
      this._board.push(i + 1); // плитки 1..N²-1
    }
    this._board.push(0); // пустая последней
  }

  /**
   * Перемешивает доску заданным числом валидных случайных ходов.
   * Работает на логическом массиве _board (без отрисовки).
   */
  _shuffle(moves) {
    const dirs = [
      { dr: -1, dc: 0 }, // вверх
      { dr:  1, dc: 0 }, // вниз
      { dr:  0, dc: -1 }, // влево
      { dr:  0, dc:  1 }, // вправо
    ];

    let emptyIdx = this._board.indexOf(0);
    let prevDir  = -1; // избегаем немедленного отката

    for (let m = 0; m < moves; m++) {
      // Собираем допустимые направления
      const emptyRow = Math.floor(emptyIdx / this._size);
      const emptyCol = emptyIdx % this._size;

      const valid = [];
      for (let d = 0; d < dirs.length; d++) {
        if (d === prevDir) continue; // не возвращаемся
        const nr = emptyRow + dirs[d].dr;
        const nc = emptyCol + dirs[d].dc;
        if (nr >= 0 && nr < this._size && nc >= 0 && nc < this._size) {
          valid.push({ d, nr, nc });
        }
      }

      const pick    = valid[Phaser.Math.Between(0, valid.length - 1)];
      const swapIdx = pick.nr * this._size + pick.nc;

      // Логический обмен
      this._board[emptyIdx] = this._board[swapIdx];
      this._board[swapIdx]  = 0;
      emptyIdx = swapIdx;

      // Запоминаем обратное направление чтобы не сразу откатить
      prevDir = (pick.d % 2 === 0) ? pick.d + 1 : pick.d - 1;
    }
  }

  // ─── Отрисовка поля ─────────────────────────────────────────────────────────

  _drawBoard() {
    // Уничтожаем старые контейнеры если есть
    for (const c of this._tileContainers) {
      if (c) c.destroy();
    }
    this._tileContainers = new Array(this._size * this._size).fill(null);

    for (let idx = 0; idx < this._board.length; idx++) {
      const value = this._board[idx];
      if (value === 0) continue; // пустая клетка — не рисуем
      this._tileContainers[idx] = this._drawTile(idx, value);
    }
  }

  /**
   * Рисует одну плитку по индексу idx в _board с числовым значением value.
   * Паттерн генерируется программно — созвездия, орбы, геометрия.
   * Возвращает Phaser.GameObjects.Container.
   */
  _drawTile(idx, value) {
    const companion = COMPANIONS[this._companionId];
    const S         = this._tileSize;
    const step      = S + this._tileGap;
    const row       = Math.floor(idx / this._size);
    const col       = idx % this._size;

    const cx = this._fieldX + col * step + S / 2;
    const cy = this._fieldY + row * step + S / 2;

    const total = this._size * this._size - 1; // число плиток (без пустой)

    // Цвет плитки плавно меняется от colorDark к color по значению
    const t          = (value - 1) / Math.max(1, total - 1); // 0..1
    const baseColor  = companion.color;
    const darkColor  = companion.colorDark || COLORS.BG_NIGHT;
    // Интерполируем компоненты цвета
    const tileColor  = this._lerpColor(darkColor, baseColor, 0.25 + t * 0.55);
    const glowColor  = companion.colorLight || companion.color;

    // ── Фоновый прямоугольник плитки ──
    const gfx = this.add.graphics();

    // Градиентная заливка: немного светлее сверху
    gfx.fillStyle(tileColor, 0.85);
    gfx.fillRoundedRect(-S / 2 + 1, -S / 2 + 1, S - 2, S - 2, 7);

    // Блик сверху
    gfx.fillStyle(COLORS.WHITE, 0.07);
    gfx.fillRoundedRect(-S / 2 + 2, -S / 2 + 2, S - 4, Math.floor(S * 0.35), 5);

    // Тонкая рамка
    gfx.lineStyle(1.5, glowColor, 0.4);
    gfx.strokeRoundedRect(-S / 2 + 1, -S / 2 + 1, S - 2, S - 2, 7);

    // ── Декоративный паттерн (разный по остатку от деления value на 3) ──
    this._drawTilePattern(gfx, S, value, tileColor, glowColor);

    // ── Номер плитки (маленький, снизу-справа) ──
    const numTxt = this.add.text(S / 2 - 5, S / 2 - 5, String(value), {
      fontFamily: 'Georgia, serif',
      fontSize:   `${Math.max(9, Math.floor(S * 0.22))}px`,
      color:      '#' + glowColor.toString(16).padStart(6, '0'),
      alpha:      0.7,
    }).setOrigin(1, 1);

    const container = this.add.container(cx, cy, [gfx, numTxt]).setDepth(5);
    return container;
  }

  /**
   * Рисует декоративный паттерн поверх плитки через Graphics.
   * Три вида: созвездие, орб, геометрия — чередуются по value.
   */
  _drawTilePattern(gfx, S, value, baseColor, glowColor) {
    const halfS = S / 2;
    const kind  = value % 3;

    if (kind === 0) {
      // ── Созвездие: несколько маленьких звёзд/точек ──
      const rng = new Phaser.Math.RandomDataGenerator([`star-${value}`]);
      const count = Math.min(5, 2 + Math.floor(S / 20));
      gfx.fillStyle(glowColor, 0.55);
      for (let i = 0; i < count; i++) {
        const sx = rng.realInRange(-halfS * 0.6, halfS * 0.6);
        const sy = rng.realInRange(-halfS * 0.6, halfS * 0.6);
        const sr = rng.realInRange(1.5, 3.5);
        gfx.fillCircle(sx, sy, sr);
      }
      // Соединяем первые три точки тонкими линиями
      if (count >= 3) {
        const pts = [];
        const rng2 = new Phaser.Math.RandomDataGenerator([`star-${value}`]);
        for (let i = 0; i < 3; i++) {
          pts.push({
            x: rng2.realInRange(-halfS * 0.6, halfS * 0.6),
            y: rng2.realInRange(-halfS * 0.6, halfS * 0.6),
          });
        }
        gfx.lineStyle(0.8, glowColor, 0.25);
        gfx.beginPath();
        gfx.moveTo(pts[0].x, pts[0].y);
        gfx.lineTo(pts[1].x, pts[1].y);
        gfx.lineTo(pts[2].x, pts[2].y);
        gfx.strokePath();
      }

    } else if (kind === 1) {
      // ── Орб: концентрические круги ──
      const r1 = Math.floor(S * 0.22);
      const r2 = Math.floor(S * 0.13);
      gfx.lineStyle(1, glowColor, 0.3);
      gfx.strokeCircle(0, 0, r1);
      gfx.fillStyle(glowColor, 0.18);
      gfx.fillCircle(0, 0, r2);
      gfx.fillStyle(COLORS.WHITE, 0.25);
      gfx.fillCircle(-Math.floor(r2 * 0.35), -Math.floor(r2 * 0.35), Math.max(2, Math.floor(r2 * 0.4)));

    } else {
      // ── Геометрия: ромб / кристалл ──
      const h = Math.floor(S * 0.28);
      const w = Math.floor(S * 0.18);
      gfx.lineStyle(1.2, glowColor, 0.45);
      gfx.beginPath();
      gfx.moveTo(0, -h);
      gfx.lineTo(w,  0);
      gfx.lineTo(0,  h);
      gfx.lineTo(-w, 0);
      gfx.closePath();
      gfx.strokePath();
      gfx.fillStyle(glowColor, 0.12);
      gfx.fillPoints([
        new Phaser.Geom.Point(0, -h),
        new Phaser.Geom.Point(w, 0),
        new Phaser.Geom.Point(0, h),
        new Phaser.Geom.Point(-w, 0),
      ], true);
    }
  }

  /**
   * Линейная интерполяция двух hex-цветов.
   * t=0 → a, t=1 → b.
   */
  _lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xFF;
    const ag = (a >> 8)  & 0xFF;
    const ab =  a        & 0xFF;
    const br = (b >> 16) & 0xFF;
    const bg = (b >> 8)  & 0xFF;
    const bb =  b        & 0xFF;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return (rr << 16) | (rg << 8) | rb;
  }

  // ─── Ввод ───────────────────────────────────────────────────────────────────

  _setupInput() {
    const step   = this._tileSize + this._tileGap;
    const fieldW = this._size * step - this._tileGap;
    const fieldH = this._size * step - this._tileGap;

    const zone = this.add.zone(
      this._fieldX + fieldW / 2,
      this._fieldY + fieldH / 2,
      fieldW,
      fieldH
    ).setInteractive().setDepth(20);

    zone.on('pointerdown', (pointer) => {
      if (this._busy || this._gameOver) return;

      const col = Math.floor((pointer.x - this._fieldX) / step);
      const row = Math.floor((pointer.y - this._fieldY) / step);

      if (col < 0 || col >= this._size || row < 0 || row >= this._size) return;
      this._onTileClick(col, row);
    });
  }

  // ─── Обработка клика ────────────────────────────────────────────────────────

  _onTileClick(col, row) {
    const idx      = row * this._size + col;
    const emptyIdx = this._board.indexOf(0);

    if (this._board[idx] === 0) return; // кликнули на пустую — игнорируем

    // Проверяем, является ли нажатая плитка соседом пустой
    const eRow = Math.floor(emptyIdx / this._size);
    const eCol = emptyIdx % this._size;

    const isNeighbor = (Math.abs(row - eRow) + Math.abs(col - eCol)) === 1;
    if (!isNeighbor) return;

    // Убираем подсказку при любом ходе
    this._clearHint();

    this._slideToEmpty(col, row, idx, emptyIdx);
  }

  /**
   * Анимирует скольжение плитки из позиции (col, row) в пустую клетку,
   * затем обновляет логику.
   */
  _slideToEmpty(col, row, fromIdx, emptyIdx) {
    this._busy = true;

    const step = this._tileSize + this._tileGap;

    // Целевые экранные координаты (центр пустой клетки)
    const eRow  = Math.floor(emptyIdx / this._size);
    const eCol  = emptyIdx % this._size;
    const destX = this._fieldX + eCol * step + this._tileSize / 2;
    const destY = this._fieldY + eRow * step + this._tileSize / 2;

    const container = this._tileContainers[fromIdx];

    if (container) {
      this.tweens.add({
        targets:  container,
        x:        destX,
        y:        destY,
        duration: SlidingPuzzleScene.T_SLIDE,
        ease:     'Quad.easeOut',
        onComplete: () => {
          this._applySlideLogic(fromIdx, emptyIdx);
        },
      });
    } else {
      this._applySlideLogic(fromIdx, emptyIdx);
    }
  }

  /** Обновляет логический массив и массив контейнеров после скольжения */
  _applySlideLogic(fromIdx, emptyIdx) {
    // Обмен в логическом массиве
    this._board[emptyIdx] = this._board[fromIdx];
    this._board[fromIdx]  = 0;

    // Обмен в массиве контейнеров
    const tmp = this._tileContainers[emptyIdx];
    this._tileContainers[emptyIdx] = this._tileContainers[fromIdx];
    this._tileContainers[fromIdx]  = tmp;

    // Учёт хода
    this._moves++;
    this._updateMovesText();

    // Реакция компаньона на каждый ход
    this._playCompanionHopReaction();

    this._busy = false;

    // Проверка победы
    if (this._isSolved()) {
      this._endGame(true);
    }
  }

  // ─── Проверка победы ────────────────────────────────────────────────────────

  /**
   * Возвращает true, если плитки стоят в правильном порядке:
   * _board[i] === i+1 для i=0..N²-2, _board[N²-1] === 0
   */
  _isSolved() {
    const total = this._size * this._size;
    for (let i = 0; i < total - 1; i++) {
      if (this._board[i] !== i + 1) return false;
    }
    return this._board[total - 1] === 0;
  }

  // ─── Подсказка ──────────────────────────────────────────────────────────────

  /**
   * Подсвечивает одну плитку, которую выгодно сдвинуть:
   * ищем плитку, которая уже рядом с пустой и при сдвиге встанет на своё место.
   * Если такой нет — подсвечиваем любую соседнюю с пустой.
   */
  _showHint() {
    if (this._gameOver || this._busy) return;
    this._clearHint();

    const emptyIdx = this._board.indexOf(0);
    const eRow     = Math.floor(emptyIdx / this._size);
    const eCol     = emptyIdx % this._size;

    const dirs = [
      { dr: -1, dc: 0 },
      { dr:  1, dc: 0 },
      { dr:  0, dc: -1 },
      { dr:  0, dc:  1 },
    ];

    let bestIdx   = -1;
    let goodFound = false;

    for (const d of dirs) {
      const nr = eRow + d.dr;
      const nc = eCol + d.dc;
      if (nr < 0 || nr >= this._size || nc < 0 || nc >= this._size) continue;

      const tileIdx  = nr * this._size + nc;
      const value    = this._board[tileIdx];
      const goalIdx  = value - 1; // правильная позиция плитки с номером value

      if (!goodFound) bestIdx = tileIdx;

      // Если эта плитка после сдвига встанет на своё место
      if (goalIdx === emptyIdx) {
        bestIdx   = tileIdx;
        goodFound = true;
        break;
      }
    }

    if (bestIdx < 0) return;

    // Подсветка — рисуем пульсирующую рамку поверх плитки
    const companion = COMPANIONS[this._companionId];
    const step      = this._tileSize + this._tileGap;
    const hRow      = Math.floor(bestIdx / this._size);
    const hCol      = bestIdx % this._size;
    const hx        = this._fieldX + hCol * step;
    const hy        = this._fieldY + hRow * step;
    const S         = this._tileSize;

    if (this._hintGfx) this._hintGfx.destroy();
    this._hintGfx = this.add.graphics().setDepth(15);
    this._hintGfx.lineStyle(3, companion.colorLight || COLORS.STAR, 0.9);
    this._hintGfx.strokeRoundedRect(hx + 1, hy + 1, S - 2, S - 2, 7);

    // Пульсация подсказки
    this._hintActive = true;
    this.tweens.add({
      targets:  this._hintGfx,
      alpha:    { from: 0.9, to: 0.2 },
      duration: SlidingPuzzleScene.T_HINT / 2,
      yoyo:     true,
      repeat:   2,
      ease:     'Sine.easeInOut',
      onComplete: () => {
        this._clearHint();
      },
    });
  }

  _clearHint() {
    if (this._hintGfx) {
      this._hintGfx.destroy();
      this._hintGfx = null;
    }
    this._hintActive = false;
  }

  // ─── Компаньон ──────────────────────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];
    const ORB_R     = 25; // радиус орба
    const orbX      = W - 44;
    const orbY      = H - 72;

    // Свечение-тень орба
    this._orbGlow = this.add.ellipse(orbX, orbY + 14, 56, 20, companion.color, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);

    // Орб компаньона (нарисованный программно)
    const orbGfx = this.add.graphics().setDepth(5);
    orbGfx.fillStyle(companion.color, 0.9);
    orbGfx.fillCircle(orbX, orbY, ORB_R);
    orbGfx.fillStyle(COLORS.WHITE, 0.2);
    orbGfx.fillCircle(orbX - 8, orbY - 8, 8);
    orbGfx.fillStyle(companion.colorDark || COLORS.BG_NIGHT, 0.25);
    orbGfx.fillCircle(orbX + 6, orbY + 6, 9);

    this._orbGfx = orbGfx;
    this._orbY   = orbY;

    // Анимация парения
    this.tweens.add({
      targets:  orbGfx,
      y:        -ANIM.FLOAT_AMPLITUDE,
      duration: ANIM.FLOAT_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Пульсация свечения
    this.tweens.add({
      targets:  this._orbGlow,
      alpha:    { from: 0.07, to: 0.22 },
      duration: ANIM.PULSE_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Текст реакции
    this._reactionTxt = this.add.text(orbX - ORB_R - 10, orbY, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'right',
      wordWrap:   { width: W - 80 },
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(6);
  }

  /** Лёгкое подпрыгивание орба при каждом ходе */
  _playCompanionHopReaction() {
    this.tweens.killTweensOf(this._orbGfx);
    this.tweens.add({
      targets:  this._orbGfx,
      y:        -14,
      duration: 120,
      yoyo:     true,
      ease:     'Quad.easeOut',
      onComplete: () => {
        // Возобновляем парение
        this.tweens.add({
          targets:  this._orbGfx,
          y:        -ANIM.FLOAT_AMPLITUDE,
          duration: ANIM.FLOAT_DURATION,
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        });
      },
    });
  }

  /** Показывает текстовую реплику компаньона */
  _showCompanionReaction(text) {
    if (!this._reactionTxt) return;
    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1600,
      delay:    900,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Кнопки ─────────────────────────────────────────────────────────────────

  _buildHintBtn(W, H) {
    const BW = 110;
    const BH = 34;
    const x  = W / 2 - BW / 2 - 4;
    const y  = H - 66;

    const bg = this.add.graphics();
    bg.fillStyle(0x1A0F35, 0.82);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);
    bg.lineStyle(1, COLORS.STAR, 0.4);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);

    const txt = this.add.text(0, 0, '✦ Подсказка', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#' + COLORS.STAR.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]).setDepth(10);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._showHint();
    });
  }

  _buildSurrenderBtn(W, H) {
    const BW = 110;
    const BH = 34;
    const x  = W / 2 + BW / 2 + 4;
    const y  = H - 66;

    const bg = this.add.graphics();
    bg.fillStyle(0x200A30, 0.8);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);
    bg.lineStyle(1, 0x4A2A5A, 0.5);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);

    const txt = this.add.text(0, 0, 'Сдаться', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#6A4A7A',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]).setDepth(10);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._endGame(false);
    });
  }

  // ─── Обновление HUD ─────────────────────────────────────────────────────────

  _updateMovesText() {
    if (!this._movesTxt) return;
    this._movesTxt.setText(String(this._moves));
    // Мини-пульсация счётчика
    this.tweens.add({
      targets:  this._movesTxt,
      scaleX:   1.2,
      scaleY:   1.2,
      duration: 60,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Таймер ─────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;

    this._timeLeft--;
    if (this._timerTxt) {
      this._timerTxt.setText(this._formatTime(this._timeLeft));
    }
    this._redrawTimerBar();

    // Предупреждение о конце времени
    if (this._timeLeft <= 10) {
      if (this._timerTxt) this._timerTxt.setColor('#FF4444');
    } else if (this._timeLeft <= 30) {
      if (this._timerTxt) this._timerTxt.setColor('#FF9B4E');
    }

    if (this._timeLeft <= 0) {
      this._endGame(false);
    }
  }

  // ─── Конец игры ─────────────────────────────────────────────────────────────

  _endGame(completed) {
    if (this._gameOver) return;
    this._gameOver = true;
    this._busy     = true;

    if (this._timerEvent) this._timerEvent.remove();
    this._clearHint();

    // Вычисляем счёт
    const rawScore = 1000 - (this._moves * 5) + (this._timeLeft * 2);
    const score    = Math.max(50, completed ? rawScore : Math.floor(rawScore * 0.4));

    // Вычисляем звёзды
    const N = this._size;
    let stars = 0;
    if (completed) {
      if (this._moves <= N * N)       stars = 3;
      else if (this._moves <= N * N * 2) stars = 2;
      else                               stars = 1;
    }

    // Если решено — сначала показываем анимацию сборки
    if (completed) {
      this.time.delayedCall(200, () => {
        this._playWinAnimation(() => {
          this._showResultOverlay(stars, score, completed);
        });
      });
    } else {
      this.time.delayedCall(300, () => {
        this._showResultOverlay(stars, score, completed);
      });
    }
  }

  /** Вспышка всех плиток при победе */
  _playWinAnimation(onDone) {
    const companion = COMPANIONS[this._companionId];
    const containers = this._tileContainers.filter(Boolean);

    // Волна подсветки по диагонали
    let delay = 0;
    for (let r = 0; r < this._size; r++) {
      for (let c = 0; c < this._size; c++) {
        const idx = r * this._size + c;
        const cont = this._tileContainers[idx];
        if (!cont) continue;
        this.tweens.add({
          targets:  cont,
          scaleX:   1.12,
          scaleY:   1.12,
          duration: 120,
          delay:    (r + c) * 40,
          yoyo:     true,
          ease:     'Quad.easeOut',
        });
      }
    }

    // Частицы победы
    this._spawnWinParticles(GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, companion.color);

    // Через 800мс переходим к оверлею
    this.time.delayedCall(800, onDone);
  }

  /** Частицы-орбы при победе */
  _spawnWinParticles(W, H, color) {
    const gfx       = this.add.graphics().setDepth(28);
    const particles = [];

    for (let i = 0; i < 30; i++) {
      particles.push({
        x:    Phaser.Math.Between(30, W - 30),
        y:    Phaser.Math.Between(H * 0.25, H * 0.6),
        vx:   Phaser.Math.FloatBetween(-2, 2),
        vy:   Phaser.Math.FloatBetween(-3.5, -1),
        size: Phaser.Math.FloatBetween(3, 8),
        life: 1,
      });
    }

    let elapsed = 0;
    const upd = (time, delta) => {
      elapsed += delta;
      if (elapsed > 2200) {
        gfx.destroy();
        this.events.off('update', upd);
        return;
      }
      gfx.clear();
      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.06;
        p.life = Math.max(0, 1 - elapsed / 2200);
        gfx.fillStyle(color, p.life * 0.75);
        gfx.fillCircle(p.x, p.y, p.size * p.life);
      }
    };
    this.events.on('update', upd);
  }

  // ─── Оверлей результата ─────────────────────────────────────────────────────

  _showResultOverlay(stars, score, completed) {
    const W         = GAME_CONFIG.WIDTH;
    const H         = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.68, duration: 300 });

    // Карточка
    const cardW  = 290;
    const cardH  = 280;
    const cardX  = W / 2 - cardW / 2;
    const cardY  = H / 2 - cardH / 2 - 20;

    const card = this.add.graphics().setDepth(31);
    card.fillStyle(0x0D0820, 0.96);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 20);
    card.lineStyle(1.5, companion.color, 0.5);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 20);

    // Заголовок
    const title = completed ? 'Пазл собран!' : 'Время вышло';
    this.add.text(W / 2, cardY + 26, title, {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#AA7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 62, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '38px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 112, `Очки: ${score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Ходы
    const N    = this._size;
    const goal = N * N;
    this.add.text(W / 2, cardY + 140, `Ходов: ${this._moves} (цель ≤ ${goal})`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реплика компаньона
    const reactionKey = completed ? (stars === 3 ? 'win' : 'idle') : 'lose';
    const reaction    = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 168, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: cardW - 40 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + cardH - 34, 'Продолжить', companion.color, stars, score, completed);
  }

  _buildResultBtn(x, y, label, color, stars, score, completed) {
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
      this.tweens.add({ targets: container, scaleX: 0.96, scaleY: 0.96, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._finishGame(stars, score, completed);
    });
  }

  // ─── Завершение сцены и возврат ─────────────────────────────────────────────

  /**
   * Обязательный метод согласно архитектуре мини-игр.
   * Сохраняет результат через GameState и возвращает управление ChapterScene.
   */
  _finishGame(stars, score, completed) {
    const timeMs = Date.now() - this._startTime;

    const result = {
      stars,
      score,
      timeMs,
      completed,
    };

    // Сохраняем результат если GameState доступен
    if (window.GameState && typeof GameState.saveMiniGameResult === 'function') {
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
