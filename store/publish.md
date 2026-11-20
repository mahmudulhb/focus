# Publishing FOCUS to the Chrome Web Store

Status of this repository, honestly:

| Step | State |
| --- | --- |
| Store package builds and validates | **done** — `npm run package` |
| Icon 128×128 + promo tile 440×280 | **done** — `store/` |
| Listing copy, permission justifications, privacy policy | **done** — `store/` |
| Landing page + hostable privacy policies (extension, Android) | **done** — `site/` |
| Screenshots | **missing** — needs Chrome to capture |
| Developer account, upload, review | **you must do this** |

## 0. Preflight (local)

```bash
cd focus
npm run verify     # build + all tests
npm run package    # dist/focus-0.4.0.zip
unzip -t dist/focus-0.4.0.zip
```

The archive contains 31 runtime files and nothing else: no `tests/`, no
`scripts/`, no `README.md`, and no `_metadata/` (the folder Chrome writes when
you load the extension unpacked — uploading it is a common mistake).

Load it once in Chrome before submitting:

1. `chrome://extensions` → Developer mode → **Load unpacked** → `focus/`.
2. Approve or decline the reels permission screen; check the popup, options,
   the interstitial on one platform, and one betting site.
3. Fix anything you find, then rebuild and repackage. **Do not submit untested.**

## 1. Developer account (one time)

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) with the Google account that should own the item. Prefer a dedicated account: Google does not let you change the account's email later.
2. Enable **2-Step Verification** on that account. Publishing is blocked without it.
3. Pay the **one-time registration fee** shown during signup (USD 5 at the time of writing). It covers all future items.
4. Complete the **trader / non-trader** declaration. If you are not monetizing, declare non-trader; traders must publish contact details on the listing.

## 2. Upload

1. Dashboard → **Add new item**.
2. Upload `focus/dist/focus-0.4.0.zip`. `manifest.json` is at the archive root, which the store requires.
3. A manifest error means bad JSON (comments are the usual cause) — ours has none.

## 3. Store listing tab

Copy from `store/listing.md`. Upload:

- `store/icon-128.png` — store icon, 96×96 art with 16 px padding.
- `store/promo-440x280.png` — small promo tile (effectively required; listings without one are ranked lower).
- 1–5 screenshots at 1280×800 or 640×400. **Capture these first**; the store will not publish without at least one.

Set category **Productivity**, language **English (United States)**.

## 4. Privacy practices tab

This is where most submissions stall. Fill it from:

- **Single purpose statement** — `store/listing.md` (bottom section).
- **Permission justifications** — `store/permissions.md`, one entry per permission and for host access.
- **Data usage** — "collects no user data"; `store/privacy.md` has the table.
- **Remote code** — No.
- **Privacy policy URL** — host `site/` and paste the `privacy.html` URL (next section). Replace the placeholder support address in the site pages first (it appears in all five).

## 4a. Hosting the policy

The site is static: seven HTML files and one stylesheet, no JavaScript, no fonts,
no analytics. Any static host works. It deliberately loads nothing from the
network, because a privacy page that phones home would contradict itself.

| Page | Role |
| --- | --- |
| `index.html` | landing page |
| `extension.html` | browser extension detail |
| `android.html` | Android app detail |
| `faq.html` | common questions, answered honestly |
| `filters.html` | every shipped ad, tracker and betting rule (generated, not hand-written) |
| `privacy.html` | **extension** policy — paste this into the Chrome Web Store |
| `privacy-android.html` | **app** policy — paste this into Play Console |

The landing page is the natural first impression, but only the two policy pages
are required by the stores.

Check it locally first:

```bash
cd focus
python3 -m http.server 8000 --directory site
# open http://localhost:8000/index.html
```

### GitHub Pages (free, permanent URL)

1. Create a repository (public) and copy the six files from `focus/site/` to its root, or keep the folder path and publish from there.
2. Repository → **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder `/ (root)` → Save.
3. After a minute the page appears at `https://<user>.github.io/<repo>/`. Where the policy lands
   depends only on how the repo is laid out:
   - repo root **is** `focus/` (the default here): `https://<user>.github.io/<repo>/site/privacy.html`
   - `focus/` sits inside a larger repo: `https://<user>.github.io/<repo>/focus/site/privacy.html`
   - pages copied to the repo root: `https://<user>.github.io/<repo>/privacy.html`
4. Put that exact URL in the dashboard's **Privacy policy URL** field, and
   `.../privacy-android.html` in Play Console if you submit the app.

The relative icon link (`../public/icons/icon-48.png`) only resolves if the site
is hosted inside this repository. On a standalone host, either copy
`public/icons/icon-48.png` next to the pages and change the link to
`icon-48.png`, or delete the `<link rel="icon">` line.

Other options: Cloudflare Pages, Netlify, Vercel, or the web host you already
pay for. Whatever you choose, the URL must stay reachable for as long as the
listing is live and must not require a login.

## 5. Submit

1. **Distribution**: Public, or Unlisted while you test (an unlisted item is installable by link and reviewable the same way).
2. Regions: all, unless you have a reason to restrict.
3. **Submit for review.** Google quotes most reviews at a few days, with longer waits possible for first-time developers and broad permissions.

## 6. If review rejects it

Most likely reasons, in order:

1. **Single purpose.** Ad blocking + reels blocking + betting blocking can read as more than one purpose. Use the wording in `store/listing.md`; if it is still rejected, split into two items rather than arguing.
2. **Broad host access.** `<all_urls>` content scripts need the justification in `store/permissions.md`. Narrowing cosmetic filtering to named domains would require redesigning Complete mode.
3. **`tabs` permission.** If asked, point at the popup's hostname read. `activeTab` is the narrower alternative but is untested here.
4. **Name conflict.** "FOCUS" is a common name; a rejection for impersonation or a duplicate name is possible. Have a fallback like `FOCUS — reels & ad blocker` ready (item names max 45 characters).
5. **Missing privacy policy URL** even though no data is collected. Host the file.

## 7. Updates

1. Bump `version` in **both** `manifest.json` and `package.json` (the build reads `package.json` for the version panel). The store requires a strictly larger version each upload.
2. `npm run verify && npm run package`.
3. Dashboard → your item → **Upload new package** → submit. Updates go through review too, usually faster.

## 8. Distribution beyond Chrome

The same zip installs in Edge and Brave through their own stores (Edge Add-ons: free, Partner Center; Brave uses the Chrome Web Store). Firefox needs a separate build: `background.service_worker` is replaced by an event page, and `declarativeNetRequest` differs. Do not upload this zip to AMO.
