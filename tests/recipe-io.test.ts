// normalizeRecipe / recipeFingerprint / envelopes (docs/phase-1-spec.md §1): every shape the app
// ever produced becomes a full schema-2 recipe; unknown keys survive; fingerprints are stable.
import { describe, expect, it } from 'vitest';
import type { Recipe } from '../src/domain/model';
import { normalizeRecipe, readOptionalText, readQty, readVariant, readVariants, recipeFingerprint, recipeFromEnvelope, recipeToShareEnvelope } from '../src/domain/recipe-io';
import { decodeToken, encodeToken } from '../src/domain/token';

const INSTRUCTIONS = 'Kook de pasta in 10 minuten beetgaar en giet af.\n\nMeng met de pesto en serveer direct met kaas.';
const INSTRUCTIONS_EN = 'Boil the pasta for ten minutes until al dente and drain.\n\nMix with the pesto and serve at once with cheese.';
const STEP_EN_1 = 'Boil the pasta for ten minutes until al dente and drain.';
const STEP_EN_2 = 'Mix with the pesto and serve at once with cheese.';

const SCHEMA2: Recipe = {
  schema: 2,
  id: 'u:abc12345',
  rev: 3,
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-03T10:00:00.000Z',
  origin: { kind: 'user', author: 'Stijn' },
  name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
  tags: ['snel'],
  servings: 2,
  lines: [
    { raw: { nl: 'Saus:' }, kind: 'header' },
    { raw: { nl: '400 g pasta', en: '400 g pasta' } },
    { raw: { nl: '1 pot pesto' }, mystery: 'kept' } as Recipe['lines'][number],
  ],
  steps: [{ text: { nl: 'Kook de pasta in 10 minuten beetgaar en giet af.', en: 'Boil the pasta for 10 minutes and drain.' }, timers: [{ min: 10, unit: 'min' }] }],
  goesWith: [],
  aliases: [],
  futureKey: { anything: true },
};

describe('normalizeRecipe', () => {
  it('keeps a schema-2 recipe intact, including unknown keys at every level', () => {
    const r = normalizeRecipe(JSON.parse(JSON.stringify(SCHEMA2)));
    expect(r).not.toBeNull();
    expect(r).toEqual(SCHEMA2);
    expect(r!.futureKey).toEqual({ anything: true });
    expect((r!.lines[2] as unknown as { mystery: string }).mystery).toBe('kept');
  });

  it('fills the defaults of a partial schema-2 recipe and derives timers', () => {
    const r = normalizeRecipe({ schema: 2, name: { en: 'Soup' }, lines: ['2 onions', ''], steps: ['Simmer for 20 minutes.'] });
    expect(r).not.toBeNull();
    expect(r!.id).toMatch(/^u:[a-z0-9]{8}$/);
    expect(r!.rev).toBe(1);
    expect(r!.origin).toEqual({ kind: 'user' });
    expect(r!.servings).toBe(4);
    expect(r!.lines).toEqual([{ raw: { nl: '2 onions' } }]);
    expect(r!.steps[0]!.timers).toEqual([{ min: 20, unit: 'min', label: '20 minutes' }]);
    expect(r!.createdAt).toBe(r!.updatedAt);
    expect(r!.tags).toEqual([]);
  });

  it('reads the phase-0 share payload', () => {
    const r = normalizeRecipe({
      name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
      servings: 4,
      ingredients: ['Saus:', '400 g pasta', '', '1 pot pesto'],
      instructions: { nl: INSTRUCTIONS, en: INSTRUCTIONS_EN },
    });
    expect(r).not.toBeNull();
    expect(r!.name).toEqual({ nl: 'Pasta pesto', en: 'Pesto pasta' });
    expect(r!.lines).toEqual([{ raw: { nl: 'Saus:' }, kind: 'header' }, { raw: { nl: '400 g pasta' } }, { raw: { nl: '1 pot pesto' } }]);
    expect(r!.steps.map((s) => s.text)).toEqual([
      { nl: 'Kook de pasta in 10 minuten beetgaar en giet af.', en: STEP_EN_1 },
      { nl: 'Meng met de pesto en serveer direct met kaas.', en: STEP_EN_2 },
    ]);
    expect(r!.steps[0]!.timers).toEqual([{ min: 10, unit: 'min', label: '10 minuten' }]);
    expect(r!.origin.kind).toBe('user');
  });

  it('reads the phase-0 Dexie record', () => {
    const r = normalizeRecipe({
      id: 7,
      name: 'Pasta pesto',
      nameEn: 'Pesto pasta',
      ingredients: ['400 g pasta', '1 pot pesto'],
      instructions: INSTRUCTIONS,
      instructionsEn: INSTRUCTIONS_EN,
      servings: 3,
      origin: 'received',
      by: 'Emma',
      createdAt: '2026-09-20T18:00:00.000Z',
    });
    expect(r).not.toBeNull();
    expect(r!.id).toMatch(/^u:/); // numeric phase-0 ids are replaced
    expect(r!.origin).toEqual({ kind: 'received', receivedFrom: 'Emma' });
    expect(r!.name).toEqual({ nl: 'Pasta pesto', en: 'Pesto pasta' });
    expect(r!.servings).toBe(3);
    expect(r!.createdAt).toBe('2026-09-20T18:00:00.000Z');
    expect(r!.steps).toHaveLength(2);
    expect(r!.steps[1]!.text).toEqual({ nl: 'Meng met de pesto en serveer direct met kaas.', en: STEP_EN_2 });
  });

  it('reads a plain {name, ingredients, instructions}', () => {
    const r = normalizeRecipe({ name: 'Tosti', ingredients: ['2 sneetjes brood', 'kaas'], instructions: 'Beleg het brood met kaas en bak de tosti in 3 minuten goudbruin.' });
    expect(r).not.toBeNull();
    expect(r!.schema).toBe(2);
    expect(r!.name).toEqual({ nl: 'Tosti' });
    expect(r!.lines).toHaveLength(2);
    expect(r!.steps).toHaveLength(1);
    expect(r!.steps[0]!.timers).toEqual([{ min: 3, unit: 'min', label: '3 minuten' }]);
    expect(r!.origin).toEqual({ kind: 'user' });
  });

  it('returns null without a usable name or for non-objects', () => {
    expect(normalizeRecipe(null)).toBeNull();
    expect(normalizeRecipe('x')).toBeNull();
    expect(normalizeRecipe({ ingredients: ['a'], instructions: 'b' })).toBeNull();
    expect(normalizeRecipe({ name: { nl: '  ' }, ingredients: [], instructions: '' })).toBeNull();
  });

  it('is idempotent', () => {
    const once = normalizeRecipe({ name: 'Tosti', ingredients: ['kaas'], instructions: 'Bak 3 minuten.' })!;
    expect(normalizeRecipe(once)).toEqual(once);
  });
});

describe('recipeFingerprint', () => {
  it('is stable across ids, timestamps, steps and line order', () => {
    const a = normalizeRecipe(SCHEMA2)!;
    const b: Recipe = { ...a, id: 'u:other000', createdAt: '2000-01-01T00:00:00.000Z', rev: 9, steps: [], lines: [...a.lines].reverse() };
    expect(recipeFingerprint(a)).toBe(recipeFingerprint(b));
    expect(recipeFingerprint(a)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes when the name or a line changes', () => {
    const a = normalizeRecipe(SCHEMA2)!;
    expect(recipeFingerprint({ ...a, name: { nl: 'Pasta pesto 2' } })).not.toBe(recipeFingerprint(a));
    expect(recipeFingerprint({ ...a, lines: [...a.lines, { raw: { nl: 'zout' } }] })).not.toBe(recipeFingerprint(a));
  });

  it('matches between a phase-0 payload and its schema-2 form', () => {
    const legacy = normalizeRecipe({ name: { nl: 'Pasta pesto', en: 'Pesto pasta' }, ingredients: ['Saus:', '400 g pasta', '1 pot pesto'], instructions: { nl: INSTRUCTIONS } })!;
    const modern = normalizeRecipe({ ...SCHEMA2, lines: [{ raw: { nl: 'Saus:' }, kind: 'header' }, { raw: { nl: '400 g pasta' } }, { raw: { nl: '1 pot pesto' } }] })!;
    expect(recipeFingerprint(legacy)).toBe(recipeFingerprint(modern));
  });
});

describe('share envelopes', () => {
  it('wraps a recipe and reads it back, recording the sender', () => {
    const env = recipeToShareEnvelope(SCHEMA2, ' Stijn ');
    expect(env.v).toBe(2);
    expect(env.t).toBe('r');
    expect(env.by).toBe('Stijn');
    expect(typeof env.at).toBe('string');
    const back = recipeFromEnvelope(env)!;
    expect(back.id).toBe(SCHEMA2.id);
    expect(back.origin).toEqual({ kind: 'received', author: 'Stijn', receivedFrom: 'Stijn', receivedAt: env.at });
    expect(back.lines).toEqual(SCHEMA2.lines);
    expect(back.futureKey).toEqual({ anything: true });
  });

  it('omits an empty sender and keeps builtin origins', () => {
    const env = recipeToShareEnvelope({ ...SCHEMA2, id: 'b:pasta-pesto', origin: { kind: 'builtin' } }, '');
    expect('by' in env).toBe(false);
    expect(recipeFromEnvelope(env)!.origin.kind).toBe('builtin');
  });

  it('survives the token codec (both engines)', async () => {
    const env = recipeToShareEnvelope(SCHEMA2, 'Stijn');
    for (const engine of ['native', 'fflate'] as const) {
      const token = await encodeToken(env, { engine });
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      const decoded = await decodeToken(token, { engine });
      expect(recipeFromEnvelope(decoded)).toEqual(recipeFromEnvelope(env));
    }
  });

  it('accepts a phase-0 payload inside a v2 envelope', () => {
    const r = recipeFromEnvelope({ v: 2, t: 'r', by: 'Emma', r: { name: { nl: 'Tosti' }, ingredients: ['kaas'], instructions: { nl: 'Bak de tosti in 3 minuten goudbruin.' } } });
    expect(r).not.toBeNull();
    expect(r!.origin.kind).toBe('received');
    expect(r!.origin.receivedFrom).toBe('Emma');
    expect(r!.steps).toHaveLength(1);
  });

  it('rejects non-recipe envelopes', () => {
    expect(recipeFromEnvelope({ v: 2, t: 'p' })).toBeNull();
    expect(recipeFromEnvelope({ v: 2, t: 'r', r: { nonsense: true } })).toBeNull();
  });
});

// --- 13D: variants and tip (docs/specs/varianten-tabs.md §2e) -------------------------------------

const VARIANT_SWAP = { index: 1, fromId: 'pasta', toId: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta', en: '400 g gluten-free pasta' }, name: 'glutenvrije pasta' };
const GF = { approved: true, approvedAt: '2026-10-22T16:00:00.000Z', by: 'Stijn', swaps: [VARIANT_SWAP], checked: [] as number[] };
const TIP = { nl: 'Een dag in de koelkast maakt hem nog lekkerder.', en: 'Even better after a day in the fridge.' };

function withVariants(extra: Record<string, unknown>): Recipe {
  return normalizeRecipe(JSON.parse(JSON.stringify({ ...SCHEMA2, ...extra })))!;
}

describe('normalizeRecipe: variants and tip (13D)', () => {
  it('keeps valid variants and a tip exactly', () => {
    const r = withVariants({ variants: { glutenvrij: GF, vegan: { approved: false, swaps: [], checked: [2] } }, tip: TIP });
    expect(r).toEqual({ ...SCHEMA2, variants: { glutenvrij: GF, vegan: { approved: false, swaps: [], checked: [2] } }, tip: TIP });
    expect(normalizeRecipe(r)).toEqual(r); // idempotent
  });

  it('drops a swap without raw (or with another broken field) and keeps the rest of the variant', () => {
    const bad = [
      { ...VARIANT_SWAP, raw: undefined },
      { ...VARIANT_SWAP, raw: { nl: '  ' } },
      { ...VARIANT_SWAP, raw: '400 g glutenvrije pasta' },
      { ...VARIANT_SWAP, index: -1 },
      { ...VARIANT_SWAP, index: 1.5 },
      { ...VARIANT_SWAP, fromId: '' },
      { ...VARIANT_SWAP, toId: 7 },
      { ...VARIANT_SWAP, name: 12 },
      { ...VARIANT_SWAP, grams: { min: 0 } },
      { ...VARIANT_SWAP, grams: 'veel' },
      'x',
      null,
    ];
    const r = withVariants({ variants: { glutenvrij: { ...GF, swaps: [...bad, VARIANT_SWAP] } } });
    expect(r.variants).toEqual({ glutenvrij: GF });
  });

  it('reads grams through the Qty reader and keeps unknown keys on a swap and a variant', () => {
    const swap = { ...VARIANT_SWAP, grams: { min: 800, max: 600, approx: true, junk: 1 }, future: 'kept' };
    const r = withVariants({ variants: { glutenvrij: { ...GF, swaps: [swap], extra: { a: 1 } } } });
    expect(r.variants?.glutenvrij).toEqual({ ...GF, swaps: [{ ...VARIANT_SWAP, grams: { min: 800, approx: true }, future: 'kept' }], extra: { a: 1 } });
    expect(readQty({ min: 2, max: 3 })).toEqual({ min: 2, max: 3 });
    expect(readQty({ min: Infinity })).toBeUndefined();
    expect(readQty(null)).toBeUndefined();
  });

  it('drops a variant with empty swaps AND empty checked (nothing was approved)', () => {
    const r = withVariants({ variants: { glutenvrij: { ...GF, swaps: [], checked: [] }, vegan: GF } });
    expect(r.variants).toEqual({ vegan: GF });
    // Only broken swaps and no checked lines: also nothing left.
    expect(withVariants({ variants: { glutenvrij: { ...GF, swaps: [{ index: 'a' }] } } }).variants).toEqual({});
    // No swaps array at all: not a variant.
    expect(withVariants({ variants: { glutenvrij: { approved: true, checked: [1] } } }).variants).toEqual({});
  });

  it('cleans approved, checked, approvedAt and by', () => {
    const r = withVariants({ variants: { glutenvrij: { swaps: [VARIANT_SWAP], checked: [3, 3, -1, 2.5, '4', 5, 0], approvedAt: 'gisteren', by: 42 } } });
    expect(r.variants?.glutenvrij).toEqual({ approved: true, swaps: [VARIANT_SWAP], checked: [3, 5, 0] });
    const anon = withVariants({ variants: { glutenvrij: { ...GF, approved: 'ja', by: null } } });
    expect(anon.variants?.glutenvrij).toEqual({ ...GF, approved: true, by: null });
    expect(withVariants({ variants: { glutenvrij: { ...GF, approved: false } } }).variants?.glutenvrij?.approved).toBe(false);
  });

  it('keeps a diet key this app does not know exactly as it came', () => {
    const r = withVariants({ variants: { notenvrij: { whatever: [1, 2] }, glutenvrij: GF } });
    expect(r.variants).toEqual({ notenvrij: { whatever: [1, 2] }, glutenvrij: GF });
    // 'lactosevrij' is one of the VARIANT_DIETS: it is read (and kept when valid).
    expect(withVariants({ variants: { lactosevrij: GF } }).variants).toEqual({ lactosevrij: GF });
    // A "__proto__" key from a token stays a plain key: it never smuggles an unchecked diet in.
    const odd = normalizeRecipe(JSON.parse('{"schema":2,"name":{"nl":"x"},"lines":[],"variants":{"__proto__":{"glutenvrij":{"swaps":[1]}}}}'))!;
    expect(Object.getPrototypeOf(odd.variants)).toBe(Object.prototype);
    expect(odd.variants?.glutenvrij).toBeUndefined();
  });

  it('variants that are not an object drop the key; null stays null; readVariants/readVariant directly', () => {
    expect(withVariants({ variants: 'x' })).not.toHaveProperty('variants');
    expect(withVariants({ variants: [GF] })).not.toHaveProperty('variants');
    expect(withVariants({ variants: 3 })).not.toHaveProperty('variants');
    expect(withVariants({ variants: null }).variants).toBeNull();
    expect(withVariants({})).not.toHaveProperty('variants');
    expect(readVariants(undefined)).toBeUndefined();
    expect(readVariants(null)).toBeNull();
    expect(readVariant({ swaps: 'x' })).toBeNull();
    expect(readVariant(GF)).toEqual(GF);
  });

  it('tip is read like description/servingTip (readOptionalText): null stays null, no text becomes null', () => {
    expect(withVariants({ tip: null }).tip).toBeNull();
    expect(withVariants({ tip: {} }).tip).toBeNull();
    expect(withVariants({ tip: 5 }).tip).toBeNull();
    expect(withVariants({ tip: { en: ' Taste first. ', fr: 'x' } }).tip).toEqual({ en: 'Taste first.' });
    expect(withVariants({})).not.toHaveProperty('tip');
    // NB: a plain string is taken as Dutch, exactly as for description/servingTip (§2e "als
    // description/servingTip (readOptionalText)"); §6 of the spec expects "key weg" here — reported.
    expect(withVariants({ tip: 'Proef eerst.' }).tip).toEqual({ nl: 'Proef eerst.' });
    expect(readOptionalText(undefined)).toBeUndefined();
  });

  it('variants and tip do not change the fingerprint (an approval is "the same recipe")', () => {
    const plain = normalizeRecipe(SCHEMA2)!;
    expect(recipeFingerprint(withVariants({ variants: { glutenvrij: GF }, tip: TIP }))).toBe(recipeFingerprint(plain));
  });

  it('a recipe with variants and a tip survives the share envelope', () => {
    const r = withVariants({ variants: { glutenvrij: GF }, tip: TIP });
    const back = recipeFromEnvelope(recipeToShareEnvelope(r, 'Stijn'))!;
    expect(back.variants).toEqual({ glutenvrij: GF });
    expect(back.tip).toEqual(TIP);
  });
});
