// V8 (docs/specs/verbeterronde-8.md §1a): the pure part of swiping between the five bottom-nav tabs.
// Framework-free: numbers and paths only. The dom side (touch listeners, slide animation) is
// src/tabswipe.ts.

/** The order of the bottom bar (src/components/Nav.tsx `TABS`). */
export const TAB_PATHS = ['/', '/recipes', '/week', '/shopping', '/more'] as const;

/** Minimum sideways travel in px that counts as a tab swipe. */
export const SWIPE_MIN_PX = 60;
/** The sideways travel must be more than this many times the vertical travel. */
export const SWIPE_RATIO = 2;
/** A touch that starts within this many px of the left or right edge is the system back gesture. */
export const EDGE_PX = 24;
/** Stop at Home and More instead of wrapping around. */
export const WRAP_AROUND = false;

/** 'left' = the finger went left (next tab), 'right' = the finger went right (previous tab). */
export type TabSwipeDirection = 'left' | 'right';

/** True for exactly one of the five tab paths (the caller passes `route.path`, without a query). */
export function isTabPath(path: string): boolean {
  return (TAB_PATHS as readonly string[]).includes(path);
}

/**
 * The direction of a finished touch, or null when it is no tab swipe: at least SWIPE_MIN_PX
 * sideways and clearly more sideways than vertical (60 px sideways with 30 px vertical still counts,
 * with 31 px it does not).
 */
export function tabSwipeDirection(dx: number, dy: number): TabSwipeDirection | null {
  const ax = Math.abs(dx);
  if (ax < SWIPE_MIN_PX) return null;
  if (ax < SWIPE_RATIO * Math.abs(dy)) return null;
  return dx < 0 ? 'left' : 'right';
}

/** True when a touch starting at `x` lies in the edge zone of the system back gesture. */
export function startsAtEdge(x: number, viewportWidth: number): boolean {
  return x < EDGE_PX || x > viewportWidth - EDGE_PX;
}

/**
 * The tab a swipe leads to: 'left' = the next one in TAB_PATHS, 'right' = the previous one.
 * Past either end: null (or around when `wrap` is true). Not a tab path: null.
 */
export function neighbourTab(path: string, dir: TabSwipeDirection, wrap: boolean = WRAP_AROUND): string | null {
  const i = (TAB_PATHS as readonly string[]).indexOf(path);
  if (i < 0) return null;
  const n = TAB_PATHS.length;
  const j = dir === 'left' ? i + 1 : i - 1;
  if (j >= 0 && j < n) return TAB_PATHS[j] ?? null;
  if (!wrap) return null;
  return TAB_PATHS[(j + n) % n] ?? null;
}
