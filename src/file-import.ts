// "Kies bestand" (docs/phase-5-spec.md A-bis.9), shared by the Add screen's import section and the
// "+" menu of Recipes: does a chosen file hold recipes (share tokens, a recipe/bundle/backup JSON) —
// then the Inbox imports it (its merge UI lives there) — or is it plain text for the text import?
import { normalizeRecipe } from '@/domain/recipe-io';
import { extractTokens } from '@/domain/token';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** True when a JSON value carries recipes in any shape the Inbox understands (envelope, export, patch, bare recipe). */
function jsonHasRecipes(value: unknown, depth = 0): boolean {
  if (depth > 3) return false;
  if (Array.isArray(value)) return value.some((v) => jsonHasRecipes(v, depth + 1));
  if (!isRecord(value)) return false;
  if (typeof value.v === 'number' && typeof value.t === 'string') return true;
  if (Array.isArray(value.userRecipes) || Array.isArray(value.recipes)) return true;
  if (typeof value.baseId === 'string' && isRecord(value.patch)) return true;
  return normalizeRecipe(value) !== null;
}

/** Whether the text of a file holds recipes (share tokens or recipe JSON) rather than plain text. */
export function fileHasRecipes(text: string): boolean {
  if (extractTokens(text).length) return true;
  const s = text.trim();
  const candidates: string[] = [s];
  const idx = [s.indexOf('{'), s.indexOf('[')].filter((i) => i > 0).sort((a, b) => a - b)[0];
  if (idx !== undefined) candidates.push(s.slice(idx));
  for (const c of candidates) {
    try {
      return jsonHasRecipes(JSON.parse(c));
    } catch {
      /* not JSON */
    }
  }
  return false;
}

export type FileRead = { kind: 'empty' } | { kind: 'recipes'; text: string } | { kind: 'text'; text: string };

/** Reads a chosen file and says what it holds. Rejects when the file cannot be read. */
export async function readRecipeFile(file: File): Promise<FileRead> {
  const text = await file.text();
  if (!text.trim()) return { kind: 'empty' };
  return fileHasRecipes(text) ? { kind: 'recipes', text } : { kind: 'text', text };
}
