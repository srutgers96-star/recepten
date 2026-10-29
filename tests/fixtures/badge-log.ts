// Small cook-log fixture for the badges (docs/specs/badges-avatar.md §6b): 40 entries from
// November 2025 to February 2026, two members, and the moments the special badges look for:
// a 1-star cook that is cooked again later (Anna, curry), Christmas cooks (both), a cook in the
// night (Bram, 01:30), three days running the same recipe (Bram, soup), one full ISO week (Anna,
// 5–11 January 2026), a Friday the 13th (Bram) and a backdated day (12:00:00.000 local, the marker
// of cookedAtForDay in src/cooklog.ts). Times are LOCAL (built with `new Date(y, m, d, h, min)`),
// so the expectations hold in every timezone. Never change an entry: tests pin results on it.
import type { CookLogEntry, Recipe } from '../../src/domain/model';

export const ANNA = 'p:anna0001';
export const BRAM = 'p:bram0001';

function recipe(id: string, nameNl: string, over: Partial<Recipe>): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    origin: { kind: 'builtin' },
    name: { nl: nameNl },
    tags: [],
    servings: 4,
    lines: [],
    steps: [],
    goesWith: [],
    aliases: [],
    ...over,
  };
}

const line = (ing: string) => ({ raw: { nl: ing }, ing });

/** The four classics the log cooks (synthetic, with category, tags, cuisine and ingredient ids). */
export const BADGE_LOG_RECIPES: readonly Recipe[] = [
  recipe('b:stamppot', 'Stamppot boerenkool', { category: 'stamppot', cuisine: 'hollands', tags: ['winter'], lines: [line('ui'), line('boter')] }),
  recipe('b:pasta', 'Pasta pomodoro', { category: 'pasta', cuisine: 'italiaans', tags: ['snel'], lines: [line('knoflook'), line('tomaat'), line('kaas')] }),
  recipe('b:soep', 'Groentesoep', { category: 'soep', cuisine: 'hollands', tags: ['vegetarisch', 'winter'], lines: [line('ui'), line('wortel')] }),
  recipe('b:curry', 'Kip-curry', { category: 'rijst', cuisine: 'indiaas', tags: ['wereld'], lines: [line('knoflook'), line('gember'), line('ui')] }),
] as Recipe[];

/** One cook at a LOCAL moment (month 1–12). */
function cook(profileId: string, recipeId: string, y: number, m: number, d: number, h: number, min: number, stars?: number): CookLogEntry {
  const at = new Date(y, m - 1, d, h, min, 0, 0).toISOString();
  return { recipeId, profileId, at, ...(stars === undefined ? {} : { stars }) };
}

export const BADGE_LOG: readonly CookLogEntry[] = [
  // ---- Anna (20)
  cook(ANNA, 'b:stamppot', 2025, 11, 3, 18, 30),
  cook(ANNA, 'b:curry', 2025, 11, 10, 19, 0, 1), // one star …
  cook(ANNA, 'b:curry', 2025, 11, 24, 18, 45, 4), // … and cooked again: Tweede kans
  cook(ANNA, 'b:pasta', 2025, 12, 1, 18, 0, 5),
  cook(ANNA, 'b:pasta', 2025, 12, 5, 18, 0), // Sinterklaas
  cook(ANNA, 'b:stamppot', 2025, 12, 25, 17, 30), // Christmas
  cook(ANNA, 'b:soep', 2025, 12, 31, 19, 0), // New Year's Eve
  // the full ISO week, Monday 5 … Sunday 11 January 2026
  cook(ANNA, 'b:stamppot', 2026, 1, 5, 18, 0),
  cook(ANNA, 'b:pasta', 2026, 1, 6, 18, 0),
  cook(ANNA, 'b:soep', 2026, 1, 7, 18, 0),
  cook(ANNA, 'b:curry', 2026, 1, 8, 18, 0),
  cook(ANNA, 'b:stamppot', 2026, 1, 9, 18, 0),
  cook(ANNA, 'b:pasta', 2026, 1, 10, 18, 0),
  cook(ANNA, 'b:soep', 2026, 1, 11, 18, 0),
  cook(ANNA, 'b:curry', 2026, 1, 19, 18, 0),
  cook(ANNA, 'b:pasta', 2026, 1, 26, 18, 0),
  cook(ANNA, 'b:stamppot', 2026, 2, 2, 18, 0),
  cook(ANNA, 'b:soep', 2026, 2, 9, 18, 0),
  cook(ANNA, 'b:pasta', 2026, 2, 14, 19, 0), // Valentine's Day
  cook(ANNA, 'b:curry', 2026, 2, 23, 18, 0),
  // ---- Bram (20)
  cook(BRAM, 'b:pasta', 2025, 11, 4, 19, 0),
  cook(BRAM, 'b:soep', 2025, 11, 17, 18, 30), // three days running …
  cook(BRAM, 'b:soep', 2025, 11, 18, 18, 30),
  cook(BRAM, 'b:soep', 2025, 11, 19, 18, 30), // … Drie op een rij
  cook(BRAM, 'b:curry', 2025, 11, 26, 18, 0),
  cook(BRAM, 'b:stamppot', 2025, 12, 3, 18, 0),
  cook(BRAM, 'b:pasta', 2025, 12, 10, 18, 0),
  cook(BRAM, 'b:curry', 2025, 12, 17, 18, 0),
  cook(BRAM, 'b:stamppot', 2025, 12, 24, 18, 0), // Christmas Eve
  cook(BRAM, 'b:soep', 2026, 1, 7, 18, 0),
  cook(BRAM, 'b:pasta', 2026, 1, 14, 18, 0),
  cook(BRAM, 'b:curry', 2026, 1, 21, 18, 0),
  cook(BRAM, 'b:stamppot', 2026, 1, 28, 18, 0),
  cook(BRAM, 'b:pasta', 2026, 2, 6, 1, 30), // in the night: Nachtbraker
  cook(BRAM, 'b:soep', 2026, 2, 13, 18, 0), // Friday the 13th
  cook(BRAM, 'b:curry', 2026, 2, 20, 18, 0),
  cook(BRAM, 'b:stamppot', 2026, 2, 21, 12, 0), // backdated day: exactly 12:00:00.000 local
  cook(BRAM, 'b:pasta', 2026, 2, 22, 18, 0),
  cook(BRAM, 'b:soep', 2026, 2, 24, 18, 0),
  cook(BRAM, 'b:curry', 2026, 2, 25, 18, 0),
];
