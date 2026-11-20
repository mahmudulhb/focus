/**
 * Builds the Chrome Web Store upload archive.
 *
 * Only runtime files go in: the store rejects nothing extra, but shipping
 * tests, build scripts, the local `_metadata/` folder that Chrome writes when
 * loading unpacked, or a README just bloats the package and gives reviewers
 * more to read. No dependencies: this writes a ZIP directly with zlib.
 */
import { deflateRawSync } from 'node:zlib';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Directories (and files) that are development-only. */
export const RUNTIME_ENTRIES = ['manifest.json', 'public', 'rules', 'src'];

const EXCLUDED_NAMES = new Set([
  '_metadata',
  'dist',
  'node_modules',
  'package.json',
  'README.md',
  '.gitignore',
  'tests',
  'scripts',
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Every path the manifest points at. A store upload that references a missing
 * file fails in review, not at build time, so this is checked up front.
 */
export function manifestReferences(manifest) {
  const refs = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value) refs.add(value.replace(/^\//, ''));
  };

  for (const path of Object.values(manifest.icons || {})) add(path);
  for (const path of Object.values((manifest.action && manifest.action.default_icon) || {})) {
    add(path);
  }
  if (manifest.action) add(manifest.action.default_popup);
  if (manifest.options_ui) add(manifest.options_ui.page);
  if (manifest.background) add(manifest.background.service_worker);

  for (const resource of (manifest.declarative_net_request || {}).rule_resources || []) {
    add(resource.path);
  }
  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) add(file);
    for (const file of script.css || []) add(file);
  }
  return [...refs].sort();
}

function walk(dir, root, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, out);
    } else if (entry.isFile()) {
      const rel = relative(root, full).split(sep).join('/');
      if (EXCLUDED_NAMES.has(rel.split('/')[0])) continue;
      out.push(rel);
    }
  }
}

/** Runtime files, sorted so the archive is reproducible. */
export function collectFiles(root = ROOT) {
  const files = [];
  for (const entry of RUNTIME_ENTRIES) {
    const full = resolve(root, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, root, files);
    else files.push(entry);
  }
  return [...new Set(files)].sort();
}

function dosDateTime() {
  // Fixed timestamp (1980-01-01) keeps the archive byte-identical between runs.
  return { time: 0, date: 0x21 };
}

function localHeader(entry) {
  const name = Buffer.from(entry.name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6); // file name is UTF-8
  header.writeUInt16LE(entry.method, 8);
  header.writeUInt16LE(entry.time, 10);
  header.writeUInt16LE(entry.date, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressed.length, 18);
  header.writeUInt32LE(entry.raw.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name]);
}

function centralHeader(entry) {
  const name = Buffer.from(entry.name, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt16LE(entry.time, 12);
  header.writeUInt16LE(entry.date, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressed.length, 20);
  header.writeUInt32LE(entry.raw.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, name]);
}

export function createZip(files, root = ROOT) {
  const { time, date } = dosDateTime();
  const chunks = [];
  const entries = [];
  let offset = 0;

  for (const name of files) {
    const raw = readFileSync(resolve(root, name));
    const deflated = deflateRawSync(raw, { level: 9 });
    const method = deflated.length < raw.length ? 8 : 0;
    const body = method === 8 ? deflated : raw;
    const entry = { name, raw, compressed: body, method, crc: crc32(raw), time, date, offset };
    const header = localHeader(entry);
    chunks.push(header, body);
    offset += header.length + body.length;
    entries.push(entry);
  }

  const central = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = centralHeader(entry);
    central.push(header);
    centralSize += header.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return {
    buffer: Buffer.concat([...chunks, ...central, end]),
    entries: entries.length,
    rawBytes: entries.reduce((total, entry) => total + entry.raw.length, 0),
  };
}

function main() {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8'));
  const files = collectFiles(ROOT);
  const fileSet = new Set(files);

  const missing = manifestReferences(manifest).filter((ref) => !fileSet.has(ref));
  if (missing.length > 0) {
    console.error(`Missing files referenced by the manifest: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!fileSet.has('manifest.json')) {
    console.error('manifest.json is not in the archive');
    process.exit(1);
  }

  const { buffer, entries, rawBytes } = createZip(files, ROOT);
  const outDir = resolve(ROOT, 'dist');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `focus-${manifest.version}.zip`);
  writeFileSync(outPath, buffer);

  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
  console.log(
    `packaged ${entries} files (${kb(rawBytes)} raw → ${kb(buffer.length)}) ` +
      `for v${manifest.version}: ${relative(ROOT, outPath)}`,
  );
  for (const file of files) console.log(`  ${file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
