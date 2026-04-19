/**
 * MainMenuScene.js — Главное меню «Искра и Эхо»
 *
 * Показывает:
 *  - Анимированный ночной фон со звёздами
 *  - Три парящих шара (Светля, Дух, Тень) на заднем плане
 *  - Логотип игры с пульсирующим свечением
 *  - Кнопку «Начать» (первый визит) или «Продолжить» (есть сохранение)
 */

class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.MAIN_MENU });
  }

  // ─── Phaser lifecycle ───────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    this._createBackground(W, H);
    this._createAmbientOrbs(W, H);
    this._createStarParticles(W, H);
    this._createLogo(W, H);
    this._createButtons(W, H);
    this._createShopEntry(W, H);
    this._createVersionBadge(W, H);

    // Появление всего экрана
    this.cameras.main.fadeIn(ANIM.FADE_IN, 26, 15, 46);
  }

  // ─── Фон ────────────────────────────────────────────────────────────────────

  _createBackground(W, H) {
    this.add.image(W / 2, H / 2, 'bg_night').setDisplaySize(W, H);
  }

  // ─── Фоновые шары компаньонов (украшение) ───────────────────────────────────

  _createAmbientOrbs(W, H) {
    const orbs = [
      { key: 'orb_svetlya', x: W * 0.18, y: H * 0.30, scale: 0.55, alpha: 0.25 },
      { key: 'orb_duh',     x: W * 0.82, y: H * 0.22, scale: 0.45, alpha: 0.20 },
      { key: 'orb_ten',     x: W * 0.72, y: H * 0.72, scale: 0.40, alpha: 0.15 },
    ];

    orbs.forEach(({ key, x, y, scale, alpha }) => {
      const orb = this.add.image(x, y, key)
        .setScale(scale)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD);

      this._addFloat(orb, Phaser.Math.Between(2000, 3200));
    });
  }

  // ─── Частицы-звёзды ─────────────────────────────────────────────────────────

  _createStarParticles(W, H) {
    // Статичные мерцающие звёзды
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H * 0.65);
      const r = Phaser.Math.FloatBetween(0.8, 2.2);
      const a = Phaser.Math.FloatBetween(0.25, 0.9);

      const star = this.add.circle(x, y, r, COLORS.STAR, a);

      // Случайное мерцание
      this.tweens.add({
        targets:  star,
        alpha:    { from: a * 0.2, to: a },
        duration: Phaser.Math.Between(1200, 3500),
        yoyo:     true,
        repeat:   -1,
        delay:    Phaser.Math.Between(0, 2000),
        ease:     'Sine.easeInOut',
      });
    }
  }

  // ─── Логотип ─────────────────────────────────────────────────────────────────

  _createLogo(W, H) {
    // Свечение под логотипом
    const glow = this.add.ellipse(W / 2, H * 0.38, 340, 120, COLORS.SVETLYA, 0.06)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets:  glow,
      scaleX:   { from: 0.9, to: 1.1 },
      scaleY:   { from: 0.9, to: 1.1 },
      alpha:    { from: 0.04, to: 0.10 },
      duration: 2200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Основной заголовок
    this.add.text(W / 2, H * 0.36, 'Искра и Эхо', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize:   '38px',
      fontStyle:  'italic',
      color:      '#FFD166',
      align:      'center',
      stroke:     '#1A0F2E',
      strokeThickness: 5,
      shadow: { x: 0, y: 3, color: '#000000', blur: 18, fill: true },
    }).setOrigin(0.5);

    // Подзаголовок
    this.add.text(W / 2, H * 0.36 + 52, '— Найди их снова —', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#A8C5DA',
      align:      'center',
      letterSpacing: 2,
    }).setOrigin(0.5);
  }

  // ─── Кнопки ──────────────────────────────────────────────────────────────────

  _createButtons(W, H) {
    const isFirst = GameState.isFirstVisit();

    if (isFirst) {
      // Первый запуск — одна кнопка
      this._makeButton(W / 2, H * 0.70, 'Начать', () => {
        this._goToCompanionSelect();
      });
    } else {
      // Есть сохранение — «Продолжить» + «Заново»
      this._makeButton(W / 2, H * 0.67, 'Продолжить', () => {
        this._continueGame();
      });

      this._makeTextButton(W / 2, H * 0.67 + 76, 'Начать заново', () => {
        this._confirmNewGame();
      });
    }
  }

  /**
   * Большая кнопка с градиентным фоном и нажатием.
   * Hit-area: минимум 280×60 px (удобно для пальца).
   */
  _makeButton(x, y, label, callback) {
    const BW = 280, BH = 60;

    // Подложка (градиент через текстуру)
    const btn = this.add.image(x, y, 'btn_primary')
      .setDisplaySize(BW, BH)
      .setInteractive({ useHandCursor: true });

    // Метка
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      color:      '#FFFFFF',
      fontStyle:  'bold',
      shadow:     { x: 0, y: 2, color: '#00000066', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(1);

    // Вход / анимация появления
    btn.setScale(0.85).setAlpha(0);
    txt.setScale(0.85).setAlpha(0);
    this.tweens.add({
      targets:  [btn, txt],
      scale:    1,
      alpha:    1,
      duration: 500,
      ease:     'Back.easeOut',
      delay:    300,
    });

    // Hover
    btn.on('pointerover',  () => this.tweens.add({ targets: [btn, txt], scaleX: 1.04, scaleY: 1.04, duration: 120, ease: 'Quad.easeOut' }));
    btn.on('pointerout',   () => this.tweens.add({ targets: [btn, txt], scaleX: 1.00, scaleY: 1.00, duration: 120, ease: 'Quad.easeOut' }));

    // Нажатие
    btn.on('pointerdown',  () => this.tweens.add({ targets: [btn, txt], scaleX: 0.96, scaleY: 0.96, duration: ANIM.BTN_PRESS, ease: 'Quad.easeIn' }));
    btn.on('pointerup', () => {
      this.tweens.add({ targets: [btn, txt], scaleX: 1.00, scaleY: 1.00, duration: ANIM.BTN_PRESS });
      callback();
    });
  }

  /** Текстовая кнопка-ссылка (для вторичных действий) */
  _makeTextButton(x, y, label, callback) {
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#9E8A7A',
      align:      'center',
    }).setOrigin(0.5).setAlpha(0)
      .setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: txt, alpha: 1, duration: 400, delay: 500 });

    txt.on('pointerover',  () => txt.setColor('#E8956D'));
    txt.on('pointerout',   () => txt.setColor('#9E8A7A'));
    txt.on('pointerup',    () => callback());
  }

  /** Уютная лавка — из главного меню */
  _createShopEntry(W, H) {
    const link = this.add.text(W - 16, 20, 'Лавка', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#E8956D',
    }).setOrigin(1, 0).setAlpha(0).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: link, alpha: 1, duration: 500, delay: 400 });

    link.on('pointerover', () => link.setColor('#FFD166'));
    link.on('pointerout',  () => link.setColor('#E8956D'));
    link.on('pointerup', () => {
      this.cameras.main.fadeOut(ANIM.FADE_OUT, 26, 15, 46);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(GAME_CONFIG.SCENES.SHOP);
      });
    });
  }

  // ─── Бейдж версии ────────────────────────────────────────────────────────────

  _createVersionBadge(W, H) {
    this.add.text(W - 12, H - 12, 'Этап 6', {
      fontFamily: 'monospace',
      fontSize:   '11px',
      color:      '#3D2B1F',
      alpha:      0.35,
    }).setOrigin(1, 1).setAlpha(0.35);
  }

  // ─── Навигация ───────────────────────────────────────────────────────────────

  _goToCompanionSelect() {
    this.cameras.main.fadeOut(ANIM.FADE_OUT, 26, 15, 46);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(GAME_CONFIG.SCENES.COMPANION_SELECT);
    });
  }

  _continueGame() {
    // TODO Этап 7: переход в ChapterScene с текущей главой
    const chapter = GameState.get('story.currentChapter');
    console.log('[MainMenu] Продолжаем с главы', chapter);
    // Пока — тот же экран выбора если компаньон не выбран
    this._goToCompanionSelect();
  }

  _confirmNewGame() {
    // Простое подтверждение через console — замените на диалог в Этапе 7
    if (window.confirm('Начать новую игру? Весь прогресс будет удалён.')) {
      SaveManager.deleteSave();
      GameState.load();
      this._goToCompanionSelect();
    }
  }

  // ─── Утилита парения ─────────────────────────────────────────────────────────

  _addFloat(target, duration) {
    this.tweens.add({
      targets:    target,
      y:          `+=${ANIM.FLOAT_AMPLITUDE}`,
      duration:   duration,
      yoyo:       true,
      repeat:     -1,
      ease:       'Sine.easeInOut',
    });
  }
}
