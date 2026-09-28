// Lenient reader for the recipe payload of an incoming envelope. No framework imports, so the
// Safari landing bundle can use it as well.
import type { SharedRecipe } from './model';

function langField(v: unknown): { nl: string; en?: string } | null {
  if (typeof v === 'string') return { nl: v };
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const nl = typeof o.nl === 'string' ? o.nl : typeof o.en === 'string' ? o.en : null;
    if (nl === null) return null;
    const out: { nl: string; en?: string } = { nl };
    if (typeof o.en === 'string') out.en = o.en;
    return out;
  }
  return null;
}

/** Accepts the phase-0 payload, a plain {name, ingredients, instructions} object, or null. */
export function readSharedRecipe(value: unknown): SharedRecipe | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const name = langField(o.name);
  if (!name || !name.nl.trim()) return null;
  const ingredients = Array.isArray(o.ingredients)
    ? o.ingredients.map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x && 'raw' in x ? String((x as { raw: unknown }).raw) : String(x)))
    : [];
  const instructions = langField(o.instructions) ?? { nl: '' };
  const out: SharedRecipe = { name, ingredients, instructions };
  if (typeof o.servings === 'number' && Number.isFinite(o.servings)) out.servings = o.servings;
  return out;
}

/** Instruction text -> paragraphs (split on blank lines; single newlines kept inside a paragraph). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
