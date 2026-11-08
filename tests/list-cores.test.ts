// 13c (docs/specs/opschoonronde.md §2B.5): the pure cores of "Klaar" (`clearChecksIn`) and "Ook voortaan"
// (`adoptStandingAdjustmentIn`) in src/db/repo.ts. `clearChecks()` / `adoptStandingAdjustment()` call them
// around the Dexie write; behaviour unchanged. No database is opened: repo.ts is imported for its pure
// exports only (as tests/list-share.test.ts does).
import { describe, expect, it } from 'vitest';
import { adoptStandingAdjustmentIn, clearChecksIn } from '../src/db/repo';
import type { List } from '../src/db/model';
import type { ListItem } from '../src/domain/aggregate';

const AT = '2026-11-08T10:00:00.000Z';
const listOf = (items: ListItem[], extras: ListItem[] = []): List => ({ id: 'current', items, extras, generatedFrom: '', generatedAt: AT, pinned: [], updatedAt: AT, sharedAt: null });

const standing: ListItem = { key: 's|melk01', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren', section: 'inHouse', sources: [], standing: true, checked: true, inHouse: true, adjusted: 1 };
const plain: ListItem = { key: 'ui||stuk', ing: 'ui', qty: 3, unit: null, aisle: 'groente-fruit', section: 'main', sources: [], checked: true };
const untouched: ListItem = { key: 'gehakt||g', ing: 'gehakt', qty: 400, unit: 'g', aisle: 'vlees-vis', section: 'main', sources: [] };
const extra: ListItem = { key: 'x|wc', label: { nl: 'wc-papier' }, aisle: 'overig', section: 'main', sources: [], manual: true, checked: true };

describe('clearChecksIn: "Klaar"', () => {
  const out = clearChecksIn(listOf([standing, plain, untouched, extra], [extra]));
  const byKey = (key: string) => out.items.find((it) => it.key === key);

  it('resets a standing line: checked, inHouse and adjusted go, section back to main', () => {
    const s = byKey('s|melk01')!;
    expect(s.checked).toBeUndefined();
    expect(s.inHouse).toBeUndefined();
    expect(s.adjusted).toBeUndefined();
    expect(s.section).toBe('main');
    expect(s.qty).toBe(2);
  });

  it('only drops `checked` on an ordinary line and leaves an unticked line as it is', () => {
    const { checked, ...rest } = plain;
    expect(checked).toBe(true);
    expect(byKey('ui||stuk')).toEqual(rest);
    expect(byKey('gehakt||g')).toBe(untouched);
  });

  it('clears the extras as well and keeps the rest of the list', () => {
    expect(out.extras[0]?.checked).toBeUndefined();
    expect(out.items.find((it) => it.key === 'x|wc')?.checked).toBeUndefined();
    expect(out.generatedFrom).toBe('');
    expect(out.updatedAt).toBe(AT);
  });

  it('leaves a standing line in main with nothing to reset untouched', () => {
    const quiet: ListItem = { ...standing, section: 'main' };
    delete quiet.checked;
    delete quiet.inHouse;
    delete quiet.adjusted;
    expect(clearChecksIn(listOf([quiet])).items[0]).toBe(quiet);
  });
});

describe('adoptStandingAdjustmentIn: "Ook voortaan"', () => {
  const line: ListItem = { key: 's|melk01', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren', section: 'main', sources: [], standing: true, adjusted: 1 };

  it('takes the adjusted amount over as the usual one, on the line and for the standing item', () => {
    const r = adoptStandingAdjustmentIn(listOf([line, untouched]), 's|melk01')!;
    expect(r.qty).toBe(3);
    expect(r.standingId).toBe('s:melk01');
    const next = r.list.items.find((it) => it.key === 's|melk01')!;
    expect(next.qty).toBe(3);
    expect(next.adjusted).toBeUndefined();
    expect(r.list.items.find((it) => it.key === 'gehakt||g')).toBe(untouched);
  });

  it('an amount adjusted down to 0 becomes "no amount" (null)', () => {
    const r = adoptStandingAdjustmentIn(listOf([{ ...line, adjusted: -2 }]), 's|melk01')!;
    expect(r.qty).toBeNull();
    expect(r.list.items[0]?.qty).toBeNull();
  });

  it('is a no-op (null) for a line that is not a standing line or not on the list', () => {
    expect(adoptStandingAdjustmentIn(listOf([untouched]), 'gehakt||g')).toBeNull();
    expect(adoptStandingAdjustmentIn(listOf([line]), 's|other')).toBeNull();
  });
});
