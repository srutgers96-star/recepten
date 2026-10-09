// Phase-2 UI strings owned by the home / list / settings agent (categories shelf, filter chips,
// search groups). Merged LAST in index.ts, so a key here wins over the same key in
// common/browse/edit/settings. Every key needs both nl and en. The picker keys live in common.ts
// (shared component); the "Meer" toggles live in settings.ts.
import type { Dict } from './index';

export const phase2: Dict = {
  // --- Home: categories shelf + dice filters ---
  'home.categories': { nl: 'Categorieën', en: 'Categories' },
  'home.surpriseFilters': { nl: 'Filters voor de dobbelsteen', en: 'Filters for the dice' },
  'home.noMatch': { nl: 'Geen recept past bij deze filters.', en: 'No recipe matches these filters.' },

  // --- Filter chips (list + dice) ---
  'filter.label': { nl: 'Filters', en: 'Filters' },
  'filter.clear': { nl: 'Filters wissen', en: 'Clear filters' },
  'filter.vegetarisch': { nl: 'Vegetarisch', en: 'Vegetarian' },
  'filter.snel': { nl: 'Snel', en: 'Quick' },
  'filter.oven': { nl: 'Oven', en: 'Oven' },
  'filter.vis': { nl: 'Vis', en: 'Fish' },
  'filter.kip': { nl: 'Kip', en: 'Chicken' },
  'filter.wereld': { nl: 'Wereld', en: 'World' },

  // --- Phase 5 (docs/phase-5-spec.md A.3): the "Dieet" chip row + the new diet tags ---
  'filter.diet': { nl: 'Dieet', en: 'Diet' },
  'filter.dietOptie': { nl: 'ook als optie', en: 'options too' },
  'filter.dietOptieHint': {
    nl: 'Ook recepten die dit als optie aanbieden (vega-optie, vegan-optie, glutenvrij-optie).',
    en: 'Also recipes that offer it as an option (veggie, vegan or gluten-free option).',
  },
  'filter.vegan-optie': { nl: 'Vegan-optie', en: 'Vegan option' },
  'filter.glutenvrij-optie': { nl: 'Glutenvrij-optie', en: 'Gluten-free option' },
  'tag.vegan-optie': { nl: 'vegan-optie', en: 'vegan option' },
  'tag.glutenvrij-optie': { nl: 'glutenvrij-optie', en: 'gluten-free option' },
  // Recipe detail: the diet chips under the title.
  'recipe.diet': { nl: 'Dieet', en: 'Diet' },
  'recipe.dietProbably': { nl: 'waarschijnlijk', en: 'probably' },

  // --- Recipes list: search placeholder (bilingual now), groups + filtered count ---
  'list.search': { nl: 'Zoek op naam of ingrediënt', en: 'Search by name or ingredient' },
  'list.filtered': { nl: '{n} van {total} recepten', en: '{n} of {total} recipes' },
  'search.name': { nl: 'Op naam', en: 'By name' },
  'search.ingredient': { nl: 'Met dit ingrediënt', en: 'With this ingredient' },
  'search.category': { nl: 'Categorie', en: 'Category' },
  'search.tag': { nl: 'Kenmerk', en: 'Tag' },

  // --- Phase 3: share screen additions (patch of a classic, dictionary delta, too-large fallback) ---
  'share.patchNote': {
    nl: 'Aangepaste klassieker: alleen je aanpassing reist mee. De ontvanger past hem toe op zijn eigen exemplaar, zonder dubbel recept.',
    en: 'Adjusted classic: only your adjustment travels. The receiver applies it to their own copy, no duplicate recipe.',
  },
  'share.linksNote': {
    nl: 'Klassieker met gekoppelde ingrediënten: alleen die koppelingen reizen mee. De ontvanger heeft het recept zelf al.',
    en: 'Classic with linked ingredients: only those links travel. The receiver already has the recipe itself.',
  },
  'share.dictNote': { nl: 'Reist mee: {n} eigen ingrediënten', en: 'Travels along: {n} own ingredients' },
  'share.dictNoteOne': { nl: 'Reist mee: 1 eigen ingrediënt', en: 'Travels along: 1 own ingredient' },
  'share.tooLarge': {
    nl: 'Te groot voor één WhatsApp-bericht ({n} tekens). Deel het als bestand; de ander importeert het via de Inbox.',
    en: 'Too large for one WhatsApp message ({n} characters). Share it as a file; the other person imports it via the Inbox.',
  },
  'share.file': { nl: 'Deel als bestand', en: 'Share as a file' },
  'share.fileShared': { nl: 'Bestand gedeeld', en: 'File shared' },
  // A-bis.9: after the download fallback the person is told where the file went.
  'share.fileDownloaded': { nl: 'Opgeslagen als {name} in Downloads', en: 'Saved as {name} in Downloads' },
  'share.fileButton': { nl: 'Deel het bestand', en: 'Share the file' },
  'share.download': { nl: 'Download', en: 'Download' },
  'share.fileFailed': { nl: 'Bestand delen mislukt', en: 'Sharing the file failed' },

  // --- Phase 3: "Deel je nieuwe recepten" (delta share; renamed in phase 6, docs/phase-6-spec.md 6A.5) ---
  'delta.title': { nl: 'Deel je nieuwe recepten', en: 'Share your new recipes' },
  'delta.intro': {
    nl: 'Alles wat je sinds de vorige keer maakte of aanpaste gaat in één WhatsApp-bericht naar de ander (of in één bestand als het te veel is).',
    en: 'Everything you made or changed since last time goes to the other person in one WhatsApp message (or in one file when it is too much).',
  },
  'delta.example': { nl: 'Zo ziet het bericht eruit', en: 'What the message looks like' },
  'delta.exampleHint': {
    nl: 'Android: de ander tikt op een link. iPhone: de ander kopieert het bericht en plakt het in de app.',
    en: 'Android: the other person taps a link. iPhone: they copy the message and paste it into the app.',
  },
  'delta.exampleMore': { nl: '… en nog {n} links', en: '… and {n} more links' },
  'delta.exampleMoreOne': { nl: '… en nog 1 link', en: '… and 1 more link' },
  'delta.partner': { nl: 'Aan wie?', en: 'To whom?' },
  'delta.other': { nl: 'Iemand anders…', en: 'Someone else…' },
  'delta.otherName': { nl: 'Naam', en: 'Name' },
  'delta.noPartner': { nl: 'Kies eerst aan wie je stuurt.', en: 'First choose who to send to.' },
  'delta.lastSent': { nl: 'Laatst verzonden aan {name}: {when}', en: 'Last sent to {name}: {when}' },
  'delta.neverSent': { nl: 'Nog nooit iets aan {name} verzonden: alles gaat mee.', en: 'Nothing sent to {name} yet: everything goes.' },
  'delta.nothing': { nl: 'Niets nieuws sinds de vorige keer.', en: 'Nothing new since last time.' },
  'delta.preview': { nl: 'Gaat mee', en: 'Goes along' },
  'delta.recipes': { nl: '{n} recepten', en: '{n} recipes' },
  'delta.recipe': { nl: '1 recept', en: '1 recipe' },
  'delta.patches': { nl: '{n} aangepaste klassiekers', en: '{n} adjusted classics' },
  'delta.patch': { nl: '1 aangepaste klassieker', en: '1 adjusted classic' },
  'delta.ingredients': { nl: '{n} nieuwe ingrediënten', en: '{n} new ingredients' },
  'delta.ingredient': { nl: '1 nieuw ingrediënt', en: '1 new ingredient' },
  'delta.adjusted': { nl: 'aangepast', en: 'adjusted' },
  'delta.asText': { nl: 'Past in één bericht: {tokens} links, {chars} tekens.', en: 'Fits in one message: {tokens} links, {chars} characters.' },
  'delta.asFile': { nl: 'Te veel voor één bericht: gaat als bestand {name}.', en: 'Too much for one message: goes as the file {name}.' },
  'delta.markSent': { nl: 'Markeer als verzonden', en: 'Mark as sent' },
  'delta.marked': { nl: 'Gemarkeerd als verzonden aan {name}.', en: 'Marked as sent to {name}.' },
  'delta.sharedMarked': { nl: 'Gedeeld en gemarkeerd als verzonden aan {name}.', en: 'Shared and marked as sent to {name}.' },
  'delta.markHint': {
    nl: 'Na delen via het deelmenu onthoudt de app de datum zelf. Na Kopieer of WhatsApp-web tik je op "Markeer als verzonden".',
    en: 'After sharing via the share sheet the app remembers the date itself. After Copy or WhatsApp web, tap "Mark as sent".',
  },
  'delta.copiedHint': { nl: 'Gekopieerd. Plak het in WhatsApp en tik daarna op "Markeer als verzonden".', en: 'Copied. Paste it in WhatsApp, then tap "Mark as sent".' },

  // --- Phase 3: Home reminder cards ---
  'home.backupOverdue': {
    nl: 'Back-up is meer dan 30 dagen oud — {n} wijzigingen staan nog nergens anders.',
    en: 'Backup is over 30 days old — {n} changes exist nowhere else yet.',
  },
  'home.backupNever': {
    nl: 'Nog geen back-up gemaakt — {n} wijzigingen staan nog nergens anders.',
    en: 'No backup made yet — {n} changes exist nowhere else yet.',
  },
  'home.backupAction': { nl: 'Back-up maken', en: 'Make a backup' },
  'home.unsent': { nl: '{n} nieuwe of aangepaste recepten nog niet gedeeld.', en: '{n} new or changed recipes not shared yet.' },
  'home.unsentOne': { nl: '1 nieuw of aangepast recept nog niet gedeeld.', en: '1 new or changed recipe not shared yet.' },
  'home.unsentAction': { nl: 'Deel je nieuwe recepten', en: 'Share your new recipes' },

  // --- Phase 5 (docs/phase-5-spec.md A-bis.8): select mode in the recipe list ---
  'select.enter': { nl: 'Selecteer', en: 'Select' },
  'select.done': { nl: 'Klaar', en: 'Done' },
  'select.count': { nl: '{n} geselecteerd', en: '{n} selected' },
  'select.none': { nl: 'Tik op recepten om ze te selecteren', en: 'Tap recipes to select them' },
  'select.share': { nl: 'Deel', en: 'Share' },
  'select.week': { nl: 'Deze week', en: 'This week' },
  'select.meta': { nl: 'Labels', en: 'Labels' },
  'select.delete': { nl: 'Verwijder', en: 'Delete' },
  'select.export': { nl: 'Exporteer', en: 'Export' },
  'select.shared': { nl: 'Gedeeld', en: 'Shared' },
  'select.weekAdded': { nl: '{n} toegevoegd aan je week', en: '{n} added to your week' },
  'select.deleteOne': { nl: '1 eigen recept verwijderen? Dit kan niet ongedaan worden gemaakt.', en: 'Delete 1 own recipe? This cannot be undone.' },
  'select.deleteConfirm': { nl: '{n} eigen recepten verwijderen? Dit kan niet ongedaan worden gemaakt.', en: 'Delete {n} own recipes? This cannot be undone.' },
  'select.deleteOnlyOwn': { nl: '{n} klassieker(s) in je selectie blijven staan.', en: '{n} classic(s) in your selection stay.' },
  'select.deleted': { nl: '{n} recepten verwijderd', en: '{n} recipes deleted' },
  'select.metaTitle': { nl: 'Categorie en labels', en: 'Category and labels' },
  'select.metaHint': {
    nl: 'Geldt voor alle {n} geselecteerde recepten. Bij een klassieker wordt het een aanpassing.',
    en: 'Applies to all {n} selected recipes. On a classic it becomes an adjustment.',
  },
  'select.metaKeep': { nl: '(laat zoals het is)', en: '(leave as it is)' },
  'select.metaMixed': { nl: 'deels', en: 'some' },
  'select.metaTagsHint': { nl: 'Alleen labels die je aantikt veranderen; "deels" = niet bij alle.', en: 'Only the labels you tap change; "some" = not on all of them.' },
  'select.metaApply': { nl: 'Toepassen', en: 'Apply' },
  'select.metaApplied': { nl: 'Categorie/labels bijgewerkt voor {n} recepten', en: 'Category/labels updated for {n} recipes' },
  'select.exportTitle': { nl: 'Selectie · {name}', en: 'Selection · {name}' },
};
