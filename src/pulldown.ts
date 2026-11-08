// Pull down on a screen to open something (block 6D-S, docs/specs/badges-avatar.md "S-A" point 3):
// Home pulls down to "Mijn profiel". Touch only (a mouse or pen never pulls). A gesture counts only
// when it STARTS with the page scrolled to the very top (the listening element, its ancestors and
// `document.scrollingElement` all at scrollTop 0) and outside a text field or a sheet; it fires once the finger has travelled at least `threshold`
// px down and more vertically than sideways, and at most once per gesture. Listeners are passive:
// scrolling is never blocked. In a browser tab (not standalone) Chrome's own pull-to-refresh may fire
// first; that is accepted (the tap on the avatar is the other way in). No animation in this block.
import { useEffect, useRef, type MutableRef } from 'preact/hooks';

/** Default downward travel in px that counts as a pull. */
export const PULL_THRESHOLD = 80;

export interface Point {
  x: number;
  y: number;
}

/**
 * Pure: how far a touch has pulled DOWN from `start` to `now`, in px. Zero when the finger went up
 * or when the travel is not more vertical than horizontal (a sideways swipe is no pull).
 */
export function pullDistance(start: Point, now: Point): number {
  const dx = now.x - start.x;
  const dy = now.y - start.y;
  if (dy <= 0 || dy <= Math.abs(dx)) return 0;
  return dy;
}

/**
 * True when the page is at the very top. In this app the document itself never scrolls
 * (base.css: html, body overflow hidden); the scroll container is `.screen`, which is usually the
 * listening element. So the listening element and every ancestor must be at scrollTop 0 as well as
 * the document (`document.scrollingElement`).
 */
function atTop(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) if (n.scrollTop > 0) return false;
  const doc = typeof document !== 'undefined' ? document.scrollingElement : null;
  if (doc) return doc.scrollTop <= 0;
  return typeof window !== 'undefined' ? window.scrollY <= 0 : true;
}

/** A touch that starts in a text field or inside a sheet never pulls. */
function ignoredTarget(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.closest('input, textarea, select, .sheet-backdrop') !== null;
}

/**
 * Put the returned ref on the element that listens (`<div ref={ref} class="screen home">`).
 * `onPull` runs once per gesture; the latest callback is always used.
 */
export function usePullDown<T extends HTMLElement = HTMLDivElement>(opts: { onPull: () => void; threshold?: number }): MutableRef<T | null> {
  const ref = useRef<T | null>(null);
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: (Point & { id: number }) | null = null;
    let fired = false;

    const onStart = (e: TouchEvent) => {
      start = null;
      fired = false;
      if (e.touches.length !== 1) return;
      if (!atTop(el)) return;
      if (ignoredTarget(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      start = { x: t.clientX, y: t.clientY, id: t.identifier };
    };
    const onMove = (e: TouchEvent) => {
      if (!start || fired) return;
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      const t = e.touches[0];
      if (!t || t.identifier !== start.id) return;
      const threshold = latest.current.threshold ?? PULL_THRESHOLD;
      if (pullDistance(start, { x: t.clientX, y: t.clientY }) >= threshold) {
        fired = true;
        start = null;
        latest.current.onPull();
      }
    };
    const onEnd = () => {
      start = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return ref;
}
