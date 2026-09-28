// The Recepten2 -> schema-2 migration, run in-process on the real source file.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeRecipe, recipeFingerprint } from '../src/domain/recipe-io';
import { DATA_VERSION, findMainDish, migrate, type RecipesFile } from '../tools/migrate-from-recepten2.ts';
import { validateSchema2 } from '../tools/validate-data.ts';

const SOURCE: unknown = JSON.parse(readFileSync(new URL('../data/source/recipes-recepten2.json', import.meta.url), 'utf8'));
const GENERATED_AT = '2026-09-28T12:00:00.000Z';
const file: RecipesFile = migrate(SOURCE, GENERATED_AT);

describe('migrate', () => {
  it('produces 196 recipes with unique builtin ids, sorted by name', () => {
    expect(file.schema).toBe(2);
    expect(file.dataVersion).toBe(DATA_VERSION);
    expect(file.generatedAt).toBe(GENERATED_AT);
    expect(file.recipes).toHaveLength(196);
    const ids = new Set(file.recipes.map((r) => r.id));
    expect(ids.size).toBe(196);
    for (const r of file.recipes) expect(r.id).toMatch(/^b:[a-z0-9-]+$/);
    const names = file.recipes.map((r) => r.name.nl!);
    const collator = new Intl.Collator('nl', { sensitivity: 'base' });
    expect([...names].sort(collator.compare)).toEqual(names);
  });

  it('gives every recipe origin builtin, 4 servings, raw lines and at least one step', () => {
    for (const r of file.recipes) {
      expect(r.origin).toEqual({ kind: 'builtin' });
      expect(r.servings).toBe(4);
      expect(r.rev).toBe(1);
      expect(r.steps.length).toBeGreaterThanOrEqual(1);
      for (const l of r.lines) expect(l.raw.nl!.trim().length).toBeGreaterThan(0);
      for (const s of r.steps) expect(s.text.nl!.trim().length).toBeGreaterThan(0);
    }
    const headers = file.recipes.flatMap((r) => r.lines.filter((l) => l.kind === 'header'));
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers) expect(h.raw.nl).toMatch(/:$/);
  });

  it('keeps the second instructions paragraph of the Rendang (the stray "" key)', () => {
    const rendang = file.recipes.find((r) => r.name.nl === 'Rendang met zelfgemaakt boemboe')!;
    expect(rendang).toBeDefined();
    const text = rendang.steps.map((s) => s.text.nl).join('\n\n');
    expect(text).toContain('Boemboe: Hak de uien');
    expect(text).toContain('Rendang: Vlees van vet');
    // "Op laag vuur een uur laten sudderen" + "nog 30 minuten"
    const timers = rendang.steps.flatMap((s) => s.timers ?? []);
    expect(timers).toContainEqual({ min: 1, unit: 'hour', label: 'een uur' });
    expect(timers).toContainEqual({ min: 30, unit: 'min', label: '30 minuten' });
  });

  it('links side dishes to their main dish', () => {
    const naan = file.recipes.find((r) => r.name.nl === 'Naanbrood (voor bij dahl)')!;
    expect(naan.goesWith).toEqual(['b:dahl-van-rode-linzen-boerenkool']);
    expect(file.recipes.some((r) => r.id === 'b:dahl-van-rode-linzen-boerenkool')).toBe(true);
    for (const r of file.recipes) for (const g of r.goesWith) expect(file.recipes.some((x) => x.id === g)).toBe(true);
    expect(findMainDish('Saus (voor bij niets)', [{ id: 'b:x', nameNl: 'X' }])).toBeNull();
    expect(findMainDish('Gewoon gerecht', [{ id: 'b:x', nameNl: 'X' }])).toBeNull();
  });

  it('is deterministic', () => {
    expect(JSON.stringify(migrate(SOURCE, GENERATED_AT))).toBe(JSON.stringify(file));
  });

  it('passes the schema-2 validator and normalizes to itself', () => {
    const result = validateSchema2(JSON.parse(JSON.stringify(file)));
    expect(result.errors).toEqual([]);
    expect(result.stats.recipes).toBe(196);
    for (const r of file.recipes.slice(0, 20)) {
      const n = normalizeRecipe(JSON.parse(JSON.stringify(r)))!;
      expect(n).toEqual(r);
      expect(recipeFingerprint(n)).toBe(recipeFingerprint(r));
    }
  });

  it('matches the committed data/recipes.json (run `npm run migrate` after changing the tools)', () => {
    const committed = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as RecipesFile;
    expect(committed.dataVersion).toBe(file.dataVersion);
    expect(committed.recipes).toEqual(file.recipes);
  });
});
