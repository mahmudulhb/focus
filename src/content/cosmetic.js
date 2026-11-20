/**
 * Applies compiled cosmetic selectors on the current site.
 *
 * Selectors are injected as a single stylesheet rather than queried one by
 * one: it is cheaper and keeps working as the site adds nodes.
 */
(function () {
  'use strict';

  const STYLE_ID = 'focus-cosmetic-style';
  let settings = null;

  function removeStyle() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function selectorsFor(hostname) {
    const data = globalThis.FOCUS_COSMETIC;
    if (!data) return [];

    const parts = hostname.split('.');
    const matched = [];
    const excluded = new Set();

    for (let index = 0; index < parts.length - 1; index += 1) {
      const domain = parts.slice(index).join('.');
      if (Array.isArray(data.specific[domain])) matched.push(...data.specific[domain]);
      if (Array.isArray(data.exceptions[domain])) {
        for (const selector of data.exceptions[domain]) excluded.add(selector);
      }
    }
    if (Array.isArray(data.exceptions['*'])) {
      for (const selector of data.exceptions['*']) excluded.add(selector);
    }
    if (settings && settings.mode === 'complete' && Array.isArray(data.generic)) {
      matched.push(...data.generic);
    }

    return [...new Set(matched)].filter((selector) => !excluded.has(selector));
  }

  function apply() {
    const hostname = location.hostname;
    if (!settings || !hostname) {
      removeStyle();
      return;
    }

    const mode = globalThis.FocusConfig.MODES[settings.mode];
    const cosmeticMode = mode ? mode.cosmetic : 'none';
    if (
      !settings.enabled ||
      cosmeticMode === 'none' ||
      globalThis.FocusSettings.isAllowed(hostname, settings.allowlist)
    ) {
      removeStyle();
      return;
    }

    const selectors = selectorsFor(hostname);
    if (selectors.length === 0) {
      removeStyle();
      return;
    }

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = selectors.map((selector) => `${selector}{display:none !important}`).join('\n');
  }

  async function boot() {
    try {
      settings = await globalThis.FocusSettings.get();
      apply();
    } catch (error) {
      console.warn('[FOCUS] cosmetic boot failed', error);
    }

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

  boot();
})();
