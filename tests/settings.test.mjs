import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/shared/config.js';
import '../src/shared/settings.js';
import '../src/shared/stats.js';

const { normalizeDomain, isAllowed, sanitize, isReelsActive } = globalThis.FocusSettings;

const approved = {
  enabled: true,
  reels: {
    consent: true,
    enabled: true,
    platforms: { instagram: true, youtube: true, tiktok: false },
  },
  allowlist: [],
};

test('normalizes hosts and URLs', () => {
  assert.equal(normalizeDomain('https://www.Example.com/path?x=1'), 'example.com');
  assert.equal(normalizeDomain('example.com:443'), 'example.com');
  assert.equal(normalizeDomain('  EXAMPLE.COM  '), 'example.com');
  assert.equal(normalizeDomain('bad domain'), '');
  assert.equal(normalizeDomain(''), '');
  assert.equal(normalizeDomain('localhost'), '');
});

test('allowlist matching covers subdomains, not lookalikes', () => {
  assert.equal(isAllowed('m.instagram.com', ['instagram.com']), true);
  assert.equal(isAllowed('instagram.com', ['instagram.com']), true);
  assert.equal(isAllowed('notinstagram.com', ['instagram.com']), false);
  assert.equal(isAllowed('instagram.com', []), false);
});

test('sanitize repairs stored settings instead of trusting them', () => {
  const settings = sanitize({
    enabled: 'yes',
    mode: 'nonsense',
    allowlist: ['www.Example.com', 'bad domain', 'example.com'],
    reels: { platforms: { youtube: false } },
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.mode, 'optimal');
  assert.deepEqual(settings.allowlist, ['example.com']);
  // Missing values fall back to the shipped defaults: reels blocking is
  // opt-in, so both flags start off until the permission screen sets them.
  assert.equal(settings.reels.enabled, false);
  assert.equal(settings.reels.consent, false);
  assert.equal(settings.reels.platforms.youtube, false);
  assert.equal(settings.reels.platforms.instagram, true);
});

test('sanitize accepts a valid explicit off state', () => {
  const settings = sanitize({ enabled: false, mode: 'complete', reels: { enabled: false } });
  assert.equal(settings.enabled, false);
  assert.equal(settings.mode, 'complete');
  assert.equal(settings.reels.enabled, false);
});

test('betting blocking defaults on and survives a round trip', () => {
  assert.equal(sanitize({}).gambling, true);
  assert.equal(sanitize({ gambling: false }).gambling, false);
  assert.equal(sanitize({ gambling: 'off' }).gambling, true);
});

test('betting blocking is independent of the filtering mode', () => {
  for (const mode of ['basic', 'optimal', 'complete']) {
    assert.equal(sanitize({ mode, gambling: false }).gambling, false);
  }
});

test('the reels blocker is off until it is approved', () => {
  assert.equal(sanitize({}).reels.consent, false);
  assert.equal(sanitize({}).reels.enabled, false);
  assert.equal(isReelsActive(sanitize({}), 'instagram', 'www.instagram.com'), false);
});

test('consent is never inferred from an enabled flag', () => {
  // An update must not switch the blocker back on for someone who never
  // approved it, so stored `enabled: true` alone is not consent.
  const stored = sanitize({ reels: { enabled: true } });
  assert.equal(stored.reels.enabled, true);
  assert.equal(stored.reels.consent, false);
  assert.equal(isReelsActive(stored, 'instagram', 'www.instagram.com'), false);
});

test('non-boolean consent is repaired to "not approved"', () => {
  assert.equal(sanitize({ reels: { consent: 'yes' } }).reels.consent, false);
  assert.equal(sanitize({ reels: { consent: true } }).reels.consent, true);
  assert.equal(sanitize({ reels: { consent: false } }).reels.consent, false);
});

test('approved blocking needs every condition at once', () => {
  assert.equal(isReelsActive(approved, 'instagram', 'www.instagram.com'), true);

  const noConsent = { ...approved, reels: { ...approved.reels, consent: false } };
  assert.equal(isReelsActive(noConsent, 'instagram', 'www.instagram.com'), false);

  const switchedOff = { ...approved, reels: { ...approved.reels, enabled: false } };
  assert.equal(isReelsActive(switchedOff, 'instagram', 'www.instagram.com'), false);

  const masterOff = { ...approved, enabled: false };
  assert.equal(isReelsActive(masterOff, 'instagram', 'www.instagram.com'), false);

  assert.equal(isReelsActive(approved, 'tiktok', 'www.tiktok.com'), false);
  assert.equal(isReelsActive(approved, 'youtube', 'www.youtube.com'), true);
});

test('an allowed site is exempt even when approved', () => {
  const allowed = { ...approved, allowlist: ['instagram.com'] };
  assert.equal(isReelsActive(allowed, 'instagram', 'www.instagram.com'), false);
  assert.equal(isReelsActive(allowed, 'instagram', 'm.instagram.com'), false);
  assert.equal(isReelsActive(allowed, 'youtube', 'www.youtube.com'), true);
});

test('blocklist is sanitized like the allowlist', () => {
  const settings = sanitize({
    blocklist: ['www.Tracker.com', 'bad domain', 'tracker.com'],
  });
  assert.deepEqual(settings.blocklist, ['tracker.com']);
  assert.deepEqual(sanitize({}).blocklist, []);
});

test('isBlocked matches hosts and subdomains, not lookalikes', () => {
  const { isBlocked } = globalThis.FocusSettings;
  assert.equal(isBlocked('ads.example.com', ['example.com']), true);
  assert.equal(isBlocked('example.com', ['example.com']), true);
  assert.equal(isBlocked('notexample.com', ['example.com']), false);
  assert.equal(isBlocked('example.com', []), false);
});

test('ad domains are sanitized and merged from aliases', () => {
  const settings = sanitize({ adlist: ['Ads.Example.com', 'bad', 'ads.example.com'] });
  assert.deepEqual(settings.adDomains, ['ads.example.com']);
  assert.deepEqual(settings.adBlocklist, ['ads.example.com']);
  assert.deepEqual(sanitize({}).adDomains, []);
});

test('isAdDomain matches hosts and subdomains', () => {
  const { isAdDomain, isAdBlocked } = globalThis.FocusSettings;
  assert.equal(isAdDomain('x.ads.example.com', ['ads.example.com']), true);
  assert.equal(isAdBlocked('ads.example.com', ['ads.example.com']), true);
  assert.equal(isAdDomain('notads.example.com', ['ads.example.com']), false);
  assert.equal(isAdDomain('ads.example.com', []), false);
});

test('date keys are local calendar days', () => {
  assert.equal(globalThis.FocusStats.dateKey(new Date(2024, 0, 5, 23, 59)), '2024-01-05');
  assert.equal(globalThis.FocusStats.dateKey(new Date(2026, 10, 19, 0, 0)), '2026-11-19');
});
