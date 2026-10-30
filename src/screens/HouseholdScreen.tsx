// '#/more/household' — the household (docs/phase-5-spec.md A.8 + block F): its name (setting
// `household.name`; empty = the default "Thuis" / "Home" in the active language, never stored)
// and its members: the profiles on this phone (automatic, edited via Profiles) plus members added
// by hand (name + colour) or received as a MEMBER CARD (`#f=` token, src/domain/household.ts
// `upsertMemberFromCard`), all stored in the `household` setting.
//   - "Mijn kaartje": <MemberCardPanel/> (ProfilesScreen) for the active profile, and under it (6D-4,
//     docs/specs/xp-levels.md §1h) the button "Sync mijn voortgang" with <ProgressSharePanel/>.
//   - "Voeg lid toe via link of plak": a paste box; every `#f=` in the text becomes a card row with
//     "Voeg <naam> toe aan je huishouden" (`readMemberCards`, `MemberCardRow`, `applyMemberCard`;
//     the Inbox reuses the last two). Works by pasting (iPhone, invariant 5) and by link (Android
//     → Inbox). Phase 6 (docs/phase-6-spec.md 13A): the box is the universal one (<UniversalPaste>):
//     a recipe link pasted here offers "Open in de Inbox", a website recipe "Open in de editor"; a
//     text another paste box handed over arrives through `pendingMemberText`.
//   - 6D-4b (docs/specs/xp-levels.md §1i): a shared progress (`#x=`, "Sync mijn voortgang") pasted
//     here (or in the Inbox) becomes a card "Voortgang van <naam>" (`ProgressCardRow`,
//     `applyProgressCard`; the Inbox reuses both): update a member, add a new one, or keep the
//     snapshot as a friend (setting `progress.snapshots`). Each member row shows "Level N · <titel>"
//     under the name (a profile here: live; a member on another phone: from the last snapshot, with
//     "· bijgewerkt <datum>"); badges off = no level anywhere. Under the members a card "Vrienden"
//     lists the friend snapshots (absent when there are none).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { Header } from '@/components/Header';
import { ProgressShareToggle } from '@/components/ProgressSharePanel';
import { formatShortDate } from '@/components/RecipeRow';
import { UniversalPaste } from '@/components/UniversalPaste';
import { formatXp, levelTitleText } from '@/components/XpBar';
import { useLive } from '@/db/live';
import { getHousehold, getProgressSnapshots, logShareEvent, putProgressSnapshot, removeProgressSnapshot, setHousehold } from '@/db/repo';
import { dayFromKey, dayIndexOfIso, localDayIndex } from '@/domain/days';
import {
  matchMemberForCard,
  memberFromProfile,
  membersFrom,
  newMemberId,
  putMember,
  removeMember,
  upsertMemberFromCard,
  type HouseholdSetting,
  type Member,
  type MemberCard,
} from '@/domain/household';
import { nowIso } from '@/domain/model';
import { classifyPaste } from '@/domain/paste-classify';
import { cleanPastedText } from '@/domain/photo-import';
import type { ProgressSnapshot } from '@/domain/progress';
import { parseEnvelope, type ParsedShare, type ProgressCard } from '@/domain/share';
import { decodeToken, extractTokens } from '@/domain/token';
import { t } from '@/i18n';
import { openPasteIn } from '@/paste';
import { PROFILE_COLORS, activeProfile, profiles } from '@/profile';
import { navigate, pendingMemberText } from '@/router';
import { Avatar, MemberCardPanel, useAvatarLevel } from './ProfilesScreen';

const NAME_DEBOUNCE_MS = 500;
const PASTE_DEBOUNCE_MS = 150;

interface MemberValues {
  name: string;
  color: string;
}

// --- Member cards: shared with the Inbox ---------------------------------------------------------

/** 'local' = a profile on this phone; 'known' = already a (non-local) member; 'new' = not yet. */
export type CardStatus = 'new' | 'known' | 'local';

export function cardStatus(members: readonly Member[], card: MemberCard): CardStatus {
  const m = matchMemberForCard(members, card);
  return m ? (m.local ? 'local' : 'known') : 'new';
}

export type CardOutcome = 'added' | 'updated' | 'local';

/**
 * Writes a received card into the household setting (add or update); a card of a profile on this
 * phone is never written (`'local'`). Returns the setting as stored, for the caller's state.
 */
export async function applyMemberCard(card: MemberCard): Promise<{ outcome: CardOutcome; setting: HouseholdSetting }> {
  const h = await getHousehold();
  const status = cardStatus(membersFrom(profiles.value, h), card);
  if (status === 'local') return { outcome: 'local', setting: h };
  const next = upsertMemberFromCard(h, card);
  await setHousehold(next);
  return { outcome: status === 'known' ? 'updated' : 'added', setting: next };
}

export interface FoundCards {
  cards: MemberCard[];
  /** Shared progress (`#x=`, 6D-4b), one per card id: a card too ("Voortgang van <naam>"). */
  progress: ProgressCard[];
  /** When each progress was shared (the envelope's `at`), by card id. */
  progressAt: Record<string, string>;
  /** Human-readable problems per part (invalid code, newer version …). */
  problems: string[];
  /** Tokens that were something else (a recipe, a plan): "plak het in de Inbox". */
  others: number;
}

function problemOf(e: unknown): string {
  return (e as Error)?.message === 'unsupported-version' ? t('inbox.unsupported') : t('inbox.invalid');
}

/** A share envelope (`v` + `t`), as opposed to a bundle/export/recipe JSON the Inbox reads by content. */
function isEnvelope(v: unknown): boolean {
  return typeof v === 'object' && v !== null && typeof (v as { v?: unknown }).v === 'number' && typeof (v as { t?: unknown }).t === 'string';
}

/**
 * Every member card in a pasted text: the `#f=` tokens (a WhatsApp message, a bare link), else one
 * raw JSON envelope. A shared progress (`#x=`, 6D-4b) counts as a card too (`progress`); one whose
 * card is unreadable is a problem. Other kinds of token, and other JSON (a bundle, an export, a
 * recipe — the paste box offers "Open in de Inbox" for those), are counted in `others`; the same
 * card twice counts once.
 */
export async function readMemberCards(text: string): Promise<FoundCards> {
  const out: FoundCards = { cards: [], progress: [], progressAt: {}, problems: [], others: 0 };
  const seen = new Set<string>();
  const seenProgress = new Set<string>();
  const take = (parsed: ParsedShare) => {
    if (parsed.kind === 'member' && parsed.member) {
      if (seen.has(parsed.member.id)) return;
      seen.add(parsed.member.id);
      out.cards.push(parsed.member);
    } else if (parsed.kind === 'progress') {
      const card = parsed.progress;
      if (!card) {
        out.problems.push(t('inbox.invalid'));
        return;
      }
      if (seenProgress.has(card.id)) return;
      seenProgress.add(card.id);
      out.progress.push(card);
      if (parsed.at) out.progressAt[card.id] = parsed.at;
    } else out.others++;
  };
  // Tokens from the cleaned text, as the paste box classifies them (a rendered chat may escape a "_" inside the token).
  const tokens = extractTokens(cleanPastedText(text));
  if (tokens.length) {
    for (const tk of tokens) {
      try {
        const env = await decodeToken(tk.token);
        // The fragment key is part of the contract: "#f=" must carry a t:'f' envelope.
        if (env.t !== tk.key) throw new Error('invalid-token');
        take(parseEnvelope(env));
      } catch (e) {
        out.problems.push(problemOf(e));
      }
    }
    return out;
  }
  // Raw JSON, also after a title line (a shared document): an envelope gives the card, anything else is "something else".
  const s = text.trim();
  const idx = s.search(/[{[]/u);
  if (idx < 0) return out;
  let value: unknown;
  try {
    value = JSON.parse(s.slice(idx));
  } catch {
    return out; // not JSON: "geen kaartje gevonden"
  }
  if (!isEnvelope(value)) {
    out.others++;
    return out;
  }
  try {
    take(parseEnvelope(value));
  } catch (e) {
    out.problems.push(problemOf(e));
  }
  return out;
}

/** One received card: who it is, whether we know them, and the add/update button (or the outcome). */
export function MemberCardRow(props: { card: MemberCard; members: readonly Member[]; done?: CardOutcome; busy?: boolean; onAdd: (card: MemberCard) => void; onOpenHousehold?: () => void }) {
  const { card } = props;
  const status = props.done === 'local' ? 'local' : cardStatus(props.members, card);
  const name = card.name;
  return (
    <div class="member-card-row">
      <div class="member-card-head">
        <Avatar profile={card} />
        <div class="who">
          <strong>{t('household.cardFrom', { name })}</strong>
          <span class="muted small">{t(card.lang === 'en' ? 'lang.en' : 'lang.nl')}</span>
        </div>
      </div>
      {props.done && props.done !== 'local' ? (
        <>
          <p class="ok small">{t(props.done === 'added' ? 'household.cardAdded' : 'household.cardUpdated', { name })}</p>
          {props.onOpenHousehold && (
            <div class="actions">
              <button type="button" class="btn" onClick={props.onOpenHousehold}>
                {t('household.toHousehold')} ›
              </button>
            </div>
          )}
        </>
      ) : status === 'local' ? (
        <p class="muted small">{t('household.cardLocal', { name })}</p>
      ) : (
        <>
          {status === 'known' && <p class="muted small">{t('household.cardKnown', { name })}</p>}
          <div class="actions">
            <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={() => props.onAdd(card)}>
              {t(status === 'known' ? 'household.updateCard' : 'household.addCard', { name })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Shared progress (#x=, 6D-4b): shared with the Inbox -----------------------------------------

/**
 * True once the `badges.enabled` setting is known and on. Badges off = no level, streak or badge
 * count anywhere (docs/specs/xp-levels.md §1, §5.9); waiting for the setting keeps a level line
 * from flashing.
 */
function useBadgesOn(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadBadgeSettings().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready && badgesEnabled.value;
}

/**
 * Cook days of the card in the 30 days up to the day it was shared (the envelope's `at`; today when
 * the share carries no date), that day included: "{n} kookdagen in de laatste 30 dagen".
 */
export function cookDaysIn30(card: Pick<ProgressCard, 'cookDays'>, sentAt?: string): number {
  const end = (sentAt ? dayIndexOfIso(sentAt) : null) ?? localDayIndex(new Date());
  let n = 0;
  for (const c of card.cookDays) {
    const day = dayFromKey(c.d);
    if (day !== null && day <= end && day > end - 30) n++;
  }
  return n;
}

/** What saving a received progress did: a member added / updated, kept as a friend, or nothing (a profile here). */
export type ProgressOutcome = 'added' | 'updated' | 'friend' | 'local';

/**
 * Saves a received progress (§1i). The sender is a profile on this phone → nothing is written
 * ('local'). A member already (`matchMemberForCard`, by id or name) → the card fields update the
 * member (`upsertMemberFromCard` via applyMemberCard) and the snapshot is stored. Not a member:
 * `asFriend` false = add them as a member + the snapshot, true = only the snapshot with
 * `friend: true`. Every save logs one 'in' row (kind 'progress', who = the name). Returns the
 * household as stored, for the caller's state.
 */
export async function applyProgressCard(card: ProgressCard, asFriend: boolean): Promise<{ outcome: ProgressOutcome; setting: HouseholdSetting }> {
  const h = await getHousehold();
  const status = cardStatus(membersFrom(profiles.value, h), card);
  if (status === 'local') return { outcome: 'local', setting: h };
  let setting = h;
  let outcome: ProgressOutcome = 'friend';
  if (status === 'known' || !asFriend) {
    const r = await applyMemberCard(card);
    if (r.outcome === 'local') return { outcome: 'local', setting: r.setting };
    setting = r.setting;
    outcome = r.outcome;
  }
  const snapshot: ProgressSnapshot = { ...card, receivedAt: nowIso(), friend: outcome === 'friend' };
  await putProgressSnapshot(snapshot);
  void logShareEvent({ at: nowIso(), direction: 'in', kind: 'progress', who: card.name, count: 1, recipeIds: [] }).catch((err: unknown) => console.error('logShareEvent', err));
  return { outcome, setting };
}

/**
 * One received progress (§1i): avatar, "Voortgang van <naam>", "Level N · <titel> · 🔥 s · b badges"
 * (badges on only), "{n} kookdagen in de laatste 30 dagen · gedeeld op <datum>", and the buttons:
 * a member → "Werk <naam> bij"; a profile here → the line that you already see it; anyone else →
 * "Voeg <naam> toe aan je huishouden" and "Bewaar als vriend".
 */
export function ProgressCardRow(props: {
  card: ProgressCard;
  /** The envelope's `at`. */
  sentAt?: string;
  members: readonly Member[];
  done?: ProgressOutcome;
  busy?: boolean;
  onSave: (card: ProgressCard, asFriend: boolean) => void;
  onOpenHousehold?: () => void;
}) {
  const { card } = props;
  const badgesOn = useBadgesOn();
  const status = props.done === 'local' ? 'local' : cardStatus(props.members, card);
  const name = card.name;
  const sent = formatShortDate(props.sentAt);
  const line3 = [t('progress.cookDays30', { n: formatXp(cookDaysIn30(card, props.sentAt)) }), sent ? t('progress.sentAt', { date: sent }) : '']
    .filter((s) => s !== '')
    .join(' · ');
  const doneText =
    props.done === 'updated'
      ? t('progress.updated', { name })
      : props.done === 'added'
        ? t('household.cardAdded', { name })
        : props.done === 'friend'
          ? t('household.saved')
          : '';
  return (
    <div class="member-card-row progress-card-row">
      <div class="member-card-head">
        <Avatar profile={card} />
        <div class="who">
          <strong>{t('progress.from', { name })}</strong>
          {badgesOn && (
            <span class="muted small">
              {levelTitleText(card.level)} · {t('progress.streakBadges', { streak: formatXp(card.streak), badges: formatXp(card.badges.length) })}
            </span>
          )}
          <span class="muted small">{line3}</span>
        </div>
      </div>
      {props.done && props.done !== 'local' ? (
        <>
          <p class="ok small">{doneText}</p>
          {props.onOpenHousehold && (
            <div class="actions">
              <button type="button" class="btn" onClick={props.onOpenHousehold}>
                {t('household.toHousehold')} ›
              </button>
            </div>
          )}
        </>
      ) : status === 'local' ? (
        <p class="muted small">{t('progress.local', { name })}</p>
      ) : status === 'known' ? (
        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={() => props.onSave(card, false)}>
            {t('progress.update', { name })}
          </button>
        </div>
      ) : (
        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={() => props.onSave(card, false)}>
            {t('household.addCard', { name })}
          </button>
          <button type="button" class="btn btn-block" disabled={props.busy} onClick={() => props.onSave(card, true)}>
            {t('progress.saveFriend')}
          </button>
        </div>
      )}
    </div>
  );
}

/** "Level N · <titel> · bijgewerkt <datum>" of a snapshot (the caller checks that badges are on). */
function SnapshotLevelLine(props: { snapshot?: ProgressSnapshot }) {
  const s = props.snapshot;
  if (!s) return null;
  const date = formatShortDate(s.receivedAt);
  return (
    <span class="muted small member-level">
      {levelTitleText(s.level)}
      {date ? ' ' + t('progress.updatedAgo', { date }) : ''}
    </span>
  );
}

/**
 * The level line under a member's name (§1i): a profile on this phone = its live level
 * (`useAvatarLevel`, a quiet read, never a reward moment); a member on another phone = the level of
 * their last snapshot with "· bijgewerkt <datum>"; nothing without data or with badges off.
 */
function MemberLevelLine(props: { member: Member; snapshot?: ProgressSnapshot }) {
  const on = useBadgesOn();
  const localLevel = useAvatarLevel(props.member.local ? props.member.id : null);
  if (!on) return null;
  if (props.member.local) return localLevel ? <span class="muted small member-level">{levelTitleText(localLevel)}</span> : null;
  return <SnapshotLevelLine snapshot={props.snapshot} />;
}

/** A friend's line on the Vrienden card: the snapshot's level and date, with badges on only. */
function FriendLevelLine(props: { snapshot: ProgressSnapshot }) {
  const on = useBadgesOn();
  return on ? <SnapshotLevelLine snapshot={props.snapshot} /> : null;
}

// --- Screen --------------------------------------------------------------------------------------

/** Name + colour form for a hand-added member (add and edit). */
function MemberForm(props: { initial?: Partial<MemberValues>; submitLabel: string; autoFocus?: boolean; taken: readonly string[]; onSubmit: (v: MemberValues) => void | Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(props.initial?.name ?? '');
  const [color, setColor] = useState(props.initial?.color ?? PROFILE_COLORS[(profiles.value.length + 1) % PROFILE_COLORS.length] ?? '#2b4fa8');
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const exists = trimmed !== '' && props.taken.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed !== '' && !exists;

  async function submit(e: Event) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await props.onSubmit({ name: trimmed, color });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="stack member-form" onSubmit={(e) => void submit(e)}>
      <label class="field">
        <span>{t('household.memberName')}</span>
        <input class="input" type="text" autocomplete="off" autoFocus={props.autoFocus} placeholder={t('household.memberNamePlaceholder')} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        {exists && <span class="bad small">{t('household.nameExists')}</span>}
      </label>
      <div class="field">
        <span>{t('household.memberColor')}</span>
        <div class="swatches" role="radiogroup" aria-label={t('household.memberColor')}>
          {PROFILE_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c} class={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary" disabled={!valid || busy}>
          {props.submitLabel}
        </button>
        <button type="button" class="btn" onClick={props.onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

export function HouseholdScreen() {
  const [setting, setSettingState] = useState<HouseholdSetting | null>(null);
  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const nameTimer = useRef<number | null>(null);
  // Block F: the paste box for received cards.
  const [pasteText, setPasteText] = useState('');
  const [found, setFound] = useState<FoundCards | null>(null);
  const [cardDone, setCardDone] = useState<Record<string, CardOutcome>>({});
  const [pasteNotice, setPasteNotice] = useState('');
  const [cardBusy, setCardBusy] = useState(false);
  // 6D-4b: what happened to each received progress in the paste box, and the stored snapshots (live:
  // a save here or in the Inbox shows up at once in the level lines and on the Vrienden card).
  const [progressDone, setProgressDone] = useState<Record<string, ProgressOutcome>>({});
  const snapshots = useLive(getProgressSnapshots, []);
  const pasteSeq = useRef(0);
  const pasteBox = useRef<HTMLTextAreaElement>(null);
  const list = profiles.value;
  const me = activeProfile.value;

  useEffect(() => {
    let cancelled = false;
    // 13A: a text with cards that another paste box (editor, Inbox) handed over.
    const handed = pendingMemberText.value;
    if (handed) {
      pendingMemberText.value = null;
      setPasteText(handed);
    }
    void getHousehold().then(
      (h) => {
        if (cancelled) return;
        setSettingState(h);
        setName(h.name);
      },
      (e: unknown) => console.error('getHousehold', e),
    );
    return () => {
      cancelled = true;
      if (nameTimer.current !== null) window.clearTimeout(nameTimer.current);
    };
  }, []);

  const members = useMemo(() => (setting ? membersFrom(list, setting) : list.map(memberFromProfile)), [list, setting]);
  // 6D-4b: the friend snapshots for the Vrienden card, by name; one that has since become a member
  // (a member card of the same person) shows in the member list instead, not twice.
  const friends = useMemo(
    () =>
      Object.values(snapshots ?? {})
        .filter((s) => s.friend && !matchMemberForCard(members, s))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshots, members],
  );

  async function save(next: HouseholdSetting) {
    setSettingState(next);
    try {
      await setHousehold(next);
    } catch (e) {
      console.error('setHousehold', e);
    }
  }

  /** The name autosaves (debounced); an empty name is stored as '' and shows the translated default. */
  function onNameInput(v: string) {
    setName(v);
    setNameSaved(false);
    if (nameTimer.current !== null) window.clearTimeout(nameTimer.current);
    nameTimer.current = window.setTimeout(() => {
      nameTimer.current = null;
      if (!setting) return;
      void save({ ...setting, name: v.trim() }).then(() => setNameSaved(true));
    }, NAME_DEBOUNCE_MS);
  }

  async function add(v: MemberValues) {
    if (!setting) return;
    await save(putMember(setting, { id: newMemberId(), name: v.name, color: v.color, local: false }));
    setAdding(false);
  }

  async function edit(m: Member, v: MemberValues) {
    if (!setting) return;
    await save(putMember(setting, { ...m, name: v.name, color: v.color }));
    setEditing(null);
  }

  async function remove(m: Member) {
    if (!setting) return;
    if (!confirm(t('household.removeConfirm', { name: m.name }))) return;
    await save(removeMember(setting, m.id));
    // 6D-4b: their last shared progress goes with them (it would otherwise linger in the calendar).
    void removeProgressSnapshot(m.id).catch((e: unknown) => console.error('removeProgressSnapshot', e));
    if (editing === m.id) setEditing(null);
  }

  /** "Verwijder" on the Vrienden card: the friend's snapshot goes (they can share it again). */
  async function removeFriend(s: ProgressSnapshot) {
    try {
      await removeProgressSnapshot(s.id);
    } catch (e) {
      console.error('removeProgressSnapshot', e);
    }
  }

  // Analyse the pasted text (debounced): every `#f=` becomes a card row. A new text starts with
  // fresh rows: the "is toegevoegd" outcome of an earlier paste never sticks to a re-pasted card
  // (it then says "al lid" + "Werk bij", like the Inbox). Anything that is not a token or a raw
  // envelope (a website recipe, prose) is left to the paste box's own line and buttons (13A).
  useEffect(() => {
    const my = ++pasteSeq.current;
    const trimmed = pasteText.trim();
    const kind = trimmed ? classifyPaste(trimmed).kind : 'empty';
    if (!trimmed || !(kind === 'member' || kind === 'tokens' || kind === 'bundle')) {
      setFound(null);
      setCardDone({});
      setProgressDone({});
      return;
    }
    const handle = window.setTimeout(() => {
      void readMemberCards(trimmed)
        .then((got) => {
          if (my !== pasteSeq.current) return;
          setFound(got);
          setCardDone({});
          setProgressDone({});
        })
        .catch((e: unknown) => {
          console.warn('readMemberCards', e);
          if (my === pasteSeq.current) setFound({ cards: [], progress: [], progressAt: {}, problems: [t('inbox.invalid')], others: 0 });
        });
    }, PASTE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [pasteText]);

  /**
   * The paste box's text changed (typed, pasted, cleared). The same message pasted again changes
   * no text (so the effect above does not run): reset the outcomes here too, so the card row
   * shows its current status again.
   */
  function onPasteText(s: string) {
    setPasteNotice('');
    setCardDone({});
    setProgressDone({});
    setPasteText(s);
  }

  async function addCard(card: MemberCard) {
    if (cardBusy) return;
    setCardBusy(true);
    setPasteNotice('');
    try {
      const r = await applyMemberCard(card);
      setSettingState(r.setting);
      setCardDone((prev) => ({ ...prev, [card.id]: r.outcome }));
      // 13A-2: a card that was added or updated came IN — one row in the "In & uit" log (same rule
      // as InboxScreen.addCard, so the log does not depend on which screen the card was pasted in).
      if (r.outcome === 'added' || r.outcome === 'updated') {
        void logShareEvent({ at: nowIso(), direction: 'in', kind: 'member', who: card.name, count: 1, recipeIds: [] }).catch((err: unknown) => console.error('logShareEvent', err));
      }
    } catch (e) {
      console.error('applyMemberCard', e);
      setPasteNotice(`${t('household.cardFailed')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setCardBusy(false);
    }
  }

  /** 6D-4b: "Werk bij" / "Voeg toe" / "Bewaar als vriend" on a received progress (§1i). */
  async function saveProgress(card: ProgressCard, asFriend: boolean) {
    if (cardBusy) return;
    setCardBusy(true);
    setPasteNotice('');
    try {
      const r = await applyProgressCard(card, asFriend);
      setSettingState(r.setting);
      setProgressDone((prev) => ({ ...prev, [card.id]: r.outcome }));
    } catch (e) {
      console.error('applyProgressCard', e);
      setPasteNotice(`${t('household.cardFailed')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setCardBusy(false);
    }
  }

  const takenFor = (except?: string) => members.filter((m) => m.id !== except).map((m) => m.name);
  const count = members.length === 1 ? t('household.memberOne') : t('household.memberCount', { n: members.length });
  // Tokens that were something else (a recipe, a plan) are not "nothing": the paste box names them
  // and offers "Open in de Inbox".
  const nothingFound = found !== null && found.cards.length === 0 && found.progress.length === 0 && found.problems.length === 0 && found.others === 0;

  return (
    <>
      <Header title={t('household.title')} back backLabel={t('common.back')} />
      <div class="screen form">
        <p class="muted" style="padding-top:12px">
          {t('household.intro')}
        </p>

        <section class="card">
          <label class="field" style="margin-bottom:0">
            <span>{t('household.name')}</span>
            <div class="household-name">
              {/* Empty = the default name, shown as the placeholder in the active language ("Thuis" / "Home"). */}
              <input class="input" type="text" autocomplete="off" placeholder={t('household.defaultName')} value={name} disabled={!setting} onInput={(e) => onNameInput((e.currentTarget as HTMLInputElement).value)} />
              {nameSaved && <span class="saved-flag">{t('household.saved')}</span>}
            </div>
          </label>
        </section>

        {me && (
          <section class="card my-card">
            <h2>{t('household.myCard')}</h2>
            <div class="my-card-head">
              <Avatar profile={me} />
              <div class="who">
                <strong>{me.name}</strong>
                <span class="muted small">{t(me.lang === 'en' ? 'lang.en' : 'lang.nl')}</span>
              </div>
            </div>
            <MemberCardPanel profile={me} />
            {/* 6D-4 (§1h): "Sync mijn voortgang" + its panel; nothing with badges off. */}
            <ProgressShareToggle profile={me} />
          </section>
        )}

        <section class="card">
          <h2>
            {t('household.members')} <span class="muted small">· {count}</span>
          </h2>
          <ul class="member-list">
            {members.map((m) => (
              <li key={m.id} class="member-row-wrap">
                {editing === m.id && !m.local ? (
                  <MemberForm initial={m} submitLabel={t('common.save')} taken={takenFor(m.id)} onSubmit={(v) => edit(m, v)} onCancel={() => setEditing(null)} />
                ) : (
                  <div class="member-row">
                    <Avatar profile={m} />
                    <div class="who">
                      <strong>{m.name}</strong>
                      <MemberLevelLine member={m} snapshot={snapshots?.[m.id]} />
                      <span class="muted small">{m.local ? t('household.local') : m.deviceId ? t('household.fromCard') : t('household.byHand')}</span>
                    </div>
                    {!m.local && (
                      <div class="actions">
                        <button type="button" class="btn btn-small" onClick={() => setEditing(m.id)}>
                          {t('household.edit')}
                        </button>
                        <button type="button" class="btn btn-small btn-danger" onClick={() => void remove(m)}>
                          {t('household.remove')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div class="actions" style="margin:8px 0 0">
            <button type="button" class="btn btn-small" onClick={() => navigate('/more/profiles')}>
              {t('household.manageProfiles')}
            </button>
          </div>
        </section>

        {friends.length > 0 && (
          <section class="card friends">
            <h2>{t('progress.friends')}</h2>
            <ul class="member-list">
              {friends.map((s) => (
                <li key={s.id} class="member-row-wrap">
                  <div class="member-row">
                    <Avatar profile={s} />
                    <div class="who">
                      <strong>{s.name}</strong>
                      <FriendLevelLine snapshot={s} />
                    </div>
                    <div class="actions">
                      <button type="button" class="btn btn-small btn-danger" onClick={() => void removeFriend(s)}>
                        {t('household.remove')}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section class="card member-paste">
          <h2>{t('household.addViaLink')}</h2>
          <p class="muted small">{t('household.addViaLinkHint')}</p>
          {/* 13A: the universal paste box; cards are handled right here (no onMember = the rows below). */}
          <UniversalPaste
            defaultAction="member"
            value={pasteText}
            onChange={onPasteText}
            textareaRef={pasteBox}
            rows={3}
            label={t('household.addViaLink')}
            showProblems={false}
            onImport={(s, kind) => openPasteIn('inbox', s, kind)}
            onRecipe={(s, kind) => openPasteIn('add', s, kind)}
            onAi={() => navigate('/add?mode=ai')}
          />
          <div class="status" role="status">
            {pasteNotice}
          </div>
          {found?.problems.map((p, i) => (
            <p class="bad small" key={'p' + i}>
              {p}
            </p>
          ))}
          {nothingFound && <p class="bad small">{t('household.noCard')}</p>}
          {found && found.cards.length + found.progress.length > 0 && (
            <div class="member-cards">
              {found.cards.map((card) => (
                <MemberCardRow key={card.id} card={card} members={members} done={cardDone[card.id]} busy={cardBusy} onAdd={(c) => void addCard(c)} />
              ))}
              {found.progress.map((card) => (
                <ProgressCardRow
                  key={'x' + card.id}
                  card={card}
                  sentAt={found.progressAt[card.id]}
                  members={members}
                  done={progressDone[card.id]}
                  busy={cardBusy}
                  onSave={(c, asFriend) => void saveProgress(c, asFriend)}
                />
              ))}
            </div>
          )}
        </section>

        {adding ? (
          <section class="card">
            <h2>{t('household.add')}</h2>
            <MemberForm autoFocus submitLabel={t('household.add')} taken={takenFor()} onSubmit={add} onCancel={() => setAdding(false)} />
          </section>
        ) : (
          <button type="button" class="btn btn-block" disabled={!setting} onClick={() => setAdding(true)}>
            {t('household.add')}
          </button>
        )}
      </div>
    </>
  );
}
