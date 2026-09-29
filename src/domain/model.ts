// Schema-2 domain model (docs/phase-1-spec.md §1). Framework-free: no preact, no dexie; runs in
// Node (tools, tests), in the app and in the Safari landing bundle. Every human-readable field is a
// `Text` ({nl, en}); either side may be empty (CLAUDE.md invariant 3). Ids never change (invariant 1).
import { slugId } from './recipe-source.ts';

export type Lang = 'nl' | 'en';

/** Every human-readable field. Either language may be missing. */
export interface Text {
  nl?: string;
  en?: string;
}

export type OriginKind = 'builtin' | 'user' | 'received';

export interface Origin {
  kind: OriginKind;
  /** Name of the person who wrote the recipe (own recipes: the active profile). */
  author?: string | null;
  /** Sender name for received recipes. */
  receivedFrom?: string | null;
  /** ISO timestamp of the import for received recipes. */
  receivedAt?: string | null;
  /** Id of the recipe this one was copied from ("Maak eigen kopie"). */
  basedOn?: string | null;
}

/** A parsed quantity: "2-3" -> {min: 2, max: 3}; "ca. 400" -> {min: 400, approx: true}. */
export interface Qty {
  min: number;
  max?: number;
  approx?: boolean;
}

/**
 * The part of an ingredient a line asks for: "sap van ½ limoen" -> 'sap', "het wit van 1 prei" ->
 * 'wit', "het geel van 2 eieren" -> 'geel', "blaadjes van 2 takjes tijm" -> 'blaadjes'.
 * 'rasp-en-sap' covers "rasp en sap van 1 citroen" (both zest and juice) so no information is lost.
 */
export type LinePart = 'sap' | 'rasp' | 'rasp-en-sap' | 'wit' | 'geel' | 'blaadjes';

/**
 * One ingredient line (docs/phase-2-spec.md §2). `raw` is the source of truth and is never removed
 * (CLAUDE.md invariant 2); everything else is derived by `parseLine` (src/domain/parser.ts) or set
 * by the translation pass / a user correction, and re-parsing re-reads `raw`.
 */
export interface Line {
  /** The original line, never removed. */
  raw: Text;
  /** 'header' for group headers such as "Dressing:"; default 'line'. */
  kind?: 'line' | 'header';
  /** Parsed quantity; null = the line has no quantity ("zout en peper"). */
  qty?: Qty | null;
  /** units.json id; null = counted pieces (the ingredient's defaultUnit) or no unit at all. */
  unit?: string | null;
  /** ingredients.json id; null = free text, not resolved in the dictionary. */
  ing?: string | null;
  /**
   * The name part of the line as written (quantity, unit, qualifiers, part, prep and parentheses
   * stripped; original casing kept): what the dictionary could not resolve when `ing` is null, and
   * what "Koppel ingrediënt" / the dictionary agents work from. Also filled when `ing` resolved.
   */
  name?: string;
  /** qualifiers.json ids in the order they were written ("rode", "grote", "verse"). */
  qual?: string[];
  /** "sap van ½ limoen" -> 'sap'. See LinePart. */
  part?: LinePart | null;
  /** From [brackets]: "fijngehakt" -> {nl: "fijngehakt", en: "finely chopped"} (prep-phrases.json). */
  prep?: Text | null;
  /** From (parentheses) that are not alternatives or pack sizes: "(ontdooid)", "(blokje)". */
  note?: Text | null;
  /** "(400 g)", "van 150 g" -> "400 g" / "150 g". Never scaled. */
  packSize?: string | null;
  /** Alternatives: "(of kabeljauw)" -> alt: [{ing: 'kabeljauw'}], altMode 'or'; "en/of" -> 'and-or'. */
  alt?: Line[];
  altMode?: 'or' | 'and-or';
  /** "naar smaak", "(garnering)", "evt.", "optioneel". */
  optional?: boolean;
  role?: 'main' | 'garnish';
  /** 0-1: how much of the line was resolved; the UI shows a hint below 0.6. */
  confidence?: number;
  /** Unknown keys are preserved on round-trip (PLAN.md §5). */
  [k: string]: unknown;
}

/** A duration as found in the step text ("25-30 minuten" -> {min: 25, max: 30, unit: 'min'}). */
export interface TimerSpec {
  min: number;
  max?: number;
  unit: 'sec' | 'min' | 'hour';
  /** The text the timer was found in, e.g. "25-30 minuten". */
  label?: string;
}

export interface Step {
  text: Text;
  timers?: TimerSpec[];
}

export interface Recipe {
  schema: 2;
  id: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  origin: Origin;
  name: Text;
  description?: Text | null;
  category?: string | null;
  tags: string[];
  /** Classics: 4. */
  servings: number;
  time?: { active?: number; total?: number } | null;
  lines: Line[];
  steps: Step[];
  servingTip?: Text | null;
  /** Ids of side dishes / main dishes that go with this one ("Naanbrood (voor bij dahl)"). */
  goesWith: string[];
  aliases: string[];
  text?: { en?: 'llm' | 'human' | 'none'; reviewedBy?: string } | null;
  /**
   * Receiver-side bookkeeping of a received recipe (docs/phase-3-spec.md §2): what was last
   * received from the sender. `rev === sync.receivedRev` means "untouched since receipt", so a
   * newer version from the sender may replace it without a conflict. `saveUserRecipe` leaves
   * it alone; it never travels in a share token (the receiver sets its own).
   */
  sync?: RecipeSync;
  /** Unknown keys are preserved on round-trip (PLAN.md §5). */
  [k: string]: unknown;
}

export interface RecipeSync {
  /** The sender's `rev` of the version last received. */
  receivedRev?: number;
  /** ISO timestamp of that import. */
  receivedAt?: string;
  /** `recipeFingerprint` of the version last received (the same version arriving again = "present"). */
  receivedFingerprint?: string;
}

export interface Profile {
  id: string;
  name: string;
  lang: Lang;
  color: string;
  createdAt: string;
}

export interface Favorite {
  recipeId: string;
  profileId: string;
  at: string;
}

export interface Note {
  recipeId: string;
  profileId: string;
  text: string;
  updatedAt: string;
}

export interface CookLogEntry {
  id?: number;
  recipeId: string;
  profileId: string;
  at: string;
  stars?: number | null;
  note?: string | null;
}

/** A timer that is running right now; persisted so it survives a reload. Times are epoch ms. */
export interface RunningTimer {
  id: string;
  recipeId?: string | null;
  stepIndex?: number | null;
  label: string;
  /** Wall clock; −1/+1 min moves this. */
  endAt: number;
  /** The duration the timer was started with; immutable (step chips match on it). */
  durationMs: number;
  createdAt: number;
}

/** Text in the active language, else the other language, else ''. */
export function pickText(t: Text | null | undefined, lang: Lang): string {
  if (!t) return '';
  const own = t[lang];
  if (typeof own === 'string' && own.trim() !== '') return own;
  const other = t[lang === 'nl' ? 'en' : 'nl'];
  return typeof other === 'string' && other.trim() !== '' ? other : '';
}

/** True when the text has a non-empty value in that language. */
export function hasLang(t: Text | null | undefined, lang: Lang): boolean {
  return !!t && typeof t[lang] === 'string' && (t[lang] as string).trim() !== '';
}

/** Id of a built-in classic: 'b:' + slug of the Dutch name. Stable forever. */
export function builtinId(nameNl: string): string {
  return 'b:' + slugId(nameNl);
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `prefix` + 8 random chars [a-z0-9] from crypto.getRandomValues (Node 22 and browsers). */
export function randomId(prefix: string, length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = prefix;
  for (let i = 0; i < length; i++) out += ID_ALPHABET[(bytes[i] as number) % ID_ALPHABET.length];
  return out;
}

/** Id of a user or received recipe: 'u:' + 8 chars [a-z0-9]. */
export function newUserId(): string {
  return randomId('u:');
}

/** Id of a profile: 'p:' + 8 chars [a-z0-9]. */
export function newProfileId(): string {
  return randomId('p:');
}

export function nowIso(): string {
  return new Date().toISOString();
}
