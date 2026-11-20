/**
 * Reels blocker.
 *
 * CSS hides the entry points before paint (see reels.css). This script handles
 * what CSS cannot: SPA route changes, pausing playback, the interstitial, and
 * the deliberate five-minute pass.
 */
(function () {
  'use strict';

  const BYPASS_MINUTES = globalThis.FocusConfig.BYPASS_MINUTES;
  const platform = globalThis.FocusPlatforms.find(location.href);
  if (!platform) return;

  const PASS_PREFIX = 'focus:pass:';
  const CHECK_INTERVAL_MS = 700;
  const root = document.documentElement;

  /**
   * Whether this document was opened directly on a blocked route. If it was
   * not, the browser's previous history entry is the page the person came
   * from, so "Back to feed" can use it instead of reloading the site.
   */
  const entryWasBlocked = Boolean(globalThis.FocusPlatforms.matchReelUrl(location.href));

  let settings = null;
  let overlay = null;
  let overlayState = null;
  let countedKey = null;
  let checkTimer = null;
  let pauseTimer = null;

  function passKey() {
    return PASS_PREFIX + platform.id;
  }

  function isActive() {
    // Consent-gated: FocusSettings.isReelsActive returns false until the person
    // has approved the blocker on the permission screen.
    return globalThis.FocusSettings.isReelsActive(settings, platform.id, location.hostname);
  }

  function hasPass() {
    let expiry = 0;
    try {
      expiry = Number(sessionStorage.getItem(passKey())) || 0;
    } catch {
      expiry = 0;
    }
    if (expiry > Date.now()) {
      root.setAttribute('data-focus-bypass', '');
      return true;
    }
    if (expiry) {
      try {
        sessionStorage.removeItem(passKey());
      } catch {
        /* storage can be unavailable in private modes */
      }
    }
    root.removeAttribute('data-focus-bypass');
    return false;
  }

  function grantPass() {
    try {
      sessionStorage.setItem(
        passKey(),
        String(Date.now() + BYPASS_MINUTES * 60 * 1000),
      );
    } catch {
      /* the pass simply will not persist if session storage is blocked */
    }
    root.setAttribute('data-focus-bypass', '');
    root.removeAttribute('data-focus-reel-route');
    hideOverlay();
    window.setTimeout(() => {
      if (!isActive()) return;
      root.removeAttribute('data-focus-bypass');
      check();
    }, BYPASS_MINUTES * 60 * 1000 + 250);
  }

  function reportBlocked() {
    chrome.runtime.sendMessage({ type: 'focus:reel-blocked' }).then((response) => {
      if (!response || !response.ok || !response.today || !overlayState) return;
      overlayState.count.textContent = String(response.today.reelsBlocked);
      overlayState.stat.hidden = false;
    }).catch(() => {});
  }

  function pauseVideos() {
    for (const video of document.querySelectorAll('video')) {
      if (!video.paused) {
        try {
          video.pause();
        } catch {
          /* ignore protected media */
        }
      }
    }
  }

  /**
   * A visible password field means this is an account screen, whatever the URL
   * says. FOCUS stays out of the way there: an overlay on a login form is
   * indistinguishable from being signed out, and it can strand someone outside
   * their own account.
   */
  function looksLikeAuthScreen() {
    const field = document.querySelector(
      'input[type="password"], input[autocomplete="current-password"]',
    );
    if (!field) return false;
    // Only a *rendered* password field counts. Login modals are often parked
    // off-screen or display:none in the DOM of a signed-in session, and those
    // must not switch blocking off.
    const box = field.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  const OVERLAY_CSS = `
    :host { all: initial; }
    .scrim {
      position: fixed; inset: 0; display: grid; place-items: center;
      padding: 24px; background: rgba(8, 10, 7, 0.86);
      -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
      color: #eef2e6; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .panel {
      width: min(380px, 100%); box-sizing: border-box; padding: 26px 26px 22px;
      border: 1px solid #2b3427; border-radius: 24px;
      background: radial-gradient(120% 100% at 50% 0%, #1b2118 0%, #111410 62%);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
      text-align: left; animation: focus-rise 320ms cubic-bezier(.2,.7,.3,1) both;
    }
    .top { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .pulse { position: relative; width: 34px; height: 34px; flex: 0 0 auto; }
    .pulse span {
      position: absolute; inset: 0; border-radius: 50%;
      border: 2px solid #d6f36a; opacity: .8;
      animation: focus-breathe 2.8s ease-in-out infinite;
    }
    .pulse::after {
      content: ""; position: absolute; left: 50%; top: 50%; width: 8px; height: 8px;
      margin: -4px 0 0 -4px; border-radius: 50%; background: #ff7a59;
    }
    .eyebrow {
      font-size: 10px; font-weight: 700; letter-spacing: .18em;
      text-transform: uppercase; color: #d6f36a;
    }
    h1 { margin: 0 0 8px; font-size: 25px; line-height: 1.15; letter-spacing: -.02em; }
    .copy { margin: 0 0 18px; font-size: 13.5px; line-height: 1.55; color: #a7b2a0; }
    .stat {
      display: flex; align-items: baseline; gap: 8px; margin: 0 0 20px;
      padding: 12px 14px; border: 1px solid #2b3427; border-radius: 14px;
      background: #161b13; font-size: 12px; color: #a7b2a0;
    }
    .stat[hidden] { display: none; }
    .stat strong { font-size: 20px; color: #d6f36a; font-variant-numeric: tabular-nums; }
    button {
      width: 100%; box-sizing: border-box; border-radius: 13px; padding: 12px 14px;
      font: inherit; font-size: 13.5px; font-weight: 650; cursor: pointer;
      border: 1px solid transparent; transition: transform 120ms ease, background 120ms ease;
    }
    button:active { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid #d6f36a; outline-offset: 2px; }
    .primary { background: #d6f36a; color: #101210; }
    .primary:hover { background: #e2ff86; }
    .ghost { margin-top: 9px; background: transparent; color: #a7b2a0; border-color: #2b3427; }
    .ghost:hover { color: #eef2e6; border-color: #46543f; }
    .foot { margin: 14px 0 0; font-size: 10.5px; line-height: 1.5; color: #87957f; text-align: center; }
    @keyframes focus-breathe {
      0%, 100% { transform: scale(.72); opacity: .35; }
      50% { transform: scale(1); opacity: .95; }
    }
    @keyframes focus-rise {
      from { opacity: 0; transform: translateY(10px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
      .pulse span { animation: none; transform: scale(1); opacity: .8; }
    }
  `;

  function showOverlay(match) {
    if (overlay) return true;

    overlay = document.createElement('div');
    overlay.id = 'focus-reels-blocker';

    const shadow = overlay.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;

    const scrim = makeElement('div', 'scrim');
    const panel = makeElement('section', 'panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'focus-title');

    const top = makeElement('div', 'top');
    const pulse = makeElement('div', 'pulse');
    pulse.appendChild(makeElement('span'));
    const eyebrow = makeElement('p', 'eyebrow', 'FOCUS PAUSE');
    top.append(pulse, eyebrow);

    const title = makeElement('h1', null, 'You’re in the loop.');
    title.id = 'focus-title';
    const copy = makeElement(
      'p',
      'copy',
      'FOCUS stopped this reel feed before it could pull you in. The scroll can wait.',
    );

    const stat = makeElement('p', 'stat');
    stat.hidden = true;
    const count = makeElement('strong', null, '0');
    stat.append(count, document.createTextNode(' loops interrupted today'));

    const primary = makeElement('button', 'primary', platform.leaveLabel);
    primary.type = 'button';
    primary.addEventListener('click', leave);

    const pass = makeElement(
      'button',
      'ghost',
      `Continue for ${BYPASS_MINUTES} minutes`,
    );
    pass.type = 'button';
    pass.addEventListener('click', grantPass);

    const foot = makeElement(
      'p',
      'foot',
      `The ${BYPASS_MINUTES}-minute pass is per tab and expires automatically.`,
    );

    panel.append(top, title, copy, stat, primary, pass, foot);
    scrim.appendChild(panel);
    shadow.append(style, scrim);

    shadow.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        leave();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [primary, pass];
      const current = shadow.activeElement;
      const index = focusables.indexOf(current);
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? index <= 0
          ? focusables.length - 1
          : index - 1
        : index === -1 || index === focusables.length - 1
          ? 0
          : index + 1;
      focusables[nextIndex].focus();
    });

    const previousInert = document.body ? document.body.inert : false;
    const previousOverflow = root.style.overflow;
    if (document.body) document.body.inert = true;
    root.style.overflow = 'hidden';

    overlayState = { shadow, stat, count, previousInert, previousOverflow };
    try {
      root.appendChild(overlay);
    } catch {
      hideOverlay();
      return false;
    }
    panel.tabIndex = -1;
    primary.focus();
    pauseVideos();
    pauseTimer = window.setInterval(pauseVideos, 900);
    reportBlocked();
    countedKey = match.key;
    return true;
  }

  function hideOverlay() {
    if (pauseTimer) {
      window.clearInterval(pauseTimer);
      pauseTimer = null;
    }
    if (!overlay) return;

    overlay.remove();
    overlay = null;
    if (overlayState) {
      if (document.body) document.body.inert = overlayState.previousInert;
      root.style.overflow = overlayState.previousOverflow;
      overlayState = null;
    }
  }

  function leave() {
    hideOverlay();

    // Prefer the site's own history. A blocked route reached from inside the
    // app is one history entry away from the page the person came from, and
    // going back restores that page with the SPA's session, scroll position and
    // in-memory state intact — no reload, no re-boot of the site.
    if (!entryWasBlocked) {
      const before = location.href;
      try {
        history.back();
      } catch {
        fallbackLeave();
        return;
      }
      window.setTimeout(() => {
        // history.back() did nothing (single-entry history): leave deliberately
        // instead of letting the overlay reappear on the next check.
        if (location.href === before) fallbackLeave();
      }, 400);
      return;
    }

    fallbackLeave();
  }

  function fallbackLeave() {
    if (platform.safeUrl) {
      // replace(), never assign(): the blocked route must not stay in history,
      // or Back leads straight into it again and the site reloads in a loop.
      location.replace(platform.safeUrl);
      return;
    }
    if (history.length > 1) {
      history.back();
      return;
    }
    chrome.runtime.sendMessage({ type: 'focus:leave-tab' }).catch(() => {});
  }

  function check() {
    if (!settings || !isActive()) return;

    const match = globalThis.FocusPlatforms.matchReelUrl(location.href);
    if (!match) {
      countedKey = null;
      root.removeAttribute('data-focus-reel-route');
      hideOverlay();
      return;
    }

    // Only paid for on routes that would be blocked: the layout read below is
    // cheap but not free, and most pages never reach this point.
    if (globalThis.FocusPlatforms.isAuthRoute(location.href) || looksLikeAuthScreen()) {
      countedKey = null;
      root.removeAttribute('data-focus-reel-route');
      hideOverlay();
      return;
    }

    if (hasPass()) {
      root.removeAttribute('data-focus-reel-route');
      hideOverlay();
      return;
    }

    if (overlay) {
      root.setAttribute('data-focus-reel-route', '');
      if (countedKey !== match.key) {
        countedKey = match.key;
        reportBlocked();
      }
      return;
    }

    if (showOverlay(match)) {
      root.setAttribute('data-focus-reel-route', '');
    } else {
      // If the interstitial could not mount, do not leave the page in the
      // half-blocked state where every video is invisible.
      root.removeAttribute('data-focus-reel-route');
    }
  }

  function apply() {
    if (!settings) return;
    if (isActive()) {
      root.setAttribute('data-focus-site', platform.id);
    } else {
      root.removeAttribute('data-focus-site');
      root.removeAttribute('data-focus-reel-route');
      hideOverlay();
      return;
    }
    check();
  }

  async function boot() {
    try {
      settings = await globalThis.FocusSettings.get();
    } catch (error) {
      console.warn('[FOCUS] reels boot failed', error);
      return;
    }
    apply();

    checkTimer = window.setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener('popstate', check);
    window.addEventListener('hashchange', check);
    document.addEventListener('yt-navigate-finish', check);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      globalThis.FocusSettings.get()
        .then((next) => {
          settings = next;
          apply();
        })
        .catch(() => {});
    });
  }

  window.addEventListener('pagehide', () => {
    if (checkTimer) window.clearInterval(checkTimer);
    checkTimer = null;
    hideOverlay();
  });

  boot();
})();
