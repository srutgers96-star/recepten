// A horizontal swipe on a region (13D, docs/specs/varianten-tabs.md §1a and §3 blok 2): the recipe
// page swipes between the variant tabs on its ingredient section with the same pointer logic as cook
// mode (src/screens/CookScreen.tsx): a sideways travel of at least SWIPE_PX that is larger than the
// vertical one is a swipe (finger to the left = next, to the right = previous); after DRAG_PX of
// sideways travel that dominates the vertical, the gesture is a drag and no longer a tap, so the
// click that may follow it is swallowed (`onClickCapture`): a swipe that started on a button (the
// servings stepper, a "?" chip) never also presses it. Vertical scrolling is left to the browser: the
// region carries `touch-action: pan-y` (CSS), a vertical scroll fires `pointercancel`, which never
// swipes. Pointerdown on a text field is ignored, as in cook mode.
import { useRef } from 'preact/hooks';

/** Minimum horizontal travel in px that counts as a swipe (CookScreen `SWIPE_PX`). */
export const SWIPE_PX = 60;
/** Horizontal travel in px, dominating the vertical, after which the gesture is a drag (CookScreen: 12). */
export const DRAG_PX = 12;

/** 'left' = the finger moved to the left (next tab), 'right' = to the right (previous tab). */
export type SwipeDirection = 'left' | 'right';

/** Pure: the swipe a pointer travel (dx, dy in px) makes, or null when it is not one. */
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return null;
}

/** Pure: whether a pointer travel has become a sideways drag (and so is no tap any more). */
export function isSidewaysDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > DRAG_PX && Math.abs(dx) > Math.abs(dy);
}

export interface HorizontalSwipeHandlers {
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerCancel(e: PointerEvent): void;
  onClickCapture(e: MouseEvent): void;
}

/**
 * Pointer handlers for a region that swipes sideways: spread them on the element
 * (`<section {...swipe}>`). `onLeft` runs for a swipe to the left (next), `onRight` for one to the
 * right (previous). The latest callbacks are always used, so they may change on every render.
 */
export function useHorizontalSwipe(h: { onLeft(): void; onRight(): void }): HorizontalSwipeHandlers {
  const handlers = useRef(h);
  handlers.current = h;
  const start = useRef<{ x: number; y: number; id: number; drag: boolean } | null>(null);
  // True after a drag or swipe, until the click that may follow it (or the next pointerdown).
  const swallowClick = useRef(false);

  function end(e: PointerEvent, cancelled: boolean): void {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    start.current = null;
    if (cancelled) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dir = swipeDirection(dx, dy);
    if (s.drag || dir !== null) swallowClick.current = true;
    if (dir === 'left') handlers.current.onLeft();
    else if (dir === 'right') handlers.current.onRight();
  }

  return {
    onPointerDown(e: PointerEvent) {
      swallowClick.current = false;
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === 'function' && target.closest('textarea, input, select')) {
        start.current = null;
        return;
      }
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false };
    },
    onPointerMove(e: PointerEvent) {
      const s = start.current;
      if (!s || e.pointerId !== s.id || s.drag) return;
      if (isSidewaysDrag(e.clientX - s.x, e.clientY - s.y)) s.drag = true;
    },
    onPointerUp(e: PointerEvent) {
      end(e, false);
    },
    onPointerCancel(e: PointerEvent) {
      end(e, true);
    },
    onClickCapture(e: MouseEvent) {
      // A swipe (or sideways drag) that started on a button must not also count as a tap on it.
      if (swallowClick.current) {
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
