// The 196 classics as exported from Recepten2 (data/source/recipes-recepten2.json): flat Dutch
// records with `name`, `ingredients[]` (raw lines) and `instructions`. This module normalizes that
// raw JSON and derives the stable ids and A-Z initials the app keys on. Framework-free.

export interface SourceRecipe {
  name: string;
  ingredients: string[];
  instructions: string;
}

/**
 * Turns the raw export (an array, or an object with a `recipes` array) into clean SourceRecipe
 * records, in the original order. Names are trimmed and whitespace-collapsed, ingredient lines are
 * trimmed and empty lines (group separators in the source) dropped, instructions are trimmed with
 * normalized line endings. The one stray "" key in the source holds a second instructions
 * paragraph; its text is appended to `instructions` so no content is lost. All other unknown keys
 * are dropped. Records without a usable name are skipped. Throws Error('invalid-source') when the
 * input is not a recipe list at all.
 */
export function normalizeSource(raw: unknown): SourceRecipe[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { recipes?: unknown }).recipes)
      ? ((raw as { recipes: unknown[] }).recipes)
      : null;
  if (!list) throw new Error('invalid-source');

  const out: SourceRecipe[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? collapseSpaces(rec.name) : '';
    if (!name) continue;

    const ingredients = Array.isArray(rec.ingredients)
      ? rec.ingredients
          .filter((line): line is string => typeof line === 'string')
          .map((line) => collapseSpaces(line))
          .filter((line) => line.length > 0)
      : [];

    const parts = [rec.instructions, rec['']]
      .filter((p): p is string => typeof p === 'string')
      .map((p) => normalizeText(p))
      .filter((p) => p.length > 0);

    out.push({ name, ingredients, instructions: parts.join('\n\n') });
  }
  return out;
}

/**
 * Stable id fragment for a name: lowercase, diacritics stripped, anything non-alphanumeric
 * becomes '-', runs collapsed, ends trimmed. "Salade Niçoise" -> "salade-nicoise";
 * built-in recipes get the id 'b:' + slugId(name).
 */
export function slugId(name: string): string {
  return foldDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First letter of a name, uppercased and diacritics-free, for the A-Z rail; digits (and anything
 * that is not a letter) become '#'. */
export function initialOf(name: string): string {
  const first = foldDiacritics(name.trim()).charAt(0);
  if (!first) return '#';
  if (/[0-9]/.test(first)) return '#';
  const upper = first.toUpperCase();
  return /[A-Z]/.test(upper) ? upper : '#';
}

/** "Rösti" -> "Rosti", "Niçoise" -> "Nicoise", "ĳ" -> "ij", "ß" -> "ss". Keeps case and spacing. */
export function foldDiacritics(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, (m) => (m === 'æ' ? 'ae' : 'AE'))
    .replace(/[œŒ]/g, (m) => (m === 'œ' ? 'oe' : 'OE'))
    .replace(/[øØ]/g, (m) => (m === 'ø' ? 'o' : 'O'))
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .replace(/[łŁ]/g, (m) => (m === 'ł' ? 'l' : 'L'));
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}
