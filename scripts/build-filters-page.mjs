/**
 * Renders site/filters.html from the three filter lists that actually ship.
 *
 * The page is generated rather than hand-written because it lists every rule:
 * the only honest version of "this is what it blocks" is the file the build
 * compiles. Run `npm run site:filters` after editing `src/filters/*.txt`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFilterList } from './lib/compile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const LISTS = [
  {
    id: 'ads',
    title: 'Ads',
    blurb:
      'Ad servers, exchanges, supply-side platforms and ad paths. Compiles to declarative rules the browser enforces.',
    anchor: 'ads',
  },
  {
    id: 'trackers',
    title: 'Trackers',
    blurb:
      'Analytics, attribution and ad-verification endpoints. Blocking these costs some sites their dashboards — the trade is deliberate.',
    anchor: 'trackers',
  },
  {
    id: 'gambling',
    title: 'Betting sites',
    blurb:
      'Sportsbooks, casinos and poker rooms, blocked as whole sites. This is the only list allowed to block a top-level navigation.',
    anchor: 'betting',
  },
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isCosmetic = (line) => line.includes('##') || line.includes('#@#');

/** Splits a filter file into the `! --- title ---` groups it is organised in. */
function readSections(relativePath) {
  const text = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const sections = [];
  let current = { title: null, lines: [] };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('! ---')) {
      if (current.lines.length > 0) sections.push(current);
      current = { title: line.replace(/^!\s*-+\s*/, '').replace(/\s*-+$/, ''), lines: [] };
      continue;
    }
    if (line.startsWith('!') || line.startsWith('[')) continue;
    current.lines.push(line);
  }
  if (current.lines.length > 0) sections.push(current);
  return { text, sections };
}

const stats = [];
const bodies = [];

for (const list of LISTS) {
  const relative = `src/filters/${list.id}.txt`;
  const { text, sections } = readSections(relative);

  const networkLines = sections.flatMap((s) => s.lines).filter((line) => !isCosmetic(line));
  const cosmeticLines = sections.flatMap((s) => s.lines).filter(isCosmetic);

  // Guard against the page and the compiler disagreeing about what ships.
  const compiled = compileFilterList(text, { source: list.id });
  if (compiled.rules.length !== networkLines.length) {
    throw new Error(
      `${list.id}: ${networkLines.length} network rules in the file but ${compiled.rules.length} compiled`,
    );
  }
  if (compiled.skipped.length > 0) {
    throw new Error(
      `${list.id}: ${compiled.skipped.length} rule(s) are skipped by the compiler: ` +
        compiled.skipped.map((item) => item.line).join(', '),
    );
  }

  stats.push({ id: list.id, network: networkLines.length, cosmetic: cosmeticLines.length });

  const groups = sections
    .map((section) => {
      const items = section.lines
        .map((line) => `            <li><code>${escapeHtml(line)}</code></li>`)
        .join('\n');
      const heading = section.title
        ? `          <h3>${escapeHtml(section.title)}</h3>\n`
        : '';
      return `        <section class="rule-group">\n${heading}          <ul class="rule-list">\n${items}\n          </ul>\n        </section>`;
    })
    .join('\n');

  const summary =
    cosmeticLines.length > 0
      ? `${networkLines.length} network rules · ${cosmeticLines.length} cosmetic selectors`
      : `${networkLines.length} rules`;

  bodies.push(`        <h2 id="${list.anchor}">${list.title} <span class="count">${summary}</span></h2>
        <p>${escapeHtml(list.blurb)}</p>
        <div class="rules">
${groups}
        </div>`);
}

const totals = {
  ads: stats.find((s) => s.id === 'ads'),
  trackers: stats.find((s) => s.id === 'trackers'),
  gambling: stats.find((s) => s.id === 'gambling'),
};

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FOCUS — the full filter list</title>
    <meta
      name="description"
      content="Every ad, tracker and betting rule that ships inside the FOCUS extension, generated from the same text files the build compiles. Nothing is downloaded at runtime."
    />
    <link rel="stylesheet" href="site.css" />
    <link rel="icon" href="../public/icons/icon-48.png" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="wrap">
      <header class="top">
        <a class="brand" href="index.html">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r="8"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-dasharray="42 8"
              transform="rotate(-45 12 12)"
            />
            <circle cx="12" cy="12" r="2.3" fill="#ff7a59" />
          </svg>
          <span>FOCUS</span>
        </a>
        <nav class="top-links" aria-label="Site">
          <a href="index.html">Home</a>
          <a href="extension.html">Extension</a>
          <a href="android.html">Android</a>
          <a href="faq.html">FAQ</a>
          <a href="filters.html" aria-current="page">Filters</a>
          <a href="privacy.html">Privacy</a>
        </nav>
      </header>

      <main id="main">
        <p class="eyebrow">Transparency</p>
        <h1>Everything it blocks, in the open.</h1>
        <p class="lede">
          No mystery blocklist, no remote subscription that changes overnight. These are the exact
          rules inside the extension, grouped the way they appear in the source files.
        </p>

        <div class="cards">
          <article class="card">
            <span class="tag">Ads</span>
            <h3>${totals.ads.network} network rules</h3>
            <p>Plus ${totals.ads.cosmetic} cosmetic selectors that hide ad slots the network rules cannot reach.</p>
          </article>
          <article class="card">
            <span class="tag">Trackers</span>
            <h3>${totals.trackers.network} rules</h3>
            <p>Analytics, attribution and verification endpoints, blocked the same way.</p>
          </article>
          <article class="card">
            <span class="tag">Betting</span>
            <h3>${totals.gambling.network} sites</h3>
            <p>Whole domains, marked <code>$all</code> so a top-level navigation is blocked too.</p>
          </article>
        </div>

        <div class="panel">
          <p>
            Every entry below ships in <code>src/filters/</code> as plain text and is compiled at
            build time into declarative rules. The extension downloads nothing at runtime — if a
            domain is not on this page, this version does not block it.
          </p>
          <p class="fineprint">
            Syntax is a conservative subset of uBlock Origin filters: <code>||domain^</code> blocks a
            domain and its subdomains, <code>domain##selector</code> hides matching elements on that
            site, and <code>$all</code> extends a rule to the document itself.
          </p>
        </div>

${bodies.join('\n\n')}

        <h2>What is deliberately not here</h2>
        <div class="panel">
          <ul class="plain">
            <li>No account, login, recovery or payment endpoint is ever blocked.</li>
            <li>No general-purpose CDN — sites need those assets to render at all.</li>
            <li>No regular expressions, scriptlets or procedural filters; the compiler rejects them.</li>
            <li>No first-party path rule on a host people need, unless it is an ad path.</li>
          </ul>
        </div>

        <p class="legal-note">
          Generated from the shipped lists, so this page cannot drift from what the build compiles.
          See <a href="extension.html">how the extension works</a> or
          <a href="faq.html">the FAQ</a> for why a particular site is or is not covered.
        </p>
      </main>

      <footer>
        <span>FOCUS · v0.4.0 extension</span>
        <span>
          <a href="privacy.html">Extension privacy</a> ·
          <a href="privacy-android.html">App privacy</a> ·
          <a href="mailto:bappy@mahmudulhb.me">Contact</a>
        </span>
      </footer>
    </div>
  </body>
</html>
`;

writeFileSync(resolve(ROOT, 'site/filters.html'), html);
console.log(
  `site/filters.html written — ads ${totals.ads.network} network + ${totals.ads.cosmetic} cosmetic, ` +
    `trackers ${totals.trackers.network}, betting ${totals.gambling.network}`,
);
