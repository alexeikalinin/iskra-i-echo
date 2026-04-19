/**
 * CompanionSelectScene.js — Выбор первого компаньона «Искра и Эхо»
 *
 * Дизайн: «Spotlight» — один компаньон в центре экрана.
 * Две кнопки-таба внизу переключают между Светлей и Духом.
 * После выбора появляется CTA «Начать путешествие».
 *
 * Поток:
 *  1. Fade-in фона
 *  2. Появление заголовка сверху
 *  3. Появление шара компаньона (scale + fade)
 *  4. Появление текстового блока и табов
 *  5. Клик по табу → анимация смены (scale out → swap → scale in)
 *  6. Клик «Выбрать» → выделение, появление CTA
 *  7. Клик «Начать путешествие» → сохранение + переход
 */

class CompanionSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.COMPANION_SELECT });
  }

  // ─── Состояние сцены ────────────────────────────────────────────────────────

  init() {
    this._activeId   = 'svetlya';   // текущий отображаемый компаньон
    this._selectedId = null;        // подтверждённый выбор (после клика «Выбрать»)
    this._switching  = false;       // блокировка во время анимации смены
  }

  // ─── Phaser lifecycle ───────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    this._W = W;
    this._H = H;

    this._buildBackground(W, H);
    this._buildTitle(W, H);
    this._buildCompanionZone(W, H);
    this._buildInfoZone(W, H);
    this._buildTabs(W, H);
    this._buildCtaButton(W, H);
    this._buildBackButton(W, H);

    // Начальное заполнение данными Светли
    this._fillCompanionData('svetlya', false);

    // Анимация появления всей сцены
    this.cameras.main.fadeIn(ANIM.FADE_IN, 26, 15, 46);
  }

  // ─── Фон ─────────────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    this.add.image(W / 2, H / 2, 'bg_night').setDisplaySize(W, H);

    // Мягкое свечение в центре под шаром
    this._bgGlow = this.add.ellipse(W / 2, H * 0.36, 300, 300, COLORS.SVETLYA, 0.06)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets:  this._bgGlow,
      alpha:    { from: 0.04, to: 0.10 },
      scaleX:   { from: 0.9, to: 1.1 },
      scaleY:   { from: 0.9, to: 1.1 },
      duration: 2400,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ─── Заголовок ────────────────────────────────────────────────────────────────

  _buildTitle(W, H) {
    this._titleText = this.add.text(W / 2, H * 0.055, 'Кого ты встретил первым?', {
      fontFamily: 'Georgia, serif',
      fontSize:   '18px',
      color:      '#A8C5DA',
      align:      'center',
      stroke:     '#1A0F2E',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: this._titleText, alpha: 1, y: H * 0.07, duration: 500, ease: 'Quad.easeOut', delay: 100 });
  }

  // ─── Зона шара-компаньона ────────────────────────────────────────────────────

  _buildCompanionZone(W, H) {
    const orbY = H * 0.30;

    // Кольцо выбора (скрыто, появляется при подтверждении)
    this._selectionRing = this.add.circle(W / 2, orbY, 105, 0x000000, 0)
      .setStrokeStyle(3, COLORS.SVETLYA, 0)
      .setDepth(2);

    // Шар компаньона
    this._orb = this.add.image(W / 2, orbY, 'orb_svetlya')
      .setScale(0.9).setAlpha(0).setDepth(1);

    // Анимация появления шара
    this.tweens.add({
      targets:  this._orb,
      alpha:    1,
      scale:    1,
      duration: 600,
      ease:     'Back.easeOut',
      delay:    200,
    });

    // Постоянное парение
    this._floatTween = this._addFloat(this._orb);

    // Частицы искр (только для Светли, переключаются при смене)
    this._sparks = this._createSparks(W / 2, orbY);

    this._orbY = orbY;
  }

  _createSparks(x, y) {
    // Phaser 3.60+ имеет новый Particles API
    // Универсальный метод, совместимый с версиями 3.55–3.60+
    try {
      const emitter = this.add.particles(x, y, 'particle_spark', {
        speed:      { min: 20, max: 60 },
        angle:      { min: 0, max: 360 },
        scale:      { start: 0.6, end: 0 },
        alpha:      { start: 0.9, end: 0 },
        lifespan:   { min: 600, max: 1200 },
        frequency:  220,
        quantity:   1,
        blendMode:  'ADD',
      }).setDepth(3);
      return emitter;
    } catch (e) {
      console.warn('[CompanionSelect] Particles не поддерживаются:', e);
      return null;
    }
  }

  // ─── Информационный блок ─────────────────────────────────────────────────────

  _buildInfoZone(W, H) {
    const infoY = H * 0.505;

    // Имя
    this._nameText = this.add.text(W / 2, infoY, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '30px',
      fontStyle:  'bold italic',
      color:      '#FFD166',
      align:      'center',
      stroke:     '#1A0F2E',
      strokeThickness: 4,
      shadow:     { x: 0, y: 2, color: '#000', blur: 10, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    // Эссенция (свет · энергия · надежда)
    this._essenceText = this.add.text(W / 2, infoY + 42, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#A8C5DA',
      align:      'center',
      letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0);

    // Описание (origin сверху — многострочный текст не наезжает на эссенцию)
    this._descText = this.add.text(W / 2, infoY + 58, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#FFF8EE',
      align:      'center',
      wordWrap:   { width: W - 60 },
      lineSpacing: 5,
    }).setOrigin(0.5, 0).setAlpha(0);

    // Цитата (вертикальная позиция задаётся в _layoutQuoteBlock после текста описания)
    this._quoteText = this.add.text(W / 2, infoY + 200, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      fontStyle:  'italic',
      color:      '#9E8A7A',
      align:      'center',
      wordWrap:   { width: W - 80 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setAlpha(0);

    // Черта-разделитель над цитатой (координаты — в _layoutQuoteBlock)
    this._divider = this.add.graphics().setAlpha(0);

    this._infoObjects = [this._nameText, this._essenceText, this._descText, this._quoteText, this._divider];

    // Появление блока с задержкой
    this.tweens.add({
      targets:  this._infoObjects,
      alpha:    1,
      duration: 500,
      delay:    450,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Табы переключения ────────────────────────────────────────────────────────

  _buildTabs(W, H) {
    const tabY  = H * 0.845;
    const tabW  = 145;
    const tabH  = 50;
    const gap   = 14;

    this._tabs = {};

    GAME_CONFIG.INITIAL_COMPANIONS.forEach((id, i) => {
      const data = COMPANIONS[id];
      const x    = W / 2 + (i === 0 ? -(tabW / 2 + gap / 2) : tabW / 2 + gap / 2);

      // Фоновый прямоугольник таба
      const bg = this.add.graphics().setAlpha(0);
      this._drawTabBg(bg, x - tabW / 2, tabY - tabH / 2, tabW, tabH,
        i === 0 ? COLORS.SVETLYA : COLORS.DUH, i === 0);

      // Текст
      const txt = this.add.text(x, tabY, data.name, {
        fontFamily: 'Georgia, serif',
        fontSize:   '17px',
        fontStyle:  'bold',
        color:      i === 0 ? '#3D2B1F' : '#9E8A7A',
        align:      'center',
      }).setOrigin(0.5).setAlpha(0);

      // Хит-зона (поверх графики)
      const hit = this.add.zone(x, tabY, tabW, tabH)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerup', () => this._onTabClick(id));

      this._tabs[id] = { bg, txt, x, y: tabY, w: tabW, h: tabH };

      // Появление
      this.tweens.add({
        targets:  [bg, txt],
        alpha:    1,
        duration: 400,
        delay:    600 + i * 80,
        ease:     'Quad.easeOut',
      });
    });
  }

  _drawTabBg(g, x, y, w, h, color, active) {
    g.clear();
    if (active) {
      g.fillStyle(color, 0.20);
      g.fillRoundedRect(x, y, w, h, 14);
      g.lineStyle(2, color, 0.70);
      g.strokeRoundedRect(x, y, w, h, 14);
    } else {
      g.lineStyle(1, COLORS.DUH, 0.20);
      g.strokeRoundedRect(x, y, w, h, 14);
    }
  }

  // ─── Кнопка «Выбрать» / CTA ──────────────────────────────────────────────────

  _buildCtaButton(W, H) {
    const btnY = H * 0.927;

    // Кнопка «Выбрать этого» (промежуточная)
    this._btnChoose = this._buildButton(W / 2, btnY, 'Выбрать этого', COLORS.SVETLYA,
      () => this._onChooseClick());

    // Кнопка «Начать путешествие» (финальная, скрыта до выбора)
    this._btnStart = this._buildButton(W / 2, btnY, 'Начать путешествие ✦', COLORS.BTN_PRIMARY,
      () => this._onStartClick());
    this._btnStart.container.setAlpha(0).setScale(0.85);
    // Вторая зона совпадает по координатам с «Выбрать этого» и иначе перехватывает все клики,
    // пока CTA скрыт (_onStartClick выходит по !this._selectedId — кажется, что кнопка мёртвая).
    this._btnStart.zone.disableInteractive();

    this._ctaY = btnY;
  }

  /**
   * Универсальный строитель кнопки.
   * Возвращает объект { container, bg, txt } для управления анимациями.
   */
  _buildButton(x, y, label, color, callback) {
    const BW = 290, BH = 52;

    // Фон кнопки
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.90);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 26);
    bg.lineStyle(2, COLORS.WHITE, 0.15);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 26);

    // Внутреннее свечение
    const shine = this.add.graphics();
    shine.fillStyle(COLORS.WHITE, 0.12);
    shine.fillRoundedRect(-BW / 2 + 4, -BH / 2 + 4, BW - 8, BH / 2 - 4, 22);

    const txt = this.add.text(0, 1, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '17px',
      fontStyle:  'bold',
      color:      '#FFFFFF',
      align:      'center',
      shadow:     { x: 0, y: 2, color: '#00000055', blur: 6, fill: true },
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, shine, txt]).setAlpha(0);

    // Хит-зона
    const zone = this.add.zone(x, y, BW, BH).setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 110 }));
    zone.on('pointerout',   () => this.tweens.add({ targets: container, scaleX: 1.00, scaleY: 1.00, duration: 110 }));
    zone.on('pointerdown',  () => this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: ANIM.BTN_PRESS }));
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1.00, scaleY: 1.00, duration: ANIM.BTN_PRESS });
      callback();
    });

    // Появление кнопки «Выбрать»
    if (label.startsWith('Выбрать')) {
      this.tweens.add({ targets: container, alpha: 1, duration: 400, delay: 700, ease: 'Quad.easeOut' });
    }

    return { container, bg, txt, zone };
  }

  // ─── Кнопка «Назад» ──────────────────────────────────────────────────────────

  _buildBackButton(W, H) {
    const btn = this.add.text(30, 30, '← Назад', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#9E8A7A',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#A8C5DA'));
    btn.on('pointerout',  () => btn.setColor('#9E8A7A'));
    btn.on('pointerup',   () => {
      this.cameras.main.fadeOut(ANIM.FADE_OUT, 26, 15, 46);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
      });
    });
  }

  // ─── Заполнение данными компаньона ───────────────────────────────────────────

  _fillCompanionData(id, animate) {
    const data = COMPANIONS[id];

    if (animate) {
      // Плавная смена текстов
      this.tweens.add({
        targets:  this._infoObjects,
        alpha:    0,
        duration: ANIM.COMPANION_SWITCH,
        ease:     'Quad.easeIn',
        onComplete: () => {
          this._applyCompanionTexts(data);
          this.tweens.add({
            targets:  this._infoObjects,
            alpha:    1,
            duration: ANIM.COMPANION_SWITCH,
            ease:     'Quad.easeOut',
          });
        },
      });
    } else {
      this._applyCompanionTexts(data);
    }

    // Обновить цвет свечения фона
    this._bgGlow.setFillStyle(data.color, 0.06);

    // Обновить кольцо выбора (если этот компаньон уже выбран)
    if (this._selectedId === id) {
      this._selectionRing.setStrokeStyle(3, data.color, 0.9);
    } else if (this._selectedId) {
      // другой компаньон выбран — убрать кольцо
      this._selectionRing.setStrokeStyle(3, data.color, 0);
    }

    // Переключить частицы (искры только у Светли)
    if (this._sparks) {
      this._sparks.setVisible(id === 'svetlya');
    }

    // Синхронизировать состояние кнопки «Выбрать»
    this._updateChooseButton(id);
  }

  _applyCompanionTexts(data) {
    this._nameText.setText(data.name).setColor(data.colorHex);
    this._essenceText.setText(data.essence);
    this._descText.setText(data.description);
    this._quoteText.setText(data.quote);
    this._layoutQuoteBlock();
  }

  /** Разместить разделитель и цитату под блоком описания (высота описания разная). */
  _layoutQuoteBlock() {
    const W = this._W;
    const gap = 14;
    const quoteY = this._descText.y + this._descText.height + gap;
    this._divider.clear();
    this._divider.lineStyle(1, COLORS.DUH, 0.3);
    const lineY = quoteY - 10;
    this._divider.lineBetween(W / 2 - 60, lineY, W / 2 + 60, lineY);
    this._quoteText.setY(quoteY);
  }

  // ─── Анимация смены шара ─────────────────────────────────────────────────────

  _switchOrb(newId) {
    const newKey = `orb_${newId}`;

    // Остановить парение
    this._floatTween?.stop();

    this.tweens.add({
      targets:  this._orb,
      scale:    0.5,
      alpha:    0,
      duration: ANIM.COMPANION_SWITCH,
      ease:     'Quad.easeIn',
      onComplete: () => {
        this._orb.setTexture(newKey);
        this._orb.setPosition(this._W / 2, this._orbY);

        this.tweens.add({
          targets:  this._orb,
          scale:    1,
          alpha:    1,
          duration: ANIM.COMPANION_SWITCH,
          ease:     'Back.easeOut',
          onComplete: () => {
            // Возобновить парение
            this._floatTween = this._addFloat(this._orb);
            this._switching = false;
          },
        });
      },
    });
  }

  // ─── Управление табами ───────────────────────────────────────────────────────

  _onTabClick(id) {
    if (this._switching || id === this._activeId) return;
    this._switching = true;
    this._activeId  = id;

    // Обновить визуальное состояние табов
    GAME_CONFIG.INITIAL_COMPANIONS.forEach((tid) => {
      const tab   = this._tabs[tid];
      const data  = COMPANIONS[tid];
      const isActive = tid === id;

      this._drawTabBg(tab.bg, tab.x - tab.w / 2, tab.y - tab.h / 2, tab.w, tab.h, data.color, isActive);
      tab.txt.setColor(isActive ? '#FFF8EE' : '#9E8A7A');
      tab.txt.setFontStyle(isActive ? 'bold' : 'normal');
    });

    // Сменить шар и текст
    this._switchOrb(id);
    this._fillCompanionData(id, true);

    // Если был выбор другого — сбросить
    if (this._selectedId && this._selectedId !== id) {
      this._selectedId = null;
      this._hideCtaButton();
    }
  }

  // ─── Обработка выбора ────────────────────────────────────────────────────────

  _updateChooseButton(id) {
    // Если этот компаньон уже подтверждён — кнопку «Выбрать» скрыть
    if (this._selectedId === id) {
      this._btnChoose.container.setAlpha(0);
      this._btnChoose.zone.disableInteractive();
    } else {
      this._btnChoose.container.setAlpha(1);
      this._btnChoose.zone.setInteractive({ useHandCursor: true });
    }
  }

  _onChooseClick() {
    const id   = this._activeId;
    const data = COMPANIONS[id];

    this._selectedId = id;

    // Анимация выбора: кольцо вокруг шара + вспышка
    this._selectionRing.setStrokeStyle(3, data.color, 0).setAlpha(0);
    this.tweens.add({
      targets:  this._selectionRing,
      alpha:    1,
      duration: 300,
      ease:     'Quad.easeOut',
      onStart:  () => this._selectionRing.setStrokeStyle(3, data.color, 0.9),
    });

    // Пульс шара
    this.tweens.add({
      targets:  this._orb,
      scale:    { from: 1, to: 1.18 },
      alpha:    { from: 1, to: 1 },
      duration: 200,
      yoyo:     true,
      ease:     'Quad.easeInOut',
    });

    // Скрыть «Выбрать», показать «Начать путешествие»
    this._btnChoose.container.setAlpha(0);
    this._btnChoose.zone.disableInteractive();
    this._showCtaButton(data.color);
  }

  _showCtaButton(color) {
    // Перекрасить фон CTA под цвет компаньона (через BTN_PRIMARY всегда тёплый)
    this._btnStart.container.setAlpha(0).setScale(0.85);
    this.tweens.add({
      targets:  this._btnStart.container,
      alpha:    1,
      scale:    1,
      duration: 400,
      ease:     'Back.easeOut',
    });
    this._btnStart.zone.setInteractive({ useHandCursor: true });
  }

  _hideCtaButton() {
    this.tweens.add({
      targets:  this._btnStart.container,
      alpha:    0,
      scale:    0.85,
      duration: 200,
    });
    this._btnStart.zone.disableInteractive();

    // Показать «Выбрать» снова
    this.tweens.add({
      targets:  this._btnChoose.container,
      alpha:    1,
      duration: 200,
    });
    this._btnChoose.zone.setInteractive({ useHandCursor: true });
  }

  _onStartClick() {
    if (!this._selectedId) return;

    // Сохранить выбор компаньона
    GameState.setFirstCompanion(this._selectedId);

    const data = COMPANIONS[this._selectedId];
    console.log(`[CompanionSelect] Выбрана: ${data.name}`);

    // Финальная анимация: шар разрастается и растворяется в фоне
    this._floatTween?.stop();

    this.tweens.add({
      targets:  this._orb,
      scale:    3.5,
      alpha:    0,
      duration: 800,
      ease:     'Quad.easeIn',
    });

    this.cameras.main.fadeOut(700, 26, 15, 46);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Этап 7: переход в ChapterScene, глава 1
      GameState.set('story.currentChapter', 1);
      GameState.set('story.currentMiniGame', 0);
      GameState.save();
      this.scene.start(GAME_CONFIG.SCENES.CHAPTER, { chapter: 1 });
    });
  }

  // ─── Утилита парения ─────────────────────────────────────────────────────────

  _addFloat(target) {
    return this.tweens.add({
      targets:    target,
      y:          `+=${ANIM.FLOAT_AMPLITUDE}`,
      duration:   ANIM.FLOAT_DURATION,
      yoyo:       true,
      repeat:     -1,
      ease:       'Sine.easeInOut',
    });
  }
}
