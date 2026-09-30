// '#/more/household' — the household (docs/phase-5-spec.md A.8): its name (setting
// `household.name`; empty = the default "Thuis" / "Home" in the active language, never stored)
// and its members: the profiles on this phone (automatic,
// edited via Profiles) plus members added by hand (name + colour, stored in the `household`
// setting, src/domain/household.ts). Member cards via link / QR arrive in block F; this screen
// says so honestly instead of pretending.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { getHousehold, setHousehold } from '@/db/repo';
import { membersFrom, newMemberId, putMember, removeMember, type HouseholdSetting, type Member } from '@/domain/household';
import { t } from '@/i18n';
import { PROFILE_COLORS, profiles } from '@/profile';
import { navigate } from '@/router';
import { Avatar } from './ProfilesScreen';

const NAME_DEBOUNCE_MS = 500;

interface MemberValues {
  name: string;
  color: string;
}

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
  const list = profiles.value;

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

  const members = useMemo(() => (setting ? membersFrom(list, setting) : list.map((p) => ({ id: p.id, name: p.name, color: p.color, lang: p.lang, local: true }) as Member)), [list, setting]);

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

  const takenFor = (except?: string) => members.filter((m) => m.id !== except).map((m) => m.name);
  const count = members.length === 1 ? t('household.memberOne') : t('household.memberCount', { n: members.length });

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
