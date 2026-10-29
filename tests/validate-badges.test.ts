// tools/validate-data.ts `validateBadges` and `validateAvatarParts` (docs/specs/badges-avatar.md §2d,
// §2e, §2f, §6a): the real catalogue and avatar library pass, and every §2e/§2f error fires on a
// minimal case (each case yields exactly that one error, so nothing else in the badge trips).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BADGE_GROUPS } from '../src/domain/badges';
import type { DictionaryData } from '../src/domain/dictionary';
import { FEATURE_IDS } from '../src/domain/features';
import { readDictionaryData } from '../tools/build-dictionary-seed.ts';
import {
  BADGE_FEATURE_IDS,
  BADGE_GROUP_IDS,
  checkAvatarSvg,
  refsFromData,
  validateAvatarParts,
  validateBadges,
} from '../tools/validate-data.ts';

type Obj = Record<string, unknown>;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DICT: DictionaryData = readDictionaryData(ROOT);
const refs = refsFromData(DICT);
const readData = (file: string): unknown => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const BADGES = readData('badges.json') as Obj[];
const PARTS = readData('avatar-parts.json') as Obj[];
const CLASSICS = ((readData('recipes.json') as { recipes: Obj[] }).recipes).filter((r) => String(r['id']).startsWith('b:'));

/** A valid one-off badge. */
const oneOff = (over: Obj = {}): Obj => ({
  id: 'proef',
  nl: { name: 'Proef', description: 'Kook 3 keer' },
  en: { name: 'Taste', description: 'Cook 3 times' },
  icon: '🍳',
  rule: { kind: 'cookCount', n: 3 },
  group: 'koken',
  ...over,
});
/** A valid ladder badge. */
const ladder = (over: Obj = {}): Obj => ({
  id: 'trap',
  nl: { name: 'Trap', description: 'Kook {n} keer' },
  en: { name: 'Ladder', description: 'Cook {n} times' },
  icon: '🪜',
  rule: { kind: 'cookCount' },
  group: 'koken',
  tiers: [1, 2, 3, 4, 5, 6, 7, 8],
  ...over,
});
const errorsOf = (badges: Obj[]) => validateBadges(badges, refs, { avatarParts: PARTS }).errors;

describe('the real data (§2d, §2f)', () => {
  it('data/badges.json and data/avatar-parts.json validate with 0 errors', () => {
    expect(validateBadges(BADGES, refs, { avatarParts: PARTS, classics: CLASSICS }).errors).toEqual([]);
    expect(validateAvatarParts(PARTS, BADGES).errors).toEqual([]);
    expect(validateAvatarParts(PARTS, BADGES).warnings).toEqual([]);
  });

  it('keeps all 44 earlier badge ids; six are retired with the replacement of §2d', () => {
    const ids = new Set(BADGES.map((b) => b['id']));
    const earlier = [
      'eerste-hap', 'huiskok', 'keukenbaas', 'chef-kok', 'proever', 'ontdekkingsreiziger', 'culinaire-avonturier',
      'van-a-tot-z', 'op-dreef', 'vaste-prik', 'halverwege-het-boek', 'het-hele-boek', 'eigen-inbreng',
      'receptenschrijver', 'kookboekauteur', 'sterrenregen', 'kritische-tong', 'gulle-gever', 'verzamelaar',
      'eerste-kiekje', 'foodfotograaf', 'fishlover', 'pastafarian', 'souperheld', 'bladgoud', 'korrelkenner',
      'noedelninja', 'stamppotstamper', 'carnivoor', 'wokmeester', 'oventovenaar', 'groenteheld',
      'plantaardige-pionier', 'glutenvrijbuiter', 'zuivelvrije-ziel', 'snelle-jelle', 'wereldreiziger', 'zomerkok',
      'winterwarmer', 'feestbeest', 'saffraankenner', 'ansjovisfan', 'kappertjeskenner', 'citroengrasfluisteraar',
    ];
    expect(earlier).toHaveLength(44);
    for (const id of earlier) expect(ids.has(id), id).toBe(true);
    const retired = Object.fromEntries(BADGES.filter((b) => b['retired'] === true).map((b) => [b['id'], b['replacedBy']]));
    expect(retired).toEqual({
      keukenbaas: 'huiskok',
      'chef-kok': 'huiskok',
      kookboekauteur: 'receptenschrijver',
      proever: 'ontdekkingsreiziger',
      'culinaire-avonturier': 'ontdekkingsreiziger',
      'vaste-prik': 'op-dreef',
    });
  });

  it('has the group counts of §2d (Geheim 27: vaste-klant waits for 6C), all of Geheim hidden', () => {
    const active = BADGES.filter((b) => b['retired'] !== true);
    const count = (g: string) => active.filter((b) => b['group'] === g).length;
    expect(BADGE_GROUP_IDS.map(count)).toEqual([34, 31, 18, 13, 11, 4, 6, 27]);
    expect(active).toHaveLength(144);
    expect(active.filter((b) => b['group'] === 'geheim').every((b) => b['hidden'] === true)).toBe(true);
    // The heart is the one hidden badge outside Geheim.
    expect(active.filter((b) => b['hidden'] === true && b['group'] !== 'geheim').map((b) => b['id'])).toEqual(['hartje']);
    expect(active.some((b) => b['id'] === 'vaste-klant')).toBe(false);
  });

  it('has the 66 avatar parts of §2f: 44 by level (13 at level 3), 22 by badge', () => {
    expect(PARTS).toHaveLength(66);
    const byLevel = PARTS.filter((p) => (p['unlock'] as Obj)['level'] !== undefined);
    expect(byLevel).toHaveLength(44);
    expect(byLevel.filter((p) => (p['unlock'] as Obj)['level'] === 3)).toHaveLength(13);
    expect(PARTS.filter((p) => (p['unlock'] as Obj)['badge'] !== undefined)).toHaveLength(22);
    expect([...new Set(byLevel.map((p) => (p['unlock'] as Obj)['level']))].sort((a, b) => Number(a) - Number(b))).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 30, 50, 60]);
  });

  it('mirrors the domain lists it cannot import under Node type stripping', () => {
    expect(BADGE_GROUP_IDS).toEqual([...BADGE_GROUPS]);
    expect(BADGE_FEATURE_IDS).toEqual([...FEATURE_IDS]);
    expect(BADGE_FEATURE_IDS).toHaveLength(32);
  });
});

describe('validateBadges: §2e errors', () => {
  it('valid one-off and ladder badges pass', () => {
    expect(errorsOf([oneOff(), ladder()])).toEqual([]);
  });

  it('group missing or unknown', () => {
    const msg = 'badges.json "proef": "group" must be one of koken | ontdekken | keukens | seizoenen | samen | foto | reeksen | geheim.';
    expect(errorsOf([oneOff({ group: undefined })])).toEqual([msg]);
    expect(errorsOf([oneOff({ group: 'snacks' })])).toEqual([msg]);
  });

  it('tiers with 7 values, or not strictly increasing', () => {
    const msg = 'badges.json "trap": "tiers" must be exactly 8 strictly increasing integers >= 1.';
    expect(errorsOf([ladder({ tiers: [1, 2, 3, 4, 5, 6, 7] })])).toEqual([msg]);
    expect(errorsOf([ladder({ tiers: [1, 2, 3, 4, 4, 6, 7, 8] })])).toEqual([msg]);
    expect(errorsOf([ladder({ tiers: [0, 2, 3, 4, 5, 6, 7, 8] })])).toEqual([msg]);
  });

  it('tiers and rule.n together, or neither', () => {
    expect(errorsOf([ladder({ rule: { kind: 'cookCount', n: 5 } })])).toEqual(['badges.json "trap": a ladder ("tiers") has no rule.n; drop one of the two.']);
    expect(errorsOf([oneOff({ rule: { kind: 'cookCount' } })])).toEqual(['badges.json "proef": rule.n must be an integer >= 1 for kind "cookCount" (or give the badge "tiers").']);
  });

  it('tiers on a plain kind', () => {
    expect(errorsOf([ladder({ rule: { kind: 'letters' } })])).toEqual(['badges.json "trap": rule kind "letters" cannot be a ladder; drop "tiers".']);
  });

  it('a ladder without {n}, a one-off badge with {n}', () => {
    expect(errorsOf([ladder({ nl: { name: 'Trap', description: 'Kook vaak' } })])).toEqual(['badges.json "trap": a ladder needs "{n}" in nl.description.']);
    expect(errorsOf([oneOff({ en: { name: 'Taste', description: 'Cook {n} times' } })])).toEqual(['badges.json "proef": a one-off badge has no "{n}" in en.description.']);
  });

  it('group geheim without hidden: true', () => {
    expect(errorsOf([oneOff({ group: 'geheim' })])).toEqual(['badges.json "proef": a badge in group "geheim" must have "hidden": true.']);
    expect(errorsOf([oneOff({ group: 'geheim', hidden: true })])).toEqual([]);
  });

  it('season on a non-seasonCooks rule, or seasonCooks without season', () => {
    expect(errorsOf([oneOff({ season: { from: '12-24', to: '12-26' } })])).toEqual(['badges.json "proef": "season" belongs to rule kind "seasonCooks" only.']);
    expect(errorsOf([oneOff({ rule: { kind: 'seasonCooks', n: 1 } })])).toEqual(['badges.json "proef": rule kind "seasonCooks" needs a "season" { from, to }.']);
    expect(errorsOf([oneOff({ rule: { kind: 'seasonCooks', n: 1 }, season: { from: '12-31', to: '01-01' } })])).toEqual([]);
  });

  it("season from '13-01' (and other impossible dates)", () => {
    const msg = 'badges.json "proef": "season" must be { from, to } with valid \'MM-DD\' dates.';
    const seasonal = (from: string, to: string) => oneOff({ rule: { kind: 'seasonCooks', n: 1 }, season: { from, to } });
    expect(errorsOf([seasonal('13-01', '12-26')])).toEqual([msg]);
    expect(errorsOf([seasonal('04-31', '05-01')])).toEqual([msg]);
    expect(errorsOf([seasonal('2-14', '02-14')])).toEqual([msg]);
    expect(errorsOf([seasonal('02-29', '02-29')])).toEqual([]);
  });

  it('unlock.part not in avatar-parts.json', () => {
    expect(errorsOf([oneOff({ unlock: { part: 'hat-nope' } })])).toEqual(['badges.json "proef": unlock.part "hat-nope" is not in avatar-parts.json.']);
    // Without the parts passed in, the part is not checked (tests/validate-data.test.ts calls it so).
    expect(validateBadges([oneOff({ unlock: { part: 'hat-nope' } })], refs).errors).toEqual([]);
  });

  it('unlock.tier on a one-off badge, missing on a ladder, or outside 1..8', () => {
    expect(errorsOf([oneOff({ unlock: { part: 'hat-crown', tier: 2 } })])).toEqual(['badges.json "proef": a one-off badge takes no unlock.tier.']);
    expect(errorsOf([ladder({ unlock: { part: 'hat-crown' } })])).toEqual(['badges.json "trap": a ladder needs unlock.tier (1..8).']);
    expect(errorsOf([ladder({ unlock: { part: 'hat-crown', tier: 9 } })])).toEqual(['badges.json "trap": unlock.tier must be an integer 1..8.']);
    expect(errorsOf([ladder({ unlock: { part: 'hat-crown', tier: 8 } })])).toEqual([]);
  });

  it('two badges with the same unlock.part', () => {
    expect(errorsOf([oneOff({ unlock: { part: 'hat-crown' } }), oneOff({ id: 'proef-2', unlock: { part: 'hat-crown' } })])).toEqual([
      'badges.json "proef-2": unlock.part "hat-crown" is already unlocked by badges.json "proef".',
    ]);
  });

  it('xp on a ladder, or not an integer >= 0', () => {
    expect(errorsOf([ladder({ xp: 100 })])).toEqual(['badges.json "trap": a ladder takes no "xp" (it earns 50 per level reached).']);
    expect(errorsOf([oneOff({ xp: -1 })])).toEqual(['badges.json "proef": "xp" must be an integer >= 0.']);
    expect(errorsOf([oneOff({ xp: 0 }), oneOff({ id: 'proef-2', xp: 250 })])).toEqual([]);
  });

  it('retired without replacedBy; replacedBy to a retired or unknown badge', () => {
    expect(errorsOf([oneOff({ retired: true })])).toEqual(['badges.json "proef": a retired badge needs "replacedBy" (the badge that took over).']);
    expect(errorsOf([oneOff({ id: 'a', retired: true, replacedBy: 'b' }), oneOff({ id: 'b', retired: true, replacedBy: 'c' }), oneOff({ id: 'c' })])).toEqual([
      'badges.json "a": replacedBy "b" is itself retired.',
    ]);
    expect(errorsOf([oneOff({ retired: true, replacedBy: 'weg' })])).toEqual(['badges.json "proef": replacedBy "weg" is not a badge id.']);
  });

  it('an unknown feature id', () => {
    const errors = errorsOf([oneOff({ rule: { kind: 'feature', id: 'kijken', n: 1 } })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('badges.json "proef": rule.id "kijken" is not a feature id');
    expect(errorsOf([oneOff({ rule: { kind: 'feature', id: 'timer', n: 1 } })])).toEqual([]);
  });

  it('weekdayCooks days [7] or []', () => {
    const msg = 'badges.json "proef": rule.days must be a non-empty array of weekdays 0..6 (0 = Sunday).';
    expect(errorsOf([oneOff({ rule: { kind: 'weekdayCooks', days: [7], n: 1 } })])).toEqual([msg]);
    expect(errorsOf([oneOff({ rule: { kind: 'weekdayCooks', days: [], n: 1 } })])).toEqual([msg]);
    expect(errorsOf([oneOff({ rule: { kind: 'weekdayCooks', days: [6, 0], n: 1 } })])).toEqual([]);
  });

  it('cookHour from 5 to 3, or outside 0..23', () => {
    expect(errorsOf([oneOff({ rule: { kind: 'cookHour', from: 5, to: 3, n: 1 } })])).toEqual(['badges.json "proef": rule.from (5) must not be after rule.to (3).']);
    expect(errorsOf([oneOff({ rule: { kind: 'cookHour', from: 0, to: 24, n: 1 } })])).toEqual(['badges.json "proef": rule.from and rule.to must be hours 0..23.']);
  });

  it('an unknown calendar.when; comeback.days < 1; sameRecipeDays without n or as a ladder', () => {
    expect(errorsOf([oneOff({ rule: { kind: 'calendar', when: 'easter', n: 1 } })])).toEqual(['badges.json "proef": rule.when must be one of friday-13 | leap-day.']);
    expect(errorsOf([oneOff({ rule: { kind: 'comeback', days: 0, n: 1 } })])).toEqual(['badges.json "proef": rule.days must be an integer >= 1.']);
    expect(errorsOf([oneOff({ rule: { kind: 'sameRecipeDays' } })])).toEqual(['badges.json "proef": rule.n must be an integer >= 1 for kind "sameRecipeDays".']);
    expect(errorsOf([ladder({ rule: { kind: 'sameRecipeDays', n: 3 } })])).toEqual(['badges.json "trap": rule kind "sameRecipeDays" cannot be a ladder; drop "tiers".']);
  });

  it('a cuisine id: an error when data/cuisines.json exists, a warning when it does not', () => {
    const cuisine = (id: string) => ladder({ rule: { kind: 'cuisine', id } });
    expect(errorsOf([cuisine('italiaans')])).toEqual([]);
    expect(errorsOf([cuisine('atlantis')])).toEqual(['badges.json "trap": rule.id "atlantis" is not a known cuisine id.']);
    const noCuisines = validateBadges([cuisine('atlantis')], refsFromData({ ...DICT, cuisines: [] }));
    expect(noCuisines.errors).toEqual([]);
    expect(noCuisines.warnings).toEqual(['badges.json "trap": data/cuisines.json is not present; cuisine id "atlantis" is unchecked.']);
  });
});

describe('validateBadges: §2e warnings', () => {
  it('a ladder tag/ingredient/cuisine that no classic has', () => {
    const tagLadder = ladder({ rule: { kind: 'tag', id: 'kids' } });
    const none = validateBadges([tagLadder], refs, { classics: [] });
    expect(none.warnings).toEqual(['badges.json "trap": tag "kids" occurs in no classic; the ladder needs recipes of your own.']);
    expect(validateBadges([tagLadder], refs, { classics: [{ id: 'b:x', tags: ['kids'], lines: [] }] }).warnings).toEqual([]);
    // One-off badges and categories are not checked.
    expect(validateBadges([oneOff({ rule: { kind: 'tag', id: 'kids', n: 3 } })], refs, { classics: [] }).warnings).toEqual([]);
    expect(validateBadges([ladder({ rule: { kind: 'category', id: 'gebak' } })], refs, { classics: [] }).warnings).toEqual([]);
  });

  it('more than 150 badges (retired ones not counted)', () => {
    const many = Array.from({ length: 151 }, (_, i) => oneOff({ id: `b${i}` }));
    const result = validateBadges(many, refs);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(['badges.json: 151 badges (not counting retired ones); more than 150 is a lot for one page.']);
    many[0] = oneOff({ id: 'b0', retired: true, replacedBy: 'b1' });
    expect(validateBadges(many, refs).warnings).toEqual([]);
  });
});

describe('validateAvatarParts (§2f)', () => {
  const part = (id: string, layer: string, unlock: Obj = { level: 3 }, svg = '<circle cx="50" cy="50" r="10"/>'): Obj => ({ id, layer, nl: id, en: id, unlock, svg });
  const BASE = [part('face-a', 'face'), part('eyes-a', 'eyes'), part('mouth-a', 'mouth'), part('body-a', 'body')];
  const kaasBadge = (unlockPart: string) => [oneOff({ id: 'kaasje', unlock: { part: unlockPart } })];
  const errors = (parts: Obj[], badges: Obj[] = []) => validateAvatarParts(parts, badges).errors;

  it('a minimal library with a badge part passes', () => {
    expect(errors([...BASE, part('hat-kaas', 'hat', { badge: 'kaasje' })], kaasBadge('hat-kaas'))).toEqual([]);
  });

  it('an id without its layer prefix', () => {
    expect(errors([...BASE, part('kaas-hoed', 'hat')])).toEqual(['avatar-parts.json "kaas-hoed": the id must start with "hat-" (its layer).']);
  });

  it('an unknown layer', () => {
    expect(errors([...BASE, part('cape-a', 'cape')])).toEqual(['avatar-parts.json "cape-a": "layer" must be one of bg | body | pin | face | facial | mouth | eyes | hair | glasses | hat | prop.']);
  });

  it('unlock.badge that does not point back, or is unknown', () => {
    expect(errors([...BASE, part('hat-kaas', 'hat', { badge: 'kaasje' })], kaasBadge('hat-other'))).toEqual([
      'avatar-parts.json "hat-kaas": badge "kaasje" does not point back (its unlock.part is "hat-other").',
    ]);
    expect(errors([...BASE, part('hat-kaas', 'hat', { badge: 'niemand' })])).toEqual(['avatar-parts.json "hat-kaas": unlock.badge "niemand" is not a badge in badges.json.']);
  });

  it("the badge side: a badge's unlock.part must be named back by that part", () => {
    expect(errors([...BASE, part('hat-kaas', 'hat', { level: 5 })], kaasBadge('hat-kaas'))).toEqual([
      'badges.json "kaasje": unlocks part "hat-kaas", but that part\'s unlock is {"level":5}.',
    ]);
  });

  it('unlock outside level 3..100, or both/neither of level and badge', () => {
    expect(errors([...BASE, part('hat-a', 'hat', { level: 2 })])).toEqual(['avatar-parts.json "hat-a": unlock.level must be an integer 3..100.']);
    expect(errors([...BASE, part('hat-a', 'hat', { level: 5, badge: 'kaasje' })])).toEqual(['avatar-parts.json "hat-a": "unlock" must be { level } or { badge }.']);
  });

  it('an svg with <script, href= or a disallowed style=', () => {
    expect(errors([...BASE, part('hat-a', 'hat', { level: 5 }, '<script>alert(1)</script>')])).toEqual(['avatar-parts.json "hat-a": svg contains "<script".']);
    expect(checkAvatarSvg('<use href="#x__u"/>')).toEqual(['contains "href="']);
    expect(checkAvatarSvg('<circle style="fill:red"/>')).toEqual(['style="fill:red" is not allowed (only fill:var(--tone) / fill:var(--hair))']);
    expect(checkAvatarSvg('<circle style="fill:var(--tone)"/><path style="fill:var(--hair)"/>')).toEqual([]);
  });

  it('an id="x" without __u, and a url(#…) that points nowhere', () => {
    expect(errors([...BASE, part('bg-a', 'bg', { level: 5 }, '<defs><linearGradient id="x"/></defs><rect fill="url(#x)"/>')])).toEqual([
      'avatar-parts.json "bg-a": svg id="x" does not end with "__u".',
      'avatar-parts.json "bg-a": svg url(#x) does not point at an id="…__u" in this svg.',
    ]);
    expect(checkAvatarSvg('<rect fill="url(#g9-__u)"/>')).toEqual(['url(#g9-__u) does not point at an id="…__u" in this svg']);
    expect(checkAvatarSvg('<defs><radialGradient id="g2-__u"/></defs><rect fill="url(#g2-__u)"/>')).toEqual([]);
  });

  it('a required layer (face) without a level-3 part', () => {
    expect(errors([part('face-a', 'face', { level: 5 }), ...BASE.slice(1)])).toEqual(['avatar-parts.json: required layer "face" has no part at level 3.']);
  });

  it('a duplicate id', () => {
    expect(errors([...BASE, part('face-a', 'face')])).toEqual(['avatar-parts.json "face-a": duplicate id.']);
  });
});
