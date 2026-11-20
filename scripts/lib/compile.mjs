/**
 * Compiles a small, deliberately conservative subset of uBlock Origin filter
 * syntax into:
 *   - declarativeNetRequest rules (block/allow only)
 *   - cosmetic selector maps for the content script
 *
 * The point is the same one uBOL makes: everything is compiled at build time,
 * so the browser can enforce it without a running service worker. Anything
 * that cannot be represented safely is reported and skipped, never faked.
 */

export const PRIORITY = {
  block: 100,
  allow: 200,
  important: 300,
  importantAllow: 400,
};

export const RESOURCE_TYPES = [
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
];

// uBO's implicit types for a plain network filter: everything except the
// document itself (DNR's default is likewise "all except main_frame").
const DEFAULT_TYPES = RESOURCE_TYPES.filter((type) => type !== 'main_frame');

const TYPE_ALIASES = new Map([
  ['script', 'script'],
  ['image', 'image'],
  ['stylesheet', 'stylesheet'],
  ['css', 'stylesheet'],
  ['font', 'font'],
  ['media', 'media'],
  ['object', 'object'],
  ['xmlhttprequest', 'xmlhttprequest'],
  ['xhr', 'xmlhttprequest'],
  ['subdocument', 'sub_frame'],
  ['frame', 'sub_frame'],
  ['document', 'main_frame'],
  ['doc', 'main_frame'],
  ['ping', 'ping'],
  ['beacon', 'ping'],
  ['websocket', 'websocket'],
  ['csp_report', 'csp_report'],
  ['other', 'other'],
]);

// Options that uBO supports but this build intentionally does not compile.
const UNSUPPORTED_OPTIONS = new Set([
  'badfilter',
  'cookie',
  'csp',
  'denyallow',
  'elemhide',
  'empty',
  'genericblock',
  'generichide',
  'header',
  'ipaddress',
  'method',
  'mp4',
  'permissions',
  'popup',
  'redirect',
  'redirect-rule',
  'removeparam',
  'replace',
  'responseheader',
  'specifichide',
  'strict1p',
  'strict3p',
  'urlskip',
  'uritransform',
  'webrtc',
]);

const KNOWN_OPTIONS = new Set([
  ...TYPE_ALIASES.keys(),
  'all',
  'domain',
  'to',
  'important',
  'match-case',
  'third-party',
  '3p',
  'first-party',
  '1p',
]);

const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

const OPTION_TOKEN = /^~?[a-z][a-z0-9_-]*(?:=[^,]*)?$/i;
const COSMETIC_UNSUPPORTED = /#(?:[?$%]|@\?)/;

function parseDomainList(value) {
  const positives = [];
  const negatives = [];
  for (const rawToken of String(value || '').split('|')) {
    const token = rawToken.trim();
    if (!token) continue;
    const negated = token.startsWith('~');
    const domain = (negated ? token.slice(1) : token).toLowerCase().replace(/\.$/, '');
    if (!DOMAIN_PATTERN.test(domain)) {
      return { error: `invalid domain "${token}"` };
    }
    if (negated) {
      if (!negatives.includes(domain)) negatives.push(domain);
    } else if (!positives.includes(domain)) {
      positives.push(domain);
    }
  }
  if (positives.length === 0 && negatives.length === 0) {
    return { error: 'empty domain list' };
  }
  return { positives, negatives };
}

function parseOptionTokens(tokens) {
  const positives = new Set();
  const negatives = new Set();
  const initiator = { positives: [], negatives: [] };
  const request = { positives: [], negatives: [] };
  let important = false;
  let matchCase = false;
  let thirdParty = false;
  let firstParty = false;

  for (const rawToken of tokens) {
    const negated = rawToken.startsWith('~');
    const token = (negated ? rawToken.slice(1) : rawToken).toLowerCase();
    const equals = token.indexOf('=');
    const name = equals === -1 ? token : token.slice(0, equals);
    const value = equals === -1 ? '' : rawToken.slice(rawToken.indexOf('=') + 1);

    if (name === 'domain' || name === 'to') {
      if (negated) return { error: `"${name}=" cannot be negated` };
      const parsed = parseDomainList(value);
      if (parsed.error) return { error: parsed.error };
      const target = name === 'domain' ? initiator : request;
      target.positives = parsed.positives;
      target.negatives = parsed.negatives;
      continue;
    }

    if (name === 'important') {
      important = true;
      continue;
    }
    if (name === 'match-case') {
      matchCase = true;
      continue;
    }
    if (name === 'third-party' || name === '3p') {
      if (negated) firstParty = true;
      else thirdParty = true;
      continue;
    }
    if (name === 'first-party' || name === '1p') {
      if (negated) thirdParty = true;
      else firstParty = true;
      continue;
    }
    if (name === 'all') {
      if (negated) return { error: '"all" cannot be negated' };
      for (const type of RESOURCE_TYPES) positives.add(type);
      continue;
    }

    const mapped = TYPE_ALIASES.get(name);
    if (!mapped) {
      const reason = UNSUPPORTED_OPTIONS.has(name)
        ? `unsupported option "${name}"`
        : `unknown option "${name}"`;
      return { error: reason };
    }
    if (negated) negatives.add(mapped);
    else positives.add(mapped);
  }

  if (thirdParty && firstParty) {
    return { error: 'conflicting first-party and third-party options' };
  }

  let resourceTypes;
  if (positives.size > 0) {
    resourceTypes = [...positives].filter((type) => !negatives.has(type));
  } else {
    resourceTypes = DEFAULT_TYPES.filter((type) => !negatives.has(type));
  }
  if (resourceTypes.length === 0) {
    return { error: 'no resource types left after exclusions' };
  }

  return {
    resourceTypes: RESOURCE_TYPES.filter((type) => resourceTypes.includes(type)),
    domainType: thirdParty ? 'thirdParty' : firstParty ? 'firstParty' : undefined,
    important,
    matchCase,
    initiator,
    request,
  };
}

function parseNetworkFilter(line, source) {
  const isException = line.startsWith('@@');
  const body = isException ? line.slice(2) : line;

  let pattern = body;
  let optionTokens = [];
  const dollar = body.lastIndexOf('$');
  if (dollar > 0) {
    const candidate = body.slice(dollar + 1);
    const tokens = candidate
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length > 0 && tokens.every((token) => OPTION_TOKEN.test(token))) {
      pattern = body.slice(0, dollar);
      optionTokens = tokens;
    }
  }

  if (!pattern) {
    return { skipped: { source, line, reason: 'empty pattern' } };
  }
  if (pattern.length > 2000) {
    return { skipped: { source, line, reason: 'pattern longer than 2000 characters' } };
  }
  if (pattern === '*' || pattern === '||' || pattern === '|') {
    return { skipped: { source, line, reason: 'pattern matches everything' } };
  }
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    return { skipped: { source, line, reason: 'regular-expression filters are not compiled' } };
  }
  if (/[^\x20-\x7e]/.test(pattern)) {
    return { skipped: { source, line, reason: 'non-ASCII pattern' } };
  }
  if (/[\s"'\\#]/.test(pattern)) {
    return { skipped: { source, line, reason: 'pattern contains unsupported characters' } };
  }

  let parsedOptions;
  if (optionTokens.length > 0) {
    parsedOptions = parseOptionTokens(optionTokens);
    if (parsedOptions.error) {
      return { skipped: { source, line, reason: parsedOptions.error } };
    }
  } else {
    parsedOptions = {
      resourceTypes: DEFAULT_TYPES,
      domainType: undefined,
      important: false,
      matchCase: false,
      initiator: { positives: [], negatives: [] },
      request: { positives: [], negatives: [] },
    };
  }

  const condition = {
    urlFilter: pattern,
    resourceTypes: parsedOptions.resourceTypes,
  };
  if (parsedOptions.domainType) condition.domainType = parsedOptions.domainType;
  if (parsedOptions.initiator.positives.length > 0) {
    condition.initiatorDomains = parsedOptions.initiator.positives;
  }
  if (parsedOptions.initiator.negatives.length > 0) {
    condition.excludedInitiatorDomains = parsedOptions.initiator.negatives;
  }
  if (parsedOptions.request.positives.length > 0) {
    condition.requestDomains = parsedOptions.request.positives;
  }
  if (parsedOptions.request.negatives.length > 0) {
    condition.excludedRequestDomains = parsedOptions.request.negatives;
  }
  if (parsedOptions.matchCase) condition.isUrlFilterCaseSensitive = true;

  const priority = isException
    ? parsedOptions.important
      ? PRIORITY.importantAllow
      : PRIORITY.allow
    : parsedOptions.important
      ? PRIORITY.important
      : PRIORITY.block;

  return {
    rule: {
      priority,
      action: { type: isException ? 'allow' : 'block' },
      condition,
    },
  };
}

function parseCosmeticFilter(line, source) {
  if (COSMETIC_UNSUPPORTED.test(line)) {
    return {
      skipped: { source, line, reason: 'procedural or scriptlet cosmetic filters are not compiled' },
    };
  }

  const exceptionIndex = line.indexOf('#@#');
  const hideIndex = line.indexOf('##');
  if (exceptionIndex === -1 && hideIndex === -1) return null;

  const isException = exceptionIndex !== -1 && (hideIndex === -1 || exceptionIndex < hideIndex);
  const separatorIndex = isException ? exceptionIndex : hideIndex;
  const separator = isException ? '#@#' : '##';
  const domainPart = line.slice(0, separatorIndex).trim();
  const selector = line.slice(separatorIndex + separator.length).trim();

  if (!selector) {
    return { skipped: { source, line, reason: 'empty cosmetic selector' } };
  }
  if (selector.length > 500) {
    return { skipped: { source, line, reason: 'cosmetic selector longer than 500 characters' } };
  }
  if (/[{};\0]/.test(selector) || /^[>+~]/.test(selector)) {
    return { skipped: { source, line, reason: 'cosmetic selector is not safe to inject' } };
  }

  const positives = [];
  const negatives = [];
  if (domainPart) {
    for (const rawToken of domainPart.split(',')) {
      const token = rawToken.trim();
      if (!token) continue;
      const negated = token.startsWith('~');
      const domain = (negated ? token.slice(1) : token).toLowerCase().replace(/\.$/, '');
      if (!DOMAIN_PATTERN.test(domain)) {
        return { skipped: { source, line, reason: `invalid cosmetic domain "${token}"` } };
      }
      if (negated) {
        if (!negatives.includes(domain)) negatives.push(domain);
      } else if (!positives.includes(domain)) {
        positives.push(domain);
      }
    }
  }

  return {
    cosmetic: {
      selector,
      positives,
      negatives,
      isException,
    },
  };
}

function emptyCosmetics() {
  return {
    specific: new Map(),
    generic: new Set(),
    exceptions: new Map(),
  };
}

function addToMap(map, key, selector) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(selector);
}

/**
 * @param {string} text
 * @param {{source?: string}} options
 */
export function compileFilterList(text, options = {}) {
  const source = options.source || 'filters';
  const rules = [];
  const skipped = [];
  const cosmetics = emptyCosmetics();
  const seenRules = new Set();
  let merged = 0;

  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;

    const cosmetic = parseCosmeticFilter(line, source);
    if (cosmetic) {
      if (cosmetic.skipped) {
        skipped.push(cosmetic.skipped);
        continue;
      }
      const item = cosmetic.cosmetic;
      if (item.isException) {
        if (item.positives.length === 0) {
          addToMap(cosmetics.exceptions, '*', item.selector);
        } else {
          for (const domain of item.positives) {
            addToMap(cosmetics.exceptions, domain, item.selector);
          }
        }
      } else if (item.positives.length === 0) {
        cosmetics.generic.add(item.selector);
        for (const domain of item.negatives) {
          addToMap(cosmetics.exceptions, domain, item.selector);
        }
      } else {
        for (const domain of item.positives) {
          addToMap(cosmetics.specific, domain, item.selector);
        }
        for (const domain of item.negatives) {
          addToMap(cosmetics.exceptions, domain, item.selector);
        }
      }
      continue;
    }

    const parsed = parseNetworkFilter(line, source);
    if (parsed.skipped) {
      skipped.push(parsed.skipped);
      continue;
    }
    if (!parsed.rule) continue;

    const key = JSON.stringify([
      parsed.rule.action.type,
      parsed.rule.priority,
      parsed.rule.condition,
    ]);
    if (seenRules.has(key)) {
      merged += 1;
      continue;
    }
    seenRules.add(key);
    rules.push({ id: rules.length + 1, ...parsed.rule });
  }

  return {
    rules,
    skipped,
    merged,
    cosmetics: {
      specific: Object.fromEntries(
        [...cosmetics.specific.entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([domain, selectors]) => [domain, [...selectors].sort()]),
      ),
      generic: [...cosmetics.generic].sort(),
      exceptions: Object.fromEntries(
        [...cosmetics.exceptions.entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([domain, selectors]) => [domain, [...selectors].sort()]),
      ),
    },
  };
}
