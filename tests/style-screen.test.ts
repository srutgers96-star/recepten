// Jouw stijl (docs/specs/badges-avatar.md block 6D-S, S-B.1 and S-B.6): the pure tile model of
// src/screens/StyleScreen.tsx — which tiles per tab, locked/unlocked/chosen, 'off' last, the
// confetti mix, and badges off → only Geluiden (the four base sounds) and Thema (Fable, 8 Nov).
import { describe, expect, it } from 'vitest';
import unlocksJson from '../data/unlocks.json';
import { normalizeUnlocks, unlockedIds } from '../src/domain/unlocks';
import { initialStyleTab, STYLE_TABS, styleTabs, styleTiles, TIMER_SOUND_TILES, type StyleState, type StyleTile } from '../src/screens/StyleScreen';

const UNLOCKS = normalizeUnlocks(unlocksJson);

function state(over: Partial<StyleState> = {}): StyleState {
  return {
    badgesOn: true,
    unlocks: UNLOCKS,
    unlocked: new Set(),
    disabled: new Set(),
    timerSound: 'beeps',
    cookedSound: true,
    confettiStyle: 'random',
    cookFont: 'default',
    theme: 'system',
    ...over,
  };
}

const atLevel = (level: number, over: Partial<StyleState> = {}): StyleState => state({ unlocked: unlockedIds(UNLOCKS, { level, badges: [] }), ...over });
const values = (tiles: StyleTile[]): string[] => tiles.map((x) => x.value);
const find = (tiles: StyleTile[], value: string): StyleTile => {
  const x = tiles.find((t) => t.value === value);
  if (!x) throw new Error(`no tile ${value}`);
  return x;
};
const onValues = (tiles: StyleTile[]): string[] => tiles.filter((x) => x.on).map((x) => x.value);

describe('tabs', () => {
  it('Avatar · Geluiden · Confetti · Letters · Thema; badges off → Geluiden and Thema', () => {
    expect([...STYLE_TABS]).toEqual(['avatar', 'sounds', 'confetti', 'fonts', 'theme']);
    expect(styleTabs(true)).toEqual(['avatar', 'sounds', 'confetti', 'fonts', 'theme']);
    expect(styleTabs(false)).toEqual(['sounds', 'theme']);
  });

  it('?tab= wins over the remembered tab; unknown values fall back to the first tab', () => {
    const tabs = styleTabs(true);
    expect(initialStyleTab(tabs, 'confetti', 'fonts')).toBe('confetti');
    expect(initialStyleTab(tabs, null, 'fonts')).toBe('fonts');
    expect(initialStyleTab(tabs, 'nope', 'also-nope')).toBe('avatar');
    expect(initialStyleTab(styleTabs(false), 'confetti', 'theme')).toBe('theme');
    expect(initialStyleTab(styleTabs(false), 'nope', null)).toBe('sounds');
  });
});

describe('styleTiles', () => {
  it('Avatar has no tiles', () => {
    expect(styleTiles('avatar', atLevel(50))).toEqual([]);
  });

  it("Geluiden: every TimerSound, 'off' last, then the ta-da tile", () => {
    const tiles = styleTiles('sounds', atLevel(1));
    expect(values(tiles.filter((x) => x.group === 'timerSound'))).toEqual(['beeps', 'bell', 'melody', 'cowbell', 'gong', 'kitchen', 'fanfare', 'off']);
    expect([...TIMER_SOUND_TILES].pop()).toBe('off');
    expect(tiles.at(-1)?.group).toBe('cookedSound');
    expect(tiles.at(-1)?.unlock?.id).toBe('sound-cooked-tada');
  });

  it('Geluiden: locked until the level; standard sounds never locked; the chosen one is on', () => {
    const low = styleTiles('sounds', atLevel(5, { timerSound: 'cowbell' }));
    expect(find(low, 'beeps').locked).toBe(false);
    expect(find(low, 'off').locked).toBe(false);
    expect(find(low, 'cowbell').locked).toBe(false);
    expect(find(low, 'kitchen').locked).toBe(true);
    expect(find(low, 'kitchen').unlock?.by).toEqual({ level: 15 });
    expect(find(low, 'tada').locked).toBe(true);
    expect(onValues(low)).toEqual(['cowbell']);
    expect(find(low, 'beeps').rarity).toBe('common');
    expect(find(low, 'fanfare').rarity).toBe('epic');

    const off = styleTiles('sounds', atLevel(25, { timerSound: 'off', cookedSound: true }));
    expect(onValues(off)).toEqual(['off', 'tada']);
    // Ta-da switched off on this phone (unlocks.disabled) or by its own setting: not on.
    expect(find(styleTiles('sounds', atLevel(25, { disabled: new Set(['sound-cooked-tada']) })), 'tada').on).toBe(false);
    expect(find(styleTiles('sounds', atLevel(25, { cookedSound: false })), 'tada').on).toBe(false);
  });

  it("Confetti: 'Verras me', 'default', then every confetti unlock in file order", () => {
    const tiles = styleTiles('confetti', atLevel(1));
    expect(values(tiles)).toEqual(['random', 'default', 'double', 'veggies', 'party', 'trex', 'gold', 'stars', 'fire']);
    expect(onValues(tiles)).toEqual(['random']);
    expect(find(tiles, 'trex').locked).toBe(true);
    expect(find(tiles, 'fire').unlock?.by).toEqual({ badge: 'op-dreef' });
    expect(find(tiles, 'gold').rarity).toBe('legendary');
  });

  it('Confetti: a chosen usable style is on; a locked or unknown one shows Verras me', () => {
    expect(onValues(styleTiles('confetti', atLevel(25, { confettiStyle: 'trex' })))).toEqual(['trex']);
    expect(onValues(styleTiles('confetti', atLevel(25, { confettiStyle: 'default' })))).toEqual(['default']);
    expect(onValues(styleTiles('confetti', atLevel(10, { confettiStyle: 'trex' })))).toEqual(['random']);
    expect(onValues(styleTiles('confetti', atLevel(25, { confettiStyle: 'nope' })))).toEqual(['random']);
    // Out of the mix: the chosen style ignores the mix and stays on.
    expect(onValues(styleTiles('confetti', atLevel(25, { confettiStyle: 'trex', disabled: new Set(['confetti-trex']) })))).toEqual(['trex']);
  });

  it('Confetti: the ☑/☐ mix state only on unlocked unlock tiles', () => {
    const tiles = styleTiles('confetti', atLevel(12, { disabled: new Set(['confetti-veggies']) }));
    expect(find(tiles, 'random').inMix).toBeNull();
    expect(find(tiles, 'default').inMix).toBeNull();
    expect(find(tiles, 'double').inMix).toBe(true);
    expect(find(tiles, 'veggies').inMix).toBe(false);
    expect(find(tiles, 'trex').inMix).toBeNull(); // locked
  });

  it('Letters: Standaard · Krijtbord · Handschrift, locked until their level, cook.font is on', () => {
    const tiles = styleTiles('fonts', atLevel(8, { cookFont: 'chalk' }));
    expect(values(tiles)).toEqual(['default', 'chalk', 'hand']);
    expect(tiles.map((x) => x.locked)).toEqual([false, false, true]);
    expect(onValues(tiles)).toEqual(['chalk']);
  });

  it('Thema: Systeem · Licht · Donker, nothing locked, no gold tile; works with badges off too', () => {
    for (const badgesOn of [true, false]) {
      const tiles = styleTiles('theme', state({ badgesOn, theme: 'dark' }));
      expect(values(tiles)).toEqual(['system', 'light', 'dark']);
      expect(tiles.every((x) => !x.locked && x.rarity === 'common')).toBe(true);
      expect(onValues(tiles)).toEqual(['dark']);
    }
  });

  it('badges off → Geluiden keeps only the four base sounds; avatar, confetti and fonts are empty', () => {
    const off = atLevel(100, { badgesOn: false });
    for (const tab of ['avatar', 'confetti', 'fonts'] as const) expect(styleTiles(tab, off)).toEqual([]);
    const sounds = styleTiles('sounds', off);
    expect(sounds.map((t) => t.value)).toEqual(['beeps', 'bell', 'melody', 'off']);
    expect(sounds.every((t) => !t.locked)).toBe(true);
  });

  it('a chosen typeface or timer sound that is locked stays on (the app still uses it)', () => {
    const fonts = styleTiles('fonts', atLevel(1, { cookFont: 'hand' }));
    expect(find(fonts, 'hand').locked).toBe(true);
    expect(onValues(fonts)).toEqual(['hand']);
    const sounds = styleTiles('sounds', atLevel(1, { timerSound: 'kitchen' }));
    expect(find(sounds, 'kitchen').locked).toBe(true);
    expect(onValues(sounds.filter((x) => x.group === 'timerSound'))).toEqual(['kitchen']);
  });

  it('a locked ta-da is never on, even when its setting says so (it only plays while unlocked)', () => {
    expect(find(styleTiles('sounds', atLevel(1, { cookedSound: true })), 'tada').on).toBe(false);
  });
});
