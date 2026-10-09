// Profiles (docs/phase-1-spec.md §4): a list of people (name, language, colour) with one active
// profile per phone. Changing the active profile sets the UI language to that profile's language.
import { computed, signal } from '@preact/signals';
import { newProfileId, nowIso, type Lang, type Profile } from '@/domain/model';
import { deleteProfile as repoDeleteProfile, getSetting, listProfiles, saveProfile, setSetting } from '@/db/repo';
import { setLang } from '@/i18n';

export const ACTIVE_PROFILE_KEY = 'activeProfileId';

/**
 * Avatar colours: white initial on a filled circle. The first six are the original cover palette
 * (cobalt, tomato, rosemary, orange, plum, teal) and stay in place — profiles made before phase 6
 * keep their colour and their swatch. Phase 6 (docs/phase-6-spec.md 6A.12) adds eight more. The
 * swatch is the avatar background in both themes, so the text contrast does not depend on the theme.
 *
 * WCAG contrast of white (#fff) text on each colour, computed with a small script (relative
 * luminance per WCAG 2.x; the full list is 14 so the 44 px swatches wrap into rows of six at 360 px):
 *   #2b4fa8 cobalt    7.54   #d9402b tomato  4.45*  #3d7a3a rosemary 5.19   #d98a2e orange 2.75*
 *   #7a3d8a plum      7.34   #2a8a8a teal    4.12*  #1f3b73 navy    10.87   #b0246b raspberry 6.34
 *   #a6421c rust      6.14   #8a5a00 ochre   5.93   #5a6b1f olive    5.90   #1f6b5a pine 6.35
 *   #4a5d78 slate     6.71   #7a1f3d wine   10.04
 * All eight new colours are ≥ 4.5:1. (*) Three of the original six fall short (orange clearly so);
 * they are kept unchanged on purpose because existing profiles carry these exact values.
 */
export const PROFILE_COLORS: readonly string[] = [
  // original six (unchanged)
  '#2b4fa8', '#d9402b', '#3d7a3a', '#d98a2e', '#7a3d8a', '#2a8a8a',
  // phase 6: navy, raspberry, rust, ochre, olive, pine, slate, wine
  '#1f3b73', '#b0246b', '#a6421c', '#8a5a00', '#5a6b1f', '#1f6b5a', '#4a5d78', '#7a1f3d',
];

/** All profiles, oldest first. */
export const profiles = signal<Profile[]>([]);
/** True once loadProfiles() has read the database (so onboarding never flashes before that). */
export const profilesLoaded = signal(false);
/** The profile this phone acts as, or null before load / before onboarding. */
export const activeProfile = signal<Profile | null>(null);
/** No profiles yet: show the onboarding screen. */
export const needsOnboarding = computed(() => profilesLoaded.value && profiles.value.length === 0);

function applyProfile(p: Profile | null) {
  activeProfile.value = p;
  if (p) setLang(p.lang);
}

/** Reads the profiles and the active id from the database; falls back to the first profile. */
export async function loadProfiles(): Promise<void> {
  const list = await listProfiles();
  profiles.value = list;
  const wanted = await getSetting<string | null>(ACTIVE_PROFILE_KEY, null);
  const found = list.find((p) => p.id === wanted) ?? list[0] ?? null;
  applyProfile(found);
  if (found && found.id !== wanted) await setSetting(ACTIVE_PROFILE_KEY, found.id);
  profilesLoaded.value = true;
}

/** Switches the active profile (and the UI language to its language). Unknown id: no change. */
export async function setActiveProfile(id: string): Promise<void> {
  const p = profiles.value.find((x) => x.id === id);
  if (!p) return;
  applyProfile(p);
  await setSetting(ACTIVE_PROFILE_KEY, id);
}

export interface NewProfile {
  name: string;
  lang: Lang;
  color?: string;
}

/** Creates a profile and makes it active (onboarding, "+ profiel"). Returns the saved profile. */
export async function createProfile(input: NewProfile): Promise<Profile> {
  const color = input.color ?? PROFILE_COLORS[profiles.value.length % PROFILE_COLORS.length] ?? '#2b4fa8';
  const profile: Profile = { id: newProfileId(), name: input.name.trim(), lang: input.lang, color, createdAt: nowIso() };
  await saveProfile(profile);
  profiles.value = [...profiles.value, profile];
  profilesLoaded.value = true;
  applyProfile(profile);
  await setSetting(ACTIVE_PROFILE_KEY, profile.id);
  return profile;
}

/** Saves an edited profile; keeps the active one in sync. */
export async function updateProfile(p: Profile): Promise<void> {
  await saveProfile(p);
  profiles.value = profiles.value.map((x) => (x.id === p.id ? p : x));
  if (activeProfile.value?.id === p.id) applyProfile(p);
}

/** Deletes a profile (with its favorites and notes); the first remaining profile becomes active. */
export async function removeProfile(id: string): Promise<void> {
  await repoDeleteProfile(id);
  profiles.value = profiles.value.filter((x) => x.id !== id);
  if (activeProfile.value?.id === id) {
    const next = profiles.value[0] ?? null;
    applyProfile(next);
    await setSetting(ACTIVE_PROFILE_KEY, next?.id ?? null);
  }
}
