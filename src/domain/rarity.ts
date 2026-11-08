// Rarity (blocks 6D-R and 6D-S): how rare an avatar part or an unlock is — common · rare · epic ·
// legendary. Framework-free, no imports: src/domain/avatar.ts re-exports `Rarity`/`RARITIES` from
// here (existing imports keep working) and src/domain/unlocks.ts uses `rarityForLevel` as the
// fallback for an unlock without an explicit `rarity` in data/unlocks.json.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** The four rarities, from common to legendary (the order of the maker's groups). */
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

const RARITY_SET: ReadonlySet<string> = new Set(RARITIES);

/** Whether `v` is one of the four rarities. */
export function isRarity(v: unknown): v is Rarity {
  return typeof v === 'string' && RARITY_SET.has(v);
}

/** The default rarity of something a level sets free: ≤ 20 common · ≤ 50 rare · ≤ 80 epic · else legendary. */
export function rarityForLevel(level: number): Rarity {
  return level <= 20 ? 'common' : level <= 50 ? 'rare' : level <= 80 ? 'epic' : 'legendary';
}
