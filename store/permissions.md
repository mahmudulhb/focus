# Permission justifications — Chrome Web Store review

One plain sentence per permission, matching `manifest.json`. Paste these into
**Privacy practices → Permission justification**. Reviewers reject vague answers;
these say what the code does and where it does it.

## `storage`

```
Saves the user's own settings in chrome.storage.local: the filtering mode, the
per-platform reels switches and consent, the betting-site switch, the allowed-site
list, and a daily counter of interrupted reel routes. Nothing is synced and
nothing leaves the browser.
```

## `declarativeNetRequest`

```
Blocks ad, tracker and betting requests using rules compiled into static rulesets
that ship inside the extension. The extension never reads request bodies, headers
or responses; Chrome enforces the packaged rules. A single dynamic ruleset holds
allow rules for domains the user explicitly paused, so a paused site is exempt.
```

## `tabs`

```
The popup reads the active tab's hostname to show whether FOCUS is active or paused
on that site, and to let the user pause it. The extension also opens its own
permission page in a new tab after install, and closes a tab only when the user
presses "Leave TikTok" on a direct TikTok feed visit with no history to go back to.
No browsing history is read, stored or transmitted.
```

Narrowing note: `activeTab` would cover the popup's hostname read (the action click
is an invocation), but that change has not been exercised in a browser here. If you
want the smaller permission set, test it first and swap `"tabs"` for `"activeTab"`.

## Host access (content scripts)

FOCUS declares no `host_permissions`. Access comes from two declared content
scripts; justify both under **Host permission justification**:

```
1) Cosmetic filtering needs to run on any site, because the generic ad-slot
   selectors in Complete mode are not tied to a domain. That script injects a
   stylesheet that hides ad containers; it reads no page content, no form values
   and no messages.

2) The reels blocker runs only on instagram.com, facebook.com, youtube.com,
   tiktok.com and snapchat.com. It matches the URL path, hides reel entry points,
   and shows a local pause screen. It stands down on sign-in, sign-up, password
   and recovery routes.
```

## What is deliberately not requested

| Permission | Why not |
| --- | --- |
| `webRequest` | Everything is declarative; there is no traffic inspection |
| `cookies` | FOCUS never reads or sets cookies |
| `history` | No browsing history is read |
| `scripting` | No dynamic injection; all scripts are declared |
| `host_permissions` | Not needed for declarative rules or declared content scripts |
| `downloads`, `clipboard`, `identity` | Not used |

## Remote code

Answer **"No, I do not use remote code"**. There is no `eval`, no `new Function`,
no script fetched at runtime, no WebAssembly, and no remote configuration. All
JavaScript is in the package and referenced from `manifest.json`.

## Data usage certification

FOCUS collects no user data, so on the privacy tab:

- **Does this item collect user data?** No.
- **Is data sold to third parties?** No.
- **Is data used for purposes unrelated to the item's single purpose?** No.
- **Is data used to determine creditworthiness?** No.

## Limited Use statement

If the dashboard asks for the Chrome Web Store Limited Use compliance
acknowledgement, the accurate statement is:

```
FOCUS does not collect or transmit user data at all. Settings and counters are
stored locally in chrome.storage.local and are never sent to any server, because
the extension makes no network requests of its own.
```
