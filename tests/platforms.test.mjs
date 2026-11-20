import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/shared/platforms.js';

const { find, matchReelUrl, hostMatches, isAuthRoute } = globalThis.FocusPlatforms;

test('matches Instagram reel and reels routes, not profiles', () => {
  assert.equal(matchReelUrl('https://www.instagram.com/reels/abc/').platform.id, 'instagram');
  assert.equal(matchReelUrl('https://www.instagram.com/reel/abc/').platform.id, 'instagram');
  assert.equal(matchReelUrl('https://www.instagram.com/someone/'), null);
  assert.equal(matchReelUrl('https://www.instagram.com/'), null);
});

test('matches YouTube Shorts only', () => {
  assert.equal(matchReelUrl('https://www.youtube.com/shorts/abc').platform.id, 'youtube');
  assert.equal(matchReelUrl('https://m.youtube.com/shorts/abc?feature=share').platform.id, 'youtube');
  assert.equal(matchReelUrl('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(matchReelUrl('https://youtu.be/abc'), null);
});

test('matches Facebook reel routes', () => {
  assert.equal(matchReelUrl('https://www.facebook.com/reel/123').platform.id, 'facebook');
  assert.equal(matchReelUrl('https://www.facebook.com/reels/').platform.id, 'facebook');
  assert.equal(matchReelUrl('https://www.facebook.com/marketplace/'), null);
});

test('matches TikTok feed and video routes but not support pages', () => {
  assert.equal(matchReelUrl('https://www.tiktok.com/').platform.id, 'tiktok');
  assert.equal(matchReelUrl('https://www.tiktok.com/foryou').platform.id, 'tiktok');
  assert.equal(matchReelUrl('https://www.tiktok.com/@someone/video/123').platform.id, 'tiktok');
  assert.equal(matchReelUrl('https://www.tiktok.com/about'), null);
});

test('matches Snapchat Spotlight only', () => {
  assert.equal(matchReelUrl('https://www.snapchat.com/spotlight/abc').platform.id, 'snapchat');
  assert.equal(matchReelUrl('https://www.snapchat.com/add/someone'), null);
});

test('sign-in, recovery and consent routes are recognised', () => {
  for (const url of [
    'https://www.instagram.com/accounts/login/',
    'https://www.instagram.com/accounts/password/reset/',
    'https://www.facebook.com/login.php',
    'https://www.facebook.com/checkpoint/1501092823525282/',
    'https://www.facebook.com/recover/initiate/',
    'https://x.com/i/flow/login',
    'https://www.tiktok.com/login',
    'https://www.youtube.com/oauth2/consent',
    'https://www.snapchat.com/accounts/signup',
  ]) {
    assert.equal(isAuthRoute(url), true, `${url} should be treated as an account screen`);
  }
});

test('reel routes are not mistaken for account screens', () => {
  for (const url of [
    'https://www.instagram.com/reels/abc/',
    'https://www.instagram.com/reel/abc/',
    'https://www.facebook.com/reel/123',
    'https://www.youtube.com/shorts/abc',
    'https://www.tiktok.com/@someone/video/123',
    'https://www.snapchat.com/spotlight/abc',
    'https://www.tiktok.com/@someone/video/login-fails',
  ]) {
    assert.equal(isAuthRoute(url), false, `${url} should stay blockable`);
  }
});

test('host matching respects label boundaries', () => {
  assert.equal(hostMatches('m.instagram.com', 'instagram.com'), true);
  assert.equal(hostMatches('instagram.com', 'instagram.com'), true);
  assert.equal(hostMatches('notinstagram.com', 'instagram.com'), false);
  assert.equal(hostMatches('instagram.com.evil.test', 'instagram.com'), false);
});

test('invalid and non-http URLs are ignored', () => {
  assert.equal(find('not a url'), null);
  assert.equal(matchReelUrl('chrome-extension://abc/reels/'), null);
  assert.equal(matchReelUrl('ftp://instagram.com/reels/'), null);
});

test('the route key includes path and query', () => {
  const match = matchReelUrl('https://www.youtube.com/shorts/abc?feature=share');
  assert.equal(match.key, '/shorts/abc?feature=share');
});
