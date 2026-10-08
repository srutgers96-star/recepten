// '#/more/profiles' — list of profiles: add, edit, switch active, delete (confirm). `?add=1` opens
// the add form at once ("+ profiel" in Meer). ProfileForm is reused by the onboarding screen.
// Phase 5 block F: the ACTIVE profile has "Deel mijn kaartje" (<MemberCardPanel/>, also on the
// Household screen): a `#f=` token with id, name, colour, language and this phone's stable id
// (setting 'device.id', `ensureDeviceId`), shared as ONE text field (invariant 9), copied, or
// shown as a QR behind the Experimenten flag. The panel says honestly that on an iPhone the
// other person copies the message and pastes it into the app (invariants 5 + 13).
import { useEffect, useState } from 'preact/hooks';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { QrCode } from '@/components/QrCode';
import { Segmented } from '@/components/Segmented';
import { getSetting, setSetting } from '@/db/repo';
import { cardFromMember } from '@/domain/household';
import { randomId, type Lang, type Profile } from '@/domain/model';
import { buildMemberEnvelope, buildMemberShareMessage } from '@/domain/share';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { lang, t } from '@/i18n';
import { PROFILE_COLORS, activeProfile, createProfile, profiles, removeProfile, setActiveProfile, updateProfile } from '@/profile';
import { route } from '@/router';
import { copyText, shareText } from '@/share-actions';

export interface ProfileValues {
  name: string;
  lang: Lang;
  color: string;
}

/** Setting with this phone's stable random id (travels in member cards as `deviceId`). */
export const DEVICE_ID_KEY = 'device.id';

/** The stable id of this phone, created on first use ('d:' + 8 chars [a-z0-9]). */
export async function ensureDeviceId(): Promise<string> {
  const have = await getSetting<unknown>(DEVICE_ID_KEY, null);
  if (typeof have === 'string' && have.trim()) return have;
  const id = randomId('d:');
  await setSetting(DEVICE_ID_KEY, id);
  return id;
}

/**
 * The WhatsApp text for a card: one sentence in the SENDER's language (it says "open the link in
 * the app OR paste it into Inbox", honest for iPhone), the `#f=` link alone on the last line.
 * The sentence lives in the domain layer (share.ts) so the landing page and the tests share it.
 */
export function memberCardMessage(name: string, l: Lang, url: string): string {
  return buildMemberShareMessage({ name, url, lang: l });
}

/** Coloured circle with the first letter of the name. */
export function Avatar(props: { profile: Pick<Profile, 'name' | 'color'>; big?: boolean }) {
  return (
    <span class={'avatar' + (props.big ? ' big' : '')} style={{ background: props.profile.color }} aria-hidden="true">
      {props.profile.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/**
 * "Deel mijn kaartje" for one profile: builds the `#f=` link once (device id + token), then
 * shares it as text (navigator.share with exactly {text}, inside the tap), copies it, or shows
 * the QR (Experimenten flag). The link is rebuilt when the profile's name/colour/language change.
 */
export function MemberCardPanel(props: { profile: Profile }) {
  const p = props.profile;
  const [url, setUrl] = useState<string | null>(null);
  const [buildFailed, setBuildFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [experiments, setExperiments] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setBuildFailed(false);
    setStatus('');
    setShowRaw(false);
    (async () => {
      const deviceId = await ensureDeviceId();
      const token = await encodeToken(buildMemberEnvelope(cardFromMember(p, deviceId)));
      if (!cancelled) setUrl(buildShareUrl(appInfo.appUrl, 'f', token));
    })().catch((e: unknown) => {
      console.error('member card', e);
      if (!cancelled) setBuildFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [p.id, p.name, p.color, p.lang]);

  // "Toon QR" exists only while the Experimenten flag is on (flag off = no trace), like ShareScreen.
  useEffect(() => {
    let cancelled = false;
    getSetting<unknown>('experiments', false)
      .then((v) => {
        if (!cancelled) setExperiments(v === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const message = url ? memberCardMessage(p.name, p.lang, url) : '';

  function share() {
    if (!message || busy) return;
    setBusy(true);
    setStatus('');
    // navigator.share runs before the first await inside shareText: still within the tap.
    void shareText(message)
      .then((r) => {
        if (r.outcome === 'shared') setStatus(t('household.cardShared'));
        else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
        else if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  function copy() {
    if (!message) return;
    void copyText(message).then((r) => {
      if (r.ok) setStatus(t('household.cardCopied'));
      else {
        // The clipboard refused (http dev server, permissions): show the text to copy by hand.
        setStatus(t('share.copyError'));
        setShowRaw(true);
      }
    });
  }

  return (
    <div class="member-card-share">
      <p class="muted small">{t('household.myCardHint')}</p>
      {buildFailed && <p class="bad small">{t('household.cardBuildFailed')}</p>}
      <div class="actions">
        <button type="button" class="btn btn-primary" disabled={!url || busy} onClick={share}>
          {t('household.shareCard')}
        </button>
        <button type="button" class="btn" disabled={!url} onClick={copy}>
          {t('household.copyCard')}
        </button>
      </div>
      {showRaw && <textarea class="input member-card-raw" readOnly rows={3} value={message} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />}
      <p class="muted small">{t('household.cardIosHint')}</p>
      {experiments && (
        <div class="share-qr">
          <button type="button" class="btn" disabled={!url} onClick={() => setShowQr((v) => !v)}>
            {showQr ? t('share.qrHide') : t('share.qrShow')}
          </button>
          {showQr && url && (
            <>
              <QrCode text={url} label={t('household.cardQrAlt')} />
              <p class="muted small share-qr-hint">{t('household.cardQrHint')}</p>
            </>
          )}
        </div>
      )}
      <div class="status" role="status">
        {status}
      </div>
    </div>
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
  // Block F: "Deel mijn kaartje" unfolds the card panel under the ACTIVE profile.
  const [sharing, setSharing] = useState(false);

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
                  {active?.id === p.id && (
                    <button type="button" class="btn btn-small" aria-expanded={sharing} onClick={() => setSharing((v) => !v)}>
                      {t('household.shareCard')}
                    </button>
                  )}
                </div>
                {active?.id === p.id && sharing && <MemberCardPanel profile={p} />}
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
