// The app layer behind every paste box (phase 6, docs/phase-6-spec.md 13A: "elk plakvak moet alles
// kunnen plakken"). One component, src/components/UniversalPaste.tsx, sits in the editor, the Inbox
// and the Household; this module tells it what a pasted text is (src/domain/paste-classify.ts), the
// one line that says so ("3 deellinks herkend", "Kaartje van Noor", "Recept van een website: 12
// ingrediënten, 6 stappen") and how to hand the text to the screen that acts on it: share links and
// bundles go to the Inbox (its import preview), member cards to the Household, a website recipe or
// an AI answer to the editor, which fills the form in on arrival.
//
// The token/JSON collection the Inbox analyses with lives here too (it used to be in InboxScreen):
// the summary line counts the same way the Inbox does. Everything the input held is merged into ONE
// ParsedShare: tokens first (`#r=`/`#p=`/`#w=`/`#b=`/`#f=`, also several in one WhatsApp message),
// else JSON by content per part (an envelope, the backup/export format, a bare recipe or patch).
import { classifyPaste, type PasteClassification, type PasteKind } from '@/domain/paste-classify';
import { parseWebsiteRecipe } from '@/domain/paste-recipe';
import { cleanPastedText } from '@/domain/photo-import';
import type { MemberCard } from '@/domain/household';
import type { Recipe, Text } from '@/domain/model';
import { normalizeRecipe } from '@/domain/recipe-io';
import { parseEnvelope, readPatchPayload, type ParsedShare, type PatchPayload, type PlanShare } from '@/domain/share';
import { decodeToken, extractTokens } from '@/domain/token';
import { fileHasRecipes } from '@/file-import';
import { t } from '@/i18n';
import { navigate, pendingImport, pendingImportKind, pendingImportText, pendingMemberText } from '@/router';

/** The `accept` of every file chooser that feeds a paste box: recipe/bundle/backup JSON or a text file. */
export const PASTE_FILE_ACCEPT = '.json,.txt,application/json,text/plain';

// --- Input -> one ParsedShare (the Inbox's analysis) --------------------------------------------

/** Everything the input held, merged: recipes and patches concatenated, dictionary entries by id. */
export interface Collected {
  share: ParsedShare;
  /** Human-readable problems per part (invalid code, newer version …). */
  problems: string[];
  /** A received week plan (`#w=`, phase 4): the first one in the input; its recipes are in `share`. */
  plan?: ReceivedPlan;
  /** Member cards (`#f=`, block F), one per card id. */
  members: MemberCard[];
}

/** A `#w=` plan as the Inbox offers it: the dishes with a name when known here or in the token. */
export interface ReceivedPlan {
  share: PlanShare;
  by?: string;
  /** Names of the embedded recipes by id (the receiver may not have them yet). */
  names: Record<string, Text>;
}

function emptyShare(): ParsedShare {
  return { kind: 'bundle', dict: { ing: [] }, recipes: [], patches: [] };
}

function usable(r: Recipe | null): r is Recipe {
  return !!r && (r.lines.length > 0 || r.steps.length > 0);
}

function senderOf(r: Recipe): string | undefined {
  return r.origin.receivedFrom || r.origin.author || undefined;
}

/** The message for a token or envelope that could not be read ("update the app" for a newer version). */
export function pasteProblemOf(e: unknown): string {
  return (e as Error)?.message === 'unsupported-version' ? t('inbox.unsupported') : t('inbox.invalid');
}

function addShare(acc: Collected, parsed: ParsedShare) {
  const s = acc.share;
  if (parsed.kind === 'member') {
    // A member card carries no recipes; its `by` is the card's own name, so it never becomes the import's sender.
    if (parsed.member && !acc.members.some((m) => m.id === parsed.member?.id)) acc.members.push(parsed.member);
    return;
  }
  if (parsed.kind === 'plan' && parsed.plan && !acc.plan) {
    const names: Record<string, Text> = {};
    for (const r of parsed.recipes) names[r.id] = r.name;
    acc.plan = { share: parsed.plan, names, ...(parsed.by ? { by: parsed.by } : {}) };
  }
  if (!s.by && parsed.by) s.by = parsed.by;
  if (!s.at && parsed.at) s.at = parsed.at;
  if (!s.title && parsed.title) s.title = parsed.title;
  s.recipes.push(...parsed.recipes.filter(usable));
  s.patches.push(...parsed.patches);
  const have = new Set(s.dict.ing.map((e) => e.id));
  for (const e of parsed.dict.ing) {
    if (have.has(e.id)) continue;
    have.add(e.id);
    s.dict.ing.push(e);
  }
}

function addRecipe(acc: Collected, r: Recipe) {
  if (!usable(r)) return;
  acc.share.recipes.push(r);
  if (!acc.share.by) {
    const by = senderOf(r);
    if (by) acc.share.by = by;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recognise JSON by content: an envelope (r/p/b, also the backup format), an array, an export
 * with `recipes` / `userRecipes`, a bare patch, a recipe in any shape. A v3 envelope says
 * "update the app" (parseEnvelope checks the version like decodeToken does).
 */
function collectJson(value: unknown, acc: Collected, depth = 0) {
  if (depth > 3) return;
  if (Array.isArray(value)) {
    for (const v of value) collectJson(v, acc, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.v === 'number' && typeof value.t === 'string') {
    try {
      addShare(acc, parseEnvelope(value));
    } catch (e) {
      acc.problems.push(pasteProblemOf(e));
    }
    return;
  }
  if (Array.isArray(value.userRecipes) || Array.isArray(value.recipes)) {
    collectJson(value.userRecipes ?? value.recipes, acc, depth + 1);
    if (Array.isArray(value.overrides)) collectJson(value.overrides, acc, depth + 1);
    if (Array.isArray(value.userIngredients)) {
      // Legacy export without an envelope: run its ingredients through the tolerant reader.
      try {
        addShare(acc, parseEnvelope({ v: 2, t: 'b', b: { recipes: [], patches: [] }, dict: { ing: value.userIngredients } }));
      } catch {
        /* ignore an unreadable dictionary part */
      }
    }
    return;
  }
  if (typeof value.baseId === 'string' && isRecord(value.patch)) {
    const p: PatchPayload | null = readPatchPayload(value);
    if (p) acc.share.patches.push(p);
    return;
  }
  const recipe = normalizeRecipe(value);
  if (recipe) addRecipe(acc, recipe);
}

/**
 * JSON-by-content on one part of the input. A share-target part may carry a title/subject line
 * before the document body, so when the whole part is not JSON we retry from the first '{' / '['.
 */
function jsonCandidates(part: string): unknown[] {
  const s = part.trim();
  if (!s) return [];
  try {
    return [JSON.parse(s)];
  } catch {
    /* not JSON as a whole */
  }
  const idx = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (idx === undefined || idx === 0) return [];
  try {
    return [JSON.parse(s.slice(idx))];
  } catch {
    return [];
  }
}

/** True when the text parses as JSON (as a whole, or from its first '{' / '['): worth a look by content. */
export function looksLikeJson(text: string): boolean {
  return jsonCandidates(text).length > 0;
}

/**
 * Tokens first (every `#r=`/`#p=`/`#w=`/`#b=`/`#f=` in the text), else JSON by content per part
 * (`parts`: the share-target's message and files kept separate; null for a pasted text). Tokens
 * are read from the cleaned text, as `classifyPaste` reads them: a rendered chat may have escaped
 * a "_" or "-" inside the token or dropped a zero-width character into it. JSON is parsed as pasted.
 */
export async function collectPaste(text: string, parts: string[] | null): Promise<Collected> {
  const acc: Collected = { share: emptyShare(), problems: [], members: [] };
  const tokens = extractTokens(cleanPastedText(text));
  if (tokens.length) {
    for (const tk of tokens) {
      try {
        const env = await decodeToken(tk.token);
        // The fragment key is part of the contract: "#r=" must carry a t:'r' envelope.
        if (env.t !== tk.key) throw new Error('invalid-token');
        addShare(acc, parseEnvelope(env));
      } catch (e) {
        acc.problems.push(pasteProblemOf(e));
      }
    }
    return acc;
  }
  const candidates = parts && parts.length > 1 ? parts : [text];
  for (const part of candidates) for (const value of jsonCandidates(part)) collectJson(value, acc);
  return acc;
}

// --- The summary line under a paste box -----------------------------------------------------------

/** What a paste box found, for its one-line label and its buttons. */
export interface PasteSummary {
  /** The classification, upgraded where the content said more (JSON with recipes → 'bundle', a website text nothing could be read from → 'unknown'). */
  kind: PasteKind;
  classification: PasteClassification;
  /** The one line under the box; empty for an empty box. */
  label: string;
  /** Names on the member cards among the tokens (kind 'member' or 'tokens'). */
  memberNames: string[];
  /** Recipe / plan / bundle tokens (not member cards). */
  shareTokens: number;
  /** Decoding problems (invalid code, newer version …). */
  problems: string[];
}

/** True for a kind the Inbox's import preview handles (share links, a bundle, member cards). */
export function isInboxKind(kind: PasteKind): boolean {
  return kind === 'tokens' || kind === 'bundle' || kind === 'member';
}

/** True for a kind the editor fills in from. */
export function isRecipeKind(kind: PasteKind): boolean {
  return kind === 'website' || kind === 'ai';
}

/** "Kaartje van Noor" / "2 kaartjes" for the member cards in a text. */
function membersLabel(names: string[]): string {
  if (names.length === 1) return t('paste.card', { name: names[0] as string });
  return t('paste.cards', { n: names.length });
}

/**
 * Classifies a pasted text and builds the line that says what it is. Decodes tokens (async) so a
 * member card can be named and a bundle counted; a JSON text nothing was found in stays 'unknown'.
 */
export async function summarizePaste(text: string): Promise<PasteSummary> {
  const classification = classifyPaste(text);
  const out: PasteSummary = { kind: classification.kind, classification, label: '', memberNames: [], shareTokens: 0, problems: [] };
  switch (classification.kind) {
    case 'empty':
      return out;
    case 'tokens':
    case 'member': {
      const tokens = extractTokens(classification.normalized);
      out.shareTokens = tokens.filter((tk) => tk.key !== 'f').length;
      const got = await collectPaste(text, null);
      out.memberNames = got.members.map((m) => m.name);
      out.problems = got.problems;
      const parts: string[] = [];
      if (out.shareTokens === 1) parts.push(t('paste.link'));
      else if (out.shareTokens > 1) parts.push(t('paste.links', { n: out.shareTokens }));
      if (out.memberNames.length) parts.push(membersLabel(out.memberNames));
      if (!parts.length) parts.push(out.problems[0] ?? t('inbox.invalid'));
      out.label = parts.join(' · ');
      return out;
    }
    case 'bundle':
    case 'unknown': {
      // A bundle, or JSON the classifier did not know (a bare recipe, a patch, an old export).
      if (classification.kind === 'bundle' || looksLikeJson(text)) {
        const got = await collectPaste(text, null);
        out.problems = got.problems;
        out.memberNames = got.members.map((m) => m.name);
        const recipes = got.share.recipes.length;
        const patches = got.share.patches.length;
        if (recipes || patches || got.plan || got.share.dict.ing.length || out.memberNames.length) {
          out.kind = out.memberNames.length && !recipes && !patches && !got.plan ? 'member' : 'bundle';
          const parts: string[] = [];
          if (recipes) parts.push(recipes === 1 ? t('inbox.foundRecipe') : t('inbox.foundRecipes', { n: recipes }));
          if (patches) parts.push(patches === 1 ? t('inbox.foundPatch') : t('inbox.foundPatches', { n: patches }));
          if (got.plan) parts.push(t('paste.plan'));
          if (!recipes && !patches && !got.plan && got.share.dict.ing.length) parts.push(t('inbox.dictAddN', { n: got.share.dict.ing.length }));
          if (out.memberNames.length) parts.push(membersLabel(out.memberNames));
          out.label = t('paste.bundle', { what: parts.join(' · ') });
          return out;
        }
        if (out.problems.length) {
          out.kind = 'bundle';
          out.label = out.problems[0] as string;
          return out;
        }
      }
      out.kind = 'unknown';
      out.label = t('paste.unknown');
      return out;
    }
    case 'website': {
      const w = parseWebsiteRecipe(classification.normalized);
      if (!w || (!w.name && w.ingredients.length === 0 && w.steps.length === 0)) {
        out.kind = 'unknown';
        out.label = t('paste.unknown');
        return out;
      }
      out.label = t('paste.website', { lines: w.ingredients.length, steps: w.steps.length });
      if (w.confidence === 'low') out.label += ' · ' + t('paste.websiteLow');
      return out;
    }
    case 'ai':
      out.label = t('paste.ai');
      return out;
    default:
      return out;
  }
}

// --- Hand-off between screens ----------------------------------------------------------------------

export type PasteTarget = 'inbox' | 'add' | 'household';

/**
 * Hands a pasted text to the screen that acts on it and goes there: the Inbox (share links, a
 * bundle: its import preview with statuses, Importeer and Maak ongedaan), the Household (member
 * cards), or the editor ('/add'), which fills the form in straight away for a 'website' / 'ai'
 * text and otherwise leaves the text in its paste box for "Vul in".
 */
export function openPasteIn(target: PasteTarget, text: string, kind: PasteKind): void {
  switch (target) {
    case 'inbox':
      pendingImport.value = text;
      navigate('/inbox');
      return;
    case 'household':
      pendingMemberText.value = text;
      navigate('/more/household');
      return;
    case 'add':
      pendingImportText.value = text;
      pendingImportKind.value = kind;
      navigate('/add');
      return;
    default:
      return;
  }
}

/**
 * A chosen file or a text from elsewhere, routed the way a paste is: share links / a bundle /
 * cards → the Inbox, everything else → the editor (a website text or AI answer is filled in on
 * arrival). Returns false for an empty text (the caller says so).
 */
export function openPastedText(text: string): boolean {
  if (!text.trim()) return false;
  const c = classifyPaste(text);
  if (c.kind === 'empty') return false;
  // `fileHasRecipes` also knows a bare recipe / patch / old export JSON the classifier calls 'unknown'.
  if (isInboxKind(c.kind) || fileHasRecipes(text)) openPasteIn('inbox', text, c.kind);
  else openPasteIn('add', text, c.kind);
  return true;
}
