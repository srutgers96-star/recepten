// V8 (docs/specs/verbeterronde-8.md §1b): swipe sideways across one of the five tab pages to go
// to the next (finger left) or previous (finger right) tab, in the order of the bottom bar.
// Touch only (a mouse or pen never swipes), like src/pulldown.ts and NOT like src/swipe.ts: pointer
// events get `pointercancel` as soon as the browser starts scrolling vertically, which is the normal
// gesture on these pages. All listeners are passive (no preventDefault): the browser keeps
// scrolling, and the decision falls at `touchend` on the distance travelled. Never at the screen
// edge (the iOS/Android back gesture), never in a text field, a sheet, selection mode or on an
// element that scrolls sideways itself. History follows `navigateTab`, exactly like a tap on the bar.
import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { isTabPath, neighbourTab, startsAtEdge, tabSwipeDirection, type TabSwipeDirection } from './domain/tabswipe';
import { needsOnboarding } from './profile';
import { navigateTab, route } from './router';

/** The direction of the last tab swipe while its slide-in animation runs; null otherwise. */
export const slide = signal<TabSwipeDirection | null>(null);

/** True when the user asked the system for less motion (false when matchMedia is missing). */
export function reducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  } catch {
    return false;
  }
}

/**
 * True when a touch on `target` must never become a tab swipe: a text field, a sheet, selection
 * mode or an explicit `[data-noswipe]`, or any element from `target` up to and including `root`
 * that scrolls sideways itself (chips, sort row, photo strip, tabs …), checked generically.
 */
export function ignoredSwipeTarget(target: EventTarget | null, root: HTMLElement): boolean {
  const start = target as Element | null;
  if (!start || typeof start.closest !== 'function') return false;
  if (start.closest('input, textarea, select, [contenteditable="true"], .sheet-backdrop, .selecting, [data-noswipe]') !== null) {
    return true;
  }
  for (let el: Element | null = start; el; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    if (el === root) break;
  }
  return false;
}

/**
 * Listens on `ref.current` (the `.screen-wrap`). `active` false → no listeners (the element is not
 * rendered yet while the app boots); the effect re-runs when it turns true.
 */
export function useTabSwipe(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; id: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      if (needsOnboarding.value) return;
      if (!isTabPath(route.value.path)) return;
      const t = e.touches[0];
      if (!t) return;
      if (startsAtEdge(t.clientX, document.documentElement.clientWidth)) return;
      if (ignoredSwipeTarget(e.target, el)) return;
      start = { x: t.clientX, y: t.clientY, id: t.identifier };
    };
    const onMove = (e: TouchEvent) => {
      // A second finger (pinch) cancels the gesture; otherwise the decision waits for touchend.
      if (start && e.touches.length !== 1) start = null;
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s) return;
      let t: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const c = e.changedTouches[i];
        if (c && c.identifier === s.id) {
          t = c;
          break;
        }
      }
      if (!t) return;
      const dir = tabSwipeDirection(t.clientX - s.x, t.clientY - s.y);
      if (!dir) return;
      const to = neighbourTab(route.value.path, dir);
      if (!to) return;
      slide.value = reducedMotion() ? null : dir;
      navigateTab(to);
    };
    const onCancel = () => {
      start = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [active]);
}
