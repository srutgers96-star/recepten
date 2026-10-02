// Plain-text rendering of a recipe for "Kopieer als tekst" (docs/phase-5-spec.md block D.2).
// FRAMEWORK-FREE: runs in Node (tests) and in the browser. The caller (the recipe screen) renders
// the ingredient lines with exactly the same helpers as on screen (lineText in src/dictionary.ts,
// as the block-B cook-mode reader uses them) and passes plain strings here.
import type { Lang } from './model';

export interface RecipeTextInput {
  name: string;
  servings: number;
  /** Already-formatted time, e.g. "35 min"; appended to the servings line when present. */
  timeLabel?: string | null;
  /** Rendered ingredient lines in `lang`; a `header` line becomes "Kopje:" without a dash. */
  lines: Array<{ text: string; header: boolean }>;
  steps: string[];
  lang: Lang;
}

const METHOD: Record<Lang, string> = { nl: 'Bereiding:', en: 'Method:' };

/** "4 personen" / "1 persoon" / "4 people" / "1 person". */
function servingsLine(n: number, lang: Lang): string {
  if (lang === 'nl') return n === 1 ? '1 persoon' : `${n} personen`;
  return n === 1 ? '1 person' : `${n} people`;
}

/**
 * The ingredient block: "- tekst" per line, headers as "Kopje:" (no dash, colon added when
 * missing, a blank line before a header unless it opens the block). Empty lines are skipped.
 */
function ingredientLines(lines: RecipeTextInput['lines']): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (line.header) {
      if (out.length > 0) out.push('');
      out.push(text.endsWith(':') ? text : `${text}:`);
    } else {
      out.push(`- ${text}`);
    }
  }
  return out;
}

/**
 * The whole recipe as shareable plain text: name, servings (and time), the ingredient block,
 * then "Bereiding:"/"Method:" with numbered steps. Blank steps are dropped; no steps at all
 * leaves the method block out entirely.
 */
export function recipeAsText(input: RecipeTextInput): string {
  const out: string[] = [];
  const name = input.name.trim();
  if (name) out.push(name);
  const time = input.timeLabel?.trim();
  out.push(time ? `${servingsLine(input.servings, input.lang)} · ${time}` : servingsLine(input.servings, input.lang));
  const ing = ingredientLines(input.lines);
  if (ing.length) {
    out.push('');
    out.push(...ing);
  }
  const steps = input.steps.map((s) => s.trim()).filter((s) => s !== '');
  if (steps.length) {
    out.push('');
    out.push(METHOD[input.lang]);
    out.push(...steps.map((s, i) => `${i + 1}. ${s}`));
  }
  return out.join('\n');
}

/** Only name + servings + the ingredient block (the "ingrediënten per recept" copy/print). */
export function ingredientsAsText(input: Pick<RecipeTextInput, 'name' | 'servings' | 'lines' | 'lang'>): string {
  const out: string[] = [];
  const name = input.name.trim();
  if (name) out.push(name);
  out.push(servingsLine(input.servings, input.lang));
  const ing = ingredientLines(input.lines);
  if (ing.length) {
    out.push('');
    out.push(...ing);
  }
  return out.join('\n');
}
