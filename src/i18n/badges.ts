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
  // 6D-B.6 (Stijn 30 Oct: colour instead of the colour name): the tier's colour is a dot before the
  // text ("● Niveau 2") and after "Volgende: 10 ●"; the colour names below are only the aria text of
  // those dots. The NL follows the spec's examples; the EN only lost its colour part.
  'badges.tierLabel': { nl: 'Niveau {k}', en: 'Tier {k}' },
  'badges.tierNone': { nl: 'Nog geen niveau', en: 'No tier yet' },
  'badges.tierMax': { nl: '✓ Hoogste niveau', en: '✓ Top tier' },
  'badges.tier.1': { nl: 'geel', en: 'yellow' },
  'badges.tier.2': { nl: 'groen', en: 'green' },
  'badges.tier.3': { nl: 'blauw', en: 'blue' },
  'badges.tier.4': { nl: 'rood', en: 'red' },
  'badges.tier.5': { nl: 'brons', en: 'bronze' },
  'badges.tier.6': { nl: 'zilver', en: 'silver' },
  'badges.tier.7': { nl: 'goud', en: 'gold' },
  'badges.tier.8': { nl: 'platina', en: 'platinum' },
  'badges.tierNext': { nl: 'Volgende: {n}', en: 'Next: {n}' },
  'badges.season': { nl: 'Telt van {from} tot {to}', en: 'Counts from {from} to {to}' },
  'badges.householdOnly': { nl: 'Telt voor het hele huishouden', en: 'Counts for the whole household' },
  'badges.unlocks': { nl: 'Geeft: {part}', en: 'Unlocks: {part}' },
  // 6D-2b: appended to `badges.unlocks` on a ladder; since 6D-B.6 after a dot in the tier colour
  // ("Geeft: Steelpan ● op niveau 5") instead of the colour name.
  'badges.unlocksTier': { nl: 'op niveau {k}', en: 'at tier {k}' },
  'badges.unlocksAt': { nl: 'op', en: 'at' },
  'badges.tierWord': { nl: 'niveau {k}', en: 'tier {k}' },
  'badges.secretCount': { nl: '{n} geheime badges gevonden', en: '{n} secret badges found' },
  'badges.secretNone': {
    nl: 'Nog geen geheime badge gevonden. Ontdek de app: sommige dingen die je doet leveren er een op.',
    en: 'No secret badge found yet. Explore the app: some things you do earn one.',
  },
  // 6D-2c (decision 29 Oct 2026): the description on a "?" card, a hidden badge not found yet.
  'badges.secretHint': { nl: 'Nog te ontdekken.', en: 'Still to discover.' },
  'badges.toastTier': { nl: '🏆 {name} · niveau {k}', en: '🏆 {name} · tier {k}' },
  'badges.toastSecret': { nl: '🤫 Geheime badge: {name}', en: '🤫 Secret badge: {name}' },
  'badges.toastUnlock': { nl: 'Nieuw voor je avatar: {part}', en: 'New for your avatar: {part}' },
  // 6D-UI (UI-A): one group per tab. An empty group shows one muted line; the pill on the tab of
  // Geheim counts found badges only ("3 gevonden", never a total). The NL of `badges.groupFound` is
  // literal from the spec; the key name and the EN were not given there (reported to the integrator).
  'badges.groupEmpty': { nl: 'Nog niets in deze groep.', en: 'Nothing in this group yet.' },
  'badges.groupFound': { nl: '{n} gevonden', en: '{n} found' },
  // 6D-B.5: the aria-label of a ladder tile (the tile shows only the icon): "Huiskok, niveau 2 van 8".
  'badges.tileLabel': { nl: '{name}, niveau {k} van {max}', en: '{name}, tier {k} of {max}' },
};
