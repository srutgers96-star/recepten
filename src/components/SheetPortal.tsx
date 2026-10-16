// Renders a bottom sheet straight under <body>, outside the scrolling `.screen`. On the iPhone (Home
// Screen app) a position:fixed sheet inside that scroll container lost its bottom part — the Save
// button of the Cooked and gluten-free sheets was out of view (Gabi, 16 Oct 2026); Android was fine.
// `preact/compat` ships with preact itself, so this adds no dependency.
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';

export function SheetPortal(props: { children: ComponentChildren }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<>{props.children}</>, document.body);
}
