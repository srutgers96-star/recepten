// V1c-2 (docs/specs/verbeterronde-1c.md, block V1c-2 §1a): the people on Huishouden & vrienden, app
// layer (Dexie via the repo). Everyone is a `Member` with a role (src/domain/household.ts):
//   - migrateFriendSnapshots  once at boot (setting `household.rolesMigrated`): the friends that so
//                             far lived only as a snapshot (`friend: true`) become friend members.
//   - applyPersonCard         a received "who I am" (`#f=`) or progress (`#x=`) with the role the
//                             receiver chose: add, update (the role stays), or nothing for a profile
//                             on this phone; a progress is stored as a snapshot; one 'in' log row.
//   - setMemberRole           "Maak vriend" / "Maak huisgenoot" (one tap, no confirmation).
// The tokens and their codecs do not change (invariant 4).
import { getProgressSnapshots, getSetting, logShareEvent, putProgressSnapshot, setSetting, updateHousehold } from '@/db/repo';
import {
  friendMembersFromSnapshots,
  matchMemberForCard,
  membersFrom,
  roleOf,
  setRole,
  upsertMemberFromCard,
  type HouseholdSetting,
  type Member,
  type MemberCard,
  type MemberRole,
} from '@/domain/household';
import { nowIso } from '@/domain/model';
import type { ProgressSnapshot } from '@/domain/progress';
import type { ProgressCard } from '@/domain/share';
import { profiles } from '@/profile';

/** Setting: 1 once the friend snapshots were turned into friend members (V1c-2). */
export const ROLES_MIGRATED_KEY = 'household.rolesMigrated';

/** 'local' = a profile on this phone; 'known' = already a (non-local) member; 'new' = not yet. */
export type CardStatus = 'new' | 'known' | 'local';

/** Where a received card stands against the full member list (`membersFrom`, profiles included). */
export function cardStatus(members: readonly Member[], card: MemberCard): CardStatus {
  const m = matchMemberForCard(members, card);
  return m ? (m.local ? 'local' : 'known') : 'new';
}

export type PersonOutcome = 'added' | 'updated' | 'local';

function isProgressCard(card: MemberCard | ProgressCard): card is ProgressCard {
  return 'xp' in card;
}

/**
 * One-time migration (only adds): every snapshot kept as a friend that matches no member becomes a
 * member with `role: 'friend'`; then the flag. Runs on every boot until the flag is set; safe to
 * run twice (matched snapshots are skipped).
 */
export async function migrateFriendSnapshots(force = false): Promise<void> {
  // `force` (decision Fable after the V1c-2 lens, 15 Nov 2026): a restored backup from before the roles
  // holds its friends only as snapshots with `friend: true`, and the flag is already 1 on this phone —
  // the Storage screen runs the migration again right after a restore. Safe to repeat: a snapshot that
  // matches a member is skipped.
  if (!force && (await getSetting<unknown>(ROLES_MIGRATED_KEY, 0)) === 1) return;
  const snapshots = await getProgressSnapshots();
  await updateHousehold((h) => {
    const add = friendMembersFromSnapshots(snapshots, membersFrom(profiles.value, h));
    return add.length ? { ...h, members: [...h.members, ...add] } : h;
  });
  await setSetting(ROLES_MIGRATED_KEY, 1);
}

/**
 * A received card with the role the receiver chose. A profile on this phone → nothing ('local'; the
 * screens offer V1c-9's restore for a progress). Known → updated, the member KEEPS its role. New →
 * added with `role`. A progress card is stored as the person's snapshot (`friend` mirrors the role,
 * kept only for older backups). One 'in' log row (kind 'member' or 'progress'); a failed log row is
 * only logged to the console. Returns the setting as stored, for the caller's state.
 */
export async function applyPersonCard(card: MemberCard | ProgressCard, role: MemberRole): Promise<{ outcome: PersonOutcome; setting: HouseholdSetting }> {
  // Set inside the transaction below (a cast keeps TypeScript from narrowing it to 'local').
  let outcome = 'local' as PersonOutcome;
  let isFriend = role === 'friend';
  const setting = await updateHousehold((h) => {
    const members = membersFrom(profiles.value, h);
    const status = cardStatus(members, card);
    if (status === 'local') {
      outcome = 'local';
      return h;
    }
    if (status === 'known') {
      const existing = matchMemberForCard(members, card);
      isFriend = !!existing && roleOf(existing) === 'friend';
      outcome = 'updated';
    } else {
      isFriend = role === 'friend';
      outcome = 'added';
    }
    return upsertMemberFromCard(h, card, role);
  });
  if (outcome === 'local') return { outcome, setting };
  const progress = isProgressCard(card);
  if (progress) {
    const snapshot: ProgressSnapshot = { ...card, receivedAt: nowIso(), friend: isFriend };
    await putProgressSnapshot(snapshot);
  }
  void logShareEvent({ at: nowIso(), direction: 'in', kind: progress ? 'progress' : 'member', who: card.name, count: 1, recipeIds: [] }).catch((err: unknown) =>
    console.error('logShareEvent', err),
  );
  return { outcome, setting };
}

/** "Maak vriend" / "Maak huisgenoot": a profile on this phone is never changed (it is not in the setting). */
export async function setMemberRole(id: string, role: MemberRole): Promise<HouseholdSetting> {
  return updateHousehold((h) => (profiles.value.some((p) => p.id === id) ? h : setRole(h, id, role)));
}
