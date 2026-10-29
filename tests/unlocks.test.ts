// Unlocks (docs/specs/xp-levels.md §2e, test plan §6a "tests/unlocks.test.ts"; block "6D-3" there =
// 6D-4a in docs/specs/README.md §1): the shipped data/unlocks.json, normalizeUnlocks, unlockedIds,
// unlocksForLevels, unlocksForBadge, the validator in tools/validate-data.ts and the pure parts of
// the app layer (src/unlocks.ts: the active lists over the phone's union and the per-phone switches).
// No database is opened.
//
// Avatar maker: the critical reader of xp-levels.md put `avatar-maker` on level 3
// (AVATAR_MAKER_LEVEL), and "a critical-reader block wins over the text below it"
// (docs/specs/README.md). The §6a lines "unlockedIds on level 3 → {confetti-double}",
// "unlocksForLevels(1, 3) → [confetti-double]" and "unlocksForLevels(3, 8) → avatar-maker, …" date
// from before that move; here avatar-maker sits on level 3 with confetti-double.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import unlocksJson from '../data/unlocks.json';
import { badgesEnabled } from '../src/badges';
import { AVATAR_MAKER_LEVEL } from '../src/domain/avatar';
import { UNLOCK_KINDS, normalizeUnlocks, unlockedIds, unlocksForBadge, unlocksForLevels, type Unlock } from '../src/domain/unlocks';
import type { XpBadgeFact } from '../src/domain/xp';
import {
  activeConfettiStyles,
  activeFonts,
  activeTimerSounds,
  disabledUnlocks,
  isActive,
  unlockData,
  unlockedOnPhone,
} from '../src/unlocks';
import { UNLOCK_KIND_IDS, validateUnlocks } from '../tools/validate-data.ts';

type Obj = Record<string, unknown>;

const BADGES = JSON.parse(readFileSync(new URL('../data/badges.json', import.meta.url), 'utf8')) as Obj[];
const BADGE_IDS = BADGES.map((b) => String(b['id']));
const RETIRED_IDS = BADGES.filter((b) => b['retired'] === true).map((b) => String(b['id']));
const UNLOCKS = normalizeUnlocks(unlocksJson);
const NO_BADGES: XpBadgeFact[] = [];

const ids = (list: readonly Unlock[]): string[] => list.map((u) => u.id);
const badge = (id: string, level = 1): XpBadgeFact => ({ id, level, secret: false });

/** A valid level unlock (data shape). */
const levelUnlock = (over: Obj = {}): Obj => ({
  id: 'confetti-test',
  kind: 'confetti',
  by: { level: 4 },
  icon: '🎊',
  value: 'test',
  nl: { name: 'Test', description: 'Een test.' },
  en: { name: 'Test', description: 'A test.' },
  ...over,
});

describe('data/unlocks.json', () => {
  it('passes the validator: 15 unlocks, no errors, no warnings', () => {
    const r = validateUnlocks(unlocksJson, BADGE_IDS, RETIRED_IDS);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.lines).toBe(15);
    // Normalizing the shipped file drops nothing and keeps the file order.
    expect(ids(UNLOCKS)).toEqual(unlocksJson.map((u) => u.id));
  });

  it('is exactly the fixed list of §2e (ids, kinds, levels, badge, values, names)', () => {
    const rows = UNLOCKS.map((u) => [u.id, u.kind, u.by, u.value, u.nl.name, u.en.name]);
    expect(rows).toEqual([
      ['confetti-double', 'confetti', { level: 3 }, 'double', 'Dubbele confetti', 'Double confetti'],
      ['avatar-maker', 'feature', { level: 3 }, 'avatar', 'Avatar-maker', 'Avatar maker'],
      ['sound-cowbell', 'timerSound', { level: 5 }, 'cowbell', 'Koebel', 'Cowbell'],
      ['confetti-veggies', 'confetti', { level: 7 }, 'veggies', 'Groenteconfetti', 'Veggie confetti'],
      ['font-chalk', 'cookFont', { level: 8 }, 'chalk', 'Krijtbord', 'Chalkboard'],
      ['sound-gong', 'timerSound', { level: 10 }, 'gong', 'Gong', 'Gong'],
      ['confetti-party', 'confetti', { level: 12 }, 'party', 'Kippen en taartjes', 'Chickens and cakes'],
      ['sound-kitchen', 'timerSound', { level: 15 }, 'kitchen', 'Keukenwekker', 'Kitchen timer'],
      ['font-hand', 'cookFont', { level: 18 }, 'hand', 'Handschrift', 'Handwriting'],
      ['sound-cooked-tada', 'cookedSound', { level: 20 }, 'tada', 'Tadaa bij Gekookt!', 'Ta-da on Cooked!'],
      ['confetti-trex', 'confetti', { level: 25 }, 'trex', 'T-rex-confetti', 'T-rex confetti'],
      ['sound-fanfare', 'timerSound', { level: 30 }, 'fanfare', 'Fanfare', 'Fanfare'],
      ['confetti-gold', 'confetti', { level: 40 }, 'gold', 'Gouden confetti', 'Golden confetti'],
      ['confetti-stars', 'confetti', { level: 50 }, 'stars', 'Sterrenregen', 'Star shower'],
      ['confetti-fire', 'confetti', { badge: 'op-dreef' }, 'fire', 'Vlammetjes', 'Flames'],
    ]);
  });

  it('carries the descriptions of §2e word for word', () => {
    const d = Object.fromEntries(UNLOCKS.map((u) => [u.id, [u.nl.description, u.en.description]]));
    const timer = ['Een extra timergeluid, te kiezen onder Meer.', 'An extra timer sound, pick it under More.'];
    const font = ['Een ander lettertype in de kookstand.', 'Another typeface in cook mode.'];
    expect(d).toEqual({
      'confetti-double': ['Twee keer zoveel snippers bij Gekookt!', 'Twice the pieces on Cooked!'],
      'avatar-maker': ['Maak je eigen gezichtje; elk level geeft nieuwe onderdelen.', 'Make your own face; every level adds parts.'],
      'sound-cowbell': timer,
      'confetti-veggies': ['🥕🥦🍅🌽 in plaats van snippers.', '🥕🥦🍅🌽 instead of pieces.'],
      'font-chalk': font,
      'sound-gong': timer,
      'confetti-party': ['🐔🧁🎂 regenen uit de lucht.', '🐔🧁🎂 rain from the sky.'],
      'sound-kitchen': timer,
      'font-hand': font,
      'sound-cooked-tada': ['Een kort geluidje als je Gekookt! tikt.', 'A short sound when you tap Cooked!'],
      'confetti-trex': ['🦖 Het leven vindt een weg.', '🦖 Life finds a way.'],
      'sound-fanfare': timer,
      'confetti-gold': ['Alles goud bij Gekookt!', 'All gold on Cooked!'],
      'confetti-stars': ['⭐✨ voor een sterrenkok.', '⭐✨ for a star cook.'],
      'confetti-fire': ['🔥 Zo heet als je streak.', '🔥 As hot as your streak.'],
    });
    for (const u of UNLOCKS) expect(u.icon.trim()).not.toBe('');
  });

  it('opens the avatar maker on the same level as the avatar spec (AVATAR_MAKER_LEVEL)', () => {
    const maker = UNLOCKS.find((u) => u.id === 'avatar-maker');
    expect(maker?.by).toEqual({ level: AVATAR_MAKER_LEVEL });
    expect(AVATAR_MAKER_LEVEL).toBe(3);
  });

  it('the validator mirrors the kinds of src/domain/unlocks.ts', () => {
    expect([...UNLOCK_KIND_IDS]).toEqual([...UNLOCK_KINDS]);
  });
});

describe('normalizeUnlocks', () => {
  it('drops items without `by` or `value` (and other unusable ones), keeps the rest in order', () => {
    const out = normalizeUnlocks([
      levelUnlock({ id: 'keep-a' }),
      levelUnlock({ id: 'no-by', by: undefined }),
      levelUnlock({ id: 'no-value', value: undefined }),
      levelUnlock({ id: 'empty-value', value: '  ' }),
      levelUnlock({ id: 'bad-by', by: { level: 0 } }),
      levelUnlock({ id: 'big-level', by: { level: 101 } }),
      levelUnlock({ id: 'bad-kind', kind: 'sticker' }),
      levelUnlock({ id: 'Bad Id' }),
      levelUnlock({ id: 'no-icon', icon: '' }),
      levelUnlock({ id: 'no-en', en: { name: 'x' } }),
      levelUnlock({ id: 'keep-a', value: 'second' }),
      'not an object',
      null,
      levelUnlock({ id: 'keep-b', by: { badge: 'op-dreef' } }),
    ]);
    expect(ids(out)).toEqual(['keep-a', 'keep-b']);
    expect(out[0]?.value).toBe('test'); // a duplicate id: the first wins
  });

  it('reads a badge unlock with and without a tier; unknown keys are not carried', () => {
    const [plain, tiered, badTier] = normalizeUnlocks([
      levelUnlock({ id: 'a', by: { badge: 'kok' }, extra: true }),
      levelUnlock({ id: 'b', by: { badge: 'kok', level: 3 } }),
      levelUnlock({ id: 'c', by: { badge: 'kok', level: 9 } }),
    ]);
    expect(plain?.by).toEqual({ badge: 'kok' });
    expect(plain && 'extra' in plain).toBe(false);
    expect(tiered?.by).toEqual({ badge: 'kok', level: 3 });
    expect(badTier?.by).toEqual({ badge: 'kok' }); // an invalid tier is dropped: tier 1 counts
  });

  it('is [] for anything that is not an array', () => {
    expect(normalizeUnlocks(undefined)).toEqual([]);
    expect(normalizeUnlocks({})).toEqual([]);
    expect(normalizeUnlocks('x')).toEqual([]);
  });
});

describe('unlockedIds', () => {
  it('level 1 has nothing; level 3 has double confetti and the avatar maker', () => {
    expect(unlockedIds(UNLOCKS, { level: 1, badges: NO_BADGES })).toEqual(new Set());
    expect(unlockedIds(UNLOCKS, { level: 3, badges: NO_BADGES })).toEqual(new Set(['confetti-double', 'avatar-maker']));
  });

  it('level 25 without badges → 11 ids', () => {
    const got = unlockedIds(UNLOCKS, { level: 25, badges: NO_BADGES });
    expect(got.size).toBe(11);
    expect(got.has('confetti-trex')).toBe(true);
    expect(got.has('sound-fanfare')).toBe(false);
    expect(got.has('confetti-fire')).toBe(false);
  });

  it('the badge op-dreef adds confetti-fire (any tier, also on level 1)', () => {
    expect(unlockedIds(UNLOCKS, { level: 25, badges: [badge('op-dreef')] }).size).toBe(12);
    expect(unlockedIds(UNLOCKS, { level: 1, badges: [badge('op-dreef', 4)] })).toEqual(new Set(['confetti-fire']));
    expect(unlockedIds(UNLOCKS, { level: 1, badges: [badge('huiskok', 8)] })).toEqual(new Set());
  });

  it('level 100 with op-dreef → all 15', () => {
    expect(unlockedIds(UNLOCKS, { level: 100, badges: [badge('op-dreef')] }).size).toBe(15);
  });

  it('a badge unlock with a tier needs that tier', () => {
    const list = normalizeUnlocks([levelUnlock({ id: 'kok-3', by: { badge: 'kok', level: 3 } })]);
    expect(unlockedIds(list, { level: 100, badges: [badge('kok', 2)] }).size).toBe(0);
    expect(unlockedIds(list, { level: 1, badges: [badge('kok', 3)] })).toEqual(new Set(['kok-3']));
    expect(unlockedIds(list, { level: 1, badges: [badge('kok', 8)] })).toEqual(new Set(['kok-3']));
  });
});

describe('unlocksForLevels', () => {
  it('(1, 3] → double confetti and the avatar maker, in file order', () => {
    expect(ids(unlocksForLevels(UNLOCKS, 1, 3))).toEqual(['confetti-double', 'avatar-maker']);
  });

  it('(3, 8] → cowbell, veggie confetti, chalkboard, in file order', () => {
    expect(ids(unlocksForLevels(UNLOCKS, 3, 8))).toEqual(['sound-cowbell', 'confetti-veggies', 'font-chalk']);
  });

  it('a level without an unlock gives nothing; badge unlocks are never in here', () => {
    expect(unlocksForLevels(UNLOCKS, 3, 4)).toEqual([]);
    expect(unlocksForLevels(UNLOCKS, 5, 5)).toEqual([]);
    expect(ids(unlocksForLevels(UNLOCKS, 1, 100))).toHaveLength(14);
    expect(ids(unlocksForLevels(UNLOCKS, 1, 100))).not.toContain('confetti-fire');
  });
});

describe('unlocksForBadge', () => {
  it('op-dreef gives confetti-fire; another badge gives nothing', () => {
    expect(ids(unlocksForBadge(UNLOCKS, badge('op-dreef')))).toEqual(['confetti-fire']);
    expect(ids(unlocksForBadge(UNLOCKS, badge('op-dreef', 8)))).toEqual(['confetti-fire']);
    expect(unlocksForBadge(UNLOCKS, badge('huiskok', 8))).toEqual([]);
  });

  it('respects the tier a badge unlock needs', () => {
    const list = normalizeUnlocks([levelUnlock({ id: 'kok-3', by: { badge: 'kok', level: 3 } })]);
    expect(unlocksForBadge(list, badge('kok', 2))).toEqual([]);
    expect(ids(unlocksForBadge(list, badge('kok', 3)))).toEqual(['kok-3']);
  });
});

describe('validateUnlocks', () => {
  const errorsOf = (items: Obj[]): string[] => validateUnlocks(items, BADGE_IDS, RETIRED_IDS).errors;

  it('a valid level and badge unlock pass without errors or warnings', () => {
    const r = validateUnlocks([levelUnlock(), levelUnlock({ id: 'fire-2', by: { badge: 'op-dreef', level: 2 } })], BADGE_IDS, RETIRED_IDS);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('a duplicate id is an error', () => {
    const errors = errorsOf([levelUnlock(), levelUnlock()]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/duplicate id/);
  });

  it('by.level 1 or 101 is an error', () => {
    for (const level of [1, 101, 2.5]) {
      const errors = errorsOf([levelUnlock({ by: { level } })]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/"by\.level" must be an integer 2…100/);
    }
    expect(errorsOf([levelUnlock({ by: { level: 2 } })])).toEqual([]);
    expect(errorsOf([levelUnlock({ by: { level: 100 } })])).toEqual([]);
  });

  it('an unknown badge is an error; a badge tier outside 1…8 too', () => {
    const unknown = errorsOf([levelUnlock({ by: { badge: 'bestaat-niet' } })]);
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatch(/not a badge id/);
    const tier = errorsOf([levelUnlock({ by: { badge: 'op-dreef', level: 9 } })]);
    expect(tier).toHaveLength(1);
    expect(tier[0]).toMatch(/badge tier/);
  });

  it('an empty value is an error; so is an empty icon', () => {
    const value = errorsOf([levelUnlock({ value: '' })]);
    expect(value).toHaveLength(1);
    expect(value[0]).toMatch(/"value" must be a non-empty string/);
    const icon = errorsOf([levelUnlock({ icon: ' ' })]);
    expect(icon).toHaveLength(1);
    expect(icon[0]).toMatch(/"icon" must be a non-empty string/);
  });

  it('an unknown kind, a bad id, a missing by and an empty language are errors', () => {
    expect(errorsOf([levelUnlock({ kind: 'sticker' })])[0]).toMatch(/"kind" must be one of/);
    expect(errorsOf([levelUnlock({ id: 'Confetti Test' })])[0]).toMatch(/kebab-case/);
    expect(errorsOf([levelUnlock({ by: undefined })])[0]).toMatch(/"by" must be/);
    const lang = errorsOf([levelUnlock({ en: { name: 'Test', description: '' } })]);
    expect(lang).toHaveLength(1);
    expect(lang[0]).toMatch(/"en\.description"/);
    expect(errorsOf([levelUnlock({ nl: undefined })])[0]).toMatch(/"nl" must be/);
  });

  it('a non-array is an error; stray keys and a retired badge are warnings', () => {
    expect(validateUnlocks({}, BADGE_IDS).errors).toHaveLength(1);
    const r = validateUnlocks([levelUnlock({ extra: 1 })], BADGE_IDS, RETIRED_IDS);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    const retired = RETIRED_IDS[0];
    expect(retired).toBeDefined();
    const w = validateUnlocks([levelUnlock({ by: { badge: retired } })], BADGE_IDS, RETIRED_IDS);
    expect(w.errors).toEqual([]);
    expect(w.warnings[0]).toMatch(/retired/);
  });
});

describe('src/unlocks.ts (pure parts: the phone union, switches and active lists)', () => {
  afterEach(() => {
    unlockedOnPhone.value = new Set();
    disabledUnlocks.value = new Set();
    badgesEnabled.value = true;
  });

  it('unlockData() is the normalized data file', () => {
    expect(unlockData()).toEqual(UNLOCKS);
    expect(unlockData()).toBe(unlockData()); // module cache
  });

  it('nothing unlocked → only the standard choices', () => {
    expect(activeConfettiStyles()).toEqual(['default']);
    expect(activeTimerSounds()).toEqual(['beeps', 'bell', 'melody', 'off']);
    expect(activeFonts()).toEqual(['default']);
    expect(isActive('confetti-double')).toBe(false);
  });

  it('active = unlocked on this phone and not switched off; lists in file order', () => {
    unlockedOnPhone.value = unlockedIds(UNLOCKS, { level: 25, badges: [badge('op-dreef')] });
    expect(activeConfettiStyles()).toEqual(['default', 'double', 'veggies', 'party', 'trex', 'fire']);
    expect(activeTimerSounds()).toEqual(['beeps', 'bell', 'melody', 'off', 'cowbell', 'gong', 'kitchen']);
    expect(activeFonts()).toEqual(['default', 'chalk', 'hand']);
    expect(isActive('sound-cooked-tada')).toBe(true);

    disabledUnlocks.value = new Set(['confetti-double', 'sound-gong', 'font-chalk', 'sound-cooked-tada']);
    expect(isActive('confetti-double')).toBe(false);
    expect(isActive('sound-cooked-tada')).toBe(false);
    expect(activeConfettiStyles()).toEqual(['default', 'veggies', 'party', 'trex', 'fire']);
    expect(activeTimerSounds()).toEqual(['beeps', 'bell', 'melody', 'off', 'cowbell', 'kitchen']);
    expect(activeFonts()).toEqual(['default', 'hand']);
  });

  it('badges off → the active lists hold only the standard choices (nothing new to see)', () => {
    unlockedOnPhone.value = unlockedIds(UNLOCKS, { level: 100, badges: [badge('op-dreef')] });
    badgesEnabled.value = false;
    expect(activeConfettiStyles()).toEqual(['default']);
    expect(activeTimerSounds()).toEqual(['beeps', 'bell', 'melody', 'off']);
    expect(activeFonts()).toEqual(['default']);
  });
});
