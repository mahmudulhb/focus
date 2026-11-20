(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    title: $('title'),
    lede: $('lede'),
    platforms: $('platforms'),
    actions: $('actions'),
    done: $('done'),
    allow: $('allow'),
    decline: $('decline'),
    close: $('close'),
    openOptions: $('open-options'),
    status: $('status'),
    version: $('version'),
  };

  const ROUTES = {
    instagram: 'Reels routes and reel links in the feed',
    facebook: 'Reels routes and Reels navigation',
    youtube: 'Shorts routes, shelves and Shorts links',
    tiktok: 'For You, Explore and video routes',
    snapchat: 'Spotlight routes and links',
  };

  let settings = null;

  function renderPlatforms() {
    els.platforms.replaceChildren();
    for (const platform of globalThis.FocusPlatforms.PLATFORMS) {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = platform.label;
      const detail = document.createElement('span');
      detail.textContent = ` — ${ROUTES[platform.id] || 'short-form routes'}`;
      item.append(name, detail);
      els.platforms.appendChild(item);
    }
  }

  function showStatus(message) {
    els.status.textContent = message;
  }

  function showEnabledState() {
    els.title.textContent = 'Reels blocker is on.';
    els.lede.textContent =
      'It stands down on sign-in and account screens, and a five-minute pass is always available from the pause screen.';
    els.actions.hidden = true;
    els.done.hidden = false;
    showStatus('Saved. Nothing leaves this browser.');
  }

  function showPendingState() {
    els.title.textContent = 'Reels blocker needs your approval.';
    els.lede.textContent =
      'FOCUS can hide short-form entry points and replace a reel feed with a pause screen. It only does that after you turn it on here.';
    els.actions.hidden = false;
    els.done.hidden = true;
    els.allow.disabled = false;
    els.decline.disabled = false;
    showStatus('');
  }

  async function allow() {
    els.allow.disabled = true;
    els.decline.disabled = true;
    try {
      settings = await globalThis.FocusSettings.update({
        reels: { consent: true, enabled: true },
      });
      showEnabledState();
    } catch (error) {
      console.warn('[FOCUS] could not save reels consent', error);
      els.allow.disabled = false;
      els.decline.disabled = false;
      showStatus('Could not save the approval. Try again.');
    }
  }

  async function decline() {
    try {
      await globalThis.FocusSettings.update({ reels: { consent: false, enabled: false } });
    } catch (error) {
      console.warn('[FOCUS] could not save the decline', error);
    }
    window.close();
  }

  async function boot() {
    renderPlatforms();
    const build = globalThis.FOCUS_BUILD;
    if (build) els.version.textContent = `v${build.version}`;

    try {
      settings = await globalThis.FocusSettings.get();
    } catch (error) {
      console.warn('[FOCUS] welcome boot failed', error);
      showStatus('Could not read FOCUS settings.');
      return;
    }

    if (settings.reels.consent && settings.reels.enabled) {
      showEnabledState();
    } else {
      showPendingState();
    }

    els.allow.addEventListener('click', allow);
    els.decline.addEventListener('click', decline);
    els.close.addEventListener('click', () => window.close());
    els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
  }

  boot();
})();
