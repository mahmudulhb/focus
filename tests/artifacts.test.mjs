import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { RESOURCE_TYPES } from '../scripts/lib/compile.mjs';
import '../src/shared/config.js';
import '../src/content/cosmetic-data.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

test('manifest references files that exist', () => {
  for (const path of [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ]) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  }

  for (const script of manifest.content_scripts) {
    for (const file of script.js) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} is missing`);
    }
    for (const file of script.css || []) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} is missing`);
    }
  }
});

test('every declared ruleset is valid DNR JSON', () => {
  const resources = manifest.declarative_net_request.rule_resources;
  assert.ok(resources.length >= 2);

  for (const resource of resources) {
    assert.ok(existsSync(new URL(`../${resource.path}`, import.meta.url)));
    const rules = readJson(resource.path);
    assert.ok(Array.isArray(rules) && rules.length > 0);
    const ids = new Set();

    for (const rule of rules) {
      assert.equal(typeof rule.id, 'number');
      assert.ok(!ids.has(rule.id), `duplicate rule id ${rule.id}`);
      ids.add(rule.id);
      assert.ok(['block', 'allow'].includes(rule.action.type));
      assert.equal(typeof rule.condition.urlFilter, 'string');
      assert.ok(rule.condition.urlFilter.length > 0);
      assert.ok(Array.isArray(rule.condition.resourceTypes));
      assert.ok(
        rule.condition.resourceTypes.every((type) => RESOURCE_TYPES.includes(type)),
        'unknown resource type',
      );
    }
  }
});

test('the bundled lists keep their documented scope', () => {
  const ads = readJson('rules/ads.json');
  const trackers = readJson('rules/trackers.json');
  assert.ok(ads.length > 20);
  assert.ok(trackers.length > 10);
  assert.ok(
    ads.some((rule) => rule.condition.urlFilter === '||doubleclick.net^'),
    'doubleclick is covered',
  );
  assert.ok(
    ads.some((rule) => rule.condition.urlFilter === '||googlesyndication.com^'),
    'google ad serving is covered',
  );
  assert.ok(
    trackers.some((rule) => rule.condition.urlFilter === '||google-analytics.com^'),
    'google analytics is covered',
  );
});

test('ad and tracker rules never block a top-level navigation', () => {
  // Filtering must never be able to replace a page the person navigated to. A
  // blocked document is indistinguishable from a broken or signed-out site.
  // The gambling ruleset is the single, deliberate exception below.
  for (const path of ['rules/ads.json', 'rules/trackers.json']) {
    for (const rule of readJson(path)) {
      assert.ok(
        !rule.condition.resourceTypes.includes('main_frame'),
        `rule blocks a document: ${rule.condition.urlFilter}`,
      );
    }
  }
});

test('the betting ruleset blocks whole sites and nothing else', () => {
  const rules = readJson('rules/gambling.json');
  assert.ok(rules.length > 40, 'the betting list is populated');

  for (const rule of rules) {
    assert.equal(rule.action.type, 'block');
    assert.equal(rule.priority, 100);
    assert.deepEqual(
      rule.condition.resourceTypes,
      RESOURCE_TYPES,
      `betting rule is not a whole-site block: ${rule.condition.urlFilter}`,
    );
    assert.deepEqual(Object.keys(rule.condition).sort(), ['resourceTypes', 'urlFilter']);
    assert.ok(!/\/|\|\|\*/.test(rule.condition.urlFilter.replace(/^\|\|/, '')), 'domain only');
  }
});

test('the betting list contains known bookmakers and casinos', () => {
  const filters = readJson('rules/gambling.json').map((rule) => rule.condition.urlFilter);
  for (const domain of [
    '||bet365.com^',
    '||betway.com^',
    '||draftkings.com^',
    '||pokerstars.com^',
    '||stake.com^',
    '||1xbet.com^',
  ]) {
    assert.ok(filters.includes(domain), `${domain} is missing`);
  }
});

test('no rule targets an account, login or payment endpoint', () => {
  const forbidden =
    /accounts?\.|\/login|login\.|sign-?in|sign-?up|oauth|checkpoint|password|\/auth|auth\.|checkout|\/pay/i;
  for (const path of ['rules/ads.json', 'rules/trackers.json']) {
    for (const rule of readJson(path)) {
      assert.ok(
        !forbidden.test(rule.condition.urlFilter),
        `rule touches an account endpoint: ${rule.condition.urlFilter}`,
      );
    }
  }
});

test('generated cosmetic data contains safe, non-empty selectors', () => {
  const data = globalThis.FOCUS_COSMETIC;
  assert.equal(data.version, 1);
  assert.ok(data.generic.length > 0);
  assert.ok(Object.keys(data.specific).length > 0);

  const selectors = [
    ...Object.values(data.specific).flat(),
    ...Object.values(data.exceptions).flat(),
    ...data.generic,
  ];
  for (const selector of selectors) {
    assert.equal(typeof selector, 'string');
    assert.ok(selector.length > 0);
    assert.ok(!/[{};\0]/.test(selector), `unsafe selector: ${selector}`);
  }
});

test('the reels permission screen exists and loads in order', () => {
  const page = 'src/welcome/welcome.html';
  const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');

  for (const file of ['src/welcome/welcome.js', 'src/welcome/welcome.css', 'src/ui/base.css']) {
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} is missing`);
  }

  const order = [
    '../shared/config.js',
    '../shared/settings.js',
    '../shared/platforms.js',
    'welcome.js',
  ].map((needle) => html.indexOf(needle));
  assert.ok(order.every((index) => index !== -1), 'the permission page is missing a script');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'scripts load out of order');

  assert.ok(html.includes('id="allow"'), 'the permission page has no approve action');
  assert.ok(html.includes('id="decline"'), 'the permission page has no decline action');
});

test('the reels content script gates on the shared consent check', () => {
  const source = readFileSync(new URL('../src/content/reels.js', import.meta.url), 'utf8');
  assert.ok(
    source.includes('isReelsActive'),
    'reels.js must use FocusSettings.isReelsActive so consent cannot be bypassed',
  );
});

test('the popup and options pages load their scripts in order', () => {
  for (const page of ['src/popup/popup.html', 'src/options/options.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    const configIndex = html.indexOf('../shared/config.js');
    const settingsIndex = html.indexOf('../shared/settings.js');
    assert.ok(configIndex !== -1 && settingsIndex !== -1, `${page} is missing shared scripts`);
    assert.ok(configIndex < settingsIndex, `${page} loads settings before config`);
    assert.ok(html.includes('role="switch"'));
  }
  assert.ok(existsSync(new URL('../src/popup/popup.js', import.meta.url)));
  assert.ok(existsSync(new URL('../src/options/options.js', import.meta.url)));
});
