/**
 * PreloadScene.js — Предзагрузка «Искра и Эхо»
 *
 * Отвечает за:
 *  - Красивый экран загрузки с прогресс-баром (cozy-стиль)
 *  - Генерацию всех программных текстур (Canvas API + Phaser)
 *  - Переход на MainMenuScene после загрузки
 *
 * Все текстуры создаются программно через CanvasRenderingContext2D,
 * чтобы игра работала без внешних ассетов. Реальные ассеты
 * подключаются по мере их создания (раздел «Загрузка реальных ассетов»).
 */

class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.PRELOAD });
  }

  // ─── Phaser lifecycle ───────────────────────────────────────────────────────

  preload() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    this._drawLoadingScreen(W, H);

    // Генерируем текстуры до старта загрузчика Phaser
    this._generateAllTextures(W, H);

    // Прогресс реальной загрузки (файлов нет, но шкала красиво добежит)
    this.load.on('progress', (v) => this._onProgress(v));
    this.load.on('complete', ()  => this._onComplete());

    // ── Загрузка реальных ассетов (добавлять сюда по мере появления) ────────
    // this.load.image('bg_chapter1', 'assets/images/bg_chapter1.jpg');
    // this.load.audio('music_menu',  'assets/audio/menu_theme.mp3');
  }

  create() {
    // Если файлов нет, complete уже вызван в preload — на всякий случай:
    if (!this._completed) this._onComplete();
  }

  // ─── Экран загрузки ─────────────────────────────────────────────────────────

  _drawLoadingScreen(W, H) {
    // Фоновый прямоугольник
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.BG_NIGHT, 1);
    bg.fillRect(0, 0, W, H);

    // Звёзды фона
    this._drawStars(bg, W, H);

    // Логотип
    this.add.text(W / 2, H * 0.38, 'Искра и Эхо', {
      fontFamily: 'Georgia, serif',
      fontSize:   '32px',
      color:      '#FFD166',
      align:      'center',
      stroke:     '#2D1B4E',
      strokeThickness: 4,
      shadow: { x: 0, y: 2, color: '#000', blur: 12, fill: true },
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.38 + 42, 'Найди их снова…', {
      fontFamily: 'Georgia, serif',
      fontSize:   '16px',
      color:      '#A8C5DA',
      align:      'center',
    }).setOrigin(0.5);

    // Рамка прогресс-бара
    const barW = 260;
    const barH = 8;
    const barX = (W - barW) / 2;
    const barY = H * 0.62;

    const barFrame = this.add.graphics();
    barFrame.lineStyle(1, COLORS.DUH, 0.4);
    barFrame.strokeRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 6);

    // Заливка прогресса
    this._progressBar = this.add.graphics();
    this._barX  = barX;
    this._barY  = barY;
    this._barW  = barW;
    this._barH  = barH;

    // Подпись «Загружаем воспоминания…»
    this._loadingText = this.add.text(W / 2, barY + 22, 'Загружаем воспоминания…', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
    }).setOrigin(0.5);

    this._onProgress(0);
  }

  _drawStars(g, W, H) {
    const rng = Phaser.Math.RND;
    for (let i = 0; i < 60; i++) {
      const x  = rng.between(0, W);
      const y  = rng.between(0, H * 0.75);
      const r  = rng.realInRange(0.5, 2);
      const a  = rng.realInRange(0.2, 0.8);
      g.fillStyle(COLORS.STAR, a);
      g.fillCircle(x, y, r);
    }
  }

  _onProgress(value) {
    const g = this._progressBar;
    if (!g) return;
    g.clear();
    if (value > 0) {
      g.fillStyle(COLORS.SVETLYA, 1);
      g.fillRoundedRect(this._barX, this._barY, this._barW * value, this._barH, 5);
    }
  }

  _onComplete() {
    this._completed = true;
    this._onProgress(1);
    this._loadingText?.setText('Готово!');

    // Плавный переход на главное меню
    this.time.delayedCall(400, () => {
      this.cameras.main.fadeOut(ANIM.FADE_OUT, 26, 15, 46);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
      });
    });
  }

  // ─── Генерация программных текстур ──────────────────────────────────────────

  _generateAllTextures(W, H) {
    this._genBackgrounds(W, H);
    this._genCompanionOrbs();
    this._genParticles();
    this._genUIElements();
  }

  // Фоны
  _genBackgrounds(W, H) {
    // Ночной фон для MainMenu и CompanionSelect
    const nightCanvas = this.textures.createCanvas('bg_night', W, H);
    const nightCtx    = nightCanvas.getContext('2d');
    const nightGrad   = nightCtx.createLinearGradient(0, 0, 0, H);
    nightGrad.addColorStop(0.0, '#1A0F2E');
    nightGrad.addColorStop(0.5, '#2D1B4E');
    nightGrad.addColorStop(1.0, '#1A0F2E');
    nightCtx.fillStyle = nightGrad;
    nightCtx.fillRect(0, 0, W, H);
    nightCanvas.refresh();

    // Тёплый фон для дневных сцен
    const warmCanvas = this.textures.createCanvas('bg_warm', W, H);
    const warmCtx    = warmCanvas.getContext('2d');
    const warmGrad   = warmCtx.createLinearGradient(0, 0, 0, H);
    warmGrad.addColorStop(0.0, '#FFF4E0');
    warmGrad.addColorStop(0.6, '#FFE8C0');
    warmGrad.addColorStop(1.0, '#F5D49A');
    warmCtx.fillStyle = warmGrad;
    warmCtx.fillRect(0, 0, W, H);
    warmCanvas.refresh();
  }

  // Шары-компаньоны (200×200, прозрачный фон)
  _genCompanionOrbs() {
    this._genOrb('orb_svetlya', '#FFFFF0', '#FFD166', '#E8A020', '#FFF4C2');
    this._genOrb('orb_duh',     '#F0F8FF', '#A8C5DA', '#6895B2', '#E0EEF8');
    this._genOrb('orb_ten',     '#F8F0FF', '#7B5EA7', '#4A2A7A', '#D4C9EE');
  }

  /**
   * Генерирует текстуру светящегося шара с радиальным градиентом.
   * @param key    - ключ текстуры
   * @param core   - цвет ядра (белый/светлый)
   * @param mid    - основной цвет
   * @param edge   - тёмный цвет края
   * @param glow   - цвет внешнего свечения
   */
  _genOrb(key, core, mid, edge, glow) {
    const SIZE = 200;
    const C    = SIZE / 2;
    const canvas = this.textures.createCanvas(key, SIZE, SIZE);
    const ctx    = canvas.getContext('2d');

    // Внешнее мягкое свечение
    const glowGrad = ctx.createRadialGradient(C, C, SIZE * 0.30, C, C, SIZE * 0.50);
    glowGrad.addColorStop(0.0, glow + 'BB');
    glowGrad.addColorStop(1.0, glow + '00');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Основной шар
    const orbGrad = ctx.createRadialGradient(C * 0.75, C * 0.65, 0, C, C, SIZE * 0.38);
    orbGrad.addColorStop(0.00, core);
    orbGrad.addColorStop(0.30, mid);
    orbGrad.addColorStop(0.75, edge);
    orbGrad.addColorStop(1.00, edge + 'AA');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(C, C, SIZE * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Блик (highlight) в левом верхнем секторе
    const hlGrad = ctx.createRadialGradient(C * 0.68, C * 0.60, 0, C * 0.68, C * 0.60, SIZE * 0.14);
    hlGrad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
    hlGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(C * 0.68, C * 0.60, SIZE * 0.14, 0, Math.PI * 2);
    ctx.fill();

    canvas.refresh();
  }

  // Частицы
  _genParticles() {
    // Маленький мягкий кружок для эффектов
    const pCanvas = this.textures.createCanvas('particle_glow', 32, 32);
    const pCtx    = pCanvas.getContext('2d');
    const pGrad   = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    pGrad.addColorStop(0.0, 'rgba(255,255,255,1)');
    pGrad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    pGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 32, 32);
    pCanvas.refresh();

    // Звёздочка-искра для Светли
    const sCanvas = this.textures.createCanvas('particle_spark', 16, 16);
    const sCtx    = sCanvas.getContext('2d');
    sCtx.fillStyle = '#FFD166';
    sCtx.shadowColor = '#FFF4C2';
    sCtx.shadowBlur  = 6;
    // Ромб
    sCtx.beginPath();
    sCtx.moveTo(8, 0);
    sCtx.lineTo(10, 7);
    sCtx.lineTo(16, 8);
    sCtx.lineTo(10, 9);
    sCtx.lineTo(8, 16);
    sCtx.lineTo(6, 9);
    sCtx.lineTo(0, 8);
    sCtx.lineTo(6, 7);
    sCtx.closePath();
    sCtx.fill();
    sCanvas.refresh();
  }

  // UI-элементы
  _genUIElements() {
    // Фон карточки компаньона
    const cW = 340, cH = 440;
    const cardCanvas = this.textures.createCanvas('card_companion', cW, cH);
    const cCtx       = cardCanvas.getContext('2d');

    // Тень карточки
    cCtx.shadowColor  = 'rgba(0,0,0,0.25)';
    cCtx.shadowBlur   = 20;
    cCtx.shadowOffsetY = 6;

    // Градиентная заливка карточки
    const cGrad = cCtx.createLinearGradient(0, 0, 0, cH);
    cGrad.addColorStop(0.0, '#FFF8F0');
    cGrad.addColorStop(1.0, '#FFF0DC');
    cCtx.fillStyle = cGrad;
    this._roundRect(cCtx, 0, 0, cW, cH, 24);
    cCtx.fill();

    cCtx.shadowColor = 'transparent';

    // Граница
    cCtx.strokeStyle = '#E8D0B0';
    cCtx.lineWidth   = 1.5;
    this._roundRect(cCtx, 0.75, 0.75, cW - 1.5, cH - 1.5, 24);
    cCtx.stroke();

    cardCanvas.refresh();

    // Кнопка «Начать путешествие»
    const bW = 300, bH = 60;
    const btnCanvas = this.textures.createCanvas('btn_primary', bW, bH);
    const bCtx      = btnCanvas.getContext('2d');

    bCtx.shadowColor   = 'rgba(200,94,26,0.5)';
    bCtx.shadowBlur    = 16;
    bCtx.shadowOffsetY = 4;

    const bGrad = bCtx.createLinearGradient(0, 0, 0, bH);
    bGrad.addColorStop(0.0, '#FFB57A');
    bGrad.addColorStop(1.0, '#FF9B4E');
    bCtx.fillStyle = bGrad;
    this._roundRect(bCtx, 0, 0, bW, bH, 30);
    bCtx.fill();

    btnCanvas.refresh();
  }

  // Хелпер: скруглённый прямоугольник (совместимость с браузерами без roundRect)
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
