# FOCUS privacy policy (browser extension)

**Extension:** FOCUS for Chrome and other Chromium browsers (v0.4.0)
**Effective date:** 20 November 2026

Chrome Web Store requires a **publicly reachable URL** for this policy if the
item declares any data handling. FOCUS declares none, but the privacy tab still
asks for a URL and reviewers look for it.

A ready-to-host page already exists in `site/privacy.html`, styled to match the
listing artwork, with `site/index.html` as the landing page. Host the `site/`
folder (see `store/publish.md` → "Hosting the policy") and paste the resulting
`privacy.html` URL into the dashboard. The text below is the source of truth if
you prefer to publish it elsewhere.

---

## The short version

FOCUS has no account, no server and no analytics. Everything it knows is stored
in your own browser profile and is never transmitted anywhere.

## What FOCUS stores

Using `chrome.storage.local`, in your browser profile only:

- the filtering mode (Basic / Optimal / Complete);
- the reels switches, per platform, plus whether you approved the reels blocker;
- the betting-site switch;
- the list of sites you paused;
- a daily count of interrupted reel sessions, pruned after 60 days.

This is not synced to your Google account (`chrome.storage.local`, not
`chrome.storage.sync`) and is not shared with the developer or anyone else.

## What FOCUS processes

- **Request URLs**, by the browser's declarative rules engine, to decide whether a
  request matches the packaged ad, tracker or betting rules. FOCUS does not read
  request or response bodies, headers or cookies, and no log of requests is kept.
- **The hostname of the active tab**, when you open the popup, so it can show
  whether the site is active or paused.
- **The URL path of the current page**, on the five reels platforms, to notice a
  reel route. The path is compared in memory; it is not stored.
- **The blocked app's label and countdown** are rendered into FOCUS's own pause
  screen; the page's content is never read.

## What FOCUS does not do

- It makes no network requests of its own. There is no remote configuration, no
  filter-list download, no telemetry endpoint.
- It does not use remote code. All JavaScript ships in the package.
- It does not read page content, form fields, messages, or cookies.
- It does not collect identifiers, location, health, financial, or authentication
  information.
- It does not sell or transfer data to third parties, and does not use data for
  creditworthiness or lending.
- It does not inject advertising.

## Reels blocker consent

The reels blocker changes what a page shows, so it is opt-in. On install (and on
an update while consent is still missing) a permission page opens that lists the
five sites and what the blocker does. Nothing is hidden on those sites until you
approve it, and consent is never inferred from an older "enabled" flag. Turning
the blocker off in the popup or settings withdraws it immediately.

## Your control

- Pause any site from the popup; the allowlist always outranks the filters.
- Switch off protection entirely with the master switch.
- Remove the extension to delete everything it stored; there is no copy
  elsewhere to delete.

## Children

FOCUS is not directed at children and collects no personal data from anyone.

## Changes

If a future version starts collecting anything, this policy and the store's
privacy tab will be updated in the same release, before that version ships.

## Contact

Replace this line with the support address you list on the store page.

---

## Dashboard answers (Privacy practices tab)

| Question | Answer |
| --- | --- |
| Does the item collect user data? | No |
| Data types collected | none selected |
| Sold to third parties | No |
| Used for unrelated purposes | No |
| Used for creditworthiness | No |
| Remote code | No |
| Privacy policy URL | host this file and paste the URL |
| Single purpose | see `store/listing.md` |
| Permission justifications | see `store/permissions.md` |
