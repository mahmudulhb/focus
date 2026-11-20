/**
 * FOCUS service worker.
 *
 * The filtering itself is entirely declarative (static DNR rulesets), so this
 * worker is not needed to block requests. It only reacts to settings changes,
 * keeps the user allowlist in the dynamic ruleset, and records counters.
 */
importScripts(
  '/src/shared/config.js',
  '/src/shared/settings.js',
  '/src/shared/stats.js',
);

const RULESET_IDS = ['ads', 'trackers', 'gambling'];
const USER_ALLOW_PRIORITY = 1000;
let applyQueue = Promise.resolve();
let statsQueue = Promise.resolve();

function scheduleApply() {
  applyQueue = applyQueue
    .then(applyState)
    .catch((error) => console.error('[FOCUS] settings apply failed', error));
  return applyQueue;
}

async function applyState() {
  const settings = await FocusSettings.get();
  await applyRulesets(settings);
  await applyDynamicRules(settings);
}

async function applyRulesets(settings) {
  const mode = FocusConfig.MODES[settings.mode] || FocusConfig.MODES.optimal;
  const wanted = settings.enabled
    ? [...mode.rulesets, ...(settings.gambling ? ['gambling'] : [])]
    : [];
  const current = await chrome.declarativeNetRequest.getEnabledRulesets();

  const enableRulesetIds = wanted.filter((id) => !current.includes(id));
  const disableRulesetIds = RULESET_IDS.filter(
    (id) => current.includes(id) && !wanted.includes(id),
  );

  if (enableRulesetIds.length === 0 && disableRulesetIds.length === 0) return;
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds,
    disableRulesetIds,
  });
}

/**
 * A paused site gets two allow rules: one for requests it initiates, one for
 * requests to it. Both are needed because a top-level navigation has no
 * meaningful initiator, and an ad request may point back at the paused host.
 */
const USER_BLOCK_PRIORITY = 500;

/**
 * Dynamic rules cover two user-controlled lists:
 *  - the allowlist (allow rules, highest priority),
 *  - the blocklist (block rules, below the allowlist so an allowed host wins).
 * Both are rebuilt from scratch on every settings change so a removed entry
 * cannot linger as a stale rule.
 */
async function applyDynamicRules(settings) {
  const allowDomains = settings.enabled ? (settings.allowlist || []) : [];
  const blockDomains = settings.enabled ? (settings.blocklist || []) : [];
  const adDomains = settings.enabled ? (settings.adDomains || []) : [];
  const elementSelectors = settings.enabled ? (settings.elementHiding || []) : [];
  const addRules = [];

  blockDomains.forEach((domain, index) => {
    addRules.push({
      id: 10000 + index + 1,
      priority: USER_BLOCK_PRIORITY,
      action: { type: 'block' },
      condition: {
        requestDomains: [domain],
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'stylesheet',
          'script',
          'image',
          'font',
          'object',
          'xmlhttprequest',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other',
        ],
      },
    });
  });

  // Ad/tracker domains supplied by the user: block their requests as ads
  // everywhere, but keep the host itself reachable (no main_frame block).
  adDomains.forEach((domain, index) => {
    addRules.push({
      id: 30000 + index + 1,
      priority: USER_BLOCK_PRIORITY,
      action: { type: 'block' },
      condition: {
        requestDomains: [domain],
        resourceTypes: [
          'sub_frame',
          'stylesheet',
          'script',
          'image',
          'font',
          'object',
          'xmlhttprequest',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other',
        ],
      },
    });
  });

  // Element-hiding selectors (##selector): inject as cosmetic rules
  // that hide matching elements. Each gets its own rule ID starting at 40000.
  elementSelectors.forEach((selector, index) => {
    // Strip the leading ## for the rule condition
    const cssSelector = selector.startsWith('##') ? selector.slice(2) : selector;
    addRules.push({
      id: 40000 + index + 1,
      priority: USER_BLOCK_PRIORITY,
      action: { type: 'css' },
      condition: {
        extensionPoint: 'css',
        cssSelector: cssSelector,
      },
    });
  });

  allowDomains.forEach((domain, index) => {
    addRules.push({
      id: 20000 + index * 2 + 1,
      priority: USER_ALLOW_PRIORITY,
      action: { type: 'allow' },
      condition: { initiatorDomains: [domain] },
    });
    addRules.push({
      id: 20000 + index * 2 + 2,
      priority: USER_ALLOW_PRIORITY,
      action: { type: 'allow' },
      condition: { requestDomains: [domain] },
    });
  });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  if (addRules.length === 0 && removeRuleIds.length === 0) return;

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

async function updateBadge(count) {
  const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#2B3427' });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#D6F36A' });
    }
  } catch (error) {
    console.warn('[FOCUS] badge update failed', error);
  }
}

async function refreshBadge() {
  const today = await FocusStats.today();
  await updateBadge(today.reelsBlocked);
}

chrome.runtime.onInstalled.addListener((details) => {
  FocusSettings.ensureDefaults()
    .then(scheduleApply)
    .then(refreshBadge)
    .then(() => openReelsPermission(details))
    .catch((error) => console.error('[FOCUS] install setup failed', error));
});

/**
 * The reels blocker never runs without approval, so a fresh install (and any
 * update that lands before approval) opens the permission screen once. It is a
 * normal extension page; nothing is injected into a site to produce it.
 */
async function openReelsPermission(details) {
  if (details.reason !== 'install' && details.reason !== 'update') return;
  try {
    const settings = await FocusSettings.get();
    if (settings.reels.consent) return;
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/welcome/welcome.html'),
    });
  } catch (error) {
    console.warn('[FOCUS] could not open the reels permission screen', error);
  }
}

chrome.runtime.onStartup.addListener(() => {
  scheduleApply();
  refreshBadge().catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  scheduleApply();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return undefined;

  if (message.type === 'focus:reel-blocked') {
    // Serialize read-modify-write so concurrent tabs cannot drop a count.
    statsQueue = statsQueue
      .catch(() => {})
      .then(() => FocusStats.addReelBlocked(1));
    statsQueue
      .then(async (today) => {
        await updateBadge(today.reelsBlocked);
        sendResponse({ ok: true, today });
      })
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === 'focus:get-today') {
    FocusStats.today()
      .then((today) => sendResponse({ ok: true, today }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === 'focus:reset-today') {
    statsQueue = statsQueue.catch(() => {}).then(() => FocusStats.resetToday());
    statsQueue
      .then(async (today) => {
        await updateBadge(0);
        sendResponse({ ok: true, today });
      })
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === 'focus:leave-tab') {
    if (!sender.tab || sender.tab.id == null) {
      sendResponse({ ok: false, error: 'no tab' });
      return undefined;
    }
    chrome.tabs
      .remove(sender.tab.id)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return undefined;
});

scheduleApply();
refreshBadge().catch(() => {});
