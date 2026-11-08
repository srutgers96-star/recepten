// V5 §1d: the gold theme and the maker's egg (pure functions of src/theme.ts).
import { describe, expect, it } from 'vitest';
import { effectiveTheme, goldAvailable, GOLD_COUNT_FROM, GOLD_TAPS, GOLD_THEME_UNLOCK, isTheme, tapCounter, tapsLeft, type TapCount } from '../src/theme';
import { goldTileShown, type StyleState } from '../src/screens/StyleScreen';

function tapRun(n: number, gapMs: number, t0 = 1000): TapCount {
  let c: TapCount | null = null;
  for (let i = 0; i < n; i++) c = tapCounter(c, t0 + i * gapMs);
  return c!;
}

describe('tapCounter', () => {
  it('starts at 1 and counts taps less than 2 s apart', () => {
    expect(tapCounter(null, 5000)).toEqual({ count: 1, lastMs: 5000 });
    expect(tapCounter({ count: 4, lastMs: 5000 }, 6999)).toEqual({ count: 5, lastMs: 6999 });
  });

  it('starts again at 1 after a pause of more than 2 s', () => {
    expect(tapCounter({ count: 32, lastMs: 5000 }, 8000)).toEqual({ count: 1, lastMs: 8000 });
    expect(tapCounter({ count: 32, lastMs: 5000 }, 7001).count).toBe(1);
  });

  it('reaches 33 (gold free) with 33 quick taps; 32 taps and 3 s waiting restart the count', () => {
    const run = tapRun(33, 300);
    expect(run.count).toBe(GOLD_TAPS);
    expect(tapsLeft(run.count)).toBe(0);
    const almost = tapRun(32, 300);
    expect(almost.count).toBe(32);
    expect(tapCounter(almost, almost.lastMs + 3000).count).toBe(1);
  });

  it('counts down from tap 25: "nog 8 keer"', () => {
    expect(GOLD_COUNT_FROM).toBe(25);
    expect(tapsLeft(25)).toBe(8);
    expect(tapsLeft(32)).toBe(1);
    expect(tapsLeft(40)).toBe(0);
  });
});

describe('gold theme', () => {
  it('knows gold as a theme', () => {
    expect(isTheme('gold')).toBe(true);
    expect(isTheme('golden')).toBe(false);
  });

  it('falls back to system while gold is not free', () => {
    expect(effectiveTheme('gold', false)).toBe('system');
    expect(effectiveTheme('gold', true)).toBe('gold');
    expect(effectiveTheme('dark', false)).toBe('dark');
  });
});

describe('goldAvailable (Fable 8 Nov: mirror at cold start, badges off → only the egg)', () => {
  const base = { unlockActive: false, badgesOn: true, byMaker: false, mirror: false, unlocksSeen: true, eggRead: true };

  it('the level-100 unlock counts only while badges are on', () => {
    expect(goldAvailable({ ...base, unlockActive: true })).toBe(true);
    expect(goldAvailable({ ...base, unlockActive: true, badgesOn: false })).toBe(false);
  });

  it("the maker's egg counts with badges off too", () => {
    expect(goldAvailable({ ...base, byMaker: true, badgesOn: false })).toBe(true);
  });

  it('the mirror counts until both the unlocks and the egg setting are read', () => {
    expect(goldAvailable({ ...base, mirror: true, unlocksSeen: false, eggRead: false })).toBe(true);
    expect(goldAvailable({ ...base, mirror: true, unlocksSeen: true, eggRead: false })).toBe(true);
    expect(goldAvailable({ ...base, mirror: true, unlocksSeen: true, eggRead: true })).toBe(false);
  });
});

describe('goldTileShown', () => {
  const s = (over: Partial<StyleState>): StyleState => ({
    badgesOn: true,
    unlocks: [],
    unlocked: new Set(),
    disabled: new Set(),
    timerSound: 'beeps',
    cookedSound: true,
    confettiStyle: 'random',
    cookFont: 'default',
    theme: 'system',
    ...over,
  });

  it('badges off hides the level-100 gold tile, not the egg one', () => {
    expect(goldTileShown(s({ badgesOn: false, unlocked: new Set([GOLD_THEME_UNLOCK]) }))).toBe(false);
    expect(goldTileShown(s({ badgesOn: false, goldByMaker: true }))).toBe(true);
    expect(goldTileShown(s({ badgesOn: true, unlocked: new Set([GOLD_THEME_UNLOCK]) }))).toBe(true);
  });
});
