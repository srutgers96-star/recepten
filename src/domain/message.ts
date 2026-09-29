// The WhatsApp share message (PLAN.md §7 "Het bericht (exact)"):
//
//   🍲 Afwasmachinezalm · Dishwasher salmon
//   4 pers · 10 ingrediënten · van Stijn
//   Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):
//   https://srutgers96-star.github.io/recepten/#r=eJx9kU1v2zAMhu_5FYQv...
//
// Both names on line 1 (a readable bubble for either phone), the URL alone on the last line so
// WhatsApp renders one tappable link. Plus "Deel als tekst": the readable recipe (title, servings,
// lines, numbered steps, serving tip) in NL, EN or both, for people without the app — link last.
// Framework-free.
import { hasLang, pickText, type Lang, type Recipe, type Text } from './model.ts';
import type { Dictionary } from './dictionary.ts';
import { renderLine } from './render.ts';

export interface ShareMessageInput {
  nameNl: string;
  nameEn?: string;
  servings?: number;
  ingredientCount: number;
  by: string;
  url: string;
  /** Language of the sender's UI: decides the wording of lines 2 and 3. */
  lang: 'nl' | 'en';
}

export const APP_NAME = { nl: "Rutgers' Recepten", en: "Rutgers' Recipes" } as const;

const OPEN_LINE = {
  nl: `Open in ${APP_NAME.nl} (of tik voor een voorproefje / or tap to preview):`,
  en: `Open in ${APP_NAME.en} (or tap to preview / of tik voor een voorproefje):`,
} as const;

export function buildShareMessage(i: ShareMessageInput): string {
  const lang = i.lang === 'en' ? 'en' : 'nl';
  const n = Math.max(0, Math.floor(i.ingredientCount));
  const by = i.by.trim();

  const line1 = '🍲 ' + titleNames(i.nameNl, i.nameEn).join(' · ');

  const facts: string[] = [];
  if (typeof i.servings === 'number' && i.servings > 0) {
    facts.push(
      lang === 'nl' ? `${i.servings} pers` : `${i.servings} ${i.servings === 1 ? 'serving' : 'servings'}`,
    );
  }
  facts.push(
    lang === 'nl' ? `${n} ${n === 1 ? 'ingrediënt' : 'ingrediënten'}` : `${n} ${n === 1 ? 'ingredient' : 'ingredients'}`,
  );
  if (by) facts.push(lang === 'nl' ? `van ${by}` : `from ${by}`);
  const line2 = facts.join(' · ');

  return [line1, line2, OPEN_LINE[lang], i.url.trim()].join('\n');
}

/** "<nameNl> · <nameEn>"; the English name is omitted when missing or identical to the Dutch one. */
function titleNames(nameNl: string, nameEn?: string): string[] {
  const nl = nameNl.trim();
  const en = (nameEn ?? '').trim();
  if (!nl) return [en || '?'];
  if (!en || en.toLowerCase() === nl.toLowerCase()) return [nl];
  return [nl, en];
}

// --- Phase 3: patch and multi-item headers (docs/phase-3-spec.md §1 planMessages, §4 Share) ------

export interface PatchShareMessageInput {
  nameNl: string;
  nameEn?: string;
  by: string;
  url: string;
  lang: 'nl' | 'en';
}

const ADJUSTED = { nl: 'aangepast', en: 'adjusted' } as const;

/**
 * The message for an edited classic (`#p=`): line 1 "🍲 <name> (aangepast)", line 2 "van <by>",
 * then the open line and the URL alone on the last line.
 */
export function buildPatchShareMessage(i: PatchShareMessageInput): string {
  const lang = i.lang === 'en' ? 'en' : 'nl';
  const by = i.by.trim();
  const line1 = '🍲 ' + titleNames(i.nameNl, i.nameEn).join(' · ') + ` (${ADJUSTED[lang]})`;
  const lines = [line1];
  if (by) lines.push(lang === 'nl' ? `van ${by}` : `from ${by}`);
  lines.push(OPEN_LINE[lang], i.url.trim());
  return lines.join('\n');
}

/** "🍲 3 recepten van Stijn" / "🍲 3 recipes from Stijn": the compact header above several links. */
export function buildMultiShareHeader(count: number, by: string, lang: 'nl' | 'en'): string {
  const l = lang === 'en' ? 'en' : 'nl';
  const n = Math.max(0, Math.floor(count));
  const what = l === 'nl' ? (n === 1 ? 'recept' : 'recepten') : n === 1 ? 'recipe' : 'recipes';
  const sender = by.trim();
  const from = sender ? (l === 'nl' ? ` van ${sender}` : ` from ${sender}`) : '';
  return `🍲 ${n} ${what}${from}`;
}

/** The "Open in Rutgers' Recepten (…)" line in the sender's language, for messages built elsewhere. */
export function openLine(lang: 'nl' | 'en'): string {
  return OPEN_LINE[lang === 'en' ? 'en' : 'nl'];
}

// --- Schema-2 recipe -> share message -----------------------------------------------------------

export interface RecipeShareOptions {
  /** Sender name (the active profile); omitted from the message when empty. */
  by?: string;
  url: string;
  lang: Lang;
}

/** Ingredient lines that are real lines (group headers such as "Dressing:" do not count). */
export function countIngredientLines(r: Recipe): number {
  return r.lines.filter((l) => l.kind !== 'header').length;
}

/** The buildShareMessage input for a schema-2 recipe. */
export function shareMessageInput(r: Recipe, o: RecipeShareOptions): ShareMessageInput {
  const input: ShareMessageInput = {
    nameNl: r.name.nl ?? '',
    servings: r.servings,
    ingredientCount: countIngredientLines(r),
    by: o.by ?? '',
    url: o.url,
    lang: o.lang,
  };
  if (r.name.en) input.nameEn = r.name.en;
  return input;
}

export function buildShareMessageFor(r: Recipe, o: RecipeShareOptions): string {
  return buildShareMessage(shareMessageInput(r, o));
}

// --- "Deel als tekst": the readable recipe ------------------------------------------------------

const LABELS: Record<Lang, { ingredients: string; method: string; tip: string; servings: (n: number) => string }> = {
  nl: {
    ingredients: 'Ingrediënten:',
    method: 'Bereiding:',
    tip: 'Serveertip:',
    servings: (n) => `${n} pers.`,
  },
  en: {
    ingredients: 'Ingredients:',
    method: 'Method:',
    tip: 'Serving tip:',
    servings: (n) => `${n} ${n === 1 ? 'serving' : 'servings'}`,
  },
};

const OPEN_LINE_READABLE: Record<Lang, string> = {
  nl: `Open in ${APP_NAME.nl} (of tik voor een voorproefje):`,
  en: `Open in ${APP_NAME.en} (or tap to preview):`,
};

/** True when any human-readable field of the recipe has text in that language. */
export function recipeHasLang(r: Recipe, lang: Lang): boolean {
  return (
    hasLang(r.name, lang) ||
    r.lines.some((l) => hasLang(l.raw, lang)) ||
    r.steps.some((s) => hasLang(s.text, lang))
  );
}

/** Steps are one paragraph each in the message: inner line breaks become spaces. */
function oneParagraph(s: string): string {
  return s.replace(/\s*\n+\s*/g, ' ').trim();
}

/** A non-header line in a language: through the dictionary when given (same as the landing page), else its raw text. */
function readableLine(line: Recipe['lines'][number], lang: Lang, dict: Dictionary | undefined): string {
  if (dict && line.kind !== 'header') {
    try {
      const text = renderLine(line, dict, lang);
      if (text) return text;
    } catch {
      // A malformed line falls back to its raw text below.
    }
  }
  return pickText(line.raw, lang);
}

function readableBlock(r: Recipe, lang: Lang, dict: Dictionary | undefined): string {
  const L = LABELS[lang];
  const out: string[] = [];
  out.push('🍲 ' + (pickText(r.name, lang) || '?'));
  if (r.servings > 0) out.push(L.servings(r.servings));
  const description = pickText(r.description, lang);
  if (description) out.push(oneParagraph(description));

  if (r.lines.length) {
    out.push('', L.ingredients);
    for (const line of r.lines) {
      const text = readableLine(line, lang, dict);
      if (!text) continue;
      out.push(line.kind === 'header' ? text : '- ' + text);
    }
  }

  if (r.steps.length) {
    out.push('', L.method);
    let n = 0;
    for (const step of r.steps) {
      const text = pickText(step.text, lang);
      if (!text) continue;
      n++;
      out.push(`${n}. ${oneParagraph(text)}`);
    }
  }

  const tip = pickText(r.servingTip, lang);
  if (tip) out.push('', `${L.tip} ${oneParagraph(tip)}`);
  return out.join('\n');
}

/**
 * The readable recipe for people without the app: title, servings, lines (group headers kept as
 * they are), numbered steps and the serving tip, one block per language (NL first), and the link
 * alone on the last line when given. A requested language without any text is skipped, unless
 * that would leave nothing (then the first language is rendered with fallbacks). With a
 * dictionary the ingredient lines are rendered through it in each language (a classic's English
 * block then has English ingredient lines, as on the landing page); without one they are the
 * raw text.
 */
export function buildReadableRecipe(recipe: Recipe, langs: Lang[], url?: string, dict?: Dictionary): string {
  // Canonical order NL then EN, whatever order was asked for.
  const wanted: Lang[] = (['nl', 'en'] as Lang[]).filter((l) => langs.includes(l));
  if (!wanted.length) wanted.push('nl');
  const available = wanted.filter((l) => recipeHasLang(recipe, l));
  const use: Lang[] = available.length ? available : [wanted[0] as Lang];

  const parts = [use.map((l) => readableBlock(recipe, l, dict)).join('\n\n')];
  const link = (url ?? '').trim();
  if (link) parts.push(OPEN_LINE_READABLE[use[0] as Lang] + '\n' + link);
  return parts.join('\n\n');
}
