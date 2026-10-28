// The 30-year cooking simulation of docs/specs/xp-levels.md §6a, literally as specified. It feeds the
// level-claim pins and the deriveXp performance test in tests/xp.test.ts.
//
// Order per day matters for the pins: first the holiday and skip tests (`continue`), only then
// `if (d % 37 === 0) pool++`, so the pool grows on cooking days only.
import { hash32, type XpCookFact, type XpFacts, type XpPhotoFact, type XpRecipeFact } from '../../src/domain/xp';

export interface SimOptions {
  years: number;
  holidaysPerYear?: number;
  holidayDays?: number;
  skipEvery?: number;
}

const LINES = [5, 7, 9, 10, 12, 14, 16] as const;
const DAY_MS = 86_400_000;

export function simulate({ years, holidaysPerYear = 3, holidayDays = 10, skipEvery = 0 }: SimOptions): XpFacts {
  const days = Math.round(years * 365.25);
  const start = Date.UTC(2026, 0, 5); // Monday 5 January 2026
  const holidayStarts: number[] = [];
  for (let h = 0; h < holidaysPerYear; h++) holidayStarts.push(Math.floor(((h + 0.5) * 365) / holidaysPerYear));

  const log: XpCookFact[] = [];
  const photos: XpPhotoFact[] = [];
  const recipes = new Map<string, XpRecipeFact>();
  let pool = 40;
  let id = 1;

  for (let d = 0; d < days; d++) {
    const doy = d % 365;
    if (holidayStarts.some((s) => doy >= s && doy < s + holidayDays)) continue;
    if (skipEvery > 0 && hash32('skip' + d) % skipEvery === 0) continue;
    if (d % 37 === 0) pool++;
    const recipeId = 'b:r' + ((d * 7 + Math.floor(d / 11)) % pool);
    if (!recipes.has(recipeId)) recipes.set(recipeId, { lines: LINES[hash32(recipeId) % 7]! });
    const at = new Date(start + d * DAY_MS + 18 * 3_600_000).toISOString();
    log.push({ id: id++, recipeId, at, stars: d % 2 === 0 ? 5 : null });
    if (d % 5 === 0) photos.push({ recipeId, at });
  }

  return { log, recipes, photos, ownRecipes: [], badges: [] };
}
