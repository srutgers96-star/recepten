// '#/more/profiles' — list of profiles: add, edit, switch active, delete (confirm). `?add=1` opens
// the add form at once ("+ profiel" in Meer). ProfileForm is reused by the onboarding screen.
import { useEffect, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import type { Lang, Profile } from '@/domain/model';
import { lang, t } from '@/i18n';
import { PROFILE_COLORS, activeProfile, createProfile, profiles, removeProfile, setActiveProfile, updateProfile } from '@/profile';
import { route } from '@/router';

export interface ProfileValues {
  name: string;
  lang: Lang;
  color: string;
}

/** Coloured circle with the first letter of the name. */
export function Avatar(props: { profile: Pick<Profile, 'name' | 'color'>; big?: boolean }) {
  return (
    <span class={'avatar' + (props.big ? ' big' : '')} style={{ background: props.profile.color }} aria-hidden="true">
      {props.profile.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** Name + language + colour form (add, edit and onboarding). */
export function ProfileForm(props: {
  initial?: Partial<ProfileValues>;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (values: ProfileValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(props.initial?.name ?? '');
  const [l, setL] = useState<Lang>(props.initial?.lang ?? lang.value);
  const [color, setColor] = useState(props.initial?.color ?? PROFILE_COLORS[profiles.value.length % PROFILE_COLORS.length] ?? '#2b4fa8');
  const [busy, setBusy] = useState(false);
  const valid = name.trim() !== '';

  async function submit(e: Event) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await props.onSubmit({ name: name.trim(), lang: l, color });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="stack" onSubmit={(e) => void submit(e)}>
      <label class="field">
        <span>{t('profiles.name')}</span>
        <input
          class="input"
          type="text"
          autocomplete="given-name"
          autoFocus={props.autoFocus}
          placeholder={t('profiles.namePlaceholder')}
          value={name}
          onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <div class="field">
        <span>{t('profiles.language')}</span>
        <Segmented<Lang>
          name="profile-lang"
          options={[
            { value: 'nl', label: t('lang.nl') },
            { value: 'en', label: t('lang.en') },
          ]}
          selected={[l]}
          onChange={(v) => {
            if (v[0]) setL(v[0]);
          }}
        />
      </div>
      <div class="field">
        <span>{t('profiles.color')}</span>
        <div class="swatches" role="radiogroup" aria-label={t('profiles.color')}>
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={c}
              class={'swatch' + (c === color ? ' on' : '')}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary" disabled={!valid || busy}>
          {props.submitLabel}
        </button>
        {props.onCancel && (
          <button type="button" class="btn" onClick={props.onCancel}>
            {t('common.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}

export function ProfilesScreen() {
  const list = profiles.value;
  const active = activeProfile.value;
  const [adding, setAdding] = useState(route.value.query.get('add') === '1');
  const [editing, setEditing] = useState<string | null>(null);

  // "+ profiel" from Meer arrives with ?add=1; a later visit to the plain route closes the form.
  useEffect(() => {
    if (route.value.query.get('add') === '1') setAdding(true);
  }, [route.value.query]);

  async function remove(p: Profile) {
    if (!confirm(t('profiles.deleteConfirm', { name: p.name }))) return;
    await removeProfile(p.id);
    if (editing === p.id) setEditing(null);
  }

  return (
    <>
      <Header title={t('profiles.title')} back backLabel={t('common.back')} />
      <div class="screen form">
        <p class="muted" style="padding-top:12px">
          {t('profiles.intro')} <strong>{active?.name ?? '—'}</strong>
        </p>

        {list.length === 0 && <div class="empty">{t('profiles.empty')}</div>}

        {list.map((p) => (
          <div class="card" key={p.id}>
            {editing === p.id ? (
              <ProfileForm
                initial={p}
                submitLabel={t('common.save')}
                onSubmit={async (v) => {
                  await updateProfile({ ...p, ...v });
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <div class="profile-card">
                  <Avatar profile={p} />
                  <div class="who">
                    <strong>{p.name}</strong>
                    <span class="muted small">
                      {t(p.lang === 'nl' ? 'lang.nl' : 'lang.en')}
                      {active?.id === p.id && (
                        <>
                          {' '}
                          <span class="badge badge-green">{t('profiles.active')}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div class="actions" style="margin-bottom:0">
                  {active?.id !== p.id && (
                    <button type="button" class="btn btn-primary btn-small" onClick={() => void setActiveProfile(p.id)}>
                      {t('profiles.use')}
                    </button>
                  )}
                  <button type="button" class="btn btn-small" onClick={() => setEditing(p.id)}>
                    {t('profiles.edit')}
                  </button>
                  <button type="button" class="btn btn-small btn-danger" onClick={() => void remove(p)}>
                    {t('profiles.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {adding ? (
          <div class="card">
            <h2>{t('profiles.add')}</h2>
            <ProfileForm
              autoFocus
              submitLabel={t('profiles.add')}
              onSubmit={async (v) => {
                await createProfile(v);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button type="button" class="btn btn-block" onClick={() => setAdding(true)}>
            {t('more.addProfile')}
          </button>
        )}
      </div>
    </>
  );
}
