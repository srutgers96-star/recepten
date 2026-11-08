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

  it('has the group counts of §2d (Koken 36 with vaste-klant of 6C and uitdager of 6E; Boodschappen of V7), all of Geheim hidden', () => {
    const active = BADGES.filter((b) => b['retired'] !== true);
    const count = (g: string) => active.filter((b) => b['group'] === g).length;
    // Boodschappen has the 12 badges of spec V7; the spec's "verzamelaar" (taken by Samen) became "boodschappenmand".
    expect(BADGE_GROUP_IDS.map(count)).toEqual([36, 12, 31, 18, 13, 11, 4, 6, 27]);
    expect(active).toHaveLength(158);
    expect(BADGES).toHaveLength(164);
    expect(active.filter((b) => b['group'] === 'geheim').every((b) => b['hidden'] === true)).toBe(true);
    // Hidden outside Geheim: the heart, and the two secret shopping badges of spec V7.
    expect(active.filter((b) => b['hidden'] === true && b['group'] !== 'geheim').map((b) => b['id']).sort()).toEqual(['alfabet', 'hartje', 'zeldzaam']);
    expect(active.find((b) => b['id'] === 'vaste-klant')?.['group']).toBe('koken');
    expect(active.find((b) => b['id'] === 'uitdager')).toMatchObject({ group: 'koken', icon: '🎯', rule: { kind: 'challenges' }, tiers: [1, 3, 5, 10, 20, 35, 50, 75] });
  });

  // §2f had 66 parts (44 by level, 13 of them at level 3, 22 by badge). Round 2 (block 6D-UI, UI-C)
  // redrew them and added at least 60, all by level so far; tests/avatar.test.ts checks the 66 one
  // by one (ids and unlocks never change).
  it('has the avatar parts of §2f plus round 2: ≥ 120, the 22 badge parts, every round-1 level still there', () => {
    expect(PARTS.length).toBeGreaterThanOrEqual(120);
    const byLevel = PARTS.filter((p) => (p['unlock'] as Obj)['level'] !== undefined);
    expect(byLevel.filter((p) => (p['unlock'] as Obj)['level'] === 3).length).toBeGreaterThanOrEqual(13);
    expect(PARTS.filter((p) => (p['unlock'] as Obj)['badge'] !== undefined).length).toBeGreaterThanOrEqual(22);
    const levels = new Set(byLevel.map((p) => Number((p['unlock'] as Obj)['level'])));
    for (const level of [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 30, 50, 60]) expect(levels.has(level), `level ${level}`).toBe(true);
    for (const level of levels) expect(level >= 3 && level <= 100, `level ${level}`).toBe(true);
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
    const msg = 'badges.json "proef": "group" must be one of koken | boodschappen | ontdekken | keukens | seizoenen | samen | foto | reeksen | geheim.';
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
    expect(errors([...BASE, part('cape-a', 'cape')])).toEqual(['avatar-parts.json "cape-a": "layer" must be one of bg | body | pin | face | facial | mouth | eyes | hair | glasses | hat | prop | frame.']);
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

  it('a rarity below the level rule is an error; on the rule or above it is fine (spec V3 §1b)', () => {
    const rated = (level: number, rarity: string): Obj => ({ ...part('hat-a', 'hat', { level }), rarity });
    expect(errors([...BASE, rated(59, 'common')])).toEqual([
      'avatar-parts.json "hat-a": rarity below the level rule ("common" on level 59; the rule gives "epic").',
    ]);
    expect(errors([...BASE, rated(21, 'common')])).toEqual([
      'avatar-parts.json "hat-a": rarity below the level rule ("common" on level 21; the rule gives "rare").',
    ]);
    expect(errors([...BASE, rated(81, 'epic')])).toHaveLength(1);
    // On the rule, at the edges of each band.
    for (const [level, rarity] of [[20, 'common'], [21, 'rare'], [50, 'rare'], [51, 'epic'], [80, 'epic'], [81, 'legendary']] as const) {
      expect(errors([...BASE, rated(level, rarity)]), `${level} ${rarity}`).toEqual([]);
    }
    // Above the rule: allowed, without a warning (the dino hat is legendary on level 3).
    expect(validateAvatarParts([...BASE, rated(3, 'legendary')], [])).toMatchObject({ errors: [], warnings: [] });
    // A badge part is not held to a level rule; a missing rarity falls back to the rule.
    expect(errors([...BASE, { ...part('hat-kaas', 'hat', { badge: 'kaasje' }), rarity: 'common' }], kaasBadge('hat-kaas'))).toEqual([]);
    expect(errors([...BASE, part('hat-a', 'hat', { level: 70 })])).toEqual([]);
  });
});

describe('the avatar library after spec V3 (§1b)', () => {
  const byId = new Map(PARTS.map((p) => [String(p['id']), p]));
  const get = (id: string): Obj => {
    const p = byId.get(id);
    if (!p) throw new Error(`no part ${id}`);
    return p;
  };

  it('has 169 parts: 154 before, six glasses and five kitchen parts of V3, four badge parts of V7', () => {
    expect(PARTS).toHaveLength(169);
    expect(PARTS.filter((p) => p['layer'] === 'glasses')).toHaveLength(15);
  });

  it('the fifteen rarities below the level rule are fixed', () => {
    for (const id of ['hair-braid', 'hair-ponytail', 'hair-afro', 'body-dress', 'body-raincoat', 'body-tee-avocado',
      'prop-frying-pan', 'prop-ice-cream', 'prop-cupcake', 'prop-herbs', 'prop-chopsticks']) expect(get(id)['rarity'], id).toBe('rare');
    for (const id of ['body-orange-shirt', 'body-christmas-jumper', 'prop-egg-timer', 'prop-leek']) expect(get(id)['rarity'], id).toBe('epic');
  });

  it('the new glasses and kitchen parts unlock on their level, rarity by the level rule, with NL and EN names', () => {
    const NEW: Readonly<Record<string, number>> = {
      'glasses-star': 31, 'glasses-heart': 34, 'glasses-3d': 37, 'glasses-carrot': 41, 'glasses-nerd': 45, 'glasses-olive': 48,
      'pin-chili': 26, 'facial-sauce': 29, 'hat-colander': 36, 'mouth-spaghetti': 41, 'eyes-sunny': 43,
    };
    for (const [id, level] of Object.entries(NEW)) {
      const p = get(id);
      expect(p['unlock'], id).toEqual({ level });
      expect(p['rarity'], id).toBe('rare');
      expect(String(p['nl']).length, id).toBeGreaterThan(0);
      expect(String(p['en']).length, id).toBeGreaterThan(0);
    }
    // prop-whisk already existed (level 7, round 1): its id and unlock stay.
    expect(get('prop-whisk')['unlock']).toEqual({ level: 7 });
  });

  it('the four thick frames clip at r 44', () => {
    for (const id of ['frame-plate', 'frame-board', 'frame-pan', 'frame-basket']) {
      expect(get(id)['clip'], id).toBe('<circle cx="50" cy="50" r="44"/>');
    }
  });
});

describe('hats cover the hair after spec V3b (§1b)', () => {
  it('every hat except crown, flower-crown and party has a brim between 20 and 40', () => {
    const OPEN = new Set(['hat-crown', 'hat-flower-crown', 'hat-party']);
    const hats = PARTS.filter((p) => p['layer'] === 'hat');
    expect(hats.length).toBe(20);
    for (const hat of hats) {
      const id = String(hat['id']);
      if (OPEN.has(id)) {
        expect(hat['brim'], id).toBeUndefined();
      } else {
        expect(typeof hat['brim'], id).toBe('number');
        expect(hat['brim'] as number, id).toBeGreaterThanOrEqual(20);
        expect(hat['brim'] as number, id).toBeLessThanOrEqual(40);
      }
    }
  });
});

// Spec V7 §1b: the shopping badges (group 'boodschappen') and their avatar parts.
describe('the shopping badges of spec V7 (§1b)', () => {
  const byId = new Map(BADGES.map((b) => [String(b['id']), b]));
  const get = (id: string): Obj => {
    const b = byId.get(id);
    if (!b) throw new Error(`no badge ${id}`);
    return b;
  };
  const part = (id: string): Obj => {
    const p = PARTS.find((x) => x['id'] === id);
    if (!p) throw new Error(`no part ${id}`);
    return p;
  };
  const ING = new Map(DICT.ingredients.map((i) => [i.id, i]));

  it('has the table: ids, names, rules, tiers, icons, rewards', () => {
    const TABLE: ReadonlyArray<[string, string, string, string, Obj, number[] | null, Obj | null]> = [
      ['boodschappenmand', 'Boodschappenmand', 'Shopping basket', '🧺', { kind: 'boughtDistinct' }, [10, 25, 50, 100, 175, 250, 350, 500], { part: 'glasses-shopping', tier: 3 }],
      ['groenteboer', 'Groenteboer', 'Greengrocer', '🥦', { kind: 'boughtDistinct', aisle: 'groente-fruit' }, [10, 20, 35, 50, 70, 90, 120, 150], { part: 'pin-carrot', tier: 2 }],
      ['kaasmeester', 'Kaasmeester', 'Cheesemonger', '🧀', { kind: 'boughtDistinct', aisle: 'kaas' }, [3, 5, 8, 12, 16, 20, 28, 36], { part: 'prop-cheese-slicer', tier: 2 }],
      ['slager', 'Slager', 'Butcher', '🥩', { kind: 'boughtGroup' }, [5, 10, 15, 20, 30, 40, 55, 70], null],
      ['vismarkt', 'Vismarkt', 'Fishmonger', '🐟', { kind: 'boughtGroup' }, [3, 5, 8, 12, 16, 20, 25, 30], null],
      ['kruidenkast', 'Kruidenkast', 'Spice rack', '🌿', { kind: 'boughtDistinct', aisle: 'kruiden-specerijen', staples: true }, [5, 10, 15, 20, 30, 40, 55, 70], null],
      ['wereldwinkel', 'Wereldwinkel', 'World shelf', '🌍', { kind: 'boughtDistinct', aisle: 'wereld' }, [5, 10, 15, 20, 30, 40, 55, 70], null],
      ['bakkersmand', 'Bakkersmand', "Baker's basket", '🥐', { kind: 'boughtDistinct', aisle: 'bakken' }, [5, 8, 12, 16, 20, 25, 30, 40], null],
      ['zeldzaam', 'Zeldzaam', 'One-of-a-kind', '💎', { kind: 'boughtRare', n: 1 }, null, null],
      ['alfabet', 'Alfabet', 'Alphabet', '🔤', { kind: 'boughtLetters', n: 25 }, null, { part: 'glasses-letters' }],
      ['speculaastijd', 'Speculaastijd', 'Spice season', '🍪', { kind: 'boughtInMonth', id: 'speculaaskruiden', months: [11, 12] }, null, null],
      ['zomerkoninkjes', 'Zomerkoninkjes', 'Summer berries', '🍓', { kind: 'boughtInMonth', id: 'aardbei', months: [6, 7, 8] }, null, null],
    ];
    for (const [id, nl, en, icon, rule, tiers, unlock] of TABLE) {
      const b = get(id);
      expect(b['group'], id).toBe('boodschappen');
      expect((b['nl'] as Obj)['name'], id).toBe(nl);
      expect((b['en'] as Obj)['name'], id).toBe(en);
      expect(b['icon'], id).toBe(icon);
      expect(b['rule'], id).toMatchObject(rule);
      expect(b['tiers'], id).toEqual(tiers ?? undefined);
      expect(b['unlock'], id).toEqual(unlock ?? undefined);
      expect(b['xp'], id).toBeUndefined();
      expect(b['retired'], id).toBeUndefined();
    }
    // Only the two secret ones are hidden (XP 250 each by default).
    expect(BADGES.filter((b) => b['group'] === 'boodschappen' && b['hidden'] === true).map((b) => b['id'])).toEqual(['zeldzaam', 'alfabet']);
    // The table's "verzamelaar" became "boodschappenmand" (Fable): the id belongs to the Samen ladder of received recipes.
    expect(get('verzamelaar')).toMatchObject({ group: 'samen', icon: '📬', rule: { kind: 'received' } });
    // The first badge of the group; only Kruidenkast lets staples count, Alfabet skips the x.
    expect(BADGES.find((b) => b['group'] === 'boodschappen')?.['id']).toBe('boodschappenmand');
    expect(BADGES.filter((b) => (b['rule'] as Obj)['staples'] === true).map((b) => b['id'])).toEqual(['kruidenkast']);
    expect((get('boodschappenmand')['rule'] as Obj)['aisle']).toBeUndefined();
    expect((get('alfabet')['rule'] as Obj)['n']).toBe(25);
    expect((get('alfabet')['nl'] as Obj)['description']).toContain('25');
    expect((get('alfabet')['en'] as Obj)['description']).toContain('25');
  });

  it('slager is meat and vismarkt fish from the vlees-vis aisle: no fish, no vegetarian products, no staples, no overlap', () => {
    const slager = (get('slager')['rule'] as Obj)['ids'] as string[];
    const vis = (get('vismarkt')['rule'] as Obj)['ids'] as string[];
    for (const id of [...slager, ...vis]) {
      const ing = ING.get(id);
      expect(ing, id).toBeDefined();
      expect(ing?.aisle, id).toBe('vlees-vis');
      expect(ing?.veg, id).toBe(false);
      expect(ing?.staple, id).toBe(false);
    }
    expect(slager.filter((id) => vis.includes(id))).toEqual([]);
    for (const fish of ['zalm', 'tonijnfilet', 'garnaal', 'mossel', 'haring', 'vis']) expect(slager.includes(fish), fish).toBe(false);
    expect(slager.length).toBeGreaterThanOrEqual(70);
    expect(vis.length).toBeGreaterThanOrEqual(30);
  });

  it('the four parts: badge unlock, layer, rarity, names, and the badge points back', () => {
    const PARTS_V7: ReadonlyArray<[string, string, string, string]> = [
      ['pin-carrot', 'pin', 'groenteboer', 'rare'],
      ['prop-cheese-slicer', 'prop', 'kaasmeester', 'rare'],
      ['glasses-letters', 'glasses', 'alfabet', 'epic'],
      ['glasses-shopping', 'glasses', 'boodschappenmand', 'rare'],
    ];
    for (const [id, layer, badge, rarity] of PARTS_V7) {
      const p = part(id);
      expect(p['layer'], id).toBe(layer);
      expect(p['unlock'], id).toEqual({ badge });
      expect(p['rarity'], id).toBe(rarity);
      expect(String(p['nl']).length, id).toBeGreaterThan(0);
      expect(String(p['en']).length, id).toBeGreaterThan(0);
      expect(checkAvatarSvg(String(p['svg'])), id).toEqual([]);
      expect((get(badge)['unlock'] as Obj)['part'], id).toBe(id);
    }
    expect(part('glasses-shopping')).toMatchObject({ nl: 'Prijskaartjesbril', en: 'Price-tag glasses' });
  });

  it('the real data has every shopping goal within reach (Kruidenkast counts staples, Alfabet asks 25 letters)', () => {
    const { warnings } = validateBadges(BADGES, refs, { avatarParts: PARTS, classics: CLASSICS, ingredients: DICT.ingredients });
    const v7 = warnings.filter((w) => /"(boodschappenmand|groenteboer|kaasmeester|slager|vismarkt|kruidenkast|wereldwinkel|bakkersmand|zeldzaam|alfabet|speculaastijd|zomerkoninkjes)"/.test(w));
    expect(v7).toEqual([]);
  });
});

describe('validateBadges: the shopping-trail rule kinds of spec V7', () => {
  const shop = (rule: Obj, over: Obj = {}): Obj => oneOff({ id: 'winkel', group: 'boodschappen', rule, nl: { name: 'Winkel', description: 'Koop iets' }, en: { name: 'Shop', description: 'Buy something' }, ...over });
  const shopLadder = (rule: Obj, over: Obj = {}): Obj => ladder({ id: 'winkel', group: 'boodschappen', rule, ...over });

  it('valid one-offs and ladders of every kind pass', () => {
    expect(errorsOf([
      shop({ kind: 'boughtDistinct', n: 10 }),
      shopLadder({ kind: 'boughtDistinct', aisle: 'kaas' }, { id: 'winkel-2' }),
      shop({ kind: 'boughtGroup', ids: ['kip', 'gehakt'], n: 2 }, { id: 'winkel-3' }),
      shopLadder({ kind: 'boughtGroup', ids: ['kip', 'gehakt', 'bacon', 'ham', 'salami', 'chorizo', 'rosbief', 'pancetta'] }, { id: 'winkel-4' }),
      shop({ kind: 'boughtRare', n: 1 }, { id: 'winkel-5' }),
      shopLadder({ kind: 'boughtRare' }, { id: 'winkel-6' }),
      shop({ kind: 'boughtLetters', n: 26 }, { id: 'winkel-7' }),
      shopLadder({ kind: 'boughtLetters' }, { id: 'winkel-8' }),
      shop({ kind: 'boughtInMonth', id: 'aardbei', months: [6, 7, 8] }, { id: 'winkel-9' }),
      shop({ kind: 'boughtInMonth', id: 'aardbei', months: [6], n: 1 }, { id: 'winkel-10' }),
    ])).toEqual([]);
  });

  it('staples is accepted on boughtDistinct only, and must be a boolean', () => {
    expect(errorsOf([shop({ kind: 'boughtDistinct', aisle: 'kruiden-specerijen', staples: true, n: 3 })])).toEqual([]);
    expect(errorsOf([shopLadder({ kind: 'boughtDistinct', staples: false })])).toEqual([]);
    expect(errorsOf([shop({ kind: 'boughtDistinct', staples: 'ja', n: 3 })])).toEqual(['badges.json "winkel": rule.staples must be a boolean when present.']);
    const only = 'badges.json "winkel": rule.staples is only allowed on kind "boughtDistinct".';
    expect(errorsOf([shop({ kind: 'boughtGroup', ids: ['kip', 'ham'], staples: true, n: 1 })])).toEqual([only]);
    expect(errorsOf([shop({ kind: 'boughtLetters', staples: true, n: 3 })])).toEqual([only]);
    expect(errorsOf([shop({ kind: 'boughtRare', staples: true, n: 1 })])).toEqual([only]);
    expect(errorsOf([oneOff({ rule: { kind: 'cookCount', staples: true, n: 1 } })])).toEqual(['badges.json "proef": rule.staples is only allowed on kind "boughtDistinct".']);
  });

  it('boughtDistinct with an unknown aisle', () => {
    expect(errorsOf([shop({ kind: 'boughtDistinct', aisle: 'snoep', n: 3 })])).toEqual(['badges.json "winkel": rule.aisle "snoep" is not a known aisle id.']);
  });

  it('boughtGroup: ids empty, duplicate, unknown, or fewer than the goal', () => {
    expect(errorsOf([shop({ kind: 'boughtGroup', ids: [], n: 1 })])).toEqual(['badges.json "winkel": rule.ids must be a non-empty array of ingredient ids.']);
    expect(errorsOf([shop({ kind: 'boughtGroup', ids: ['kip', 'kip', 'ham'], n: 2 })])).toEqual(['badges.json "winkel": rule.ids has duplicates.']);
    expect(errorsOf([shop({ kind: 'boughtGroup', ids: ['kip', 'draak'], n: 1 })])).toEqual(['badges.json "winkel": rule.ids "draak" is not a known ingredient id.']);
    expect(errorsOf([shop({ kind: 'boughtGroup', ids: ['kip', 'ham'], n: 3 })])).toEqual(['badges.json "winkel": goal 3 is more than the 2 ids in rule.ids.']);
    expect(errorsOf([shopLadder({ kind: 'boughtGroup', ids: ['kip', 'ham'] })])).toEqual(['badges.json "winkel": goal 8 is more than the 2 ids in rule.ids.']);
  });

  it('boughtInMonth: unknown id, bad months, or a ladder', () => {
    expect(errorsOf([shop({ kind: 'boughtInMonth', id: 'draak', months: [1] })])).toEqual(['badges.json "winkel": rule.id "draak" is not a known ingredient id.']);
    const msg = 'badges.json "winkel": rule.months must be a non-empty array of distinct months 1..12.';
    expect(errorsOf([shop({ kind: 'boughtInMonth', id: 'aardbei', months: [] })])).toEqual([msg]);
    expect(errorsOf([shop({ kind: 'boughtInMonth', id: 'aardbei', months: [0, 13] })])).toEqual([msg]);
    expect(errorsOf([shop({ kind: 'boughtInMonth', id: 'aardbei', months: [6, 6] })])).toEqual([msg]);
    expect(errorsOf([shopLadder({ kind: 'boughtInMonth', id: 'aardbei', months: [6] })])).toEqual(['badges.json "winkel": rule kind "boughtInMonth" cannot be a ladder; drop "tiers".']);
  });

  it('boughtLetters above 26', () => {
    expect(errorsOf([shop({ kind: 'boughtLetters', n: 27 })])).toEqual(['badges.json "winkel": goal 27 is more than the 26 letters A–Z.']);
  });

  it('warns (with the ingredients) on an unreachable goal and on a staple in a group', () => {
    const ingredients = [
      { id: 'kip', nl: { one: 'kip' }, aisle: 'vlees-vis', staple: false },
      { id: 'ham', nl: { one: 'ham' }, aisle: 'vlees-vis', staple: false },
      { id: 'zout', nl: { one: 'zout' }, aisle: 'kruiden-specerijen', staple: true },
    ];
    const warn = (b: Obj) => validateBadges([b], refs, { avatarParts: PARTS, ingredients }).warnings;
    expect(warn(shop({ kind: 'boughtDistinct', aisle: 'vlees-vis', n: 3 }))).toEqual(['badges.json "winkel": goal 3 is out of reach: the dictionary has 2 non-staple ingredients in aisle "vlees-vis".']);
    expect(warn(shop({ kind: 'boughtDistinct', aisle: 'vlees-vis', n: 2 }))).toEqual([]);
    // With staples: true the staples are in the pool (zout is the only one in its aisle).
    expect(warn(shop({ kind: 'boughtDistinct', aisle: 'kruiden-specerijen', n: 1 }))).toEqual(['badges.json "winkel": goal 1 is out of reach: the dictionary has 0 non-staple ingredients in aisle "kruiden-specerijen".']);
    expect(warn(shop({ kind: 'boughtDistinct', aisle: 'kruiden-specerijen', staples: true, n: 1 }))).toEqual([]);
    expect(warn(shop({ kind: 'boughtDistinct', aisle: 'kruiden-specerijen', staples: true, n: 2 }))).toEqual(['badges.json "winkel": goal 2 is out of reach: the dictionary has 1 ingredients (staples included) in aisle "kruiden-specerijen".']);
    expect(warn(shop({ kind: 'boughtGroup', ids: ['kip', 'zout'], n: 1 }))).toEqual(['badges.json "winkel": rule.ids "zout" is a staple; staples never count on the shopping trail.']);
    expect(warn(shop({ kind: 'boughtLetters', n: 3 }))).toEqual([
      'badges.json "winkel": goal 3 is out of reach: non-staple ingredients start with 2 letters (missing: a, b, c, d, e, f, g, i, j, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z).',
    ]);
    // Without the ingredients nothing warns.
    expect(validateBadges([shop({ kind: 'boughtDistinct', aisle: 'vlees-vis', n: 3 })], refs, { avatarParts: PARTS }).warnings).toEqual([]);
  });
});
