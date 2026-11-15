// V1c-10c (docs/specs/ei-gabi.md §1g): the leopard print follows the page at half speed, wrapped on
// the tile. Only the pure parts: the offset and the "is this a screen" test.
import { describe, expect, it } from 'vitest';
import { PANTER_TILE_PX, PARALLAX_FACTOR, panterOffset, scrolledScreen } from '../src/panter-parallax';

describe('panterOffset (V1c-10c)', () => {
  it('is half the scroll, negative, and 0 at the top', () => {
    expect(PARALLAX_FACTOR).toBe(0.5);
    expect(panterOffset(0)).toBe(0);
    expect(panterOffset(100)).toBe(-50);
    expect(panterOffset(301)).toBe(-150.5);
  });

  it('wraps on the tile height, so a long list never needs a taller layer', () => {
    expect(PANTER_TILE_PX).toBe(216);
    expect(panterOffset(432)).toBe(0); // 432 / 2 = 216 = one tile
    expect(Object.is(panterOffset(432), -0)).toBe(false);
    expect(panterOffset(500)).toBe(-34);
    expect(panterOffset(11_000)).toBe(-((5500) % 216));
  });

  it('treats a negative or broken scroll position (rubber band, NaN) as the top', () => {
    expect(panterOffset(-40)).toBe(0);
    expect(panterOffset(Number.NaN)).toBe(0);
  });
});

describe('scrolledScreen', () => {
  it('only follows a .screen element', () => {
    expect(scrolledScreen(null)).toBeNull();
    expect(scrolledScreen({} as EventTarget)).toBeNull();
  });
});
