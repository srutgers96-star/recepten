// V1c-2 §1c (docs/specs/verbeterronde-1c.md, block "Mensen en sturen"): the building blocks of
// "Stuur" — shared by the Stuur sheet (<SendSheet/>) and the screen "Deel je nieuwe recepten"
// ('#/share', DeltaShareScreen), so both build the same messages and log the same rows.
//
// - buildProgressMessage(p): "Mijn voortgang" — the `#x=` snapshot (level, badges, cooking days AND
//   who you are), moved here unchanged from ProgressSharePanel (6D-4b, xp-levels.md §1h/§2h).
// - buildIdentityMessage(p): "Wie ik ben" (badges off) — the `#f=` token (name, colour, language,
//   avatar), the logic of the former MemberCardPanel. Tokens and codecs are unchanged (invariant 4).
// - planDeltaFor(name): the delta since the last send to `name` and its message plan (V2: up to
//   20 KB per message, several parts, a file only when one envelope does not fit), moved here one to
//   one from DeltaShareScreen.
// - joinParts(first, plan): puts the person message in front of the recipe parts (pure, tested).
// - logSent(…): after a share-sheet share — the 'out' rows in "In & uit", `share.lastSentTo` when
//   recipes went along, then the badge re-check.
import { recheckActiveBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { bumpSharedRecipes, collectDeltaSince, getLastSentTo, logShareEvent, markSentTo, type DeltaSince } from '@/db/repo';
import { normalizeAvatarSpec } from '@/domain/avatar';
import { localDayIndex } from '@/domain/days';
import { cardFromMember } from '@/domain/household';
import { titleFor } from '@/domain/levels';
import { nowIso, type Profile, type Text } from '@/domain/model';
import { progressCardFor } from '@/domain/progress';
import {
  RECIPE_LINK_MESSAGE_LIMIT,
  buildMemberEnvelope,
  buildMemberShareMessage,
  buildPatchEnvelope,
  buildProgressEnvelope,
  buildProgressShareMessage,
  buildRecipeEnvelope,
  planMessages,
  type MessagePlan,
} from '@/domain/share';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { recordFeature } from '@/features';
import { lang } from '@/i18n';
import { refreshShareBadges } from '@/inbox-badge';
import { activeProfile } from '@/profile';
import { ensureDeviceId } from '@/screens/ProfilesScreen';
import { buildXpFacts, xpStateFor } from '@/xp';

/** The WhatsApp text: one sentence in the SENDER's language, the `#x=` link alone on the last line (§2h); plus that link. */
export async function buildProgressMessage(p: Profile): Promise<{ message: string; url: string }> {
  const [deviceId, state, facts] = await Promise.all([ensureDeviceId(), xpStateFor(p.id), buildXpFacts(p.id)]);
  const avatar = normalizeAvatarSpec(p.avatar);
  const card = progressCardFor({
    member: { id: p.id, name: p.name, color: p.color, lang: p.lang },
    deviceId,
    state,
    badges: facts.badges,
    log: facts.log,
    today: localDayIndex(new Date()),
    ...(avatar ? { avatar } : {}),
  });
  const token = await encodeToken(buildProgressEnvelope(card));
  const url = buildShareUrl(appInfo.appUrl, 'x', token);
  return { message: buildProgressShareMessage({ name: card.name, level: card.level, title: titleFor(card.level, p.lang), url, lang: p.lang }), url };
}

/**
 * "Wie ik ben": the `#f=` link of this profile (device id + name, colour, language, avatar) and its
 * one-sentence text in the SENDER's language, the link alone on the last line.
 */
export async function buildIdentityMessage(p: Profile): Promise<{ message: string; url: string }> {
  const deviceId = await ensureDeviceId();
  const token = await encodeToken(buildMemberEnvelope(cardFromMember(p, deviceId)));
  const url = buildShareUrl(appInfo.appUrl, 'f', token);
  return { message: buildMemberShareMessage({ name: p.name, url, lang: p.lang }), url };
}

export function foldName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * When something was last sent to a partner: the newest 'share.lastSentTo' entry whose key folds
 * to the same name. The keys keep the spelling that was typed ("gabi" via "Anders…" before she was
 * added as "Gabi"), while a person chip carries the person's name; comparing folded keeps the
 * delta, the chip and the "laatst verzonden" line on one partner.
 */
export function lastSentFor(lastSent: Record<string, string>, name: string): string | null {
  const wanted = foldName(name);
  if (!wanted) return null;
  let best: string | null = null;
  for (const [k, v] of Object.entries(lastSent)) if (foldName(k) === wanted && (best === null || v.localeCompare(best) > 0)) best = v;
  return best;
}

/**
 * The delta for `name` (everything changed since the last send to that name) and its message plan.
 * `plan` is null when nothing is new; `count` = recipes + adjusted classics (ingredients do not
 * count). The sender is the active profile unless `sender` is given (the Stuur sheet of another
 * profile on Profielen); the header lines follow the UI language, as on '#/share'.
 */
export async function planDeltaFor(
  name: string,
  sender?: { name: string; id?: string },
): Promise<{ delta: DeltaSince; plan: MessagePlan | null; lastSent: string | null; count: number }> {
  const ui = lang.value;
  const by = sender?.name ?? activeProfile.value?.name ?? '';
  const byId = sender ? sender.id : activeProfile.value?.id;
  const lastSent = lastSentFor(await getLastSentTo(), name);
  const delta = await collectDeltaSince(lastSent);
  const count = delta.recipes.length + delta.patches.length;
  if (!count) return { delta, plan: null, lastSent, count };
  const ctx = { by, byId, userIngredients: delta.userIngredients };
  const envs = [
    ...delta.recipes.map((r) => buildRecipeEnvelope(r, ctx)),
    ...delta.patches.map((o) =>
      buildPatchEnvelope(o, { ...ctx, lineOverrides: delta.lineOverrides.filter((lo) => lo.recipeId === o.baseId), name: delta.names[o.baseId] as Text | undefined }),
    ),
  ];
  // V2: the file is named after the SENDER ("Recepten van Gabi 8 nov - …"), not the partner.
  const plan = await planMessages(envs, appInfo.appUrl, { lang: ui, by, name: by });
  return { delta, plan, lastSent, count };
}

/**
 * The messages that go out (pure): part 1 is `first` (the progress / who-I-am sentence with its
 * link). When the first recipe part fits behind it (one blank line between) within `limit`, it is
 * glued onto part 1 and the other recipe parts follow; otherwise every recipe part follows as its own
 * message. A file plan (too big for messages) adds nothing here: the sheet sends the person to
 * '#/share' instead. An empty `first` gives just the recipe parts; nothing at all gives [].
 */
export function joinParts(first: string, deltaPlan: MessagePlan | null, limit = RECIPE_LINK_MESSAGE_LIMIT): string[] {
  const recipeParts = deltaPlan && 'parts' in deltaPlan ? deltaPlan.parts.filter((p) => p !== '') : [];
  if (!first) return recipeParts;
  const [head, ...rest] = recipeParts;
  if (head === undefined) return [first];
  const glued = first + '\n\n' + head;
  return glued.length <= limit ? [glued, ...rest] : [first, ...recipeParts];
}

/**
 * The delta went out to `name` — one 'out' row in the "In & uit" log with the recipe ids (patched
 * classics by their own id). Also used on its own by '#/share' for a downloaded bundle file.
 */
export async function logDeltaOut(d: DeltaSince, name: string): Promise<void> {
  const recipeIds = [...d.recipes.map((r) => r.id), ...d.patches.map((o) => o.baseId)];
  if (!recipeIds.length) return;
  await logShareEvent({ at: nowIso(), direction: 'out', kind: d.recipes.length ? 'recipes' : 'patches', who: name, count: recipeIds.length, recipeIds });
}

/**
 * After a share-sheet share (the last part): the 'out' rows as before — 'progress' (the former
 * ProgressSharePanel), 'member' (the former MemberCardPanel, with its feature mark) and the recipes
 * (the former logDeltaShared, plus the 'shared' badge counter); `share.lastSentTo` for the
 * recipient only when recipes went along; then the badge re-check. Never throws.
 */
export async function logSent(i: { profile: Profile; recipient: string | null; progress: boolean; identity: boolean; delta: DeltaSince | null }): Promise<void> {
  const who = i.recipient && i.recipient.trim() ? i.recipient.trim() : null;
  try {
    if (i.progress) await logShareEvent({ at: nowIso(), direction: 'out', kind: 'progress', who, count: 1, recipeIds: [], note: i.profile.name });
    if (i.identity) {
      void recordFeature('cardShared');
      await logShareEvent({ at: nowIso(), direction: 'out', kind: 'member', who, count: 1, recipeIds: [], note: i.profile.name });
    }
    const d = i.delta;
    const shared = d ? d.recipes.length + d.patches.length : 0;
    if (d && shared > 0) {
      await logDeltaOut(d, who ?? '');
      if (who) {
        await markSentTo(who);
        void refreshShareBadges();
      }
      // Phase 5 block C (badge rule 'shared'): n recipes left this phone through the share sheet.
      void recordFeature('deltaShared');
      await bumpSharedRecipes(shared);
    }
  } catch (e) {
    console.error('logSent', e);
  }
  recheckActiveBadges();
}
