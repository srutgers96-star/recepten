// tools/derive-tags.ts — fact-based diet tags for the 196 classics (docs/phase-5-spec.md A.3).
//
// `applyDerivedTags(recipe, dict)` is the last composition step of tools/migrate-from-recepten2.ts:
// 'vegetarisch', 'vegan' and 'glutenvrij' are set or removed from what the dictionary says about
// the recipe's resolved lines (src/domain/diet.ts `dietTags`); an unsure dimension (an unresolved
// line, a missing vegan/gluten flag) keeps whatever tag the recipe had; '-optie' tags and every
// other tag stay as the LLM batches / the review set them.
//
// Run directly it rebuilds the classics WITHOUT that step, computes the changes and writes
// docs/measure-diet.md: counts per tag before/after, sure/unsure per dimension, and the recipes
// whose LLM 'vegetarisch' the facts contradict (with the offending ingredients).
//
// Run:   node --experimental-strip-types tools/derive-tags.ts
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import type { Dictionary } from '../src/domain/dictionary.ts';
import { DIET_TAGS, applyDietTags, dietTags, type DietTag, type DietTags } from '../src/domain/diet.ts';
import type { Recipe } from '../src/domain/model.ts';

export interface TagChange {
  id: string;
  name: string;
  before: string[];
  after: string[];
  added: string[];
  removed: string[];
  facts: DietTags;
  /** Ingredient ids (as the dictionary knows them) that contradict a diet tag: "kip (veg)", "spaghetti (gluten)". */
  contradictions: string[];
}

/** The recipe with its three diet tags set/removed fact-based; the same object when nothing changes. */
export function applyDerivedTags<T extends Pick<Recipe, 'lines' | 'tags'>>(recipe: T, dict: Dictionary): T {
  const tags = applyDietTags(recipe, dict);
  if (tags.length === recipe.tags.length && tags.every((t, i) => t === recipe.tags[i])) return recipe;
  return { ...recipe, tags };
}

/** What `applyDerivedTags` does to one recipe, with the reasons. */
export function deriveTagChange(recipe: Recipe, dict: Dictionary): TagChange {
  const facts = dietTags(recipe.lines, dict);
  const after = applyDietTags(recipe, dict);
  const before = recipe.tags;
  const contradictions: string[] = [];
  for (const line of recipe.lines) {
    if (line.kind === 'header' || !line.ing) continue;
    const ing = dict.get(line.ing);
    if (!ing) continue;
    if (ing.veg === false) contradictions.push(`${ing.id} (veg)`);
    else if (ing.vegan === false) contradictions.push(`${ing.id} (vegan)`);
    if (ing.gluten === true) contradictions.push(`${ing.id} (gluten)`);
  }
  return {
    id: recipe.id,
    name: recipe.name.nl ?? recipe.id,
    before,
    after,
    added: after.filter((t) => !before.includes(t)),
    removed: before.filter((t) => !after.includes(t)),
    facts,
    contradictions: [...new Set(contradictions)],
  };
}

export interface DietMeasure {
  changes: TagChange[];
  /** Per diet tag: how many recipes carry it before / after, and how many are sure true / sure false / unsure. */
  perTag: Record<DietTag, { before: number; after: number; sureTrue: number; sureFalse: number; unsure: number; unjudged: number }>;
  /** Recipes whose LLM 'vegetarisch' is contradicted by a resolved ingredient. */
  contradicted: TagChange[];
  /** Recipes with at least one line the dictionary could not judge. */
  unresolved: TagChange[];
  dictionary: { ingredients: number; vegan: number; gluten: number; glutenUnsure: number };
}

/** Measure the derivation over recipes that do NOT have it applied yet (migrate with deriveTags false). */
export function measureDiet(recipes: readonly Recipe[], dict: Dictionary): DietMeasure {
  const changes = recipes.map((r) => deriveTagChange(r, dict));
  const perTag = {} as DietMeasure['perTag'];
  for (const tag of DIET_TAGS) {
    perTag[tag] = {
      before: changes.filter((c) => c.before.includes(tag)).length,
      after: changes.filter((c) => c.after.includes(tag)).length,
      sureTrue: changes.filter((c) => c.facts[tag] === true && !c.facts.unsure.includes(tag)).length,
      sureFalse: changes.filter((c) => c.facts[tag] === false).length,
      unsure: changes.filter((c) => c.facts.unsure.includes(tag)).length,
      unjudged: changes.filter((c) => c.facts[tag] === undefined && !c.facts.unsure.includes(tag)).length,
    };
  }
  return {
    changes,
    perTag,
    contradicted: changes.filter((c) => c.before.includes('vegetarisch') && c.facts.vegetarisch === false),
    unresolved: changes.filter((c) => c.facts.unresolved.length > 0),
    dictionary: {
      ingredients: dict.ingredients.length,
      vegan: dict.ingredients.filter((i) => typeof i.vegan === 'boolean').length,
      gluten: dict.ingredients.filter((i) => typeof i.gluten === 'boolean').length,
      glutenUnsure: dict.ingredients.filter((i) => i.glutenUnsure === true).length,
    },
  };
}

/** docs/measure-diet.md */
export function dietReport(m: DietMeasure): string {
  const lines: string[] = [];
  lines.push('# Diet tags derived from the ingredients');
  lines.push('');
  lines.push('Generated by `node --experimental-strip-types tools/derive-tags.ts` over the 196 classics (the migration');
  lines.push('without its last step) with the dictionary in `data/*.json`. Re-run to reproduce. Rules: src/domain/diet.ts.');
  lines.push('');
  lines.push('## Dictionary');
  lines.push('');
  const d = m.dictionary;
  lines.push(`- Ingredients: **${d.ingredients}**; with a \`vegan\` flag: ${d.vegan}; with a \`gluten\` flag: ${d.gluten} (of which \`glutenUnsure\`: ${d.glutenUnsure})`);
  if (d.vegan < d.ingredients || d.gluten < d.ingredients) {
    lines.push(`- Flags are missing on ${d.ingredients - Math.min(d.vegan, d.gluten)} entries: \`vegan\` / \`glutenvrij\` stay "unsure" for recipes that use them (the tag is never set or removed then).`);
  }
  lines.push('');
  lines.push('## Tags before / after');
  lines.push('');
  lines.push('| Tag | Before (LLM) | After (facts) | Sure yes | Sure no | Unsure | Nothing to judge |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const tag of DIET_TAGS) {
    const t = m.perTag[tag];
    lines.push(`| ${tag} | ${t.before} | ${t.after} | ${t.sureTrue} | ${t.sureFalse} | ${t.unsure} | ${t.unjudged} |`);
  }
  lines.push('');
  const changed = m.changes.filter((c) => c.added.length > 0 || c.removed.length > 0);
  lines.push(`Recipes with a changed tag list: **${changed.length}** (${m.changes.filter((c) => c.added.length > 0).length} gained a tag, ${m.changes.filter((c) => c.removed.length > 0).length} lost one).`);
  lines.push('');
  lines.push(`## LLM 'vegetarisch' contradicted by the facts (${m.contradicted.length})`);
  lines.push('');
  if (m.contradicted.length === 0) lines.push('None: every recipe the LLM tagged vegetarisch has only vegetarian ingredients.');
  for (const c of m.contradicted) lines.push(`- ${c.name} (\`${c.id}\`): ${c.contradictions.filter((x) => x.endsWith('(veg)')).join(', ')}`);
  lines.push('');
  lines.push(`## Tags added (${m.changes.filter((c) => c.added.length > 0).length})`);
  lines.push('');
  for (const c of m.changes) if (c.added.length > 0) lines.push(`- ${c.name} (\`${c.id}\`): +${c.added.join(', +')}`);
  lines.push('');
  const removedOther = m.changes.filter((c) => c.removed.length > 0 && !m.contradicted.includes(c));
  lines.push(`## Other tags removed (${removedOther.length})`);
  lines.push('');
  for (const c of removedOther) lines.push(`- ${c.name} (\`${c.id}\`): -${c.removed.join(', -')} (${c.contradictions.join(', ')})`);
  lines.push('');
  lines.push(`## Recipes with lines the dictionary cannot judge (${m.unresolved.length})`);
  lines.push('');
  lines.push('An unresolved line makes every dimension "unsure" for that recipe unless a resolved ingredient already contradicts it.');
  lines.push('');
  for (const c of m.unresolved) lines.push(`- ${c.name} (\`${c.id}\`): ${c.facts.unresolved.map((u) => `"${u}"`).join(', ')} → unsure: ${c.facts.unsure.join(', ') || '—'}`);
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  // Dynamic import: migrate-from-recepten2.ts imports this file for `applyDerivedTags`.
  const { migrate, loadMigrationInputs } = await import('./migrate-from-recepten2.ts');
  const raw: unknown = JSON.parse(readFileSync(join(root, 'data', 'source', 'recipes-recepten2.json'), 'utf8'));
  const inputs = loadMigrationInputs(root);
  const before = migrate(raw, '2026-01-01T00:00:00.000Z', { ...inputs, deriveTags: false });
  const m = measureDiet(before.recipes, inputs.dict);
  const outPath = join(root, 'docs', 'measure-diet.md');
  writeFileSync(outPath, dietReport(m) + '\n', 'utf8');
  for (const tag of DIET_TAGS) {
    const t = m.perTag[tag];
    console.log(`${tag.padEnd(12)} before ${String(t.before).padStart(3)}  after ${String(t.after).padStart(3)}  sure-yes ${t.sureTrue}  sure-no ${t.sureFalse}  unsure ${t.unsure}`);
  }
  console.log(`contradicted LLM vegetarisch: ${m.contradicted.length}; recipes with unresolved lines: ${m.unresolved.length}; wrote docs/measure-diet.md`);
  for (const c of m.changes) {
    if (c.added.length > 0 || c.removed.length > 0) console.log(`  ${c.name}: ${c.added.map((t) => '+' + t).concat(c.removed.map((t) => '-' + t)).join(' ')}`);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e: unknown) => {
    console.error(`ERROR: ${(e as Error).message}`);
    process.exit(1);
  });
}
