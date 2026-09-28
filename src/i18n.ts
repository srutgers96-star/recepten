// Tiny bilingual UI-string table. `lang` is a signal so components re-render on toggle.
// Keys are grouped by screen; NL first, EN second. Keep strings short: 360 px phones.
import { signal } from '@preact/signals';

export type Lang = 'nl' | 'en';

const STORAGE_KEY = 'recepten.lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'nl' || stored === 'en') return stored;
  } catch {
    /* storage may be unavailable (private mode) */
  }
  return /^en/i.test(navigator.language ?? '') ? 'en' : 'nl';
}

export const lang = signal<Lang>(initialLang());

export function setLang(next: Lang) {
  lang.value = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function toggleLang() {
  setLang(lang.value === 'nl' ? 'en' : 'nl');
}

const dict = {
  'app.title': { nl: "Rutgers' Recepten", en: "Rutgers' Recipes" },
  'app.notFound': { nl: 'Pagina niet gevonden', en: 'Page not found' },

  'nav.recipes': { nl: 'Recepten', en: 'Recipes' },
  'nav.add': { nl: 'Toevoegen', en: 'Add' },
  'nav.share': { nl: 'Delen', en: 'Share' },
  'nav.import': { nl: 'Import', en: 'Import' },
  'nav.check': { nl: 'Check', en: 'Check' },

  'list.search': { nl: 'Zoek op naam', en: 'Search by name' },
  'list.own': { nl: 'eigen', en: 'own' },
  'list.empty': { nl: 'Geen recepten gevonden', en: 'No recipes found' },
  'list.recipes': { nl: 'recepten', en: 'recipes' },

  'recipe.back': { nl: 'Terug', en: 'Back' },
  'recipe.ingredients': { nl: 'Ingrediënten', en: 'Ingredients' },
  'recipe.instructions': { nl: 'Bereiding', en: 'Method' },
  'recipe.share': { nl: 'Deel dit recept', en: 'Share this recipe' },
  'recipe.notFound': { nl: 'Recept niet gevonden', en: 'Recipe not found' },
  'recipe.receivedFrom': { nl: 'ontvangen van', en: 'received from' },
  'recipe.own': { nl: 'eigen recept', en: 'own recipe' },
  'recipe.servings': { nl: 'pers.', en: 'servings' },

  'add.title': { nl: 'Nieuw recept', en: 'New recipe' },
  'add.name': { nl: 'Naam', en: 'Name' },
  'add.namePlaceholder': { nl: 'bv. Pasta pesto', en: 'e.g. Pesto pasta' },
  'add.ingredients': { nl: 'Ingrediënten', en: 'Ingredients' },
  'add.ingredientPlaceholder': { nl: 'bv. 400 g aardappelen', en: 'e.g. 400 g potatoes' },
  'add.addLine': { nl: '+ regel', en: '+ line' },
  'add.remove': { nl: 'Verwijder regel', en: 'Remove line' },
  'add.instructions': { nl: 'Bereiding', en: 'Method' },
  'add.instructionsPlaceholder': { nl: 'Stappen, gescheiden door een lege regel', en: 'Steps, separated by a blank line' },
  'add.save': { nl: 'Bewaren', en: 'Save' },
  'add.saved': { nl: 'Bewaard', en: 'Saved' },
  'add.nameRequired': { nl: 'Geef een naam op', en: 'Enter a name' },

  'share.title': { nl: 'Delen', en: 'Share' },
  'share.recipe': { nl: 'Recept', en: 'Recipe' },
  'share.from': { nl: 'Jouw naam (van …)', en: 'Your name (from …)' },
  'share.fromPlaceholder': { nl: 'bv. Stijn', en: 'e.g. Emma' },
  'share.nameRequired': { nl: 'Vul eerst je naam in', en: 'Enter your name first' },
  'share.bilingual': { nl: 'Tweetalig (test 2 KB)', en: 'Bilingual (2 KB test)' },
  'share.urlLength': { nl: 'URL-lengte', en: 'URL length' },
  'share.tokenLength': { nl: 'Token-lengte', en: 'Token length' },
  'share.chars': { nl: 'tekens', en: 'characters' },
  'share.message': { nl: 'Bericht', en: 'Message' },
  'share.whatsapp': { nl: 'Deel via WhatsApp', en: 'Share via WhatsApp' },
  'share.copy': { nl: 'Kopieer bericht', en: 'Copy message' },
  'share.copied': { nl: 'Gekopieerd', en: 'Copied' },
  'share.encoding': { nl: 'Bezig met coderen…', en: 'Encoding…' },
  'share.error': { nl: 'Delen mislukt', en: 'Sharing failed' },
  'share.copyError': { nl: 'Kopiëren mislukt', en: 'Copy failed' },
  'share.noShareApi': { nl: 'Geen deelmenu — WhatsApp wordt direct geopend', en: 'No share sheet — opening WhatsApp directly' },

  'import.title': { nl: 'Import', en: 'Import' },
  'import.hint': {
    nl: 'Plak hier een WhatsApp-bericht of link met een receptcode.',
    en: 'Paste a WhatsApp message or link with a recipe code here.',
  },
  'import.paste': { nl: 'Plak van klembord', en: 'Paste from clipboard' },
  'import.pasteHint': {
    nl: 'iPhone: tik op "Plak" als dat verschijnt, of houd het tekstvak ingedrukt → Plak.',
    en: 'iPhone: tap "Paste" when it appears, or long-press the text box → Paste.',
  },
  'import.file': { nl: 'Kies bestand', en: 'Choose file' },
  'import.clear': { nl: 'Wis', en: 'Clear' },
  'import.noToken': { nl: 'Geen receptcode gevonden in deze tekst.', en: 'No recipe code found in this text.' },
  'import.invalid': { nl: 'Ongeldige receptcode.', en: 'Invalid recipe code.' },
  'import.unsupported': { nl: 'Update de app eerst (nieuwere versie van de code).', en: 'Update the app first (newer code version).' },
  'import.unsupportedType': { nl: 'Dit type wordt in fase 0 nog niet ondersteund:', en: 'This type is not supported yet in phase 0:' },
  'import.preview': { nl: 'Voorproefje', en: 'Preview' },
  'import.by': { nl: 'van', en: 'from' },
  'import.at': { nl: 'gedeeld op', en: 'shared on' },
  'import.ingredients': { nl: 'ingrediënten', en: 'ingredients' },
  'import.save': { nl: 'Bewaar in mijn recepten', en: 'Save to my recipes' },
  'import.saved': { nl: 'Bewaard', en: 'Saved' },
  'import.exists': { nl: 'Al aanwezig', en: 'Already present' },
  'import.existsHint': { nl: 'Een recept met deze naam staat al in de lijst.', en: 'A recipe with this name is already in the list.' },
  'import.fromShare': { nl: 'Ontvangen via het deelmenu', en: 'Received via the share sheet' },
  'import.pasteFailed': { nl: 'Plakken mislukt — plak in het tekstvak.', en: 'Paste failed — paste into the text box instead.' },
  'import.open': { nl: 'Open', en: 'Open' },
  'import.fileFailed': { nl: 'Bestand kon niet worden gelezen.', en: 'Could not read the file.' },

  'check.title': { nl: 'Apparaatcheck', en: 'Device check' },
  'check.intro': {
    nl: 'Deze pagina meet wat je telefoon kan en laat je de testlijst invullen. Kopieer of deel het resultaat aan het eind.',
    en: 'This page measures what your phone can do and lets you fill in the test list. Copy or share the result at the end.',
  },
  'check.facts': { nl: 'Automatisch gemeten', en: 'Detected automatically' },
  'check.refresh': { nl: 'Opnieuw meten', en: 'Measure again' },
  'check.timer': { nl: 'Testtimer (30 s)', en: 'Test timer (30 s)' },
  'check.timerHint': {
    nl: 'Start, en doe daarna één van de drie: laat de app open, vergrendel het scherm, of ga naar een andere app. Noteer wat er na 30 s gebeurt. De timer loopt door op elk tabblad van de app.',
    en: 'Start, then do one of three things: keep the app open, lock the screen, or switch to another app. Note what happens after 30 s. The timer keeps running on every tab of the app.',
  },
  'check.start': { nl: 'Start 30 s', en: 'Start 30 s' },
  'check.stop': { nl: 'Stop', en: 'Stop' },
  'check.running': { nl: 'loopt', en: 'running' },
  'check.finished': { nl: 'Afgelopen', en: 'Finished' },
  'check.idle': { nl: 'Niet gestart', en: 'Not started' },
  'check.askNotif': { nl: 'Vraag meldingstoestemming', en: 'Ask notification permission' },
  'check.wake': { nl: 'Test wake lock (20 s)', en: 'Test wake lock (20 s)' },
  'check.wakeActive': { nl: 'Wake lock actief…', en: 'Wake lock active…' },
  'check.wakeFailed': { nl: 'Wake lock mislukt', en: 'Wake lock failed' },
  'check.wakeDone': { nl: 'Wake lock vrijgegeven', en: 'Wake lock released' },
  'check.timerRows': { nl: 'Wat merkte je na 30 s?', en: 'What did you notice after 30 s?' },
  'check.fg': { nl: '(a) App op de voorgrond', en: '(a) App in the foreground' },
  'check.locked': { nl: '(b) Scherm vergrendeld', en: '(b) Screen locked' },
  'check.bg': { nl: '(c) App op de achtergrond', en: '(c) App in the background' },
  'check.o.rang': { nl: 'ging af', en: 'went off' },
  'check.o.sound': { nl: 'geluid', en: 'sound' },
  'check.o.vibration': { nl: 'trilling', en: 'vibration' },
  'check.o.notification': { nl: 'melding', en: 'notification' },
  'check.o.nothing': { nl: 'niets', en: 'nothing' },
  'check.note': { nl: 'Notitie', en: 'Note' },
  'check.checklist': { nl: 'Checklist (plan §3b)', en: 'Checklist (plan §3b)' },
  'check.iphone': { nl: 'iPhone', en: 'iPhone' },
  'check.pass': { nl: 'pass', en: 'pass' },
  'check.fail': { nl: 'fail', en: 'fail' },
  'check.na': { nl: 'n.v.t.', en: 'n/a' },
  'check.copy': { nl: 'Kopieer resultaten', en: 'Copy results' },
  'check.share': { nl: 'Deel resultaten', en: 'Share results' },
  'check.copied': { nl: 'Gekopieerd', en: 'Copied' },
  'check.copyFailed': { nl: 'Kopiëren mislukt', en: 'Copy failed' },
  'check.reset': { nl: 'Wis antwoorden', en: 'Clear answers' },
  'check.notifGranted': { nl: 'toegestaan', en: 'granted' },

  'install.ios.title': { nl: 'Zet me op je beginscherm', en: 'Add me to your Home Screen' },
  'install.ios.step1': { nl: 'Tik onderaan op Deel', en: 'Tap Share at the bottom' },
  'install.ios.step2': { nl: 'Kies "Zet op beginscherm"', en: 'Choose "Add to Home Screen"' },
  'install.ios.step3': { nl: 'Tik op Voeg toe en open de app vanaf het beginscherm', en: 'Tap Add and open the app from the Home Screen' },
  'install.ios.why': {
    nl: 'Anders kan Safari je recepten na 7 dagen wissen.',
    en: 'Otherwise Safari may delete your recipes after 7 days.',
  },
  'install.android.title': { nl: 'Installeer als app', en: 'Install as an app' },
  'install.android.body': { nl: 'Chrome-menu (⋮) → App installeren', en: 'Chrome menu (⋮) → Install app' },
  'install.dismiss': { nl: 'Later', en: 'Later' },

  'update.new': { nl: 'Nieuwe versie', en: 'New version' },
  'update.reload': { nl: 'Vernieuwen', en: 'Reload' },

  'common.yes': { nl: 'ja', en: 'yes' },
  'common.no': { nl: 'nee', en: 'no' },
  'common.unknown': { nl: 'onbekend', en: 'unknown' },
  'common.online': { nl: 'online', en: 'online' },
  'common.offline': { nl: 'offline', en: 'offline' },
} satisfies Record<string, { nl: string; en: string }>;

export type I18nKey = keyof typeof dict;

/** Translate a UI key in the current language (reads the `lang` signal). */
export function t(key: I18nKey): string {
  return dict[key][lang.value];
}
