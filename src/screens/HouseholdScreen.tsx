// '#/more/household' — the household (docs/phase-5-spec.md A.8 + block F): its name (setting
// `household.name`; empty = the default "Thuis" / "Home" in the active language, never stored)
// and its members: the profiles on this phone (automatic, edited via Profiles) plus members added
// by hand (name + colour) or received as a MEMBER CARD (`#f=` token, src/domain/household.ts
// `upsertMemberFromCard`), all stored in the `household` setting.
//   - "Mijn kaartje": <MemberCardPanel/> (ProfilesScreen) for the active profile.
//   - "Voeg lid toe via link of plak": a paste box; every `#f=` in the text becomes a card row with
//     "Voeg <naam> toe aan je huishouden" (`readMemberCards`, `MemberCardRow`, `applyMemberCard`;
//     the Inbox reuses the last two). Works by pasting (iPhone, invariant 5) and by link (Android
//     → Inbox).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { getHousehold, setHousehold } from '@/db/repo';
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
import { parseEnvelope, type ParsedShare } from '@/domain/share';
import { decodeToken, extractTokens } from '@/domain/token';
import { t } from '@/i18n';
import { PROFILE_COLORS, activeProfile, profiles } from '@/profile';
import { navigate } from '@/router';
import { Avatar, MemberCardPanel } from './ProfilesScreen';

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
  /** Human-readable problems per part (invalid code, newer version …). */
  problems: string[];
  /** Tokens that were something else (a recipe, a plan): "plak het in de Inbox". */
  others: number;
}

function problemOf(e: unknown): string {
  return (e as Error)?.message === 'unsupported-version' ? t('inbox.unsupported') : t('inbox.invalid');
}

/**
 * Every member card in a pasted text: the `#f=` tokens (a WhatsApp message, a bare link), else one
 * raw JSON envelope. Other kinds of token are counted in `others`; the same card twice counts once.
 */
export async function readMemberCards(text: string): Promise<FoundCards> {
  const out: FoundCards = { cards: [], problems: [], others: 0 };
  const seen = new Set<string>();
  const take = (parsed: ParsedShare) => {
    if (parsed.kind === 'member' && parsed.member) {
      if (seen.has(parsed.member.id)) return;
      seen.add(parsed.member.id);
      out.cards.push(parsed.member);
    } else out.others++;
  };
  const tokens = extractTokens(text);
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
  const s = text.trim();
  if (s.startsWith('{')) {
    let value: unknown;
    try {
      value = JSON.parse(s);
    } catch {
      return out; // not JSON: "geen kaartje gevonden"
    }
    try {
      take(parseEnvelope(value));
    } catch (e) {
      out.problems.push(problemOf(e));
    }
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
  const pasteSeq = useRef(0);
  const pasteBox = useRef<HTMLTextAreaElement>(null);
  const list = profiles.value;
  const me = activeProfile.value;

  useEffect(() => {
    let cancelled = false;
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
    if (editing === m.id) setEditing(null);
  }

  // Analyse the pasted text (debounced): every `#f=` becomes a card row. A new text starts with
  // fresh rows: the "is toegevoegd" outcome of an earlier paste never sticks to a re-pasted card
  // (it then says "al lid" + "Werk bij", like the Inbox).
  useEffect(() => {
    const my = ++pasteSeq.current;
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setFound(null);
      setCardDone({});
      return;
    }
    const handle = window.setTimeout(() => {
      void readMemberCards(trimmed)
        .then((got) => {
          if (my !== pasteSeq.current) return;
          setFound(got);
          setCardDone({});
        })
        .catch((e: unknown) => {
          console.warn('readMemberCards', e);
          if (my === pasteSeq.current) setFound({ cards: [], problems: [t('inbox.invalid')], others: 0 });
        });
    }, PASTE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [pasteText]);

  // readText() must run inside the tap (iOS shows its Paste callout only then).
  function pasteFromClipboard() {
    setPasteNotice('');
    if (!navigator.clipboard?.readText) {
      setPasteNotice(t('inbox.pasteFailed'));
      pasteBox.current?.focus();
      return;
    }
    navigator.clipboard
      .readText()
      .then((s) => {
        if (s) {
          // The same message pasted again changes no text (so the effect above does not run):
          // reset the outcomes here too, so the card row shows its current status again.
          setCardDone({});
          setPasteText(s);
        } else setPasteNotice(t('inbox.pasteFailed'));
      })
      .catch(() => {
        setPasteNotice(t('inbox.pasteFailed'));
        pasteBox.current?.focus();
      });
  }

  async function addCard(card: MemberCard) {
    if (cardBusy) return;
    setCardBusy(true);
    setPasteNotice('');
    try {
      const r = await applyMemberCard(card);
      setSettingState(r.setting);
      setCardDone((prev) => ({ ...prev, [card.id]: r.outcome }));
    } catch (e) {
      console.error('applyMemberCard', e);
      setPasteNotice(`${t('household.cardFailed')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setCardBusy(false);
    }
  }

  const takenFor = (except?: string) => members.filter((m) => m.id !== except).map((m) => m.name);
  const count = members.length === 1 ? t('household.memberOne') : t('household.memberCount', { n: members.length });
  const nothingFound = found !== null && found.cards.length === 0 && found.problems.length === 0;

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

        <section class="card member-paste">
          <h2>{t('household.addViaLink')}</h2>
          <p class="muted small">{t('household.addViaLinkHint')}</p>
          <textarea class="input" ref={pasteBox} rows={3} value={pasteText} autocomplete="off" spellcheck={false} aria-label={t('household.addViaLink')} onInput={(e) => setPasteText((e.currentTarget as HTMLTextAreaElement).value)} />
          <div class="actions">
            <button type="button" class="btn btn-primary" onClick={pasteFromClipboard}>
              {t('inbox.paste')}
            </button>
            {pasteText && (
              <button type="button" class="btn btn-small" onClick={() => setPasteText('')}>
                {t('inbox.clear')}
              </button>
            )}
          </div>
          <p class="muted small">{t('inbox.pasteHint')}</p>
          <div class="status" role="status">
            {pasteNotice}
          </div>
          {found?.problems.map((p, i) => (
            <p class="bad small" key={'p' + i}>
              {p}
            </p>
          ))}
          {nothingFound && <p class="bad small">{found && found.others > 0 ? t('household.notACard') : t('household.noCard')}</p>}
          {found && found.cards.length > 0 && (
            <div class="member-cards">
              {found.cards.map((card) => (
                <MemberCardRow key={card.id} card={card} members={members} done={cardDone[card.id]} busy={cardBusy} onAdd={(c) => void addCard(c)} />
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
