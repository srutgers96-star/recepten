// tools/measure-grams.ts — how many recipe lines the nutrition count can weigh (docs/specs/verbeterronde-9.md §1a).
//
//   node --experimental-strip-types tools/measure-grams.ts      (or: npm run measure-grams)
//
// Reads data/recipes.json, the dictionary and data/nutrition.json. Over all lines with a quantity (the
// lines `recipeNutrition` counts in `total`: no header, no non-food entry, a quantity or a unit with a
// known weight) it reports: in grams (count, %), in grams AND with nutrition values (count, %), and the
// top 20 missing per kind (density, piece weight, unit weight, nutrition item) with the number of lines.
// It also lists the recipes with the highest coverage (for DEVICE-TEST row 118). Writes
// docs/measure-grams.md and prints the same text.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadDictionary, type Dictionary } from '../src/domain/dictionary.ts';
import type { Line, Recipe } from '../src/domain/model.ts';
import { lineGrams, lineQty, NON_FOOD_AISLES, NUTRITION_MIN_COVERAGE, recipeNutrition, roundNutrients, type NutritionTable } from '../src/domain/nutrition.ts';
import { readDictionaryData } from './build-dictionary-seed.ts';

export type GapKind = 'density' | 'piece' | 'unit' | 'nutrition' | 'unresolved';

export interface GramsReport {
  lines: number;
  inGrams: number;
  withValues: number;
  /** Per kind: key ("olijfolie", "tijm · takje") -> number of lines. */
  gaps: Record<GapKind, Map<string, number>>;
  recipes: { id: string; name: string; counted: number; total: number; coverage: number; kcal: number | null }[];
}

/** Why a counted line (one with a quantity) cannot be weighed; null when its grams are known. */
export function gramsGap(line: Line, dict: Dictionary): { kind: Exclude<GapKind, 'nutrition'>; key: string } | null {
  const ing = line.ing ? dict.get(line.ing) : undefined;
  if (!ing) return { kind: 'unresolved', key: line.name?.trim() || '(free text)' };
  if (lineGrams(line, dict) !== null) return null;
  let unitId = line.unit ?? ing.defaultUnit;
  if (!line.unit && line.qty && (unitId ? dict.unit(unitId) : undefined)?.group !== 'count') unitId = 'stuk';
  if (!unitId || unitId === 'stuk') return { kind: 'piece', key: ing.id };
  const unit = dict.unit(unitId);
  if (unit?.group === 'volume') return { kind: 'density', key: ing.id };
  return { kind: 'unit', key: `${ing.id} · ${unitId}` };
}

function bump(m: Map<string, number>, key: string): void {
  m.set(key, (m.get(key) ?? 0) + 1);
}

export function measureGrams(recipes: readonly Recipe[], dict: Dictionary, table: NutritionTable): GramsReport {
  const report: GramsReport = {
    lines: 0,
    inGrams: 0,
    withValues: 0,
    gaps: { density: new Map(), piece: new Map(), unit: new Map(), nutrition: new Map(), unresolved: new Map() },
    recipes: [],
  };
  for (const r of recipes) {
    for (const line of r.lines) {
      if (line.kind === 'header') continue;
      const ing = line.ing ? dict.get(line.ing) : undefined;
      if (ing && NON_FOOD_AISLES.has(ing.aisle)) continue;
      if (lineQty(line, ing) === null && !(line.qty && !ing)) continue;
      report.lines++;
      const gap = gramsGap(line, dict);
      if (gap) {
        bump(report.gaps[gap.kind], gap.key);
        continue;
      }
      report.inGrams++;
      if (line.ing && table[line.ing]) report.withValues++;
      else if (line.ing) bump(report.gaps.nutrition, line.ing);
    }
    const n = recipeNutrition(r.lines, r.servings, dict, table);
    report.recipes.push({
      id: r.id,
      name: r.name.nl || r.name.en || r.id,
      counted: n.counted,
      total: n.total,
      coverage: n.coverage,
      kcal: n.perServing ? roundNutrients(n.perServing).kcal : null,
    });
  }
  report.recipes.sort((a, b) => b.coverage - a.coverage || b.counted - a.counted || a.id.localeCompare(b.id));
  return report;
}

function pct(n: number, of: number): string {
  return of ? `${((100 * n) / of).toFixed(1)} %` : '0 %';
}

function top(m: Map<string, number>, n = 20): [string, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

const GAP_TITLES: Record<GapKind, string> = {
  density: 'Dichtheid ontbreekt (`gramsPerMl`, volume-eenheid)',
  piece: 'Stukgewicht ontbreekt (`gramsPer.stuk` of `gramsPer[defaultUnit]`)',
  unit: 'Eenheidsgewicht ontbreekt (`gramsPer[eenheid]`)',
  nutrition: 'Nutritie-item ontbreekt (`data/nutrition.json`)',
  unresolved: 'Niet herkend ingrediënt (vrije tekst)',
};

export function formatReport(r: GramsReport, date: string): string {
  const out: string[] = [];
  out.push('# Meting grammen en voedingswaarden');
  out.push('');
  out.push(`Gegenereerd door \`npm run measure-grams\` (tools/measure-grams.ts) op ${date}; docs/specs/verbeterronde-9.md §1a.`);
  out.push('');
  out.push(`- Regels met een hoeveelheid: **${r.lines}**`);
  out.push(`- In grammen: **${r.inGrams}** (${pct(r.inGrams, r.lines)})`);
  out.push(`- In grammen én met waarden: **${r.withValues}** (${pct(r.withValues, r.lines)})`);
  const shown = r.recipes.filter((x) => x.coverage >= NUTRITION_MIN_COVERAGE && x.kcal !== null).length;
  out.push(`- Recepten met een kcal-regel (dekking ≥ ${Math.round(NUTRITION_MIN_COVERAGE * 100)} %): **${shown}** van ${r.recipes.length}`);
  for (const kind of ['density', 'piece', 'unit', 'nutrition', 'unresolved'] as const) {
    const m = r.gaps[kind];
    const lines = [...m.values()].reduce((a, b) => a + b, 0);
    out.push('');
    out.push(`## ${GAP_TITLES[kind]} — ${lines} regels, ${m.size} sleutels`);
    out.push('');
    if (m.size === 0) {
      out.push('(geen)');
      continue;
    }
    out.push('| Sleutel | Regels |');
    out.push('|---|---:|');
    for (const [k, n] of top(m)) out.push(`| ${k.replace(/\|/g, '\\|')} | ${n} |`);
  }
  out.push('');
  out.push('## Recepten met de hoogste dekking (top 20)');
  out.push('');
  out.push('| Recept | Id | Geteld | Dekking | kcal p.p. |');
  out.push('|---|---|---:|---:|---:|');
  for (const x of r.recipes.slice(0, 20)) {
    out.push(`| ${x.name.replace(/\|/g, '\\|')} | \`${x.id}\` | ${x.counted}/${x.total} | ${Math.round(x.coverage * 100)} % | ${x.kcal ?? '–'} |`);
  }
  out.push('');
  return out.join('\n');
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dict = loadDictionary(readDictionaryData(root));
  const recipes = (readJson(join(root, 'data', 'recipes.json')) as { recipes: Recipe[] }).recipes;
  const nutritionPath = join(root, 'data', 'nutrition.json');
  const table: NutritionTable = existsSync(nutritionPath) ? ((readJson(nutritionPath) as { items?: NutritionTable }).items ?? {}) : {};
  const text = formatReport(measureGrams(recipes, dict, table), new Date().toISOString().slice(0, 10));
  writeFileSync(join(root, 'docs', 'measure-grams.md'), text, 'utf8');
  process.stdout.write(text);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href && basename(process.argv[1]) === 'measure-grams.ts';
if (invokedDirectly) main();
