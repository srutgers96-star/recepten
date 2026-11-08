// '#/more/profiles' — Profielen beheren (block 6D-S, docs/specs/badges-avatar.md "S-A" point 5): only
// the list. Per profile one row with <Avatar/> (48 px, level ring), name, the compact <XpBar/> (badges
// on) and "Actief" or "Maak actief"; a tap on the row opens Mijn profiel for that profile
// ('#/more/profile?id=…', src/screens/ProfileScreen.tsx). "+ profiel" stays (`?add=1` opens the add
// form at once). Editing (name, colour, language, avatar, delete) lives in <ProfileEditFields/>, the
// card panel and the sync panel on Mijn profiel.
// This module also keeps the shared pieces other screens import: <Avatar/>, useAvatarLevel,
// hasAvatar, <ProfileForm/> (also onboarding), <MemberCardPanel/> ("Deel mijn kaartje", phase 5
// block F: a `#f=` token shared as ONE text field, invariant 9; honest about iPhone, invariants 5 +
// 13), ensureDeviceId and memberCardMessage.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { avatarParts, avatarUid } from '@/avatar';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { QrPanel, QrToggle } from '@/components/QrPanel';
import { Segmented } from '@/components/Segmented';
import { XpBar } from '@/components/XpBar';
import { getSetting, logShareEvent, setSetting } from '@/db/repo';
import { isComplete, normalizeAvatarSpec, renderAvatarSvg } from '@/domain/avatar';
import { cardFromMember } from '@/domain/household';
import { nowIso, randomId, type Lang, type Profile } from '@/domain/model';
import { buildMemberEnvelope, buildMemberShareMessage } from '@/domain/share';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';
import { PROFILE_COLORS, activeProfile, createProfile, profiles, setActiveProfile } from '@/profile';
import { navigate, route } from '@/router';
import { copyText, shareText } from '@/share-actions';
import { xpStateFor, xpStates } from '@/xp';

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
function avatarSvgFor(profile: Pick<Profile, 'color' | 'avatar'>, level: number, uid: string,
  highlight = false): string | null {
  const spec = normalizeAvatarSpec(profile.avatar);
  if (!spec) return null;
  const parts = avatarParts();
  if (!isComplete(spec, parts)) return null;
  return renderAvatarSvg(spec, parts, { color: profile.color, level, uid, highlight });
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
 * has no level here, so no ring. `highlight` (V1b §1d) adds the selection ring along the clip shape
 * in currentColor (the colour comes from CSS); `wink` puts the class `wink` on the circle for the
 * wink animation of Mijn profiel (avatar.css).
 */
export function Avatar(props: {
  profile: Pick<Profile, 'name' | 'color' | 'avatar'>; big?: boolean; level?: number; highlight?: boolean; wink?: boolean;
}) {
  const { profile } = props;
  const level = props.level ?? 0;
  // One uid per mounted circle, so two avatars on one screen never share a clipPath/gradient id.
  const [uid] = useState(avatarUid);
  const specKey = JSON.stringify(profile.avatar ?? null);
  const highlight = props.highlight === true;
  const svg = useMemo(() => avatarSvgFor(profile, level, uid, highlight), [specKey, profile.color, level, uid, highlight]);
  const cls = 'avatar' + (props.big ? ' big' : '') + (props.wink ? ' wink' : '');
  if (svg !== null) {
    // The markup comes ONLY from data/avatar-parts.json (checked by validateAvatarParts: no <script,
    // no href=, no style= except the tone/hair fills); the spec only picks part ids and palette
    // colours, and renderAvatarSvg takes the profile colour only as a plain CSS colour. No free user
    // input reaches the string, so innerHTML is safe here. No background on the span: the SVG draws
    // the profile colour itself inside the frame's clip, and a round disc would show behind a
    // hexagon or square frame (block 6D-F).
    return <span class={cls + ' has-svg'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
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
 * "Deel mijn kaartje" for one profile: builds the `#f=` link once (device id + token), then
 * shares it as text (navigator.share with exactly {text}, inside the tap), copies it, or shows
 * the QR (13Q: QrPanel, no flag). The link is rebuilt when the profile's name/colour/language/avatar change.
 */
export function MemberCardPanel(props: { profile: Profile }) {
  const p = props.profile;
  const [url, setUrl] = useState<string | null>(null);
  const [buildFailed, setBuildFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [showRaw, setShowRaw] = useState(false);
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
        <QrToggle open={showQr} disabled={!url} onToggle={() => setShowQr((v) => !v)} />
      </div>
      {/* 13Q §1a: the card's QR via the shared panel (no Experimenten flag). */}
      <QrPanel url={url ?? ''} open={showQr} onToggle={() => setShowQr(false)} label={t('household.cardQrAlt')} />
      {showRaw && <textarea class="input member-card-raw" readOnly rows={3} value={message} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />}
      <p class="muted small">{t('household.cardIosHint')}</p>
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

  // "+ profiel" arrives with ?add=1; a later visit to the plain route closes the form.
  useEffect(() => {
    if (route.value.query.get('add') === '1') setAdding(true);
  }, [route.value.query]);

  return (
    <>
      <Header title={t('profiles.title')} back backLabel={t('common.back')} />
      <div class="screen form">
        {list.length === 0 && <div class="empty">{t('profiles.empty')}</div>}

        {list.length > 0 && (
          <div class="card profile-list">
            {list.map((p) => (
              <ProfileListRow key={p.id} profile={p} active={active?.id === p.id} />
            ))}
          </div>
        )}

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

/**
 * One row on Profielen (6D-S point 5): avatar (48 px, level ring), name, the compact XP bar (badges
 * on; XpBar renders null otherwise) and "Actief" or the button "Maak actief". A tap on the row opens
 * that profile's Mijn profiel (`?id=`); the button only switches (it does not also open the row).
 */
function ProfileListRow(props: { profile: Profile; active: boolean }) {
  const p = props.profile;
  const open = () => navigate('/more/profile?id=' + encodeURIComponent(p.id));
  return (
    <div
      class="profile-row"
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <LevelAvatar profile={p} />
      <div class="who">
        <strong>{p.name}</strong>
        <XpBar memberId={p.id} compact />
      </div>
      {props.active ? (
        <span class="badge badge-green">{t('profile.active')}</span>
      ) : (
        <button
          type="button"
          class="btn btn-primary btn-small"
          onClick={(e) => {
            e.stopPropagation();
            void setActiveProfile(p.id);
          }}
        >
          {t('profile.makeActive')}
        </button>
      )}
    </div>
  );
}
