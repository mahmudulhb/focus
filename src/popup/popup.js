(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    enabled: $('enabled'),
    reels: $('reels'),
    reelsSub: $('reels-sub'),
    gambling: $('gambling'),
    gamblingSub: $('gambling-sub'),
    site: $('site'),
    siteHost: $('site-host'),
    heroTitle: $('hero-title'),
    heroSub: $('hero-sub'),
    todayCount: $('today-count'),
    todayMinutes: $('today-minutes'),
    filterSummary: $('filter-summary'),
    openOptions: $('open-options'),
  };

  let settings = null;
  let host = '';
  let siteAvailable = false;
  let statsTimer = null;

  const format = new Intl.NumberFormat();

  function modeFor(value) {
    return globalThis.FocusConfig.MODES[value] || globalThis.FocusConfig.MODES.optimal;
  }

  function render() {
    if (!settings) return;
    const enabled = settings.enabled;
    const mode = modeFor(settings.mode);
    const platformCount = Object.values(settings.reels.platforms).filter(Boolean).length;
    const pausedHere = siteAvailable && globalThis.FocusSettings.isAllowed(host, settings.allowlist);

    els.enabled.checked = enabled;
    els.reels.checked = settings.reels.enabled;
    els.gambling.checked = settings.gambling;
    els.site.checked = siteAvailable ? !pausedHere : false;
    els.site.disabled = !siteAvailable;
    document.body.classList.toggle('is-off', !enabled);

    els.reelsSub.textContent = !settings.reels.consent
      ? 'Approval needed — tap to review'
      : settings.reels.enabled
        ? `${platformCount} platform${platformCount === 1 ? '' : 's'} covered`
        : 'Short-form feeds are allowed';

    const gamblingCount = globalThis.FOCUS_BUILD?.rules?.gambling || 0;
    els.gamblingSub.textContent = !settings.gambling
      ? 'Betting sites are allowed'
      : `${format.format(gamblingCount)} sites blocked`;

    if (!siteAvailable) {
      els.siteHost.textContent = 'Not available on this page';
      els.siteHost.classList.remove('is-paused');
    } else if (pausedHere) {
      els.siteHost.textContent = `${host} · paused`;
      els.siteHost.classList.add('is-paused');
    } else {
      els.siteHost.textContent = `${host} · active`;
      els.siteHost.classList.remove('is-paused');
    }

    if (!enabled) {
      els.heroTitle.textContent = 'Focus is off';
      els.heroSub.textContent = 'Nothing is being filtered right now.';
    } else if (pausedHere) {
      els.heroTitle.textContent = 'Paused on this site';
      els.heroSub.textContent = `${mode.label} filtering everywhere else.`;
    } else if (!settings.reels.consent) {
      els.heroTitle.textContent = 'Protection is on';
      els.heroSub.textContent = `${mode.label} filtering · reels blocker is waiting for your approval.`;
    } else {
      els.heroTitle.textContent = 'Protection is on';
      els.heroSub.textContent = settings.reels.enabled
        ? `${mode.label} filtering · reels interrupted at the door.`
        : `${mode.label} filtering · reels blocker off.`;
    }

    const build = globalThis.FOCUS_BUILD;
    if (build) {
      const count =
        (build.rules.ads || 0) +
        (build.rules.trackers || 0) +
        (build.rules.gambling || 0);
      els.filterSummary.textContent = `${mode.label} · ${format.format(count)} rules`;
    }
  }

  function openReelsPermission() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome/welcome.html') });
  }

  async function save(patch) {
    try {
      settings = await globalThis.FocusSettings.update(patch);
      render();
    } catch (error) {
      console.warn('[FOCUS] could not save settings', error);
      els.heroSub.textContent = 'Could not save the change. Try again.';
    }
  }

  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'focus:get-today' });
      if (!response || !response.ok || !response.today) return;
      els.todayCount.textContent = format.format(response.today.reelsBlocked);
      els.todayMinutes.textContent = format.format(response.today.minutes);
    } catch {
      /* stats are optional; the controls still work */
    }
  }

  async function boot() {
    try {
      const [loaded, tabs] = await Promise.all([
        globalThis.FocusSettings.get(),
        chrome.tabs.query({ active: true, currentWindow: true }),
      ]);
      settings = loaded;

      const tab = tabs && tabs[0];
      if (tab && tab.url) {
        try {
          const url = new URL(tab.url);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            host = globalThis.FocusSettings.normalizeDomain(url.hostname);
            siteAvailable = Boolean(host);
          }
        } catch {
          siteAvailable = false;
        }
      }
    } catch (error) {
      console.warn('[FOCUS] popup boot failed', error);
      els.heroSub.textContent = 'Could not read FOCUS settings.';
      return;
    }

    render();
    loadStats();

    els.enabled.addEventListener('change', () => save({ enabled: els.enabled.checked }));
    els.reels.addEventListener('change', () => {
      // Turning the blocker on is a permission decision, so it happens on the
      // permission screen rather than in a popup toggle that closes itself.
      if (els.reels.checked && !settings.reels.consent) {
        els.reels.checked = false;
        openReelsPermission();
        return;
      }
      save({ reels: { enabled: els.reels.checked } });
    });
    els.gambling.addEventListener('change', () => save({ gambling: els.gambling.checked }));
    els.site.addEventListener('change', () => {
      if (!siteAvailable) return;
      const allowlist = new Set(settings.allowlist);
      if (els.site.checked) {
        // Enabling here must also clear a parent-domain entry, otherwise the
        // checkbox would appear to do nothing.
        for (const domain of [...allowlist]) {
          if (host === domain || host.endsWith('.' + domain)) allowlist.delete(domain);
        }
      } else {
        allowlist.add(host);
      }
      save({ allowlist: [...allowlist] });
    });
    els.openOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    statsTimer = window.setInterval(loadStats, 5000);
    window.addEventListener('unload', () => {
      if (statsTimer) window.clearInterval(statsTimer);
    });
  }

  boot();
})();
