import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectFiles, createZip, crc32, manifestReferences } from '../scripts/package.mjs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const files = collectFiles();

test('the archive contains runtime files and nothing else', () => {
  assert.ok(files.includes('manifest.json'));
  assert.ok(files.includes('rules/ads.json'));
  assert.ok(files.includes('src/content/reels.js'));
  assert.ok(files.includes('src/welcome/welcome.html'));
  assert.ok(files.includes('public/icons/icon-128.png'));

  for (const file of files) {
    assert.ok(!file.startsWith('tests/'), `tests must not ship: ${file}`);
    assert.ok(!file.startsWith('scripts/'), `build scripts must not ship: ${file}`);
    assert.ok(!file.startsWith('_metadata/'), `Chrome's local metadata must not ship: ${file}`);
    assert.ok(!file.startsWith('site/'), `the marketing site must not ship: ${file}`);
    assert.ok(!file.startsWith('store/'), `store documents must not ship: ${file}`);
    assert.ok(!file.startsWith('dist/'), `previous archives must not ship: ${file}`);
    assert.ok(!file.endsWith('.txt') || file.startsWith('src/filters/'), `stray text file: ${file}`);
    assert.ok(!file.includes('\\'), 'archive paths use forward slashes');
  }
});

test('every manifest reference is packaged', () => {
  const references = manifestReferences(manifest);
  assert.ok(references.length > 5);
  for (const reference of references) {
    assert.ok(files.includes(reference), `${reference} is referenced but not packaged`);
  }
});

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('the zip has a local header, a central directory and an end record', () => {
  const { buffer, entries } = createZip(files);
  assert.equal(entries, files.length);
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
  assert.equal(buffer.readUInt16LE(buffer.length - 22 + 8), entries);
  assert.ok(buffer.length > 1024);
});
