// The approve sheet of a diet tab (docs/specs/varianten-tabs.md §1c, 13D blok 2;
// src/components/VariantSheet.tsx): the pure parts — the rows (swaps first, then "controleer zelf",
// each in line order), the opening state (a proposal: all swaps on, nothing checked; "Opnieuw
// controleren": every swap that still fits on, the earlier `checked` "controleer zelf" lines ticked
// again; never a swap unticked from a bare index), Goedkeuren only with every "controleer zelf"
// line ticked, and what `approveVariant` gets. Fable's decision (1) after blok 1: an UNTICKED swap
// means "laat ik zo" and its line index goes into `checked`, so `variantView` sees `approved`, not
// `stale`. No database is opened: the module is imported for its pure exports only.
import { describe, expect, it } from 'vitest';
import swapsJson from '../data/swaps.json';
import { allChecked, initialSheetState, sheetApproval, sheetRows } from '../src/components/VariantSheet';
import { defaultDictionary } from '../src/domain/data';
import type { Line } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import { variantView, type RecipeVariant, type Swap, type VariantDiet } from '../src/domain/variants';

const dict = defaultDictionary();
const swaps = swapsJson as Swap[];
const nl = (...raw: string[]): Line[] => raw.map((r) => parseLine(r, dict, 'nl'));

// The SCHOTEL lines of tests/variants.test.ts (spec §6 main fixture).
const SCHOTEL = nl('400 g spaghetti', '1 groene paprika [reepjes]', '1 ui [gesnipperd]', '400 g gehakt', '125 g geraspte kaas', '2 eieren');

/** What the sheet would store for `diet` over `lines`, with these swaps unticked and these lines ticked. */
function approve(diet: VariantDiet, lines: Line[], off: number[], ticked: number[], stored?: RecipeVariant): RecipeVariant {
  const view = variantView(diet, lines, stored, swaps, dict);
  const plan = view.plan!;
  const rows = sheetRows(plan);
  return { approved: true, by: 'Stijn', ...sheetApproval(plan, rows, new Set(off), new Set(ticked)) };
}

describe('sheetRows', () => {
  it('vegan SCHOTEL: the cheese swap first, then mince and egg as "controleer zelf", in line order', () => {
    const plan = variantView('vegan', SCHOTEL, undefined, swaps, dict).plan!;
    const rows = sheetRows(plan);
    expect(rows.map((r) => [r.kind, r.index])).toEqual([
      ['swap', 4],
      ['check', 3],
      ['check', 5],
    ]);
    expect(rows[0]!.swap).toMatchObject({ fromId: 'kaas', toId: 'vegan-kaas', applies: true });
    expect(rows[1]!.swap).toBeUndefined();
    expect(rows[1]!.line).toBe(SCHOTEL[3]);
  });

  it('a swap the app cannot place (applies false) is a "controleer zelf" row that still carries the swap', () => {
    const lines = nl('100 g boter of 100 g spekblokjes', '200 ml room');
    const rows = sheetRows(variantView('vegan', lines, undefined, swaps, dict).plan!);
    expect(rows.map((r) => [r.kind, r.index])).toEqual([
      ['swap', 1],
      ['check', 0],
    ]);
    expect(rows[1]!.swap?.applies).toBe(false);
  });
});

describe('opening state and Goedkeuren', () => {
  it('a proposal opens with every swap on and nothing checked; Goedkeuren waits for every "controleer zelf" line', () => {
    const view = variantView('vegan', SCHOTEL, undefined, swaps, dict);
    const rows = sheetRows(view.plan!);
    const s = initialSheetState(view, rows);
    expect([...s.off]).toEqual([]);
    expect([...s.ticked]).toEqual([]);
    expect(allChecked(rows, s.ticked)).toBe(false);
    expect(allChecked(rows, new Set([3]))).toBe(false);
    expect(allChecked(rows, new Set([3, 5]))).toBe(true);
  });

  it('glutenvrij SCHOTEL has no "controleer zelf" line: Goedkeuren is enabled right away', () => {
    const view = variantView('glutenvrij', SCHOTEL, undefined, swaps, dict);
    const rows = sheetRows(view.plan!);
    expect(rows.map((r) => r.kind)).toEqual(['swap']);
    expect(allChecked(rows, initialSheetState(view, rows).ticked)).toBe(true);
  });

  it('"Opnieuw controleren" (stale): the swaps are on, the earlier checked lines come back', () => {
    // Approved vegan with mince and egg ticked; then a line without a vegan swap is added -> stale.
    const stored = approve('vegan', SCHOTEL, [], [3, 5]);
    const changed = [...SCHOTEL, ...nl('2 plakjes ontbijtspek')];
    const view = variantView('vegan', changed, stored, swaps, dict);
    expect(view.status).toBe('stale');
    const rows = sheetRows(view.plan!);
    expect(rows.map((r) => [r.kind, r.index])).toEqual([
      ['swap', 4],
      ['check', 3],
      ['check', 5],
      ['check', 6],
    ]);
    const s = initialSheetState(view, rows);
    expect([...s.off]).toEqual([]);
    expect([...s.ticked].sort()).toEqual([3, 5]);
    // the new line is not ticked yet, so Goedkeuren waits; ticked -> approved again
    expect(allChecked(rows, s.ticked)).toBe(false);
    const again = { approved: true, ...sheetApproval(view.plan!, rows, s.off, new Set([...s.ticked, 6])) };
    expect(again.checked).toEqual([3, 5, 6]);
    expect(variantView('vegan', changed, again, swaps, dict).status).toBe('approved');
  });

  it('"Opnieuw controleren": a swap left as it was ("laat ik zo") opens ON (§1c); unticking it again still works', () => {
    const stored = approve('vegan', SCHOTEL, [4], [3, 5]);
    expect(stored.checked).toEqual([3, 4, 5]);
    // "2 el boter" has a vegan swap (vegan-boter): a new swap row, on; the cheese row is on too —
    // `checked` holds bare indexes, so the sheet cannot tell "laat ik zo" from a line that moved there
    const changed = [...SCHOTEL, ...nl('2 el boter')];
    const view = variantView('vegan', changed, stored, swaps, dict);
    expect(view.status).toBe('stale');
    const rows = sheetRows(view.plan!);
    expect(rows.filter((r) => r.kind === 'swap').map((r) => r.index)).toEqual([4, 6]);
    const s = initialSheetState(view, rows);
    expect([...s.off]).toEqual([]);
    expect([...s.ticked].sort()).toEqual([3, 5]);
    expect(allChecked(rows, s.ticked)).toBe(true);
    // the user unticks the cheese again: decision (1) as before, approved with the cheese as it was
    const again: RecipeVariant = { approved: true, ...sheetApproval(view.plan!, rows, new Set([4]), s.ticked) };
    expect(again.swaps.map((x) => x.index)).toEqual([6]);
    expect(again.checked).toEqual([3, 4, 5]);
    expect(variantView('vegan', changed, again, swaps, dict).status).toBe('approved');
  });

  it('a line inserted above an approved swap: the swap still opens ON and re-approving keeps it (review finding)', () => {
    // Approved vegan: cheese swapped (index 4), mince (3) and egg (5) checked.
    const stored = approve('vegan', SCHOTEL, [], [3, 5]);
    expect(stored).toMatchObject({ swaps: [{ index: 4, fromId: 'kaas' }], checked: [3, 5] });
    // '1 el olijfolie' as the new first line: mince 4, cheese 5, egg 6. Old index 5 is now the cheese.
    const changed = [...nl('1 el olijfolie'), ...SCHOTEL];
    const view = variantView('vegan', changed, stored, swaps, dict);
    expect(view.status).toBe('stale');
    const rows = sheetRows(view.plan!);
    expect(rows.map((r) => [r.kind, r.index])).toEqual([
      ['swap', 5],
      ['check', 4],
      ['check', 6],
    ]);
    const s = initialSheetState(view, rows);
    // §1c: "de checkboxes van swaps die nog passen staan aan" — never unticked by a bare index
    expect([...s.off]).toEqual([]);
    // the user ticks the two rows the sheet asks for and approves: the cheese swap is kept
    const again: RecipeVariant = { approved: true, ...sheetApproval(view.plan!, rows, s.off, new Set([4, 6])) };
    expect(again.swaps.map((x) => [x.index, x.fromId, x.toId])).toEqual([[5, 'kaas', 'vegan-kaas']]);
    const v = variantView('vegan', changed, again, swaps, dict);
    expect(v.status).toBe('approved');
    expect(v.swapped).toEqual([5]);
    expect(v.lines[5]!.ing).toBe('vegan-kaas');
  });

  it('the first line deleted under an approved swap: the swap still opens ON (review finding)', () => {
    const stored = approve('vegan', SCHOTEL, [], [3, 5]);
    // spaghetti gone: mince 2, cheese 3, egg 4. Old checked index 3 is now the cheese.
    const changed = SCHOTEL.slice(1);
    const view = variantView('vegan', changed, stored, swaps, dict);
    expect(view.status).toBe('stale');
    const rows = sheetRows(view.plan!);
    expect(rows.find((r) => r.kind === 'swap')?.index).toBe(3);
    expect([...initialSheetState(view, rows).off]).toEqual([]);
  });

  it('stale because the line changed (spaghetti became penne): nothing to restore, the new plan opens fresh', () => {
    const stored = approve('glutenvrij', SCHOTEL, [], []);
    const changed = [{ ...SCHOTEL[0]!, raw: { nl: '400 g penne' }, ing: 'penne', name: 'penne' }, ...SCHOTEL.slice(1)];
    const view = variantView('glutenvrij', changed, stored, swaps, dict);
    expect(view.status).toBe('stale');
    const s = initialSheetState(view, sheetRows(view.plan!));
    expect([...s.off]).toEqual([]);
    expect([...s.ticked]).toEqual([]);
  });
});

describe('sheetApproval (what approveVariant gets)', () => {
  it('every swap on and the "controleer zelf" lines ticked -> the swaps stored, checked = those lines; the tab is approved', () => {
    const stored = approve('vegan', SCHOTEL, [], [3, 5]);
    expect(stored.swaps.map((s) => [s.index, s.fromId, s.toId])).toEqual([[4, 'kaas', 'vegan-kaas']]);
    expect(stored.checked).toEqual([3, 5]);
    expect(variantView('vegan', SCHOTEL, stored, swaps, dict).status).toBe('approved');
  });

  it('decision (1): an unticked swap goes into checked, so the tab is approved and not stale', () => {
    const vegan = approve('vegan', SCHOTEL, [4], [3, 5]);
    expect(vegan.swaps).toEqual([]);
    expect(vegan.checked).toEqual([3, 4, 5]);
    const v = variantView('vegan', SCHOTEL, vegan, swaps, dict);
    expect(v.status).toBe('approved');
    expect(v.swapped).toEqual([]);
    expect(v.lines[4]).toBe(SCHOTEL[4]);

    // a diet with only unticked swaps still exists: { swaps: [], checked: [0] }
    const gv = approve('glutenvrij', SCHOTEL, [0], []);
    expect(gv).toMatchObject({ swaps: [], checked: [0] });
    const g = variantView('glutenvrij', SCHOTEL, gv, swaps, dict);
    expect(g.status).toBe('approved');
    expect(g.lines[0]).toBe(SCHOTEL[0]);
  });

  it('a tick on a swap row or an untick on a check row never leaks into the other list', () => {
    const plan = variantView('vegan', SCHOTEL, undefined, swaps, dict).plan!;
    const rows = sheetRows(plan);
    // index 4 is a swap row: in `ticked` it means nothing; index 3 is a check row: in `off` it means nothing
    const a = sheetApproval(plan, rows, new Set([3]), new Set([4, 5]));
    expect(a.swaps.map((s) => s.index)).toEqual([4]);
    expect(a.checked).toEqual([5]);
  });

  it('stores no display-only field (swappedFrom) and no applies/note', () => {
    const stored = approve('glutenvrij', SCHOTEL, [], []);
    expect(stored.swaps).toEqual([{ index: 0, fromId: 'spaghetti', toId: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta' }, name: 'glutenvrije pasta' }]);
    expect(JSON.stringify(stored)).not.toContain('swappedFrom');
  });
});
