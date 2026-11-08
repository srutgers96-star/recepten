// '#/more/profile' — Mijn profiel (block 6D-S, docs/specs/badges-avatar.md "S-A" point 1). Without
// `?id=` the active profile; `?id=<profielId>` shows another one. Top to bottom: the avatar large (60 %
// of the width, at most 220 px, with the level ring; without an avatar the letter circle just as big),
// the name centred, and with badges on the full <XpBar/> (its first line is the level title
// "Level 5 · Boterhamsmeerder", then the bar and the streak). Then, for the ACTIVE profile, a grid of
// two columns of 56 px tiles: 🎨 Jouw stijl (→ '#/more/style'), 🏆 Badges (→ '#/more/badges?tab=<id>'),
// 📇 Deel mijn kaartje (unfolds <MemberCardPanel/>), 📈 Sync mijn voortgang (unfolds
// <ProgressSharePanel/>), ✏️ Naam & kleur (unfolds <ProfileEditFields/>). Another profile: only avatar,
// name, level and XP bar plus one button "Maak actief". Badges off: no level, no XP bar, no Jouw
// stijl / Badges / Sync tile; the drawn avatar stays (§5b). No profile at all → '/more/profiles'.
// Reached from Home (tap on the greeting, or pull Home down), from Meer (row Mijn profiel) and from
// Profielen beheren (tap on a row).
import { useEffect, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { Header } from '@/components/Header';
import { ProfileEditFields } from '@/components/ProfileEditFields';
import { ProgressSharePanel } from '@/components/ProgressSharePanel';
import { XpBar } from '@/components/XpBar';
import { t } from '@/i18n';
import { activeProfile, profiles, profilesLoaded, setActiveProfile } from '@/profile';
import { navigate, route } from '@/router';
import { Avatar, MemberCardPanel, useAvatarLevel } from './ProfilesScreen';

type Panel = 'card' | 'sync' | 'edit' | null;

function Tile(props: { icon: string; label: string; onClick: () => void; expanded?: boolean }) {
  return (
    <button type="button" class={'profile-tile' + (props.expanded ? ' on' : '')} aria-expanded={props.expanded} onClick={props.onClick}>
      <span class="profile-tile-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span class="profile-tile-label">{props.label}</span>
    </button>
  );
}

export function ProfileScreen() {
  const wantedId = route.value.query.get('id');
  const active = activeProfile.value;
  const profile = wantedId ? (profiles.value.find((p) => p.id === wantedId) ?? null) : active;
  const isActive = profile !== null && active !== null && profile.id === active.id;
  const level = useAvatarLevel(profile?.id);
  const [panel, setPanel] = useState<Panel>(null);
  const badgesOn = badgesEnabled.value;

  useEffect(() => {
    void loadBadgeSettings();
  }, []);

  // No profile (onboarding not done, or an unknown id): Profielen beheren instead.
  const missing = profilesLoaded.value && profile === null;
  useEffect(() => {
    if (missing) navigate('/more/profiles', { replace: true });
  }, [missing]);

  // Another profile shown or the profile switched: fold whatever was open.
  useEffect(() => {
    setPanel(null);
  }, [profile?.id]);

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));

  return (
    <>
      <Header title={profile?.name ?? t('profile.title')} back backLabel={t('common.back')} />
      <div class="screen form profile-screen">
        {profile && (
          <>
            <div class="profile-hero">
              <Avatar profile={profile} big level={level} />
              <h1 class="profile-hero-name">{profile.name}</h1>
            </div>
            {/* Badges off → XpBar renders null (no level, no bar). */}
            <XpBar memberId={profile.id} />

            {isActive ? (
              <>
                <div class="profile-tiles">
                  {badgesOn && <Tile icon="🎨" label={t('profile.style')} onClick={() => navigate('/more/style')} />}
                  {badgesOn && <Tile icon="🏆" label={t('profile.badges')} onClick={() => navigate('/more/badges?tab=' + encodeURIComponent(profile.id))} />}
                  <Tile icon="📇" label={t('profile.shareCard')} expanded={panel === 'card'} onClick={() => toggle('card')} />
                  {badgesOn && <Tile icon="📈" label={t('profile.sync')} expanded={panel === 'sync'} onClick={() => toggle('sync')} />}
                  <Tile icon="✏️" label={t('profile.edit')} expanded={panel === 'edit'} onClick={() => toggle('edit')} />
                </div>
                {panel === 'card' && (
                  <div class="card profile-panel">
                    <MemberCardPanel profile={profile} />
                  </div>
                )}
                {panel === 'sync' && badgesOn && (
                  <div class="card profile-panel">
                    <ProgressSharePanel profile={profile} />
                  </div>
                )}
                {panel === 'edit' && (
                  <div class="card profile-panel">
                    <ProfileEditFields profile={profile} onDone={() => setPanel(null)} />
                  </div>
                )}
              </>
            ) : (
              <div class="actions profile-make-active">
                <button type="button" class="btn btn-primary btn-block" onClick={() => void setActiveProfile(profile.id)}>
                  {t('profile.makeActive')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
