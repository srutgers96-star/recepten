// Merge rules (docs/phase-3-spec.md §2, src/domain/merge.ts): one test per row of the table,
// the field-level language merge and the "both" copy naming.
import { describe, expect, it } from 'vitest';
import type { Ingredient } from '../src/domain/dictionary';
import type { Recipe } from '../src/domain/model';
import type { LineOverride, RecipeOverride } from '../src/domain/overrides';
import {
  contentFingerprint,
  copyName,
  defaultChoices,
  isOverrideUntouchedSinceReceipt,
  isUntouchedSinceReceipt,
  legacyChoices,
  planImport,
  resolveImport,
  type LocalState,
  type RecipeImportItem,
  type PatchImportItem,
} from '../src/domain/merge';
import { applyOverride } from '../src/domain/overrides';
import type { ParsedShare, PatchPayload } from '../src/domain/share';

const NOW = '2026-09-29T12:00:00.000Z';
const ids = (() => {
  let n = 0;
  return () => `u:copy000${++n}`;
})();

function ing(id: string, nl: string, en: string, updatedAt?: string): Ingredient {
  const e: Ingredient = { id, nl: { one: nl }, en: { one: en }, aisle: 'overig', defaultUnit: 'stuk', staple: false, veg: true };
  if (updatedAt) e.updatedAt = updatedAt;
  return e;
}

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id: 'u:abc12345',
    rev: 3,
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    origin: { kind: 'user', author: 'Anna' },
    name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
    tags: ['snel'],
    servings: 2,
    lines: [{ raw: { nl: '400 g pasta', en: '400 g pasta' }, ing: 'pasta' }, { raw: { nl: '1 pot pesto' }, ing: null }],
    steps: [{ text: { nl: 'Kook de pasta.', en: 'Boil the pasta.' } }],
    goesWith: [],
    aliases: [],
    ...over,
  };
}

const BUILTIN: Recipe = recipe({
  id: 'b:uiensoep',
  rev: 1,
  origin: { kind: 'builtin' },
  name: { nl: 'Uiensoep', en: 'Onion soup' },
  lines: [{ raw: { nl: '4 uien' }, ing: 'ui' }, { raw: { nl: '1 l bouillon' }, ing: null }],
  steps: [{ text: { nl: 'Snipper de uien.', en: 'Slice the onions.' } }],
});

/** A recipe as this phone received it: rev = sender's rev, sync set. */
function received(r: Recipe, receivedRev = r.rev): Recipe {
  return {
    ...r,
    rev: receivedRev,
    origin: { kind: 'received', receivedFrom: 'Anna', receivedAt: '2026-09-21T00:00:00.000Z' },
    sync: { receivedRev, receivedAt: '2026-09-21T00:00:00.000Z', receivedFingerprint: contentFingerprint(r) },
  };
}

function share(over: Partial<ParsedShare> = {}): ParsedShare {
  return { kind: 'bundle', by: 'Anna', dict: { ing: [] }, recipes: [], patches: [], ...over };
}

function local(over: Partial<LocalState> = {}): LocalState {
  return { recipes: [BUILTIN], overrides: [], userIngredients: [], builtinIngredientIds: new Set(['ui', 'pasta']), ...over };
}

function item(plan: ReturnType<typeof planImport>, i = 0) {
  return plan.items[i] as RecipeImportItem;
}

function patchItem(plan: ReturnType<typeof planImport>, i = 0) {
  return plan.items[i] as PatchImportItem;
}

describe('row: same id, same fingerprint -> present', () => {
  it('skips a recipe this phone already has (even with another rev or timestamps)', () => {
    const mine = received(recipe());
    const plan = planImport(share({ recipes: [recipe({ rev: 9, updatedAt: NOW })] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('present');
    expect(item(plan).existing).toBe(mine);
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.recipes).toEqual([]);
    expect(w.skipped).toEqual(['u:abc12345']);
  });

  it('also treats the version already received once as present, even after a local edit', () => {
    const mine = { ...received(recipe()), rev: 4, name: { nl: 'Mijn pasta' } }; // edited here after receipt
    const plan = planImport(share({ recipes: [recipe()] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('present');
  });

  it('a classic shared as a whole recipe is present (the receiver has the classics)', () => {
    const plan = planImport(share({ recipes: [{ ...BUILTIN, name: { nl: 'Andere naam' } }] }), local());
    expect(item(plan).status).toBe('present');
  });
});

describe('row: same id, newer rev, local untouched since receipt -> update', () => {
  it('replaces the local copy, keeps createdAt and records the new sync', () => {
    const mine = received(recipe());
    const theirs = recipe({ rev: 4, name: { nl: 'Pasta pesto deluxe', en: 'Pesto pasta deluxe' }, updatedAt: NOW });
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('update');
    expect(item(plan).fields).toEqual(['name']);
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.updated).toEqual(['u:abc12345']);
    const out = w.recipes[0] as Recipe;
    expect(out.name).toEqual({ nl: 'Pasta pesto deluxe', en: 'Pesto pasta deluxe' });
    expect(out.rev).toBe(4);
    expect(out.createdAt).toBe(mine.createdAt);
    expect(out.updatedAt).toBe(NOW);
    expect(out.origin).toEqual({ kind: 'received', receivedFrom: 'Anna', receivedAt: NOW });
    expect(out.sync).toEqual({ receivedRev: 4, receivedAt: NOW, receivedFingerprint: contentFingerprint(theirs) });
    expect(w.clearLineOverridesFor).toEqual(['u:abc12345']);
  });

  it('an older version than the one received is nothing new (present)', () => {
    const mine = received(recipe({ rev: 5 }));
    const plan = planImport(share({ recipes: [recipe({ rev: 2, name: { nl: 'Oud' } })] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('present');
  });

  it('a phase-1 received recipe without sync counts as untouched: the same or a newer rev updates it', () => {
    const mine: Recipe = { ...recipe({ rev: 1 }), origin: { kind: 'received', receivedFrom: 'Anna', receivedAt: '2026-09-21T00:00:00.000Z' } };
    const plan = planImport(share({ recipes: [recipe({ rev: 1, steps: [{ text: { nl: 'Anders.' } }] })] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('update');
    expect(item(plan).fields).toEqual(['steps']);
  });

  it('a phase-1 received recipe without sync is NOT overwritten by an older rev (present)', () => {
    const mine: Recipe = { ...recipe({ rev: 3 }), origin: { kind: 'received', receivedFrom: 'Anna', receivedAt: '2026-09-21T00:00:00.000Z' } };
    const plan = planImport(share({ recipes: [recipe({ rev: 2, steps: [{ text: { nl: 'Oud.' } }] })] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('present');
    expect(resolveImport(plan, defaultChoices(plan), { now: NOW }).recipes).toEqual([]);
  });
});

describe('row: same id, both changed -> conflict', () => {
  const mine = { ...received(recipe()), rev: 4, name: { nl: 'Mijn pasta', en: 'Pesto pasta' }, updatedAt: '2026-09-25T00:00:00.000Z' };
  const theirs = recipe({ rev: 4, steps: [{ text: { nl: 'Kook de pasta al dente.', en: 'Boil the pasta al dente.' } }], servings: 4, updatedAt: NOW });

  it('lists the differing fields and is skipped by default', () => {
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('conflict');
    expect(item(plan).fields).toEqual(['name', 'steps', 'meta']);
    expect(defaultChoices(plan)['u:abc12345']).toEqual({ action: 'skip' });
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.recipes).toEqual([]);
    expect(w.skipped).toEqual(['u:abc12345']);
  });

  it('mine / theirs per field: theirs for steps and meta, mine for the name', () => {
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const w = resolveImport(plan, { 'u:abc12345': { action: 'fields', fields: { name: 'mine', steps: 'theirs', meta: 'theirs' } } }, { now: NOW });
    expect(w.updated).toEqual(['u:abc12345']);
    expect(w.recipes).toHaveLength(1);
    const out = w.recipes[0] as Recipe;
    expect(out.name).toEqual({ nl: 'Mijn pasta', en: 'Pesto pasta' });
    expect(out.steps[0]?.text.nl).toBe('Kook de pasta al dente.');
    expect(out.servings).toBe(4);
    // A merge is a fork: rev moves past both and differs from the received rev.
    expect(out.rev).toBe(5);
    expect(out.sync?.receivedRev).toBe(4);
    expect(out.sync?.receivedFingerprint).toBe(contentFingerprint(theirs));
  });

  it('all theirs = an update: rev follows the sender again', () => {
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const w = resolveImport(plan, { 'u:abc12345': { action: 'fields', fields: { name: 'theirs', steps: 'theirs', meta: 'theirs' } } }, { now: NOW });
    const out = w.recipes[0] as Recipe;
    expect(out.name).toEqual(theirs.name);
    expect(out.rev).toBe(4);
    expect(out.sync?.receivedRev).toBe(4);
  });

  it('"both": keeps mine and imports theirs as a copy named "<name> (<by>s versie)" with a new u: id', () => {
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const w = resolveImport(plan, { 'u:abc12345': { action: 'both' } }, { now: NOW, newId: () => 'u:copy0001' });
    expect(w.copies).toEqual(['u:copy0001']);
    expect(w.added).toEqual(['u:copy0001']);
    expect(w.updated).toEqual([]);
    const copy = w.recipes.find((r) => r.id === 'u:copy0001') as Recipe;
    expect(copy.name).toEqual({ nl: 'Pasta pesto (Annas versie)', en: "Pesto pasta (Anna's version)" });
    expect(copy.rev).toBe(1);
    expect(copy.origin).toMatchObject({ kind: 'received', receivedFrom: 'Anna', receivedAt: NOW, basedOn: 'u:abc12345' });
    expect(copy.steps).toEqual(theirs.steps);
    // Mine is untouched in content; only the seen version is recorded.
    const kept = w.recipes.find((r) => r.id === 'u:abc12345') as Recipe;
    expect(kept.name).toEqual(mine.name);
    expect(kept.rev).toBe(mine.rev);
    expect(kept.sync?.receivedFingerprint).toBe(contentFingerprint(theirs));
    expect(kept.sync?.receivedAt).toBe(NOW);
    // ... but NOT the received rev: mine.rev (4) equals theirs.rev (4), so taking it over would make
    // mine "untouched since receipt" and the sender's next version would silently replace my edits.
    expect(kept.sync?.receivedRev).toBe(mine.sync?.receivedRev);
    expect(isUntouchedSinceReceipt(kept)).toBe(false);
    // The partner's next version is therefore a conflict again, not an update.
    const next = planImport(share({ recipes: [recipe({ rev: 5, steps: [{ text: { nl: 'Nog eens anders.' } }] })] }), local({ recipes: [BUILTIN, kept] }));
    expect(item(next).status).toBe('conflict');
  });

  it('the same version arriving again after "both" is present (the seen fingerprint)', () => {
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const w = resolveImport(plan, { 'u:abc12345': { action: 'both' } }, { now: NOW, newId: () => 'u:copy0001' });
    const kept = w.recipes.find((r) => r.id === 'u:abc12345') as Recipe;
    const again = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, kept] }));
    expect(item(again).status).toBe('present');
  });

  it('a per-field "both" merges the theirs fields into mine AND adds the copy', () => {
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const w = resolveImport(plan, { 'u:abc12345': { action: 'fields', fields: { steps: 'theirs', name: 'both' } } }, { now: NOW, newId: ids });
    expect(w.recipes).toHaveLength(2);
    expect(w.copies).toHaveLength(1);
    const kept = w.recipes.find((r) => r.id === 'u:abc12345') as Recipe;
    expect(kept.steps).toEqual(theirs.steps);
    expect(kept.name).toEqual(mine.name);
  });

  it('copyName without a sender', () => {
    expect(copyName({ nl: 'Soep' }, undefined)).toEqual({ nl: 'Soep (andere versie)' });
    expect(copyName({ en: 'Soup' }, '')).toEqual({ en: 'Soup (other version)' });
  });
});

describe('row: different id, same fingerprint -> similar', () => {
  const twin = received(recipe({ id: 'u:twin0000' }));
  const incoming = recipe({ id: 'u:fresh000', rev: 1, steps: [{ text: { nl: 'Andere stappen.' } }] }); // fingerprint ignores steps

  it('points at the look-alike and is skipped by default', () => {
    const plan = planImport(share({ recipes: [incoming] }), local({ recipes: [BUILTIN, twin] }));
    expect(item(plan).status).toBe('similar');
    expect(item(plan).similarTo).toBe(twin);
    expect(item(plan).existing).toBeUndefined();
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.recipes).toEqual([]);
    expect(w.skipped).toEqual(['u:fresh000']);
  });

  it('"replace" overwrites the look-alike under ITS id (favourites and notes keep pointing at it)', () => {
    const plan = planImport(share({ recipes: [incoming] }), local({ recipes: [BUILTIN, twin] }));
    const w = resolveImport(plan, { 'u:fresh000': { action: 'replace' } }, { now: NOW });
    expect(w.updated).toEqual(['u:twin0000']);
    const out = w.recipes[0] as Recipe;
    expect(out.id).toBe('u:twin0000');
    expect(out.createdAt).toBe(twin.createdAt);
    expect(out.steps).toEqual(incoming.steps);
    expect(out.sync?.receivedRev).toBe(1);
  });

  it('"both" adds it next to the look-alike with its own id', () => {
    const plan = planImport(share({ recipes: [incoming] }), local({ recipes: [BUILTIN, twin] }));
    const w = resolveImport(plan, { 'u:fresh000': { action: 'both' } }, { now: NOW });
    expect(w.added).toEqual(['u:fresh000']);
    expect(w.recipes[0]?.id).toBe('u:fresh000');
  });

  it('a look-alike of a classic cannot be replaced: "replace" adds it instead', () => {
    const plan = planImport(share({ recipes: [{ ...BUILTIN, id: 'u:fresh000', origin: { kind: 'user' } }] }), local());
    expect(item(plan).status).toBe('similar');
    expect(item(plan).similarTo?.id).toBe('b:uiensoep');
    const w = resolveImport(plan, { 'u:fresh000': { action: 'replace' } }, { now: NOW });
    expect(w.added).toEqual(['u:fresh000']);
  });
});

describe('row: new id -> new', () => {
  it('adds with origin received, receivedFrom = by, and sync = received rev/at/fingerprint', () => {
    const incoming = recipe({ rev: 7, sync: { receivedRev: 99 } } as Partial<Recipe>);
    const plan = planImport(share({ recipes: [incoming], at: '2026-09-28T00:00:00.000Z' }), local());
    expect(item(plan).status).toBe('new');
    expect(plan.by).toBe('Anna');
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.added).toEqual(['u:abc12345']);
    const out = w.recipes[0] as Recipe;
    expect(out.origin).toEqual({ kind: 'received', author: 'Anna', receivedFrom: 'Anna', receivedAt: NOW });
    expect(out.rev).toBe(7);
    expect(out.updatedAt).toBe(NOW);
    expect(out.sync).toEqual({ receivedRev: 7, receivedAt: NOW, receivedFingerprint: contentFingerprint(recipe()) });
  });

  it('an unnamed sender leaves receivedFrom null', () => {
    const plan = planImport(share({ by: undefined, recipes: [recipe()] }), local());
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.recipes[0]?.origin.receivedFrom).toBeNull();
  });

  it('the same id twice in one share is planned once', () => {
    const plan = planImport(share({ recipes: [recipe(), recipe({ rev: 9 })] }), local());
    expect(plan.items).toHaveLength(1);
  });
});

describe('row: patch for a classic -> new / update / conflict on the override', () => {
  const patch: PatchPayload = {
    baseId: 'b:uiensoep',
    rev: 2,
    patch: { name: { en: 'French onion soup' }, steps: [{ text: { nl: 'Snipper de uien fijn.', en: 'Slice the onions thinly.' } }] },
    lineOverrides: [{ recipeId: 'b:uiensoep', index: 1, ing: 'runderbouillon', updatedAt: '2026-09-29T09:00:00.000Z' }],
  };
  /** An override made on THIS phone (no sync). */
  const mineOverride: RecipeOverride = { baseId: 'b:uiensoep', rev: 1, patch: { name: { en: 'Onion soup, French style' } }, updatedAt: '2026-09-22T00:00:00.000Z', by: 'Stijn' };
  /** An override as this phone received it (rev 1 from Anna), untouched since. */
  const receivedOverride: RecipeOverride = { ...mineOverride, by: 'Anna', sync: { receivedRev: 1, receivedAt: '2026-09-22T00:00:00.000Z' } };

  it('new: no local override -> the override (with sync) and its line overrides are written', () => {
    const plan = planImport(share({ patches: [patch] }), local());
    expect(patchItem(plan)).toMatchObject({ kind: 'patch', id: 'p:b:uiensoep', status: 'new' });
    expect(patchItem(plan).base).toBe(BUILTIN);
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.added).toEqual(['p:b:uiensoep']);
    expect(w.overrides).toEqual([{ baseId: 'b:uiensoep', rev: 2, patch: patch.patch, updatedAt: NOW, by: 'Anna', sync: { receivedRev: 2, receivedAt: NOW } }]);
    expect(isOverrideUntouchedSinceReceipt(w.overrides[0] as RecipeOverride)).toBe(true);
    expect(w.lineOverrides).toEqual(patch.lineOverrides);
    expect(w.recipes).toEqual([]);
  });

  it('present: the same patch again', () => {
    const plan = planImport(share({ patches: [patch] }), local({ overrides: [{ ...mineOverride, patch: { ...patch.patch } }] }));
    expect(patchItem(plan).status).toBe('present');
  });

  it('update: incoming rev > local rev and the override is untouched since receipt; texts merge per language', () => {
    const plan = planImport(share({ patches: [patch] }), local({ overrides: [{ ...receivedOverride, patch: { name: { nl: 'Franse uiensoep' } } }] }));
    expect(patchItem(plan).status).toBe('update');
    expect(patchItem(plan).fields).toEqual(['name', 'steps']);
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.updated).toEqual(['p:b:uiensoep']);
    expect(w.overrides[0]?.patch.name).toEqual({ nl: 'Franse uiensoep', en: 'French onion soup' });
    expect(w.overrides[0]?.patch.steps).toEqual(patch.patch.steps);
    expect(w.overrides[0]?.rev).toBe(2);
    expect(w.overrides[0]?.sync).toEqual({ receivedRev: 2, receivedAt: NOW });
  });

  it('an older patch than the one received, override untouched: nothing new (present)', () => {
    const plan = planImport(share({ patches: [{ ...patch, rev: 1 }] }), local({ overrides: [{ ...receivedOverride, rev: 3, sync: { receivedRev: 3 } }] }));
    expect(patchItem(plan).status).toBe('present');
  });

  it('conflict: the override was edited here after it was received, even when their rev is higher', () => {
    // Received at rev 1, saved once here (rev 2, sync kept by saveOverride), they edited twice (rev 4).
    const edited: RecipeOverride = { ...receivedOverride, rev: 2, patch: { name: { en: 'Onion soup, my way' } } };
    const plan = planImport(share({ patches: [{ ...patch, rev: 4 }] }), local({ overrides: [edited] }));
    expect(isOverrideUntouchedSinceReceipt(edited)).toBe(false);
    expect(patchItem(plan).status).toBe('conflict');
    expect(patchItem(plan).fields).toEqual(['name', 'steps']);
    expect(defaultChoices(plan)['p:b:uiensoep']).toEqual({ action: 'skip' });
    expect(resolveImport(plan, defaultChoices(plan), { now: NOW }).overrides).toEqual([]);
    // Taking theirs for a field is a fork: rev past both, received rev = theirs (touched again).
    const w = resolveImport(plan, { 'p:b:uiensoep': { action: 'fields', fields: { steps: 'theirs' } } }, { now: NOW });
    expect(w.overrides[0]?.patch).toEqual({ name: { en: 'Onion soup, my way' }, steps: patch.patch.steps });
    expect(w.overrides[0]?.rev).toBe(5);
    expect(w.overrides[0]?.sync?.receivedRev).toBe(4);
    expect(isOverrideUntouchedSinceReceipt(w.overrides[0] as RecipeOverride)).toBe(false);
  });

  it('conflict: an override made here (no sync) versus any differing incoming patch, whatever the rev', () => {
    const plan = planImport(share({ patches: [{ ...patch, rev: 9 }] }), local({ overrides: [mineOverride] }));
    expect(patchItem(plan).status).toBe('conflict');
  });

  it('conflict: same or lower rev with other content; per-field choice; "both" makes an own copy of their version', () => {
    const plan = planImport(share({ patches: [{ ...patch, rev: 1 }] }), local({ overrides: [mineOverride] }));
    expect(patchItem(plan).status).toBe('conflict');
    expect(patchItem(plan).fields).toEqual(['name', 'steps']);
    expect(resolveImport(plan, defaultChoices(plan), { now: NOW }).skipped).toEqual(['p:b:uiensoep']);

    const w = resolveImport(plan, { 'p:b:uiensoep': { action: 'fields', fields: { name: 'mine', steps: 'theirs' } } }, { now: NOW });
    expect(w.overrides[0]?.patch).toEqual({ name: { en: 'Onion soup, French style' }, steps: patch.patch.steps });
    expect(w.overrides[0]?.rev).toBe(2);

    const both = resolveImport(plan, { 'p:b:uiensoep': { action: 'both' } }, { now: NOW, newId: () => 'u:copy0009' });
    expect(both.overrides).toEqual([]);
    expect(both.copies).toEqual(['u:copy0009']);
    const copy = both.recipes[0] as Recipe;
    expect(copy.id).toBe('u:copy0009');
    expect(copy.name).toEqual({ nl: 'Uiensoep (Annas versie)', en: "French onion soup (Anna's version)" });
    expect(copy.steps[0]?.text.nl).toBe('Snipper de uien fijn.');
    expect(copy.lines[1]?.ing).toBe('runderbouillon');
    expect(copy.origin).toEqual({ kind: 'received', receivedFrom: 'Anna', receivedAt: NOW, basedOn: 'b:uiensoep' });
  });

  it('"both" starts from the classic AS SHIPPED (local.bases), not from my overridden view of it', () => {
    // My override renames the classic and adds a description; theirs only changes the steps.
    const mine: RecipeOverride = { ...mineOverride, patch: { name: { nl: 'Mijn uiensoep', en: 'My onion soup' }, description: { nl: 'Mijn beschrijving' } } };
    const theirs: PatchPayload = { baseId: 'b:uiensoep', rev: 1, patch: { steps: [{ text: { nl: 'Snipper de uien fijn.', en: 'Slice the onions thinly.' } }] } };
    const state = local({ recipes: [applyOverride(BUILTIN, mine)], bases: [BUILTIN], overrides: [mine] });
    const plan = planImport(share({ patches: [theirs] }), state);
    expect(patchItem(plan).status).toBe('conflict');
    expect(patchItem(plan).base).toBe(BUILTIN);
    const w = resolveImport(plan, { 'p:b:uiensoep': { action: 'both' } }, { now: NOW, newId: () => 'u:copy0010' });
    expect(w.overrides).toEqual([]);
    const copy = w.recipes[0] as Recipe;
    // Their version: the shipped name with the suffix, their steps, none of my fields.
    expect(copy.name).toEqual({ nl: 'Uiensoep (Annas versie)', en: "Onion soup (Anna's version)" });
    expect(copy.steps[0]?.text.nl).toBe('Snipper de uien fijn.');
    expect(copy.description).toBeUndefined();
    expect(copy.override).toBeUndefined();
    expect(copy.sync).toBeUndefined();
    expect(copy.rev).toBe(1);
  });

  it('a patch without fields carries line links only: line overrides are written, never an override row', () => {
    const links: PatchPayload = { baseId: 'b:uiensoep', rev: 1, patch: {}, lineOverrides: patch.lineOverrides as LineOverride[] };
    // Without a local override.
    const plan = planImport(share({ patches: [links] }), local());
    expect(patchItem(plan)).toMatchObject({ status: 'new', linksOnly: true });
    expect(patchItem(plan).existing).toBeUndefined();
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.overrides).toEqual([]);
    expect(w.lineOverrides).toEqual(links.lineOverrides);
    expect(w.updated).toEqual(['p:b:uiensoep']);
    expect(w.added).toEqual([]);
    // With my own override: it stays untouched, only the links arrive.
    const plan2 = planImport(share({ patches: [links] }), local({ overrides: [mineOverride] }));
    expect(patchItem(plan2)).toMatchObject({ status: 'new', linksOnly: true });
    const w2 = resolveImport(plan2, defaultChoices(plan2), { now: NOW });
    expect(w2.overrides).toEqual([]);
    expect(w2.lineOverrides).toEqual(links.lineOverrides);
    // No fields and no links: nothing to apply.
    const plan3 = planImport(share({ patches: [{ baseId: 'b:uiensoep', rev: 1, patch: {} }] }), local());
    expect(patchItem(plan3).status).toBe('present');
    expect(resolveImport(plan3, { 'p:b:uiensoep': { action: 'apply' } }, { now: NOW }).lineOverrides).toEqual([]);
  });

  it('a patch for a classic this phone does not have is skipped with problem unknown-base', () => {
    const plan = planImport(share({ patches: [{ ...patch, baseId: 'b:onbekend' }] }), local());
    expect(patchItem(plan)).toMatchObject({ status: 'present', problem: 'unknown-base' });
    expect(resolveImport(plan, { 'p:b:onbekend': { action: 'apply' } }, { now: NOW }).overrides).toEqual([]);
  });
});

describe('row: language fields are merged per language (invariant 3)', () => {
  it('update: an incoming recipe without Dutch leaves my Dutch alone and only brings the English', () => {
    const mine = received(recipe());
    const theirs = recipe({
      rev: 4,
      name: { en: 'Pesto pasta (Anna)' },
      lines: [{ raw: { en: '400 g spaghetti' }, ing: 'pasta' }, { raw: { nl: '1 pot pesto' }, ing: null }],
      steps: [{ text: { en: 'Boil the pasta well.' } }],
      description: { en: 'Quick.' },
    });
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    expect(item(plan).status).toBe('update');
    const out = resolveImport(plan, defaultChoices(plan), { now: NOW }).recipes[0] as Recipe;
    expect(out.name).toEqual({ nl: 'Pasta pesto', en: 'Pesto pasta (Anna)' });
    expect(out.lines[0]?.raw).toEqual({ nl: '400 g pasta', en: '400 g spaghetti' });
    expect(out.steps[0]?.text).toEqual({ nl: 'Kook de pasta.', en: 'Boil the pasta well.' });
    expect(out.description).toEqual({ en: 'Quick.' });
  });

  it('conflict, "theirs" for the name: only the language they sent changes', () => {
    const mine = { ...received(recipe()), rev: 4, name: { nl: 'Mijn pasta', en: 'My pasta' } };
    const theirs = recipe({ rev: 4, name: { en: 'Their pasta' } });
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const out = resolveImport(plan, { 'u:abc12345': { action: 'fields', fields: { name: 'theirs' } } }, { now: NOW }).recipes[0] as Recipe;
    expect(out.name).toEqual({ nl: 'Mijn pasta', en: 'Their pasta' });
  });

  it('lines with another count replace mine (a raw line is never emptied)', () => {
    const mine = received(recipe());
    const theirs = recipe({ rev: 4, lines: [{ raw: { nl: '500 g pasta' } }, { raw: { nl: '1 pot pesto' } }, { raw: { nl: 'zout' } }] });
    const plan = planImport(share({ recipes: [theirs] }), local({ recipes: [BUILTIN, mine] }));
    const out = resolveImport(plan, defaultChoices(plan), { now: NOW }).recipes[0] as Recipe;
    expect(out.lines.map((l) => l.raw.nl)).toEqual(['500 g pasta', '1 pot pesto', 'zout']);
  });
});

describe('row: dictionary delta', () => {
  it('builtin ids are never overwritten; user entries: newer updatedAt wins, missing = older', () => {
    const mine = [ing('bergkaas', 'bergkaas', 'mountain cheese', '2026-09-20T00:00:00.000Z'), ing('oud', 'oud', 'old'), ing('nieuw-hier', 'x', 'x', '2026-09-28T00:00:00.000Z')];
    const theirs = [
      ing('ui', 'ui', 'onion', NOW), // builtin
      ing('bergkaas', 'bergkaas', 'alpine cheese', '2026-09-25T00:00:00.000Z'), // newer -> add
      ing('oud', 'oud', 'old (fixed)', '2026-09-01T00:00:00.000Z'), // mine has no updatedAt -> mine is older -> add
      ing('nieuw-hier', 'y', 'y', '2026-09-27T00:00:00.000Z'), // older than mine -> skip
      ing('zonder-datum', 'z', 'z'), // unknown here -> add
      ing('gelijk', 'g', 'g', NOW),
    ];
    const plan = planImport(share({ dict: { ing: theirs } }), local({ userIngredients: [...mine, ing('gelijk', 'g', 'g', NOW)] }));
    expect(plan.dict.add.map((e) => e.id)).toEqual(['bergkaas', 'oud', 'zonder-datum']);
    expect(plan.dict.skip).toEqual(['ui', 'nieuw-hier', 'gelijk']);
    const w = resolveImport(plan, {}, { now: NOW });
    expect(w.userIngredients.map((e) => [e.id, e.updatedAt])).toEqual([
      ['bergkaas', '2026-09-25T00:00:00.000Z'],
      ['oud', '2026-09-01T00:00:00.000Z'],
      ['zonder-datum', NOW],
    ]);
  });

  it('falls back to the bundled dictionary ids when the local state has none', () => {
    const plan = planImport(share({ dict: { ing: [ing('ui', 'ui', 'onion'), ing('heel-eigen-ding', 'x', 'y')] } }), { recipes: [], overrides: [], userIngredients: [] });
    expect(plan.dict.skip).toEqual(['ui']);
    expect(plan.dict.add.map((e) => e.id)).toEqual(['heel-eigen-ding']);
  });
});

describe('row: deletions never travel', () => {
  it('a bundle that lacks a recipe I have writes nothing for it and never deletes', () => {
    const mine = received(recipe({ id: 'u:keepme00' }));
    const plan = planImport(share({ recipes: [recipe({ id: 'u:other000', name: { nl: 'Iets anders' } })] }), local({ recipes: [BUILTIN, mine] }));
    const w = resolveImport(plan, defaultChoices(plan), { now: NOW });
    expect(w.recipes.map((r) => r.id)).toEqual(['u:other000']);
    expect(Object.keys(w)).not.toContain('deleted');
  });
});

describe('legacyChoices (phase-1 importRecipes behaviour)', () => {
  it('takes theirs on a conflict and adds look-alikes', () => {
    const mine = { ...received(recipe()), rev: 4, name: { nl: 'Mijn pasta' } };
    const twin = received(recipe({ id: 'u:twin0000' }));
    const plan = planImport(share({ recipes: [recipe({ rev: 4, steps: [{ text: { nl: 'Anders.' } }] }), recipe({ id: 'u:fresh000' })] }), local({ recipes: [BUILTIN, mine, twin] }));
    expect(plan.items.map((i) => i.status)).toEqual(['conflict', 'similar']);
    const w = resolveImport(plan, legacyChoices(plan), { now: NOW });
    expect(w.updated).toEqual(['u:abc12345']);
    expect(w.added).toEqual(['u:fresh000']);
    expect(w.recipes.find((r) => r.id === 'u:abc12345')?.steps[0]?.text.nl).toBe('Anders.');
  });
});
