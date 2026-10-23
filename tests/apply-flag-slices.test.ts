// tools/apply-flag-slices.ts: the slice check (every refusal of docs/specs/labels-categorieen.md §2a
// "De datapass" / §6a) and the merge (lactose right after gluten/glutenUnsure, nothing else touched,
// idempotent), on a small fixture and on the real data/ingredients.json in memory.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Ingredient } from '../src/domain/dictionary';
import { formatIngredientsFile } from '../tools/apply-llm-batch.ts';
import { applySlices, checkSlices, readSliceFiles, readSlices, type SliceFlags } from '../tools/apply-flag-slices.ts';

const KAAS: Ingredient = {
  id: 'kaas',
  nl: { one: 'kaas' },
  en: { one: 'cheese' },
  aliases: { nl: ['goudse kaas'] },
  aisle: 'kaas',
  defaultUnit: 'g',
  gramsPer: { stuk: 450 },
  staple: true,
  veg: true,
  vegan: false,
  gluten: false,
  perishable: true,
  gloss: { en: 'Gouda' },
};
const MARGARINE: Ingredient = {
  id: 'margarine',
  nl: { one: 'margarine' },
  en: { one: 'margarine' },
  aisle: 'zuivel-eieren',
  defaultUnit: 'g',
  staple: true,
  veg: true,
  vegan: false,
  gluten: false,
  glutenUnsure: true,
  perishable: true,
};
const SOJAMELK: Ingredient = {
  id: 'sojamelk',
  nl: { one: 'sojamelk' },
  en: { one: 'soy milk' },
  aisle: 'zuivel-eieren',
  defaultUnit: 'ml',
  staple: false,
  veg: true,
  vegan: true,
  gluten: false,
};
const UI: Ingredient = {
  id: 'ui',
  nl: { one: 'ui', many: 'uien' },
  en: { one: 'onion', many: 'onions' },
  aisle: 'groente-fruit',
  defaultUnit: 'stuk',
  cut: 'slice',
  staple: false,
  veg: true,
  vegan: true,
  gluten: false,
  perishable: true,
};
const ING: readonly Ingredient[] = [KAAS, MARGARINE, SOJAMELK, UI];

/** A complete, consistent set: every fixture id exactly once, rule H1 respected. */
function slices(): Record<string, Record<string, unknown>> {
  return {
    'slice-01-groente-fruit.json': { ui: { lactose: false } },
    'slice-09-zuivel-kaas.json': {
      kaas: { lactose: true },
      margarine: { lactose: false, lactoseUnsure: true },
      sojamelk: { lactose: false },
    },
  };
}

const FLAGS: Record<string, SliceFlags> = {
  kaas: { lactose: true },
  margarine: { lactose: false, lactoseUnsure: true },
  sojamelk: { lactose: false },
  ui: { lactose: false },
};

describe('checkSlices', () => {
  it('is empty for a complete, consistent set', () => {
    expect(checkSlices(slices(), ING)).toEqual([]);
  });

  it('(a) refuses an id that is not in ingredients.json', () => {
    const s = slices();
    s['slice-01-groente-fruit.json']!['uien-x'] = { lactose: false };
    const errors = checkSlices(s, ING);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"uien-x"');
    expect(errors[0]).toContain('unknown id');
  });

  it('(b) refuses an id that is in two slices', () => {
    const s = slices();
    s['slice-09-zuivel-kaas.json']!['ui'] = { lactose: false };
    const errors = checkSlices(s, ING);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"ui"');
    expect(errors[0]).toContain('slice-01-groente-fruit.json');
    expect(errors[0]).toContain('slice-09-zuivel-kaas.json');
  });

  it('(c) refuses an entry that is in no slice, naming the id', () => {
    const s = slices();
    delete s['slice-09-zuivel-kaas.json']!['sojamelk'];
    const errors = checkSlices(s, ING);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"sojamelk"');
    expect(errors[0]).toContain('in no slice');
  });

  it('(d) refuses lactoseUnsure next to lactose: true', () => {
    const s = slices();
    s['slice-09-zuivel-kaas.json']!['kaas'] = { lactose: true, lactoseUnsure: true };
    const errors = checkSlices(s, ING);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"kaas"');
    expect(errors[0]).toContain('drop lactoseUnsure');
  });

  it('(e) refuses lactose: true on a vegan entry (rule H1)', () => {
    const s = slices();
    s['slice-09-zuivel-kaas.json']!['sojamelk'] = { lactose: true };
    const errors = checkSlices(s, ING);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"sojamelk"');
    expect(errors[0]).toContain('plant-based product cannot contain lactose');
  });

  it('(f) refuses lactoseUnsure on a vegan entry (rule H1)', () => {
    const s = slices();
    s['slice-01-groente-fruit.json']!['ui'] = { lactose: false, lactoseUnsure: true };
    const errors = checkSlices(s, ING);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"ui"');
    expect(errors[0]).toContain('never unsure about lactose');
  });

  it('refuses a value that is not { lactose, lactoseUnsure?: true }', () => {
    for (const bad of [{ lactose: 'ja' }, {}, true, { lactose: false, lactoseUnsure: false }, { lactose: false, vegan: true }]) {
      const s = slices();
      s['slice-01-groente-fruit.json']!['ui'] = bad;
      expect(checkSlices(s, ING), JSON.stringify(bad)).toHaveLength(1);
    }
    expect(checkSlices({ ...slices(), 'slice-02-vlees-vis.json': [] }, ING)).toHaveLength(1);
  });

  it('is empty for one slice with every real entry (lactose: false is always consistent)', () => {
    const real = JSON.parse(readFileSync(new URL('../data/ingredients.json', import.meta.url), 'utf8')) as Ingredient[];
    const all = Object.fromEntries(real.map((ing) => [ing.id, { lactose: false }]));
    expect(checkSlices({ 'slice-01-alles.json': all }, real)).toEqual([]);
  });
});

describe('applySlices', () => {
  const out = applySlices(ING, FLAGS);
  const byId = new Map(out.map((ing) => [ing.id, ing]));

  it('puts lactose (and lactoseUnsure) right after gluten / glutenUnsure', () => {
    expect(Object.keys(byId.get('kaas')!)).toEqual(['id', 'nl', 'en', 'aliases', 'aisle', 'defaultUnit', 'gramsPer', 'staple', 'veg', 'vegan', 'gluten', 'lactose', 'perishable', 'gloss']);
    expect(Object.keys(byId.get('margarine')!)).toEqual(['id', 'nl', 'en', 'aisle', 'defaultUnit', 'staple', 'veg', 'vegan', 'gluten', 'glutenUnsure', 'lactose', 'lactoseUnsure', 'perishable']);
    expect(Object.keys(byId.get('sojamelk')!).slice(-2)).toEqual(['gluten', 'lactose']);
    expect(byId.get('kaas')!.lactose).toBe(true);
    expect(byId.get('kaas')!.lactoseUnsure).toBeUndefined();
    expect(byId.get('margarine')!.lactose).toBe(false);
    expect(byId.get('margarine')!.lactoseUnsure).toBe(true);
    expect(byId.get('ui')!.lactose).toBe(false);
  });

  it('leaves every other field alone and does not mutate the input', () => {
    for (const before of ING) {
      const { lactose, lactoseUnsure, ...rest } = byId.get(before.id)!;
      expect(typeof lactose).toBe('boolean');
      expect(rest).toEqual(before);
      expect('lactose' in before).toBe(false);
    }
  });

  it('is idempotent', () => {
    const twice = applySlices(out, FLAGS);
    expect(twice).toEqual(out);
    expect(twice.map((ing) => Object.keys(ing))).toEqual(out.map((ing) => Object.keys(ing)));
    expect(formatIngredientsFile(twice)).toBe(formatIngredientsFile(out));
  });

  it('replaces older flags: a new lactose: false drops an old lactoseUnsure', () => {
    const [m] = applySlices(applySlices([MARGARINE], FLAGS), { margarine: { lactose: false } });
    expect(m!.lactose).toBe(false);
    expect('lactoseUnsure' in m!).toBe(false);
    expect(Object.keys(m!)).toEqual(['id', 'nl', 'en', 'aisle', 'defaultUnit', 'staple', 'veg', 'vegan', 'gluten', 'glutenUnsure', 'lactose', 'perishable']);
  });

  it('leaves an entry without slice flags untouched', () => {
    const [k, u] = applySlices([KAAS, UI], { ui: { lactose: false } });
    expect(k).toBe(KAAS);
    expect(u!.lactose).toBe(false);
  });

  it('only inserts the flags into the real file (same style, same order, nothing else changes)', () => {
    const text = readFileSync(new URL('../data/ingredients.json', import.meta.url), 'utf8');
    const real = JSON.parse(text) as Ingredient[];
    const merged = formatIngredientsFile(applySlices(real, Object.fromEntries(real.map((ing) => [ing.id, { lactose: false }]))));
    const strip = (s: string) => s.replace(/, "lactose": (true|false)(, "lactoseUnsure": true)?/g, '');
    expect(strip(merged)).toBe(strip(text));
    expect(merged.match(/"lactose": false/g)).toHaveLength(real.length);
    expect(merged).not.toContain('lactoseUnsure');
  });
});

describe('readSliceFiles / readSlices', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flag-slices-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'slice-01-groente-fruit.json'), JSON.stringify({ ui: { lactose: false } }));
  writeFileSync(join(dir, 'slice-09-zuivel-kaas.json'), JSON.stringify({ kaas: { lactose: true }, margarine: { lactose: false, lactoseUnsure: true }, sojamelk: { lactose: false } }));
  // Not slices: an agent's input list and a note.
  writeFileSync(join(dir, 'slice-01-groente-fruit.input.json'), JSON.stringify([{ id: 'ui' }]));
  writeFileSync(join(dir, 'notes.json'), '{}');

  it('reads only slice-NN-….json, keyed by file name, in name order', () => {
    const files = readSliceFiles(dir);
    expect(Object.keys(files)).toEqual(['slice-01-groente-fruit.json', 'slice-09-zuivel-kaas.json']);
    expect(checkSlices(files, ING)).toEqual([]);
  });

  it('merges the slices into one id -> flags map', () => {
    expect(readSlices(dir)).toEqual(FLAGS);
  });

  it('throws on an id in two slices instead of picking one', () => {
    const dup = mkdtempSync(join(tmpdir(), 'flag-slices-dup-'));
    try {
      writeFileSync(join(dup, 'slice-01-a.json'), JSON.stringify({ ui: { lactose: false } }));
      writeFileSync(join(dup, 'slice-02-b.json'), JSON.stringify({ ui: { lactose: false } }));
      expect(() => readSlices(dup)).toThrow(/also in slice-01-a\.json/);
    } finally {
      rmSync(dup, { recursive: true, force: true });
    }
  });
});
