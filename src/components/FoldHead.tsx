// The caption of a collapsible group, shared by Meer and the handbook (spec V1 §1a): a centred cobalt
// caption between two rules, an optional badge and a chevron that turns when the group is open. The
// styles live in base.css under "Fold head (V1)".
import type { ComponentChildren } from 'preact';
export function FoldHead(props: { title: string; open: boolean; onToggle: () => void; controls?: string; badge?: ComponentChildren }) {
  return (
    <h2 class="fold-head">
      <button type="button" aria-expanded={props.open} aria-controls={props.open ? props.controls : undefined} onClick={props.onToggle}>
        <span class="fold-title">{props.title}</span>
        {props.badge}
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </h2>
  );
}
