import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFilterList, PRIORITY, RESOURCE_TYPES } from '../scripts/lib/compile.mjs';

test('compiles a plain domain block without touching main_frame', () => {
  const { rules, skipped } = compileFilterList('||ads.example^');
  assert.equal(skipped.length, 0);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].id, 1);
  assert.equal(rules[0].action.type, 'block');
  assert.equal(rules[0].priority, PRIORITY.block);
  assert.equal(rules[0].condition.urlFilter, '||ads.example^');
  assert.ok(!rules[0].condition.resourceTypes.includes('main_frame'));
});

test('maps type, party and domain options', () => {
  const { rules, skipped } = compileFilterList(
    '||tracker.example^$script,third-party,domain=news.example|~shop.example',
  );
  assert.equal(skipped.length, 0);
  const condition = rules[0].condition;
  assert.deepEqual(condition.resourceTypes, ['script']);
  assert.equal(condition.domainType, 'thirdParty');
  assert.deepEqual(condition.initiatorDomains, ['news.example']);
  assert.deepEqual(condition.excludedInitiatorDomains, ['shop.example']);
});

test('negated resource types are subtracted from the default set', () => {
  const { rules, skipped } = compileFilterList('||media.example^$~script,~image');
  assert.equal(skipped.length, 0);
  const types = rules[0].condition.resourceTypes;
  assert.ok(!types.includes('script'));
  assert.ok(!types.includes('image'));
  assert.ok(!types.includes('main_frame'));
  assert.ok(types.includes('xmlhttprequest'));
  assert.ok(types.every((type) => RESOURCE_TYPES.includes(type)));
});

test('document is the only way to include main_frame', () => {
  const { rules } = compileFilterList('||page.example^$document');
  assert.deepEqual(rules[0].condition.resourceTypes, ['main_frame']);
});

test('exceptions become allow rules with a higher priority', () => {
  const { rules } = compileFilterList('@@||good.example^');
  assert.equal(rules[0].action.type, 'allow');
  assert.equal(rules[0].priority, PRIORITY.allow);
  assert.ok(rules[0].priority > PRIORITY.block);
});

test('important blocks beat normal exceptions, important exceptions beat them', () => {
  const { rules } = compileFilterList(
    ['||ads.example^$important', '@@||ads.example^$important'].join('\n'),
  );
  assert.equal(rules[0].priority, PRIORITY.important);
  assert.equal(rules[1].priority, PRIORITY.importantAllow);
  assert.ok(rules[1].priority > rules[0].priority);
});

test('to= maps to requestDomains', () => {
  const { rules } = compileFilterList('||cdn.example^$to=site.example|~other.example');
  assert.deepEqual(rules[0].condition.requestDomains, ['site.example']);
  assert.deepEqual(rules[0].condition.excludedRequestDomains, ['other.example']);
});

test('match-case is preserved', () => {
  const { rules } = compileFilterList('||Case.example^$match-case');
  assert.equal(rules[0].condition.isUrlFilterCaseSensitive, true);
});

test('unsupported options and regex filters are skipped with a reason', () => {
  const { rules, skipped } = compileFilterList(
    [
      '||x.example^$csp=script-src',
      '/ads[0-9]+/',
      '||y.example^$redirect=noop.js',
    ].join('\n'),
  );
  assert.equal(rules.length, 0);
  assert.equal(skipped.length, 3);
  assert.match(skipped[0].reason, /unsupported option "csp"/);
  assert.match(skipped[1].reason, /regular-expression/);
  assert.match(skipped[2].reason, /unsupported option "redirect"/);
});

test('invalid domains are skipped instead of guessed', () => {
  const { rules, skipped } = compileFilterList('||x.example^$domain=bad_domain');
  assert.equal(rules.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /invalid domain/);
});

test('cosmetic filters are grouped per domain, with exceptions', () => {
  const { cosmetics, skipped } = compileFilterList(
    [
      'example.com##.ad-slot',
      'example.com##.promo',
      '##ins.adsbygoogle',
      'example.com#@#.ad-slot',
      '#@#.global-ad',
      'bad.example#?#.procedural',
    ].join('\n'),
  );
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /procedural/);
  assert.deepEqual(cosmetics.specific['example.com'], ['.ad-slot', '.promo']);
  assert.deepEqual(cosmetics.generic, ['ins.adsbygoogle']);
  assert.deepEqual(cosmetics.exceptions['example.com'], ['.ad-slot']);
  assert.deepEqual(cosmetics.exceptions['*'], ['.global-ad']);
});

test('duplicate rules are merged, ids stay sequential', () => {
  const { rules, merged } = compileFilterList(
    ['||a.example^', '||a.example^', '||b.example^'].join('\n'),
  );
  assert.equal(rules.length, 2);
  assert.equal(merged, 1);
  assert.deepEqual(
    rules.map((rule) => rule.id),
    [1, 2],
  );
});

test('comments, headers and blank lines are ignored', () => {
  const { rules, skipped } = compileFilterList(
    ['[Adblock Plus 2.0]', '! comment', '', '||a.example^'].join('\n'),
  );
  assert.equal(rules.length, 1);
  assert.equal(skipped.length, 0);
});
