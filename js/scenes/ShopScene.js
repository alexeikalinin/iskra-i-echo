/**
 * ShopScene.js — Уютная лавка (косметика и пакет поддержки)
 *
 * Без таймеров и давления: только информация и мягкие формулировки.
 * Реальная оплата: MONETIZATION.CHECKOUT_BASE_URL (веб-MVP).
 */

class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.SHOP });
  }

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    if (window.Analytics) {
      window.Analytics.trackShopOpen();
    }

    this.add.image(W / 2, H / 2, 'bg_night').setDisplaySize(W, H);

    this._makeBackButton(W, H);
    this._makeHeader(W, H);

    let listY = 160;
    if (MONETIZATION.isShopDebugEnabled()) {
      listY = this._makeDebugPanel(W, listY);
    }

    SHOP_CATALOG.forEach((product) => {
      listY = this._makeProductCard(W, listY, product);
    });

    this._makeLegalFooter(W, H);

    this.cameras.main.fadeIn(ANIM.FADE_IN, 26, 15, 46);
  }

  _makeBackButton(W, H) {
    const btn = this.add.text(24, 44, '← Назад', {
      fontFamily: 'Georgia, serif',
      fontSize:   '16px',
      color:      '#A8C5DA',
    }).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#E8956D'));
    btn.on('pointerout',  () => btn.setColor('#A8C5DA'));
    btn.on('pointerup', () => {
      this.cameras.main.fadeOut(ANIM.FADE_OUT, 26, 15, 46);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
      });
    });
  }

  _makeHeader(W, H) {
    this.add.text(W / 2, 56, 'Уютная лавка', {
      fontFamily: 'Georgia, serif',
      fontSize:   '26px',
      fontStyle:  'italic',
      color:      '#FFD166',
      align:      'center',
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 96, 'Только украшения. Сюжет остаётся с вами — целиком.\nБез pay-to-win.', {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#9E8A7A',
      align:      'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
  }

  /**
   * @returns {number} следующая Y под карточку
   */
  _makeProductCard(W, startY, product) {
    const pad = 20;
    const cardH = 68;
    const cardW = W - pad * 2;
    const g = this.add.graphics();
    g.fillStyle(COLORS.BG_WARM, 0.92);
    g.lineStyle(1, COLORS.CARD_BORDER, 0.9);
    g.fillRoundedRect(pad, startY, cardW, cardH, 10);
    g.strokeRoundedRect(pad, startY, cardW, cardH, 10);

    const grants = product.grants || [product.id];
    const allOwned = grants.every((id) => GameState.hasEntitlement(id));
    const someOwned = grants.some((id) => GameState.hasEntitlement(id));

    this.add.text(pad + 14, startY + 10, product.title, {
      fontFamily: 'Georgia, serif',
      fontSize:   '16px',
      color:      '#3D2B1F',
      fontStyle:  'bold',
    });

    this.add.text(pad + 14, startY + 30, product.description, {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      color:      '#6B4226',
      wordWrap:   { width: cardW - 120 },
      lineSpacing: 0,
    });

    this.add.text(pad + cardW - 14, startY + 12, product.priceLabel, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#E8956D',
      fontStyle:  'bold',
    }).setOrigin(1, 0);

    let statusText = '';
    if (allOwned) statusText = 'У вас есть';
    else if (someOwned) statusText = 'Частично';
    if (statusText) {
      this.add.text(pad + cardW - 14, startY + 34, statusText, {
        fontFamily: 'Georgia, serif',
        fontSize:   '11px',
        color:      '#6895B2',
      }).setOrigin(1, 0);
    }

    const btnLabel = allOwned ? 'Спасибо!' : 'Поддержать проект';
    const payBtn = this.add.text(pad + cardW / 2, startY + 52, btnLabel, {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      allOwned ? '#9E8A7A' : '#FFFFFF',
      fontStyle:  'bold',
    }).setOrigin(0.5);

    if (!allOwned) {
      payBtn.setInteractive({ useHandCursor: true });
      payBtn.on('pointerover', () => payBtn.setColor('#FFF8EE'));
      payBtn.on('pointerout',  () => payBtn.setColor('#FFFFFF'));
      payBtn.on('pointerup', () => this._onPurchaseClick(product));
    }

    return startY + cardH + 6;
  }

  _onPurchaseClick(product) {
    if (window.Analytics) {
      window.Analytics.trackShopItemView(product.id);
      window.Analytics.trackPurchaseIntent(product.id);
    }

    const base = MONETIZATION.CHECKOUT_BASE_URL;
    if (base && /^https?:\/\//i.test(base.trim())) {
      const url = `${base.trim().replace(/\/$/, '')}?product=${encodeURIComponent(product.id)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      GameState.addPurchaseReceipt({
        productId:       product.id,
        transactionRef:  'checkout_opened',
        platform:        'web',
        note:            'client_opened_checkout',
      });
      return;
    }

    window.alert(
      'Платёжная ссылка ещё не настроена.\n' +
      'Укажите MONETIZATION.CHECKOUT_BASE_URL в js/config.js (Stripe, Paddle и т.д.).'
    );
  }

  _makeLegalFooter(W, H) {
    const y = H - 52;
    const { OFFER_URL, PRIVACY_URL, TERMS_URL } = MONETIZATION.LEGAL;

    const mk = (label, url, x) => {
      const t = this.add.text(x, y, label, {
        fontFamily: 'Georgia, serif',
        fontSize:   '11px',
        color:      '#5E4A6A',
      }).setOrigin(0.5, 0);

      if (url && url !== '#') {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerup', () => window.open(url, '_blank', 'noopener,noreferrer'));
        t.on('pointerover', () => t.setColor('#A8C5DA'));
        t.on('pointerout',  () => t.setColor('#5E4A6A'));
      }
    };

    mk('Оферта',      OFFER_URL,    W * 0.22);
    mk('Конфиденциальность', PRIVACY_URL, W * 0.5);
    mk('Условия',     TERMS_URL,    W * 0.78);

    this.add.text(W / 2, H - 22, 'Оплата на стороне партёра; чек приходит на email.', {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      color:      '#5E4A6A',
      alpha:      0.85,
    }).setOrigin(0.5, 0);
  }

  /**
   * Панель выдачи для QA (?shopdebug=1). Возвращает Y, с которого начинать список товаров.
   */
  _makeDebugPanel(W, topY) {
    const boxH = 72;
    this.add.rectangle(W / 2, topY + boxH / 2, W - 24, boxH, 0x2D1B4E, 0.9).setStrokeStyle(1, 0x7B5EA7);

    this.add.text(W / 2, topY + 8, 'Отладка лавки (shopdebug=1)', {
      fontFamily: 'monospace',
      fontSize:   '9px',
      color:      '#D4C9EE',
    }).setOrigin(0.5, 0);

    const test = this.add.text(W / 2, topY + 28, 'Выдать все предметы (тест)', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#FFD166',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    test.on('pointerup', () => {
      SHOP_CATALOG.forEach((p) => {
        (p.grants || []).forEach((gid) => {
          GameState.grantEntitlement(gid, 'debug');
        });
      });
      GameState.addPurchaseReceipt({
        productId: null,
        transactionRef: 'debug_grant_all',
        platform: 'debug',
        note: 'shopdebug',
      });
      this.scene.restart();
    });

    const clear = this.add.text(W / 2, topY + 50, 'Сбросить косметику', {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#E8956D',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    clear.on('pointerup', () => {
      GameState.getEntitlementIds().forEach((id) => GameState.revokeEntitlement(id));
      this.scene.restart();
    });

    return topY + boxH + 12;
  }
}
