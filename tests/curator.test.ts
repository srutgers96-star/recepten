// Curator save semantics (docs/phase-5-spec.md block D.4): buildCuratorPatch writes ONLY the
// English side (CLAUDE.md invariant 3) and never drops a raw line (invariant 2), merges into a
// previous override patch instead of wiping it, and sets the review marker
// `text: { en: 'human', reviewedBy }` — but only with a non-empty English name, so a save can
// never contradict curatorStatus ('missing' wins) or sneak into "Stuur correcties". Verified
// through applyOverride, the same merge the app and the receiving phone run.
//
// Phase 6 (docs/phase-6-spec.md 6A.2): `lineUsesDictionary` decides which lines the panel shows
// grey and read-only (the dictionary renders their English; `raw.en` is ignored) and which keep
// the free English box; pinned against render.ts so the two can never disagree.
import { describe, expect, it } from 'vitest';
import type { Line, Recipe, Text } from '../src/domain/model';
import { applyLineOverrides, applyOverride, type RecipeOverride, type RecipePatch } from '../src/domain/overrides';
import { renderLine } from '../src/domain/render';
import { buildCuratorPatch, curatorStatus, dictionaryRouteFor, lineUsesDictionary, type CuratorDraft } from '../src/screens/CuratorScreen';
import { testDictionary } from './fixtures/test-dictionary';

function base(): Recipe {
  return {
    schema: 2,
    id: 'b:uiensoep',
    rev: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    origin: { kind: 'builtin' },
    name: { nl: 'Uiensoep', en: 'Onion soup' },
    description: { nl: 'Klassiek.' },
    category: 'soep',
    tags: ['winter'],
    servings: 4,
    lines: [
      { raw: { nl: 'Soep:' }, kind: 'header' },
      { raw: { nl: '4 uien', en: '4 onions' }, qty: { min: 4 }, unit: null, ing: 'ui', name: 'uien', confidence: 1 },
      { raw: { nl: '1 l bouillon' }, qty: { min: 1 }, unit: 'l', ing: 'bouillon', name: 'bouillon', confidence: 1 },
    ],
    steps: [
      { text: { nl: 'Snijd de uien.', en: 'Slice the onions.' }, timers: [{ min: 5, unit: 'min' }] },
      { text: { nl: 'Laat 30 minuten trekken.' } },
    ],
    goesWith: [],
    aliases: [],
    text: { en: 'llm' },
  };
}

function draftFrom(r: Recipe): CuratorDraft {
  return {
    nameEn: r.name.en ?? '',
    descriptionEn: r.description?.en ?? '',
    linesEn: r.lines.map((l) => l.raw?.en ?? ''),
    stepsEn: r.steps.map((s) => s.text?.en ?? ''),
  };
}

function overrideWith(patch: RecipePatch, rev = 1): RecipeOverride {
  return { baseId: 'b:uiensoep', rev, patch, updatedAt: '2026-10-02T00:00:00.000Z', by: 'Gabi' };
}

describe('curatorStatus', () => {
  it('is missing without an English name, whatever the marker says', () => {
    expect(curatorStatus({ name: { nl: 'Uiensoep' }, text: { en: 'human' } })).toBe('missing');
    expect(curatorStatus({ name: { nl: 'Uiensoep', en: '  ' }, text: null })).toBe('missing');
  });

  it("is machine for 'llm', 'none' and an absent marker", () => {
    expect(curatorStatus({ name: { en: 'Onion soup' }, text: { en: 'llm' } })).toBe('machine');
    expect(curatorStatus({ name: { en: 'Onion soup' }, text: { en: 'none' } })).toBe('machine');
    expect(curatorStatus({ name: { en: 'Onion soup' } })).toBe('machine');
  });

  it("is reviewed for 'human'", () => {
    expect(curatorStatus({ name: { en: 'Onion soup' }, text: { en: 'human', reviewedBy: 'Gabi' } })).toBe('reviewed');
  });
});

describe('lineUsesDictionary (6A.2)', () => {
  // testDictionary knows 'ui' but not 'bouillon' (only 'kippenbouillon'), like a received recipe
  // linked to an entry the other phone made.
  const dict = testDictionary();
  const lines = base().lines;
  const header = lines[0] as Line;
  const onions = lines[1] as Line;
  const stock = lines[2] as Line;

  it('is true only for a non-header line whose ingredient this dictionary knows', () => {
    expect(lineUsesDictionary(header, dict)).toBe(false);
    expect(lineUsesDictionary(onions, dict)).toBe(true);
    expect(lineUsesDictionary(stock, dict)).toBe(false);
    expect(lineUsesDictionary({ ...onions, ing: null }, dict)).toBe(false);
    expect(lineUsesDictionary({ ...onions, ing: undefined }, dict)).toBe(false);
  });

  it('agrees with render.ts: a dictionary line ignores raw.en, every other line prints it', () => {
    // The curator panel shows this rendering grey and read-only: typing English here would change nothing.
    expect(renderLine(onions, dict, 'en')).toBe('4 onions');
    expect(renderLine({ ...onions, raw: { nl: '4 uien', en: 'four big onions' } }, dict, 'en')).toBe('4 onions');
    // Headers and unknown lines print raw.en (fallback raw.nl): these keep the free English box.
    expect(renderLine({ ...header, raw: { nl: 'Soep:', en: 'Soup:' } }, dict, 'en')).toBe('Soup:');
    expect(renderLine(stock, dict, 'en')).toBe('1 l bouillon');
    expect(renderLine({ ...stock, raw: { nl: '1 l bouillon', en: '1 l stock' } }, dict, 'en')).toBe('1 l stock');
  });

  it('follows a "Koppel ingrediënt" line override, as the recipe screen does', () => {
    // Stijn linked line 3 to a known entry: the panel now shows it from the dictionary.
    const linked = applyLineOverrides(lines, [{ recipeId: 'b:uiensoep', index: 2, ing: 'kippenbouillon', updatedAt: '2026-10-02T00:00:00.000Z' }]);
    expect(lineUsesDictionary(linked[2] as Line, dict)).toBe(true);
    expect(renderLine(linked[2] as Line, dict, 'en')).toBe('1 l chicken stock');
    // Unlinked explicitly (ing: null): back to the raw text and the free box.
    const unlinked = applyLineOverrides(lines, [{ recipeId: 'b:uiensoep', index: 1, ing: null, updatedAt: '2026-10-02T00:00:00.000Z' }]);
    expect(lineUsesDictionary(unlinked[1] as Line, dict)).toBe(false);
  });

  it('"Verbeter in het woordenboek" opens the dictionary with the ingredient id as ?q=', () => {
    expect(dictionaryRouteFor('ui')).toBe('/more/dictionary?q=ui');
    expect(dictionaryRouteFor('parmezaanse-kaas')).toBe('/more/dictionary?q=parmezaanse-kaas');
    expect(dictionaryRouteFor('u:eigen ding&zo')).toBe('/more/dictionary?q=u%3Aeigen%20ding%26zo');
  });

  it('an untouched dictionary line writes no raw.en, so the patch stays free of it', () => {
    // The panel offers no box for the onions line; the draft keeps its raw.en as-is and the
    // patch only carries the line Gabi could edit (stock, unknown to the dictionary).
    const b = base();
    const draft = draftFrom(b);
    draft.linesEn[2] = '1 l stock';
    const patch = buildCuratorPatch(b, b, undefined, draft, 'Gabi');
    expect(patch.lines?.[1]).toEqual({ raw: {} });
    expect(patch.lines?.[2]?.raw).toEqual({ en: '1 l stock' });
    const applied = applyOverride(b, overrideWith(patch));
    expect(applied.lines[1]?.raw).toEqual({ nl: '4 uien', en: '4 onions' });
    expect(renderLine(applied.lines[1] as Line, dict, 'en')).toBe('4 onions');
  });
});

describe('buildCuratorPatch', () => {
  it('writes only the English side and never the Dutch (invariant 3)', () => {
    const b = base();
    const draft = draftFrom(b);
    draft.nameEn = 'French onion soup';
    draft.linesEn[2] = '1 l stock';
    draft.stepsEn[1] = 'Simmer for 30 minutes.';
    const patch = buildCuratorPatch(b, b, undefined, draft, 'Gabi');

    // No Dutch anywhere in the patch.
    expect(patch.name).toEqual({ en: 'French onion soup' });
    expect(patch.description).toBeUndefined();
    expect((patch.lines ?? []).every((l) => l.raw?.nl === undefined)).toBe(true);
    expect((patch.steps ?? []).every((s) => s.text?.nl === undefined)).toBe(true);
    expect(patch.text).toEqual({ en: 'human', reviewedBy: 'Gabi' });

    // Applied, the Dutch of the shipped recipe is intact and the English updated.
    const applied = applyOverride(b, overrideWith(patch));
    expect(applied.name).toEqual({ nl: 'Uiensoep', en: 'French onion soup' });
    expect(applied.lines.map((l) => l.raw)).toEqual([
      { nl: 'Soep:' },
      { nl: '4 uien', en: '4 onions' },
      { nl: '1 l bouillon', en: '1 l stock' },
    ]);
    // Invariant 2: no raw line was deleted; parsing and timers survive.
    expect(applied.lines[1]?.ing).toBe('ui');
    expect(applied.lines[2]?.qty).toEqual({ min: 1 });
    expect(applied.steps[0]?.timers).toEqual([{ min: 5, unit: 'min' }]);
    expect(applied.steps[1]?.text).toEqual({ nl: 'Laat 30 minuten trekken.', en: 'Simmer for 30 minutes.' });
    expect(applied.text).toEqual({ en: 'human', reviewedBy: 'Gabi' });
    expect(curatorStatus(applied)).toBe('reviewed');
  });

  it('leaves untouched fields out and still sets the review marker', () => {
    const b = base();
    const patch = buildCuratorPatch(b, b, undefined, draftFrom(b), 'Gabi');
    expect(Object.keys(patch).sort()).toEqual(['text']);
    const applied = applyOverride(b, overrideWith(patch));
    expect(applied.name).toEqual(b.name);
    expect(applied.lines).toEqual(b.lines);
    expect(curatorStatus(applied)).toBe('reviewed');
  });

  it("merges into a previous patch instead of wiping Stijn's edits", () => {
    const b = base();
    // Stijn renamed the classic in Dutch and relinked line 2 earlier (full-line patch, EditScreen).
    const prev: RecipePatch = {
      name: { nl: 'Franse uiensoep' },
      lines: [
        { raw: { nl: 'Soep:' }, kind: 'header' },
        { raw: { nl: '4 uien', en: '4 onions' }, qty: { min: 4 }, unit: null, ing: 'rode-ui', name: 'uien', confidence: 1 },
        { raw: { nl: '1 l bouillon' }, qty: { min: 1 }, unit: 'l', ing: 'bouillon', name: 'bouillon', confidence: 1 },
      ],
      category: 'soep',
    };
    const effective = applyOverride(b, overrideWith(prev));
    const draft = draftFrom(effective);
    draft.nameEn = 'French onion soup';
    draft.linesEn[2] = '1 l stock';
    const patch = buildCuratorPatch(b, effective, prev, draft, 'Gabi');

    // The Dutch rename and the relink survive; only raw.en of line 2 was written.
    expect(patch.name).toEqual({ nl: 'Franse uiensoep', en: 'French onion soup' });
    expect(patch.category).toBe('soep');
    expect(patch.lines?.[1]?.ing).toBe('rode-ui');
    expect(patch.lines?.[2]?.raw).toEqual({ nl: '1 l bouillon', en: '1 l stock' });

    const applied = applyOverride(b, overrideWith(patch, 2));
    expect(applied.name).toEqual({ nl: 'Franse uiensoep', en: 'French onion soup' });
    expect(applied.lines[1]?.ing).toBe('rode-ui');
    expect(applied.lines[2]?.raw).toEqual({ nl: '1 l bouillon', en: '1 l stock' });
  });

  it('adds an English description next to the Dutch one', () => {
    const b = base();
    const draft = draftFrom(b);
    draft.descriptionEn = 'A classic.';
    const patch = buildCuratorPatch(b, b, undefined, draft, 'Gabi');
    expect(patch.description).toEqual({ en: 'A classic.' });
    const applied = applyOverride(b, overrideWith(patch));
    expect(applied.description).toEqual({ nl: 'Klassiek.', en: 'A classic.' });
  });

  it('clearing the English name keeps the Dutch, turns the status to missing and drops the marker', () => {
    const b = base();
    const draft = draftFrom(b);
    draft.nameEn = '';
    const patch = buildCuratorPatch(b, b, undefined, draft, null);
    const applied = applyOverride(b, overrideWith(patch));
    expect(applied.name.nl).toBe('Uiensoep');
    expect(curatorStatus(applied)).toBe('missing');
    // Without an English name there is no 'human' marker (it would contradict 'missing' and put
    // the classic in "Stuur correcties"); one from an earlier save is dropped too.
    expect(patch.text).toBeUndefined();
    const prev: RecipePatch = { text: { en: 'human', reviewedBy: 'Gabi' } };
    expect(buildCuratorPatch(b, b, prev, draft, 'Gabi').text).toBeUndefined();
  });

  it('no profile name: the marker has no reviewedBy', () => {
    const b = base();
    const patch = buildCuratorPatch(b, b, undefined, draftFrom(b), null);
    expect(patch.text).toEqual({ en: 'human' });
  });

  it('survives an upstream change of the number of lines/steps without blanking filler rows', () => {
    const b = base();
    const draft = draftFrom(b);
    draft.linesEn[2] = '1 l stock';
    draft.stepsEn[1] = 'Simmer for 30 minutes.';
    const patch = buildCuratorPatch(b, b, undefined, draft, 'Gabi');

    // A later data update adds a line and a step to the classic: the lengths no longer match.
    const updated = base();
    updated.lines = [...updated.lines, { raw: { nl: '1 teen knoflook' }, qty: { min: 1 }, unit: null, ing: 'knoflook', name: 'knoflook', confidence: 1 }];
    updated.steps = [...updated.steps, { text: { nl: 'Serveer met brood.' } }];

    const applied = applyOverride(updated, overrideWith(patch));
    // The minimal filler rows for untouched lines/steps fall back to the new base per index:
    // Dutch text, parsing and timers stay (nothing prints blank until an override reset).
    expect(applied.lines[0]?.raw).toEqual({ nl: 'Soep:' });
    expect(applied.lines[0]?.kind).toBe('header');
    expect(applied.lines[1]?.raw).toEqual({ nl: '4 uien', en: '4 onions' });
    expect(applied.lines[1]?.ing).toBe('ui');
    expect(applied.steps[0]?.text).toEqual({ nl: 'Snijd de uien.', en: 'Slice the onions.' });
    expect(applied.steps[0]?.timers).toEqual([{ min: 5, unit: 'min' }]);
  });
});
