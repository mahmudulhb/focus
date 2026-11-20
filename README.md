# FOCUS

**One focus layer for the browser.**

FOCUS is a Manifest V3 extension that combines two things that usually ship separately:

1. **A declarative content blocker** built the way uBO Lite (uBOL) is built — filter lists
   compiled into static `declarativeNetRequest` rulesets at build time, with cosmetic hiding
   handled by packaged content scripts. No runtime filter engine, no remote rule downloads.
   Ads and trackers on by default, plus a separately switchable blocklist for betting sites.
2. **An opt-in reels blocker** for Instagram Reels, Facebook Reels, YouTube Shorts, TikTok, and
   Snapchat Spotlight — entry points hidden before paint, reel routes replaced with a deliberate
   interstitial, and a five-minute pass when you actually mean it. It does nothing until the
   permission screen is approved.

Both share one settings model, one allowlist, and one local counter. There is no account, no
cloud, and no analytics.

> **Scope note:** this is a Chromium extension (Chrome, Edge, Brave, and other MV3 browsers).
> Firefox and Safari are not targeted or verified. It is also not a drop-in replacement for
> uBlock Origin: the bundled list is curated by hand, not EasyList.

---

## Status

| Area | State |
| --- | --- |
| Build pipeline: filter compiler, generated rulesets and cosmetic data | **Implemented** |
| Declarative filtering: modes, static rulesets, allowlist | **Implemented** |
| User-defined blocked sites (whole-site blocks for any host) | **Implemented** |
| User-defined ad/tracker domains (blocked as ads, site stays reachable) | **Implemented** |
| Element hiding (##selector selectors, uBOL-inspired) | **Implemented** |
| Betting-site blocking (own ruleset, on by default, own switch) | **Implemented (63 sites)** |
| Reels detection, entry-point hiding, interstitial, five-minute pass | **Implemented** |
| Reels permission gate (nothing runs before approval) | **Implemented** |
| Popup, options page, local daily counter and badge | **Implemented** |
| Automated tests for compiler, URL matching, settings and artifacts | **Implemented (46 tests)** |
| Bundled filter coverage | **Curated: 135 ad, 62 tracker and 63 betting rules, 47 site selectors, 10 generic selectors** |
| Full EasyList / regional filter lists | **Not included** |
| Scriptlets, redirect rules, regex filters, procedural cosmetics | **Deliberately skipped** |
| Firefox/Safari build, cloud sync, accounts | **Not implemented** |
| Browser-level verification on a real page | **Not run in this environment** (no Chrome) |

Nothing is faked: unsupported filter syntax is reported and skipped at build time, and the
reels pass/count behaviour is documented below rather than presented as a productivity metric.

---

## Install (unpacked)

Requirements: Node.js 18+ and a Chromium browser 105 or newer.

```bash
cd focus
npm run build          # compiles src/filters/*.txt into rules/*.json + cosmetic data
```

No `npm install` is needed: the build and tests use only Node built-ins.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `focus/` folder.
4. A permission screen opens in a new tab. Ad and tracker filtering is already running; the
   reels blocker stays off until you approve it there.
5. Open the FOCUS popup → **Settings** to choose a mode.

After editing a filter list or a shared module, run `npm run build` and press **Reload** on the
extension card. Content scripts are re-injected on the next page load.

### Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Compiles filter lists, writes `rules/*.json`, `src/content/cosmetic-data.js`, `src/shared/build-info.js` |
| `npm test` | Runs the Node test suite (compiler, URL matching, settings, manifest/artifacts) |
| `npm run verify` | Build followed by the full test suite |
| `npm run package` | Build, then write the Chrome Web Store upload archive to `dist/focus-<version>.zip` |
| `npm run icons` | Regenerates the PNG icon set from `scripts/generate-icons.mjs` |
| `npm run site:filters` | Regenerates `site/filters.html` from `src/filters/*.txt` — run it after editing a list |

---

## Using it

### Popup

- Master switch: pauses all network filtering and cosmetic hiding. The reels blocker also goes
  quiet while this is off.
- **Reels blocker** switch: turns the short-form blocker on or off without touching filtering.
  Until the blocker has been approved once, flipping it opens the permission screen instead of
  switching it on.
- **This site**: removes the current hostname from filtering (adds it to the allowlist) and
  exempts it from the reels blocker. Subdomains are covered by the same entry.
- **Today**: local count of interrupted reel sessions and a rough time estimate.
- Footer shows the active mode and compiled rule count.

### Options

- **Protection** and three filtering modes (below).
- **Reels blocker** per-platform switches.
- **Allowed sites**: one hostname per line. Input is normalised, de-duplicated, and invalid
  entries are reported instead of silently saved.
- **Today**: reset the local count.
- **Build**: version, compiled rule and selector counts, generation date.

### Filtering modes

| Mode | Enabled rulesets | Cosmetic hiding |
| --- | --- | --- |
| Basic | Ads only | None |
| Optimal (default) | Ads + trackers | Per-site selectors only |
| Complete | Ads + trackers | Per-site + generic selectors |

Changing the mode calls `updateEnabledRulesets()`; the static rules are already packaged, so no
new rules are compiled at runtime. The master switch disables every ruleset but leaves the
packaged data intact.

Betting-site blocking is independent of the mode. It is a third static ruleset (see below) with
its own switch, so Basic/Optimal/Complete keep meaning what they say.

### Reels blocker permission

The reels blocker is the one part of FOCUS that changes what a page shows, so it is opt-in:

- `reels.consent` starts **false** on a fresh install, and `reels.enabled` starts **false** with
  it. Nothing is hidden, no page is touched, no interval runs on a platform site until both are
  true.
- On install — and on any update that lands while consent is still missing — the service worker
  opens `src/welcome/welcome.html`. That page lists the five sites, what the blocker does and
  what it will not do, and offers **Turn on reels blocker** / **Not now**.
- Approving writes `consent: true, enabled: true`. **Not now** writes both back to false and
  closes the tab.
- Turning the switch on anywhere else (popup, options) without consent opens the permission
  screen rather than enabling silently.
- Consent is never inferred from `enabled`. Storing `enabled: true` alone leaves the blocker off,
  so an update cannot quietly re-enable it.
- To withdraw it, switch the blocker off in the popup or in Settings. Blocking stops immediately;
  open tabs pick the change up through `chrome.storage.onChanged` and stand down on the next
  check. Re-approval is needed only if you clear extension storage.
- One gate decides all of this: `FocusSettings.isReelsActive(settings, platformId, hostname)`,
  used by the content script, and covered by tests for consent, the master switch, per-platform
  switches and the allowlist.

Re-approval does **not** open the permission page again; it only appears while consent is
missing.

### Betting sites

A curated list of sportsbooks, casinos and poker rooms is blocked as **whole sites**: typing the
address, a bookmark, a search result, or a link from anywhere. The rules use `$all`, so the same
entries also block those sites' scripts and iframes when embedded elsewhere.

- **On by default.** Switch it off in the popup or in Settings; the ruleset is disabled, not just
  ignored.
- **Allowlist wins.** Pausing a domain writes an allow rule at priority 1000, above the betting
  blocks at 100. Because a blocked site cannot show its own popup, add the hostname in
  **Settings → Allowed sites** to get one back deliberately.
- **What you see instead** is Chrome's blocked-page notice, not a FOCUS screen. A branded pause
  page would need a DNR `redirect` to a packaged page, which the compiler does not emit yet.
- **Scope:** 63 consumer front doors. News, travel and hotel sites that also run a sportsbook are
  not blocked wholesale; affiliate and comparison sites are not included.

This is the only ruleset allowed to block a `main_frame` navigation, and a test enforces that:
ad and tracker filtering can still never replace a page.

### What the reels blocker actually does

| Platform | Blocked routes | Entry points hidden |
| --- | --- | --- |
| Instagram | `/reel/*`, `/reels/*` | Reels nav/tab links and reel links |
| Facebook | `/reel/*`, `/reels/*` | Reels links in the main navigation, Reels-labelled links |
| YouTube | `/shorts/*` | Shorts shelves, guide/mini-guide entries, Shorts video links |
| TikTok | `/`, `/foryou`, `/explore`, `/@user/video/*` | For You and Explore nav entries |
| Snapchat | `/spotlight/*` | Spotlight links |

The flow:

1. `reels.css` is injected at `document_start` and hides entry points as soon as
   `data-focus-site` is set. Until settings load — and until consent is granted — the CSS is
   inert.
2. `reels.js` checks the URL on SPA navigation (a 700 ms interval plus `popstate`/`hashchange`,
   and YouTube's `yt-navigate-finish`). On a blocked route it hides video, sets
   `data-focus-reel-route`, pauses any playing media, and opens a shadow-DOM interstitial.
3. The interstitial offers **Back to feed** (or **Leave TikTok**) and **Continue for 5 minutes**.
   The pass is per tab, stored in `sessionStorage`, and expires automatically.
4. Each new blocked route increments the local daily counter once. Passing or refreshing does
   not inflate it; re-entering a blocked route later does.
5. The count feeds the popup, options page, and the action badge.

The page behind the interstitial is made `inert` and the overlay traps Tab between its two
buttons, so the feed cannot be scrolled or played by keyboard while the pause screen is up.

**Leaving without reloading the site.** When a reel route was reached from inside the app (open
the feed, then a reel), **Back to feed** calls `history.back()` so the site's own SPA restores
the previous page with its session, scroll position and in-memory state untouched. Only a
document that was *opened on* a reel route falls back to `location.replace()`, which loads the
site root through its normal signed-in flow and — unlike `location.assign()` — does not leave
the blocked URL in history to be hit again by Back.

This is deliberate: a full navigation to `instagram.com/` or `facebook.com/` re-boots the whole
app, and on Meta sites that re-boot is what looks like being signed out. Walking back through
the site's history avoids the reload entirely.

**Account screens are never blocked.** If the URL is a sign-in, sign-up, password, checkpoint,
recovery, OAuth or consent route (`FocusPlatforms.isAuthRoute`), or a rendered password field is
on screen, the blocker stands down immediately. An interstitial over a login form is
indistinguishable from being logged out, and it can strand someone outside their own account.

**Estimate:** the UI assumes two minutes reclaimed per interrupted session
(`MINUTES_PER_INTERRUPTION` in `src/shared/config.js`). It is a cue, not a measurement.

### Selector maintenance

Social sites rename DOM attributes regularly. The URL-level blocking and interstitial do not
depend on selectors, so the blocker still works when a selector rots; only the pre-emptive hiding
stops. Update the narrow selectors in `src/content/reels.css` when that happens.

---

## Filter coverage, compared with uBO Lite

FOCUS uses the same architecture as uBOL and a much smaller list. Be clear-eyed about the gap:

| | FOCUS 0.2.0 | uBO Lite |
| --- | --- | --- |
| Network rules | 260 (135 ads + 62 trackers + 63 betting) | tens of thousands, from EasyList/EasyPrivacy |
| Cosmetic selectors | 47 site-specific + 10 generic | tens of thousands, incl. procedural |
| Scriptlets | none | yes |
| `removeparam` / `redirect` | none | yes |
| YouTube in-player ads | cosmetic UI hiding only — **pre-roll still plays** | skipped by scriptlets |

What the curated list does cover: the major ad exchanges and SSPs (Google/DoubleClick, Criteo,
Amazon, PubMatic, Magnite, OpenX, Taboola, Outbrain, Teads, and so on), the common analytics and
attribution SDKs, sponsored slots on YouTube, Facebook, Instagram, X, Reddit, LinkedIn, Twitch,
Spotify and Amazon, and generic ad-slot containers in Complete mode.

Deliberately left alone, because blocking them costs more than it saves: `connect.facebook.net`
(the SDK behind "Log in with Facebook" on third-party sites), error-monitoring SDKs, payment and
identity providers, and anything on a login, signup, recovery or checkout path.

What it does not do: remove pre-roll or mid-roll video ads, rewrite tracking parameters out of
URLs, or defeat sites that serve ads from the same host as their content. Closing that gap means
vendoring a maintained list and adding scriptlet/redirect support to the compiler — a licensing
decision (EasyList is CC BY-SA 3.0) and a much larger build, not a filter-line change.

---

## What was reverse-engineered from uBOL, and what was not

`uBlockOrigin/uBOL-home` is the home/documentation repository for uBO Lite (MV3). The parts worth
learning from are architectural, and FOCUS reimplements them independently:

| uBOL approach | FOCUS equivalent |
| --- | --- |
| Filter lists compiled to DNR rulesets at package time | `scripts/lib/compile.mjs` → `rules/*.json` |
| Static ruleset switching instead of a runtime engine | `updateEnabledRulesets()` driven by the mode |
| Cosmetic filtering shipped as packaged content scripts/data | `src/content/cosmetic-data.js` + `cosmetic.js` |
| No remote filter fetching, no permanent process | No network requests at runtime; service worker only for state |
| Explicit reporting of filters that cannot be represented | Compiler `skipped[]` output printed by the build |
| Allowlisting and per-site exceptions | Explicit allowlist → dynamic `allow` rules + content-script gate |

FOCUS does **not** copy uBOL source code, and is not affiliated with uBlock Origin. uBOL is
GPLv3; if you copy its code or filter lists into this project, that licence applies to what you
copied.

Not ported from uBOL/classic uBO:

- scriptlet injection and procedural cosmetic filters (`:has-text`, `:-abp-*`)
- regex network filters and `redirect=` / `redirect-rule=`
- `csp`, `removeparam`, `replace`, `cookie`, `header`, and other modifier options
- dynamic filtering, per-site switches, remote filter-list subscriptions
- top-context-only rules (the MV3 limitation uBOL documents)
- generic cosmetic filtering in Optimal mode (opt into Complete)
- a matched-rule counter: `getMatchedRules()` requires Chrome's dev-only
  `declarativeNetRequestFeedback` permission, so FOCUS counts reel interventions rather than
  pretending to know how many ads were blocked

The compiler does not approximate these. It writes a line to the build output saying which filter
was skipped and why.

---

## Project structure

```text
focus/
├── manifest.json                 MV3 manifest
├── package.json                  build/test scripts, no dependencies
├── public/icons/                 generated PNG icons (16/32/48/128)
├── rules/
│   ├── ads.json                  GENERATED static DNR ruleset
│   ├── trackers.json             GENERATED static DNR ruleset
│   └── gambling.json             GENERATED static DNR ruleset (main_frame blocks)
├── src/
│   ├── filters/
│   │   ├── ads.txt               curated ad list (uBO subset syntax)
│   │   ├── trackers.txt          curated tracker list
│   │   └── gambling.txt          betting sites, blocked as whole documents
│   ├── shared/
│   │   ├── config.js             modes, defaults, estimate constants
│   │   ├── settings.js           storage schema, normalisation, allowlist matching
│   │   ├── stats.js              local daily counters
│   │   ├── platforms.js          pure reels URL matching
│   │   └── build-info.js         GENERATED counts/date
│   ├── background/
│   │   └── service-worker.js     ruleset switching, dynamic allow rules, stats, badge
│   ├── content/
│   │   ├── cosmetic-data.js      GENERATED selector maps
│   │   ├── cosmetic.js           injects cosmetic stylesheet
│   │   ├── reels.js              route detection, interstitial, pass, pausing
│   │   └── reels.css             entry-point hiding, overlay host positioning
│   ├── welcome/                   reels permission screen (consent gate)
│   ├── popup/                    popup.html / popup.css / popup.js
│   ├── options/                  options.html / options.css / options.js
│   └── ui/base.css               shared tokens, switches, buttons
├── site/                         static site: landing, extension, Android, FAQ, filters, policies
├── store/                        web-store assets and submission copy (not packaged)
├── scripts/
│   ├── lib/compile.mjs           filter compiler
│   ├── build.mjs                 build orchestrator
│   ├── package.mjs               dependency-free ZIP writer for the store upload
│   └── generate-icons.mjs        dependency-free PNG writer
└── tests/                        node:test suites
```

Generated files are checked in so the folder can be loaded unpacked without a build step, but
they are overwritten by `npm run build`. Edit sources, never the generated files.

---

## Filter syntax supported by the compiler

Network filters:

- plain substring patterns, `*` wildcard, `^` separator, `|` start/end anchors, `||domain`
- exceptions with `@@`
- types: `script`, `image`, `stylesheet`/`css`, `font`, `media`, `object`,
  `xmlhttprequest`/`xhr`, `subdocument`/`frame`, `document`/`doc`, `ping`/`beacon`,
  `websocket`, `other`, `all`
- options: `third-party`/`3p`, `first-party`/`1p`, `domain=`, `to=`, `important`, `match-case`
- negated types and domains (`~script`, `~example.com`)

Plain filters match every resource type **except** `main_frame`; only `$document` (or `$all`)
can block a top-level navigation. This mirrors the safe default rather than blocking pages by
accident.

Cosmetic filters:

- `example.com##.selector` — hide on a domain and its subdomains
- `##.selector` — generic (Complete mode only)
- `example.com#@#.selector` — exception
- multiple domains and `~` exclusions

Everything else is skipped with a reason. Skipped filters are printed by `npm run build`; they
are not silently turned into weaker rules.

---

## How the pieces fit

```text
src/filters/*.txt
      │  compile (build time)
      ├──────────────► rules/ads.json, rules/trackers.json ──► chrome.declarativeNetRequest
      └──────────────► src/content/cosmetic-data.js ─────────► cosmetic.js (per-site CSS)

settings (chrome.storage.local)
      │
      ├──► service worker: enable/disable rulesets, build dynamic allow rules, counters
      ├──► cosmetic.js: choose specific/generic selectors, respect allowlist
      └──► reels.js: active platform gate, route matching, interstitial
```

Storage keys:

```jsonc
// chrome.storage.local
{
  "settings": {
    "enabled": true,
    "mode": "optimal",              // basic | optimal | complete
    "gambling": true,               // betting-site ruleset on/off
    "reels": {
      "enabled": true,              // off until consent is granted
      "consent": true,              // only the permission screen writes this
      "platforms": {
        "instagram": true, "facebook": true, "youtube": true,
        "tiktok": true, "snapchat": true
      }
    },
    "allowlist": ["example.com"]
  },
  "stats": {
    "2026-11-19": { "reelsBlocked": 7 }   // local date key, pruned after 60 days
  }
}
```

Stored settings are always passed through `sanitize()` on read: bad modes, non-boolean switches,
duplicate domains, and malformed hosts are repaired rather than trusted.

---

## Permissions and privacy

| Permission | Why |
| --- | --- |
| `declarativeNetRequest` | Block/allow network requests with packaged rules |
| `storage` | Settings, allowlist and local counters |
| `tabs` | Read the current tab's hostname in the popup; close a tab only when a direct TikTok entry has no history |
| Content script matches on `<all_urls>` | Cosmetic filtering can apply on any site; reels scripts only load on the five platforms |
| Content script matches on the five platform domains | Reels blocking and hiding |

- No host permissions are requested for DNR; the declarative permission is enough for
  block/allow.
- No network requests are made by the extension. Filter data is packaged.
- No analytics, telemetry, accounts, or sync. Stats stay in `chrome.storage.local`.
- The allowlist is enforced twice: dynamic `allow` rules for the network layer and an explicit
  check in both content scripts.
- Cosmetic filtering necessarily runs on every site in Optimal/Complete mode. Use Basic, the
  master switch, or the per-site pause if that is not acceptable.

---

## Verification performed

Run on Node 22.22.1, 19 Nov 2026:

- `npm run build` — ads: 135 rules, trackers: 62 rules, betting: 63 rules; 10 cosmetic domains,
  47 specific selectors, 10 generic selectors; zero skipped filters in the bundled lists.
- `npm test` — **59/59 pass**, covering:
  - network rule compilation, type/party/domain mapping, important/exceptions, `to=`,
    `match-case`, duplicate merging, and explicit skipping of unsupported syntax
  - cosmetic grouping, exceptions, and unsafe-selector rejection
  - reels URL matching for all five platforms, host-boundary checks, invalid/non-HTTP URLs
  - settings normalisation, allowlist suffix matching, and local date keys
  - account-screen detection: login, signup, password reset, checkpoint, OAuth and consent
    routes are recognised, while reel and video routes are not mistaken for them
  - safety invariants over every generated rule: ad and tracker rules cannot block a
    `main_frame` navigation, only the betting ruleset can, only as a whole-domain `$all` block,
    and no rule targets a login, account or payment endpoint
  - betting-site settings: on by default, repairable from bad input, independent of the mode
  - the reels permission gate: off by default, consent never inferred from `enabled`,
    non-boolean consent repaired to "not approved", and every condition (master switch, consent,
    per-platform switch, allowlist) required before blocking is active
  - the permission page: file references, script load order, and approve/decline controls
  - the static site: no JavaScript, no remote resources, every local link resolves, one heading
    and one current nav item per page, and both policy pages still state the facts the code
    implements
  - manifest file references, DNR JSON structure and unique rule IDs, generated cosmetic data,
    popup/options script order
- `node --check` on every `.js`/`.mjs` file, and JSON parse of the manifest, rulesets and
  `package.json`.
- `npm run package` — 31 runtime files, 200 kB raw → 41 kB `dist/focus-0.4.0.zip`, verified with
  `unzip -t`. Tests assert the archive excludes `tests/`, `scripts/`, `_metadata/` and previous
  archives, and that every manifest reference is packaged.

**Not verified:** there is no Chrome/Chromium binary in this environment, so the extension was
not loaded in a browser. Consequently the following are unverified and need a manual pass:

- Chrome accepting every generated DNR rule at install (structural validation done, browser
  validation not)
- visual layout of the popup, options page and interstitial
- selector accuracy on live Instagram/Facebook/YouTube/TikTok/Snapchat DOMs
- service worker lifecycle, badge updates, and the five-minute pass across SPA navigation
- real ad/tracker blocking effectiveness (the list is intentionally small)

Manual QA checklist:

1. Load unpacked; confirm no manifest/ruleset errors on `chrome://extensions`.
2. Open the popup on a normal page; toggles persist after closing it.
3. Pause a site; reload; confirm filtering and reels hiding stop there only.
4. Visit each platform's reel route; confirm the interstitial, **Back**, and **5-minute pass**.
5. Confirm the count increments once per route, appears in the popup/options, and resets.
6. Switch modes; confirm cosmetic hiding changes (Complete adds generic selectors).
7. Disable the master switch; confirm rulesets are disabled and the interstitial stays away.

---

## Publishing

The store package, listing copy, permission justifications, privacy policy and the
step-by-step submission runbook live in `store/`:

| File | Purpose |
| --- | --- |
| `store/publish.md` | account, upload, review, rejection handling, update flow |
| `store/listing.md` | name, summary, description, single-purpose statement, screenshots shot list |
| `store/permissions.md` | one justification per permission, plus host access and remote code |
| `store/privacy.md` | privacy policy text, and the dashboard's data answers |
| `site/` | static site — landing, extension, Android, FAQ, filter list, and both privacy policies |
| `store/icon-128.png`, `store/promo-440x280.png` | listing artwork |

```bash
npm run verify && npm run package   # dist/focus-<version>.zip
```

Still missing before submission: **screenshots**. They have to be captured from
the running extension in Chrome at 1280×800; there is no browser in this
environment, so none are included.

---

## Troubleshooting

**Rules changed but the browser behaves the same** — run `npm run build`, then **Reload** the
extension and reload the page. Static rulesets are packaged at install/update.

**A site is broken** — pause it from the popup. That adds the hostname to the allowlist and
writes high-priority dynamic allow rules for both its requests and requests it initiates.

**Reels links are still visible on a site** — the platform changed its DOM. Add a narrow selector
to `src/content/reels.css`, rebuild and reload. The route-level interstitial should still work.

**Badge count looks stale** — the badge updates when a count is recorded or the service worker
starts. Use **Reset today's count** in options to zero it explicitly.

**No `:has()` support** — the minimum is Chromium 105; YouTube shelf selectors rely on it.

---

## Adding filters

1. Append rules to `src/filters/ads.txt` or `src/filters/trackers.txt`.
2. Run `npm run build`. Read the skip report.
3. Reload the extension.
4. Run `npm test` to revalidate rule IDs, types and generated data.

To grow beyond the bundled list, compile a maintained list you have the right to use. The
compiler intentionally supports a conservative subset; check the build report for what a larger
list would lose before assuming it is equivalent to uBO Lite.
