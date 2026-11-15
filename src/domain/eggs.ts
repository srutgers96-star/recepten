// V1c-10 (docs/specs/ei-gabi.md §1a): the leopard-print egg. Framework-free (runs in Node).
// One typed line in the shopping list's add field that is exactly one of these phrases unlocks the
// leopard theme on this phone instead of being added to the list (src/screens/ShoppingScreen.tsx).

/** The phrases, folded (see foldEggText). English (Gabi) plus Dutch synonyms. */
export const PANTER_PHRASES = ['leopard print', 'leopardprint', 'luipaardprint', 'luipaard print', 'panterprint', 'panter print'] as const;

/**
 * Normalises typed text for the egg check: trimmed, lower case, diacritics removed, runs of
 * whitespace collapsed to one space, and one trailing full stop or exclamation mark removed.
 */
export function foldEggText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[.!]$/u, '')
    .trim();
}

const PHRASES: ReadonlySet<string> = new Set(PANTER_PHRASES);

/** True when the text is exactly one of the leopard phrases (after folding). Empty or null: false. */
export function isPanterEggText(s: string | null | undefined): boolean {
  if (typeof s !== 'string') return false;
  const f = foldEggText(s);
  return f !== '' && PHRASES.has(f);
}
