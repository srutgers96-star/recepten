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

  // 6D-2 (docs/specs/badges-avatar.md §1a): groups, colour levels (tiers), secret badges, details
  // and the new toasts. Literal from the spec; the page itself is block 6D-2b.
  'badges.secretFound': { nl: '· {n} geheime gevonden', en: '· {n} secret found' },
  'badges.group.koken': { nl: 'Koken', en: 'Cooking' },
  'badges.group.ontdekken': { nl: 'Ontdekken', en: 'Discovering' },
  'badges.group.keukens': { nl: 'Keukens van de wereld', en: 'Cuisines of the world' },
  'badges.group.seizoenen': { nl: 'Seizoenen', en: 'Seasons' },
  'badges.group.samen': { nl: 'Samen & delen', en: 'Together & sharing' },
  'badges.group.foto': { nl: 'Fotografie', en: 'Photography' },
  'badges.group.reeksen': { nl: 'Reeksen', en: 'Streaks' },
  'badges.group.geheim': { nl: 'Geheim', en: 'Secret' },
  'badges.tierLabel': { nl: 'Niveau {k} · {colour}', en: 'Level {k} · {colour}' },
  'badges.tierNone': { nl: 'Nog geen niveau', en: 'No level yet' },
  'badges.tierMax': { nl: '✓ Platina', en: '✓ Platinum' },
  'badges.tier.1': { nl: 'geel', en: 'yellow' },
  'badges.tier.2': { nl: 'groen', en: 'green' },
  'badges.tier.3': { nl: 'blauw', en: 'blue' },
  'badges.tier.4': { nl: 'rood', en: 'red' },
  'badges.tier.5': { nl: 'brons', en: 'bronze' },
  'badges.tier.6': { nl: 'zilver', en: 'silver' },
  'badges.tier.7': { nl: 'goud', en: 'gold' },
  'badges.tier.8': { nl: 'platina', en: 'platinum' },
  'badges.tierNext': { nl: 'Volgende: {n} ({colour})', en: 'Next: {n} ({colour})' },
  'badges.season': { nl: 'Telt van {from} tot {to}', en: 'Counts from {from} to {to}' },
  'badges.householdOnly': { nl: 'Telt voor het hele huishouden', en: 'Counts for the whole household' },
  'badges.unlocks': { nl: 'Geeft: {part}', en: 'Unlocks: {part}' },
  'badges.secretCount': { nl: '{n} geheime badges gevonden', en: '{n} secret badges found' },
  'badges.secretNone': {
    nl: 'Nog geen geheime badge gevonden. Ontdek de app: sommige dingen die je doet leveren er een op.',
    en: 'No secret badge found yet. Explore the app: some things you do earn one.',
  },
  'badges.toastTier': { nl: '🏆 {name} · niveau {k}: {colour}', en: '🏆 {name} · level {k}: {colour}' },
  'badges.toastSecret': { nl: '🤫 Geheime badge: {name}', en: '🤫 Secret badge: {name}' },
  'badges.toastUnlock': { nl: 'Nieuw voor je avatar: {part}', en: 'New for your avatar: {part}' },
};
