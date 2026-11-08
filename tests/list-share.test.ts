// 13Q (docs/specs/qr-link.md §2/§5): a shopping list as a link (`#l=`). The envelope is built from the
// list's own lines (share.buildListEnvelope), and "Zet op mijn lijst" puts the received lines on the
// own list through `listShareAdditions` (src/db/repo.ts, pure): the same ingredient (not ticked) or,
// without an ingredient, the same normalised text is skipped; everything else is added as a manual
// line. Nothing is summed. No database is opened: repo.ts is imported for its pure exports only.
import { describe, expect, it } from 'vitest';
import { listShareAdditions } from '../src/db/repo';
import type { ListItem } from '../src/domain/aggregate';
import { defaultDictionary } from '../src/domain/data';
import { buildListEnvelope, type ListShare, type ListShareLine } from '../src/domain/share';

const dict = defaultDictionary();

const onion: ListItem = { key: 'ui||stuk', ing: 'ui', qty: 2, unit: null, aisle: 'groente-fruit', section: 'main', sources: [] };
const mince: ListItem = { key: 'gehakt||g', ing: 'gehakt', qty: 400, unit: 'g', aisle: 'vlees-vis', section: 'main', sources: [] };
const loo: ListItem = { key: 'x|wc', label: { nl: 'wc-papier', en: 'loo roll' }, aisle: 'overig', section: 'main', sources: [], manual: true };
const milkTicked: ListItem = { key: 'melk||ml', ing: 'melk', qty: 1000, unit: 'ml', aisle: 'zuivel-eieren', section: 'main', sources: [], checked: true };

describe('buildListEnvelope: the envelope from the list lines', () => {
  const env = buildListEnvelope([onion, mince, loo], dict, 'Stijn', { title: { nl: 'Boodschappen week 46', en: 'Shopping week 46' }, hideChecked: true, hideInHouse: true });
  const l = env.l as ListShare;

  it('is a v2 `l` envelope with the sender and the title in both languages', () => {
    expect(env.v).toBe(2);
    expect(env.t).toBe('l');
    expect(env.by).toBe('Stijn');
    expect(l.title).toEqual({ nl: 'Boodschappen week 46', en: 'Shopping week 46' });
  });

  it('carries every line with its text per language and the ingredient when known', () => {
    expect(l.lines).toHaveLength(3);
    const byIng = new Map(l.lines.map((x) => [x.ing ?? null, x] as const));
    expect(byIng.get('gehakt')?.qty).toBe(400);
    expect(byIng.get('gehakt')?.unit).toBe('g');
    expect(byIng.get('gehakt')?.raw.nl).toMatch(/gehakt/);
    const free = l.lines.find((x) => !x.ing);
    expect(free?.raw).toEqual({ nl: 'wc-papier', en: 'loo roll' });
  });
});

describe('listShareAdditions: the skip rule of "Zet op mijn lijst"', () => {
  const current = [onion, loo, milkTicked];

  it('skips a line whose ingredient is already on the list (not ticked)', () => {
    const r = listShareAdditions(current, [{ raw: { nl: '3 uien', en: '3 onions' }, ing: 'ui', qty: 3 }], dict);
    expect(r.add).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it('skips a line without ingredient whose text is already there (normalised)', () => {
    const r = listShareAdditions(current, [{ raw: { nl: '  WC-papier ' } }], dict);
    expect(r.add).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it('adds anything else as a manual line: ingredient with amount, or the raw text', () => {
    const lines: ListShareLine[] = [
      { raw: { nl: '400 g gehakt', en: '400 g minced meat' }, ing: 'gehakt', qty: 400, unit: 'g', aisle: 'vlees-vis' },
      { raw: { nl: '2 rollen keukenpapier', en: '2 rolls kitchen paper' }, qty: 2, aisle: 'overig' },
    ];
    const r = listShareAdditions(current, lines, dict);
    expect(r.skipped).toBe(0);
    expect(r.add).toEqual([
      { ing: 'gehakt', aisle: 'vlees-vis', qty: 400, unit: 'g' },
      { ing: null, aisle: 'overig', qty: null, unit: null, label: { nl: '2 rollen keukenpapier', en: '2 rolls kitchen paper' } },
    ]);
  });

  it('adds an ingredient that is only on the list as a ticked line', () => {
    const r = listShareAdditions(current, [{ raw: { nl: '1 l melk' }, ing: 'melk', qty: 1, unit: 'l' }], dict);
    expect(r.add.map((x) => x.ing)).toEqual(['melk']);
    expect(r.skipped).toBe(0);
  });

  it('counts a line that appears twice in one share once', () => {
    const r = listShareAdditions([], [{ raw: { nl: '400 g gehakt' }, ing: 'gehakt', qty: 400, unit: 'g' }, { raw: { nl: '200 g gehakt' }, ing: 'gehakt', qty: 200, unit: 'g' }], dict);
    expect(r.add).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });

  it('treats an ingredient id the dictionary does not know as free text', () => {
    const r = listShareAdditions([], [{ raw: { nl: 'drakenfruit' }, ing: 'u:onbekend' }], dict);
    expect(r.add).toEqual([{ ing: null, aisle: 'overig', qty: null, unit: null, label: { nl: 'drakenfruit', en: '' } }]);
  });
});
