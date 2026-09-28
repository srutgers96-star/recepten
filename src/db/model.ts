// Record types for the phase-0 database. Types only — no imports, so landing.ts can use them too.

export type RecipeOrigin = 'own' | 'received';

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

export interface Setting {
  key: string;
  value: unknown;
}

/** Payload of a t:'r' envelope in phase 0 (a subset of the schema-2 recipe from PLAN.md §5). */
export interface SharedRecipe {
  name: { nl: string; en?: string };
  servings?: number;
  ingredients: string[];
  instructions: { nl: string; en?: string };
}
