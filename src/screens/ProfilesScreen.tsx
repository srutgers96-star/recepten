// '#/more/profiles' — list of profiles: add, edit, switch active, delete (confirm). `?add=1` opens
// the add form at once ("+ profiel" in Meer). ProfileForm is reused by the onboarding screen.
// Phase 5 block F: the ACTIVE profile has "Deel mijn kaartje" (<MemberCardPanel/>, also on the
// Household screen): a `#f=` token with id, name, colour, language and this phone's stable id
// (setting 'device.id', `ensureDeviceId`), shared as ONE text field (invariant 9), copied, or
// shown as a QR behind the Experimenten flag. The panel says honestly that on an iPhone the
// other person copies the message and pastes it into the app (invariants 5 + 13).
// 6D-1: every profile card shows <XpBar/> (level, XP, streak) under name + language.
// 6D-3 (docs/specs/badges-avatar.md §1b/§1c): <Avatar/> draws the profile's own avatar (SVG from
// data/avatar-parts.json) when it has a complete one, else the letter circle; a card shows the
// level ring. Editing the ACTIVE profile has a row "Avatar" under Colour that opens <AvatarSheet/>
// from level 3 (AVATAR_MAKER_LEVEL); badges off = no row.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { avatarParts, avatarUid } from '@/avatar';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { AvatarSheet } from '@/components/AvatarSheet';
import { Header } from '@/components/Header';
import { QrCode } from '@/components/QrCode';
import { Segmented } from '@/components/Segmented';
import { XpBar } from '@/components/XpBar';
import { getSetting, logShareEvent, setSetting } from '@/db/repo';
import { AVATAR_MAKER_LEVEL, isComplete, normalizeAvatarSpec, renderAvatarSvg } from '@/domain/avatar';
import { cardFromMember } from '@/domain/household';
import { nowIso, randomId, type Lang, type Profile } from '@/domain/model';
import { buildMemberEnvelope, buildMemberShareMessage } from '@/domain/share';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';
import { PROFILE_COLORS, activeProfile, createProfile, profiles, removeProfile, setActiveProfile, updateProfile } from '@/profile';
import { route } from '@/router';
import { copyText, shareText } from '@/share-actions';
import { markXpDirty, xpStateFor, xpStates } from '@/xp';

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

/**
 * The avatar SVG of a profile or member, or null when it has no complete avatar (§1c: then the
 * letter circle). The stored spec is normalised again here (a restored backup or a card is never
 * trusted blindly); unknown part ids are skipped by `renderAvatarSvg`.
 */
function avatarSvgFor(profile: Pick<Profile, 'color' | 'avatar'>, level: number, uid: string): string | null {
  const spec = normalizeAvatarSpec(profile.avatar);
  if (!spec) return null;
  const parts = avatarParts();
  if (!isComplete(spec, parts)) return null;
  return renderAvatarSvg(spec, parts, { color: profile.color, level, uid });
}

/** True when the profile has a complete avatar (the maker's button then says "Pas je avatar aan"). */
export function hasAvatar(profile: Pick<Profile, 'avatar'>): boolean {
  const spec = normalizeAvatarSpec(profile.avatar);
  return spec !== null && isComplete(spec, avatarParts());
}

/**
 * The profile circle (docs/specs/badges-avatar.md §1c): a complete avatar is drawn as SVG inside the
 * existing `.avatar` circle (same size everywhere: 40/56 px, 32 px in chips), otherwise the coloured
 * circle with the first letter. `level` adds the ring of that level (from level 5, `ringForLevel`);
 * only the Home greeting, the Meer profile card and Profielen pass it. A member from another phone
 * has no level here, so no ring.
 */
export function Avatar(props: { profile: Pick<Profile, 'name' | 'color' | 'avatar'>; big?: boolean; level?: number }) {
  const { profile } = props;
  const level = props.level ?? 0;
  // One uid per mounted circle, so two avatars on one screen never share a clipPath/gradient id.
  const [uid] = useState(avatarUid);
  const specKey = JSON.stringify(profile.avatar ?? null);
  const svg = useMemo(() => avatarSvgFor(profile, level, uid), [specKey, profile.color, level, uid]);
  const cls = 'avatar' + (props.big ? ' big' : '');
  if (svg !== null) {
    // The markup comes ONLY from data/avatar-parts.json (checked by validateAvatarParts: no <script,
    // no href=, no style= except the tone/hair fills); the spec only picks part ids and palette
    // colours, and renderAvatarSvg takes the profile colour only as a plain CSS colour. No free user
    // input reaches the string, so innerHTML is safe here.
    return <span class={cls + ' has-svg'} style={{ background: profile.color }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
  }
  return (
    <span class={cls} style={{ background: profile.color }} aria-hidden="true">
      {profile.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/**
 * The member's level for the avatar ring and the maker's gate (§1b/§1c): the derived XP level from
 * `xpStates`, asked once with the quiet `xpStateFor` read (never a reward moment). Undefined while
 * it is not known yet, without a member, and whenever badges are off (no trace of XP then: no ring,
 * no maker).
 */
export function useAvatarLevel(memberId: string | null | undefined): number | undefined {
  const [ready, setReady] = useState(false);
  const on = badgesEnabled.value;
  useEffect(() => {
    let cancelled = false;
    void loadBadgeSettings()
      .then(() => {
        if (cancelled) return null;
        setReady(true);
        return badgesEnabled.value && memberId ? xpStateFor(memberId) : null;
      })
      .catch((e: unknown) => console.error('xpStateFor', e));
    return () => {
      cancelled = true;
    };
  }, [memberId, on]);
  if (!ready || !on || !memberId) return undefined;
  return xpStates.value.get(memberId)?.level;
}

/** <Avatar/> with the level ring of that profile (a profile card on Profielen). */
function LevelAvatar(props: { profile: Profile; big?: boolean }) {
  const level = useAvatarLevel(props.profile.id);
  return <Avatar profile={props.profile} big={props.big} level={level} />;
}

/**
 * The row "Avatar" under Colour when editing the ACTIVE profile (§1b): "Maak je avatar" or, with an
 * avatar, "Pas je avatar aan". Below level 3 the button is disabled with "Komt vrij op level 3, ...";
 * while the level is still loading it is disabled without that line. The caller leaves the row out
 * with badges off and for other profiles (the level is per person).
 */
function AvatarEditRow(props: { profile: Profile; level: number | undefined; onOpen: () => void }) {
  const unlocked = props.level !== undefined && props.level >= AVATAR_MAKER_LEVEL;
  return (
    <div class="field avatar-edit-row">
      <span>{t('avatar.row')}</span>
      <button type="button" class="btn" disabled={!unlocked} onClick={props.onOpen}>
        {t(hasAvatar(props.profile) ? 'avatar.change' : 'avatar.edit')}
      </button>
      {props.level !== undefined && !unlocked && <p class="muted small">{t('avatar.lockedHint')}</p>}
    </div>
  );
}

/**
 * "Deel mijn kaartje" for one profile: builds the `#f=` link once (device id + token), then
 * shares it as text (navigator.share with exactly {text}, inside the tap), copies it, or shows
 * the QR (Experimenten flag). The link is rebuilt when the profile's name/colour/language/avatar change.
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
    // 6D-3: the card carries the avatar too (§2g), so a new avatar rebuilds the link.
  }, [p.id, p.name, p.color, p.lang, JSON.stringify(p.avatar ?? null)]);

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
        if (r.outcome === 'shared') {
          setStatus(t('household.cardShared'));
          void recordFeature('cardShared');
          // 13A-2: the card went out — an 'out' row in the "In & uit" log (no partner is named here).
          void logShareEvent({ at: nowIso(), direction: 'out', kind: 'member', who: null, count: 1, recipeIds: [], note: p.name }).catch((e: unknown) => console.error('logShareEvent', e));
        } else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
        else if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  function copy() {
    if (!message) return;
    void copyText(message).then((r) => {
      if (r.ok) void recordFeature('cardShared');
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
          <button type="button" class="btn" disabled={!url} onClick={() => { if (!showQr) void recordFeature('qrShown'); setShowQr((v) => !v); }}>
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
  /** Rendered under Colour (6D-3: the "Avatar" row when editing the active profile). */
  afterColor?: ComponentChildren;
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
      {props.afterColor}
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
  // 6D-3: the avatar maker is open for this profile id (only ever the active profile).
  const [avatarFor, setAvatarFor] = useState<string | null>(null);
  const activeLevel = useAvatarLevel(active?.id);
  // The profile as it is NOW (the sheet saves via updateProfile, which refreshes the signal).
  const avatarProfile = avatarFor ? list.find((x) => x.id === avatarFor) ?? null : null;

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
                  // 6D-1: own recipes count by author = profile name, so a rename changes XP (recomputed silently).
                  markXpDirty(p.id);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
                afterColor={
                  badgesEnabled.value && active?.id === p.id ? <AvatarEditRow profile={p} level={activeLevel} onOpen={() => setAvatarFor(p.id)} /> : undefined
                }
              />
            ) : (
              <>
                <div class="profile-card">
                  <LevelAvatar profile={p} />
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
                {/* 6D-1 (docs/specs/xp-levels.md §1a): level, XP and streak; null with badges off. */}
                <XpBar memberId={p.id} />
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
      {avatarProfile && <AvatarSheet profile={avatarProfile} onClose={() => setAvatarFor(null)} />}
    </>
  );
}
