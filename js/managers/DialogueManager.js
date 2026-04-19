/**
 * DialogueManager.js — Синглтон диалоговой системы «Искра и Эхо»
 *
 * Отображает диалоговую панель поверх любой Phaser-сцены.
 * Поддерживает typewriter-эффект, цепочки реплик, skip по тапу.
 *
 * Использование:
 *   // Одна реплика:
 *   DialogueManager.show(this, { speakerId: 'svetlya', text: '...', emotion: 'joy' }, callback);
 *
 *   // Цепочка реплик:
 *   DialogueManager.showSequence(this, [
 *     { speakerId: 'svetlya', text: '...', emotion: 'sad' },
 *     { speakerId: 'duh',     text: '...', emotion: 'calm' },
 *   ], callback);
 *
 *   // Закрыть программно:
 *   DialogueManager.hide();
 */

window.DialogueManager = (function () {

  // ─── Приватное состояние ──────────────────────────────────────────────────

  let _scene         = null;
  let _container     = null;
  let _isShowing     = false;
  let _typeTimer     = null;
  let _fullText      = '';
  let _charIndex     = 0;
  let _skipPending   = false;
  let _onComplete    = null;
  let _tapIndicator  = null;
  let _dialogText    = null;
  let _tapTween      = null;
  let _hitZone       = null;

  // Скорость печати: мс на символ
  const CHAR_DELAY   = 32;
  const PANEL_H      = 178;

  // ─── Вспомогательные ─────────────────────────────────────────────────────

  /** Уничтожить текущую панель и очистить все ресурсы */
  function _destroy() {
    if (_typeTimer)  { _typeTimer.remove(false); _typeTimer = null; }
    if (_tapTween)   { _tapTween.stop();         _tapTween  = null; }
    if (_container && !_container.destroyed) {
      _container.destroy(true);
    }
    _container    = null;
    _hitZone      = null;
    _tapIndicator = null;
    _dialogText   = null;
    _isShowing    = false;
    _skipPending  = false;
  }

  /** Запустить мигание tap-индикатора */
  function _startTapBlink() {
    if (!_tapIndicator || !_scene) return;
    _tapIndicator.setAlpha(1);
    _tapTween = _scene.tweens.add({
      targets:  _tapIndicator,
      alpha:    { from: 1, to: 0.2 },
      duration: 550,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  /** Завершить печать — показать весь текст и активировать tap */
  function _finishTyping() {
    if (_typeTimer) { _typeTimer.remove(false); _typeTimer = null; }
    if (_dialogText && !_dialogText.destroyed) {
      _dialogText.setText(_fullText);
    }
    _charIndex   = _fullText.length;
    _skipPending = false;
    _startTapBlink();
  }

  /** Напечатать следующий символ */
  function _typeNextChar() {
    if (!_isShowing || !_scene) return;

    // Если запрошен пропуск — сразу показать всё
    if (_skipPending) { _finishTyping(); return; }

    if (_charIndex >= _fullText.length) { _finishTyping(); return; }

    _charIndex++;
    if (_dialogText && !_dialogText.destroyed) {
      _dialogText.setText(_fullText.slice(0, _charIndex));
    }
    _typeTimer = _scene.time.delayedCall(CHAR_DELAY, _typeNextChar);
  }

  // ─── Публичный API ────────────────────────────────────────────────────────

  const API = {

    /**
     * Показать одну реплику.
     * @param {Phaser.Scene} scene    — текущая сцена (нужна для add.*)
     * @param {Object}       config   — { speakerId, text, emotion }
     * @param {Function}     [onDone] — вызывается после тапа игрока
     */
    show(scene, config, onDone) {
      _destroy();

      _scene      = scene;
      _onComplete = onDone || null;
      _isShowing  = true;
      _fullText   = config.text || '';
      _charIndex  = 0;
      _skipPending = false;

      const W    = GAME_CONFIG.WIDTH;
      const H    = GAME_CONFIG.HEIGHT;
      const panelY = H - PANEL_H;

      const companion = COMPANIONS[config.speakerId] || COMPANIONS.svetlya;

      // ── Контейнер (depth 200 — поверх всего) ──
      _container = scene.add.container(0, 0).setDepth(200);

      // Полупрозрачное затемнение верхней части
      const overlay = scene.add.graphics();
      overlay.fillStyle(0x000000, 0.25);
      overlay.fillRect(0, 0, W, panelY);

      // Основной фон панели
      const panelBg = scene.add.graphics();
      panelBg.fillStyle(0x080618, 0.94);
      panelBg.fillRect(0, panelY, W, PANEL_H);

      // Цветная линия-бордюр сверху панели (цвет персонажа)
      const borderLine = scene.add.graphics();
      borderLine.lineStyle(2, companion.color, 0.85);
      borderLine.lineBetween(0, panelY + 1, W, panelY + 1);

      // Мягкое свечение бордюра
      const borderGlow = scene.add.graphics();
      borderGlow.fillStyle(companion.color, 0.08);
      borderGlow.fillRect(0, panelY, W, 4);

      // ── Аватар (шар компаньона) ──
      const avatarX  = 46;
      const avatarY  = panelY + 52;
      const avatarSz = 62;

      // Свечение за аватаром
      const avatarGlow = scene.add.graphics();
      avatarGlow.fillStyle(companion.color, 0.18);
      avatarGlow.fillCircle(avatarX, avatarY, avatarSz / 2 + 10);

      // Шар
      const avatar = scene.add.image(avatarX, avatarY, `orb_${config.speakerId}`)
        .setDisplaySize(avatarSz, avatarSz);

      // Лёгкое покачивание аватара
      scene.tweens.add({
        targets:  avatar,
        y:        avatarY - 4,
        duration: 1800,
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
      });

      // ── Имя спикера ──
      const nameText = scene.add.text(88, panelY + 16, companion.name, {
        fontFamily: 'Georgia, serif',
        fontSize:   '15px',
        fontStyle:  'bold',
        color:      companion.colorHex,
        shadow:     { x: 0, y: 1, color: '#000', blur: 6, fill: true },
      });

      // Эмоция (маленькая подпись под именем)
      const emotionLabels = {
        joy:      '✦ радость',
        sad:      '✦ грусть',
        surprise: '✦ удивление',
        calm:     '✦ спокойствие',
        delight:  '✦ восторг',
      };
      const emotionText = scene.add.text(88, panelY + 34, emotionLabels[config.emotion] || '', {
        fontFamily: 'Georgia, serif',
        fontSize:   '11px',
        color:      '#7A6A8A',
        fontStyle:  'italic',
      });

      // ── Текст диалога ──
      const textX = 88;
      const textW = W - textX - 18;
      _dialogText = scene.add.text(textX, panelY + 54, '', {
        fontFamily: 'Georgia, serif',
        fontSize:   '15px',
        color:      '#F0E8FF',
        wordWrap:   { width: textW },
        lineSpacing: 6,
      });

      // ── Tap-индикатор ──
      _tapIndicator = scene.add.text(W - 22, H - 18, '▾', {
        fontFamily: 'Georgia, serif',
        fontSize:   '20px',
        color:      companion.colorHex,
      }).setOrigin(0.5).setAlpha(0);

      // ── Хит-зона для тапа ──
      _hitZone = scene.add.zone(0, panelY, W, PANEL_H)
        .setOrigin(0, 0)
        .setInteractive();

      _hitZone.on('pointerup', () => {
        if (_charIndex < _fullText.length) {
          // Пропуск анимации — показать весь текст
          _skipPending = true;
        } else {
          // Закрыть диалог и вызвать коллбэк
          const cb = _onComplete;
          _destroy();
          if (cb) cb();
        }
      });

      // Добавить всё в контейнер
      _container.add([
        overlay, panelBg, borderLine, borderGlow,
        avatarGlow, avatar,
        nameText, emotionText, _dialogText,
        _tapIndicator, _hitZone,
      ]);

      // ── Анимация появления панели снизу ──
      _container.setY(PANEL_H);
      scene.tweens.add({
        targets:  _container,
        y:        0,
        duration: 280,
        ease:     'Quad.easeOut',
        onComplete: () => { _typeNextChar(); },
      });
    },

    /**
     * Показать цепочку реплик последовательно.
     * @param {Phaser.Scene}   scene
     * @param {Array<Object>}  configs  — массив конфигов для show()
     * @param {Function}       [onDone] — вызывается когда все реплики завершены
     */
    showSequence(scene, configs, onDone) {
      if (!configs || configs.length === 0) {
        if (onDone) onDone();
        return;
      }
      const [first, ...rest] = configs;
      this.show(scene, first, () => {
        this.showSequence(scene, rest, onDone);
      });
    },

    /**
     * Мгновенно скрыть диалог (без коллбэка).
     */
    hide() {
      _destroy();
    },

    /**
     * Проверить, активен ли сейчас диалог.
     */
    isActive() {
      return _isShowing;
    },
  };

  return API;

}());
