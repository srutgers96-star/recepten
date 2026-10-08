// Lenient reader/writer for recipes in every shape the app has ever produced (docs/phase-1-spec.md
// §1): a schema-2 recipe (unknown keys kept), the phase-0 share payload, the phase-0 Dexie record
// and a plain {name, ingredients, instructions}. Framework-free: used by the app, the Safari landing
// bundle, the Node tools and the tests.
import { newUserId, nowIso, pickText, type Line, type Origin, type OriginKind, type Recipe, type Step, type Text, type TimerSpec } from './model.ts';
import { splitSteps } from './steps.ts';
import { findTimers } from './timers.ts';
import type { Envelope } from './token.ts';

type Dict = Record<string, unknown>;

function isRecord(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.replace(/\r\n?/g, '\n').trim() : undefined;
}

/** {nl, en} from a Text-like object or a plain string (taken as Dutch). Null when both are empty. */
function readText(v: unknown): Text | null {
  if (typeof v === 'string') {
    const s = cleanString(v);
    return s === undefined ? null : { nl: s };
  }
  if (!isRecord(v)) return null;
  const out: Text = {};
  const nl = cleanString(v.nl);
  const en = cleanString(v.en);
  if (nl !== undefined) out.nl = nl;
  if (en !== undefined) out.en = en;
  return nl === undefined && en === undefined ? null : out;
}

function isText(v: unknown): boolean {
  return isRecord(v) && (typeof v.nl === 'string' || typeof v.en === 'string');
}

/** Ingredient line from a string or a Line-like object. Empty lines are dropped (null). */
function readLine(v: unknown): Line | null {
  if (typeof v === 'string') {
    const raw = cleanString(v);
    if (raw === undefined) return null;
    return lineFromRaw({ nl: raw });
  }
  if (!isRecord(v)) return null;
  const raw = readText(v.raw);
  if (!raw) return null;
  const line: Line = { ...(v as object), raw } as Line;
  const kind = v.kind === 'header' || v.kind === 'line' ? v.kind : undefined;
  if (kind) line.kind = kind;
  else {
    delete (line as unknown as Dict).kind;
    if (isHeader(raw)) line.kind = 'header';
  }
  return line;
}

function isHeader(raw: Text): boolean {
  const s = pickText(raw, 'nl');
  return /:\s*$/.test(s);
}

function lineFromRaw(raw: Text): Line {
  return isHeader(raw) ? { raw, kind: 'header' } : { raw };
}

function readTimer(v: unknown): TimerSpec | null {
  if (!isRecord(v)) return null;
  const min = typeof v.min === 'number' && Number.isFinite(v.min) && v.min > 0 ? v.min : null;
  const unit = v.unit === 'sec' || v.unit === 'min' || v.unit === 'hour' ? v.unit : null;
  if (min === null || unit === null) return null;
  const t: TimerSpec = { min, unit };
  if (typeof v.max === 'number' && Number.isFinite(v.max) && v.max > min) t.max = v.max;
  if (typeof v.label === 'string' && v.label.trim()) t.label = v.label;
  return t;
}

/** Step from a string or a Step-like object; timers are derived from the text when missing. */
function readStep(v: unknown): Step | null {
  let step: Step;
  if (typeof v === 'string') {
    const text = readText(v);
    if (!text) return null;
    step = { text };
  } else {
    if (!isRecord(v)) return null;
    const text = readText(v.text);
    if (!text) return null;
    step = { ...(v as object), text } as Step;
    if (Array.isArray(v.timers)) {
      step.timers = v.timers.map(readTimer).filter((t): t is TimerSpec => t !== null);
    } else {
      delete (step as unknown as Dict).timers;
    }
  }
  if (!step.timers) {
    const timers = findTimers(pickText(step.text, 'nl'));
    if (timers.length) step.timers = timers;
  }
  return step;
}

/** Steps from instruction text in one or two languages: paired by index. */
function stepsFromInstructions(nl: string | undefined, en: string | undefined): Step[] {
  const nlSteps = nl ? splitSteps(nl) : [];
  const enSteps = en ? splitSteps(en) : [];
  const count = Math.max(nlSteps.length, enSteps.length);
  const out: Step[] = [];
  for (let i = 0; i < count; i++) {
    const text: Text = {};
    if (nlSteps[i]) text.nl = nlSteps[i];
    if (enSteps[i]) text.en = enSteps[i];
    const step: Step = { text };
    const timers = findTimers(pickText(text, 'nl'));
    if (timers.length) step.timers = timers;
    out.push(step);
  }
  return out;
}

function readOrigin(v: unknown, fallback: Origin): Origin {
  if (!isRecord(v)) return fallback;
  const kind: OriginKind = v.kind === 'builtin' || v.kind === 'user' || v.kind === 'received' ? v.kind : fallback.kind;
  const origin: Origin = { ...(v as object), kind } as Origin;
  for (const key of ['author', 'receivedFrom', 'receivedAt', 'basedOn'] as const) {
    const val = v[key];
    if (typeof val === 'string' && val.trim()) origin[key] = val;
    else if (val === null) origin[key] = null;
    else delete (origin as unknown as Dict)[key];
  }
  return origin;
}

function readStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()) : [];
}

function readServings(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 4;
}

function readIso(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  return Number.isNaN(new Date(v).getTime()) ? undefined : v;
}

function readOptionalText(v: unknown): Text | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return readText(v);
}

/**
 * Any recipe shape -> a full schema-2 Recipe, or null when there is no usable name.
 * A missing id becomes a fresh `u:` id; a missing origin becomes {kind: 'user'}. Unknown keys of a
 * schema-2 input (and of its lines and steps) are preserved.
 */
export function normalizeRecipe(input: unknown): Recipe | null {
  if (!isRecord(input)) return null;
  const o = input;
  const now = nowIso();

  // Shape 1: schema-2 (also a partially filled one).
  if (o.schema === 2 || (isText(o.name) && Array.isArray(o.lines))) {
    const name = readText(o.name);
    if (!name) return null;
    const lines = (Array.isArray(o.lines) ? o.lines : []).map(readLine).filter((l): l is Line => l !== null);
    const steps = (Array.isArray(o.steps) ? o.steps : []).map(readStep).filter((s): s is Step => s !== null);
    const createdAt = readIso(o.createdAt) ?? now;
    const recipe: Recipe = {
      ...(o as object),
      schema: 2,
      id: cleanString(o.id) ?? newUserId(),
      rev: typeof o.rev === 'number' && Number.isInteger(o.rev) && o.rev > 0 ? o.rev : 1,
      createdAt,
      updatedAt: readIso(o.updatedAt) ?? createdAt,
      origin: readOrigin(o.origin, { kind: 'user' }),
      name,
      tags: readStringArray(o.tags),
      servings: readServings(o.servings),
      lines,
      steps,
      goesWith: readStringArray(o.goesWith),
      aliases: readStringArray(o.aliases),
    };
    for (const key of ['description', 'servingTip'] as const) {
      const t = readOptionalText(o[key]);
      if (t === undefined) delete (recipe as Dict)[key];
      else recipe[key] = t;
    }
    if (o.category === undefined) delete (recipe as Dict).category;
    else recipe.category = typeof o.category === 'string' && o.category.trim() ? o.category : null;
    if (o.time === undefined) delete (recipe as Dict).time;
    else recipe.time = readTime(o.time);
    if (o.text === undefined) delete (recipe as Dict).text;
    else recipe.text = readTextMeta(o.text);
    // Block F.2: `variantOf` (the original of a diet variant) is a recipe id or null; anything else
    // that arrived through a token or a file is dropped rather than stored.
    if (o.variantOf !== undefined && o.variantOf !== null && !(typeof o.variantOf === 'string' && o.variantOf.trim())) delete (recipe as Dict).variantOf;
    return recipe;
  }

  // Shapes 2-4: the phase-0 share payload ({name:{nl,en?}, ingredients, instructions:{nl,en?}}),
  // the phase-0 Dexie record ({name, nameEn?, ingredients, instructions, instructionsEn?, origin, by?})
  // and the plain {name, ingredients, instructions}.
  const name = readText(o.name);
  if (!name) return null;
  const nameEn = cleanString(o.nameEn);
  if (nameEn !== undefined && name.en === undefined) name.en = nameEn;

  const rawLines = Array.isArray(o.ingredients) ? o.ingredients : Array.isArray(o.lines) ? o.lines : [];
  const lines = rawLines.map(readLine).filter((l): l is Line => l !== null);

  const instr = readText(o.instructions);
  const instrEn = cleanString(o.instructionsEn) ?? instr?.en;
  const steps = stepsFromInstructions(instr?.nl, instrEn);

  const legacyKind = o.origin === 'received' ? 'received' : 'user';
  const by = cleanString(o.by);
  const origin: Origin = isRecord(o.origin) ? readOrigin(o.origin, { kind: 'user' }) : { kind: legacyKind };
  if (legacyKind === 'received' && by !== undefined && !origin.receivedFrom) origin.receivedFrom = by;
  if (legacyKind === 'user' && by !== undefined && !origin.author) origin.author = by;

  const createdAt = readIso(o.createdAt) ?? now;
  return {
    schema: 2,
    id: cleanString(o.id) ?? newUserId(),
    rev: 1,
    createdAt,
    updatedAt: readIso(o.updatedAt) ?? createdAt,
    origin,
    name,
    tags: readStringArray(o.tags),
    servings: readServings(o.servings),
    lines,
    steps,
    goesWith: readStringArray(o.goesWith),
    aliases: readStringArray(o.aliases),
  };
}

function readTime(v: unknown): Recipe['time'] {
  if (!isRecord(v)) return null;
  const out: { active?: number; total?: number } = {};
  if (typeof v.active === 'number' && Number.isFinite(v.active) && v.active >= 0) out.active = v.active;
  if (typeof v.total === 'number' && Number.isFinite(v.total) && v.total >= 0) out.total = v.total;
  return out.active === undefined && out.total === undefined ? null : out;
}

function readTextMeta(v: unknown): Recipe['text'] {
  if (!isRecord(v)) return null;
  const out: NonNullable<Recipe['text']> = {};
  if (v.en === 'llm' || v.en === 'human' || v.en === 'none') out.en = v.en;
  if (typeof v.reviewedBy === 'string' && v.reviewedBy.trim()) out.reviewedBy = v.reviewedBy;
  return out;
}

/** Whitespace-collapsed, lowercased key for comparing texts. */
function key(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 32-bit FNV-1a as 8 hex chars. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Hash of name (nl|en) + the sorted raw lines: "already present" when it matches, stable across
 * round-trips and independent of id, timestamps and steps. */
export function recipeFingerprint(r: Recipe): string {
  const lines = r.lines
    .map((l) => key(l.raw.nl) + '|' + key(l.raw.en))
    .sort();
  return fnv1a([key(r.name.nl), key(r.name.en), ...lines].join('\n'));
}

/** The share envelope for one recipe: {v: 2, t: 'r', by?, at, r}. */
export function recipeToShareEnvelope(r: Recipe, by?: string): Envelope {
  const env: Envelope = { v: 2, t: 'r', at: nowIso(), r };
  const sender = (by ?? '').trim();
  if (sender) env.by = sender;
  return env;
}

/** The recipe inside a t:'r' envelope (any payload shape), with the sender recorded in `origin`;
 * null when the envelope is not a recipe. */
export function recipeFromEnvelope(env: Envelope): Recipe | null {
  if (!env || env.t !== 'r') return null;
  const recipe = normalizeRecipe(env.r);
  if (!recipe) return null;
  const by = typeof env.by === 'string' && env.by.trim() ? env.by.trim() : null;
  const at = typeof env.at === 'string' && env.at.trim() ? env.at : null;
  if (recipe.origin.kind !== 'builtin') {
    recipe.origin = { ...recipe.origin, kind: 'received', receivedFrom: by, receivedAt: at };
  }
  return recipe;
}
