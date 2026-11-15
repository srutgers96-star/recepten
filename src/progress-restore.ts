// V1c-9 "Herstel mijn voortgang" (docs/specs/verbeterronde-1c.md, block V1c-9 §1a).
//
// XP is derived, never stored (src/xp.ts). Restoring a progress card that belongs to a profile on
// this phone therefore puts back the FACTS the card has (the cook days of its last 90 days, its
// badges) and stores the rest as carried-over XP (`xp.carried`), computed so that the derived total
// lands exactly on the card's XP: carried = max(0, card.xp − total without carried). What the
// restored cook days and badges are worth comes off the carried XP, so nothing counts twice.
// Restored cooks get `loggedAt` = now, so the backdating rule (§2b rule 3) makes most of them
// XP-less by itself; they still count for streak, calendar and badges.
//
// The restore is silent: a quiet settle (no pops, no level-up sheet), then the unlocks refresh and
// the active profile's badges are re-checked. The UI decides when the button shows (block V1c-9 §1b).
import { BADGES_EARNED_SETTING, recheckActiveBadges, registerEarnedSilently } from '@/badges';
import { addCookEntries, getSetting, listCookLog, logShareEvent, setCarriedXp, setSetting } from '@/db/repo';
import { normalizeEarned } from '@/domain/badges';
import { nowIso } from '@/domain/model';
import { carriedXpFor, planProgressRestore } from '@/domain/progress';
import type { ProgressCard } from '@/domain/share';
import { refreshUnlocks } from '@/unlocks';
import { markXpDirty, settleXp, xpStateFor } from '@/xp';

/** What a restore did: the new level and total, and how many cook days and badges came back. */
export interface RestoreResult {
  level: number;
  total: number;
  cookDaysAdded: number;
  badgesAdded: number;
}

/**
 * Restores `card` onto the local profile `profileId` (the caller checked: the card is this
 * profile's, badges are on, and the card's XP is higher than the current total). Errors are
 * thrown through (the UI shows `common.error`).
 */
export async function restoreProgress(profileId: string, card: ProgressCard): Promise<RestoreResult> {
  // 1. What is there now → what the card adds.
  const [log, earnedRaw] = await Promise.all([listCookLog(), getSetting<unknown>(BADGES_EARNED_SETTING, {})]);
  const earned = normalizeEarned(earnedRaw);
  const existing = {
    cooks: log.filter((e) => e.profileId === profileId).map((e) => ({ recipeId: e.recipeId, at: e.at })),
    earned: earned[profileId] ?? [],
  };
  const plan = planProgressRestore(card, existing);

  // 2. The facts: the cook days (one transaction) and the badges (union, silently: no toast, no confetti).
  const loggedAt = nowIso();
  await addCookEntries(plan.cooks.map((c) => ({ ...c, profileId, loggedAt, note: null })));
  if (plan.badgesAdded > 0) {
    const fresh = normalizeEarned(await getSetting<unknown>(BADGES_EARNED_SETTING, {}));
    const merged = [...new Set([...(fresh[profileId] ?? []), ...plan.badges])];
    await setSetting(BADGES_EARNED_SETTING, { ...fresh, [profileId]: merged });
  }
  // Decision Fable after the lens (15 Nov 2026): the restored cooks also move the ladders of every
  // local profile and of "Samen" ('all'); register all of that silently NOW, so (a) the carried XP
  // below is computed over the complete picture and (b) the recheck in step 4 finds nothing new —
  // no toast, no milestone confetti for a repair.
  await registerEarnedSilently();

  // 3. The carried XP, from the total derived WITHOUT it (after the facts above were written).
  await setCarriedXp(profileId, 0);
  markXpDirty(profileId);
  const derived = await xpStateFor(profileId);
  const carried = carriedXpFor(card.xp, derived.total);
  await setCarriedXp(profileId, carried);
  markXpDirty(profileId);
  const state = await xpStateFor(profileId);

  // 4. Quietly settled (no pops, no level-up sheet), unlocks refreshed, badges re-checked, one 'in' row.
  await settleXp(profileId, { quiet: true });
  await refreshUnlocks();
  recheckActiveBadges();
  // As in applyProgressCard: a failed log row never turns the finished restore into an error.
  void logShareEvent({ at: nowIso(), direction: 'in', kind: 'progress', who: card.name, count: 1, recipeIds: [] }).catch((err: unknown) =>
    console.error('logShareEvent', err),
  );

  // 5. The outcome.
  return { level: state.level, total: state.total, cookDaysAdded: plan.cookDaysAdded, badgesAdded: plan.badgesAdded };
}
