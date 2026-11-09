// tools/nutrition-match.ts (docs/specs/verbeterronde-9b.md §1a): the CSV parser, `state` from the name, the
// normalised table, scoreCandidate and the match-input batches. Pure calls on small inputs.
import { describe, expect, it } from 'vitest';
import type { Ingredient } from '../src/domain/dictionary';
import {
  bestCandidates,
  isBrandRow,
  buildMatchInput,
  CsvReader,
  formatMatchInput,
  formatTable,
  parseCsv,
  parseTable,
  preparedState,
  queryOf,
  scoreCandidate,
  stateFromName,
  tokens,
  usdaRow,
  type MatchQuery,
  type TableRow,
} from '../tools/nutrition-match.ts';

function ing(id: string, en: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: id }, en: { one: en, many: `${en}s` }, aisle: 'groente-fruit', defaultUnit: 'stuk', staple: false, veg: true, vegan: true, gluten: false, lactose: false, ...extra };
}

function row(code: string, name: string, extra: Partial<TableRow> = {}): TableRow {
  return { code, name, name2: '', category: 'Vegetables', kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fibre: 1.7, sodium_mg: 4, alcohol: null, state: stateFromName(name), ...extra };
}

const q = (toks: string[], prepared: MatchQuery['prepared'] = null): MatchQuery => ({ tokens: new Set(toks), anchors: new Set(toks), prepared });

describe('CSV parser', () => {
  it('reads quoted fields with commas and doubled quotes', () => {
    expect(parseCsv('a,b,c\n"1","Onions, raw","say ""hi"""\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', 'Onions, raw', 'say "hi"'],
    ]);
  });
  it('handles CRLF, a missing final line end, empty fields and empty lines', () => {
    expect(parseCsv('a,b\r\n1,\r\n\r\n,2\r\n"x\r\ny",3')).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['', '2'],
      ['x\r\ny', '3'],
    ]);
  });
  it('gives the same records when fed in arbitrary chunks (streaming)', () => {
    const text = '"fdc_id","nutrient_id","amount"\r\n"1","1008","40"\r\n"2","1003","1.1"\r\n"3","x","a ""q"", b"\r\n';
    const whole = parseCsv(text);
    for (const size of [1, 2, 3, 5, 7]) {
      const r = new CsvReader();
      const out: string[][] = [];
      for (let i = 0; i < text.length; i += size) out.push(...r.push(text.slice(i, i + size)));
      out.push(...r.end());
      expect(out).toEqual(whole);
    }
  });
});

describe('state from the name', () => {
  it('raw / cooked / canned / dried / other, English and Dutch', () => {
    expect(stateFromName('Onions, raw')).toBe('raw');
    expect(stateFromName('Ui rauw')).toBe('raw');
    expect(stateFromName('Onions, cooked, boiled, drained, without salt')).toBe('cooked');
    expect(stateFromName('Rijst witte gekookt')).toBe('cooked');
    expect(stateFromName('Chickpeas (garbanzo beans), mature seeds, canned, drained solids')).toBe('canned');
    expect(stateFromName('Tomaten in blik')).toBe('canned');
    expect(stateFromName('Pasta, dry, enriched')).toBe('dried');
    expect(stateFromName('Tomatoes, sun-dried')).toBe('dried');
    expect(stateFromName('Abrikozen gedroogd')).toBe('dried');
    expect(stateFromName('Cheese, gouda')).toBe('other');
    expect(stateFromName('Apricots, dried, sulfured, uncooked')).toBe('dried');
  });
});

describe('normalised table', () => {
  it('USDA row: energy 1008, else 2047, else empty; name2 empty; state from the name', () => {
    expect(usdaRow('1', 'Onions, raw', 'Vegetables and Vegetable Products', { kcal: 40, kcalAtwater: 41, protein: 1.1 }).kcal).toBe(40);
    expect(usdaRow('1', 'Onions, raw', 'V', { kcalAtwater: 41 }).kcal).toBe(41);
    const r = usdaRow('1', 'Onions, raw', 'V', {});
    expect(r).toMatchObject({ kcal: null, name2: '', state: 'raw', fibre: null, sodium_mg: null });
  });
  it('round-trips through formatTable / parseTable (commas in names, empty = unknown)', () => {
    const rows = [row('170000', 'Onions, raw'), row('2', 'Wine, table, "red"', { kcal: null, alcohol: 10.6, state: 'other' })];
    const text = formatTable(rows);
    expect(text.split('\n')[0]).toBe('code,name,name2,category,kcal,protein,fat,carbs,fibre,sodium_mg,alcohol,state');
    expect(parseTable(text)).toEqual(rows);
  });
});

describe('scoreCandidate', () => {
  const onion = queryOf(ing('ui', 'onion'), false);
  it('tokens: lower case, stopwords out, a final s ignored', () => {
    expect(tokens('Onions, spring or scallions (includes tops and bulb), raw')).toEqual(['onion', 'spring', 'scallion', 'include', 'top', 'bulb', 'raw']);
    expect(tokens('Kaas met de Vlaamse ui')).toEqual(['kaa', 'de', 'vlaamse', 'ui']);
    expect([...onion.tokens]).toEqual(['onion']);
  });
  it('the point count of the spec', () => {
    // +3 shared token in the first comma part, +2 raw
    expect(scoreCandidate(onion, row('a', 'Onions, raw'))).toBe(5);
    // the extra words sit after the first comma: no −2, tie with "Onions, raw" -> shorter name first
    expect(scoreCandidate(onion, row('b', 'Onions, spring or scallions, raw'))).toBe(5);
    // cooked −2
    expect(scoreCandidate(onion, row('c', 'Onions, cooked'))).toBe(1);
    // −2 per first-part token not in the query; +1 for a shared token elsewhere; canned −1
    expect(scoreCandidate(onion, row('d', 'Onion rings, breaded'))).toBe(1);
    // after the lens: the head is the part with the most query tokens ("onion"), the group word costs nothing
    expect(scoreCandidate(onion, row('e', 'Soup, onion, canned'))).toBe(2);
    // no anchor token at all: never a candidate
    expect(scoreCandidate(onion, row('g', 'Carrots, raw'))).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreCandidate(q(['onion', 'red']), row('f', 'Onions, red, raw'))).toBe(6);
    // name2 is a part of its own and can be the head (after the lens): onion +3, raw −2, state raw +2
    expect(scoreCandidate(q(['onion']), { name: 'Ui rauw', name2: 'Onion raw', state: 'raw' })).toBe(3 - 2 + 2);
    // plurals: tomatoes → tomato, cherries → cherry, peaches → peach, cress stays
    expect(tokens('Tomatoes, red; Cherries, sweet; Peaches, raw; cress')).toEqual(['tomato', 'red', 'cherry', 'sweet', 'peach', 'raw', 'cress']);
  });
  it('"Onions, raw" comes first, "Onions, cooked" below the raw ones', () => {
    const rows = [row('3', 'Onions, cooked'), row('2', 'Onions, spring or scallions, raw'), row('1', 'Onions, raw'), row('4', 'Carrots, raw')];
    expect(bestCandidates(onion, rows).map((r) => r.name)).toEqual(['Onions, raw', 'Onions, spring or scallions, raw', 'Onions, cooked']);
  });
  it('a tinned id puts canned on top (raw 0, canned +2)', () => {
    const tin = queryOf(ing('tomaten-uit-blik', 'tinned tomato', { defaultUnit: 'blik', aliases: { en: ['canned tomatoes'] } }), false);
    expect(tin.prepared).toBe('canned');
    const rows = [row('1', 'Tomatoes, red, ripe, raw'), row('2', 'Tomatoes, red, ripe, canned, packed in tomato juice'), row('3', 'Tomatoes, red, ripe, cooked')];
    expect(scoreCandidate(tin, rows[0] as TableRow)).toBe(3 - 0);
    expect(bestCandidates(tin, rows)[0]?.code).toBe('2');
    // defaultUnit blik alone is enough (kikkererwten per blik -> "canned, drained")
    expect(preparedState('kikkererwten', 'kikkererwt', 'blik')).toBe('canned');
    expect(preparedState('kikkererwten', 'kikkererwt', 'pot')).toBe('canned');
    expect(preparedState('gedroogde-abrikoos', 'gedroogde abrikoos', 'g')).toBe('dried');
    expect(preparedState('ui', 'ui', 'stuk')).toBeNull();
  });
  it('keeps eight, only score > 0', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(String(i), `Onions, variety ${'x'.repeat(i)}, raw`));
    expect(bestCandidates(onion, rows)).toHaveLength(8);
    expect(bestCandidates(onion, [row('1', 'Carrots, raw')])).toEqual([]);
  });
  it('NEVO: the Dutch names join the query', () => {
    const ui = ing('ui', 'onion', { nl: { one: 'ui', many: 'uien' } });
    expect(queryOf(ui, true).tokens.has('ui')).toBe(true);
    expect(queryOf(ui, false).tokens.has('ui')).toBe(false);
  });
});

describe('match-input batches', () => {
  it('food ids only, in id order, 80 per batch, with current values and an empty list when nothing scores', () => {
    const ings: Ingredient[] = [
      ing('ui', 'onion'),
      ing('wc-papier', 'toilet paper', { aisle: 'huishoudelijk' }),
      ...Array.from({ length: 85 }, (_, i) => ing(`z${String(i).padStart(2, '0')}`, `zzz${i}`)),
    ];
    const batches = buildMatchInput('usda', [row('170000', 'Onions, raw')], ings, { ui: { kcal: 38, protein: 1, fat: 0, carbs: 8, fibre: 2, salt: 0, source: 'estimate' } });
    expect(batches.map((b) => b.batch)).toEqual(['01', '02']);
    expect(batches[0]?.items).toHaveLength(80);
    expect(batches[1]?.items).toHaveLength(6);
    const all = batches.flatMap((b) => b.items);
    expect(all.some((i) => i.id === 'wc-papier')).toBe(false);
    const ui = all.find((i) => i.id === 'ui');
    expect(ui).toMatchObject({ nl: 'ui', en: 'onion', defaultUnit: 'stuk', aisle: 'groente-fruit', current: { kcal: 38, protein: 1, fat: 0, carbs: 8, source: 'estimate' } });
    expect(ui?.candidates).toEqual([{ code: '170000', name: 'Onions, raw', category: 'Vegetables', state: 'raw', kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3 }]);
    expect(all.find((i) => i.id === 'z00')?.candidates).toEqual([]);
    expect(all.find((i) => i.id === 'z00')?.current).toBeNull();
    // the text form is valid JSON of the same content
    expect(JSON.parse(formatMatchInput(batches[0]!))).toEqual(batches[0]);
  });
});

// Decisions Fable after the V9b lens (9 Nov 2026): the group word before the first comma, and brand rows.
describe('V9b after the lens', () => {
  const q = (...words: string[]) => ({ tokens: new Set(words), anchors: new Set([words[0]!]), prepared: null });
  it('the USDA group word costs nothing when a later comma part holds the product', () => {
    expect(scoreCandidate(q('cinnamon'), { name: 'Spices, cinnamon, ground', state: 'other' })).toBe(3);
    expect(scoreCandidate(q('cinnamon'), { name: 'Baobab powder', state: 'other' })).toBeLessThanOrEqual(0);
    // the alias token "ground" alone never carries a row: no anchor "cinnamon" -> out
    expect(scoreCandidate(q('cinnamon', 'ground'), { name: 'Emu, ground, raw', state: 'raw' })).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreCandidate(q('cinnamon', 'ground'), { name: 'Spices, cinnamon, ground', state: 'other' })).toBe(4);
    // the head is the part with the most query tokens: "pine nuts" beats the group word "Nuts"
    expect(scoreCandidate(q('pine', 'nut'), { name: 'Nuts, pine nuts, dried', state: 'dried' })).toBe(6 - 1);
    // acorns share no anchor token (the helper anchors on the first word, 'pine'): never a candidate
    expect(scoreCandidate(q('pine', 'nut'), { name: 'Nuts, acorns, raw', state: 'raw' })).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreCandidate(q('almond'), { name: 'Nuts, almonds', state: 'other' })).toBe(3);
    // the first part still counts (and still costs) when it shares a query token
    expect(scoreCandidate(q('onion'), { name: 'Onions, raw', state: 'raw' })).toBe(5);
    expect(scoreCandidate(q('gouda', 'cheese'), { name: 'Cheese, gouda', state: 'other' })).toBe(4);
  });
  it('brand rows are recognised and never candidates', () => {
    expect(isBrandRow('Beverages, Energy drink, RED BULL')).toBe(true);
    expect(isBrandRow('Kefir, lowfat, plain, LIFEWAY')).toBe(true);
    expect(isBrandRow("Cereals ready-to-eat, KELLOGG'S CORN FLAKES")).toBe(true);
    expect(isBrandRow('Onions, raw')).toBe(false);
    expect(isBrandRow('Oil, olive, salad or cooking')).toBe(false);
    const rows = [
      { code: '1', name: 'Beverages, Energy drink, RED BULL', state: 'other' as const },
      { code: '2', name: 'Beverages, Energy drink', state: 'other' as const },
    ];
    expect(bestCandidates(q('energy', 'drink'), rows).map((r) => r.code)).toEqual(['2']);
  });
});
