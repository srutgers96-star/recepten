// V1c-10c (docs/specs/ei-gabi.md §1g; Gabi, 15 Nov: "make the background scroll along, but twice as
// slow"): the leopard print lives on a fixed layer behind the app (`#panter-bg`, styled in
// src/styles/panter.css and hidden under every other theme) and follows the scrolling `.screen` at
// half its speed. Only a transform moves (compositor work, no repaint), at most once per frame, and
// the offset wraps on the tile height so the layer never has to be taller than one tile plus the
// viewport. Under prefers-reduced-motion the layer stays put. Nothing here touches storage.
import { prefersReducedMotion } from '@/celebrate';

/** The print tile's height in CSS px (tools/panter-tile.py, panter.css `background-size`). */
export const PANTER_TILE_PX = 216;
/** The print moves this fraction of the page's scroll ("twice as slow"). */
export const PARALLAX_FACTOR = 0.5;
const LAYER_ID = 'panter-bg';

/** Offset of the print layer (px, 0 or negative) for a scroll position: half the scroll, wrapped on the tile. Pure. */
export function panterOffset(scrollTop: number): number {
  if (!(scrollTop > 0)) return 0;
  const raw = (scrollTop * PARALLAX_FACTOR) % PANTER_TILE_PX;
  return raw === 0 ? 0 : -raw;
}

/** The element a scroll event came from, when it is a screen to follow; else null. Pure. */
export function scrolledScreen(target: EventTarget | null): HTMLElement | null {
  // `HTMLElement` is absent in Node (tests): nothing there is a screen.
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return null;
  return target.classList.contains('screen') ? target : null;
}

let layer: HTMLElement | null = null;
let frame = 0;
let pendingTop = 0;

function ensureLayer(): HTMLElement {
  if (layer && layer.isConnected) return layer;
  const existing = document.getElementById(LAYER_ID);
  if (existing) {
    layer = existing;
    return existing;
  }
  const el = document.createElement('div');
  el.id = LAYER_ID;
  el.setAttribute('aria-hidden', 'true');
  document.body.prepend(el);
  layer = el;
  return el;
}

function paint(): void {
  frame = 0;
  const el = ensureLayer();
  const y = prefersReducedMotion() ? 0 : panterOffset(pendingTop);
  el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
}

function schedule(top: number): void {
  pendingTop = top;
  if (!frame) frame = requestAnimationFrame(paint);
}

function onScroll(e: Event): void {
  // Cheap outside the leopard theme: the layer is hidden by CSS and nothing is scheduled.
  if (document.documentElement.getAttribute('data-theme') !== 'panter') return;
  const screen = scrolledScreen(e.target);
  if (screen) schedule(screen.scrollTop);
}

let started = false;

/**
 * Mounts the print layer and follows every `.screen` scroll (captured at the document, since scroll
 * events do not bubble). A route change starts the new screen at the top, so the layer resets too.
 */
export function initPanterParallax(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  ensureLayer();
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('hashchange', () => schedule(0));
}
