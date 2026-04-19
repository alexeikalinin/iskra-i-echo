/**
 * Analytics.js — Базовая аналитика событий «Искра и Эхо»
 *
 * Сейчас: лог в консоль + CustomEvent «iskra-analytics» для подключения GA4/Matomo позже.
 * Не собирает персональные данные; при расширении — согласовать с политикой конфиденциальности.
 */

class AnalyticsClass {
  constructor() {
    this._sessionStart = Date.now();
    this._sessionId =
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * @param {string} name
   * @param {Record<string, unknown>} [props]
   */
  track(name, props = {}) {
    const payload = {
      name,
      ts:       Date.now(),
      sessionId: this._sessionId,
      distribution: typeof DISTRIBUTION !== 'undefined' ? DISTRIBUTION.CHANNEL : 'unknown',
      ...props,
    };
    console.log('[Analytics]', name, payload);
    try {
      window.dispatchEvent(new CustomEvent('iskra-analytics', { detail: payload }));
    } catch (e) {
      /* ignore */
    }
  }

  /** Первая точка после загрузки сохранения (BootScene) */
  trackAppBoot() {
    const firstVisit = typeof GameState !== 'undefined' && GameState.isFirstVisit();
    const chapter    = typeof GameState !== 'undefined' ? GameState.get('story.currentChapter') : null;
    const postUnlocked = typeof GameState !== 'undefined' ? GameState.get('postGame.unlocked') : null;
    this.track('app_boot', {
      firstVisit,
      chapter,
      postGameUnlocked: postUnlocked,
    });
  }

  /** Начало игровой сессии в браузере */
  trackSessionStart() {
    this.track('session_start', { elapsedSetupMs: Date.now() - this._sessionStart });
  }

  /** Разблокирован пост-гейм (глава 15 завершена) */
  trackPostGameUnlocked() {
    this.track('postgame_unlocked', {});
  }

  /** Открыта уютная лавка */
  trackShopOpen() {
    this.track('shop_open', {});
  }

  /** Просмотр товара (опционально) */
  trackShopItemView(productId) {
    this.track('shop_item_view', { productId });
  }

  /** Намерение оплатить (клик по оплате на вебе) */
  trackPurchaseIntent(productId) {
    this.track('purchase_intent', { productId });
  }

  /** Выдан entitlement (после покупки или теста) */
  trackEntitlementGranted(productId, entitlementId) {
    this.track('entitlement_granted', { productId, entitlementId });
  }
}

window.Analytics = new AnalyticsClass();
