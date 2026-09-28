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
import type { CookLogEntry, Favorite, Note, Profile, Recipe } from '@/domain/model';

export interface Setting {
  key: string;
  value: unknown;
}

/** One row of the `imports` table: what an import changed, with the previous versions for undo. */
export interface ImportSnapshot {
  id?: number;
  at: string;
  from: string;
  added: string[];
  updated: string[];
  skipped: string[];
  /** The recipes as they were before this import overwrote them (only the updated ones). */
  previous: Recipe[];
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
