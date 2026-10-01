// Strings of the Badges screen and the new-badge toast (docs/phase-5-spec.md Block C). Owned by
// the badges agent; merged in ./index.ts after shopping. Badge NAMES and DESCRIPTIONS come from
// data/badges.json (bilingual there), never from here. Keep strings short: 360 px phones.
import type { Dict } from './index';

export const badges: Dict = {
  'badges.title': { nl: 'Badges', en: 'Badges' },
  'badges.members': { nl: 'Leden', en: 'Members' },
  'badges.together': { nl: 'Samen', en: 'Together' },
  'badges.earnedOf': { nl: '{earned} van {total} badges verdiend', en: '{earned} of {total} badges earned' },
  'badges.earned': { nl: 'Verdiend', en: 'Earned' },
  'badges.locked': { nl: 'nog niet verdiend', en: 'not earned yet' },
  'badges.progress': { nl: 'Voortgang', en: 'Progress' },
  'badges.toast': { nl: '🏆 Nieuwe badge: {name}', en: '🏆 New badge: {name}' },
  'badges.toastTogether': { nl: '🏆 Nieuwe badge samen: {name}', en: '🏆 New badge together: {name}' },
  'badges.toastOpen': { nl: 'Bekijk je badges', en: 'View your badges' },
  'badges.disabled': { nl: 'Badges staan uit. Zet ze aan via Meer.', en: 'Badges are off. Turn them on via More.' },
};
