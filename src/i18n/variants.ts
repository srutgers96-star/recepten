// Strings of the diet versions as tabs on a recipe (docs/specs/varianten-tabs.md, 13D). Merged in
// ./index.ts right after badges. Block 2: the tab row, the status line per tab, the line markings
// and the approve sheet (`vt.*`). Later blocks add `week.variant*` (block 3) and `version.*`,
// `tip.*`, `edit.tip.*`, `share.noteAsTip*`, `inbox.with*`, `recipe.edit`, `recipe.notesTipHint`
// (block 4) to this file. Literal from the spec, NL and British English.
import type { Dict } from './index';

export const variants: Dict = {
  // §1a The tab row above "Ingrediënten".
  'vt.tab.original': { nl: 'Origineel', en: 'Original' },
  'vt.tab.glutenvrij': { nl: 'Glutenvrij', en: 'Gluten-free' },
  'vt.tab.vegetarisch': { nl: 'Vegetarisch', en: 'Vegetarian' },
  'vt.tab.vegan': { nl: 'Vegan', en: 'Vegan' },
  'vt.tab.lactosevrij': { nl: 'Lactosevrij', en: 'Lactose-free' },
  // A personal version whose maker has no name.
  'vt.tab.version': { nl: 'Versie', en: 'Version' },
  'vt.rowAria': { nl: 'Versies van dit recept', en: 'Versions of this recipe' },
  // {diet} = the tab label in lower case.
  'vt.naturalAria': { nl: 'Van nature {diet}', en: 'Naturally {diet}' },
  'vt.naturalSnack': { nl: 'Dit recept is al {diet}.', en: 'This recipe is already {diet}.' },

  // §1b The status line above the lines of a diet tab.
  'vt.status.proposed': {
    nl: 'Nog niet bevestigd. Controleer de vervangingen en keur ze goed.',
    en: 'Not confirmed yet. Check the swaps and approve them.',
  },
  'vt.approve': { nl: 'Controleer en keur goed', en: 'Check and approve' },
  'vt.status.stale': {
    nl: 'Het recept is veranderd sinds de goedkeuring. Controleer deze versie opnieuw.',
    en: 'The recipe changed since it was approved. Check this version again.',
  },
  'vt.recheck': { nl: 'Opnieuw controleren', en: 'Check again' },
  'vt.status.approved': { nl: 'Goedgekeurd door {name} op {date}', en: 'Approved by {name} on {date}' },
  'vt.status.approvedAnon': { nl: 'Goedgekeurd op {date}', en: 'Approved on {date}' },
  'vt.revoke': { nl: 'Intrekken', en: 'Withdraw' },
  'vt.revokeConfirm': {
    nl: 'Goedkeuring intrekken? De tab wordt weer een voorstel.',
    en: 'Withdraw the approval? The tab becomes a proposal again.',
  },
  'vt.legend': {
    nl: 'Gekleurde regels zijn vervangen; een oranje stip betekent: controleer zelf.',
    en: 'Coloured lines are swapped; an orange dot means: check yourself.',
  },
  // A personal version as a tab.
  'vt.personal.by': { nl: 'Versie van {name}', en: "{name}'s version" },
  'vt.personal.open': { nl: 'Open als recept', en: 'Open as a recipe' },

  // §1c The approve sheet.
  'vt.sheet.title.glutenvrij': { nl: 'Glutenvrije versie goedkeuren', en: 'Approve the gluten-free version' },
  'vt.sheet.title.vegetarisch': { nl: 'Vegetarische versie goedkeuren', en: 'Approve the vegetarian version' },
  'vt.sheet.title.vegan': { nl: 'Vegan versie goedkeuren', en: 'Approve the vegan version' },
  'vt.sheet.title.lactosevrij': { nl: 'Lactosevrije versie goedkeuren', en: 'Approve the lactose-free version' },
  'vt.sheet.approve': { nl: 'Goedkeuren', en: 'Approve' },
  'vt.sheet.intro': {
    nl: 'Vink uit wat je niet wilt vervangen. Regels met ! kan de app niet zelf vervangen: vink ze af zodra je ze zelf hebt bekeken.',
    en: 'Untick what you do not want swapped. Lines marked ! cannot be swapped by the app: tick them once you have looked at them yourself.',
  },
  'vt.sheet.checked': { nl: 'Gecontroleerd', en: 'Checked' },
  'vt.sheet.foot': {
    nl: 'Dit maakt geen nieuw recept: de versie wordt een tabblad op dit recept. Intrekken kan altijd.',
    en: 'This does not make a new recipe: the version becomes a tab on this recipe. You can withdraw it any time.',
  },
  'vt.sheet.needChecks': { nl: 'Vink eerst elke ‘controleer zelf’-regel af.', en: 'Tick every ‘check yourself’ line first.' },
  // {diet} = the tab label ("Glutenvrij versie goedgekeurd").
  'vt.approvedSnack': { nl: '{diet} versie goedgekeurd', en: '{diet} version approved' },

  // §1d The kicker of cook mode and the suffix of the copied / printed name.
  'vt.version.glutenvrij': { nl: 'Glutenvrije versie', en: 'Gluten-free version' },
  'vt.version.vegetarisch': { nl: 'Vegetarische versie', en: 'Vegetarian version' },
  'vt.version.vegan': { nl: 'Vegan versie', en: 'Vegan version' },
  'vt.version.lactosevrij': { nl: 'Lactosevrije versie', en: 'Lactose-free version' },

  // §1e Block 3: the version chip under a slot in the week plan (WeekScreen) and its row of choices.
  'week.variantAria': { nl: 'Versie voor dit gerecht', en: 'Version for this dish' },
  'week.variantHint': {
    nl: 'Alleen goedgekeurde versies; keur ze goed op het recept.',
    en: 'Only approved versions; approve them on the recipe.',
  },

  // Block 4 (§1g) The maker's tip card under the steps. {name} = origin.author (own), origin.receivedFrom
  // (received) or override.by (a classic with a tip in its patch); without a name the anonymous title.
  'tip.title': { nl: 'Tip van {name}', en: 'Tip from {name}' },
  'tip.titleAnon': { nl: 'Tip van de maker', en: "Maker's tip" },
  // §1g The tip field in the editor, under "Serveertip".
  'edit.tip.label': { nl: 'Tip van de maker', en: "Maker's tip" },
  'edit.tip.hint': {
    nl: 'Reist mee als je het recept deelt. Je privénotitie reist nooit mee.',
    en: 'Travels with the recipe when you share it. Your private note never does.',
  },
  'edit.tip.placeholder': {
    nl: 'Bv. Nog lekkerder na een dag in de koelkast.',
    en: 'E.g. Even better after a day in the fridge.',
  },
  // §1g Second grey line under the notes box of an editable recipe.
  'recipe.notesTipHint': {
    nl: 'Iets meegeven aan wie dit recept krijgt? Zet het in ‘Tip van de maker’ (Bewerk).',
    en: "Want to pass something on to whoever gets this recipe? Put it in ‘Maker's tip’ (Edit).",
  },
  // §1g The switch on the share screen (only when the active profile has a note on this recipe).
  'share.noteAsTip': { nl: 'Mijn notitie meesturen als tip van de maker', en: "Send my note along as the maker's tip" },
  'share.noteAsTipHint': {
    nl: 'Je notitie blijft privé op deze telefoon; alleen deze link krijgt hem als tip.',
    en: 'Your note stays private on this phone; only this link carries it as a tip.',
  },
  // §1g In & uit: small lines under the counts line of an incoming recipe.
  'inbox.withTip': { nl: 'met een tip van de maker', en: 'with a tip from the maker' },
  'inbox.withVariant1': { nl: 'met een goedgekeurde versie', en: 'with one approved version' },
  'inbox.withVariants': { nl: 'met {n} goedgekeurde versies', en: 'with {n} approved versions' },
  'inbox.withVariantsOne': { nl: 'met 1 goedgekeurde versie', en: 'with 1 approved version' },

  // §1h "Recept bewerken" vs "Eigen versie maken" at the bottom of the recipe (.detail-manage).
  'recipe.edit': { nl: 'Recept bewerken', en: 'Edit this recipe' },
  'version.make': { nl: 'Eigen versie maken', en: 'Make my own version' },
  'version.hint': {
    nl: 'Bewerken verandert dit recept. Een eigen versie laat het origineel staan, hangt eraan als tabblad en is apart te delen.',
    en: 'Editing changes this recipe. Your own version leaves the original alone, hangs on it as a tab and can be shared on its own.',
  },
  'version.noProfile': {
    nl: 'Kies eerst een profiel (Meer) om een eigen versie te maken.',
    en: 'Choose a profile first (More) to make your own version.',
  },
};
