// Renders a bottom sheet straight under <body>, outside the scrolling `.screen`. On the iPhone (Home
// Screen app) a position:fixed sheet inside that scroll container lost its bottom part — the Save
// button of the Cooked and gluten-free sheets was out of view (Gabi, 16 Oct 2026); Android was fine.
// `preact/compat` ships with preact itself, so this adds no dependency.
// 13c (docs/specs/opschoonronde.md §2B.4): `onEscape`, when given, is called on Escape (a document
// keydown listener, only while the portal is mounted). Only sheets that do not handle Escape
// themselves pass it (the hold menu of the shopping list and the labels sheet of Selecteer).
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';

export function SheetPortal(props: { children: ComponentChildren; onEscape?: () => void }) {
  // The latest callback, so a new closure each render does not re-register the listener.
  const onEscape = useRef(props.onEscape);
  onEscape.current = props.onEscape;
  const wantsEscape = typeof props.onEscape === 'function';
  useEffect(() => {
    if (!wantsEscape || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Only the sheet closes: a screen-level window listener (Recipes leaves select mode on Escape)
      // would otherwise close the layer under it in the same key press.
      e.stopPropagation();
      onEscape.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [wantsEscape]);
  if (typeof document === 'undefined') return null;
  return createPortal(<>{props.children}</>, document.body);
}
