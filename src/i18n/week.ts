// Strings of phase 4 "Week" (docs/phase-4-spec.md §3): the Week tab, the Kies-N sheet, the Home
// "Deze week" card, "+ Deze week" on the detail page, the 5-tab nav and the Inbox row under Meer.
// Owned by the week agent. Every key needs both nl and en; merged in ./index.ts after phase2.
// Keep strings short: 360 px phones.
import type { Dict } from './index';

export const week: Dict = {
  // --- Nav (5 tabs) ---
  'nav.week': { nl: 'Week', en: 'Week' },
  'nav.shopping': { nl: 'Boodschappen', en: 'Shopping' },

  // --- Meer: Inbox row ---
  'more.inbox': { nl: 'Inbox', en: 'Inbox' },
  'more.inboxHint': { nl: 'Ontvangen recepten en aanpassingen', en: 'Received recipes and adjustments' },

  // --- Meer: household size (spec §0 "household.servings") ---
  'more.household': { nl: 'Huishouden', en: 'Household' },
  'more.householdHint': { nl: 'Nieuwe gerechten in je week starten met dit aantal personen.', en: 'New dishes in your week start with this many people.' },
  'more.householdValue': { nl: '{n} pers.', en: '{n} people' },
  'more.householdLess': { nl: 'Minder personen', en: 'Fewer people' },
  'more.householdMore': { nl: 'Meer personen', en: 'More people' },

  // --- Recipes list: + button ---
  'list.add': { nl: 'Recept toevoegen', en: 'Add recipe' },

  // --- Home: Inbox reminder card (shown while something is unseen; the Inbox tab moved under Meer) ---
  'home.inboxUnseen': { nl: '{n} nieuwe dingen in je inbox.', en: '{n} new things in your inbox.' },
  'home.inboxUnseenOne': { nl: '1 nieuw ding in je inbox.', en: '1 new thing in your inbox.' },
  'home.inboxAction': { nl: 'Bekijk inbox', en: 'Open inbox' },

  // --- Home: "Deze week" card ---
  'home.week': { nl: 'Deze week', en: 'This week' },
  'home.weekMore': { nl: '+{n}', en: '+{n}' },
  'home.weekList': { nl: 'Boodschappenlijst', en: 'Shopping list' },
  'home.weekOpen': { nl: 'Bekijk de week', en: 'Open the week' },
  'home.weekEmpty': { nl: 'Kies 7 voor deze week', en: 'Pick 7 for this week' },
  'home.weekEmptyHint': { nl: 'Geen dagen, gewoon een lijstje gerechten en één boodschappenlijst.', en: 'No days, just a list of dishes and one shopping list.' },
  'home.weekAllCooked': { nl: 'Alles gekookt — kies nieuwe?', en: 'All cooked — pick new ones?' },

  // --- Recipe detail ---
  'recipe.addToWeek': { nl: '+ Deze week', en: '+ This week' },
  'recipe.inWeek': { nl: '✓ Staat in je week', en: '✓ In your week' },
  'recipe.addedToWeek': { nl: 'Toegevoegd aan deze week', en: 'Added to this week' },

  // --- Week screen ---
  'week.title': { nl: 'Deze week', en: 'This week' },
  'week.heroTitle': { nl: 'Wat eten we deze week?', en: 'What are we eating this week?' },
  'week.heroHint': { nl: 'Kies een paar gerechten, zonder dagen. Daarna maak je er in één tik een boodschappenlijst van.', en: 'Pick a few dishes, no days. Then turn them into one shopping list with a single tap.' },
  'week.count': { nl: 'Aantal gerechten', en: 'Number of dishes' },
  'week.less': { nl: 'Minder', en: 'Fewer' },
  'week.more': { nl: 'Meer', en: 'More' },
  'week.pickN': { nl: 'Kies {n}', en: 'Pick {n}' },
  'week.surprise': { nl: 'Verras me', en: 'Surprise me' },
  'week.surpriseHint': { nl: 'Verras me vervangt alleen gerechten zonder slotje.', en: 'Surprise me only replaces dishes without a lock.' },
  'week.pickMore': { nl: '+ Kies meer', en: '+ Pick more' },
  'week.makeList': { nl: 'Boodschappenlijst maken', en: 'Make the shopping list' },
  'week.share': { nl: 'Deel weekplan', en: 'Share week plan' },
  'week.clear': { nl: 'Leeg', en: 'Clear' },
  'week.clearConfirm': { nl: 'De hele week leegmaken? De boodschappenlijst blijft staan.', en: 'Clear the whole week? The shopping list stays.' },
  'week.dishes': { nl: '{n} gerechten', en: '{n} dishes' },
  'week.dish': { nl: '1 gerecht', en: '1 dish' },
  'week.cookedOf': { nl: '{n} van {total} gekookt', en: '{n} of {total} cooked' },
  'week.servings': { nl: '{n} pers.', en: '{n} serv.' },
  'week.servingsLess': { nl: 'Minder personen', en: 'Fewer servings' },
  'week.servingsMore': { nl: 'Meer personen', en: 'More servings' },
  'week.lock': { nl: 'Vastzetten', en: 'Lock' },
  'week.unlock': { nl: 'Losmaken', en: 'Unlock' },
  'week.locked': { nl: 'vast', en: 'locked' },
  'week.reroll': { nl: 'Andere', en: 'Another' },
  'week.remove': { nl: 'Verwijder', en: 'Remove' },
  'week.cooked': { nl: 'Gekookt', en: 'Cooked' },
  'week.notCooked': { nl: 'Nog niet gekookt', en: 'Not cooked yet' },
  'week.missing': { nl: 'Recept niet gevonden', en: 'Recipe not found' },
  'week.noPool': { nl: 'Geen recepten binnen dit filter.', en: 'No recipes within this filter.' },
  'week.filterOn': { nl: 'Filter actief: {n} recepten', en: 'Filter on: {n} recipes' },
  'week.filterEdit': { nl: 'Filter', en: 'Filter' },
  'week.shareBuilding': { nl: 'Bericht maken…', en: 'Building the message…' },
  'week.shareTooLarge': { nl: 'Te groot voor één bericht ({n} tekens) — gaat als bestand.', en: 'Too big for one message ({n} characters) — sent as a file.' },
  'week.shareFile': { nl: 'Deel weekplan als bestand', en: 'Share week plan as a file' },
  'week.shareHint': { nl: 'Eén link; eigen recepten reizen mee.', en: 'One link; your own recipes travel along.' },
  'week.shareNoProfile': { nl: 'Kies eerst een profiel (Meer), dan staat je naam in het bericht.', en: 'Pick a profile first (More) so your name is in the message.' },
  'week.copied': { nl: 'Gekopieerd', en: 'Copied' },
  'week.copy': { nl: 'Kopieer', en: 'Copy' },

  // --- Kies-N sheet ---
  'pick.title': { nl: 'Kies gerechten', en: 'Pick dishes' },
  'pick.search': { nl: 'Zoek recept of ingrediënt…', en: 'Search recipe or ingredient…' },
  'pick.filters': { nl: 'Filters', en: 'Filters' },
  'pick.clear': { nl: 'Filters wissen', en: 'Clear filters' },
  'pick.counter': { nl: '{n} van {total}', en: '{n} of {total}' },
  'pick.surprise': { nl: 'Verras me', en: 'Surprise me' },
  'pick.surpriseHint': { nl: 'Vult de rest', en: 'Fills the rest' },
  'pick.add': { nl: 'Voeg {n} toe', en: 'Add {n}' },
  'pick.addNone': { nl: 'Kies een gerecht', en: 'Pick a dish' },
  'pick.none': { nl: 'Niets gevonden.', en: 'Nothing found.' },
  'pick.inPlan': { nl: 'al in je week', en: 'already in your week' },
  'pick.neverCooked': { nl: 'nog nooit gekookt', en: 'never cooked' },
  'pick.lastCooked': { nl: 'gekookt {date}', en: 'cooked {date}' },
  'pick.sortHint': { nl: 'Langst niet gegeten bovenaan', en: 'Longest not eaten first' },
  'pick.select': { nl: 'Kies', en: 'Pick' },
  'pick.deselect': { nl: 'Haal weg', en: 'Remove' },

  // --- Tag labels for tags that are planned in the data (generic chips fall back to the id) ---
  'tag.glutenvrij': { nl: 'glutenvrij', en: 'gluten-free' },
  'tag.vegan': { nl: 'vegan', en: 'vegan' },
  'filter.vega-optie': { nl: 'Vega-optie', en: 'Veggie option' },
  'filter.wok': { nl: 'Wok', en: 'Wok' },
  'filter.kids': { nl: 'Kids', en: 'Kids' },
  'filter.feest': { nl: 'Feest', en: 'Party' },
  'filter.zomer': { nl: 'Zomer', en: 'Summer' },
  'filter.winter': { nl: 'Winter', en: 'Winter' },
  'filter.glutenvrij': { nl: 'Glutenvrij', en: 'Gluten-free' },
  'filter.vegan': { nl: 'Vegan', en: 'Vegan' },
};
