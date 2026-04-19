/**
 * Match3Scene.js — Мини-игра Match-3 «Искра и Эхо»
 *
 * Механика: swap двух соседних тайлов → совпадение 3+ в ряд/столбец →
 *           тайлы исчезают → гравитация (падение) → заполнение сверху.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 *
 * Поле: 7 колонок × 9 строк, тайл ~44px
 * Типы тайлов: 5 видов (цвета из COLORS)
 */

class Match3Scene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.MATCH3 });
  }

  // ─── Константы ─────────────────────────────────────────────────────────────

  static get COLS()       { return 7; }
  static get ROWS()       { return 9; }
  static get TILE_SIZE()  { return 44; }
  static get TILE_GAP()   { return 2; }

  // Тайминги анимаций (мс)
  static get T_SWAP()     { return 150; }
  static get T_FLASH()    { return 200; }
  static get T_FALL()     { return 200; }

  // Очки за совпадения
  static get SCORE_3()    { return 30; }
  static get SCORE_4()    { return 80; }
  static get SCORE_5()    { return 150; }

  // Цвета пяти типов тайлов (индекс 0-4)
  static get TILE_COLORS() {
    return [
      COLORS.SVETLYA,      // 0 — золотой (Светля)
      COLORS.DUH,          // 1 — голубой (Дух)
      COLORS.TEN,          // 2 — фиолетовый (Тень)
      COLORS.BTN_PRIMARY,  // 3 — оранжевый
      COLORS.ACCENT,       // 4 — коралловый
    ];
  }

  // Символы тайлов (Unicode)
  static get TILE_SYMBOLS() {
    return ['✦', '◈', '◉', '★', '♦'];
  }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || GameState.get('firstCompanion') || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    // Параметры сложности: { goal, timeSec }
    const DIFF = {
      easy:   { goal: 20, timeSec: 60 },
      normal: { goal: 30, timeSec: 50 },
      hard:   { goal: 40, timeSec: 40 },
    };
    const cfg = DIFF[this._difficulty] || DIFF.easy;
    this._goal    = cfg.goal;    // сколько групп уничтожить
    this._timeLeft = cfg.timeSec; // секунд на игру

    this._score       = 0;
    this._groupsCleared = 0; // количество уничтоженных групп
    this._comboCount  = 0;   // текущая цепочка combo
    this._busy        = false; // заблокировано ли поле (во время анимации)
    this._gameOver    = false;

    // Данные игрового поля: grid[row][col] = тип тайла (0-4) или -1 (пустой)
    this._grid = [];
    // Игровые объекты тайлов: tileObjects[row][col] = { gfx, symbol }
    this._tileObjects = [];

    // Выбранный тайл (первый в паре swap)
    this._selectedTile = null; // { row, col }
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    // Смещение поля от левого края (центровка)
    const STEP = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const fieldW = Match3Scene.COLS * STEP - Match3Scene.TILE_GAP;
    const fieldH = Match3Scene.ROWS * STEP - Match3Scene.TILE_GAP;
    this._fieldX = Math.floor((W - fieldW) / 2); // левый край поля
    this._fieldY = 80;                            // верхний край поля (под HUD)

    // ── Фон сцены ──
    this._drawBackground(W, H);

    // ── HUD (сверху) ──
    this._buildHUD(W);

    // ── Игровое поле ──
    this._initGrid();
    this._drawGrid();

    // ── Компаньон (справа внизу) ──
    this._buildCompanion(W, H);

    // ── Кнопка «Сдаться» ──
    this._buildSurrenderBtn(W, H);

    // ── Ввод (tap/click по полю) ──
    this._setupInput();

    // ── Таймер (тикает каждую секунду) ──
    this._timerEvent = this.time.addEvent({
      delay:    1000,
      callback: this._onTick,
      callbackScope: this,
      loop:     true,
    });

    // ── Начальный поиск готовых совпадений (чтобы поле сразу было чистым) ──
    // Даём один кадр на отрисовку, затем убираем начальные совпадения
    this.time.delayedCall(50, () => this._resolveInitialMatches());

    // ── Fade-in ──
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Фон ────────────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const companion = COMPANIONS[this._companionId];

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0D0820, 0x0D0820, 0x1A0F35, 0x1A0F35, 1);
    bg.fillRect(0, 0, W, H);

    // Слабое свечение цвета компаньона по краям поля
    const glow = this.add.graphics();
    glow.fillStyle(companion.color, 0.04);
    glow.fillRect(0, 0, W, H);

    // Подложка под игровое поле
    const STEP = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const fieldW = Match3Scene.COLS * STEP - Match3Scene.TILE_GAP;
    const fieldH = Match3Scene.ROWS * STEP - Match3Scene.TILE_GAP;
    const pad = 8;

    const fieldBg = this.add.graphics();
    fieldBg.fillStyle(0x0A0618, 0.7);
    fieldBg.fillRoundedRect(
      this._fieldX - pad,
      this._fieldY - pad,
      fieldW + pad * 2,
      fieldH + pad * 2,
      12
    );
    fieldBg.lineStyle(1, companion.color, 0.2);
    fieldBg.strokeRoundedRect(
      this._fieldX - pad,
      this._fieldY - pad,
      fieldW + pad * 2,
      fieldH + pad * 2,
      12
    );
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD(W) {
    const companion = COMPANIONS[this._companionId];

    // Фоновая полоса HUD
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0A0618, 0.85);
    hudBg.fillRect(0, 0, W, 76);
    hudBg.lineStyle(1, companion.color, 0.15);
    hudBg.lineBetween(0, 76, W, 76);

    // Название игры
    this.add.text(W / 2, 14, 'Match-3', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0);

    // Счёт
    this.add.text(16, 14, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._scoreTxt = this.add.text(16, 28, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#' + COLORS.SVETLYA.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Прогресс групп
    this.add.text(16, 52, `Цель: ${this._goal} групп`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._progressTxt = this.add.text(120, 52, `0 / ${this._goal}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Таймер (справа)
    this.add.text(W - 16, 14, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0);

    this._timerTxt = this.add.text(W - 16, 28, this._formatTime(this._timeLeft), {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0);

    // Полоса таймера
    this._timerBarBg = this.add.graphics();
    this._timerBarBg.fillStyle(0x1A1030, 1);
    this._timerBarBg.fillRoundedRect(W - 80, 52, 64, 10, 5);

    this._timerBar = this.add.graphics();
    this._updateTimerBar(W);
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _updateTimerBar(W) {
    const companion = COMPANIONS[this._companionId];
    const maxSec = { easy: 60, normal: 50, hard: 40 }[this._difficulty] || 60;
    const ratio = Math.max(0, this._timeLeft / maxSec);

    // Цвет меняется: зелёный → жёлтый → красный
    let barColor = companion.color;
    if (ratio < 0.3) barColor = 0xFF4444;
    else if (ratio < 0.6) barColor = COLORS.BTN_PRIMARY;

    this._timerBar.clear();
    this._timerBar.fillStyle(barColor, 0.8);
    this._timerBar.fillRoundedRect(W - 80, 52, Math.floor(64 * ratio), 10, 5);
  }

  // ─── Инициализация сетки ────────────────────────────────────────────────────

  _initGrid() {
    const ROWS = Match3Scene.ROWS;
    const COLS = Match3Scene.COLS;
    const types = Match3Scene.TILE_COLORS.length;

    for (let r = 0; r < ROWS; r++) {
      this._grid[r] = [];
      this._tileObjects[r] = [];
      for (let c = 0; c < COLS; c++) {
        // Выбираем случайный тип, избегая сразу трёх в ряд при инициализации
        let type;
        let attempts = 0;
        do {
          type = Phaser.Math.Between(0, types - 1);
          attempts++;
        } while (attempts < 10 && this._wouldMatchAt(r, c, type));
        this._grid[r][c] = type;
        this._tileObjects[r][c] = null;
      }
    }
  }

  /** Проверяет, создаст ли тайл типа type совпадение в позиции (r, c) */
  _wouldMatchAt(r, c, type) {
    // Горизонтально: два слева
    if (c >= 2 &&
        this._grid[r][c - 1] === type &&
        this._grid[r][c - 2] === type) return true;
    // Вертикально: два сверху
    if (r >= 2 &&
        this._grid[r - 1][c] === type &&
        this._grid[r - 2][c] === type) return true;
    return false;
  }

  // ─── Отрисовка игрового поля ────────────────────────────────────────────────

  _drawGrid() {
    const ROWS  = Match3Scene.ROWS;
    const COLS  = Match3Scene.COLS;
    const STEP  = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Удаляем старый объект если есть
        if (this._tileObjects[r][c]) {
          this._tileObjects[r][c].container.destroy();
        }
        this._tileObjects[r][c] = this._createTileObject(r, c);
      }
    }
  }

  /** Создаёт визуальный объект одного тайла */
  _createTileObject(row, col) {
    const STEP = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const SIZE = Match3Scene.TILE_SIZE;
    const type = this._grid[row][col];

    if (type < 0) return null;

    const color  = Match3Scene.TILE_COLORS[type];
    const symbol = Match3Scene.TILE_SYMBOLS[type];
    const x = this._fieldX + col * STEP + SIZE / 2;
    const y = this._fieldY + row * STEP + SIZE / 2;

    // Фоновый квадрат тайла
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 0.25);
    gfx.fillRoundedRect(-SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 8);
    gfx.lineStyle(1.5, color, 0.6);
    gfx.strokeRoundedRect(-SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 8);

    // Символ
    const txt = this.add.text(0, 0, symbol, {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      color:      '#' + color.toString(16).padStart(6, '0'),
      align:      'center',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [gfx, txt]).setDepth(5);

    return { container, gfx, txt, type };
  }

  // ─── Ввод ──────────────────────────────────────────────────────────────────

  _setupInput() {
    const STEP = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const ROWS = Match3Scene.ROWS;
    const COLS = Match3Scene.COLS;
    const fieldW = COLS * STEP - Match3Scene.TILE_GAP;
    const fieldH = ROWS * STEP - Match3Scene.TILE_GAP;

    // Интерактивная зона над всем полем
    const zone = this.add.zone(
      this._fieldX + fieldW / 2,
      this._fieldY + fieldH / 2,
      fieldW,
      fieldH
    ).setInteractive().setDepth(20);

    zone.on('pointerdown', (pointer) => {
      if (this._busy || this._gameOver) return;
      const col = Math.floor((pointer.x - this._fieldX) / STEP);
      const row = Math.floor((pointer.y - this._fieldY) / STEP);
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      this._onTileClick(row, col);
    });
  }

  _onTileClick(row, col) {
    if (!this._selectedTile) {
      // Первый тайл — выделяем
      this._selectedTile = { row, col };
      this._highlightTile(row, col, true);
    } else {
      const prev = this._selectedTile;
      this._highlightTile(prev.row, prev.col, false);
      this._selectedTile = null;

      if (prev.row === row && prev.col === col) {
        // Тот же тайл — снимаем выделение
        return;
      }

      // Проверяем: соседи?
      const dr = Math.abs(row - prev.row);
      const dc = Math.abs(col - prev.col);
      if (dr + dc === 1) {
        // Пытаемся поменять местами
        this._trySwap(prev.row, prev.col, row, col);
      } else {
        // Не сосед — выбираем новый тайл
        this._selectedTile = { row, col };
        this._highlightTile(row, col, true);
      }
    }
  }

  /** Подсвечивает / гасит тайл */
  _highlightTile(row, col, active) {
    const obj = this._tileObjects[row][col];
    if (!obj) return;

    const color  = Match3Scene.TILE_COLORS[obj.type];
    const SIZE   = Match3Scene.TILE_SIZE;

    obj.gfx.clear();
    if (active) {
      obj.gfx.fillStyle(color, 0.55);
      obj.gfx.fillRoundedRect(-SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 8);
      obj.gfx.lineStyle(2.5, COLORS.WHITE, 0.9);
      obj.gfx.strokeRoundedRect(-SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 8);
      this.tweens.add({ targets: obj.container, scaleX: 1.1, scaleY: 1.1, duration: 100 });
    } else {
      obj.gfx.fillStyle(color, 0.25);
      obj.gfx.fillRoundedRect(-SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 8);
      obj.gfx.lineStyle(1.5, color, 0.6);
      obj.gfx.strokeRoundedRect(-SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 8);
      this.tweens.add({ targets: obj.container, scaleX: 1, scaleY: 1, duration: 100 });
    }
  }

  // ─── Swap ──────────────────────────────────────────────────────────────────

  _trySwap(r1, c1, r2, c2) {
    this._busy = true;

    // Анимируем swap
    this._animateSwap(r1, c1, r2, c2, () => {
      // Делаем логический swap
      this._doSwap(r1, c1, r2, c2);

      // Ищем совпадения
      const matches = this._findMatches();

      if (matches.length === 0) {
        // Нет совпадений — откатываем обратно
        this._animateSwap(r1, c1, r2, c2, () => {
          this._doSwap(r1, c1, r2, c2);
          this._busy = false;
        });
      } else {
        // Есть совпадения — запускаем цепочку
        this._comboCount = 0;
        this._resolveMatches(matches);
      }
    });
  }

  _doSwap(r1, c1, r2, c2) {
    const tmp = this._grid[r1][c1];
    this._grid[r1][c1] = this._grid[r2][c2];
    this._grid[r2][c2] = tmp;

    const tmpObj = this._tileObjects[r1][c1];
    this._tileObjects[r1][c1] = this._tileObjects[r2][c2];
    this._tileObjects[r2][c2] = tmpObj;
  }

  _animateSwap(r1, c1, r2, c2, onComplete) {
    const STEP = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const SIZE = Match3Scene.TILE_SIZE;

    const obj1 = this._tileObjects[r1][c1];
    const obj2 = this._tileObjects[r2][c2];

    const x1 = this._fieldX + c1 * STEP + SIZE / 2;
    const y1 = this._fieldY + r1 * STEP + SIZE / 2;
    const x2 = this._fieldX + c2 * STEP + SIZE / 2;
    const y2 = this._fieldY + r2 * STEP + SIZE / 2;

    let done = 0;
    const check = () => { if (++done === 2) onComplete(); };

    if (obj1) {
      this.tweens.add({
        targets: obj1.container, x: x2, y: y2,
        duration: Match3Scene.T_SWAP, ease: 'Quad.easeInOut',
        onComplete: check,
      });
    } else { check(); }

    if (obj2) {
      this.tweens.add({
        targets: obj2.container, x: x1, y: y1,
        duration: Match3Scene.T_SWAP, ease: 'Quad.easeInOut',
        onComplete: check,
      });
    } else { check(); }
  }

  // ─── Поиск совпадений ───────────────────────────────────────────────────────

  /**
   * Возвращает массив массивов позиций: [[{r,c},{r,c},...], ...]
   * Каждый внутренний массив — одна группа совпадений.
   */
  _findMatches() {
    const ROWS = Match3Scene.ROWS;
    const COLS = Match3Scene.COLS;
    const marked = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const groups = [];

    // Горизонтальные совпадения
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const type = this._grid[r][c];
        if (type < 0) { c++; continue; }
        let end = c + 1;
        while (end < COLS && this._grid[r][end] === type) end++;
        if (end - c >= 3) {
          const group = [];
          for (let k = c; k < end; k++) group.push({ r, c: k });
          groups.push(group);
        }
        c = end;
      }
    }

    // Вертикальные совпадения
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const type = this._grid[r][c];
        if (type < 0) { r++; continue; }
        let end = r + 1;
        while (end < ROWS && this._grid[end][c] === type) end++;
        if (end - r >= 3) {
          const group = [];
          for (let k = r; k < end; k++) group.push({ r: k, c });
          groups.push(group);
        }
        r = end;
      }
    }

    return groups;
  }

  // ─── Разбор совпадений (основной игровой цикл) ──────────────────────────────

  _resolveMatches(groups) {
    this._comboCount++;

    // Собираем уникальные позиции для удаления
    const toRemove = new Set();
    for (const group of groups) {
      for (const pos of group) {
        toRemove.add(`${pos.r}_${pos.c}`);
      }
    }

    // Начисляем очки
    for (const group of groups) {
      let pts = 0;
      if (group.length >= 5)      pts = Match3Scene.SCORE_5;
      else if (group.length >= 4) pts = Match3Scene.SCORE_4;
      else                        pts = Match3Scene.SCORE_3;

      // Множитель combo
      if (this._comboCount > 1) {
        pts = Math.floor(pts * Math.pow(1.5, this._comboCount - 1));
      }
      this._score += pts;
      this._groupsCleared++;
    }

    this._updateHUD();

    // Реакция компаньона при combo ≥ 2
    if (this._comboCount >= 2) {
      this._playCompanionReaction();
    }

    // Анимация вспышки
    this._flashTiles(toRemove, () => {
      // Удаляем тайлы из логики
      for (const key of toRemove) {
        const [r, c] = key.split('_').map(Number);
        this._grid[r][c] = -1;
        if (this._tileObjects[r][c]) {
          this._tileObjects[r][c].container.destroy();
          this._tileObjects[r][c] = null;
        }
      }

      // Применяем гравитацию
      this._applyGravity(() => {
        // Заполняем сверху
        this._refillGrid(() => {
          // Проверяем новые совпадения (cascade)
          const newMatches = this._findMatches();
          if (newMatches.length > 0) {
            this._resolveMatches(newMatches);
          } else {
            this._comboCount = 0;
            this._busy = false;

            // Проверяем победу
            if (this._groupsCleared >= this._goal) {
              this._endGame(true);
            }
          }
        });
      });
    });
  }

  /** Анимация вспышки при удалении тайлов */
  _flashTiles(keys, onComplete) {
    let count = keys.size;
    if (count === 0) { onComplete(); return; }

    let done = 0;
    const check = () => { if (++done >= count) onComplete(); };

    for (const key of keys) {
      const [r, c] = key.split('_').map(Number);
      const obj = this._tileObjects[r][c];
      if (!obj) { check(); continue; }

      this.tweens.add({
        targets:  obj.container,
        scaleX:   1.4, scaleY: 1.4,
        alpha:    0,
        duration: Match3Scene.T_FLASH,
        ease:     'Quad.easeOut',
        onComplete: check,
      });
    }
  }

  // ─── Гравитация ─────────────────────────────────────────────────────────────

  _applyGravity(onComplete) {
    const ROWS = Match3Scene.ROWS;
    const COLS = Match3Scene.COLS;
    const STEP = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const SIZE = Match3Scene.TILE_SIZE;

    let totalMoves = 0;
    let doneMoves  = 0;

    const check = () => { if (++doneMoves >= totalMoves) onComplete(); };

    for (let c = 0; c < COLS; c++) {
      // Сжимаем столбец: убираем пустые ячейки, сдвигаем тайлы вниз
      let writeRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this._grid[r][c] >= 0) {
          if (r !== writeRow) {
            // Перемещаем тайл
            this._grid[writeRow][c] = this._grid[r][c];
            this._grid[r][c] = -1;

            this._tileObjects[writeRow][c] = this._tileObjects[r][c];
            this._tileObjects[r][c] = null;

            if (this._tileObjects[writeRow][c]) {
              const targetY = this._fieldY + writeRow * STEP + SIZE / 2;
              totalMoves++;
              this.tweens.add({
                targets:  this._tileObjects[writeRow][c].container,
                y:        targetY,
                duration: Match3Scene.T_FALL,
                ease:     'Quad.easeIn',
                onComplete: check,
              });
            }
          }
          writeRow--;
        }
      }
    }

    if (totalMoves === 0) onComplete();
  }

  // ─── Заполнение сетки ───────────────────────────────────────────────────────

  _refillGrid(onComplete) {
    const ROWS  = Match3Scene.ROWS;
    const COLS  = Match3Scene.COLS;
    const STEP  = Match3Scene.TILE_SIZE + Match3Scene.TILE_GAP;
    const SIZE  = Match3Scene.TILE_SIZE;
    const types = Match3Scene.TILE_COLORS.length;

    let count = 0;
    let done  = 0;

    const check = () => { if (++done >= count) onComplete(); };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this._grid[r][c] < 0) {
          const type = Phaser.Math.Between(0, types - 1);
          this._grid[r][c] = type;

          // Создаём объект тайла выше поля (падает сверху)
          const x = this._fieldX + c * STEP + SIZE / 2;
          const y = this._fieldY + r * STEP + SIZE / 2;

          const obj = this._createTileObject(r, c);
          if (obj) {
            this._tileObjects[r][c] = obj;
            // Начинаем сверху поля
            obj.container.setPosition(x, this._fieldY - SIZE);
            obj.container.setAlpha(0);

            count++;
            this.tweens.add({
              targets:  obj.container,
              y:        y,
              alpha:    1,
              duration: Match3Scene.T_FALL,
              ease:     'Quad.easeIn',
              onComplete: check,
            });
          }
        }
      }
    }

    if (count === 0) onComplete();
  }

  // ─── Начальная очистка совпадений ───────────────────────────────────────────

  /** Убирает совпадения, которые случайно возникли при генерации поля */
  _resolveInitialMatches() {
    const matches = this._findMatches();
    if (matches.length === 0) return;

    for (const group of matches) {
      for (const pos of group) {
        // Меняем тип тайла на другой
        const types = Match3Scene.TILE_COLORS.length;
        let newType = Phaser.Math.Between(0, types - 1);
        let tries = 0;
        while (newType === this._grid[pos.r][pos.c] && tries < 10) {
          newType = Phaser.Math.Between(0, types - 1);
          tries++;
        }
        this._grid[pos.r][pos.c] = newType;

        // Перерисовываем тайл
        if (this._tileObjects[pos.r][pos.c]) {
          this._tileObjects[pos.r][pos.c].container.destroy();
        }
        this._tileObjects[pos.r][pos.c] = this._createTileObject(pos.r, pos.c);
      }
    }

    // Рекурсивно проверяем снова
    this._resolveInitialMatches();
  }

  // ─── Компаньон ──────────────────────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];
    const ORB_SIZE = 60;
    const orbX = W - 50;
    const orbY = H - 80;

    // Свечение
    this._orbGlow = this.add.ellipse(orbX, orbY + 12, 70, 26, companion.color, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);

    // Сам орб (компаньон)
    this._orbSprite = this.add.image(orbX, orbY, `orb_${this._companionId}`)
      .setDisplaySize(ORB_SIZE, ORB_SIZE)
      .setDepth(5);

    // Парение
    this.tweens.add({
      targets:  this._orbSprite,
      y:        orbY - ANIM.FLOAT_AMPLITUDE,
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
    this._reactionTxt = this.add.text(orbX - ORB_SIZE / 2 - 8, orbY, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'right',
      wordWrap:   { width: W - ORB_SIZE - 40 },
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(6);
  }

  /** Анимация реакции компаньона (подпрыгивает при combo) */
  _playCompanionReaction() {
    const companion = COMPANIONS[this._companionId];

    // Подпрыгивание
    this.tweens.add({
      targets:  this._orbSprite,
      y:        this._orbSprite.y - 20,
      duration: 200,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });

    // Показываем реплику
    const text = `Combo ×${this._comboCount}!`;
    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1500,
      delay:    800,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Кнопка «Сдаться» ───────────────────────────────────────────────────────

  _buildSurrenderBtn(W, H) {
    const BW = 120;
    const BH = 36;
    const x  = 60;
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

    this._timeLeft--;
    this._timerTxt.setText(this._formatTime(this._timeLeft));
    this._updateTimerBar(GAME_CONFIG.WIDTH);

    // Тайл таймера краснеет при мало времени
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
    this._progressTxt.setText(`${this._groupsCleared} / ${this._goal}`);

    // Анимация подпрыгивания счёта
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
    this._busy     = true;

    if (this._timerEvent) this._timerEvent.remove();

    // Считаем звёзды
    let stars = 0;
    if (completed || this._groupsCleared > 0) {
      if (this._groupsCleared >= this._goal * 1.5)      stars = 3;
      else if (this._groupsCleared >= this._goal)        stars = 2;
      else if (this._groupsCleared > 0)                  stars = 1;
    }

    // Показываем оверлей результата
    this.time.delayedCall(300, () => {
      this._showResultOverlay(stars, completed);
    });
  }

  _showResultOverlay(stars, completed) {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.65, duration: 300 });

    // Карточка результата
    const cardY = H / 2 - 80;
    const card  = this.add.graphics().setDepth(31);
    card.fillStyle(0x0D0820, 0.95);
    card.fillRoundedRect(W / 2 - 140, cardY, 280, 260, 20);
    card.lineStyle(1.5, companion.color, 0.5);
    card.strokeRoundedRect(W / 2 - 140, cardY, 280, 260, 20);

    // Заголовок
    const title = completed ? 'Уровень пройден!' : 'Время вышло';
    this.add.text(W / 2, cardY + 28, title, {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#AA7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 66, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '36px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 116, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Группы
    this.add.text(W / 2, cardY + 144, `Групп: ${this._groupsCleared} / ${this._goal}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реплика компаньона
    const reactionKey = completed ? (stars === 3 ? 'win' : 'idle') : 'lose';
    const reaction = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 172, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: 240 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + 228, 'Продолжить', companion.color, stars, completed);

    // Анимация звёзд-частиц при победе
    if (stars >= 2) {
      this._spawnWinParticles(W, H, companion.color);
    }
  }

  _buildResultBtn(x, y, label, color, stars, completed) {
    const BW = 200;
    const BH = 44;

    const bg = this.add.graphics().setDepth(33);
    bg.fillStyle(color, 0.3);
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

  /** Частицы победы */
  _spawnWinParticles(W, H, color) {
    const graphics = this.add.graphics().setDepth(29);
    const particles = [];

    for (let i = 0; i < 25; i++) {
      particles.push({
        x: Phaser.Math.Between(40, W - 40),
        y: Phaser.Math.Between(H * 0.2, H * 0.5),
        vy: Phaser.Math.FloatBetween(-3, -1),
        vx: Phaser.Math.FloatBetween(-1.5, 1.5),
        size: Phaser.Math.FloatBetween(3, 7),
        alpha: 1,
        life: 1,
      });
    }

    // Используем update для анимации частиц
    let elapsed = 0;
    const updateFn = (time, delta) => {
      elapsed += delta;
      if (elapsed > 2000) {
        graphics.destroy();
        this.events.off('update', updateFn);
        return;
      }
      graphics.clear();
      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.05;
        p.life = Math.max(0, 1 - elapsed / 2000);
        graphics.fillStyle(color, p.life * 0.8);
        graphics.fillCircle(p.x, p.y, p.size * p.life);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Завершение и возврат ────────────────────────────────────────────────────

  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = { stars, score: this._score, timeMs, completed };

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
