/**
 * PlaceholderMiniGameScene.js — Заглушка мини-игр «Искра и Эхо»
 *
 * Временная сцена для тестирования полного флоу глав
 * пока реальные мини-игры не реализованы.
 *
 * Показывает:
 *  - Название мини-игры и компаньона
 *  - Анимированный прогресс-таймер (симуляция игрового процесса)
 *  - Кнопки «Победа (3★)», «Победа (1★)», «Поражение»
 *
 * Получает данные:
 *  { chapter, miniGameIndex, companionId, miniGameKey, sceneKey, difficulty }
 *
 * Возвращает в ChapterScene:
 *  { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 */

class PlaceholderMiniGameScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.PLACEHOLDER_MG });
  }

  // ─── Инициализация ────────────────────────────────────────────────────────

  init(data) {
    this._chapter       = data.chapter       || 1;
    this._mgIndex       = data.miniGameIndex || 0;
    this._companionId   = data.companionId   || GameState.get('firstCompanion') || 'svetlya';
    this._miniGameKey   = data.miniGameKey   || 'match3';
    this._difficulty    = data.difficulty    || 'easy';
    this._startTime     = Date.now();
  }

  // ─── Создание сцены ───────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    const companion = COMPANIONS[this._companionId];

    // ── Фон ──
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0D0820, 0x0D0820, 0x1A0F35, 0x1A0F35, 1);
    bg.fillRect(0, 0, W, H);

    // Цветной акцент сверху
    const topBar = this.add.graphics();
    topBar.fillStyle(companion.color, 0.15);
    topBar.fillRect(0, 0, W, 3);

    // Декоративная рамка
    const frame = this.add.graphics();
    frame.lineStyle(1, companion.color, 0.15);
    frame.strokeRoundedRect(20, 100, W - 40, H - 160, 20);

    // ── Бейдж «В разработке» ──
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(companion.colorDark || companion.color, 0.25);
    badgeBg.fillRoundedRect(W / 2 - 90, 54, 180, 28, 14);
    badgeBg.lineStyle(1, companion.color, 0.4);
    badgeBg.strokeRoundedRect(W / 2 - 90, 54, 180, 28, 14);

    this.add.text(W / 2, 68, '⚒ В разработке', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      companion.colorHex,
      align:      'center',
    }).setOrigin(0.5);

    // ── Название мини-игры ──
    const mgNames = {
      match3:        'Match-3',
      maze:          'Лабиринт',
      hidden_object: 'Найди предметы',
      crossword:     'Кроссворд',
      spot_diff:     'Найди отличия',
      memory_pairs:  'Пары памяти',
      sliding:       'Скользящий пазл',
      bubble:        'Пузырьковый шутер',
    };
    const mgIcons = {
      match3: '✦', maze: '◈', hidden_object: '◎', crossword: '▦',
      spot_diff: '◉', memory_pairs: '◈', sliding: '▣', bubble: '◌',
    };

    const mgName = mgNames[this._miniGameKey] || this._miniGameKey;
    const mgIcon = mgIcons[this._miniGameKey] || '✦';

    this.add.text(W / 2, 140, mgIcon, {
      fontFamily: 'Georgia, serif',
      fontSize:   '48px',
      color:      companion.colorHex,
      align:      'center',
      shadow:     { x: 0, y: 0, color: companion.colorHex, blur: 30, fill: true },
    }).setOrigin(0.5).setAlpha(0.8);

    this.add.text(W / 2, 208, mgName, {
      fontFamily: 'Georgia, serif',
      fontSize:   '26px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
      align:      'center',
      stroke:     '#1A0F2E',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // ── Мета-информация ──
    this.add.text(W / 2, 246, `Глава ${this._chapter}  ·  Мини-игра ${this._mgIndex + 1}  ·  ${this._difficulty}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#6A5A7A',
      align:      'center',
    }).setOrigin(0.5);

    // ── Компаньон ──
    const orbSize = 90;
    const orbX    = W / 2;
    const orbY    = H * 0.46;

    const orbGlow = this.add.ellipse(orbX, orbY + 15, 110, 40, companion.color, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);

    const orb = this.add.image(orbX, orbY, `orb_${this._companionId}`)
      .setDisplaySize(orbSize, orbSize);

    // Парение компаньона
    this.tweens.add({
      targets:  orb,
      y:        orbY - ANIM.FLOAT_AMPLITUDE,
      duration: ANIM.FLOAT_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Пульсация свечения
    this.tweens.add({
      targets:  orbGlow,
      alpha:    { from: 0.06, to: 0.18 },
      scaleX:   { from: 0.9, to: 1.15 },
      scaleY:   { from: 0.9, to: 1.15 },
      duration: 2000,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Реплика компаньона
    this.add.text(W / 2, H * 0.595, `«${COMPANIONS[this._companionId].reactions.idle}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      fontStyle:  'italic',
      color:      '#9E8A7A',
      align:      'center',
      wordWrap:   { width: W - 80 },
    }).setOrigin(0.5);

    // ── Разделитель ──
    const divider = this.add.graphics();
    divider.lineStyle(1, companion.color, 0.2);
    divider.lineBetween(60, H * 0.645, W - 60, H * 0.645);

    // ── Кнопки результата ──
    this._buildResultButtons(W, H, companion);

    // ── Fade-in ──
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Кнопки результата ───────────────────────────────────────────────────

  _buildResultButtons(W, H, companion) {
    const btnY1 = H * 0.720;
    const btnY2 = H * 0.800;
    const btnY3 = H * 0.878;

    // Пояснительный текст
    this.add.text(W / 2, btnY1 - 30, 'Выбери результат для теста:', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#5A4A6A',
      align:      'center',
    }).setOrigin(0.5);

    this._buildBtn(W / 2, btnY1, '★★★  Победа (отлично)',  companion.color,    () => this._finish(3, 2000, true));
    this._buildBtn(W / 2, btnY2, '★☆☆  Победа (слабо)',    COLORS.BTN_PRIMARY, () => this._finish(1, 600,  true));
    this._buildBtn(W / 2, btnY3, '☆☆☆  Поражение',         0x4A3A5A,           () => this._finish(0, 0,    false));
  }

  _buildBtn(x, y, label, color, callback) {
    const BW = 270;
    const BH = 44;

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.22);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 22);
    bg.lineStyle(1.5, color, 0.6);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 22);

    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#EEE8FF',
      align:      'center',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]).setDepth(10);

    const zone = this.add.zone(x, y, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);

    zone.on('pointerover',  () => this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 100 }));
    zone.on('pointerout',   () => this.tweens.add({ targets: container, scaleX: 1,    scaleY: 1,    duration: 100 }));
    zone.on('pointerdown',  () => this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: ANIM.BTN_PRESS }));
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      callback();
    });
  }

  // ─── Завершение и возврат в ChapterScene ─────────────────────────────────

  _finish(stars, score, completed) {
    const timeMs = Date.now() - this._startTime;

    const result = { stars, score, timeMs, completed };

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
