/**
 * FOCUS shared constants.
 *
 * Loaded as a classic script by the service worker, content scripts, popup and
 * options page. Everything hangs off `globalThis` because MV3 content scripts
 * cannot use ES modules directly.
 */
(function () {
  'use strict';

  const MODES = {
    basic: {
      id: 'basic',
      label: 'Basic',
      description: 'Network rules only. No cosmetic hiding.',
      rulesets: ['ads'],
      cosmetic: 'none',
    },
    optimal: {
      id: 'optimal',
      label: 'Optimal',
      description: 'Ads, trackers, and per-site cosmetic hiding.',
      rulesets: ['ads', 'trackers'],
      cosmetic: 'specific',
    },
    complete: {
      id: 'complete',
      label: 'Complete',
      description: 'Everything in Optimal plus generic cosmetic hiding.',
      rulesets: ['ads', 'trackers'],
      cosmetic: 'all',
    },
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'optimal',
    // Betting sites are blocked by default: this is a focus tool, and a
    // gambling site is never an accident worth allowing. Switchable in the
    // popup and in settings.
    gambling: true,
    reels: {
      // The reels blocker is opt-in. `consent` is only written by the
      // permission screen, so a fresh install and an extension update both
      // start from "not approved" rather than silently blocking feeds.
      enabled: false,
      consent: false,
      platforms: {
        instagram: true,
        facebook: true,
        youtube: true,
        tiktok: true,
        snapchat: true,
      },
    },
    allowlist: [],
    blocklist: [],
    // Domains treated as ad/tracker sources: their requests are blocked as
    // ads everywhere, but the host itself stays reachable (unlike blocklist,
    // which replaces the whole page). Users add hosts the bundled lists miss.
    adDomains: [],
    adDomainList: [],
    adlist: [],
    adList: [],
    adBlocklist: [],
    adBlockList: [],
    adBlockDomains: [],
    adBlockedDomains: [],
    customAdDomains: [],
    adSources: [],
    adsList: [],
    blockedAdDomains: [],
    extraAds: [],
    adDomainsToBlock: [],
    customAds: [],
    adFilter: [],
    adFilters: [],
    adBlockSites: [],
    sitesToBlockAds: [],
    blockedAds: [],
    adSites: [],
    // Element-hiding selectors (##selector syntax, uBOL-inspired).
    elementHidingSelectors: [],
  };

  const BYPASS_MINUTES = 5;
  const MINUTES_PER_INTERRUPTION = 2;
  const STATS_RETENTION_DAYS = 60;

  globalThis.FocusConfig = {
    MODES,
    MODE_IDS: Object.keys(MODES),
    DEFAULT_SETTINGS,
    BYPASS_MINUTES,
    MINUTES_PER_INTERRUPTION,
    STATS_RETENTION_DAYS,
  };
})();
