// Share envelopes (docs/phase-3-spec.md §1, src/domain/share.ts): recipe / patch / bundle
// round-trips, the dictionary delta (user ids only), the frozen tokens of all three kinds and
// planMessages (single recipe, single patch, several items, limit -> bundle file).
import { describe, expect, it } from 'vitest';
import type { Ingredient } from '../src/domain/dictionary';
import type { Recipe } from '../src/domain/model';
import type { LineOverride, RecipeOverride } from '../src/domain/overrides';
import { buildShareMessageFor } from '../src/domain/message';
import type { Plan } from '../src/domain/planner';
import {
  buildBundleEnvelope,
  buildPatchEnvelope,
  buildPlanEnvelope,
  buildPlanShareMessage,
  buildRecipeEnvelope,
  bundleFileName,
  combineEnvelopes,
  envelopeItemCount,
  parseEnvelope,
  planDishCount,
  planMessages,
  referencedIngredientIds,
  type PatchPayload,
  type PlanPayload,
} from '../src/domain/share';
import { decodeToken, encodeToken, extractTokens } from '../src/domain/token';
import { FROZEN_ENVELOPE_W, FROZEN_TOKEN_B, FROZEN_TOKEN_P, FROZEN_TOKEN_P_FFLATE, FROZEN_TOKEN_W, FROZEN_TOKEN_W_FFLATE } from './fixtures/frozen-share-tokens';

const APP_URL = 'https://stijn.github.io/recepten/';

function ing(id: string, nl: string, en: string, updatedAt?: string): Ingredient {
  const e: Ingredient = { id, nl: { one: nl }, en: { one: en }, aisle: 'overig', defaultUnit: 'stuk', staple: false, veg: true };
  if (updatedAt) e.updatedAt = updatedAt;
  return e;
}

const USER_INGREDIENTS: Ingredient[] = [ing('pesto-huis', 'huisgemaakte pesto', 'homemade pesto', '2026-09-15T00:00:00.000Z'), ing('bergkaas', 'bergkaas', 'mountain cheese')];

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id: 'u:abc12345',
    rev: 3,
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    origin: { kind: 'user', author: 'Stijn' },
    name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
    tags: ['snel'],
    servings: 2,
    lines: [
      { raw: { nl: '400 g pasta', en: '400 g pasta' }, qty: { min: 400 }, unit: 'g', ing: 'pasta' },
      { raw: { nl: '1 pot pesto' }, ing: 'pesto-huis' },
      { raw: { nl: 'peper en zout' }, ing: null, alt: [{ raw: { nl: 'bergkaas' }, ing: 'bergkaas' }] },
    ],
    steps: [{ text: { nl: 'Kook de pasta.', en: 'Boil the pasta.' } }],
    goesWith: [],
    aliases: [],
    ...over,
  };
}

const OVERRIDE: RecipeOverride = {
  baseId: 'b:uiensoep',
  rev: 2,
  patch: { name: { en: 'French onion soup' }, lines: [{ raw: { nl: '4 uien' } }, { raw: { nl: '1 l bouillon' }, ing: 'bergkaas' }] },
  updatedAt: '2026-09-29T09:30:00.000Z',
  by: 'Stijn',
};

const LINE_OVERRIDES: LineOverride[] = [{ recipeId: 'b:uiensoep', index: 0, ing: 'pesto-huis', updatedAt: '2026-09-29T09:00:00.000Z' }];

describe('buildRecipeEnvelope', () => {
  it('wraps the recipe, records the sender and adds only the referenced USER ingredients', () => {
    const env = buildRecipeEnvelope(recipe(), { by: ' Stijn ', userIngredients: USER_INGREDIENTS });
    expect(env.v).toBe(2);
    expect(env.t).toBe('r');
    expect(env.by).toBe('Stijn');
    expect(typeof env.at).toBe('string');
    expect((env.r as Recipe).id).toBe('u:abc12345');
    // 'pasta' is a builtin id (not in userIngredients) -> not in the delta; alt lines count.
    expect((env.dict as { ing: Ingredient[] }).ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
  });

  it('folds the line overrides in and strips receiver-side bookkeeping (sync, override)', () => {
    const r = recipe({ sync: { receivedRev: 3 }, override: { rev: 1, updatedAt: 'x' } } as Partial<Recipe>);
    const env = buildRecipeEnvelope(r, {
      by: 'Stijn',
      userIngredients: [],
      lineOverrides: [{ recipeId: r.id, index: 2, ing: 'zout', updatedAt: '2026-09-29T00:00:00.000Z' }],
    });
    const out = env.r as Recipe;
    expect(out.sync).toBeUndefined();
    expect(out.override).toBeUndefined();
    expect(out.lines[2]?.ing).toBe('zout');
    expect(out.lines[2]?.confidence).toBe(1);
    expect(env.dict).toBeUndefined();
    // The input is not mutated.
    expect(r.lines[2]?.ing).toBeNull();
  });

  it('has no `by` for an empty sender', () => {
    const env = buildRecipeEnvelope(recipe(), { by: '', userIngredients: [] });
    expect('by' in env).toBe(false);
  });
});

describe('buildPatchEnvelope', () => {
  it('carries baseId, rev, patch, line overrides, the name and the delta of patch + overrides', () => {
    const env = buildPatchEnvelope(OVERRIDE, { by: 'Stijn', userIngredients: USER_INGREDIENTS, lineOverrides: LINE_OVERRIDES, name: { nl: 'Uiensoep', en: 'French onion soup' } });
    expect(env.t).toBe('p');
    const p = env.p as PatchPayload;
    expect(p.baseId).toBe('b:uiensoep');
    expect(p.rev).toBe(2);
    expect(p.patch).toEqual(OVERRIDE.patch);
    expect(p.lineOverrides).toEqual(LINE_OVERRIDES);
    expect(p.name).toEqual({ nl: 'Uiensoep', en: 'French onion soup' });
    expect(p.updatedAt).toBe(OVERRIDE.updatedAt);
    expect((env.dict as { ing: Ingredient[] }).ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
  });

  it('omits empty line overrides, name and delta', () => {
    const env = buildPatchEnvelope({ ...OVERRIDE, patch: { name: { en: 'X' } } }, { by: 'Stijn', userIngredients: USER_INGREDIENTS });
    const p = env.p as PatchPayload;
    expect(p.lineOverrides).toBeUndefined();
    expect(p.name).toBeUndefined();
    expect(env.dict).toBeUndefined();
  });
});

describe('buildBundleEnvelope', () => {
  it('bundles recipes and patches with title/since and one merged delta', () => {
    const env = buildBundleEnvelope(
      { recipes: [recipe()], patches: [OVERRIDE], lineOverrides: LINE_OVERRIDES, names: { 'b:uiensoep': { nl: 'Uiensoep' } } },
      { by: 'Stijn', userIngredients: USER_INGREDIENTS },
      { title: 'Nieuw', since: '2026-09-01T00:00:00.000Z' },
    );
    expect(env.t).toBe('b');
    const b = env.b as { title?: string; since?: string; recipes: Recipe[]; patches: PatchPayload[] };
    expect(b.title).toBe('Nieuw');
    expect(b.since).toBe('2026-09-01T00:00:00.000Z');
    expect(b.recipes).toHaveLength(1);
    expect(b.patches[0]?.lineOverrides).toEqual(LINE_OVERRIDES);
    expect(b.patches[0]?.name).toEqual({ nl: 'Uiensoep' });
    expect((env.dict as { ing: Ingredient[] }).ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
    expect(envelopeItemCount(env)).toBe(2);
  });
});

describe('parseEnvelope', () => {
  it('round-trips a recipe envelope through the token codec', async () => {
    const env = buildRecipeEnvelope(recipe(), { by: 'Stijn', userIngredients: USER_INGREDIENTS });
    const parsed = parseEnvelope(await decodeToken(await encodeToken(env)));
    expect(parsed.kind).toBe('recipe');
    expect(parsed.by).toBe('Stijn');
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.recipes[0]).toEqual(recipe());
    expect(parsed.patches).toEqual([]);
    expect(parsed.dict.ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
  });

  it('round-trips a patch envelope', async () => {
    const env = buildPatchEnvelope(OVERRIDE, { by: 'Stijn', userIngredients: [], lineOverrides: LINE_OVERRIDES, name: { nl: 'Uiensoep' } });
    const parsed = parseEnvelope(await decodeToken(await encodeToken(env)));
    expect(parsed.kind).toBe('patch');
    expect(parsed.recipes).toEqual([]);
    expect(parsed.patches).toHaveLength(1);
    expect(parsed.patches[0]).toMatchObject({ baseId: 'b:uiensoep', rev: 2, patch: OVERRIDE.patch, lineOverrides: LINE_OVERRIDES, name: { nl: 'Uiensoep' } });
  });

  it('round-trips a bundle envelope', async () => {
    const env = buildBundleEnvelope({ recipes: [recipe()], patches: [OVERRIDE] }, { by: 'Stijn', userIngredients: USER_INGREDIENTS }, { title: 'T' });
    const parsed = parseEnvelope(await decodeToken(await encodeToken(env)));
    expect(parsed.kind).toBe('bundle');
    expect(parsed.title).toBe('T');
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.patches).toHaveLength(1);
  });

  it('reads the frozen #p= token (both engines) and the frozen #b= token', async () => {
    for (const token of [FROZEN_TOKEN_P, FROZEN_TOKEN_P_FFLATE]) {
      const parsed = parseEnvelope(await decodeToken(token));
      expect(parsed.kind).toBe('patch');
      expect(parsed.by).toBe('Stijn');
      expect(parsed.patches[0]?.baseId).toBe('b:uiensoep');
      expect(parsed.patches[0]?.rev).toBe(2);
      expect(parsed.patches[0]?.lineOverrides?.[0]?.ing).toBe('runderbouillon');
      expect(parsed.dict.ing[0]?.id).toBe('runderbouillon');
    }
    const bundle = parseEnvelope(await decodeToken(FROZEN_TOKEN_B));
    expect(bundle.kind).toBe('bundle');
    expect(bundle.title).toBe('Nieuw sinds september');
    expect(bundle.since).toBe('2026-09-01T00:00:00.000Z');
    expect(bundle.recipes.map((r) => r.name.nl)).toEqual(['Pasta pesto', 'Oude soep']);
    // The phase-0 shape got a schema-2 body.
    expect(bundle.recipes[1]?.schema).toBe(2);
    expect(bundle.recipes[1]?.lines).toHaveLength(2);
    expect(bundle.recipes[1]?.steps.length).toBeGreaterThan(0);
    expect(bundle.patches[0]).toMatchObject({ baseId: 'b:dahl', rev: 1, name: { nl: 'Dahl', en: 'Dahl' } });
    expect(bundle.dict.ing.map((i) => i.id)).toEqual(['pesto-huis']);
  });

  it('keeps unknown keys on the items and strips sync/override from incoming recipes', () => {
    const parsed = parseEnvelope({ v: 2, t: 'r', r: { ...recipe(), sync: { receivedRev: 1 }, override: { rev: 1 }, zzz: 1 }, extra: true });
    expect(parsed.recipes[0]?.zzz).toBe(1);
    expect(parsed.recipes[0]?.sync).toBeUndefined();
    expect(parsed.recipes[0]?.override).toBeUndefined();
  });

  it('reads a legacy backup file as a bundle', () => {
    const parsed = parseEnvelope({
      v: 2,
      t: 'b',
      at: 'x',
      app: 'recepten',
      profiles: [],
      userRecipes: [recipe()],
      overrides: [OVERRIDE],
      userIngredients: USER_INGREDIENTS,
      favorites: [],
      notes: [],
      cookLog: [],
      settings: [],
    });
    expect(parsed.kind).toBe('bundle');
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.patches[0]?.baseId).toBe('b:uiensoep');
    expect(parsed.dict.ing).toHaveLength(2);
  });

  it('drops unusable items and bad ingredients, and rejects non-envelopes / newer versions', () => {
    const parsed = parseEnvelope({ v: 2, t: 'b', b: { recipes: [{}, null, 'x'], patches: [{ rev: 1 }, { baseId: 'b:x' }] }, dict: { ing: [{ id: 'Bad Id' }, { id: 'ok', nl: { one: 'ok' } }] } });
    expect(parsed.recipes).toEqual([]);
    expect(parsed.patches).toEqual([]);
    expect(parsed.dict.ing.map((i) => i.id)).toEqual(['ok']);
    expect(() => parseEnvelope(null)).toThrow('invalid-token');
    expect(() => parseEnvelope({ v: 2, t: 'x' })).toThrow('invalid-token');
    expect(() => parseEnvelope({ v: 3, t: 'r' })).toThrow('unsupported-version');
    // 'w' without a payload object is not a plan.
    expect(() => parseEnvelope({ v: 2, t: 'w' })).toThrow('invalid-token');
  });
});

// --- Phase 4: the week plan (`#w=`) --------------------------------------------------------------

const PLAN: Plan = {
  id: 'current',
  updatedAt: '2026-09-29T11:00:00.000Z',
  note: '  Boodschappen zaterdag ',
  items: [
    { id: 'pi:1', recipeId: 'b:dahl', servings: 4, addedAt: 'x' },
    { id: 'pi:2', recipeId: 'b:uiensoep', servings: 2, locked: true, addedAt: 'x' },
    { id: 'pi:3', recipeId: 'u:abc12345', servings: 4, addedAt: 'x' },
    { id: 'pi:4', recipeId: 'b:lasagne', servings: 4, cooked: true, addedAt: 'x' },
  ],
};

describe('buildPlanEnvelope', () => {
  it('carries the uncooked dishes with servings, embeds only the own recipes of the plan and their user ingredients', () => {
    const builtin = recipe({ id: 'b:dahl', origin: { kind: 'builtin' } });
    const stranger = recipe({ id: 'u:notinplan' });
    const env = buildPlanEnvelope(PLAN, [builtin, stranger, recipe()], { by: 'Stijn', userIngredients: USER_INGREDIENTS });
    expect(env.t).toBe('w');
    expect(env.by).toBe('Stijn');
    const w = env.w as PlanPayload;
    expect(w.items).toEqual([
      { rid: 'b:dahl', srv: 4 },
      { rid: 'b:uiensoep', srv: 2 },
      { rid: 'u:abc12345', srv: 4 },
    ]);
    expect(w.recipes.map((r) => r.id)).toEqual(['u:abc12345']);
    expect(w.note).toBe('Boodschappen zaterdag');
    expect((env.dict as { ing: Ingredient[] }).ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
    expect(planDishCount(env)).toBe(3);
    expect(envelopeItemCount(env)).toBe(1);
  });

  it('folds line overrides into the embedded recipe and omits an empty note', () => {
    const env = buildPlanEnvelope({ ...PLAN, note: '' }, [recipe()], {
      by: '',
      userIngredients: [],
      lineOverrides: [{ recipeId: 'u:abc12345', index: 2, ing: 'zout', updatedAt: 'x' }],
    });
    const w = env.w as PlanPayload;
    expect(w.note).toBeUndefined();
    expect(w.recipes[0]?.lines[2]?.ing).toBe('zout');
    expect('by' in env).toBe(false);
  });

  it('round-trips through the codec as kind "plan" with the recipes in the normal import path', async () => {
    const env = buildPlanEnvelope(PLAN, [recipe()], { by: 'Stijn', userIngredients: USER_INGREDIENTS });
    const parsed = parseEnvelope(await decodeToken(await encodeToken(env)));
    expect(parsed.kind).toBe('plan');
    expect(parsed.plan).toEqual({
      items: [
        { recipeId: 'b:dahl', servings: 4 },
        { recipeId: 'b:uiensoep', servings: 2 },
        { recipeId: 'u:abc12345', servings: 4 },
      ],
      note: 'Boodschappen zaterdag',
    });
    expect(parsed.recipes.map((r) => r.id)).toEqual(['u:abc12345']);
    expect(parsed.patches).toEqual([]);
    expect(parsed.dict.ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
  });

  it('reads the frozen #w= token on both engines', async () => {
    for (const token of [FROZEN_TOKEN_W, FROZEN_TOKEN_W_FFLATE]) {
      const env = await decodeToken(token);
      expect(env).toEqual(FROZEN_ENVELOPE_W);
      const parsed = parseEnvelope(env);
      expect(parsed.kind).toBe('plan');
      expect(parsed.by).toBe('Stijn');
      expect(parsed.plan?.items.map((i) => `${i.recipeId}@${i.servings}`)).toEqual(['b:dahl@4', 'b:uiensoep@2', 'u:abc12345@4']);
      expect(parsed.plan?.note).toBe('Boodschappen zaterdag');
      expect(parsed.recipes[0]?.name.nl).toBe('Pasta pesto');
      expect(parsed.dict.ing[0]?.id).toBe('pesto-huis');
    }
  });

  it('tolerates bad items and servings; a plan may be empty', () => {
    const parsed = parseEnvelope({ v: 2, t: 'w', w: { items: [{ rid: 'b:x', srv: 'many' }, { srv: 2 }, null, { rid: ' ', srv: 1 }], recipes: [{}] } });
    expect(parsed.kind).toBe('plan');
    expect(parsed.plan?.items).toEqual([{ recipeId: 'b:x', servings: 4 }]);
    expect(parsed.recipes).toEqual([]);
    expect(parseEnvelope({ v: 2, t: 'w', w: {} }).plan?.items).toEqual([]);
  });

  it('planMessages: "🗓️ Weekplan van Stijn: 3 gerechten", open line and one #w= URL', async () => {
    const env = buildPlanEnvelope(PLAN, [], { by: 'Stijn', userIngredients: [] });
    const plan = await planMessages([env], APP_URL, { lang: 'nl' });
    if (!('text' in plan)) throw new Error('expected text');
    const lines = plan.text.split('\n');
    expect(lines[0]).toBe('🗓️ Weekplan van Stijn: 3 gerechten');
    expect(lines[1]).toMatch(/^Open in Rutgers' Recepten/);
    expect(extractTokens(plan.text).map((t) => t.key)).toEqual(['w']);
    expect(buildPlanShareMessage({ dishes: 1, by: '', url: 'u', lang: 'en' }).split('\n')[0]).toBe('🗓️ Week plan: 1 dish');
  });
});

describe('referencedIngredientIds', () => {
  it('collects ing of lines and alt lines, skipping null', () => {
    expect([...referencedIngredientIds(recipe().lines)].sort()).toEqual(['bergkaas', 'pasta', 'pesto-huis']);
  });
});

describe('planMessages', () => {
  it('a single recipe: the four-line message from message.ts with its #r= URL', async () => {
    const env = buildRecipeEnvelope(recipe(), { by: 'Stijn', userIngredients: [] });
    const plan = await planMessages([env], APP_URL, { lang: 'nl' });
    if (!('text' in plan)) throw new Error('expected text');
    const tokens = extractTokens(plan.text);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.key).toBe('r');
    expect(plan.tokens).toBe(1);
    expect(plan.chars).toBe(plan.text.length);
    expect(plan.text).toBe(buildShareMessageFor(recipe(), { by: 'Stijn', url: `${APP_URL}#r=${tokens[0]?.token}`, lang: 'nl' }));
    expect(plan.text.split('\n')[0]).toBe('🍲 Pasta pesto · Pesto pasta');
  });

  it('a single patch: "<name> (aangepast)" and a #p= URL', async () => {
    const env = buildPatchEnvelope(OVERRIDE, { by: 'Stijn', userIngredients: [], name: { nl: 'Uiensoep', en: 'French onion soup' } });
    const plan = await planMessages([env], APP_URL, { lang: 'nl' });
    if (!('text' in plan)) throw new Error('expected text');
    const lines = plan.text.split('\n');
    expect(lines[0]).toBe('🍲 Uiensoep · French onion soup (aangepast)');
    expect(lines[1]).toBe('van Stijn');
    expect(lines[3]).toMatch(new RegExp(`^${APP_URL.replace(/[.]/g, '\\.')}#p=`));
    expect(extractTokens(plan.text)).toHaveLength(1);
    const en = await planMessages([env], APP_URL, { lang: 'en' });
    if (!('text' in en)) throw new Error('expected text');
    expect(en.text.split('\n')[0]).toBe('🍲 Uiensoep · French onion soup (adjusted)');
    expect(en.text.split('\n')[1]).toBe('from Stijn');
  });

  it('several items: compact header, open line and one URL per line, in order', async () => {
    const envs = [
      buildRecipeEnvelope(recipe(), { by: 'Stijn', userIngredients: [] }),
      buildRecipeEnvelope(recipe({ id: 'u:second00', name: { nl: 'Soep' } }), { by: 'Stijn', userIngredients: [] }),
      buildPatchEnvelope(OVERRIDE, { by: 'Stijn', userIngredients: [] }),
    ];
    const plan = await planMessages(envs, APP_URL, { lang: 'nl' });
    if (!('text' in plan)) throw new Error('expected text');
    const lines = plan.text.split('\n');
    expect(lines[0]).toBe('🍲 3 recepten van Stijn');
    expect(lines[1]).toMatch(/^Open in Rutgers' Recepten/);
    expect(lines.slice(2)).toHaveLength(3);
    expect(extractTokens(plan.text).map((t) => t.key)).toEqual(['r', 'r', 'p']);
    expect(plan.tokens).toBe(3);
    const en = await planMessages(envs, APP_URL, { lang: 'en' });
    if (!('text' in en)) throw new Error('expected text');
    expect(en.text.split('\n')[0]).toBe('🍲 3 recipes from Stijn');
  });

  it('over the limit: a pretty-printed bundle file named recepten-<name>-YYYY-MM-DD.json', async () => {
    const envs = [
      buildRecipeEnvelope(recipe(), { by: 'Stijn', userIngredients: USER_INGREDIENTS }),
      buildPatchEnvelope(OVERRIDE, { by: 'Stijn', userIngredients: USER_INGREDIENTS }),
    ];
    const plan = await planMessages(envs, APP_URL, { limit: 200, name: 'Anna Ë.', date: new Date(2026, 8, 29) });
    if (!('file' in plan)) throw new Error('expected file');
    expect(plan.reason).toBe('too-large');
    expect(plan.file.name).toBe('recepten-anna-e-2026-09-29.json');
    expect(plan.file.json).toContain('\n  ');
    const parsed = parseEnvelope(JSON.parse(plan.file.json));
    expect(parsed.kind).toBe('bundle');
    expect(parsed.by).toBe('Stijn');
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.patches).toHaveLength(1);
    expect(parsed.dict.ing.map((i) => i.id)).toEqual(['bergkaas', 'pesto-huis']);
  });

  it('a single bundle envelope over the limit is written out as it is', async () => {
    const env = buildBundleEnvelope({ recipes: [recipe()], patches: [] }, { by: 'Stijn', userIngredients: [] }, { title: 'T' });
    const plan = await planMessages([env], APP_URL, { limit: 100 });
    if (!('file' in plan)) throw new Error('expected file');
    expect(JSON.parse(plan.file.json)).toEqual(env);
    expect(plan.file.name).toMatch(/^recepten-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('the default limit (3500) holds a couple of recipes', async () => {
    const envs = [1, 2].map((i) => buildRecipeEnvelope(recipe({ id: `u:r${i}000000` }), { by: 'Stijn', userIngredients: [] }));
    const plan = await planMessages(envs, APP_URL);
    expect('text' in plan).toBe(true);
  });
});

describe('combineEnvelopes / bundleFileName', () => {
  it('merges deltas by id and keeps the first sender', () => {
    const a = buildRecipeEnvelope(recipe(), { by: 'Stijn', userIngredients: USER_INGREDIENTS });
    const b = buildRecipeEnvelope(recipe({ id: 'u:zzz' }), { by: 'Anna', userIngredients: USER_INGREDIENTS });
    const out = combineEnvelopes([a, b]);
    expect(out.t).toBe('b');
    expect(out.by).toBe('Stijn');
    expect((out.dict as { ing: Ingredient[] }).ing).toHaveLength(2);
    expect(envelopeItemCount(out)).toBe(2);
  });

  it('bundleFileName slugifies the name', () => {
    expect(bundleFileName('Stijn & Co', new Date(2026, 0, 5))).toBe('recepten-stijn-co-2026-01-05.json');
    expect(bundleFileName(undefined, new Date(2026, 0, 5))).toBe('recepten-export-2026-01-05.json');
  });
});
