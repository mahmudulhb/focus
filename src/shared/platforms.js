/**
 * Platform definitions for the reels blocker.
 *
 * URL matching is pure so it can be unit tested in Node. DOM selectors for
 * hiding reels entry points live in `src/content/reels.css`; keeping them
 * there lets the browser apply them before the first paint.
 */
(function () {
  'use strict';

  const PLATFORMS = [
    {
      id: 'instagram',
      label: 'Instagram',
      hosts: ['instagram.com'],
      safeUrl: 'https://www.instagram.com/',
      leaveLabel: 'Back to feed',
      route: /^\/reels?(?:\/|$)/,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      hosts: ['facebook.com'],
      safeUrl: 'https://www.facebook.com/',
      leaveLabel: 'Back to feed',
      route: /^\/reels?(?:\/|$)/,
    },
    {
      id: 'youtube',
      label: 'YouTube',
      hosts: ['youtube.com'],
      safeUrl: 'https://www.youtube.com/',
      leaveLabel: 'Back to YouTube',
      route: /^\/shorts(?:\/|$)/,
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      hosts: ['tiktok.com'],
      safeUrl: null,
      leaveLabel: 'Leave TikTok',
      route: /^(?:\/$|\/foryou(?:\/|$)|\/explore(?:\/|$)|\/@[^/]+\/video\/)/,
    },
    {
      id: 'snapchat',
      label: 'Snapchat',
      hosts: ['snapchat.com'],
      safeUrl: 'https://www.snapchat.com/',
      leaveLabel: 'Back to Snapchat',
      route: /^\/spotlight(?:\/|$)/,
    },
  ];

  /**
   * Sign-in, recovery and consent routes. FOCUS must never stand between a
   * person and their account, so these are exempt from reels blocking even when
   * they sit under a blocked route prefix.
   */
  const AUTH_ROUTE =
    /(?:^|\/)(?:accounts?|auth|oauth|authorize|login|signin|sign-in|signup|sign-up|register|recover|password|checkpoint|challenge|2fa|two-factor|session|consent|logout)(?:\/|\.php|$)/i;

  function hostMatches(hostname, domain) {
    const host = String(hostname || '').toLowerCase();
    return host === domain || host.endsWith('.' + domain);
  }

  function find(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    return PLATFORMS.find((platform) => platform.hosts.some((d) => hostMatches(host, d))) || null;
  }

  function isAuthRoute(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return AUTH_ROUTE.test(url.pathname);
  }

  function matchReelUrl(urlString) {
    const platform = find(urlString);
    if (!platform) return null;
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return null;
    }
    if (!platform.route.test(url.pathname)) return null;
    return {
      platform,
      key: url.pathname + url.search,
    };
  }

  globalThis.FocusPlatforms = {
    PLATFORMS,
    find,
    matchReelUrl,
    hostMatches,
    isAuthRoute,
  };
})();
