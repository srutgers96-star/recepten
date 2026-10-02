// window.print() steered by a data attribute (docs/phase-5-spec.md block D.2). printPage(kind)
// sets html[data-print=kind] so src/styles/print.css can lay the page out per kind, opens the
// print dialog and cleans the attribute up on 'afterprint' — with a fallback timeout for engines
// that never fire it. Safe to call repeatedly. On iOS the installed app cannot rely on
// window.print(); callers hide their Print button behind isIOS() and show the honest hint instead
// (CLAUDE.md invariant 13).
export type PrintKind = 'recipe' | 'ingredients' | 'shopping';

const FALLBACK_MS = 2000;

let fallback: number | null = null;

/** Removes the attribute and the pending fallback; idempotent (repeat calls are no-ops). */
function cleanup(): void {
  if (fallback !== null) {
    window.clearTimeout(fallback);
    fallback = null;
  }
  delete document.documentElement.dataset.print;
}

/**
 * Prints the current screen as `kind`. Desktop browsers block in window.print() until the dialog
 * closes and fire 'afterprint'; Android Chrome renders a snapshot and may keep the dialog open
 * async, so the attribute survives until 'afterprint' or the ~2 s fallback below.
 */
export function printPage(kind: PrintKind): void {
  cleanup();
  document.documentElement.dataset.print = kind;
  // Same function reference every time: addEventListener dedupes, so repeated printPage() calls
  // never stack listeners, and `once` drops it after each print.
  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    window.print();
  } finally {
    fallback = window.setTimeout(cleanup, FALLBACK_MS);
  }
}
