// The level-up sheet's avatar line (docs/specs/opschoonronde.md §2A.2): at most two names, then
// "+{n}" for the rest; unfolded = every name; two or fewer = no button.
import { describe, expect, it } from 'vitest';
import { avatarPartsLine, LEVELUP_PARTS_SHOWN } from '../src/components/LevelUpSheet';

describe('avatarPartsLine', () => {
  const thirteen = ['snor', 'bril', ...Array.from({ length: 11 }, (_, i) => `deel ${i + 1}`)];

  it('shows two names and counts the rest behind the button', () => {
    expect(LEVELUP_PARTS_SHOWN).toBe(2);
    expect(avatarPartsLine(thirteen, false)).toEqual({ shown: ['snor', 'bril'], more: 11 });
  });

  it('unfolded shows every name and no button', () => {
    expect(avatarPartsLine(thirteen, true)).toEqual({ shown: thirteen, more: 0 });
  });

  it('two or fewer parts: all names, no button', () => {
    expect(avatarPartsLine(['snor', 'bril'], false)).toEqual({ shown: ['snor', 'bril'], more: 0 });
    expect(avatarPartsLine(['snor'], false)).toEqual({ shown: ['snor'], more: 0 });
    expect(avatarPartsLine([], false)).toEqual({ shown: [], more: 0 });
  });

  it('three parts: two names and +1', () => {
    expect(avatarPartsLine(['a', 'b', 'c'], false)).toEqual({ shown: ['a', 'b'], more: 1 });
  });
});
