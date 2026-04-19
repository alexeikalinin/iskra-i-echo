/**
 * ChapterScene.js — Хаб главы «Искра и Эхо»
 *
 * Связующая сцена между CompanionSelectScene и мини-играми.
 * Управляет цепочкой мини-игр одной главы.
 *
 * Поток (первый запуск главы):
 *   1. Fade-in → показать компаньона + заголовок главы
 *   2. Intro-диалог из DIALOGUES.chapters[N].intro
 *   3. Кнопка «Начать» → запуск первой мини-игры
 *
 * Поток (возврат из мини-игры):
 *   4. Получить результат (stars, completed)
 *   5. Реакция компаньона (win/lose из DIALOGUES)
 *   6. Кнопка «Дальше» → следующая мини-игра
 *      или «Завершить главу» → финальный диалог → переход к следующей главе
 *
 * Данные, передаваемые в сцену:
 *   { chapter: N }                                   — первый запуск
 *   { chapter: N, miniGameIndex: I, miniGameResult } — возврат из мини-игры
 */

class ChapterScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.CHAPTER });
  }

  // ─── Инициализация ────────────────────────────────────────────────────────

  init(data) {
    // Номер главы — из переданных данных или из GameState
    this._chapterNum  = data.chapter || GameState.get('story.currentChapter') || 1;

    if (window.Analytics) {
      window.Analytics.track('chapter_enter', { chapter: this._chapterNum });
    }

    // Результат последней мини-игры (если вернулись из неё)
    this._miniResult  = data.miniGameResult  || null;
    this._returnedIdx = data.miniGameIndex   !== undefined ? data.miniGameIndex : null;

    // Флаг возобновления сохранённого прогресса (из MainMenu → Продолжить)
    this._resuming    = data.resuming || false;
  }

  // ─── Создание сцены ───────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;
    this._W = W;
    this._H = H;

    // Данные главы
    this._chapterData    = DIALOGUES.chapters[this._chapterNum] || {};
    this._miniGameChain  = CHAPTER_MINI_GAMES[this._chapterNum] || [];
    this._companionId    = GameState.get('firstCompanion') || 'svetlya';
    this._companion      = COMPANIONS[this._companionId];

    // Текущий индекс мини-игры из GameState
    // (при возврате он уже был обновлён ниже в _handleMiniGameReturn)
    this._currentMGIdx   = GameState.get('story.currentMiniGame') || 0;

    this._buildBackground(W, H);
    this._buildHeader(W, H);
    this._buildCompanionZone(W, H);
    this._buildProgressDots(W, H);
    this._buildActionButton(W, H);
    this._buildBackButton(W, H);

    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);

    // Определить состояние: возврат из мини-игры / продолжение / первый запуск
    if (this._miniResult !== null && this._returnedIdx !== null) {
      // Возврат из мини-игры с результатом
      this.time.delayedCall(ANIM.FADE_IN + 100, () => {
        this._handleMiniGameReturn(this._returnedIdx, this._miniResult);
      });
    } else if (this._resuming && this._currentMGIdx > 0) {
      // Продолжение сохранённой игры: глава уже частично пройдена
      this._updateProgressDots(this._currentMGIdx);
      this.time.delayedCall(ANIM.FADE_IN + 100, () => {
        // Показываем кнопку продолжения с нужной мини-игрой
        this._showActionButton('Продолжить ›', () => this._launchNextMiniGame());
      });
    } else {
      // Первый запуск главы — сбросить текущую мини-игру
      GameState.set('story.currentMiniGame', 0);
      this._currentMGIdx = 0;
      this._updateProgressDots(0);
      this.time.delayedCall(ANIM.FADE_IN + 100, () => {
        this._playIntroDialogue();
      });
    }
  }

  // ─── Фон ─────────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    // Базовый ночной фон
    this.add.image(W / 2, H / 2, 'bg_night').setDisplaySize(W, H);

    // Цветной тоновый оверлей под цвет компаньона
    const overlayColor = this._companion.colorDark || this._companion.color;
    const overlay = this.add.graphics();
    overlay.fillStyle(overlayColor, 0.07);
    overlay.fillRect(0, 0, W, H);

    // Мерцающие звёзды
    this._addStars(W, H);

    // Мягкое свечение снизу (тёплый отсвет)
    const warmGlow = this.add.graphics();
    warmGlow.fillStyle(this._companion.color, 0.05);
    warmGlow.fillEllipse(W / 2, H, W * 1.2, 300);
  }

  _addStars(W, H) {
    // Создаём несколько светящихся точек-звёзд
    const starCount = 28;
    for (let i = 0; i < starCount; i++) {
      const x     = Phaser.Math.Between(10, W - 10);
      const y     = Phaser.Math.Between(10, H * 0.55);
      const r     = Phaser.Math.FloatBetween(1, 2.5);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.7);
      const star  = this.add.circle(x, y, r, 0xFFFFFF, alpha);

      // Мигание со случайной задержкой
      this.tweens.add({
        targets:  star,
        alpha:    { from: alpha * 0.3, to: alpha },
        duration: Phaser.Math.Between(1200, 3000),
        yoyo:     true,
        repeat:   -1,
        delay:    Phaser.Math.Between(0, 2000),
        ease:     'Sine.easeInOut',
      });
    }
  }

  // ─── Заголовок ────────────────────────────────────────────────────────────

  _buildHeader(W, H) {
    const chapterLabel = this.add.text(W / 2, 28, `Глава ${this._chapterNum}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#7A6A8A',
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    const chapterTitle = this.add.text(W / 2, 52, this._chapterData.title || '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
      stroke:     '#1A0F2E',
      strokeThickness: 4,
      shadow:     { x: 0, y: 2, color: '#000', blur: 12, fill: true },
      align:      'center',
    }).setOrigin(0.5).setAlpha(0);

    const locationText = this.add.text(W / 2, 82, this._chapterData.location || '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      fontStyle:  'italic',
      color:      '#9E8A7A',
      align:      'center',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets:  [chapterLabel, chapterTitle, locationText],
      alpha:    1,
      y:        (target, key, value) => value - 6,
      duration: 600,
      ease:     'Quad.easeOut',
      delay:    200,
    });
  }

  // ─── Зона компаньона ──────────────────────────────────────────────────────

  _buildCompanionZone(W, H) {
    const orbY    = H * 0.42;
    const orbSize = 170;

    // Свечение под шаром
    this._orbGlow = this.add.ellipse(W / 2, orbY + 20, 200, 80, this._companion.color, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets:  this._orbGlow,
      alpha:    { from: 0.06, to: 0.18 },
      scaleX:   { from: 0.85, to: 1.1 },
      scaleY:   { from: 0.85, to: 1.1 },
      duration: 2200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Шар компаньона
    this._orb = this.add.image(W / 2, orbY, `orb_${this._companionId}`)
      .setDisplaySize(orbSize, orbSize)
      .setAlpha(0);

    this.tweens.add({
      targets:  this._orb,
      alpha:    1,
      scale:    1,
      duration: 700,
      ease:     'Back.easeOut',
      delay:    300,
    });

    // Постоянное парение
    this._floatTween = this.tweens.add({
      targets:  this._orb,
      y:        orbY - ANIM.FLOAT_AMPLITUDE,
      duration: ANIM.FLOAT_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
      delay:    800,
    });

    // Стадия эволюции
    const stageIdx  = (GameState.getCompanion(this._companionId).stage || 1) - 1;
    const stageName = this._companion.stages[stageIdx]?.name || '';

    this._stageText = this.add.text(W / 2, orbY + orbSize / 2 + 22, stageName, {
      fontFamily: 'Georgia, serif',
      fontSize:   '16px',
      fontStyle:  'italic',
      color:      this._companion.colorHex,
      align:      'center',
      shadow:     { x: 0, y: 1, color: '#000', blur: 8, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets:  this._stageText,
      alpha:    1,
      duration: 500,
      delay:    600,
    });

    this._orbY = orbY;
  }

  // ─── Прогресс-точки мини-игр ─────────────────────────────────────────────

  _buildProgressDots(W, H) {
    const dotsY   = H * 0.735;
    const total   = this._miniGameChain.length;
    const dotR    = 6;
    const spacing = 22;
    const startX  = W / 2 - ((total - 1) * spacing) / 2;

    this._dots = [];
    for (let i = 0; i < total; i++) {
      const x = startX + i * spacing;
      const dot = this.add.circle(x, dotsY, dotR, 0x3A2A5A, 1)
        .setStrokeStyle(1.5, this._companion.color, 0.4);
      this._dots.push(dot);
    }
  }

  /** Обновить визуальное состояние точек */
  _updateProgressDots(completedCount) {
    this._dots.forEach((dot, i) => {
      if (i < completedCount) {
        // Пройдена
        dot.setFillStyle(this._companion.color, 1);
        dot.setStrokeStyle(0);
        // Маленькая анимация заполнения
        this.tweens.add({
          targets:  dot,
          scaleX:   { from: 1.6, to: 1 },
          scaleY:   { from: 1.6, to: 1 },
          duration: 300,
          ease:     'Back.easeOut',
        });
      } else if (i === completedCount) {
        // Текущая
        dot.setFillStyle(this._companion.colorLight || this._companion.color, 0.5);
        dot.setStrokeStyle(1.5, this._companion.color, 1);
        this.tweens.add({
          targets:  dot,
          alpha:    { from: 0.5, to: 1 },
          duration: 600,
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        });
      } else {
        dot.setFillStyle(0x3A2A5A, 1);
        dot.setStrokeStyle(1.5, this._companion.color, 0.3);
      }
    });
  }

  // ─── Кнопка действия ─────────────────────────────────────────────────────

  _buildActionButton(W, H) {
    const btnY = H * 0.845;
    const BW   = 290;
    const BH   = 52;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.BTN_PRIMARY, 0.9);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 26);
    bg.lineStyle(2, COLORS.WHITE, 0.15);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 26);

    const shine = this.add.graphics();
    shine.fillStyle(COLORS.WHITE, 0.10);
    shine.fillRoundedRect(-BW / 2 + 4, -BH / 2 + 4, BW - 8, BH / 2 - 4, 22);

    this._btnLabel = this.add.text(0, 1, 'Начать', {
      fontFamily: 'Georgia, serif',
      fontSize:   '17px',
      fontStyle:  'bold',
      color:      '#FFFFFF',
      align:      'center',
    }).setOrigin(0.5);

    this._actionBtn = this.add.container(W / 2, btnY, [bg, shine, this._btnLabel])
      .setAlpha(0)
      .setDepth(10);

    // Хит-зона
    this._actionZone = this.add.zone(W / 2, btnY, BW, BH)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);

    this._actionZone.on('pointerover',  () => {
      this.tweens.add({ targets: this._actionBtn, scaleX: 1.04, scaleY: 1.04, duration: 100 });
    });
    this._actionZone.on('pointerout',   () => {
      this.tweens.add({ targets: this._actionBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    this._actionZone.on('pointerdown',  () => {
      this.tweens.add({ targets: this._actionBtn, scaleX: 0.97, scaleY: 0.97, duration: ANIM.BTN_PRESS });
    });
    this._actionZone.on('pointerup',    () => {
      this.tweens.add({ targets: this._actionBtn, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      if (this._actionCallback) this._actionCallback();
    });

    this._actionCallback = null;
  }

  /** Показать кнопку с текстом и коллбэком */
  _showActionButton(label, callback) {
    this._btnLabel.setText(label);
    this._actionCallback = callback;

    this._actionBtn.setAlpha(0).setScale(0.85);
    this.tweens.add({
      targets:  this._actionBtn,
      alpha:    1,
      scaleX:   1,
      scaleY:   1,
      duration: 400,
      ease:     'Back.easeOut',
      delay:    200,
    });
  }

  _hideActionButton() {
    this.tweens.add({
      targets:  this._actionBtn,
      alpha:    0,
      scaleX:   0.85,
      scaleY:   0.85,
      duration: 200,
    });
    this._actionCallback = null;
  }

  // ─── Кнопка «Назад» ──────────────────────────────────────────────────────

  _buildBackButton(W, H) {
    const btn = this.add.text(22, 110, '← Меню', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#A8C5DA'));
    btn.on('pointerout',  () => btn.setColor('#6A5A7A'));
    btn.on('pointerup',   () => {
      DialogueManager.hide();
      // Сохраняем текущий прогресс (глава + индекс мини-игры) перед выходом в меню
      GameState.set('story.currentChapter',  this._chapterNum);
      GameState.set('story.currentMiniGame', this._currentMGIdx);
      GameState.save();
      this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);
      this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
        this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
      });
    });
  }

  // ─── Логика игрового потока ───────────────────────────────────────────────

  /** Первый запуск главы: показать intro-диалог */
  _playIntroDialogue() {
    const introLines = this._chapterData.intro;
    if (introLines && introLines.length > 0) {
      DialogueManager.showSequence(this, introLines, () => {
        this._showActionButton('Начать ✦', () => this._launchNextMiniGame());
      });
    } else {
      // Нет вступительного диалога — сразу кнопка
      this._showActionButton('Начать ✦', () => this._launchNextMiniGame());
    }
  }

  /** Обработать возврат из мини-игры */
  _handleMiniGameReturn(miniGameIndex, result) {
    // Сохранить результат
    GameState.saveMiniGameResult(this._chapterNum, miniGameIndex, result);

    // Добавить привязанность
    const bondGain = result.stars ? result.stars * 8 : 5;
    GameState.addBond(this._companionId, bondGain);

    // Сохранить прогресс сразу после прохождения мини-игры
    GameState.save();

    // Сдвинуть текущий индекс вперёд
    const nextIdx = miniGameIndex + 1;
    GameState.set('story.currentMiniGame', nextIdx);
    this._currentMGIdx = nextIdx;

    // Обновить точки
    this._updateProgressDots(nextIdx);

    // Реакция компаньона
    const isWin       = result.completed && (result.stars >= 1);
    const afterData   = this._chapterData.afterMiniGame?.[miniGameIndex];
    const reactionLines = isWin
      ? (afterData?.win  || [{ speakerId: this._companionId, emotion: 'joy',  text: this._companion.reactions.win  }])
      : (afterData?.lose || [{ speakerId: this._companionId, emotion: 'calm', text: this._companion.reactions.lose }]);

    // Обновить эмоцию
    GameState.setEmotion(this._companionId, isWin ? 'joy' : 'calm');

    // Показать результат (звёзды) перед диалогом
    this._showMiniGameResult(result, () => {
      DialogueManager.showSequence(this, reactionLines, () => {
        // Проверить: все мини-игры пройдены?
        if (nextIdx >= this._miniGameChain.length) {
          this._playChapterComplete();
        } else {
          this._showActionButton('Дальше ›', () => this._launchNextMiniGame());
        }
      });
    });
  }

  /** Показать оверлей с результатом мини-игры (звёзды + счёт) */
  _showMiniGameResult(result, onDone) {
    const W       = this._W;
    const H       = this._H;
    const stars   = result.stars || 1;

    // Небольшой оверлей в центре экрана
    const panel = this.add.graphics().setDepth(150);
    panel.fillStyle(0x080618, 0.80);
    panel.fillRoundedRect(W / 2 - 130, H * 0.33, 260, 110, 18);

    // Звёзды
    const starEmojis = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const starText = this.add.text(W / 2, H * 0.37, starEmojis, {
      fontFamily: 'Georgia, serif',
      fontSize:   '32px',
      color:      '#FFE566',
      align:      'center',
    }).setOrigin(0.5).setDepth(151).setAlpha(0);

    // Счёт
    const scoreText = this.add.text(W / 2, H * 0.42, `${result.score || 0} очков`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#A8C5DA',
      align:      'center',
    }).setOrigin(0.5).setDepth(151).setAlpha(0);

    // Анимация появления
    this.tweens.add({
      targets:  [starText, scoreText],
      alpha:    1,
      y:        (t, k, v) => v - 8,
      duration: 400,
      ease:     'Back.easeOut',
    });

    // Убрать через 1.5 сек
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets:  [panel, starText, scoreText],
        alpha:    0,
        duration: 300,
        onComplete: () => {
          panel.destroy();
          starText.destroy();
          scoreText.destroy();
          if (onDone) onDone();
        },
      });
    });
  }

  /** Финальный диалог главы + завершение */
  _playChapterComplete() {
    const completeLines = this._chapterData.complete;
    if (completeLines && completeLines.length > 0) {
      DialogueManager.showSequence(this, completeLines, () => {
        this._finishChapter();
      });
    } else {
      this._finishChapter();
    }
  }

  _finishChapter() {
    // Сохранить завершение главы
    GameState.completeChapter(this._chapterNum);

    // Проверить эволюцию
    const companion = GameState.getCompanion(this._companionId);
    const bondNeeded = [0, 40, 90, 160, 250]; // bond для каждой стадии
    const nextStage  = companion.stage + 1;

    if (nextStage <= 5 && companion.bond >= bondNeeded[companion.stage]) {
      this._playEvolution(() => this._showChapterEndButton());
    } else {
      this._showChapterEndButton();
    }
  }

  _playEvolution(onDone) {
    // Анимация эволюции: вспышка + масштаб + текст новой формы
    this._floatTween?.stop();

    const stageIdx  = GameState.getCompanion(this._companionId).stage; // уже новая стадия
    const stageName = this._companion.stages[Math.min(stageIdx, 4)]?.name || '';

    // Вспышка
    this.tweens.add({
      targets:  this._orb,
      scaleX:   { from: 1, to: 2.2 },
      scaleY:   { from: 1, to: 2.2 },
      alpha:    { from: 1, to: 0 },
      duration: 600,
      ease:     'Quad.easeIn',
      onComplete: () => {
        // Обновить стадию в GameState
        GameState.evolveCompanion(this._companionId);

        // Краткое белое мигание экрана
        this.cameras.main.flash(400, 255, 255, 255);

        // Появление снова
        this._orb.setScale(0.3).setAlpha(0);
        this.tweens.add({
          targets:  this._orb,
          scaleX:   1,
          scaleY:   1,
          alpha:    1,
          duration: 700,
          ease:     'Back.easeOut',
          onComplete: () => {
            // Возобновить парение
            this._floatTween = this.tweens.add({
              targets:  this._orb,
              y:        this._orbY - ANIM.FLOAT_AMPLITUDE,
              duration: ANIM.FLOAT_DURATION,
              yoyo:     true,
              repeat:   -1,
              ease:     'Sine.easeInOut',
            });

            // Текст новой формы
            const W = this._W;
            const evolveText = this.add.text(W / 2, this._orbY - 120, `✦ ${stageName} ✦`, {
              fontFamily: 'Georgia, serif',
              fontSize:   '20px',
              fontStyle:  'bold italic',
              color:      this._companion.colorHex,
              align:      'center',
              shadow:     { x: 0, y: 0, color: this._companion.colorHex, blur: 20, fill: true },
            }).setOrigin(0.5).setAlpha(0).setDepth(50);

            this.tweens.add({
              targets:  evolveText,
              alpha:    { from: 0, to: 1 },
              y:        `-=15`,
              duration: 500,
              yoyo:     true,
              hold:     1200,
              onComplete: () => {
                evolveText.destroy();
                this._stageText.setText(stageName);
                if (onDone) onDone();
              },
            });
          },
        });
      },
    });
  }

  _showChapterEndButton() {
    const nextChapter = this._chapterNum + 1;
    if (nextChapter <= GAME_CONFIG.TOTAL_CHAPTERS) {
      this._showActionButton(`Глава ${nextChapter} →`, () => {
        this._goToNextChapter(nextChapter);
      });
    } else {
      // Финал игры (глава 15 пройдена)
      this._showActionButton('Эпилог ✦', () => {
        this._goToPostGame();
      });
    }
  }

  _goToNextChapter(nextChapter) {
    DialogueManager.hide();
    GameState.set('story.currentChapter', nextChapter);
    GameState.set('story.currentMiniGame', 0);
    GameState.save();

    this._floatTween?.stop();
    this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);
    this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
      this.scene.start(GAME_CONFIG.SCENES.CHAPTER, { chapter: nextChapter });
    });
  }

  _goToPostGame() {
    // TODO: Этап 13 — сцена «Дом Воспоминаний»
    this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);
    this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
      this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
    });
  }

  // ─── Запуск мини-игры ─────────────────────────────────────────────────────

  _launchNextMiniGame() {
    const idx     = this._currentMGIdx;
    const mgKey   = this._miniGameChain[idx];

    if (!mgKey) {
      // Цепочка пуста или индекс вышел за границу — глава считается завершённой
      console.warn(`[ChapterScene] Нет мини-игры по индексу ${idx} в главе ${this._chapterNum}, завершаем главу`);
      this._playChapterComplete();
      return;
    }

    this._hideActionButton();
    DialogueManager.hide();

    // Определить ключ сцены по строковому идентификатору мини-игры
    const sceneKeyMap = {
      match3:        GAME_CONFIG.SCENES.MATCH3,
      maze:          GAME_CONFIG.SCENES.MAZE,
      hidden_object: GAME_CONFIG.SCENES.HIDDEN_OBJECT,
      crossword:     GAME_CONFIG.SCENES.CROSSWORD,
      spot_diff:     GAME_CONFIG.SCENES.SPOT_DIFF,
      memory_pairs:  GAME_CONFIG.SCENES.MEMORY_PAIRS,
      sliding:       GAME_CONFIG.SCENES.SLIDING,
      bubble:        GAME_CONFIG.SCENES.BUBBLE,
    };
    const sceneKey = sceneKeyMap[mgKey];

    const launchData = {
      chapter:       this._chapterNum,
      miniGameIndex: idx,
      companionId:   this._companionId,
      difficulty:    this._getDifficulty(),
    };

    this._floatTween?.stop();

    this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);

    this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
      if (sceneKey) {
        this.scene.start(sceneKey, launchData);
      } else {
        this.scene.start(GAME_CONFIG.SCENES.PLACEHOLDER_MG, {
          ...launchData,
          miniGameKey: mgKey,
          sceneKey:    sceneKey,
        });
      }
    });
  }

  /** Рассчитать сложность на основе номера главы */
  _getDifficulty() {
    if (this._chapterNum <= 3)  return 'easy';
    if (this._chapterNum <= 8)  return 'normal';
    return 'hard';
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  shutdown() {
    // Явно останавливаем бесконечный твин парения, чтобы не ждать GC
    if (this._floatTween) {
      this._floatTween.destroy();
      this._floatTween = null;
    }
    // Убираем любой активный диалог и сбрасываем состояние менеджера
    DialogueManager.hide();
  }
}
