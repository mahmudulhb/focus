(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    enabled: $('enabled'),
    gambling: $('gambling'),
    reelsEnabled: $('reels-enabled'),
    reelsConsent: $('reels-consent'),
    reelsConsentActions: $('reels-consent-actions'),
    reelsPermission: $('reels-permission'),
    modes: $('modes'),
    platforms: $('platforms'),
    allowlist: $('allowlist'),
    saveAllowlist: $('save-allowlist'),
    allowlistStatus: $('allowlist-status'),
    status: $('status'),
    todayCount: $('today-count'),
    todayMinutes: $('today-minutes'),
    resetStats: $('reset-stats'),
    version: $('version'),
    buildVersion: $('build-version'),
    buildRules: $('build-rules'),
    buildCosmetic: $('build-cosmetic'),
    buildDate: $('build-date'),
  };

  let settings = null;
  let statusTimer = null;
  const format = new Intl.NumberFormat();

  function announce(message, target) {
    const node = target || els.status;
    node.textContent = message;
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      node.textContent = '';
    }, 4500);
  }

  function renderModes() {
    els.modes.replaceChildren();
    for (const mode of Object.values(globalThis.FocusConfig.MODES)) {
      const label = document.createElement('label');
      label.className = 'mode';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'mode';
      input.value = mode.id;
      input.checked = settings.mode === mode.id;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        save({ mode: mode.id });
      });

      const text = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = mode.label;
      const description = document.createElement('span');
      description.textContent = mode.description;
      text.append(title, description);

      label.append(input, text);
      els.modes.appendChild(label);
    }
  }

  function renderPlatforms() {
    els.platforms.replaceChildren();
    for (const platform of globalThis.FocusPlatforms.PLATFORMS) {
      const label = document.createElement('label');
      label.className = 'chip';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(settings.reels.platforms[platform.id]);
      input.addEventListener('change', () => {
        save({
          reels: {
            platforms: { [platform.id]: input.checked },
          },
        });
      });

      label.append(input, document.createTextNode(platform.label));
      els.platforms.appendChild(label);
    }
  }

  function renderSettings() {
    els.enabled.checked = settings.enabled;
    els.gambling.checked = settings.gambling;
    els.reelsEnabled.checked = settings.reels.consent && settings.reels.enabled;
    els.reelsConsent.hidden = settings.reels.consent;
    els.reelsConsentActions.hidden = settings.reels.consent;
    els.allowlist.value = settings.allowlist.join('\n');
  }

  function renderBuild() {
    const build = globalThis.FOCUS_BUILD;
    if (!build) return;
    const rules =
      (build.rules.ads || 0) + (build.rules.trackers || 0) + (build.rules.gambling || 0);
    const cosmetic =
      (build.cosmetic.specificSelectors || 0) + (build.cosmetic.genericSelectors || 0);
    els.version.textContent = `v${build.version}`;
    els.buildVersion.textContent = `v${build.version}`;
    els.buildRules.textContent = `${format.format(rules)} (${format.format(
      build.rules.ads || 0,
    )} ads, ${format.format(build.rules.trackers || 0)} trackers, ${format.format(
      build.rules.gambling || 0,
    )} betting)`;
    els.buildCosmetic.textContent = format.format(cosmetic);
    els.buildDate.textContent = build.generated;
  }

  function openReelsPermission() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome/welcome.html') });
  }

  async function save(patch) {
    try {
      settings = await globalThis.FocusSettings.update(patch);
      // Do not re-render the form here: it would discard an allowlist draft
      // the user has not saved yet. The changed control already shows the value.
      announce('Saved.');
    } catch (error) {
      console.warn('[FOCUS] could not save settings', error);
      announce('Could not save the change.');
    }
  }

  async function loadToday() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'focus:get-today' });
      if (!response || !response.ok || !response.today) return;
      els.todayCount.textContent = format.format(response.today.reelsBlocked);
      els.todayMinutes.textContent = format.format(response.today.minutes);
    } catch {
      /* leave the zeros in place */
    }
  }

  async function saveAllowlist() {
    const tokens = els.allowlist.value
      .split(/[\n,]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const valid = [];
    const invalid = [];
    for (const token of tokens) {
      const domain = globalThis.FocusSettings.normalizeDomain(token);
      if (domain) valid.push(domain);
      else invalid.push(token);
    }

    const unique = [...new Set(valid)];
    try {
      settings = await globalThis.FocusSettings.update({ allowlist: unique });
      els.allowlist.value = settings.allowlist.join('\n');
      announce(
        invalid.length > 0
          ? `Saved ${unique.length}. Ignored: ${invalid.slice(0, 4).join(', ')}`
          : `Saved ${unique.length} allowed site${unique.length === 1 ? '' : 's'}.`,
        els.allowlistStatus,
      );
    } catch (error) {
      console.warn('[FOCUS] could not save allowlist', error);
      announce('Could not save allowed sites.', els.allowlistStatus);
    }
  }

  async function resetStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'focus:reset-today' });
      if (!response || !response.ok || !response.today) throw new Error('reset failed');
      els.todayCount.textContent = '0';
      els.todayMinutes.textContent = '0';
      announce('Today’s count reset.');
    } catch {
      announce('Could not reset the count.');
    }
  }

  async function boot() {
    try {
      settings = await globalThis.FocusSettings.get();
    } catch (error) {
      console.warn('[FOCUS] options boot failed', error);
      els.status.textContent = 'Could not read FOCUS settings.';
      return;
    }

    renderSettings();
    renderModes();
    renderPlatforms();
    renderBuild();
    loadToday();

    els.enabled.addEventListener('change', () => save({ enabled: els.enabled.checked }));
    els.gambling.addEventListener('change', () => save({ gambling: els.gambling.checked }));
    els.reelsEnabled.addEventListener('change', () => {
      if (els.reelsEnabled.checked && !settings.reels.consent) {
        els.reelsEnabled.checked = false;
        announce('Approve the reels blocker first.');
        openReelsPermission();
        return;
      }
      save({ reels: { enabled: els.reelsEnabled.checked } });
    });
    els.reelsPermission.addEventListener('click', openReelsPermission);
    els.saveAllowlist.addEventListener('click', saveAllowlist);
    els.resetStats.addEventListener('click', resetStats);
  }

  boot();
})();
