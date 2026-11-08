// Confetti style choice (docs/specs/badges-avatar.md block 6D-S, S-B.2 and S-B.6): the pure
// `pickConfettiStyle(setting, active, at, mix?)` behind celebrate(), and `usableConfettiStyles()`
// over the phone's unlocks. No database is opened.
import { afterEach, describe, expect, it } from 'vitest';
import { badgesEnabled } from '../src/badges';
import { DEFAULT_CONFETTI_STYLE, pickConfettiStyle, RANDOM_CONFETTI_STYLE, usableConfettiStyles } from '../src/celebrate';
import { hash32 } from '../src/domain/xp';
import { disabledUnlocks, unlockedOnPhone } from '../src/unlocks';

const ACTIVE = ['default', 'double', 'veggies', 'trex'];

describe('pickConfettiStyle', () => {
  it("'random' → the rotation over the active styles, deterministic per burst (as before 6D-S)", () => {
    const seen = new Set<string>();
    for (let at = 1; at <= 200; at++) {
      const s = pickConfettiStyle(RANDOM_CONFETTI_STYLE, ACTIVE, at);
      expect(s).toBe(ACTIVE[hash32(String(at)) % ACTIVE.length]);
      seen.add(s);
    }
    expect(seen.size).toBe(ACTIVE.length); // it really varies
  });

  it('an active style id → always that style', () => {
    for (const at of [1, 2, 3, 1_700_000_000_000]) {
      expect(pickConfettiStyle('trex', ACTIVE, at)).toBe('trex');
      expect(pickConfettiStyle('default', ACTIVE, at)).toBe('default');
    }
  });

  it('a style id that is not active (locked, unknown) → the rotation', () => {
    for (let at = 1; at <= 50; at++) {
      expect(pickConfettiStyle('gold', ACTIVE, at)).toBe(pickConfettiStyle(RANDOM_CONFETTI_STYLE, ACTIVE, at));
    }
  });

  it('the chosen style ignores the mix; "Verras me" rotates over the mix only', () => {
    const mix = ['default', 'veggies'];
    expect(pickConfettiStyle('trex', ACTIVE, 7, mix)).toBe('trex');
    for (let at = 1; at <= 50; at++) expect(mix).toContain(pickConfettiStyle(RANDOM_CONFETTI_STYLE, ACTIVE, at, mix));
  });

  it("nothing at all to pick from → 'default'", () => {
    expect(pickConfettiStyle(RANDOM_CONFETTI_STYLE, [], 5)).toBe(DEFAULT_CONFETTI_STYLE);
    expect(pickConfettiStyle('trex', [], 5)).toBe(DEFAULT_CONFETTI_STYLE);
  });
});

describe('usableConfettiStyles', () => {
  afterEach(() => {
    unlockedOnPhone.value = new Set();
    disabledUnlocks.value = new Set();
    badgesEnabled.value = true;
  });

  it("'default' plus the unlocked confetti styles, also when switched out of the mix", () => {
    unlockedOnPhone.value = new Set(['confetti-double', 'confetti-trex', 'sound-gong']);
    disabledUnlocks.value = new Set(['confetti-trex']);
    expect(usableConfettiStyles()).toEqual(['default', 'double', 'trex']);
  });

  it("badges off → only 'default'", () => {
    unlockedOnPhone.value = new Set(['confetti-double', 'confetti-trex']);
    badgesEnabled.value = false;
    expect(usableConfettiStyles()).toEqual(['default']);
  });
});
