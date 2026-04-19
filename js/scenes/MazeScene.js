/**
 * MazeScene.js — Мини-игра «Лабиринт» для «Искра и Эхо»
 *
 * Механика: игрок-шарик перемещается по лабиринту (tap на соседнюю клетку
 * или свайп), собирает светляков-коллектиблов и находит выход.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 *
 * Размеры поля:
 *   easy   — 13×19 клеток, таймер 120 с
 *   normal — 17×25 клеток, таймер 90 с
 *   hard   — 21×31 клеток, таймер 60 с
 *
 * Генерация: Recursive Backtracking (DFS) — гарантирует связный лабиринт
 * без петель (perfect maze).
 *
 * Счёт: 1000 − (шаги × 2) + (светляки × 100), минимум 100
 */

class MazeScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.MAZE });
  }

  // ─── Конфигурация сложности ─────────────────────────────────────────────────

  static get DIFFICULTY_CONFIG() {
    return {
      easy:   { cols: 13, rows: 19, timeSec: 120, fireflies: 3 },
      normal: { cols: 17, rows: 25, timeSec: 90,  fireflies: 4 },
      hard:   { cols: 21, rows: 31, timeSec: 60,  fireflies: 5 },
    };
  }

  // Размер одной клетки в пикселях (адаптивный, вычисляется в create)
  static get CELL_SIZE_MAX() { return 26; }
  static get CELL_SIZE_MIN() { return 14; }

  // Значения клеток лабиринта (битовые флаги стен: N=1, E=2, S=4, W=8)
  static get WALL_N() { return 1; }
  static get WALL_E() { return 2; }
  static get WALL_S() { return 4; }
  static get WALL_W() { return 8; }

  // Цвета среды лабиринта
  static get COLOR_WALL()    { return 0x1A0B2E; }  // тёмно-фиолетовый
  static get COLOR_PASSAGE() { return 0x0F0620; }  // чуть светлее фона
  static get COLOR_VISITED() { return 0x130924; }  // едва видимый след

  // Тайминги анимаций (мс)
  static get T_MOVE()      { return 120; }   // движение игрока
  static get T_COLLECT()   { return 300; }   // сбор светляка
  static get T_BLINK()     { return 400; }   // моргание орба компаньона

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || (typeof GameState !== 'undefined'
                          ? GameState.get('firstCompanion')
                          : null) || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    // Параметры из конфига сложности
    const cfg = MazeScene.DIFFICULTY_CONFIG[this._difficulty]
             || MazeScene.DIFFICULTY_CONFIG.easy;
    this._mazeW       = cfg.cols;      // ширина лабиринта в клетках
    this._mazeH       = cfg.rows;      // высота лабиринта в клетках
    this._timeLeft    = cfg.timeSec;   // оставшееся время (секунды)
    this._maxTime     = cfg.timeSec;   // максимум для вычисления звёзд
    this._ffCount     = cfg.fireflies; // сколько светляков размещать

    // Игровое состояние
    this._steps          = 0;      // сделано шагов
    this._collected      = 0;      // собрано светляков
    this._score          = 0;
    this._gameOver       = false;
    this._moving         = false;  // идёт анимация хода — блок ввода

    // Позиция игрока (в клетках)
    this._playerCol = 1;
    this._playerRow = 1;

    // Данные лабиринта: grid[row][col] = битовая маска стен (которых НЕТ)
    // 0 = все стены; бит установлен = прохода в том направлении НЕТ
    // После генерации бит = 1 означает, что прохода в этом направлении нет
    // Мы используем обратную схему: _walls[r][c] хранит направления-стены
    // Для прохода между клетками нужно УБРАТЬ стену с обеих сторон.
    this._walls = [];   // _walls[r][c] = маска стен (1=N,2=E,4=S,8=W)

    // Позиции светляков: массив { col, row, collected }
    this._fireflies = [];

    // Позиция выхода
    this._exitCol = 0;
    this._exitRow = 0;

    // Свайп-распознавание
    this._swipeStart = null;  // { x, y }

    // Мини-карта
    this._minimapGfx = null;

    // Игровые объекты
    this._playerGfx   = null;  // Graphics шарика игрока
    this._playerGlow  = null;  // Graphics свечения игрока
    this._mazeGfx     = null;  // Graphics стен лабиринта
    this._fogGfx      = null;  // Graphics тумана войны
    this._ffObjects   = [];    // Graphics светляков

    // Fog of war: посещённые клетки
    this._visited = [];

    // HUD-объекты (обновляются в _updateHUD)
    this._scoreTxt    = null;
    this._timerTxt    = null;
    this._timerBar    = null;
    this._stepsTxt    = null;
    this._ffTxt       = null;
    this._orbSprite   = null;
    this._orbGlow     = null;
    this._reactionTxt = null;

    // Событие таймера
    this._timerEvent  = null;

    // Смещение поля (пиксели)
    this._fieldX = 0;
    this._fieldY = 0;
    this._cellSize = 20;
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    // Вычисляем размер клетки так, чтобы лабиринт вписался в поле
    const hudH       = 80;   // высота верхнего HUD
    const companionH = 80;   // высота нижней панели компаньона
    const fieldH     = H - hudH - companionH;
    const fieldW     = W - 8; // 4px отступ по бокам

    const cellByW = Math.floor(fieldW  / this._mazeW);
    const cellByH = Math.floor(fieldH  / this._mazeH);
    this._cellSize = Math.max(
      MazeScene.CELL_SIZE_MIN,
      Math.min(MazeScene.CELL_SIZE_MAX, Math.min(cellByW, cellByH))
    );

    // Центрируем поле горизонтально и вертикально в доступной зоне
    const actualW = this._cellSize * this._mazeW;
    const actualH = this._cellSize * this._mazeH;
    this._fieldX  = Math.floor((W - actualW) / 2);
    this._fieldY  = hudH + Math.floor((fieldH - actualH) / 2);

    // Инициализируем матрицу посещённых клеток
    for (let r = 0; r < this._mazeH; r++) {
      this._visited[r] = new Array(this._mazeW).fill(false);
    }

    // ── Генерация лабиринта ──
    this._walls = this._generateMaze(this._mazeW, this._mazeH);

    // ── Старт и выход ──
    // Старт всегда в левом-верхнем углу (1,1), выход — правый-нижний
    this._playerCol = 1;
    this._playerRow = 1;
    this._exitCol   = this._mazeW - 2;
    this._exitRow   = this._mazeH - 2;

    // ── Фон ──
    this._drawBackground(W, H);

    // ── HUD (сверху) ──
    this._buildHUD(W);

    // ── Лабиринт (Graphics) ──
    this._mazeGfx = this.add.graphics().setDepth(2);
    this._drawMaze();

    // ── Туман войны ──
    this._fogGfx = this.add.graphics().setDepth(6);
    this._updateFog();

    // ── Размещение светляков ──
    this._placeCollectibles();

    // ── Игрок ──
    this._buildPlayer();

    // ── Компаньон (снизу) ──
    this._buildCompanion(W, H);

    // ── Кнопка «Сдаться» ──
    this._buildSurrenderBtn(W, H);

    // ── Мини-карта ──
    this._buildMinimap(W);

    // ── Ввод ──
    this._setupInput();

    // ── Таймер ──
    this._timerEvent = this.time.addEvent({
      delay:         1000,
      callback:      this._onTick,
      callbackScope: this,
      loop:          true,
    });

    // ── Отмечаем стартовую позицию как посещённую ──
    this._markVisited(this._playerCol, this._playerRow);

    // ── Fade-in ──
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Генерация лабиринта (Recursive Backtracking / DFS) ─────────────────────

  /**
   * Возвращает двумерный массив _walls[row][col] — битовую маску ЗАКРЫТЫХ стен.
   * Бит 1 (N), 2 (E), 4 (S), 8 (W). Изначально все стены закрыты (15 = 0b1111).
   * После DFS убираем стены между посещёнными соседями.
   *
   * @param {number} cols — ширина в клетках
   * @param {number} rows — высота в клетках
   * @returns {number[][]}
   */
  _generateMaze(cols, rows) {
    // Инициализируем: все стены закрыты
    const walls = [];
    for (let r = 0; r < rows; r++) {
      walls[r] = new Array(cols).fill(15); // 15 = все четыре стены
    }

    // DFS итеративный (избегаем переполнение стека при больших лабиринтах)
    const visited = [];
    for (let r = 0; r < rows; r++) {
      visited[r] = new Array(cols).fill(false);
    }

    // Четыре направления: [dr, dc, стена от текущей, противоположная стена]
    const DIRS = [
      [-1,  0, MazeScene.WALL_N, MazeScene.WALL_S], // север
      [ 0,  1, MazeScene.WALL_E, MazeScene.WALL_W], // восток
      [ 1,  0, MazeScene.WALL_S, MazeScene.WALL_N], // юг
      [ 0, -1, MazeScene.WALL_W, MazeScene.WALL_E], // запад
    ];

    // Стек: { r, c }
    const stack = [{ r: 1, c: 1 }];
    visited[1][1] = true;

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const { r, c } = current;

      // Собираем непосещённых соседей (на расстоянии 2, через стену)
      // В нечётных координатах — «комнаты», чётных — стены
      // Но мы используем упрощённую модель: каждая клетка — комната
      const neighbours = [];
      for (const [dr, dc, wallFrom, wallTo] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 1 && nr < rows - 1 && nc >= 1 && nc < cols - 1
            && !visited[nr][nc]) {
          neighbours.push({ nr, nc, wallFrom, wallTo });
        }
      }

      if (neighbours.length === 0) {
        // Тупик — отступаем
        stack.pop();
      } else {
        // Выбираем случайного соседа
        const idx = Phaser.Math.Between(0, neighbours.length - 1);
        const { nr, nc, wallFrom, wallTo } = neighbours[idx];

        // Убираем стены между current и neighbour
        walls[r][c]   &= ~wallFrom;  // убираем стену из текущей клетки
        walls[nr][nc] &= ~wallTo;    // убираем стену из соседней

        visited[nr][nc] = true;
        stack.push({ r: nr, c: nc });
      }
    }

    // Гарантируем, что граница из стен не задета
    // (крайние строки/столбцы остаются закрытыми — они служат внешними стенами)
    for (let r = 0; r < rows; r++) {
      walls[r][0]        = 15;
      walls[r][cols - 1] = 15;
    }
    for (let c = 0; c < cols; c++) {
      walls[0][c]        = 15;
      walls[rows - 1][c] = 15;
    }

    return walls;
  }

  // ─── Отрисовка лабиринта ─────────────────────────────────────────────────────

  _drawMaze() {
    const gfx  = this._mazeGfx;
    const cs   = this._cellSize;
    const fx   = this._fieldX;
    const fy   = this._fieldY;
    const companion = COMPANIONS[this._companionId];

    gfx.clear();

    for (let r = 0; r < this._mazeH; r++) {
      for (let c = 0; c < this._mazeW; c++) {
        const x = fx + c * cs;
        const y = fy + r * cs;
        const w = this._walls[r][c];

        // Рисуем пол прохода (тёмный фон)
        if (w !== 15) {
          // Это проходная клетка
          gfx.fillStyle(MazeScene.COLOR_PASSAGE, 1);
          gfx.fillRect(x, y, cs, cs);
        } else {
          // Стена
          gfx.fillStyle(MazeScene.COLOR_WALL, 1);
          gfx.fillRect(x, y, cs, cs);
        }
      }
    }

    // Стены: отрисовываем линии поверх клеток для более чёткого вида
    gfx.lineStyle(1, 0x2A0E44, 0.5);
    for (let r = 0; r < this._mazeH; r++) {
      for (let c = 0; c < this._mazeW; c++) {
        const x = fx + c * cs;
        const y = fy + r * cs;
        const w = this._walls[r][c];

        if (w === 15) continue; // стена, уже закрашена

        // Северная граница прохода
        if (w & MazeScene.WALL_N) {
          gfx.fillStyle(MazeScene.COLOR_WALL, 1);
          gfx.fillRect(x, y, cs, 2);
        }
        // Южная граница
        if (w & MazeScene.WALL_S) {
          gfx.fillStyle(MazeScene.COLOR_WALL, 1);
          gfx.fillRect(x, y + cs - 2, cs, 2);
        }
        // Западная граница
        if (w & MazeScene.WALL_W) {
          gfx.fillStyle(MazeScene.COLOR_WALL, 1);
          gfx.fillRect(x, y, 2, cs);
        }
        // Восточная граница
        if (w & MazeScene.WALL_E) {
          gfx.fillStyle(MazeScene.COLOR_WALL, 1);
          gfx.fillRect(x + cs - 2, y, 2, cs);
        }
      }
    }

    // Выход — подсвечиваем цветом компаньона
    this._drawExit();
  }

  /** Рисует маркер выхода с лёгким свечением */
  _drawExit() {
    const gfx       = this._mazeGfx;
    const companion = COMPANIONS[this._companionId];
    const cs        = this._cellSize;
    const x         = this._fieldX + this._exitCol * cs;
    const y         = this._fieldY + this._exitRow * cs;

    // Несколько слоёв свечения
    for (let i = 3; i >= 0; i--) {
      gfx.fillStyle(companion.color, 0.04 + i * 0.06);
      gfx.fillRect(x - i, y - i, cs + i * 2, cs + i * 2);
    }

    // Заливка выхода
    gfx.fillStyle(companion.color, 0.22);
    gfx.fillRect(x + 2, y + 2, cs - 4, cs - 4);

    // Символ выхода (маленький крест-звезда)
    const mid = cs / 2;
    gfx.fillStyle(companion.colorLight || COLORS.WHITE, 0.7);
    gfx.fillRect(x + mid - 1, y + 3, 2, cs - 6);
    gfx.fillRect(x + 3, y + mid - 1, cs - 6, 2);
  }

  // ─── Туман войны ─────────────────────────────────────────────────────────────

  /**
   * Закрашивает непосещённые клетки густым туманом.
   * Посещённые видны. Соседние (обзор 1 клетка) — полупрозрачны.
   */
  _updateFog() {
    const gfx = this._fogGfx;
    const cs  = this._cellSize;
    const fx  = this._fieldX;
    const fy  = this._fieldY;

    gfx.clear();

    for (let r = 0; r < this._mazeH; r++) {
      for (let c = 0; c < this._mazeW; c++) {
        if (this._visited[r][c]) continue; // уже видно

        // Проверяем, является ли клетка соседом посещённой (обзор)
        const isNear = this._isNearVisited(c, r);

        const x = fx + c * cs;
        const y = fy + r * cs;

        if (isNear) {
          // Полупрозрачный туман для «периферии»
          gfx.fillStyle(0x0A0618, 0.55);
        } else {
          // Глухой туман для непосещённых
          gfx.fillStyle(0x0A0618, 0.92);
        }
        gfx.fillRect(x, y, cs, cs);
      }
    }
  }

  /** Проверяет, есть ли посещённая клетка в радиусе 1 от (col, row) */
  _isNearVisited(col, row) {
    const checks = [
      [row - 1, col], [row + 1, col],
      [row, col - 1], [row, col + 1],
    ];
    for (const [r, c] of checks) {
      if (r >= 0 && r < this._mazeH && c >= 0 && c < this._mazeW
          && this._visited[r][c]) {
        return true;
      }
    }
    return false;
  }

  /** Помечает клетку и её ближайших соседей как посещённые */
  _markVisited(col, row) {
    if (row >= 0 && row < this._mazeH && col >= 0 && col < this._mazeW) {
      this._visited[row][col] = true;
    }
  }

  // ─── Светляки-коллектиблы ───────────────────────────────────────────────────

  /** Размещает светляков в случайных проходимых клетках, подальше от старта */
  _placeCollectibles() {
    // Собираем список проходимых клеток, исключая старт и финиш
    const passable = [];
    for (let r = 1; r < this._mazeH - 1; r++) {
      for (let c = 1; c < this._mazeW - 1; c++) {
        if (this._walls[r][c] !== 15) {
          const distFromStart = Math.abs(c - this._playerCol) + Math.abs(r - this._playerRow);
          const isExit        = (c === this._exitCol && r === this._exitRow);
          // Размещаем только если клетка далеко от старта (минимум 5 шагов)
          if (!isExit && distFromStart >= 5) {
            passable.push({ col: c, row: r });
          }
        }
      }
    }

    // Перемешиваем и берём первые N
    Phaser.Utils.Array.Shuffle(passable);
    const count = Math.min(this._ffCount, passable.length);

    for (let i = 0; i < count; i++) {
      const pos = passable[i];
      this._fireflies.push({ col: pos.col, row: pos.row, collected: false });
      this._createFireflyGfx(i, pos.col, pos.row);
    }
  }

  /** Создаёт Graphics-объект одного светляка */
  _createFireflyGfx(idx, col, row) {
    const cs       = this._cellSize;
    const cx       = this._fieldX + col * cs + cs / 2;
    const cy       = this._fieldY + row * cs + cs / 2;
    const r        = Math.max(3, cs / 4);
    const companion = COMPANIONS[this._companionId];

    // Внешнее свечение
    const glow = this.add.graphics().setDepth(4);
    glow.fillStyle(COLORS.SVETLYA, 0.18);
    glow.fillCircle(cx, cy, r * 2.5);

    // Сам светляк
    const dot = this.add.graphics().setDepth(5);
    dot.fillStyle(COLORS.SVETLYA_LIGHT, 0.9);
    dot.fillCircle(cx, cy, r);

    // Пульсирующая анимация
    this.tweens.add({
      targets:  [dot, glow],
      alpha:    { from: 0.6, to: 1.0 },
      duration: 900 + idx * 130,  // немного разный ритм у каждого
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Лёгкое парение
    this.tweens.add({
      targets:  [dot, glow],
      y:        `-=${Math.floor(cs / 3)}`,
      duration: 1400 + idx * 200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    this._ffObjects[idx] = { dot, glow };
  }

  // ─── Игрок ──────────────────────────────────────────────────────────────────

  _buildPlayer() {
    const cs        = this._cellSize;
    const companion = COMPANIONS[this._companionId];
    const cx        = this._fieldX + this._playerCol * cs + cs / 2;
    const cy        = this._fieldY + this._playerRow * cs + cs / 2;
    const r         = Math.max(4, Math.floor(cs * 0.35));

    // Свечение игрока
    this._playerGlow = this.add.graphics().setDepth(7);
    this._playerGlow.fillStyle(companion.color, 0.22);
    this._playerGlow.fillCircle(cx, cy, r * 2.2);

    // Шарик игрока
    this._playerGfx = this.add.graphics().setDepth(8);
    this._playerGfx.fillStyle(companion.color, 1);
    this._playerGfx.fillCircle(cx, cy, r);

    // Лёгкий бликовый кружок (имитация объёма)
    this._playerGfx.fillStyle(companion.colorLight || COLORS.WHITE, 0.45);
    this._playerGfx.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.35);

    // Пульсация свечения
    this.tweens.add({
      targets:  this._playerGlow,
      alpha:    { from: 0.15, to: 0.4 },
      duration: ANIM.PULSE_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  /** Перерисовывает игрока в текущей позиции (вызывается после _movePlayer) */
  _redrawPlayer() {
    const cs        = this._cellSize;
    const companion = COMPANIONS[this._companionId];
    const cx        = this._fieldX + this._playerCol * cs + cs / 2;
    const cy        = this._fieldY + this._playerRow * cs + cs / 2;
    const r         = Math.max(4, Math.floor(cs * 0.35));

    this._playerGlow.clear();
    this._playerGlow.fillStyle(companion.color, 0.22);
    this._playerGlow.fillCircle(cx, cy, r * 2.2);

    this._playerGfx.clear();
    this._playerGfx.fillStyle(companion.color, 1);
    this._playerGfx.fillCircle(cx, cy, r);
    this._playerGfx.fillStyle(companion.colorLight || COLORS.WHITE, 0.45);
    this._playerGfx.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.35);
  }

  // ─── Ввод ────────────────────────────────────────────────────────────────────

  _setupInput() {
    // Создаём интерактивную зону по всему полю лабиринта
    const fieldW = this._mazeW * this._cellSize;
    const fieldH = this._mazeH * this._cellSize;

    const zone = this.add.zone(
      this._fieldX + fieldW / 2,
      this._fieldY + fieldH / 2,
      fieldW,
      fieldH
    ).setInteractive().setDepth(20);

    // tap: определяем клетку, в которую тапнул игрок
    zone.on('pointerdown', (pointer) => {
      if (this._moving || this._gameOver) return;
      this._swipeStart = { x: pointer.x, y: pointer.y };
    });

    zone.on('pointerup', (pointer) => {
      if (this._gameOver) return;

      const dx = pointer.x - (this._swipeStart ? this._swipeStart.x : pointer.x);
      const dy = pointer.y - (this._swipeStart ? this._swipeStart.y : pointer.y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 20) {
        // Свайп: определяем направление по большей оси
        if (!this._moving) {
          if (Math.abs(dx) > Math.abs(dy)) {
            this._movePlayer(dx > 0 ? 1 : -1, 0);
          } else {
            this._movePlayer(0, dy > 0 ? 1 : -1);
          }
        }
      } else {
        // Tap: вычисляем клетку, куда тапнул
        if (this._moving) return;
        const tCol = Math.floor((pointer.x - this._fieldX) / this._cellSize);
        const tRow = Math.floor((pointer.y - this._fieldY) / this._cellSize);
        const dCol = tCol - this._playerCol;
        const dRow = tRow - this._playerRow;

        // Разрешаем только соседние клетки (Манхэттен = 1)
        if (Math.abs(dCol) + Math.abs(dRow) === 1) {
          this._movePlayer(dCol, dRow);
        }
      }

      this._swipeStart = null;
    });
  }

  // ─── Движение игрока ─────────────────────────────────────────────────────────

  /**
   * Пытается переместить игрока на (dx, dy) клеток.
   * Проверяет наличие стены в соответствующем направлении.
   *
   * @param {number} dx  — смещение по горизонтали (-1, 0, 1)
   * @param {number} dy  — смещение по вертикали   (-1, 0, 1)
   */
  _movePlayer(dx, dy) {
    if (this._moving || this._gameOver) return;

    const nc = this._playerCol + dx;
    const nr = this._playerRow + dy;

    // Выход за границы
    if (nc < 0 || nc >= this._mazeW || nr < 0 || nr >= this._mazeH) return;

    // Определяем, какую стену проверять
    let wallBit = 0;
    if      (dx === -1) wallBit = MazeScene.WALL_W;
    else if (dx ===  1) wallBit = MazeScene.WALL_E;
    else if (dy === -1) wallBit = MazeScene.WALL_N;
    else if (dy ===  1) wallBit = MazeScene.WALL_S;

    // Если стена есть — движение запрещено
    if (this._walls[this._playerRow][this._playerCol] & wallBit) return;

    // Анимируем перемещение
    this._moving = true;

    const cs     = this._cellSize;
    const targetX = this._fieldX + nc * cs + cs / 2;
    const targetY = this._fieldY + nr * cs + cs / 2;

    // Плавное движение шарика и свечения
    this.tweens.add({
      targets:  [this._playerGfx, this._playerGlow],
      x:        targetX - (this._fieldX + this._playerCol * cs + cs / 2), // delta от текущего
      y:        targetY - (this._fieldY + this._playerRow * cs + cs / 2),
      duration: MazeScene.T_MOVE,
      ease:     'Quad.easeInOut',
      onComplete: () => {
        // После анимации обновляем позицию и перерисовываем
        this._playerCol = nc;
        this._playerRow = nr;

        // Сбрасываем смещение Graphics и рисуем в нужном месте
        this._playerGfx.x  = 0;
        this._playerGfx.y  = 0;
        this._playerGlow.x = 0;
        this._playerGlow.y = 0;
        this._redrawPlayer();

        this._steps++;
        this._markVisited(nc, nr);
        this._updateFog();
        this._updateMinimap();
        this._checkCollectible();
        this._updateHUD();
        this._moving = false;
        this._checkWin();
      },
    });
  }

  // ─── Проверка сбора светляка ─────────────────────────────────────────────────

  _checkCollectible() {
    for (let i = 0; i < this._fireflies.length; i++) {
      const ff = this._fireflies[i];
      if (!ff.collected && ff.col === this._playerCol && ff.row === this._playerRow) {
        ff.collected = true;
        this._collected++;

        // Анимация исчезновения светляка
        const obj = this._ffObjects[i];
        if (obj) {
          this.tweens.add({
            targets:  [obj.dot, obj.glow],
            alpha:    0,
            scaleX:   2,
            scaleY:   2,
            duration: MazeScene.T_COLLECT,
            ease:     'Quad.easeOut',
            onComplete: () => {
              obj.dot.destroy();
              obj.glow.destroy();
            },
          });
        }

        // Моргание орба компаньона
        this._blinkCompanionOrb();

        // Краткая реакция
        this._showReaction(`Светляк найден! (${this._collected}/${this._fireflies.length})`);
      }
    }
  }

  // ─── Победа ──────────────────────────────────────────────────────────────────

  _checkWin() {
    if (this._playerCol === this._exitCol && this._playerRow === this._exitRow) {
      this._endGame(true);
    }
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────

  _buildHUD(W) {
    const companion = COMPANIONS[this._companionId];

    // Фоновая полоса
    const hudBg = this.add.graphics().setDepth(10);
    hudBg.fillStyle(0x0A0618, 0.88);
    hudBg.fillRect(0, 0, W, 76);
    hudBg.lineStyle(1, companion.color, 0.15);
    hudBg.lineBetween(0, 76, W, 76);

    // Название игры
    this.add.text(W / 2, 14, 'Лабиринт', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(11);

    // Счёт (слева)
    this.add.text(16, 14, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0).setDepth(11);

    this._scoreTxt = this.add.text(16, 28, '1000', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0).setDepth(11);

    // Светляки (центр-лево)
    this.add.text(16, 52, 'Светляки:', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0).setDepth(11);

    this._ffTxt = this.add.text(92, 52, `0 / ${this._ffCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#' + COLORS.SVETLYA.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0).setDepth(11);

    // Шаги (центр)
    this._stepsTxt = this.add.text(W / 2, 52, 'Шагов: 0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0.5, 0).setDepth(11);

    // Таймер (справа)
    this.add.text(W - 16, 14, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0).setDepth(11);

    this._timerTxt = this.add.text(W - 16, 28, this._formatTime(this._timeLeft), {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0).setDepth(11);

    // Полоса таймера
    const barBg = this.add.graphics().setDepth(11);
    barBg.fillStyle(0x1A1030, 1);
    barBg.fillRoundedRect(W - 80, 52, 64, 10, 5);

    this._timerBar = this.add.graphics().setDepth(12);
    this._redrawTimerBar(W);
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _redrawTimerBar(W) {
    if (!this._timerBar) return;
    const companion = COMPANIONS[this._companionId];
    const ratio     = Math.max(0, this._timeLeft / this._maxTime);

    let color = companion.color;
    if (ratio < 0.3)      color = 0xFF4444;
    else if (ratio < 0.6) color = COLORS.BTN_PRIMARY;

    this._timerBar.clear();
    this._timerBar.fillStyle(color, 0.85);
    this._timerBar.fillRoundedRect(
      GAME_CONFIG.WIDTH - 80, 52,
      Math.max(2, Math.floor(64 * ratio)), 10, 5
    );
  }

  _updateHUD() {
    // Пересчитываем текущий счёт
    this._score = Math.max(100,
      1000 - this._steps * 2 + this._collected * 100
    );

    if (this._scoreTxt)  this._scoreTxt.setText(this._score.toString());
    if (this._ffTxt)     this._ffTxt.setText(`${this._collected} / ${this._ffCount}`);
    if (this._stepsTxt)  this._stepsTxt.setText(`Шагов: ${this._steps}`);

    // Анимация подпрыгивания счёта при сборе светляка
    if (this._scoreTxt && this._collected > 0) {
      this.tweens.add({
        targets:  this._scoreTxt,
        scaleX:   1.2, scaleY: 1.2,
        duration: 80,
        yoyo:     true,
        ease:     'Quad.easeOut',
      });
    }
  }

  // ─── Компаньон ──────────────────────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];
    const ORB_SIZE  = 50;
    const orbX      = W - 50;
    const orbY      = H - 80;

    // Свечение орба
    this._orbGlow = this.add.ellipse(orbX, orbY + 10, 66, 24, companion.color, 0.14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(14);

    // Орб компаньона (fallback: рисуем программно, если текстуры нет)
    try {
      this._orbSprite = this.add.image(orbX, orbY, `orb_${this._companionId}`)
        .setDisplaySize(ORB_SIZE, ORB_SIZE)
        .setDepth(15);
    } catch (e) {
      // Текстура не загружена — рисуем круг
      const orbGfx = this.add.graphics().setDepth(15);
      orbGfx.fillStyle(companion.color, 0.9);
      orbGfx.fillCircle(orbX, orbY, ORB_SIZE / 2);
      orbGfx.fillStyle(companion.colorLight || COLORS.WHITE, 0.3);
      orbGfx.fillCircle(orbX - 7, orbY - 7, 8);
      this._orbSprite = orbGfx;
    }

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
      alpha:    { from: 0.08, to: 0.25 },
      duration: 2200,
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
      wordWrap:   { width: GAME_CONFIG.WIDTH - ORB_SIZE - 40 },
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(16);
  }

  /** Моргание орба компаньона при нахождении светляка */
  _blinkCompanionOrb() {
    const companion = COMPANIONS[this._companionId];

    this.tweens.add({
      targets:   this._orbGlow,
      alpha:     0.85,
      duration:  MazeScene.T_BLINK / 2,
      yoyo:      true,
      ease:      'Quad.easeOut',
    });

    this.tweens.add({
      targets:  this._orbSprite,
      scaleX:   1.18,
      scaleY:   1.18,
      duration: MazeScene.T_BLINK / 2,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });
  }

  /** Показывает короткую реплику компаньона */
  _showReaction(text) {
    if (!this._reactionTxt) return;
    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1200,
      delay:    900,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Мини-карта ──────────────────────────────────────────────────────────────

  _buildMinimap(W) {
    // Размер мини-карты: 1px на клетку, но не более 60×80px
    const scale    = Math.min(1, Math.min(60 / this._mazeW, 80 / this._mazeH));
    this._mmScale  = Math.max(0.5, scale);
    this._mmX      = W - Math.ceil(this._mazeW * this._mmScale) - 8;
    this._mmY      = 84;  // ниже HUD

    this._minimapGfx = this.add.graphics().setDepth(13).setAlpha(0.82);
    this._drawMinimapBackground();
    this._updateMinimap();
  }

  _drawMinimapBackground() {
    if (!this._minimapGfx) return;
    const mmW = Math.ceil(this._mazeW * this._mmScale);
    const mmH = Math.ceil(this._mazeH * this._mmScale);

    this._minimapGfx.fillStyle(0x050310, 0.7);
    this._minimapGfx.fillRoundedRect(this._mmX - 3, this._mmY - 3, mmW + 6, mmH + 6, 4);
    this._minimapGfx.lineStyle(1, COMPANIONS[this._companionId].color, 0.2);
    this._minimapGfx.strokeRoundedRect(this._mmX - 3, this._mmY - 3, mmW + 6, mmH + 6, 4);
  }

  _updateMinimap() {
    if (!this._minimapGfx) return;
    const gfx       = this._minimapGfx;
    const sc        = this._mmScale;
    const mx        = this._mmX;
    const my        = this._mmY;
    const companion = COMPANIONS[this._companionId];

    // Перерисовываем только слои поверх фона (не стираем рамку)
    // Рисуем клетки
    for (let r = 0; r < this._mazeH; r++) {
      for (let c = 0; c < this._mazeW; c++) {
        const px = mx + Math.floor(c * sc);
        const py = my + Math.floor(r * sc);
        const pw = Math.max(1, Math.floor(sc));
        const ph = Math.max(1, Math.floor(sc));

        if (this._walls[r][c] === 15) {
          // Стена
          gfx.fillStyle(0x1A0B2E, 1);
        } else if (this._visited[r][c]) {
          // Посещённый проход
          gfx.fillStyle(0x2A1540, 1);
        } else {
          // Непосещённый — затемнён
          gfx.fillStyle(0x080415, 1);
        }
        gfx.fillRect(px, py, pw, ph);
      }
    }

    // Выход
    gfx.fillStyle(companion.color, 0.85);
    gfx.fillRect(
      mx + Math.floor(this._exitCol * sc),
      my + Math.floor(this._exitRow * sc),
      Math.max(1, Math.floor(sc)),
      Math.max(1, Math.floor(sc))
    );

    // Светляки
    for (const ff of this._fireflies) {
      if (!ff.collected) {
        gfx.fillStyle(COLORS.SVETLYA, 0.9);
        gfx.fillRect(
          mx + Math.floor(ff.col * sc),
          my + Math.floor(ff.row * sc),
          Math.max(1, Math.floor(sc)),
          Math.max(1, Math.floor(sc))
        );
      }
    }

    // Игрок
    gfx.fillStyle(companion.colorLight || COLORS.WHITE, 1);
    gfx.fillRect(
      mx + Math.floor(this._playerCol * sc),
      my + Math.floor(this._playerRow * sc),
      Math.max(1, Math.ceil(sc)),
      Math.max(1, Math.ceil(sc))
    );
  }

  // ─── Кнопка «Сдаться» ───────────────────────────────────────────────────────

  _buildSurrenderBtn(W, H) {
    const BW = 110;
    const BH = 34;
    const x  = 58;
    const y  = H - 80;

    const bg = this.add.graphics().setDepth(15);
    bg.fillStyle(0x2A1530, 0.8);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);
    bg.lineStyle(1, 0x4A2A5A, 0.5);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 17);

    const txt = this.add.text(0, 0, 'Сдаться', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#6A4A7A',
    }).setOrigin(0.5).setDepth(16);

    const container = this.add.container(x, y, [bg, txt]).setDepth(15);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(17);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._endGame(false);
    });
  }

  // ─── Фон ─────────────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const companion = COMPANIONS[this._companionId];

    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0D0820, 0x0D0820, 0x160A2A, 0x160A2A, 1);
    bg.fillRect(0, 0, W, H);

    // Слабый тинт компаньона
    const tint = this.add.graphics().setDepth(1);
    tint.fillStyle(companion.color, 0.03);
    tint.fillRect(0, 0, W, H);
  }

  // ─── Таймер ──────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;

    this._timeLeft--;

    if (this._timerTxt) {
      this._timerTxt.setText(this._formatTime(this._timeLeft));
    }
    this._redrawTimerBar(GAME_CONFIG.WIDTH);

    // Смена цвета таймера при критическом времени
    if (this._timerTxt) {
      if (this._timeLeft <= 10) {
        this._timerTxt.setColor('#FF4444');
      } else if (this._timeLeft <= Math.floor(this._maxTime * 0.2)) {
        this._timerTxt.setColor('#FF9B4E');
      }
    }

    if (this._timeLeft <= 0) {
      this._endGame(false);
    }
  }

  // ─── Завершение игры ─────────────────────────────────────────────────────────

  _endGame(completed) {
    if (this._gameOver) return;
    this._gameOver = true;
    this._moving   = true; // блокируем ввод

    if (this._timerEvent) this._timerEvent.remove();

    // Финальный счёт
    this._score = Math.max(100,
      1000 - this._steps * 2 + this._collected * 100
    );

    // Расчёт звёзд
    let stars = 0;
    if (completed) {
      const timeUsed  = this._maxTime - this._timeLeft;
      const threshold = this._maxTime * 0.5;  // 50% времени = 3★
      const tenPercent = this._maxTime * 0.9; // последние 10% = 1★

      if (timeUsed <= threshold && this._collected >= 3) {
        stars = 3;
      } else if (timeUsed <= tenPercent) {
        stars = 2;
      } else {
        stars = 1;
      }
    }
    // stars = 0 при поражении (время вышло или сдался)

    // Небольшая задержка перед оверлеем
    this.time.delayedCall(350, () => {
      this._showResultOverlay(stars, completed);
    });
  }

  _showResultOverlay(stars, completed) {
    const W         = GAME_CONFIG.WIDTH;
    const H         = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.65, duration: 300 });

    // Карточка результата
    const cardY = H / 2 - 90;
    const card  = this.add.graphics().setDepth(31);
    card.fillStyle(0x0D0820, 0.96);
    card.fillRoundedRect(W / 2 - 145, cardY, 290, 280, 20);
    card.lineStyle(1.5, companion.color, 0.5);
    card.strokeRoundedRect(W / 2 - 145, cardY, 290, 280, 20);

    // Заголовок
    const title = completed ? 'Выход найден!' : (this._timeLeft <= 0 ? 'Время вышло' : 'Сдался');
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
      fontSize:   '36px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 112, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Детали (шаги и светляки)
    this.add.text(W / 2, cardY + 140, `Шагов: ${this._steps}  |  Светляков: ${this._collected}/${this._ffCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реплика компаньона
    const reactionKey = completed ? (stars === 3 ? 'win' : 'idle') : 'lose';
    const reaction    = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 170, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: 250 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + 244, 'Продолжить', companion.color, stars, completed);

    // Частицы победы при хорошем результате
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

  /** Частицы победы (подобно Match3Scene) */
  _spawnWinParticles(W, H, color) {
    const gfx       = this.add.graphics().setDepth(29);
    const particles = [];

    for (let i = 0; i < 28; i++) {
      particles.push({
        x:    Phaser.Math.Between(30, W - 30),
        y:    Phaser.Math.Between(H * 0.25, H * 0.55),
        vy:   Phaser.Math.FloatBetween(-3.5, -1),
        vx:   Phaser.Math.FloatBetween(-1.8, 1.8),
        size: Phaser.Math.FloatBetween(3, 7),
        life: 1,
      });
    }

    let elapsed = 0;
    const updateFn = (time, delta) => {
      elapsed += delta;
      if (elapsed > 2200) {
        gfx.destroy();
        this.events.off('update', updateFn);
        return;
      }
      gfx.clear();
      for (const p of particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.06;
        p.life = Math.max(0, 1 - elapsed / 2200);
        gfx.fillStyle(color, p.life * 0.85);
        gfx.fillCircle(p.x, p.y, p.size * p.life);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Завершение и возврат в ChapterScene ────────────────────────────────────

  /**
   * Сохраняет результат через GameState и запускает ChapterScene.
   * Обязательный метод по контракту мини-игры.
   */
  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = {
      stars,
      score:     this._score,
      timeMs,
      completed,
    };

    // Сохраняем результат (если GameState доступен)
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
