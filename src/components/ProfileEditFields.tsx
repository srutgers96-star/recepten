// "Naam & kleur" on Mijn profiel (block 6D-S, docs/specs/badges-avatar.md "S-A" point 2): exactly the
// fields Profielen showed under "Bewerk" for the active profile — name, language and colour
// (PROFILE_COLORS) through <ProfileForm/>, saved with `updateProfile` — plus the avatar row ("Avatar
// aanpassen" opens <AvatarSheet/> from level 3, below it the existing hint; badges off = no row,
// 6D-3) and at the bottom "Verwijder profiel" with the existing confirm and `removeProfile`.
// Lifted out of ProfilesScreen, which no longer uses it (Profielen is only the list now).
import { useState } from 'preact/hooks';
import { badgesEnabled } from '@/badges';
import { AvatarSheet } from '@/components/AvatarSheet';
import { AVATAR_MAKER_LEVEL } from '@/domain/avatar';
import type { Profile } from '@/domain/model';
import { t } from '@/i18n';
import { profiles, removeProfile, updateProfile } from '@/profile';
import { navigate } from '@/router';
import { hasAvatar, ProfileForm, useAvatarLevel } from '@/screens/ProfilesScreen';
import { markXpDirty } from '@/xp';

/**
 * The row "Avatar" (§1b): "Maak je avatar" or, with an avatar, "Pas je avatar aan". Below level 3
 * the button is disabled with "Komt vrij op level 3, ..."; while the level is still loading it is
 * disabled without that line. The caller leaves the row out with badges off.
 */
export function AvatarEditRow(props: { profile: Profile; level: number | undefined; onOpen: () => void }) {
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

/** Name, language, colour, avatar row and "Verwijder profiel" for one (the active) profile. */
export function ProfileEditFields(props: { profile: Profile; onDone?: () => void }) {
  const p = props.profile;
  const level = useAvatarLevel(p.id);
  const [avatarOpen, setAvatarOpen] = useState(false);
  // The profile as it is NOW (the sheet saves via updateProfile, which refreshes the signal).
  const current = profiles.value.find((x) => x.id === p.id) ?? p;

  async function remove() {
    if (!confirm(t('profiles.deleteConfirm', { name: current.name }))) return;
    await removeProfile(current.id);
    // The profile shown on Mijn profiel is gone: back to the list (no profile left → it shows "none yet").
    navigate('/more/profiles', { replace: true });
  }

  return (
    <div class="profile-edit">
      <ProfileForm
        key={current.id}
        initial={current}
        submitLabel={t('common.save')}
        onSubmit={async (v) => {
          await updateProfile({ ...current, ...v });
          // 6D-1: own recipes count by author = profile name, so a rename changes XP (recomputed silently).
          markXpDirty(current.id);
          props.onDone?.();
        }}
        onCancel={props.onDone}
        afterColor={badgesEnabled.value ? <AvatarEditRow profile={current} level={level} onOpen={() => setAvatarOpen(true)} /> : undefined}
      />
      <div class="actions profile-delete">
        <button type="button" class="btn btn-danger" onClick={() => void remove()}>
          {t('profiles.delete')}
        </button>
      </div>
      {avatarOpen && <AvatarSheet profile={current} onClose={() => setAvatarOpen(false)} />}
    </div>
  );
}
