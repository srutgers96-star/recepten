// The lactose flag on the real dictionary (docs/specs/labels-categorieen.md §2a, block 1): every
// entry carries a boolean `lactose`, rule H1 holds (a plant-based entry is plain `lactose: false`),
// `lactoseUnsure` only stands next to `lactose: false`, and Fable's sample of 85 ids (three lists,
// filled in before the data pass) comes out exactly as written in the spec.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Ingredient } from '../src/domain/dictionary';

const ingredients = JSON.parse(readFileSync(new URL('../data/ingredients.json', import.meta.url), 'utf8')) as Ingredient[];
const byId = new Map(ingredients.map((ing) => [ing.id, ing]));

/** The flags of one entry as the sample states them; `missing` when the id is not in the file. */
function flags(id: string): { lactose: unknown; lactoseUnsure: unknown } | 'missing' {
  const ing = byId.get(id);
  return ing ? { lactose: ing.lactose, lactoseUnsure: ing.lactoseUnsure } : 'missing';
}

// The sample of §2a, verbatim. Every id exists in data/ingredients.json (checked 23 Oct 2026).
const SAMPLE_TRUE = [
  'kaas', 'parmezaanse-kaas', 'pecorino', 'gruyere', 'blauwe-kaas', 'feta', 'mozzarella', 'geitenkaas', 'paneer',
  'boter', 'ghee', 'melk', 'room', 'slagroom', 'kookroom', 'creme-fraiche', 'zure-room', 'yoghurt', 'griekse-yoghurt',
  'kwark', 'karnemelk', 'kefir', 'roomkaas', 'mon-chou', 'huttenkase', 'kruidenboter', 'vla', 'roomijs', 'pesto', 'kaassaus',
  'bechamelsaus', 'hollandaisesaus', 'melkchocolade', 'chocolade', 'gecondenseerde-melk', 'melkpoeder', 'croissant',
  'tzatziki', 'koffiemelk', 'pizza', 'kaastortellini', 'boterkoek', 'hagelslag',
  'olie-en-boter-om-in-te-bakken',
];
const SAMPLE_FALSE = [
  'ei', 'eidooier', 'kokosmelk', 'sojamelk', 'havermelk', 'sojaroom', 'kokosyoghurt',
  'vegan-boter', 'vegan-kaas', 'lactosevrije-melk', 'lactosevrije-yoghurt', 'mayonaise', 'olijfolie', 'mosterd',
  'sojasaus', 'worcestersaus', 'kip', 'zalm', 'ham', 'rijst', 'spaghetti', 'aardappel', 'ui', 'bloemen', 'aanmaakblokje',
  'sorbetijs', 'ontbijtkoek', 'pindakaas', 'kokosolie', 'edelgistvlokken',
  // H1: vegan in the data, so plain false although the aisle rule would say "unsure".
  'pure-chocolade', 'bouillonblokje', 'chips', 'aardappelpuree',
];
const SAMPLE_UNSURE = ['margarine', 'halvarine', 'bladerdeeg', 'rookworst', 'knakworst', 'aardappelsalade', 'zanddeeg'];

describe('lactose flag on data/ingredients.json', () => {
  it('every entry has a boolean lactose', () => {
    const without = ingredients.filter((ing) => typeof ing.lactose !== 'boolean').map((ing) => ing.id);
    expect(without).toEqual([]);
  });

  it('no plant-based entry has lactose: true or lactoseUnsure (rule H1)', () => {
    expect(ingredients.filter((ing) => ing.vegan === true && ing.lactose === true).map((ing) => ing.id)).toEqual([]);
    expect(ingredients.filter((ing) => ing.vegan === true && ing.lactoseUnsure !== undefined).map((ing) => ing.id)).toEqual([]);
  });

  it('lactoseUnsure is only ever true, and only next to lactose: false', () => {
    const wrong = ingredients.filter((ing) => ing.lactoseUnsure !== undefined && !(ing.lactoseUnsure === true && ing.lactose === false));
    expect(wrong.map((ing) => ing.id)).toEqual([]);
  });

  it('the three sample lists of §2a are disjoint and hold 85 ids', () => {
    const all = [...SAMPLE_TRUE, ...SAMPLE_FALSE, ...SAMPLE_UNSURE];
    expect(all).toHaveLength(85);
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(SAMPLE_TRUE)('%s is lactose: true', (id) => {
    expect(flags(id)).toEqual({ lactose: true, lactoseUnsure: undefined });
  });

  it.each(SAMPLE_FALSE)('%s is lactose: false without lactoseUnsure', (id) => {
    expect(flags(id)).toEqual({ lactose: false, lactoseUnsure: undefined });
  });

  it.each(SAMPLE_UNSURE)('%s is lactose: false with lactoseUnsure: true', (id) => {
    expect(flags(id)).toEqual({ lactose: false, lactoseUnsure: true });
  });
});
