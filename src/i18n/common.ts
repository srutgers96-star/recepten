// Shell, navigation and generic strings, plus the device-check, install-card and update-bar keys
// (components shared by every screen). Screen strings live in browse.ts / edit.ts / settings.ts.
// NL first, EN second.
import type { Dict } from './index';

export const common: Dict = {
  'app.title': { nl: "Rutgers' Recepten", en: "Rutgers' Recipes" },
  'app.notFound': { nl: 'Pagina niet gevonden', en: 'Page not found' },

  'nav.home': { nl: 'Home', en: 'Home' },
  'nav.recipes': { nl: 'Recepten', en: 'Recipes' },
  'nav.add': { nl: 'Toevoegen', en: 'Add' },
  'nav.inbox': { nl: 'In & uit', en: 'In & out' },
  'nav.more': { nl: 'Meer', en: 'More' },
  'nav.main': { nl: 'Hoofdmenu', en: 'Main' },
  'header.lang': { nl: 'Taal: NL of EN', en: 'Language: NL or EN' },

  'lang.nl': { nl: 'Nederlands', en: 'Dutch' },
  'lang.en': { nl: 'Engels', en: 'English' },

  'common.save': { nl: 'Bewaar', en: 'Save' },
  'common.cancel': { nl: 'Annuleer', en: 'Cancel' },
  'common.delete': { nl: 'Verwijder', en: 'Delete' },
  'common.edit': { nl: 'Bewerk', en: 'Edit' },
  'common.back': { nl: 'Terug', en: 'Back' },
  'common.close': { nl: 'Sluit', en: 'Close' },
  'common.ok': { nl: 'Oké', en: 'OK' },
  'common.confirm': { nl: 'Weet je het zeker?', en: 'Are you sure?' },
  'common.loading': { nl: 'Laden…', en: 'Loading…' },
  'common.error': { nl: 'Er ging iets mis', en: 'Something went wrong' },
  'common.yes': { nl: 'ja', en: 'yes' },
  'common.no': { nl: 'nee', en: 'no' },
  'common.unknown': { nl: 'onbekend', en: 'unknown' },
  'common.online': { nl: 'online', en: 'online' },
  'common.offline': { nl: 'offline', en: 'offline' },
  'common.from': { nl: 'van {name}', en: 'from {name}' },

  'list.empty': { nl: 'Geen recepten gevonden', en: 'No recipes found' },

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
  'check.report': { nl: 'Rapport als tekst', en: 'Report as text' },
  'check.notifGranted': { nl: 'toegestaan', en: 'granted' },

  'install.ios.title': { nl: 'Zet me op je beginscherm', en: 'Add me to your Home Screen' },
  'install.ios.step1': { nl: 'Tik onderaan op Deel', en: 'Tap Share at the bottom' },
  'install.ios.step2': { nl: 'Kies "Zet op beginscherm"', en: 'Choose "Add to Home Screen"' },
  'install.ios.step3': { nl: 'Tik op Voeg toe en open de app vanaf het beginscherm', en: 'Tap Add and open the app from the Home Screen' },
  'install.ios.why': {
    nl: 'Anders kan Safari je recepten na 7 dagen wissen.',
    en: 'Otherwise Safari may delete your recipes after 7 days.',
  },
  // Phase 6 (docs/phase-6-spec.md 6A.4): the precache is about 2 MB.
  'install.ios.space': { nl: 'Kost nauwelijks ruimte (± 2 MB).', en: 'Takes hardly any space (about 2 MB).' },
  'install.ios.show': { nl: 'Toon de stappen', en: 'Show the steps' },
  'install.ios.hide': { nl: 'Verberg de stappen', en: 'Hide the steps' },
  'install.android.title': { nl: 'Installeer de app', en: 'Install the app' },
  'install.dismiss': { nl: 'Later', en: 'Later' },

  // Phase 6 (docs/phase-6-spec.md 13B): the "you are in the browser" notice (BrowserNotice.tsx) at
  // the top of the shell; the install card reuses the install lines so Home never explains it twice.
  // Honest per phone (CLAUDE.md invariant 5/13): on an iPhone a link always opens Safari; on Android
  // the app cannot force link capture, and another browser than Chrome has storage of its own.
  'browser.title': { nl: "Je gebruikt Rutgers' Recepten in de browser.", en: "You are using Rutgers' Recipes in the browser." },
  'browser.android.install': { nl: 'Installeer de app via Chrome: menu ⋮ → App installeren.', en: 'Install the app through Chrome: menu ⋮ → Install app.' },
  'browser.android.default': {
    nl: 'Zet Chrome als standaardbrowser, anders opent een link een andere browser met een eigen opslag.',
    en: 'Make Chrome your default browser; otherwise a link opens another browser with storage of its own.',
  },
  'browser.android.other': { nl: 'Je zit nu in {browser}: wat je hier bewaart, komt niet in de app.', en: 'You are in {browser} right now: what you save here does not reach the app.' },
  // Chrome itself (also a Custom Tab from WhatsApp): the app is often installed already and shares this storage.
  'browser.android.chrome': {
    nl: 'Dit is Chrome: wat je hier bewaart, komt ook in de app. Open de app via het icoon in je app-lade; nog niet geïnstalleerd? Menu ⋮ → App installeren.',
    en: 'This is Chrome: what you save here reaches the app too. Open the app from the icon in your app drawer; not installed yet? Menu ⋮ → Install app.',
  },
  'browser.otherBrowser': { nl: 'een andere browser', en: 'another browser' },
  'browser.openChrome': { nl: 'Open in Chrome', en: 'Open in Chrome' },
  'browser.copyLink': { nl: 'Kopieer de link', en: 'Copy the link' },
  'browser.copyHint': { nl: 'Werkt de knop niet? Kopieer de link en plak hem in Chrome.', en: 'Button not working? Copy the link and paste it into Chrome.' },
  'browser.copied': { nl: 'Gekopieerd — open Chrome en plak de link in de adresbalk.', en: 'Copied — open Chrome and paste the link into the address bar.' },
  'browser.copyFailed': { nl: 'Kopiëren mislukt — kopieer de link uit de adresbalk.', en: 'Copy failed — copy the link from the address bar.' },
  'browser.ios.install': { nl: 'Zet de app op je beginscherm: in Safari tik je op Deel → Zet op beginscherm.', en: 'Add the app to your Home Screen: in Safari tap Share → Add to Home Screen.' },
  'browser.ios.links': { nl: 'Links openen altijd Safari; kopieer dan de code en plak hem in de app.', en: 'Links always open Safari; copy the code there and paste it into the app.' },
  'browser.dismiss': { nl: 'Toch in de browser', en: 'Stay in the browser' },
  'browser.dismissHint': { nl: 'Deze melding komt over een week terug.', en: 'This notice comes back in a week.' },
  // Another browser than Chrome: never snoozed across starts (the recipe would land in the wrong storage).
  'browser.dismissHintOnce': { nl: 'Deze melding komt bij de volgende start terug.', en: 'This notice comes back the next time you open this page.' },

  'update.new': { nl: 'Nieuwe versie', en: 'New version' },
  'update.reload': { nl: 'Vernieuwen', en: 'Reload' },

  // IngredientPicker (src/components/IngredientPicker.tsx): "Koppel ingrediënt" sheet.
  'picker.title': { nl: 'Koppel ingrediënt', en: 'Link ingredient' },
  'picker.search': { nl: 'Zoek ingrediënt (NL of EN)', en: 'Search ingredient (NL or EN)' },
  'picker.hint': { nl: 'Typ een paar letters van het ingrediënt.', en: 'Type a few letters of the ingredient.' },
  'picker.new': { nl: 'Nieuw ingrediënt', en: 'New ingredient' },
  'picker.nl': { nl: 'Nederlands', en: 'Dutch' },
  'picker.en': { nl: 'Engels', en: 'English' },
  'picker.singular': { nl: 'enkelvoud', en: 'singular' },
  'picker.plural': { nl: 'meervoud', en: 'plural' },
  'picker.aisle': { nl: 'Schap in de supermarkt', en: 'Supermarket aisle' },
  'picker.unit': { nl: 'Standaard eenheid', en: 'Default unit' },
  'picker.unitPieces': { nl: 'stuks (geteld)', en: 'pieces (counted)' },
  'picker.unitNone': { nl: 'geen eenheid', en: 'no unit' },
  'picker.veg': { nl: 'Vegetarisch', en: 'Vegetarian' },
  // Phase 6 (6A.15): plain words for the pantry tick + a second line that says what it does.
  'picker.staple': { nl: 'Hoef je meestal niet te kopen (zout, olie, kruiden …)', en: 'Usually already in the house (salt, oil, spices …)' },
  'picker.stapleHint': { nl: 'Staat op de boodschappenlijst op 0 tot je hem aanzet.', en: 'Sits on the shopping list at 0 until you switch it on.' },
  'picker.save': { nl: 'Bewaar en koppel', en: 'Save and link' },
  'picker.cancel': { nl: 'Terug naar zoeken', en: 'Back to search' },
  'picker.none': { nl: 'Niets gevonden. Maak een nieuw ingrediënt.', en: 'Nothing found. Create a new ingredient.' },
  'picker.nameRequired': { nl: 'Vul minstens één naam in.', en: 'Enter at least one name.' },
  'picker.own': { nl: 'eigen', en: 'own' },
  // --- "Nieuw ingrediënt" already exists (docs/phase-5-spec.md A-bis.6) ---
  'picker.exists': { nl: 'Bestaat al: {name} — die gebruiken?', en: 'Already exists: {name} — use it?' },
  'picker.useExisting': { nl: 'Gebruik', en: 'Use it' },
  'picker.newAnyway': { nl: 'Toch nieuw', en: 'Create anyway' },
  'picker.exclude': { nl: 'Dat is het eigen ingrediënt zelf; kies een ander.', en: 'That is the own entry itself; pick another.' },
};
