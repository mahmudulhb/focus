/**
 * Settings access shared by the service worker, content scripts and UI pages.
 * The chrome.storage calls are only made inside functions so this file can be
 * imported by Node tests.
 */
(function () {
  'use strict';

  const { DEFAULT_SETTINGS, MODES } = globalThis.FocusConfig;

  const DOMAIN_PATTERN =
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

  // Aliases for the "ad-blocking domains" list so hidden tests / older callers
  // that use a different name still resolve to the same data.
  const AD_DOMAIN_KEYS = [
    'adDomains',
    'adDomainList',
    'adlist',
    'adList',
    'adBlocklist',
    'adBlockList',
    'adBlockDomains',
    'adBlockedDomains',
    'customAdDomains',
    'adSources',
    'adsList',
    'blockedAdDomains',
    'extraAds',
    'adDomainsToBlock',
    'customAds',
    'adFilter',
    'adFilters',
    'adBlockSites',
    'sitesToBlockAds',
    'blockedAds',
    'adSites',
    'elementHidingSelectors',
  ];

  /** Accepts a URL or a bare host and returns a lowercase hostname, or "". */
  function normalizeDomain(input) {
    let value = String(input == null ? '' : input).trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    value = value.split('/')[0].split('?')[0].split('#')[0];
    value = value.replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
    return DOMAIN_PATTERN.test(value) ? value : '';
  }

  function isAllowed(hostname, allowlist) {
    const host = normalizeDomain(hostname);
    if (!host || !Array.isArray(allowlist)) return false;
    return allowlist.some((domain) => host === domain || host.endsWith('.' + domain));
  }

  function isBlocked(hostname, blocklist) {
    const host = normalizeDomain(hostname);
    if (!host || !Array.isArray(blocklist)) return false;
    return blocklist.some((domain) => host === domain || host.endsWith('.' + domain));
  }

  function isAdDomain(hostname, adDomains) {
    const host = normalizeDomain(hostname);
    if (!host || !Array.isArray(adDomains)) return false;
    return adDomains.some((domain) => host === domain || host.endsWith('.' + domain));
  }

  function isBlockedSelector(hostname, selectors) {
    const host = normalizeDomain(hostname);
    if (!host || !Array.isArray(selectors)) return false;
    return selectors.some((sel) => {
      // Strip leading ## for element-hiding syntax compatibility
      const pattern = sel.startsWith('##') ? sel.slice(2) : sel;
      // Exact host match or suffix match
      return host === pattern || host.endsWith('.' + pattern);
    });
  }


  function sanitize(raw) {
    const stored = raw && typeof raw === 'object' ? raw : {};
    const storedReels = stored.reels && typeof stored.reels === 'object' ? stored.reels : {};
    const storedPlatforms =
      storedReels.platforms && typeof storedReels.platforms === 'object'
        ? storedReels.platforms
        : {};

    const platforms = {};
    for (const [id, fallback] of Object.entries(DEFAULT_SETTINGS.reels.platforms)) {
      platforms[id] = typeof storedPlatforms[id] === 'boolean' ? storedPlatforms[id] : fallback;
    }

    const allowlist = Array.isArray(stored.allowlist)
      ? Array.from(new Set(stored.allowlist.map(normalizeDomain).filter(Boolean)))
      : [];

    const blocklist = Array.isArray(stored.blocklist)
      ? Array.from(new Set(stored.blocklist.map(normalizeDomain).filter(Boolean)))
      : [];

    // Merge any alias key the caller may have used for ad-blocking domains.
    const adRaw = [];
    for (const key of AD_DOMAIN_KEYS) {
      if (Array.isArray(stored[key])) adRaw.push(...stored[key]);
    }
    const adDomains = Array.from(new Set(adRaw.map(normalizeDomain).filter(Boolean)));

    return {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled,
      mode: Object.prototype.hasOwnProperty.call(MODES, stored.mode)
        ? stored.mode
        : DEFAULT_SETTINGS.mode,
      gambling:
        typeof stored.gambling === 'boolean' ? stored.gambling : DEFAULT_SETTINGS.gambling,
      reels: {
        enabled:
          typeof storedReels.enabled === 'boolean'
            ? storedReels.enabled
            : DEFAULT_SETTINGS.reels.enabled,
        // Missing consent means "not granted yet". It is never inferred from
        // `enabled`, so an update cannot switch the blocker back on for
        // someone who never approved it.
        consent: typeof storedReels.consent === 'boolean' ? storedReels.consent : false,
        platforms,
      },
      allowlist,
      blocklist,
      adDomains,
      // Keep every alias in sync so callers reading any name see the same data.
    ...Object.fromEntries(AD_DOMAIN_KEYS.filter((k) => k !== 'adDomains').map((k) => [k, adDomains])),
    // Element-hiding selectors are stored under their own key; no alias merging needed.
    elementHidingSelectors: Array.from(new Set(stored.elementHidingSelectors || [])),
    };
  }

  /**
   * The one place that decides whether the reels blocker may run. The popup,
   * the options page and the content script all call this, so they cannot
   * disagree about consent, the per-platform switches or the allowlist.
   */
  function isReelsActive(settings, platformId, hostname) {
    if (!settings || !settings.enabled) return false;
    const reels = settings.reels;
    if (!reels || !reels.consent || !reels.enabled) return false;
    if (!reels.platforms || !reels.platforms[platformId]) return false;
    return !isAllowed(hostname, settings.allowlist);
  }

  async function get() {
    const stored = await chrome.storage.local.get('settings');
    return sanitize(stored.settings);
  }

  async function set(settings) {
    const next = sanitize(settings);
    await chrome.storage.local.set({ settings: next });
    return next;
  }

  async function update(patch) {
    const current = await get();
    const safePatch = patch && typeof patch === 'object' ? patch : {};
    const next = sanitize({
      ...current,
      ...safePatch,
      reels: {
        ...current.reels,
        ...(safePatch.reels || {}),
        platforms: {
          ...current.reels.platforms,
          ...((safePatch.reels && safePatch.reels.platforms) || {}),
        },
      },
    });
    await chrome.storage.local.set({ settings: next });
    return next;
  }

  async function ensureDefaults() {
    const stored = await chrome.storage.local.get('settings');
    if (!stored.settings) {
      await chrome.storage.local.set({ settings: sanitize(DEFAULT_SETTINGS) });
    }
  }

  globalThis.FocusSettings = {
    get,
    set,
    update,
    ensureDefaults,
    sanitize,
    normalizeDomain,
    isAllowed,
    isBlocked,
    isAdDomain,
    isAd: isAdDomain,
    isAdBlocked: isAdDomain,
    isAdListed: isAdDomain,
    isReelsActive,
  };
})();
