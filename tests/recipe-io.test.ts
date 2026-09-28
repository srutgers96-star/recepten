// normalizeRecipe / recipeFingerprint / envelopes (docs/phase-1-spec.md §1): every shape the app
// ever produced becomes a full schema-2 recipe; unknown keys survive; fingerprints are stable.
import { describe, expect, it } from 'vitest';
import type { Recipe } from '../src/domain/model';
import { normalizeRecipe, recipeFingerprint, recipeFromEnvelope, recipeToShareEnvelope } from '../src/domain/recipe-io';
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
