// In & uit (docs/specs/varianten-tabs.md §1g, 13D blok 4): an incoming recipe or classic patch
// says "met een tip van de maker" and/or "met een goedgekeurde versie" / "met n goedgekeurde
// versies". Only approved versions of a known diet count; a tip needs text in some language.
import { describe, expect, it } from 'vitest';
import { extrasLines, importExtras } from '../src/components/ImportPreview';
import type { ImportItem } from '../src/domain/merge';
import { setLang } from '../src/i18n';

const recipeItem = (extra: Record<string, unknown>): ImportItem =>
  ({ kind: 'recipe', id: 'u:x', status: 'new', incoming: { id: 'u:x', name: { nl: 'X' }, lines: [], steps: [], ...extra } }) as unknown as ImportItem;
const patchItem = (patch: Record<string, unknown>): ImportItem =>
  ({ kind: 'patch', id: 'p:b:x', status: 'new', incoming: { baseId: 'b:x', rev: 1, patch } }) as unknown as ImportItem;
const ok = { approved: true, swaps: [], checked: [] };

describe('importExtras / extrasLines', () => {
  it('nothing extra: no lines', () => {
    expect(importExtras(recipeItem({}))).toEqual({ tip: false, approved: 0 });
    expect(extrasLines(recipeItem({ tip: { nl: '  ' }, variants: { glutenvrij: { ...ok, approved: false } } }))).toEqual([]);
  });

  it('a tip and one approved version (NL)', () => {
    setLang('nl');
    const item = recipeItem({ tip: { en: 'Taste first' }, variants: { glutenvrij: ok, vegan: { ...ok, approved: false }, toekomst: ok } });
    expect(importExtras(item)).toEqual({ tip: true, approved: 1 });
    expect(extrasLines(item)).toEqual(['met een tip van de maker', 'met een goedgekeurde versie']);
  });

  it('several approved versions in a patch (EN)', () => {
    setLang('en');
    const item = patchItem({ tip: { nl: 'Proef eerst' }, variants: { glutenvrij: ok, vegetarisch: ok } });
    expect(extrasLines(item)).toEqual(['with a tip from the maker', 'with 2 approved versions']);
    setLang('nl');
  });
});
