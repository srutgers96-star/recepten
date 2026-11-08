// Strings of the shopping-list screen (docs/phase-4-spec.md §3 "Boodschappen"), the received
// week plan card in the Inbox and the phase-4 counters on the Storage screen. Every key in both
// languages; merged after week.ts in ./index.ts.
import type { Dict } from './index';

export const shopping: Dict = {
  // --- Screen, states ------------------------------------------------------------------------
  'shop.title': { nl: 'Boodschappen', en: 'Shopping' },
  'shop.planCard': { nl: 'Weekplan: {n} gerechten', en: 'Week plan: {n} dishes' },
  'shop.planCardOne': { nl: 'Weekplan: 1 gerecht', en: 'Week plan: 1 dish' },
  'shop.planCardHint': { nl: 'Nog geen lijst voor dit weekplan.', en: 'No list for this week plan yet.' },
  'shop.noPlan': { nl: 'Geen weekplan. Dit is je losse boodschappenlijst: wat je toevoegt en je vaste lijst.', en: 'No week plan. This is your plain shopping list: what you add plus your every-week list.' },
  'shop.toWeek': { nl: 'Naar Week', en: 'Go to Week' },
  'shop.make': { nl: 'Maak de lijst', en: 'Make the list' },
  'shop.making': { nl: 'Bezig…', en: 'Working…' },
  'shop.loading': { nl: 'Laden…', en: 'Loading…' },
  'shop.empty': { nl: 'De lijst is leeg. Voeg iets toe, of kies gerechten in Week.', en: 'The list is empty. Add something, or pick dishes in Week.' },
  'shop.allDone': { nl: 'Alles afgevinkt 🎉', en: 'Everything ticked 🎉' },
  'shop.lines': { nl: '{n} regels', en: '{n} lines' },
  'shop.lineOne': { nl: '1 regel', en: '1 line' },

  // --- Proto list ----------------------------------------------------------------------------
  'shop.proto.title': { nl: 'Controleer de lijst', en: 'Check the list' },
  'shop.proto.hint': { nl: 'Pas aantallen aan met − en +. Tik op een regel om te zien waarvoor het is.', en: 'Adjust amounts with − and +. Tap a line to see what it is for.' },
  'shop.staples': { nl: 'Voorraad', en: 'Staples' },
  'shop.staplesHint': { nl: 'Heb je dit nog? Tik om het toch mee te nemen.', en: 'Still got these? Tap to take one anyway.' },
  'shop.check': { nl: 'Controleer zelf', en: 'Check yourself' },
  'shop.checkHint': { nl: 'Deze regels kon de app niet lezen; de hoeveelheid is niet omgerekend.', en: 'The app could not read these lines; the amount is not converted.' },
  'shop.inHouse': { nl: 'In huis', en: 'In stock' },
  'shop.inHouseHint': { nl: 'Tik om het toch op de lijst te zetten.', en: 'Tap to put it back on the list.' },
  'shop.confirm': { nl: 'Bevestig lijst', en: 'Confirm list' },
  'shop.zero': { nl: 'niet nodig', en: 'not needed' },
  'shop.less': { nl: 'Minder', en: 'Less' },
  'shop.more': { nl: 'Meer', en: 'More' },
  'shop.for': { nl: 'Waarvoor', en: 'For' },
  'shop.noSources': { nl: 'Zelf toegevoegd', en: 'Added by hand' },

  // --- The list ------------------------------------------------------------------------------
  'shop.stale': { nl: 'Weekplan gewijzigd', en: 'Week plan changed' },
  'shop.update': { nl: 'Bijwerken', en: 'Update' },
  'shop.updated': { nl: 'Lijst bijgewerkt', en: 'List updated' },
  'shop.hideChecked': { nl: 'Verberg afgevinkt', en: 'Hide ticked' },
  'shop.showChecked': { nl: 'Toon afgevinkt', en: 'Show ticked' },
  'shop.storeMode': { nl: 'Winkelstand', en: 'Shop mode' },
  'shop.storeModeOn': { nl: 'Scherm blijft aan', en: 'Screen stays on' },
  'shop.storeModeNo': { nl: 'Scherm-aan kan niet op dit toestel', en: 'Keep-awake is not available on this device' },
  'shop.done': { nl: 'Klaar', en: 'Done' },
  'shop.doneSnack': { nl: 'Lijst afgerond, vinkjes gewist', en: 'List finished, ticks cleared' },
  'shop.undo': { nl: 'Ongedaan', en: 'Undo' },
  // "Leeg de lijst" (25 Oct 2026): empties items and extras in one tap, undo via the snack.
  'shop.clear': { nl: 'Leeg de lijst', en: 'Clear the list' },
  'shop.cleared': { nl: 'Lijst geleegd', en: 'List cleared' },
  'shop.checkedSnack': { nl: 'Afgevinkt', en: 'Ticked' },
  'shop.uncheckedSnack': { nl: 'Vinkje weg', en: 'Untick' },
  'shop.removedSnack': { nl: 'Verwijderd', en: 'Removed' },
  'shop.removeRow': { nl: 'Verwijder {name}', en: 'Remove {name}' },
  'shop.inHouseSnack': { nl: 'In huis gezet', en: 'Marked in stock' },
  'shop.neededSnack': { nl: 'Weer op de lijst', en: 'Back on the list' },
  'shop.new': { nl: 'nieuw', en: 'new' },
  'shop.count': { nl: '{done}/{total}', en: '{done}/{total}' },
  'shop.expand': { nl: 'Uitklappen', en: 'Expand' },
  'shop.collapse': { nl: 'Inklappen', en: 'Collapse' },
  'shop.holdHint': { nl: 'Tik = afvinken · houd vast voor meer', en: 'Tap = tick · hold for more' },

  // --- Long-press menu -----------------------------------------------------------------------
  'shop.menu.inHouse': { nl: 'Heb ik al', en: 'Already have it' },
  'shop.menu.inHouseHint': { nl: 'Wordt 3 weken onthouden (niet voor vers).', en: 'Remembered for 3 weeks (not for fresh food).' },
  'shop.menu.needed': { nl: 'Toch nodig', en: 'Need it after all' },
  'shop.menu.adjust': { nl: 'Aantal aanpassen', en: 'Adjust amount' },
  'shop.menu.sources': { nl: 'Waarvoor is dit?', en: 'What is this for?' },
  'shop.menu.remove': { nl: 'Verwijder', en: 'Remove' },
  'shop.menu.back': { nl: 'Terug', en: 'Back' },
  // 6C (docs/specs/vaste-lijst.md §1d): these replace the old "Elke week" pin.
  'shop.menu.toStanding': { nl: 'Zet op de vaste lijst', en: 'Put on Every week' },
  'shop.menu.toStandingHint': { nl: 'Komt voortaan elke week op de lijst.', en: 'Goes on the list every week from now on.' },
  'shop.menu.fromStanding': { nl: 'Haal van de vaste lijst', en: 'Take off Every week' },

  // --- Extras field --------------------------------------------------------------------------
  'shop.add': { nl: 'Toevoegen', en: 'Add' },
  'shop.addLabel': { nl: 'Zelf toevoegen', en: 'Add your own' },
  'shop.addPlaceholder': { nl: '+ wc-papier, melk …', en: '+ loo roll, milk …' },
  'shop.addAsText': { nl: 'Als tekst: “{q}”', en: 'As text: “{q}”' },
  'shop.addNew': { nl: 'Nieuw ingrediënt: “{q}”', en: 'New ingredient: “{q}”' },
  'shop.addedSnack': { nl: 'Toegevoegd', en: 'Added' },
  'shop.recent': { nl: 'eerder', en: 'before' },

  // --- Sharing -------------------------------------------------------------------------------
  'shop.share': { nl: 'Deel lijst', en: 'Share list' },
  'shop.shareHint': { nl: 'Als tekst, per gangpad. “In huis” en voorraad op 0 gaan niet mee.', en: 'As text, per aisle. “In stock” and staples at 0 are left out.' },
  'shop.shareHideChecked': { nl: 'Zonder afgevinkt', en: 'Without ticked lines' },
  'shop.copy': { nl: 'Kopieer', en: 'Copy' },
  'shop.copied': { nl: 'Gekopieerd', en: 'Copied' },
  'shop.shared': { nl: 'Gedeeld', en: 'Shared' },
  'shop.sharedAt': { nl: 'gedeeld om {time}', en: 'shared at {time}' },
  'shop.changedSince': { nl: 'gewijzigd sinds delen', en: 'changed since sharing' },
  // The shared text's first line: "🛒 Boodschappen wk 39 · 7 gerechten · 4 pers." (PLAN.md §8), joined with " · ".
  'shop.shareTitle': { nl: '🛒 Boodschappen wk {week}', en: '🛒 Shopping wk {week}' },
  'shop.shareTitleDishes': { nl: '{n} gerechten', en: '{n} dishes' },
  'shop.shareTitleDishOne': { nl: '1 gerecht', en: '1 dish' },
  'shop.shareTitleServings': { nl: '{n} pers.', en: '{n} people' },
  'shop.textLang': { nl: 'Taal', en: 'Language' },
  'shop.noShareApi': { nl: 'Geen deelmenu op dit toestel; WhatsApp is geopend.', en: 'No share sheet on this device; WhatsApp was opened.' },
  'shop.shareError': { nl: 'Delen mislukt', en: 'Sharing failed' },
  'shop.copyError': { nl: 'Kopiëren mislukt', en: 'Copy failed' },
  'shop.nothingToShare': { nl: 'Niets te delen.', en: 'Nothing to share.' },
  // 13Q (docs/specs/qr-link.md §1c): the list as a link (`#l=`) next to the text, and receiving it in In & uit.
  'shop.shareLink': { nl: 'Deel link', en: 'Share link' },
  'shop.copyLink': { nl: 'Kopieer link', en: 'Copy link' },
  'shop.list.received': { nl: '🛒 Lijst van {name} · {n} regels', en: "🛒 {name}'s list · {n} lines" },
  'shop.list.put': { nl: 'Zet op mijn lijst', en: 'Put on my list' },
  'shop.list.putSnack': { nl: '{n} regels op je lijst gezet, {m} stonden er al', en: '{n} lines put on your list, {m} were already there' },

  // --- Print & copy as text (docs/phase-5-spec.md block D.2) ----------------------------------
  'shop.print': { nl: 'Print', en: 'Print' },
  'shop.copyAsText': { nl: 'Kopieer als tekst', en: 'Copy as text' },
  'shop.copiedFlash': { nl: 'Gekopieerd ✓', en: 'Copied ✓' },
  // Honest iPhone hint (invariant 13): the installed app cannot print itself; the share sheet can.
  'shop.printIOSHint': { nl: 'Printen op iPhone: tik “Deel lijst” en kies Print in het deelmenu.', en: 'Printing on iPhone: tap “Share list” and choose Print in the share sheet.' },

  // --- Inbox: a received week plan ----------------------------------------------------------
  'inbox.plan.title': { nl: 'Weekplan van {name}: {n} gerechten', en: 'Week plan from {name}: {n} dishes' },
  'inbox.plan.titleOne': { nl: 'Weekplan van {name}: 1 gerecht', en: 'Week plan from {name}: 1 dish' },
  'inbox.plan.titleAnon': { nl: 'Weekplan: {n} gerechten', en: 'Week plan: {n} dishes' },
  'inbox.plan.hint': { nl: 'Overnemen vervangt je huidige weekplan; Toevoegen zet alleen de ontbrekende gerechten erbij. Meegestuurde recepten worden eerst geïmporteerd.', en: 'Take over replaces your current week plan; Add appends only the missing dishes. Included recipes are imported first.' },
  'inbox.plan.take': { nl: 'Overnemen', en: 'Take over' },
  'inbox.plan.add': { nl: 'Toevoegen', en: 'Add' },
  'inbox.plan.unknown': { nl: '{n} gerechten ken je niet (niet meegestuurd); die slaan we over.', en: '{n} dishes are unknown here (not included); they are skipped.' },
  'inbox.plan.unknownOne': { nl: '1 gerecht ken je niet (niet meegestuurd); dat slaan we over.', en: '1 dish is unknown here (not included); it is skipped.' },
  'inbox.plan.taken': { nl: 'Weekplan overgenomen: {n} gerechten.', en: 'Week plan taken over: {n} dishes.' },
  'inbox.plan.added': { nl: '{n} gerechten toegevoegd aan je week.', en: '{n} dishes added to your week.' },
  'inbox.plan.nothing': { nl: 'Niets toegevoegd: alles stond er al.', en: 'Nothing added: everything was already there.' },
  'inbox.plan.failed': { nl: 'Weekplan overnemen mislukt', en: 'Taking over the week plan failed' },
  'inbox.plan.toWeek': { nl: 'Naar Week', en: 'Go to Week' },
  'inbox.plan.note': { nl: 'Notitie', en: 'Note' },
  'inbox.plan.servings': { nl: '{n} pers.', en: '{n} serv.' },
  'inbox.plan.unknownDish': { nl: 'onbekend gerecht', en: 'unknown dish' },

  // --- Standing list ("Vaste lijst", docs/specs/vaste-lijst.md §1) ------------------------------
  // Tabs at the top of #/shopping (§1a).
  'shop.tab.week': { nl: 'Deze week', en: 'This week' },
  'shop.tab.standing': { nl: 'Vaste lijst', en: 'Every week' },
  // The Vaste lijst tab (§1b).
  'shop.standing.intro': { nl: 'Wat je elke week koopt, ook zonder weekplan. Dit komt bij elke boodschappenlijst erbij.', en: 'What you buy every week, with or without a week plan. It goes on every shopping list.' },
  'shop.standing.addPlaceholder': { nl: '+ 1 pot mayonaise, 2 l melk …', en: '+ 1 jar mayonnaise, 2 l milk …' },
  'shop.standing.addedSnack': { nl: 'Op de vaste lijst gezet: {name}', en: 'Put on Every week: {name}' },
  'shop.standing.paused': { nl: '(staat uit)', en: '(paused)' },
  'shop.standing.tapHint': { nl: 'Tik op een regel om het aantal of de eenheid te veranderen.', en: 'Tap a line to change the amount or the unit.' },
  'shop.standing.empty': { nl: 'Nog niets. Typ hierboven wat je elke week koopt, bijvoorbeeld 2 l melk.', en: 'Nothing yet. Type above what you buy every week, for example 2 l milk.' },
  // The edit sheet of one standing line (§1c, StandingSheet).
  'shop.standing.edit.amount': { nl: 'Standaardaantal', en: 'Usual amount' },
  'shop.standing.edit.noAmount': { nl: 'zonder aantal', en: 'no amount' },
  'shop.standing.edit.unit': { nl: 'Eenheid', en: 'Unit' },
  'shop.standing.edit.unitNone': { nl: 'stuks', en: 'pieces' },
  'shop.standing.edit.pause': { nl: 'Even niet meenemen', en: 'Skip for now' },
  'shop.standing.edit.resume': { nl: 'Weer meenemen', en: 'Include again' },
  'shop.standing.edit.pauseHint': { nl: 'Blijft op de vaste lijst, maar komt niet op de boodschappenlijst tot je het weer aanzet.', en: 'Stays on Every week, but is left off the shopping list until you switch it back on.' },
  'shop.standing.edit.remove': { nl: 'Verwijder van de vaste lijst', en: 'Remove from Every week' },
  'shop.standing.removedSnack': { nl: 'Van de vaste lijst gehaald: {name}', en: 'Taken off Every week: {name}' },
  // The weekly list (§1d): proto block, badge, long-press menu.
  'shop.standing.protoTitle': { nl: 'Vaste lijst', en: 'Every week' },
  'shop.standing.protoHint': { nl: 'Komt elke week erbij. Heb je het al in huis? Tik op Heb ik al: dat geldt alleen voor deze lijst, tot je op Klaar tikt. Een ander aantal geldt ook alleen nu; met Ook voortaan wordt het de nieuwe standaard.', en: 'Added every week. Already got it? Tap Already have it: that counts for this list only, until you tap Done. A different amount is for now only too; Also from now on makes it the new usual amount.' },
  'shop.standing.keep': { nl: 'Ook voortaan', en: 'Also from now on' },
  'shop.standing.keptSnack': { nl: 'Nieuw standaardaantal: {text}', en: 'New usual amount: {text}' },
  'shop.standing.manage': { nl: 'Beheer de vaste lijst ›', en: 'Manage Every week ›' },
  'shop.standing.badge': { nl: 'vaste lijst', en: 'every week' },
  'shop.standing.haveHint': { nl: 'Alleen deze lijst; niet onthouden.', en: 'This list only; not remembered.' },
  'shop.standing.onList': { nl: 'Staat op je vaste lijst', en: 'On your every-week list' },
  // The one-off pin-migration snack (§1d, block 1).
  'shop.standing.migratedSnack': { nl: '{n} ‘Elke week’-regels staan nu op de vaste lijst', en: '{n} ‘Every week’ lines are now on the Every week list' },
  'shop.standing.migratedSnackOne': { nl: '1 ‘Elke week’-regel staat nu op de vaste lijst', en: '1 ‘Every week’ line is now on the Every week list' },

  // --- Storage counters ----------------------------------------------------------------------
  'storage.plan': { nl: 'Weekplan (gerechten)', en: 'Week plan (dishes)' },
  'storage.list': { nl: 'Boodschappenlijst (regels)', en: 'Shopping list (lines)' },
  'storage.pantry': { nl: 'In huis (voorraad)', en: 'In stock (pantry)' },
  'storage.standing': { nl: 'Vaste lijst (regels)', en: 'Every week (lines)' },
  'storage.restoredWeek': { nl: 'Weekplan: {plans} · boodschappenlijst: {lists} · voorraad: {pantry}', en: 'Week plan: {plans} · shopping list: {lists} · pantry: {pantry}' },
};
