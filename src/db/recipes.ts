// The 196 built-in recipes (phase-0 source JSON, Dutch only) plus the user's own/received recipes
// from Dexie, unified behind one `Recipe` shape with string ids: 'b<index>' or 'u<dexie id>'.
import { useMemo } from 'preact/hooks';
import raw from '@data/source/recipes-recepten2.json';
import { normalizeSource, type SourceRecipe } from '@/domain/recipe-source';
import { db } from './db';
import { useLiveQuery } from './live';
import type { SharedRecipe, UserRecipe } from './model';

export interface Recipe {
  id: string;
  name: string;
  nameEn?: string;
  ingredients: string[];
  instructions: string;
  instructionsEn?: string;
  servings?: number;
  own: boolean;
  origin?: 'own' | 'received';
  by?: string;
}

// normalizeSource keeps the source order and drops nothing in this corpus (196 in, 196 out), so the
// ids 'b<index>' are stable. It also folds the one stray "" key (a second instructions paragraph)
// into `instructions`, so no text from the source is lost.
export const builtins: SourceRecipe[] = normalizeSource(raw);

export function builtinRecipe(index: number): Recipe | undefined {
  const s = builtins[index];
  if (!s) return undefined;
  return { id: 'b' + index, name: s.name, ingredients: s.ingredients, instructions: s.instructions, own: false };
}

export function fromUserRecipe(u: UserRecipe): Recipe {
  return {
    id: 'u' + u.id,
    name: u.name,
    nameEn: u.nameEn,
    ingredients: u.ingredients,
    instructions: u.instructions,
    instructionsEn: u.instructionsEn,
    servings: u.servings,
    own: true,
    origin: u.origin,
    by: u.by,
  };
}

/** Index of the built-in recipe with the longest JSON representation (used as share default). */
export const longestBuiltinIndex: number = builtins.reduce(
  (best, r, i) => (JSON.stringify(r).length > JSON.stringify(builtins[best] ?? '').length ? i : best),
  0,
);

export function useUserRecipes(): Recipe[] {
  return useLiveQuery(async () => (await db.userRecipes.toArray()).map(fromUserRecipe), [], []);
}

const builtinList: Recipe[] = builtins.map((s, i) => ({ id: 'b' + i, name: s.name, ingredients: s.ingredients, instructions: s.instructions, own: false }));

/** Built-ins + user recipes. Referentially stable between renders unless the user table changes. */
export function useAllRecipes(): Recipe[] {
  const user = useUserRecipes();
  return useMemo(() => builtinList.concat(user), [user]);
}

/** Resolve a recipe by unified id ('b12' | 'u5'); async because user recipes live in Dexie. */
export async function findRecipe(id: string): Promise<Recipe | undefined> {
  if (id.startsWith('b')) return builtinRecipe(Number(id.slice(1)));
  if (id.startsWith('u')) {
    const u = await db.userRecipes.get(Number(id.slice(1)));
    return u ? fromUserRecipe(u) : undefined;
  }
  return undefined;
}

export function toSharedRecipe(r: Recipe, bilingual: boolean): SharedRecipe {
  const out: SharedRecipe = {
    name: { nl: r.name },
    ingredients: r.ingredients,
    instructions: { nl: r.instructions },
  };
  if (r.servings) out.servings = r.servings;
  if (bilingual || r.nameEn) out.name.en = r.nameEn ?? r.name;
  if (bilingual || r.instructionsEn) out.instructions.en = r.instructionsEn ?? r.instructions;
  return out;
}

/** Case- and diacritic-insensitive key for search and grouping. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export async function nameExists(name: string): Promise<boolean> {
  const key = normalizeText(name.trim());
  if (builtins.some((b) => normalizeText(b.name) === key)) return true;
  const users = await db.userRecipes.toArray();
  return users.some((u) => normalizeText(u.name) === key);
}
