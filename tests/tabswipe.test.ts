// V8 (docs/specs/verbeterronde-8.md §1a): the pure part of swiping between the five tabs.
import { describe, expect, it } from 'vitest';
import {
  EDGE_PX,
  SWIPE_MIN_PX,
  SWIPE_RATIO,
  TAB_PATHS,
  WRAP_AROUND,
  isTabPath,
  neighbourTab,
  startsAtEdge,
  tabSwipeDirection,
} from '../src/domain/tabswipe';

describe('constants', () => {
  it('follow the spec and the bottom bar', () => {
    expect(TAB_PATHS).toEqual(['/', '/recipes', '/week', '/shopping', '/more']);
    expect(SWIPE_MIN_PX).toBe(60);
    expect(SWIPE_RATIO).toBe(2);
    expect(EDGE_PX).toBe(24);
    expect(WRAP_AROUND).toBe(false);
  });
});

describe('isTabPath', () => {
  it('accepts exactly the five tab paths', () => {
    for (const p of TAB_PATHS) expect(isTabPath(p)).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isTabPath('/recipes?q=x')).toBe(false);
    expect(isTabPath('/recipe/12')).toBe(false);
    expect(isTabPath('/cook/12')).toBe(false);
    expect(isTabPath('/inbox')).toBe(false);
    expect(isTabPath('/more/storage')).toBe(false);
    expect(isTabPath('')).toBe(false);
    expect(isTabPath('/recipes/')).toBe(false);
  });
});

describe('tabSwipeDirection', () => {
  it('counts exactly 60 px sideways', () => {
    expect(tabSwipeDirection(-60, 0)).toBe('left');
    expect(tabSwipeDirection(60, 0)).toBe('right');
  });
  it('ignores less than 60 px', () => {
    expect(tabSwipeDirection(-59, 0)).toBeNull();
    expect(tabSwipeDirection(59, 0)).toBeNull();
    expect(tabSwipeDirection(0, 0)).toBeNull();
  });
  it('60 px sideways with 30 px up is a swipe, with 31 px it is not', () => {
    expect(tabSwipeDirection(-60, -30)).toBe('left');
    expect(tabSwipeDirection(60, -30)).toBe('right');
    expect(tabSwipeDirection(-60, -31)).toBeNull();
    expect(tabSwipeDirection(60, 31)).toBeNull();
  });
  it('a mostly vertical move is never a swipe', () => {
    expect(tabSwipeDirection(80, 200)).toBeNull();
    expect(tabSwipeDirection(-100, -100)).toBeNull();
  });
  it('a long clear swipe counts both ways', () => {
    expect(tabSwipeDirection(-200, 20)).toBe('left');
    expect(tabSwipeDirection(200, -20)).toBe('right');
  });
});

describe('startsAtEdge', () => {
  it('treats the 24 px at the left as the edge', () => {
    expect(startsAtEdge(0, 400)).toBe(true);
    expect(startsAtEdge(23, 400)).toBe(true);
    expect(startsAtEdge(24, 400)).toBe(false);
    expect(startsAtEdge(25, 400)).toBe(false);
  });
  it('treats the 24 px at the right as the edge', () => {
    expect(startsAtEdge(400 - 23, 400)).toBe(true);
    expect(startsAtEdge(400 - 24, 400)).toBe(false);
    expect(startsAtEdge(400 - 25, 400)).toBe(false);
    expect(startsAtEdge(400, 400)).toBe(true);
  });
  it('the middle is never the edge', () => {
    expect(startsAtEdge(200, 400)).toBe(false);
  });
});

describe('neighbourTab', () => {
  it('left goes to the next tab, right to the previous one', () => {
    expect(neighbourTab('/', 'left')).toBe('/recipes');
    expect(neighbourTab('/recipes', 'left')).toBe('/week');
    expect(neighbourTab('/week', 'left')).toBe('/shopping');
    expect(neighbourTab('/shopping', 'left')).toBe('/more');
    expect(neighbourTab('/more', 'right')).toBe('/shopping');
    expect(neighbourTab('/recipes', 'right')).toBe('/');
  });
  it('stops at the ends', () => {
    expect(neighbourTab('/', 'right')).toBeNull();
    expect(neighbourTab('/more', 'left')).toBeNull();
  });
  it('is null outside the tab paths', () => {
    expect(neighbourTab('/recipes?q=x', 'left')).toBeNull();
    expect(neighbourTab('/recipe/12', 'right')).toBeNull();
    expect(neighbourTab('/inbox', 'left')).toBeNull();
  });
  it('wraps around when forced', () => {
    expect(neighbourTab('/', 'right', true)).toBe('/more');
    expect(neighbourTab('/more', 'left', true)).toBe('/');
    expect(neighbourTab('/week', 'left', true)).toBe('/shopping');
    expect(neighbourTab('/inbox', 'left', true)).toBeNull();
  });
});
