// '#/more/unlocks' — Vrijgespeeld (docs/specs/xp-levels.md §1f; block "6D-3" there = 6D-4a in
// docs/specs/README.md §1). What this phone has unlocked: the union over its local profiles
// (src/unlocks.ts `unlockedOnPhone`, §2e), with on/off per phone (`unlocks.disabled`, device-local).
//   1. On top the XP bar of the active profile.
//   2. One card per kind (Confetti, Timergeluiden, Geluid bij Gekookt!, Lettertype kookstand,
//      Extra's), the unlocks in file order. A row: icon · name · description, then
//      - unlocked: a switch (on = not in `unlocks.disabled`) and, for confetti and sounds, "Probeer"
//        (`celebrate('cooked', { style })`, `previewTimerSound`, `previewCookedSound`);
//      - not yet: 🔒 and "Level {level}" or "Badge: {name}" (the name from data/badges.json).
//      A feature row has no switch: the avatar maker opens <AvatarSheet/> for the active profile
//      (from AVATAR_MAKER_LEVEL on, like the circle in Meer), any other feature says "Binnenkort".
//   3. At the bottom, muted, that unlocks are phone-wide and the switches per phone.
// Switching an unlock off takes it out of the confetti rotation and out of the sound and typeface
// pickers; `setUnlockEnabled` (src/unlocks.ts) sets a chosen timer sound back to 'beeps' and a
// chosen typeface back to the default (§1f/§1g).
// Badges off → only `badges.disabled`. Opening this screen is never a reward moment: it reads, it
// never settles XP (§5.11).
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { badgeData, badgesEnabled, loadBadgeSettings } from '@/badges';
import { celebrate } from '@/celebrate';
import { AvatarSheet } from '@/components/AvatarSheet';
import { Header } from '@/components/Header';
import { XpBar } from '@/components/XpBar';
import { AVATAR_MAKER_LEVEL } from '@/domain/avatar';
import type { Lang } from '@/domain/model';
import { UNLOCK_KINDS, type Unlock, type UnlockKind } from '@/domain/unlocks';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { loadSoundSettings, previewCookedSound, previewTimerSound, type TimerSound } from '@/sounds';
import { disabledUnlocks, refreshUnlocks, setUnlockEnabled, unlockData, unlockedOnPhone } from '@/unlocks';
import { useAvatarLevel } from './ProfilesScreen';

/** The feature value of the avatar maker in data/unlocks.json. */
const AVATAR_FEATURE = 'avatar';

/** "Level 5" or "Badge: Op dreef" (name from data/badges.json; the id when the badge is unknown). */
export function lockText(u: Unlock, l: Lang): string {
  const by = u.by;
  if ('badge' in by) {
    const badge = badgeData().find((b) => b.id === by.badge);
    return t('unlocks.atBadge', { name: badge ? badge[l].name : by.badge });
  }
  return t('unlocks.atLevel', { level: by.level });
}

/** "Probeer": the burst in this style, or the sound itself (through the tap-woken context). */
function tryUnlock(u: Unlock): void {
  if (u.kind === 'confetti') celebrate('cooked', { style: u.value });
  else if (u.kind === 'timerSound') previewTimerSound(u.value as TimerSound);
  else if (u.kind === 'cookedSound') previewCookedSound();
}

function canTry(kind: UnlockKind): boolean {
  return kind === 'confetti' || kind === 'timerSound' || kind === 'cookedSound';
}

function UnlockRow(props: { u: Unlock; unlocked: boolean; on: boolean; l: Lang; feature?: JSX.Element | null }) {
  const { u, unlocked, on, l } = props;
  const name = u[l].name;
  return (
    <div class={'setting unlock-row' + (unlocked ? '' : ' locked')}>
      <span class="unlock-icon" aria-hidden="true">
        {u.icon}
      </span>
      <div class="label">
        {name}
        <small>{u[l].description}</small>
        {unlocked && canTry(u.kind) && (
          <button type="button" class="btn btn-small unlock-action" aria-label={`${t('unlocks.try')}: ${name}`} onClick={() => tryUnlock(u)}>
            {t('unlocks.try')}
          </button>
        )}
        {unlocked && props.feature}
      </div>
      {!unlocked ? (
        <span class="muted small unlock-lock">
          <span aria-hidden="true">🔒 </span>
          {lockText(u, l)}
        </span>
      ) : u.kind === 'feature' ? null : (
        <label class="switch">
          <input type="checkbox" aria-label={name} checked={on} onChange={(e) => void setUnlockEnabled(u.id, (e.currentTarget as HTMLInputElement).checked).catch((err: unknown) => console.error('setUnlockEnabled', err))} />
          <span class="track" />
        </label>
      )}
    </div>
  );
}

export function UnlocksScreen() {
  const enabled = badgesEnabled.value;
  const active = activeProfile.value;
  const l = lang.value;
  const unlocked = unlockedOnPhone.value;
  const disabled = disabledUnlocks.value;
  const level = useAvatarLevel(active?.id);
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    void loadBadgeSettings();
    void loadSoundSettings();
    // A read, not a reward moment: brings the phone-wide union up to date (never settles XP).
    void refreshUnlocks().catch((e: unknown) => console.error('refreshUnlocks', e));
  }, []);

  const all = unlockData();
  const canOpenMaker = active !== null && level !== undefined && level >= AVATAR_MAKER_LEVEL;

  /** The extra line of a feature row: the avatar maker opens the sheet; anything else is not built yet. */
  function featureAction(u: Unlock): JSX.Element {
    if (u.value !== AVATAR_FEATURE) return <span class="muted small unlock-note">{t('unlocks.soon')}</span>;
    if (!canOpenMaker) return <span class="muted small unlock-note">{t('avatar.lockedHint')}</span>;
    return (
      <button type="button" class="btn btn-small unlock-action" onClick={() => setAvatarOpen(true)}>
        {t('avatar.open')}
      </button>
    );
  }

  return (
    <>
      <Header title={t('unlocks.title')} back backLabel={t('common.back')} />
      <div class="screen unlocks">
        {!enabled ? (
          <p class="muted" style="padding-top:12px">
            {t('badges.disabled')}
          </p>
        ) : (
          <>
            {active && (
              <div class="card">
                <XpBar memberId={active.id} compact />
              </div>
            )}
            {UNLOCK_KINDS.map((kind) => {
              const list = all.filter((u) => u.kind === kind);
              if (list.length === 0) return null;
              return (
                <section key={kind} class="card unlocks-kind" aria-labelledby={`unlocks-kind-${kind}`}>
                  <h2 id={`unlocks-kind-${kind}`}>{t('unlocks.kind.' + kind)}</h2>
                  {list.map((u) => {
                    const has = unlocked.has(u.id);
                    return <UnlockRow key={u.id} u={u} unlocked={has} on={!disabled.has(u.id)} l={l} feature={u.kind === 'feature' && has ? featureAction(u) : null} />;
                  })}
                </section>
              );
            })}
            <p class="muted small unlocks-phone-wide">{t('unlocks.phoneWide')}</p>
          </>
        )}
      </div>
      {avatarOpen && active && <AvatarSheet profile={active} onClose={() => setAvatarOpen(false)} />}
    </>
  );
}
