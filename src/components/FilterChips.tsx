// Category labels for the chips and the Home shelf. The phase-2 chip row that lived here (a
// hard-coded quick-filter list) was replaced by the generic `PickChips` in PickSheet.tsx (spec
// §0: chips follow the tags present in the data), which the Recipes list, the Home dice and the
// Week screen all share.
import type { Category } from '@/domain/dictionary';
import { lang } from '@/i18n';

/** Category label in the active language (falls back to the id). */
export function categoryLabel(c: Category | undefined, id: string): string {
  if (!c) return id;
  return (lang.value === 'nl' ? c.nl : c.en) || c.nl || id;
}
