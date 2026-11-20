# Chrome Web Store listing — FOCUS

Copy-paste material for the Developer Dashboard **Store listing** tab.
Everything here describes what the code actually does. Do not add claims the
extension cannot back up.

## Text fields

| Field | Value |
| --- | --- |
| Item name | `FOCUS` |
| Summary (max 132 chars) | see below |
| Category | Productivity (Lifestyle / Well-being if offered for your account) |
| Language | English (United States) |
| Homepage URL | optional — your landing page |
| Support URL | optional but recommended — a page or repo with an issue link |

### Summary (108 characters)

```
Block ads and trackers, shut down reels feeds, and keep betting sites out of reach. Local only.
```

No superlatives, no competitor names — both are listing-policy violations.

### Detailed description

```
FOCUS is one layer of quiet over the loudest parts of the web.

WHAT IT BLOCKS

• Ads and trackers — 197 curated network rules covering the major ad exchanges,
  analytics SDKs and conversion pixels, plus 47 site-specific filters for
  sponsored posts on YouTube, Facebook, Instagram, X, Reddit, LinkedIn, Twitch,
  Spotify and Amazon.
• Betting sites — 63 sportsbooks, casinos and poker rooms blocked as whole
  sites. Switchable, and the allowlist always wins.
• Short-form feeds — Instagram and Facebook Reels, YouTube Shorts, TikTok's For
  You feed and Snapchat Spotlight. Entry points disappear before paint; opening
  a reel route shows a pause screen with a five-minute pass instead.

FOCUS ASKS FIRST

The reels blocker is opt-in. A permission screen opens on install and explains
exactly what it does on those five sites. Nothing is hidden until you approve
it, and an update can never re-enable it behind your back.

PRIVATE BY CONSTRUCTION

• No account, no sign-in, no cloud sync
• No analytics, no telemetry, no ads in the extension
• Settings, blocklist choices and counters stay in chrome.storage.local
• No remote code: everything is packaged, nothing is downloaded and executed
• Built on the same declarative model as uBO Lite — rules are compiled at build
  time and enforced by Chrome, not by a background script reading your traffic

WHAT IT DOES NOT DO

• It cannot skip YouTube pre-roll or mid-roll ads (that needs scriptlets, which
  this build does not ship). It hides in-feed and display ad slots.
• It does not read page content, your account, messages or cookies.
• It does not stand between you and a sign-in, sign-up, password or
  account-recovery screen.
• It cannot stop you from disabling it — that is your call.

FILTERING MODES

• Basic — ads only, no cosmetic hiding
• Optimal (default) — ads, trackers and per-site sponsored-slot hiding
• Complete — also applies the generic ad-slot selectors everywhere

OPEN SOURCE-STYLE HONESTY

The filter lists are hand-curated and readable in the package. If a site is
missing, it is missing because nobody added it yet, not because a subscription
silently changed.
```

## Graphic assets

| Asset | Spec | File | Status |
| --- | --- | --- | --- |
| Store icon | 128×128 PNG, 96×96 art + 16 px transparent padding | `store/icon-128.png` | **included** |
| Small promo tile | 440×280 PNG or JPEG | `store/promo-440x280.png` | **included** |
| Screenshots | 1–5 images, 1280×800 or 640×400, full bleed | — | **not included: no Chrome available to capture them** |
| Marquee tile | 1400×560, optional, needed for featuring | — | not included |

### Screenshots to capture (in Chrome, after uploading to internal testing)

1. Popup on a normal site — protection on, rules count in the footer.
2. Popup with the reels switch showing "Approval needed".
3. The reels permission screen (`src/welcome/welcome.html`).
4. The pause screen over an Instagram reel route.
5. Options page — modes and the allowed-sites list.

Capture at 1280×800 (Chrome DevTools device toolbar, 1280×800 viewport) and
check that no personal data, real account name or private URL is visible.

## Privacy tab (required)

Answers are in `store/privacy.md`; permission justifications are in
`store/permissions.md`.

## Single purpose statement

Use exactly this wording, and keep the extension to it:

```
FOCUS reduces attention sinks in the browser: it blocks ads and trackers, blocks
short-form reel feeds, and blocks betting sites. One focus layer, one purpose.
```

**This is the most likely point of review friction.** Chrome requires a single
narrow purpose, and "ad blocker + site blocker" can read as two products. If the
submission is rejected for it, the alternative is to ship the ad/tracker part and
the reels/betting part as two separate items rather than arguing with review.
