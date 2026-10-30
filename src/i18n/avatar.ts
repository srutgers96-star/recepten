// Strings of the avatar maker and its entry points (docs/specs/badges-avatar.md §1b, block 6D-3).
// Merged in ./index.ts right after badges. Part names come from data/avatar-parts.json (nl/en there),
// badge names from data/badges.json, the colour names from `badges.tier.<k>` (since 6D-B only the
// aria text of the tier dot). Literal from the spec.
import type { Dict } from './index';

export const avatar: Dict = {
  // Entry points (Meer → profile card; Meer → Profielen → Bewerk).
  'avatar.open': { nl: 'Avatar aanpassen', en: 'Edit avatar' },
  'avatar.row': { nl: 'Avatar', en: 'Avatar' },
  'avatar.edit': { nl: 'Maak je avatar', en: 'Make your avatar' },
  'avatar.change': { nl: 'Pas je avatar aan', en: 'Change your avatar' },
  'avatar.lockedHint': { nl: 'Komt vrij op level 3, na je eerste kookbeurt.', en: 'Unlocks at level 3, after your first cooked dish.' },

  // The sheet.
  'avatar.title': { nl: 'Jouw avatar', en: 'Your avatar' },
  'avatar.colorHint': {
    nl: 'De achtergrond is je profielkleur (Profielen → Kleur).',
    en: 'The background is your profile colour (Profiles → Colour).',
  },
  'avatar.random': { nl: 'Verras me', en: 'Surprise me' },
  'avatar.none': { nl: 'geen', en: 'none' },
  'avatar.reset': { nl: 'Terug naar de beginletter', en: 'Back to the initial' },

  // One tab per layer, in the maker's order (§1b.3; rows until block 6D-UI).
  'avatar.layer.face': { nl: 'Gezicht', en: 'Face' },
  'avatar.layer.tone': { nl: 'Huid', en: 'Skin' },
  'avatar.layer.hair': { nl: 'Haar', en: 'Hair' },
  'avatar.layer.hairColor': { nl: 'Haarkleur', en: 'Hair colour' },
  'avatar.layer.eyes': { nl: 'Ogen', en: 'Eyes' },
  'avatar.layer.mouth': { nl: 'Mond', en: 'Mouth' },
  'avatar.layer.facial': { nl: 'Baard & snor', en: 'Beard & moustache' },
  'avatar.layer.glasses': { nl: 'Bril', en: 'Glasses' },
  'avatar.layer.hat': { nl: 'Hoofddeksel', en: 'Headwear' },
  'avatar.layer.body': { nl: 'Kleding', en: 'Clothes' },
  'avatar.layer.prop': { nl: 'Accessoire', en: 'Accessory' },
  'avatar.layer.pin': { nl: 'Speldje', en: 'Pin' },
  'avatar.layer.bg': { nl: 'Achtergrond', en: 'Background' },
  // The cobalt dot on a maker tab whose layer has new unlocked parts (aria text; block 6D-UI, UI-B.5).
  'avatar.tabNew': { nl: 'Nieuw', en: 'New' },

  // Locked parts: the label on the tile and the line under the row (§1b.4).
  'avatar.lockLevel': { nl: 'Lv {n}', en: 'Lv {n}' },
  'avatar.lockedLevel': { nl: 'Komt vrij op level {n}.', en: 'Unlocks at level {n}.' },
  'avatar.lockedBadge': { nl: 'Komt vrij met de badge {badge}.', en: 'Unlocks with the badge {badge}.' },
  'avatar.lockedBadgeTier': {
    nl: 'Komt vrij met de badge {badge} op niveau {k}.',
    en: 'Unlocks with the badge {badge} at tier {k}.',
  },
  'avatar.lockedSecret': { nl: 'Komt vrij met een geheime badge.', en: 'Unlocks with a secret badge.' },

  // How rare a part is (block 6D-R, R-B.5): the group captions in a maker tab ("Zeldzaam · 5"), the
  // start of a tile's title/aria-label and of the line under the grid. Order: RARITIES.
  'avatar.rarity.common': { nl: 'Gewoon', en: 'Common' },
  'avatar.rarity.rare': { nl: 'Zeldzaam', en: 'Rare' },
  'avatar.rarity.epic': { nl: 'Episch', en: 'Epic' },
  'avatar.rarity.legendary': { nl: 'Legendarisch', en: 'Legendary' },
};
