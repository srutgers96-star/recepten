// '#/more/household' — Huishouden & vrienden (docs/phase-5-spec.md A.8 + block F; since V1c-2,
// docs/specs/verbeterronde-1c.md block V1c-2 §1b, "Mensen en sturen"): the household's name (setting
// `household.name`; empty = the default "Thuis" / "Home" in the active language, never stored) and
// one card "Mensen" with everyone: the profiles on this phone (automatic, edited via Profiles), then
// the other housemates, then the friends (`Member.role`, src/domain/household.ts `roleOf`), all
// non-local people stored in the `household` setting.
//   - On top of the card: "Voeg huisgenoot toe" · "Voeg vriend toe" · "Stuur mijn voortgang" (badges
//     off: "Stuur wie ik ben"; <SendSheet/> without a recipient).
//   - Per person (not a profile here), on their own line under the row: "Stuur" (<SendSheet/> with
//     that person), "Maak vriend" / "Maak huisgenoot" (src/people.ts `setMemberRole`, one tap),
//     "Stuur terug" (V1c-9: <ProgressReturnPanel/> under the row, with a stored progress and badges
//     on), "Bewerk" and "Verwijder".
//   - The add panel (one at a time, under the buttons): a Segmented "Huisgenoot | Vriend" preset by
//     the button that opened it, the ONE paste box (<UniversalPaste>, 13A: recipe links and website
//     recipes are handed on to In & uit / the editor; a text another paste box handed over arrives
//     through `pendingMemberText` and opens the panel), every person found in it as <PersonCardRow/>
//     ("Voeg {name} toe als {rol}" / "Werk {name} bij"; src/people.ts `applyPersonCard`), then "of"
//     and "Typ een naam" (name + colour for someone without the app, with the chosen role).
//   - V1c-9: a received progress of a profile on THIS phone with a higher XP than the profile has now
//     offers "Herstel mijn voortgang" (`restoreProgress`, src/progress-restore.ts).
//   - V1c-9b: stored progress that belongs to nobody in the list stays visible under the list with
//     "Stuur terug" and "Verwijder".
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { PersonCardRow, useBadgesState, type PersonOutcome, type RestoredInfo } from '@/components/PersonCardRow';
import { ProgressReturnPanel } from '@/components/ProgressSharePanel';
import { formatShortDate } from '@/components/RecipeRow';
import { Segmented, type SegOption } from '@/components/Segmented';
import { SendSheet } from '@/components/SendSheet';
import { UniversalPaste } from '@/components/UniversalPaste';
import { levelTitleText } from '@/components/XpBar';
import { useLive } from '@/db/live';
import { getHousehold, getProgressSnapshots, removeProgressSnapshot, setHousehold } from '@/db/repo';
import {
  friendsOf,
  housematesOf,
  memberFromProfile,
  membersFrom,
  newMemberId,
  putMember,
  removeMember,
  roleOf,
  type HouseholdSetting,
  type Member,
  type MemberCard,
  type MemberRole,
} from '@/domain/household';
import { classifyPaste } from '@/domain/paste-classify';
import { cleanPastedText } from '@/domain/photo-import';
import { bestSnapshotForMember, snapshotForMember, snapshotsForMember, type ProgressSnapshot } from '@/domain/progress';
import { parseEnvelope, type ParsedShare, type ProgressCard } from '@/domain/share';
import { decodeToken, extractTokenSpans, glueToken } from '@/domain/token';
import { t } from '@/i18n';
import { openPasteIn, pasteProblemOf } from '@/paste';
import { applyPersonCard, setMemberRole } from '@/people';
import { PROFILE_COLORS, activeProfile, profiles } from '@/profile';
import { restoreProgress } from '@/progress-restore';
import { navigate, pendingMemberText } from '@/router';
import { Avatar, useAvatarLevel } from './ProfilesScreen';

const NAME_DEBOUNCE_MS = 500;
const PASTE_DEBOUNCE_MS = 150;

interface MemberValues {
  name: string;
  color: string;
}

// --- The paste scan: every person in a pasted text -----------------------------------------------

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
  const cleaned = cleanPastedText(text);
  const tokens = extractTokenSpans(cleaned);
  if (tokens.length) {
    for (const tk of tokens) {
      try {
        const env = await decodeToken(tk.token);
        // The fragment key is part of the contract: "#f=" must carry a t:'f' envelope.
        if (env.t !== tk.key) throw new Error('invalid-token');
        take(parseEnvelope(env));
      } catch (e) {
        // V1c (10 Nov 2026): a link broken inside the token by a phone's paste — glue what follows back on first
        // (src/paste.ts does the same for the Inbox); still unreadable → the damaged-or-cut-short line with its length.
        const glued = glueToken(cleaned, tk.end);
        if (glued) {
          try {
            const env = await decodeToken(tk.token + glued);
            if (env.t !== tk.key) throw new Error('invalid-token');
            take(parseEnvelope(env));
            continue;
          } catch {
            /* fall through */
          }
        }
        out.problems.push(pasteProblemOf(e, tk.token));
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
    return out; // not JSON: nothing found
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

/**
 * True once the `badges.enabled` setting is known and on. Badges off = no level, streak or badge
 * count anywhere (docs/specs/xp-levels.md §1, §5.9); waiting for the setting keeps a level line
 * from flashing.
 */
function useBadgesOn(): boolean {
  return useBadgesState() === 'on';
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

/** The line of a stored progress that belongs to nobody (V1c-9b): its level and date, with badges on only. */
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

/** The key of a found person in the add panel's outcome map: who-I-am and progress apart. */
function foundKey(card: MemberCard | ProgressCard): string {
  return ('xp' in card ? 'x:' : 'f:') + card.id;
}

export function HouseholdScreen() {
  const [setting, setSettingState] = useState<HouseholdSetting | null>(null);
  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const nameTimer = useRef<number | null>(null);
  // V1c-2: the add panel (null = closed) with its chosen role, and whether "Typ een naam" is open.
  const [addRole, setAddRole] = useState<MemberRole | null>(null);
  const [typing, setTyping] = useState(false);
  // The paste box in the add panel and the people found in it.
  const [pasteText, setPasteText] = useState('');
  const [found, setFound] = useState<FoundCards | null>(null);
  const [done, setDone] = useState<Record<string, PersonOutcome>>({});
  const [pasteNotice, setPasteNotice] = useState('');
  const [cardBusy, setCardBusy] = useState(false);
  // V1c-9: what each restore reported (by card id), and the row whose "Stuur terug" panel is open (one at a time).
  const [restored, setRestored] = useState<Record<string, RestoredInfo>>({});
  const [returning, setReturning] = useState<string | null>(null);
  // V1c-2: the Stuur-venster (SendSheet); recipient null = "Stuur mijn voortgang" for someone not in the list.
  const [sending, setSending] = useState<{ recipient: Member | null } | null>(null);
  const badges = useBadgesState();
  const badgesOn = badges === 'on';
  const snapshots = useLive(getProgressSnapshots, []);
  const pasteSeq = useRef(0);
  const pasteBox = useRef<HTMLTextAreaElement>(null);
  const list = profiles.value;
  const me = activeProfile.value;

  useEffect(() => {
    let cancelled = false;
    // 13A: a text with people that another paste box (editor, Inbox) handed over: open the add panel with it.
    const handed = pendingMemberText.value;
    if (handed) {
      pendingMemberText.value = null;
      setAddRole('housemate');
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
  const localMembers = useMemo(() => members.filter((m) => m.local), [members]);
  const housemates = useMemo(() => housematesOf(members).filter((m) => !m.local), [members]);
  const friends = useMemo(() => friendsOf(members), [members]);
  // V1c-9b: stored progress that belongs to nobody in the list (the person was renamed or removed,
  // or came back with another id and name). Shown under the list so it can still be sent back.
  const orphans = useMemo(() => {
    const all = snapshots ?? {};
    const owned = new Set<string>();
    for (const m of members) for (const s of snapshotsForMember(m, all)) owned.add(s.id);
    return Object.values(all)
      .filter((s) => !owned.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshots, members]);

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

  /** "Typ een naam": someone without the app, with the role chosen in the panel. */
  async function add(v: MemberValues) {
    if (!setting || !addRole) return;
    await save(putMember(setting, { id: newMemberId(), name: v.name, color: v.color, local: false, role: addRole }));
    closePanel();
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
    if (returning === m.id) setReturning(null);
  }

  /** "Maak vriend" / "Maak huisgenoot": one tap, no confirmation; the id (and so the snapshot and cooking days) stays. */
  async function toggleRole(m: Member) {
    try {
      setSettingState(await setMemberRole(m.id, roleOf(m) === 'friend' ? 'housemate' : 'friend'));
    } catch (e) {
      console.error('setMemberRole', e);
    }
  }

  /** "Verwijder" on a stored progress that belongs to nobody (V1c-9b): the snapshot goes. */
  async function removeOrphan(s: ProgressSnapshot) {
    try {
      await removeProgressSnapshot(s.id);
    } catch (e) {
      console.error('removeProgressSnapshot', e);
    }
  }

  /** "Voeg huisgenoot toe" / "Voeg vriend toe": the panel opens with that role (an open panel only switches role). */
  function openPanel(role: MemberRole) {
    setAddRole(role);
    window.setTimeout(() => pasteBox.current?.focus({ preventScroll: true }), 0);
  }

  function closePanel() {
    setAddRole(null);
    setTyping(false);
    setPasteText('');
    setFound(null);
    setDone({});
    setPasteNotice('');
  }

  // Analyse the pasted text (debounced): every `#f=` / `#x=` becomes a person row. A new text starts
  // with fresh rows: the outcome of an earlier paste never sticks to a re-pasted card. Anything that is
  // not a token or a raw envelope (a website recipe, prose) is left to the paste box's own line and buttons (13A).
  useEffect(() => {
    const my = ++pasteSeq.current;
    const trimmed = pasteText.trim();
    const kind = trimmed ? classifyPaste(trimmed).kind : 'empty';
    if (!trimmed || !(kind === 'member' || kind === 'tokens' || kind === 'bundle')) {
      setFound(null);
      setDone({});
      return;
    }
    const handle = window.setTimeout(() => {
      void readMemberCards(trimmed)
        .then((got) => {
          if (my !== pasteSeq.current) return;
          setFound(got);
          setDone({});
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
   * no text (so the effect above does not run): reset the outcomes here too, so the row shows its
   * current status again.
   */
  function onPasteText(s: string) {
    setPasteNotice('');
    setDone({});
    setPasteText(s);
  }

  /** "Voeg {name} toe als {rol}" / "Werk {name} bij" on a found person (src/people.ts applyPersonCard; it logs the 'in' row). */
  async function addPerson(card: MemberCard | ProgressCard, role: MemberRole) {
    if (cardBusy) return;
    setCardBusy(true);
    setPasteNotice('');
    try {
      const r = await applyPersonCard(card, role);
      setSettingState(r.setting);
      setDone((prev) => ({ ...prev, [foundKey(card)]: r.outcome }));
    } catch (e) {
      console.error('applyPersonCard', e);
      setPasteNotice(t('common.error'));
    } finally {
      setCardBusy(false);
    }
  }

  /**
   * V1c-9 "Herstel mijn voortgang" (confirmed in the row): level, badges and the 90 cooking days back
   * from the card, quietly (src/progress-restore.ts); a failure says "Er ging iets mis".
   */
  async function restore(card: ProgressCard, profileId: string) {
    if (cardBusy) return;
    setCardBusy(true);
    setPasteNotice('');
    try {
      const r = await restoreProgress(profileId, card);
      setRestored((prev) => ({ ...prev, [card.id]: { level: r.level, cookDaysAdded: r.cookDaysAdded, badgesAdded: r.badgesAdded } }));
      setDone((prev) => ({ ...prev, [foundKey(card)]: 'restored' }));
    } catch (e) {
      console.error('restoreProgress', e);
      setPasteNotice(t('common.error'));
    } finally {
      setCardBusy(false);
    }
  }

  const takenFor = (except?: string) => members.filter((m) => m.id !== except).map((m) => m.name);
  const housemateCount = localMembers.length + housemates.length;
  const count = housemateCount === 1 ? t('household.memberOne') : t('household.memberCount', { n: housemateCount });
  const roleOptions: SegOption<MemberRole>[] = [
    { value: 'housemate', label: t('people.housemate') },
    { value: 'friend', label: t('people.friend') },
  ];
  // Badges off: "Stuur wie ik ben" (only who you are travels, the `#f=` token).
  const sendMineLabel = badges === 'off' ? t('people.sendMineIdentity') : t('people.sendMine');

  /** One person in the list: a profile here (no actions) or someone stored here (actions on their own line). */
  function personRow(m: Member) {
    // V1c-9b: a member's id may have changed (a new phone, a wiped phone); the snapshots are matched
    // by id, phone or name. Newest for the level line, the highest for "Stuur terug".
    const snapNewest = m.local ? undefined : snapshotForMember(m, snapshots ?? {});
    const snapBest = m.local ? undefined : bestSnapshotForMember(m, snapshots ?? {});
    const role = roleOf(m);
    return (
      <li key={m.id} class="member-row-wrap">
        {editing === m.id && !m.local ? (
          <MemberForm initial={m} submitLabel={t('common.save')} taken={takenFor(m.id)} onSubmit={(v) => edit(m, v)} onCancel={() => setEditing(null)} />
        ) : (
          <div class={'member-row' + (m.local ? '' : ' many')}>
            <Avatar profile={m} />
            <div class="who">
              <strong>
                {m.name}
                {!m.local && <span class="who-tag">{t(role === 'friend' ? 'people.roleFriend' : 'people.roleHousemate')}</span>}
              </strong>
              <MemberLevelLine member={m} snapshot={snapNewest} />
              <span class="muted small">{m.local ? t('household.local') : m.deviceId ? t('people.viaApp') : t('household.byHand')}</span>
            </div>
            {!m.local && (
              <div class="actions">
                {me && (
                  <button type="button" class="btn btn-small" onClick={() => setSending({ recipient: m })}>
                    {t('people.send')}
                  </button>
                )}
                <button type="button" class="btn btn-small" onClick={() => void toggleRole(m)}>
                  {t(role === 'friend' ? 'people.makeHousemate' : 'people.makeFriend')}
                </button>
                {/* V1c-9: someone on another phone with a stored snapshot can get it back. */}
                {badgesOn && snapBest && (
                  <button type="button" class="btn btn-small" aria-expanded={returning === m.id} onClick={() => setReturning((v) => (v === m.id ? null : m.id))}>
                    {t('progress.returnBtn')}
                  </button>
                )}
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
        {badgesOn && !m.local && returning === m.id && editing !== m.id && snapBest && <ProgressReturnPanel snapshot={snapBest} />}
      </li>
    );
  }

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

        <section class="card people">
          <h2>
            {t('people.title')} <span class="muted small">· {count}</span>
          </h2>
          <div class="people-actions">
            <button type="button" class={'btn btn-small' + (addRole === 'housemate' ? ' btn-primary' : '')} disabled={!setting} aria-expanded={addRole === 'housemate'} onClick={() => openPanel('housemate')}>
              {t('people.addHousemate')}
            </button>
            <button type="button" class={'btn btn-small' + (addRole === 'friend' ? ' btn-primary' : '')} disabled={!setting} aria-expanded={addRole === 'friend'} onClick={() => openPanel('friend')}>
              {t('people.addFriend')}
            </button>
            {me && (
              <button type="button" class="btn btn-small" onClick={() => setSending({ recipient: null })}>
                {sendMineLabel}
              </button>
            )}
          </div>

          {addRole && (
            <div class="add-panel">
              <div class="add-panel-head">
                <Segmented name="add-role" options={roleOptions} selected={[addRole]} onChange={(next) => next[0] && setAddRole(next[0])} />
                <button type="button" class="btn btn-small" onClick={closePanel}>
                  {t('common.close')}
                </button>
              </div>
              <p class="muted small">{t('people.pasteHint')}</p>
              {/* 13A: the universal paste box; people are handled right here (no onMember = the rows below). */}
              <UniversalPaste
                defaultAction="member"
                value={pasteText}
                onChange={onPasteText}
                textareaRef={pasteBox}
                rows={3}
                label={t('people.pasteHint')}
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
              {nothingFound && <p class="bad small">{t('inbox.noToken')}</p>}
              {found && found.cards.length + found.progress.length > 0 && (
                <div class="member-cards">
                  {found.cards.map((card) => (
                    <PersonCardRow key={foundKey(card)} card={card} members={members} role={addRole} done={done[foundKey(card)]} busy={cardBusy} onAdd={(c, r) => void addPerson(c, r)} />
                  ))}
                  {found.progress.map((card) => (
                    <PersonCardRow
                      key={foundKey(card)}
                      card={card}
                      sentAt={found.progressAt[card.id]}
                      members={members}
                      role={addRole}
                      done={done[foundKey(card)]}
                      busy={cardBusy}
                      onAdd={(c, r) => void addPerson(c, r)}
                      onRestore={(c, profileId) => void restore(c, profileId)}
                      restored={restored[card.id]}
                    />
                  ))}
                </div>
              )}
              <p class="or">{t('people.or')}</p>
              {typing ? (
                <MemberForm autoFocus submitLabel={t('household.addSubmit')} taken={takenFor()} onSubmit={add} onCancel={() => setTyping(false)} />
              ) : (
                <button type="button" class="btn btn-block" onClick={() => setTyping(true)}>
                  {t('people.typeName')}
                </button>
              )}
            </div>
          )}

          <ul class="member-list">
            {localMembers.map(personRow)}
            {housemates.map(personRow)}
            {friends.map(personRow)}
          </ul>
          {orphans.length > 0 && (
            <>
              <p class="muted small">{t('progress.orphans')}</p>
              <ul class="member-list">
                {orphans.map((s) => (
                  <li key={s.id} class="member-row-wrap">
                    <div class="member-row">
                      <Avatar profile={s} />
                      <div class="who">
                        <strong>{s.name}</strong>
                        <FriendLevelLine snapshot={s} />
                      </div>
                      <div class="actions">
                        {badgesOn && (
                          <button type="button" class="btn btn-small" aria-expanded={returning === s.id} onClick={() => setReturning((v) => (v === s.id ? null : s.id))}>
                            {t('progress.returnBtn')}
                          </button>
                        )}
                        <button type="button" class="btn btn-small btn-danger" onClick={() => void removeOrphan(s)}>
                          {t('household.remove')}
                        </button>
                      </div>
                    </div>
                    {badgesOn && returning === s.id && <ProgressReturnPanel snapshot={s} />}
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* V1 (docs/specs/verbeterronde-1.md §1c point 7): only with more than one profile on this phone. */}
          {list.length > 1 && (
            <div class="actions" style="margin:8px 0 0">
              <button type="button" class="btn btn-small" onClick={() => navigate('/more/profiles')}>
                {t('household.manageProfiles')}
              </button>
            </div>
          )}
        </section>
      </div>
      {sending && me && <SendSheet profile={me} recipient={sending.recipient} onClose={() => setSending(null)} />}
    </>
  );
}
