// Record types of the database. Types only (no runtime imports), so landing.ts can use them too.
// The recipe domain types live in src/domain/model.ts and are re-exported here for the UI.
export type {
  CookLogEntry,
  Favorite,
  Lang,
  Line,
  Note,
  Origin,
  OriginKind,
  Profile,
  Recipe,
  RunningTimer,
  Step,
  Text,
  TimerSpec,
} from '@/domain/model';
export type { Ingredient } from '@/domain/dictionary';
export type { AppliedOverride, LineOverride, RecipeOverride, RecipePatch, RecipePatchKey } from '@/domain/overrides';
export type { Plan, PlanItem } from '@/domain/planner';
export type { ListItem, ListSection, ListSource } from '@/domain/aggregate';
import type { CookLogEntry, Favorite, Note, Profile, Recipe } from '@/domain/model';
import type { Ingredient } from '@/domain/dictionary';
import type { LineOverride, RecipeOverride } from '@/domain/overrides';
import type { Plan } from '@/domain/planner';
import type { ListItem } from '@/domain/aggregate';

export interface Setting {
  key: string;
  value: unknown;
}

/** The one row of `lists` (phase 4, docs/phase-4-spec.md §2): the shopping list generated from the plan. */
export interface List {
  id: 'current';
  /** All items (main, staples, in-house, check), as `aggregate` returned them plus the user's state. */
  items: ListItem[];
  /** `planHash` of the plan the list was generated from ('' = no dishes); ≠ the current hash means stale. */
  generatedFrom: string;
  /** `planHashAll` (cooked dishes included) at generation; when it still matches, only cooked flags changed and the list is not stale. Absent on older rows. */
  generatedFromAll?: string;
  generatedAt: string;
  /** Manual items ("+ wc-papier, melk"); also present in `items`. */
  extras: ListItem[];
  /** Keys pinned with "elke week"; those items survive a regeneration. */
  pinned: string[];
  updatedAt: string;
  /** ISO of the last "Deel lijst"; `updatedAt > sharedAt` = "gewijzigd sinds delen". */
  sharedAt?: string | null;
}

export type ShoppingList = List;

/** One row of `pantry`: an ingredient "in huis" (Heb ik al), optionally until a date (21 days for non-perishables). */
export interface PantryItem {
  ing: string;
  until?: string;
}

/**
 * One row of `photos` (phase 5 block D): an own photo of a cooked dish, re-encoded on the phone
 * (longest edge ≤ 1024 px, WebP or JPEG) BEFORE it is stored, so the blob stays small. Photos
 * never travel in share tokens; backups carry them only on request (BackupBundle.photos).
 */
export interface Photo {
  id?: number;
  recipeId: string;
  /** Household member who took it (a local member's id IS the profile id). */
  memberId: string;
  blob: Blob;
  /** ISO timestamp; recipeId+at identifies a photo across backups (restore dedupe). */
  at: string;
}

/** A photo as it travels in a backup file: the blob base64-encoded, its MIME type kept. */
export interface BundledPhoto {
  recipeId: string;
  memberId: string;
  at: string;
  /** MIME type of the decoded blob (image/webp or image/jpeg). */
  type: string;
  /** base64 (standard alphabet) of the blob's bytes. */
  data: string;
}

/** The rows an import replaced, as they were before it (phase 3 undo). Absent rows were added. */
export interface ImportBefore {
  recipes: Recipe[];
  overrides: RecipeOverride[];
  lineOverrides: LineOverride[];
  userIngredients: Ingredient[];
  /** Received ids the import dropped from 'inbox.seenIds' (re-badged as unseen); undo puts them back. */
  seenIds?: string[];
}

/** The keys an import wrote (put or, for `clearedLineOverrides`, deleted), so undo knows what to remove. */
export interface ImportWrote {
  recipes: string[];
  overrides: string[];
  lineOverrides: Array<[string, number]>;
  userIngredients: string[];
}

/** One row of the `imports` table: what an import changed, with the previous versions for undo. */
export interface ImportSnapshot {
  id?: number;
  at: string;
  from: string;
  added: string[];
  updated: string[];
  skipped: string[];
  /** Ids of the copies a "both" choice made (phase 3). */
  copies?: string[];
  /** The recipes as they were before this import overwrote them (only the updated ones). */
  previous: Recipe[];
  /** Phase 3: everything the import replaced, for an exact undo. Absent in phase-1 snapshots. */
  before?: ImportBefore;
  wrote?: ImportWrote;
  /** True once "Maak deze import ongedaan" restored it. */
  undone?: boolean;
}

/** The backup file (Meer → Opslag & back-up). Envelope key `t: 'b'` like the share tokens. */
export interface BackupBundle {
  v: 2;
  t: 'b';
  at: string;
  app: 'recepten';
  profiles: Profile[];
  userRecipes: Recipe[];
  favorites: Favorite[];
  notes: Note[];
  cookLog: CookLogEntry[];
  settings: Setting[];
  /** Phase 2 (schema v4 tables); absent in older backups. */
  lineOverrides?: LineOverride[];
  userIngredients?: Ingredient[];
  overrides?: RecipeOverride[];
  /** Phase 4 (schema v5 tables); absent in older backups. */
  plans?: Plan[];
  lists?: List[];
  pantry?: PantryItem[];
  /** Phase 5 block D: only present when the backup was made WITH photos (default is without). */
  photos?: BundledPhoto[];
}

// --- Phase-0 shape, only read by the v1 -> v2 upgrade in db.ts ---------------------------------

export type RecipeOrigin = 'own' | 'received';

/** The phase-0 Dexie record (schema v1). Accepted by normalizeRecipe; the v1 -> v2 upgrade
 * converts stored rows into schema-2 recipes. */
export interface UserRecipe {
  id?: number;
  name: string;
  nameEn?: string;
  ingredients: string[];
  instructions: string;
  instructionsEn?: string;
  servings?: number;
  origin: RecipeOrigin;
  /** Sender's profile name for received recipes. */
  by?: string;
  /** ISO timestamp. */
  createdAt: string;
}
