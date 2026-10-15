// One paste box that recognises everything (docs/phase-6-spec.md 13A). Framework-free.
//
// Stijn's rule: there may be paste boxes in several places, but every paste box must take
// everything — share links (several at once), a member card, a website recipe, an AI answer,
// bundle/backup JSON. `classifyPaste` says what a text is; the place the box sits in decides the
// default action. Order of recognition: empty → tokens (any #r=/#p=/#w=/#b=, with or without text
// around them; a #f= among them travels along) → member (only #f=) → bundle (JSON) → ai (the plain
// format the import prompt asks for, with or without its '#' marks) → website (page text with
// ingredient lines) → unknown.
import { parseWebsiteRecipe, type WebsiteRecipe } from './paste-recipe.ts';
import { cleanPastedText } from './photo-import.ts';
import { extractTokens } from './token.ts';

export type PasteKind = 'tokens' | 'member' | 'bundle' | 'ai' | 'website' | 'empty' | 'unknown';

export interface PasteClassification {
  kind: PasteKind;
  /** 'tokens' / 'member': every token as "key=token" in order of appearance (`extractTokens` reads these again). */
  tokens?: string[];
  /** The text without markdown escapes (\[ \] \* \_ \#), code fences and zero-width characters. */
  normalized: string;
  /** 'website': the parse that made the call, so the caller need not parse twice. */
  website?: WebsiteRecipe;
}

const FENCE_LINE_RE = /^\s*`{3,}[\w-]*\s*$/u;

/** Code-fence lines removed (the inside is kept as is). */
function stripFences(text: string): string {
  return text
    .split('\n')
    .filter((r) => !FENCE_LINE_RE.test(r))
    .join('\n');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A JSON value the Inbox collector knows: an envelope, a backup, an export with recipes, a recipe, an array of those. */
function isBundleShape(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0 && v.every(isRecord);
  if (!isRecord(v)) return false;
  if (typeof v.v === 'number' && typeof v.t === 'string') return true;
  if (Array.isArray(v.recipes) || Array.isArray(v.userRecipes)) return true;
  if (typeof v.baseId === 'string' && isRecord(v.patch)) return true;
  if (typeof v.id === 'string' && (isRecord(v.name) || typeof v.name === 'string') && (Array.isArray(v.lines) || Array.isArray(v.steps))) return true;
  return false;
}

/** JSON as a whole, or from the first '{' / '[' (a title line before a shared document). */
function looksLikeBundle(text: string): boolean {
  const s = text.trim();
  const idx = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (idx === undefined) return false;
  for (const candidate of idx === 0 ? [s] : [s, s.slice(idx)]) {
    try {
      if (isBundleShape(JSON.parse(candidate))) return true;
    } catch {
      /* not JSON */
    }
  }
  return false;
}

/** Markers only the import prompt's answer has: one is enough ("# Naam" at the start of a line; a lone " # " inside a message is not one). */
const AI_STRONG_RES = [
  /={2,}\s*(?:NL|EN)\s*={2,}/u,
  /^\s*#\s+\p{L}/mu,
  /(?:^|\s)#{2,3}\s*(?:ingredi[eë]nten|ingredients?|bereiding|bereidingswijze|method|instructions)\b/imu,
  /^\s*[\s*_\->•]*[IS]1\s*[.:)]/mu,
];
/** Markers an answer has that a page could have too: two together make it an answer. */
const AI_WEAK_RES = [
  /(?:^|\s)\**(?:porties|servings)\**\s*:/imu,
  /(?:^|\s)\**(?:categorie|category)\**\s*:/imu,
  /(?:^|\s)\**(?:labels?|tags)\**\s*:/imu,
  /^\s*\**(?:naam|name|titel|title)\**\s*:/imu,
];

function looksLikeAiAnswer(text: string): boolean {
  if (AI_STRONG_RES.some((re) => re.test(text))) return true;
  return AI_WEAK_RES.filter((re) => re.test(text)).length >= 2;
}

/**
 * What a pasted text is (see the module comment for the order). `normalized` is the text every
 * further parser should get; for 'website' the parse is included.
 */
export function classifyPaste(text: string): PasteClassification {
  const normalized = stripFences(cleanPastedText(text ?? '')).trim();
  if (!normalized) return { kind: 'empty', normalized: '' };

  const tokens = extractTokens(normalized);
  if (tokens.length) {
    const list = tokens.map((t) => `${t.key}=${t.token}`);
    return { kind: tokens.some((t) => t.key !== 'f') ? 'tokens' : 'member', tokens: list, normalized };
  }

  if (looksLikeBundle(normalized)) return { kind: 'bundle', normalized };
  if (looksLikeAiAnswer(normalized)) return { kind: 'ai', normalized };

  const website = parseWebsiteRecipe(normalized);
  if (website && website.ingredients.length + website.steps.length >= 3) return { kind: 'website', normalized, website };
  return { kind: 'unknown', normalized };
}
