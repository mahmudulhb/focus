import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const pages = [
  'index.html',
  'extension.html',
  'android.html',
  'faq.html',
  'filters.html',
  'privacy.html',
  'privacy-android.html',
];

function read(page) {
  // Comments describe what to paste in later; they are not loaded or linked.
  return readFileSync(resolve(SITE, page), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
}

test('the site pages and stylesheet exist', () => {
  for (const file of [...pages, 'site.css']) {
    assert.ok(existsSync(resolve(SITE, file)), `site/${file} is missing`);
  }
});

test('the pages load nothing from the network', () => {
  // A privacy page that phones home would be its own counter-example.
  for (const page of pages) {
    const html = read(page);
    assert.ok(!/<script/i.test(html), `${page} must not need JavaScript`);
    assert.ok(!/(?:src|href)\s*=\s*"https?:/i.test(html), `${page} loads a remote resource`);
    // Naming a tracker in the filter list is fine; loading one is not.
    assert.ok(
      !/(?:src|href)\s*=\s*"[^"]*(?:google-analytics|googletagmanager|plausible\.io|gtag)/i.test(
        html,
      ),
      `${page} references an analytics host`,
    );
  }
});

test('every local link resolves to a real file', () => {
  for (const page of pages) {
    const html = read(page);
    const links = [...html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)].map((match) => match[1]);
    for (const link of links) {
      if (link.startsWith('mailto:') || link.startsWith('#')) continue;
      const target = resolve(SITE, link.split('#')[0].split('?')[0]);
      assert.ok(existsSync(target), `${page} links to a missing file: ${link}`);
    }
  }
});

test('the landing page points at the policy', () => {
  assert.ok(read('index.html').includes('privacy.html'));
});

test('every page has one heading and marks the current nav item', () => {
  for (const page of pages) {
    const html = read(page);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${page} needs exactly one h1`);
    assert.equal(
      (html.match(/aria-current=/g) ?? []).length,
      1,
      `${page} marks the wrong number of nav items as current`,
    );
    assert.match(html, /<html lang="en">/, `${page} is missing a language`);
  }
});

test('the FAQ covers both products and answers without JavaScript', () => {
  const html = read('faq.html');
  const answers = (html.match(/<details>/g) ?? []).length;
  assert.ok(answers >= 12, `FAQ has only ${answers} questions`);
  assert.equal((html.match(/<\/details>/g) ?? []).length, answers, 'unclosed <details>');
  assert.ok(html.includes('privacy.html'), 'FAQ must link the extension policy');
  assert.ok(html.includes('privacy-android.html'), 'FAQ must link the app policy');
});

test('the filter page lists exactly the rules that ship', () => {
  // Generated page, hand-edited filters: this is the guard against drift.
  const html = read('filters.html');
  const listed = [...html.matchAll(/<li><code>([^<]+)<\/code><\/li>/g)].map((match) =>
    match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&'),
  );

  const shipped = [];
  for (const list of ['ads', 'trackers', 'gambling']) {
    const text = readFileSync(resolve(SITE, '..', 'src', 'filters', `${list}.txt`), 'utf8');
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('!') || line.startsWith('[')) continue;
      shipped.push(line);
    }
  }

  assert.deepEqual(listed.sort(), shipped.sort(), 'filters.html is out of date — run npm run site:filters');
});

test('the Android policy describes the app it ships with', () => {
  const html = read('privacy-android.html');
  for (const phrase of ['Usage access', 'Display over other apps', 'allowBackup', 'DataStore']) {
    assert.ok(html.includes(phrase), `Android policy omits "${phrase}"`);
  }
  assert.match(html, /no internet permission/i);
});

const policyFacts = [
  'chrome.storage.local',
  'declarativeNetRequest',
  '60 days',
  'remote code',
  'no account',
  'opt-in',
];

test('the policy states the facts the code implements', () => {
  const html = read('privacy.html');
  for (const phrase of policyFacts) {
    assert.ok(html.toLowerCase().includes(phrase.toLowerCase()), `policy omits "${phrase}"`);
  }
});
