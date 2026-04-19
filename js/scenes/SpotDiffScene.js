/**
 * SpotDiffScene.js — Мини-игра «Найди отличия» для «Искра и Эхо»
 *
 * Механика: два программно нарисованных изображения рядом (ночное небо с орбами,
 * звёздами, геометрическими фигурами). Правое изображение содержит N отличий.
 * Tap по отличию → маркер на обоих изображениях. Промах → штраф.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 */

class SpotDiffScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.SPOT_DIFF });
  }

  // ─── Константы ─────────────────────────────────────────────────────────────

  // Размеры каждого изображения (два рядом на экране 390px)
  static get IMG_W()       { return 185; }
  static get IMG_H()       { return 310; }

  // Отступ сверху (под HUD)
  static get IMG_Y()       { return 90; }

  // Горизонтальные отступы (два изображения с зазором 4px по центру)
  static get IMG_LEFT_X()  { return 0; }
  static get IMG_RIGHT_X() { return 205; }

  // Радиус хит-зоны отличия (px)
  static get HIT_RADIUS()  { return 30; }

  // Радиус кружка-маркера (px)
  static get MARKER_R()    { return 22; }

  // Кол-во элементов в нарисованной сцене
  static get STAR_COUNT()  { return 40; }
  static get ORB_COUNT()   { return 6; }
  static get SHAPE_COUNT() { return 8; }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || (typeof GameState !== 'undefined'
                          ? GameState.get('firstCompanion') : null) || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    // Параметры сложности
    const DIFF = {
      easy:   { diffCount: 3, timeSec: 120 },
      normal: { diffCount: 5, timeSec: 90  },
      hard:   { diffCount: 7, timeSec: 60  },
    };
    const cfg = DIFF[this._difficulty] || DIFF.easy;

    this._diffCount  = cfg.diffCount;   // общее число отличий
    this._timeLeft   = cfg.timeSec;     // секунд на игру
    this._timeTotal  = cfg.timeSec;     // для расчёта звёзд

    this._score      = 0;
    this._misses     = 0;               // число промахов
    this._found      = 0;               // найдено отличий
    this._gameOver   = false;

    // Данные отличий: массив { x, y, type, params, foundAt }
    // x, y — координаты в пространстве изображения (0..IMG_W, 0..IMG_H)
    this._diffs      = [];

    // Флаг подсказки (мерцание)
    this._hintTimer       = null;
    this._hintActive      = false;
    this._hintTween       = null;
    this._lastFoundTime   = Date.now();

    // Данные «сцены» — генерируются один раз, используются при отрисовке обеих панелей
    this._sceneData  = null;
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    // ── Генерируем данные нарисованной сцены ──
    this._sceneData = this._generateSceneData();

    // ── Генерируем отличия ──
    this._diffs = this._generateDiffs(this._diffCount);

    // ── Фон ──
    this._drawBackground(W, H);

    // ── HUD (сверху) ──
    this._buildHUD(W);

    // ── Рисуем два изображения ──
    this._renderImages();

    // ── Интерактивные зоны ──
    this._setupClickZones();

    // ── Панель с компаньоном (снизу) ──
    this._buildCompanion(W, H);

    // ── Таймер ──
    this._timerEvent = this.time.addEvent({
      delay:         1000,
      callback:      this._onTick,
      callbackScope: this,
      loop:          true,
    });

    // ── Подсказка: запускаем счётчик ──
    this._hintTimer = this.time.addEvent({
      delay:         30000,
      callback:      this._activateHint,
      callbackScope: this,
      loop:          false,
    });

    // ── Fade-in ──
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Генерация данных сцены ─────────────────────────────────────────────────

  /**
   * Создаёт описание всех визуальных объектов сцены:
   * звёзды, орбы, геометрические фигуры.
   * Координаты — относительно пространства одного изображения.
   */
  _generateSceneData() {
    const W = SpotDiffScene.IMG_W;
    const H = SpotDiffScene.IMG_H;
    const rnd = (a, b) => Phaser.Math.Between(a, b);
    const frnd = (a, b) => Phaser.Math.FloatBetween(a, b);

    // Палитра орбов (индексируется по типу орба 0-5)
    const ORB_COLORS = [
      COLORS.SVETLYA,
      COLORS.DUH,
      COLORS.TEN,
      COLORS.BTN_PRIMARY,
      COLORS.ACCENT,
      COLORS.SVETLYA_LIGHT,
    ];

    // ── Звёзды ──
    const stars = [];
    for (let i = 0; i < SpotDiffScene.STAR_COUNT; i++) {
      stars.push({
        x:    rnd(4, W - 4),
        y:    rnd(4, H - 4),
        r:    frnd(0.8, 2.2),
        alpha: frnd(0.4, 1.0),
      });
    }

    // ── Орбы ──
    const orbs = [];
    for (let i = 0; i < SpotDiffScene.ORB_COUNT; i++) {
      orbs.push({
        x:          rnd(20, W - 20),
        y:          rnd(20, H - 20),
        r:          rnd(8, 22),
        colorIdx:   rnd(0, ORB_COLORS.length - 1),
        glowAlpha:  frnd(0.15, 0.4),
      });
    }

    // ── Геометрические фигуры ──
    // type: 'diamond' | 'circle' | 'cross'
    const SHAPE_TYPES = ['diamond', 'circle', 'cross'];
    const SHAPE_COLORS = [
      COLORS.SVETLYA, COLORS.DUH, COLORS.TEN,
      COLORS.DUH_LIGHT, COLORS.TEN_LIGHT, COLORS.SVETLYA_LIGHT,
      COLORS.ACCENT, COLORS.BTN_PRIMARY,
    ];

    const shapes = [];
    for (let i = 0; i < SpotDiffScene.SHAPE_COUNT; i++) {
      shapes.push({
        x:        rnd(14, W - 14),
        y:        rnd(14, H - 14),
        size:     rnd(7, 18),
        type:     SHAPE_TYPES[rnd(0, SHAPE_TYPES.length - 1)],
        colorIdx: rnd(0, SHAPE_COLORS.length - 1),
        alpha:    frnd(0.55, 0.9),
      });
    }

    return { stars, orbs, ORB_COLORS, shapes, SHAPE_COLORS };
  }

  // ─── Генерация отличий ──────────────────────────────────────────────────────

  /**
   * Возвращает массив отличий. Каждое отличие привязано к случайному орбу или
   * фигуре из sceneData. Типы: 'color' (смена цвета), 'size' (изменение размера),
   * 'missing' (объект отсутствует на правом изображении).
   */
  _generateDiffs(count) {
    const sd = this._sceneData;
    const W  = SpotDiffScene.IMG_W;
    const H  = SpotDiffScene.IMG_H;
    const diffs = [];

    // Пул кандидатов: орбы + фигуры (с запасом)
    const pool = [];

    for (let i = 0; i < sd.orbs.length; i++) {
      pool.push({ category: 'orb', index: i });
    }
    for (let i = 0; i < sd.shapes.length; i++) {
      pool.push({ category: 'shape', index: i });
    }

    // Перемешиваем пул
    Phaser.Utils.Array.Shuffle(pool);

    const DIFF_TYPES = ['color', 'size', 'missing'];

    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const candidate = pool[i];
      const diffType  = DIFF_TYPES[Phaser.Math.Between(0, DIFF_TYPES.length - 1)];

      let x, y, params;

      if (candidate.category === 'orb') {
        const orb = sd.orbs[candidate.index];
        x = orb.x;
        y = orb.y;

        if (diffType === 'color') {
          // Меняем на другой индекс цвета
          const newColorIdx = (orb.colorIdx + 1 + Phaser.Math.Between(0, sd.ORB_COLORS.length - 2)) % sd.ORB_COLORS.length;
          params = { orbIndex: candidate.index, prop: 'colorIdx', newValue: newColorIdx };
        } else if (diffType === 'size') {
          // Увеличиваем/уменьшаем радиус
          const newR = orb.r >= 18 ? orb.r - 8 : orb.r + 8;
          params = { orbIndex: candidate.index, prop: 'r', newValue: newR };
        } else {
          // missing — орб не рисуется на правом изображении
          params = { orbIndex: candidate.index, prop: 'missing', newValue: true };
        }

      } else {
        // category === 'shape'
        const shape = sd.shapes[candidate.index];
        x = shape.x;
        y = shape.y;

        if (diffType === 'color') {
          const newColorIdx = (shape.colorIdx + 1 + Phaser.Math.Between(0, sd.SHAPE_COLORS.length - 2)) % sd.SHAPE_COLORS.length;
          params = { shapeIndex: candidate.index, prop: 'colorIdx', newValue: newColorIdx };
        } else if (diffType === 'size') {
          const newSize = shape.size >= 15 ? shape.size - 7 : shape.size + 7;
          params = { shapeIndex: candidate.index, prop: 'size', newValue: newSize };
        } else {
          params = { shapeIndex: candidate.index, prop: 'missing', newValue: true };
        }
      }

      diffs.push({
        x,
        y,
        type:     diffType,
        category: candidate.category,
        params,
        found:    false,
        // Объект Graphics для мерцающего хинта (создаётся лениво)
        hintGfxLeft:  null,
        hintGfxRight: null,
      });
    }

    return diffs;
  }

  // ─── Отрисовка фона ─────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const companion = COMPANIONS[this._companionId];

    // Ночной градиент
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.BG_NIGHT, COLORS.BG_NIGHT, COLORS.BG_DAWN, COLORS.BG_DAWN, 1);
    bg.fillRect(0, 0, W, H);

    // Слабое свечение цвета компаньона
    const glow = this.add.graphics();
    glow.fillStyle(companion.color, 0.04);
    glow.fillRect(0, 0, W, H);

    // Разделитель между двумя изображениями (вертикальная полоса)
    const divider = this.add.graphics();
    divider.fillStyle(companion.color, 0.25);
    divider.fillRect(SpotDiffScene.IMG_W, SpotDiffScene.IMG_Y, 20, SpotDiffScene.IMG_H);
  }

  // ─── Отрисовка обоих изображений ────────────────────────────────────────────

  _renderImages() {
    const Y  = SpotDiffScene.IMG_Y;
    const LX = SpotDiffScene.IMG_LEFT_X;
    const RX = SpotDiffScene.IMG_RIGHT_X;
    const companion = COMPANIONS[this._companionId];

    // Рамки вокруг изображений
    const frames = this.add.graphics();
    frames.lineStyle(1.5, companion.color, 0.35);
    frames.strokeRect(LX, Y, SpotDiffScene.IMG_W, SpotDiffScene.IMG_H);
    frames.strokeRect(RX, Y, SpotDiffScene.IMG_W, SpotDiffScene.IMG_H);

    // Подписи «Левое» / «Правое»
    const labelStyle = {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    };
    this.add.text(LX + SpotDiffScene.IMG_W / 2, Y - 14, 'Оригинал', labelStyle).setOrigin(0.5, 1);
    this.add.text(RX + SpotDiffScene.IMG_W / 2, Y - 14, 'Найди отличия', labelStyle).setOrigin(0.5, 1);

    // Рисуем оба изображения через Graphics
    this._leftGfx  = this.add.graphics().setDepth(2);
    this._rightGfx = this.add.graphics().setDepth(2);

    this._buildScene(this._leftGfx,  LX, Y, false);
    this._buildScene(this._rightGfx, RX, Y, true);
  }

  /**
   * Рисует программную «ночную» сцену в заданной позиции.
   * @param {Phaser.GameObjects.Graphics} gfx — целевой Graphics объект
   * @param {number} ox — X-смещение (начало изображения)
   * @param {number} oy — Y-смещение (начало изображения)
   * @param {boolean} applyDiffs — применять ли отличия (для правого изображения)
   */
  _buildScene(gfx, ox, oy, applyDiffs) {
    const W  = SpotDiffScene.IMG_W;
    const H  = SpotDiffScene.IMG_H;
    const sd = this._sceneData;

    // Собираем карту изменений из _diffs (только для правого изображения)
    // diffMap: { 'orb_N': { prop, newValue }, 'shape_N': { prop, newValue } }
    const diffMap = {};
    if (applyDiffs) {
      for (const d of this._diffs) {
        if (d.category === 'orb') {
          diffMap[`orb_${d.params.orbIndex}`] = { prop: d.params.prop, newValue: d.params.newValue };
        } else {
          diffMap[`shape_${d.params.shapeIndex}`] = { prop: d.params.prop, newValue: d.params.newValue };
        }
      }
    }

    // ── Фон изображения (ночной градиент) ──
    gfx.fillGradientStyle(COLORS.BG_NIGHT, COLORS.BG_NIGHT, COLORS.BG_DAWN, COLORS.BG_DAWN, 1);
    gfx.fillRect(ox, oy, W, H);

    // ── Звёзды ──
    for (const s of sd.stars) {
      gfx.fillStyle(COLORS.WHITE, s.alpha * 0.85);
      gfx.fillCircle(ox + s.x, oy + s.y, s.r);
    }

    // ── Орбы ──
    for (let i = 0; i < sd.orbs.length; i++) {
      const key = `orb_${i}`;
      let orb = { ...sd.orbs[i] };

      if (diffMap[key]) {
        const delta = diffMap[key];
        if (delta.prop === 'missing') continue; // орб пропущен
        orb[delta.prop] = delta.newValue;
      }

      const color = sd.ORB_COLORS[orb.colorIdx];

      // Внешнее свечение
      gfx.fillStyle(color, orb.glowAlpha * 0.4);
      gfx.fillCircle(ox + orb.x, oy + orb.y, orb.r + 8);

      // Основной орб
      gfx.fillStyle(color, 0.75);
      gfx.fillCircle(ox + orb.x, oy + orb.y, orb.r);

      // Блик
      gfx.fillStyle(COLORS.WHITE, 0.3);
      gfx.fillCircle(ox + orb.x - orb.r * 0.3, oy + orb.y - orb.r * 0.3, orb.r * 0.35);
    }

    // ── Геометрические фигуры ──
    for (let i = 0; i < sd.shapes.length; i++) {
      const key = `shape_${i}`;
      let sh = { ...sd.shapes[i] };

      if (diffMap[key]) {
        const delta = diffMap[key];
        if (delta.prop === 'missing') continue; // фигура пропущена
        sh[delta.prop] = delta.newValue;
      }

      const color = sd.SHAPE_COLORS[sh.colorIdx];
      gfx.lineStyle(1.5, color, sh.alpha);
      gfx.fillStyle(color, sh.alpha * 0.35);

      const sx = ox + sh.x;
      const sy = oy + sh.y;
      const sz = sh.size;

      if (sh.type === 'diamond') {
        // Ромб
        gfx.beginPath();
        gfx.moveTo(sx,      sy - sz);
        gfx.lineTo(sx + sz, sy);
        gfx.lineTo(sx,      sy + sz);
        gfx.lineTo(sx - sz, sy);
        gfx.closePath();
        gfx.fillPath();
        gfx.strokePath();

      } else if (sh.type === 'circle') {
        // Окружность
        gfx.strokeCircle(sx, sy, sz);
        gfx.fillCircle(sx, sy, sz);

      } else {
        // Крест
        gfx.fillRect(sx - sz / 2, sy - sz * 0.15, sz, sz * 0.3);
        gfx.fillRect(sx - sz * 0.15, sy - sz / 2, sz * 0.3, sz);
        gfx.strokeRect(sx - sz / 2, sy - sz * 0.15, sz, sz * 0.3);
        gfx.strokeRect(sx - sz * 0.15, sy - sz / 2, sz * 0.3, sz);
      }
    }
  }

  // ─── Интерактивные зоны ─────────────────────────────────────────────────────

  /**
   * Создаёт два прозрачных интерактивных прямоугольника (одно per панель).
   * При нажатии определяем: попали ли в отличие или промах.
   */
  _setupClickZones() {
    const Y  = SpotDiffScene.IMG_Y;
    const LX = SpotDiffScene.IMG_LEFT_X;
    const RX = SpotDiffScene.IMG_RIGHT_X;
    const W  = SpotDiffScene.IMG_W;
    const H  = SpotDiffScene.IMG_H;

    // Зона левого изображения
    const zoneLeft = this.add.zone(LX + W / 2, Y + H / 2, W, H)
      .setInteractive()
      .setDepth(10);

    zoneLeft.on('pointerdown', (pointer) => {
      if (this._gameOver) return;
      // Координаты внутри изображения
      const imgX = pointer.x - LX;
      const imgY = pointer.y - Y;
      this._handleTap(imgX, imgY, pointer.x, pointer.y, 'left');
    });

    // Зона правого изображения
    const zoneRight = this.add.zone(RX + W / 2, Y + H / 2, W, H)
      .setInteractive()
      .setDepth(10);

    zoneRight.on('pointerdown', (pointer) => {
      if (this._gameOver) return;
      const imgX = pointer.x - RX;
      const imgY = pointer.y - Y;
      this._handleTap(imgX, imgY, pointer.x, pointer.y, 'right');
    });
  }

  /**
   * Обработчик tap на одной из панелей.
   * @param {number} imgX — X в пространстве изображения
   * @param {number} imgY — Y в пространстве изображения
   * @param {number} screenX — X на экране (для эффекта промаха)
   * @param {number} screenY — Y на экране
   * @param {string} side — 'left' | 'right'
   */
  _handleTap(imgX, imgY, screenX, screenY, side) {
    const R = SpotDiffScene.HIT_RADIUS;

    // Ищем ближайшее ненайденное отличие
    let hitIndex = -1;
    let minDist  = R + 1;

    for (let i = 0; i < this._diffs.length; i++) {
      if (this._diffs[i].found) continue;
      const d = this._diffs[i];
      const dist = Math.sqrt((imgX - d.x) ** 2 + (imgY - d.y) ** 2);
      if (dist <= R && dist < minDist) {
        minDist  = dist;
        hitIndex = i;
      }
    }

    if (hitIndex >= 0) {
      this._onHit(hitIndex);
    } else {
      this._onMiss(screenX, screenY);
    }
  }

  // ─── Попадание ──────────────────────────────────────────────────────────────

  _onHit(diffIndex) {
    const diff = this._diffs[diffIndex];
    diff.found = true;
    this._found++;
    this._lastFoundTime = Date.now();

    // Сбрасываем подсказку
    if (this._hintTween) {
      this._hintTween.stop();
      this._hintTween = null;
      this._hintActive = false;
    }

    // Перезапускаем таймер подсказки
    if (this._hintTimer) this._hintTimer.remove();
    this._hintTimer = this.time.addEvent({
      delay:         30000,
      callback:      this._activateHint,
      callbackScope: this,
      loop:          false,
    });

    // Очки
    const pts = 150;
    this._score += pts;
    this._updateHUD();

    // Маркеры на обоих изображениях
    this._placeMarker(
      SpotDiffScene.IMG_LEFT_X  + diff.x,
      SpotDiffScene.IMG_Y + diff.y
    );
    this._placeMarker(
      SpotDiffScene.IMG_RIGHT_X + diff.x,
      SpotDiffScene.IMG_Y + diff.y
    );

    // Реакция компаньона
    this._playCompanionReaction('win');

    // Проверяем победу
    if (this._found >= this._diffs.length) {
      this.time.delayedCall(600, () => this._endGame(true));
    }
  }

  /**
   * Создаёт анимированный кружок-маркер в точке (x, y) на экране.
   */
  _placeMarker(x, y) {
    const companion = COMPANIONS[this._companionId];
    const R = SpotDiffScene.MARKER_R;

    const gfx = this.add.graphics().setDepth(15);

    // Внешнее свечение
    gfx.fillStyle(companion.color, 0.2);
    gfx.fillCircle(x, y, R + 5);

    // Основной кружок
    gfx.lineStyle(2.5, companion.color, 0.9);
    gfx.strokeCircle(x, y, R);

    // Галочка внутри
    gfx.lineStyle(2, companion.color, 0.9);
    gfx.beginPath();
    gfx.moveTo(x - R * 0.4, y);
    gfx.lineTo(x - R * 0.1, y + R * 0.35);
    gfx.lineTo(x + R * 0.4, y - R * 0.3);
    gfx.strokePath();

    // Анимация появления (scale 0 → 1)
    gfx.setScale(0);
    this.tweens.add({
      targets:  gfx,
      scaleX:   1,
      scaleY:   1,
      duration: 220,
      ease:     'Back.easeOut',
    });

    // Пульсация
    this.tweens.add({
      targets:  gfx,
      alpha:    { from: 1, to: 0.6 },
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ─── Промах ─────────────────────────────────────────────────────────────────

  _onMiss(screenX, screenY) {
    this._misses++;
    this._score = Math.max(0, this._score - 50);
    this._updateHUD();

    // Красная вспышка в точке tap
    const flash = this.add.graphics().setDepth(20);
    flash.fillStyle(0xFF3344, 0.55);
    flash.fillCircle(screenX, screenY, 20);

    // Красный крест
    flash.lineStyle(2, 0xFF3344, 0.9);
    const cr = 10;
    flash.beginPath();
    flash.moveTo(screenX - cr, screenY - cr);
    flash.lineTo(screenX + cr, screenY + cr);
    flash.moveTo(screenX + cr, screenY - cr);
    flash.lineTo(screenX - cr, screenY + cr);
    flash.strokePath();

    this.tweens.add({
      targets:  flash,
      alpha:    0,
      duration: 450,
      ease:     'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Тряска камеры
    this.cameras.main.shake(180, 0.006);
  }

  // ─── Подсказка (мерцание) ───────────────────────────────────────────────────

  /**
   * Находит первое ненайденное отличие и создаёт мерцающий кружок рядом с ним
   * на обоих панелях. Мерцание длится 3 секунды.
   */
  _activateHint() {
    if (this._gameOver || this._hintActive) return;

    // Находим первое ненайденное отличие
    const unfound = this._diffs.filter(d => !d.found);
    if (unfound.length === 0) return;

    const diff = unfound[0];
    this._hintActive = true;

    // Создаём мерцающие кружки
    const makeHintGfx = (cx, cy) => {
      const companion = COMPANIONS[this._companionId];
      const g = this.add.graphics().setDepth(14).setAlpha(0);
      g.lineStyle(2, companion.colorLight || COLORS.SVETLYA_LIGHT, 0.8);
      g.strokeCircle(cx, cy, SpotDiffScene.MARKER_R + 4);

      const tw = this.tweens.add({
        targets:  g,
        alpha:    { from: 0, to: 0.75 },
        duration: 500,
        yoyo:     true,
        repeat:   5, // ~3 секунды
        ease:     'Sine.easeInOut',
        onComplete: () => {
          g.destroy();
          this._hintActive = false;
        },
      });
      return { g, tw };
    };

    const lx = SpotDiffScene.IMG_LEFT_X  + diff.x;
    const rx = SpotDiffScene.IMG_RIGHT_X + diff.x;
    const cy = SpotDiffScene.IMG_Y + diff.y;

    makeHintGfx(lx, cy);
    makeHintGfx(rx, cy);

    // Перезапустить таймер для следующей подсказки
    this._hintTimer = this.time.addEvent({
      delay:         35000,
      callback:      this._activateHint,
      callbackScope: this,
      loop:          false,
    });
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD(W) {
    const companion = COMPANIONS[this._companionId];

    // Фон HUD
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0A0618, 0.88);
    hudBg.fillRect(0, 0, W, 82);
    hudBg.lineStyle(1, companion.color, 0.15);
    hudBg.lineBetween(0, 82, W, 82);

    // Название игры
    this.add.text(W / 2, 10, 'Найди отличия', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0);

    // Счёт (слева)
    this.add.text(14, 10, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);

    this._scoreTxt = this.add.text(14, 24, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#' + COLORS.SVETLYA.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Прогресс: найдено / всего (по центру снизу HUD)
    this._progressTxt = this.add.text(W / 2, 48, `0 / ${this._diffCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 35, 'Найдено', {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      color:      '#6A5A7A',
    }).setOrigin(0.5, 0);

    // Таймер (справа)
    this.add.text(W - 14, 10, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0);

    this._timerTxt = this.add.text(W - 14, 24, this._formatTime(this._timeLeft), {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0);

    // Полоса таймера (справа снизу)
    this._timerBarBg = this.add.graphics();
    this._timerBarBg.fillStyle(0x1A1030, 1);
    this._timerBarBg.fillRoundedRect(W - 78, 52, 64, 8, 4);

    this._timerBar = this.add.graphics();
    this._drawTimerBar(W);
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _drawTimerBar(W) {
    const companion = COMPANIONS[this._companionId];
    const ratio     = Math.max(0, this._timeLeft / this._timeTotal);

    let barColor = companion.color;
    if (ratio < 0.3)      barColor = 0xFF4444;
    else if (ratio < 0.6) barColor = COLORS.BTN_PRIMARY;

    this._timerBar.clear();
    this._timerBar.fillStyle(barColor, 0.8);
    this._timerBar.fillRoundedRect(W - 78, 52, Math.floor(64 * ratio), 8, 4);
  }

  _updateHUD() {
    this._scoreTxt.setText(this._score.toString());
    this._progressTxt.setText(`${this._found} / ${this._diffCount}`);

    // Анимация прыжка счёта
    this.tweens.add({
      targets:  this._scoreTxt,
      scaleX:   1.2, scaleY: 1.2,
      duration: 80,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Таймер ─────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;

    this._timeLeft--;
    this._timerTxt.setText(this._formatTime(this._timeLeft));
    this._drawTimerBar(GAME_CONFIG.WIDTH);

    if (this._timeLeft <= 10) {
      this._timerTxt.setColor('#FF4444');
    } else if (this._timeLeft <= 20) {
      this._timerTxt.setColor('#FF9B4E');
    }

    if (this._timeLeft <= 0) {
      this._endGame(false);
    }
  }

  // ─── Компаньон (нижняя панель) ──────────────────────────────────────────────

  _buildCompanion(W, H) {
    const companion = COMPANIONS[this._companionId];

    // Фон нижней панели
    const panelBg = this.add.graphics().setDepth(3);
    panelBg.fillStyle(0x0A0618, 0.82);
    panelBg.fillRect(0, SpotDiffScene.IMG_Y + SpotDiffScene.IMG_H + 8, W, 80);
    panelBg.lineStyle(1, companion.color, 0.12);
    panelBg.lineBetween(0, SpotDiffScene.IMG_Y + SpotDiffScene.IMG_H + 8, W,
                        SpotDiffScene.IMG_Y + SpotDiffScene.IMG_H + 8);

    const orbY = SpotDiffScene.IMG_Y + SpotDiffScene.IMG_H + 48;
    const orbX = 40;

    // Свечение орба
    this._orbGlow = this.add.ellipse(orbX, orbY + 10, 60, 20, companion.color, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);

    // Орб компаньона (текстура из PreloadScene или нарисованный кружок-заглушка)
    const orbKey = `orb_${this._companionId}`;
    if (this.textures.exists(orbKey)) {
      this._orbSprite = this.add.image(orbX, orbY, orbKey)
        .setDisplaySize(50, 50)
        .setDepth(5);
    } else {
      // Нарисованный запасной орб
      const orbGfx = this.add.graphics().setDepth(5);
      orbGfx.fillStyle(companion.color, 0.8);
      orbGfx.fillCircle(orbX, orbY, 22);
      orbGfx.fillStyle(COLORS.WHITE, 0.25);
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
      duration: 2000,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Текст реакции (рядом с орбом)
    this._reactionTxt = this.add.text(
      orbX + 36, orbY,
      companion.reactions.idle || '...', {
        fontFamily: 'Georgia, serif',
        fontSize:   '11px',
        fontStyle:  'italic',
        color:      '#' + companion.color.toString(16).padStart(6, '0'),
        wordWrap:   { width: W - orbX - 50 },
      }
    ).setOrigin(0, 0.5).setAlpha(0.55).setDepth(6);
  }

  _playCompanionReaction(type) {
    const companion = COMPANIONS[this._companionId];
    const text = companion.reactions[type] || companion.reactions.idle || '...';

    // Подпрыгивание
    this.tweens.add({
      targets:  this._orbSprite,
      y:        this._orbSprite.y - 16,
      duration: 180,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });

    this._reactionTxt.setText(text).setAlpha(1);

    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0.3,
      duration: 1800,
      delay:    900,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Конец игры ─────────────────────────────────────────────────────────────

  _endGame(completed) {
    if (this._gameOver) return;
    this._gameOver = true;

    if (this._timerEvent) this._timerEvent.remove();
    if (this._hintTimer)  this._hintTimer.remove();

    // Итоговый счёт: базовый + бонус за время
    const baseScore = 1000 + this._found * 150 - this._misses * 50;
    this._score = Math.max(0, baseScore);

    // Звёзды
    let stars = 0;
    const allFound  = this._found >= this._diffs.length;
    const halfFound = this._found >= Math.ceil(this._diffs.length / 2);
    const timeRatio = this._timeLeft / this._timeTotal;

    if (completed && allFound && this._misses === 0 && timeRatio >= 0.5) {
      stars = 3;
    } else if (completed && allFound) {
      stars = 2;
    } else if (halfFound) {
      stars = 1;
    }

    this.time.delayedCall(400, () => {
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

    // Карточка
    const cardY = H / 2 - 130;
    const card  = this.add.graphics().setDepth(31);
    card.fillStyle(0x0D0820, 0.96);
    card.fillRoundedRect(W / 2 - 145, cardY, 290, 280, 20);
    card.lineStyle(1.5, companion.color, 0.5);
    card.strokeRoundedRect(W / 2 - 145, cardY, 290, 280, 20);

    // Заголовок
    const titleText = completed ? 'Все отличия найдены!' : 'Время вышло';
    this.add.text(W / 2, cardY + 26, titleText, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#AA7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 60, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '34px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 108, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Статистика
    this.add.text(W / 2, cardY + 136,
      `Найдено: ${this._found} / ${this._diffCount}   Промахи: ${this._misses}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Реплика компаньона
    const reactionKey = completed ? (stars >= 2 ? 'win' : 'idle') : 'lose';
    const reaction = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 166, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: 250 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + 248, 'Продолжить', companion.color, stars, completed);

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
      this.tweens.add({
        targets:  container,
        scaleX:   0.97, scaleY: 0.97,
        duration: ANIM.BTN_PRESS,
      });
    });
    zone.on('pointerup', () => {
      this.tweens.add({
        targets:  container,
        scaleX:   1, scaleY: 1,
        duration: ANIM.BTN_PRESS,
      });
      this._finishGame(stars, completed);
    });
  }

  // ─── Частицы победы ─────────────────────────────────────────────────────────

  _spawnWinParticles(W, H, color) {
    const graphics = this.add.graphics().setDepth(29);
    const particles = [];

    for (let i = 0; i < 30; i++) {
      particles.push({
        x:    Phaser.Math.Between(30, W - 30),
        y:    Phaser.Math.Between(H * 0.15, H * 0.55),
        vx:   Phaser.Math.FloatBetween(-1.8, 1.8),
        vy:   Phaser.Math.FloatBetween(-3.2, -0.8),
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

  // ─── Завершение и возврат в ChapterScene ────────────────────────────────────

  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = {
      stars,
      score:     this._score,
      timeMs,
      completed: !!completed,
    };

    // Сохраняем результат через GameState если он доступен
    if (typeof GameState !== 'undefined') {
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
