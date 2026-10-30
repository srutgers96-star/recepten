// Strings of the browse screens: home, list, detail, cook, timers. Owned by the browse agent.
// Every key needs both nl and en. Keys are merged in ./index.ts (later dictionaries win), so a few
// phase-0 keys from common.ts are redefined here on purpose. Keep strings short: 360 px phones.
import type { Dict } from './index';

export const browse: Dict = {
  // --- Home ("Vanavond?") ---
  'home.title': { nl: 'Vanavond?', en: 'Tonight?' },
  'home.greeting': { nl: 'Hoi {name}, wat eten we vanavond?', en: 'Hi {name}, what shall we cook tonight?' },
  'home.greetingAnon': { nl: 'Wat eten we vanavond?', en: 'What shall we cook tonight?' },
  'home.reroll': { nl: 'Nog een', en: 'Another' },
  'home.open': { nl: 'Open', en: 'Open' },
  'home.favorites': { nl: 'Favorieten', en: 'Favourites' },
  'home.noFavorites': { nl: 'Nog geen favorieten — tik op ★ bij een recept.', en: 'No favourites yet — tap ★ on a recipe.' },
  'home.recentCooked': { nl: 'Laatst gekookt', en: 'Recently cooked' },
  'home.noCooked': { nl: 'Nog niets gekookt. Open een recept en tik op Koken.', en: 'Nothing cooked yet. Open a recipe and tap Cook.' },
  // Phase 5 block C: "Badges 7/40" (names/descriptions live in data/badges.json); since Home A+ the
  // line "🏆 Badges 7/40 ›" under the greeting (src/components/HomeLevelRow.tsx).
  'home.badges': { nl: 'Badges', en: 'Badges' },
  // Home A+ block 1 (docs/specs/home-a-plus.md §1d–1e): the rows In & uit, Mijn recepten, Het verhaal.
  'home.inOut': { nl: 'In & uit', en: 'In & out' },
  'home.inOutReceived': { nl: '{n} ontvangen', en: '{n} received' },
  'home.inOutToShare': { nl: '{n} te delen', en: '{n} to share' },
  'home.inOutNothing': { nl: 'niets nieuws', en: 'nothing new' },
  'home.myRecipes': { nl: 'Mijn recepten', en: 'My recipes' },
  'home.myRecipesNone': { nl: 'nog geen', en: 'none yet' },
  'home.storyRow': { nl: 'Het verhaal van dit boek', en: 'The story of this book' },
  // Home A+ block 2 (§1g–1h): the Tonight card (src/components/TonightCard.tsx) and the line
  // "Verder met" under it. The ▾/▴ after "filters" is added by the card, not part of the text.
  'home.tonight': { nl: 'Vanavond', en: 'Tonight' },
  'home.tonightOther': { nl: 'Iets anders', en: 'Something else' },
  'home.tonightMin': { nl: '{n} min', en: '{n} min' },
  'home.tonightLeft': { nl: 'nog {n} te gaan', en: '{n} to go' },
  'home.tonightLast': { nl: 'de laatste van je week', en: 'the last of your week' },
  'home.tonightOutside': { nl: 'Iets buiten je week ›', en: 'Something outside your week ›' },
  'home.tonightBack': { nl: 'Terug naar je week ›', en: 'Back to your week ›' },
  'home.filters': { nl: 'filters', en: 'filters' },
  'home.filtersActive': { nl: 'filters ({n})', en: 'filters ({n})' },
  'home.continueWith': { nl: 'Verder met: {name} ›', en: 'Continue with: {name} ›' },

  // --- A-Z list ---
  'list.title': { nl: 'Recepten', en: 'Recipes' },
  'list.own': { nl: 'eigen', en: 'own' },
  'list.from': { nl: 'van {name}', en: 'from {name}' },
  'list.received': { nl: 'ontvangen', en: 'received' },
  'list.favorite': { nl: 'favoriet', en: 'favourite' },
  'list.count': { nl: '{n} recepten', en: '{n} recipes' },
  // Phase 6 (6A.13): the "+" menu shows all four ways in at once, each with one line of explanation
  // (the menu title 'list.add' stays in week.ts).
  'list.addWrite': { nl: 'Zelf schrijven', en: 'Write it yourself' },
  'list.addWriteHint': { nl: 'Typ het recept zelf in.', en: 'Type the recipe in yourself.' },
  'list.addPaste': { nl: 'Plak een recept', en: 'Paste a recipe' },
  'list.addPasteHint': { nl: 'Tekst van een website; meestal genoeg.', en: 'Text from a website; usually enough.' },
  'list.addAi': { nl: 'Met AI', en: 'With AI' },
  'list.addAiHint': {
    nl: 'Kopieer een opdracht voor je AI, met foto of tekst; als plakken niet goed lukt.',
    en: 'Copy an instruction for your AI, with a photo or text; when pasting does not work well.',
  },
  'list.addFileChoice': { nl: 'Kies een bestand', en: 'Choose a file' },
  'list.addFileChoiceHint': { nl: 'Een recept, bundel of back-up; of een tekstbestand.', en: 'A recipe, bundle or backup; or a text file.' },
  // Phase 6 (13A-2): the sort row above the list (src/recent.ts). Short labels: four pills at 360 px.
  'list.sort': { nl: 'Sorteer', en: 'Sort' },
  'list.sortAz': { nl: 'A–Z', en: 'A–Z' },
  'list.sortRecent': { nl: 'Recent bekeken', en: 'Recently viewed' },
  'list.sortOwn': { nl: 'Eigen', en: 'Own' },
  'list.sortOwnReceived': { nl: 'Eigen & ontvangen', en: 'Own & received' },
  'list.emptyRecent': { nl: 'Nog niets bekeken. Open een recept en het staat hier.', en: 'Nothing viewed yet. Open a recipe and it shows up here.' },
  'list.emptyOwn': { nl: 'Nog geen eigen recepten. Tik op + om er een te maken.', en: 'No own recipes yet. Tap + to make one.' },
  'list.emptyOwnReceived': { nl: 'Nog geen eigen of ontvangen recepten.', en: 'No own or received recipes yet.' },

  // --- Detail ---
  'recipe.cook': { nl: 'Koken', en: 'Cook' },
  'recipe.share': { nl: 'Deel', en: 'Share' },
  'recipe.fav': { nl: 'Maak favoriet', en: 'Add to favourites' },
  'recipe.unfav': { nl: 'Favoriet weghalen', en: 'Remove favourite' },
  'recipe.ingredients': { nl: 'Ingrediënten', en: 'Ingredients' },
  'recipe.steps': { nl: 'Bereiding', en: 'Method' },
  'recipe.timerHint': { nl: 'Tik op een tijd om een timer te starten.', en: 'Tap a time to start a timer.' },
  'recipe.goesWith': { nl: 'Bij dit gerecht', en: 'Goes with' },
  'recipe.notes': { nl: 'Notities', en: 'Notes' },
  'recipe.notesHint': { nl: 'Alleen voor jou ({name}); wordt nooit vertaald.', en: 'Just for you ({name}); never translated.' },
  'recipe.notesPlaceholder': { nl: 'Bv. minder zout, 10 min langer…', en: 'E.g. less salt, 10 min longer…' },
  'recipe.notesNoProfile': { nl: 'Kies eerst een profiel (Meer) om notities te maken.', en: 'Choose a profile first (More) to write notes.' },
  'recipe.saved': { nl: 'Bewaard', en: 'Saved' },
  'recipe.cookedTimes': { nl: '{n}× gekookt', en: 'cooked {n}×' },
  'recipe.lastCooked': { nl: 'laatst {date}', en: 'last {date}' },
  'recipe.neverCooked': { nl: 'nog niet gekookt', en: 'not cooked yet' },
  'recipe.classic': { nl: 'klassieker uit het boek', en: 'classic from the book' },
  'recipe.own': { nl: 'eigen recept', en: 'own recipe' },
  'recipe.ownBy': { nl: 'eigen recept van {name}', en: 'own recipe by {name}' },
  'recipe.received': { nl: 'ontvangen van {name}', en: 'received from {name}' },
  'recipe.receivedAnon': { nl: 'ontvangen recept', en: 'received recipe' },
  'recipe.basedOn': { nl: 'gebaseerd op {name}', en: 'based on {name}' },
  'recipe.deleteConfirm': { nl: 'Dit recept verwijderen? Dit kan niet ongedaan worden gemaakt.', en: 'Delete this recipe? This cannot be undone.' },
  'recipe.deleteYes': { nl: 'Ja, verwijder', en: 'Yes, delete' },
  'recipe.copy': { nl: 'Maak eigen kopie', en: 'Make my own copy' },
  'recipe.copyHint': { nl: 'Klassiekers zijn vast; een kopie kun je bewerken.', en: 'Classics are fixed; a copy can be edited.' },
  'recipe.copyNoProfile': { nl: 'Kies eerst een profiel (Meer) om een kopie te maken.', en: 'Choose a profile first (More) to make a copy.' },
  'recipe.notFound': { nl: 'Recept niet gevonden', en: 'Recipe not found' },

  // --- Detail, phase 2: category, tags, time, machine-translation badge (opens the editor) ---
  'recipe.category': { nl: 'Categorie', en: 'Category' },
  'recipe.noCategory': { nl: 'geen categorie', en: 'no category' },
  'recipe.changeCategory': { nl: 'wijzig', en: 'change' },
  // 6B blok 3: visually hidden label of the cuisine chip next to the category.
  'recipe.cuisine': { nl: 'Keuken', en: 'Cuisine' },
  'recipe.timeActive': { nl: '{n} min bezig', en: '{n} min hands-on' },
  'recipe.timeTotal': { nl: '{n} min totaal', en: '{n} min total' },
  'recipe.machineTranslation': { nl: 'Automatische vertaling — tik om te verbeteren', en: 'Machine translation — tap to improve' },
  // PLAN §0 "Vertaling eigen recepten" (3): an own/received recipe without its second language.
  'recipe.missingEn': { nl: 'Engels ontbreekt — toevoegen', en: 'English missing — add' },
  'recipe.missingNl': { nl: 'Nederlands ontbreekt — toevoegen', en: 'Dutch missing — add' },
  'tag.vegetarisch': { nl: 'vegetarisch', en: 'vegetarian' },
  'tag.vega-optie': { nl: 'vega-optie', en: 'veggie option' },
  'tag.snel': { nl: 'snel', en: 'quick' },
  'tag.oven': { nl: 'oven', en: 'oven' },
  'tag.wok': { nl: 'wok', en: 'wok' },
  'tag.kids': { nl: 'kids', en: 'kids' },
  'tag.wereld': { nl: 'wereld', en: 'world' },
  'tag.feest': { nl: 'feest', en: 'party' },
  'tag.zomer': { nl: 'zomer', en: 'summer' },
  'tag.winter': { nl: 'winter', en: 'winter' },

  // --- Detail, phase 5 block D (1-2): own photos + print / copy as text ---
  'recipe.photos': { nl: 'Foto’s', en: 'Photos' },
  'recipe.addPhoto': { nl: '+ Foto', en: '+ Photo' },
  'recipe.photoView': { nl: 'Bekijk foto', en: 'View photo' },
  'recipe.photoBy': { nl: 'Foto van {name}', en: 'Photo by {name}' },
  'recipe.photoDeleteConfirm': { nl: 'Deze foto verwijderen? Dit kan niet ongedaan worden gemaakt.', en: 'Delete this photo? This cannot be undone.' },
  'recipe.photoError': { nl: 'Foto toevoegen lukte niet. Probeer een andere foto.', en: 'Could not add the photo. Try a different one.' },
  'recipe.print': { nl: 'Print', en: 'Print' },
  'recipe.copyAsText': { nl: 'Kopieer als tekst', en: 'Copy as text' },
  'recipe.wholeRecipe': { nl: 'Heel recept', en: 'Whole recipe' },
  'recipe.ingredientsOnly': { nl: 'Alleen ingrediënten', en: 'Ingredients only' },
  // Honest wording (invariant 13): window.print() is unreliable in an iOS Home Screen app, so the
  // iPhone gets this hint instead of a dead Print button (the share sheet has a Print activity).
  'recipe.printIosHint': { nl: 'Printen op iPhone: Deel → Print.', en: 'To print on iPhone: Share → Print.' },
  'recipe.copied': { nl: 'Gekopieerd ✓', en: 'Copied ✓' },
  'recipe.copyFailed': { nl: 'Kopiëren lukte niet.', en: 'Copying failed.' },

  // --- Detail, phase 5 block F (2): recipe variants (glutenvrij / vegetarisch / vegan) ---
  // 13D block 2 (docs/specs/varianten-tabs.md §3) replaced the "Maak … versie" buttons and the "Ook als:"
  // chips by the tab row: its strings live in src/i18n/variants.ts (`vt.*`). These keys are still used by the
  // approve sheet (VariantSheet) and the "Versie van …" link.
  'recipe.variantOf': { nl: 'Versie van {name}', en: 'Version of {name}' },
  'recipe.variants': { nl: 'Varianten', en: 'Variants' },
  'variant.check': { nl: 'controleer zelf', en: 'check yourself' },
  'variant.checkHint': {
    nl: 'Hiervoor kent de app geen vervanger. De regel blijft staan; pas hem na het opslaan zelf aan.',
    en: 'The app knows no replacement for this. The line stays as it is; adjust it yourself after saving.',
  },
  // A swap exists but the app could not rewrite this line safely: say what to use instead.
  'variant.checkSwap': {
    nl: 'Vervang {from} hier zelf door {to}. De regel blijft staan; pas hem na het opslaan aan.',
    en: 'Replace {from} with {to} yourself here. The line stays as it is; adjust it after saving.',
  },
  'variant.onlyCheck': {
    nl: 'De app kan hier niets automatisch vervangen. Je krijgt een kopie met het label; pas de regels daarna zelf aan.',
    en: 'The app cannot replace anything here automatically. You get a copy with the label; adjust the lines yourself afterwards.',
  },
  'variant.saveFailed': { nl: 'Bewaren lukte niet. Probeer het nog eens.', en: 'Saving failed. Please try again.' },
  'variant.noProfile': { nl: 'Kies eerst een profiel (Meer) om een versie te maken.', en: 'Choose a profile first (More) to make a version.' },
  'variant.swapLabel': { nl: '{from} wordt {to}', en: '{from} becomes {to}' },

  // --- Detail + Home, phase 6 A.3: "✓ Gekookt" without cook mode and "Beoordeel" afterwards ---
  'recipe.cooked': { nl: '✓ Gekookt', en: '✓ Cooked' },
  'recipe.rate': { nl: 'Beoordeel', en: 'Rate' },
  'recipe.rateHint': { nl: 'Gekookt op {date}, nog geen sterren', en: 'Cooked on {date}, no stars yet' },
  'cooked.title': { nl: 'Gekookt', en: 'Cooked' },
  'cooked.rateTitle': { nl: 'Beoordeel', en: 'Rate it' },
  'cooked.intro': { nl: 'Uit het hoofd gekookt? Zet het hier in je kooklog.', en: 'Cooked from memory? Add it to your cook log here.' },
  'cooked.rateIntro': { nl: 'Hoe was het?', en: 'How was it?' },
  'cooked.when': { nl: 'Wanneer?', en: 'When?' },
  'cooked.today': { nl: 'Vandaag', en: 'Today' },
  'cooked.yesterday': { nl: 'Gisteren', en: 'Yesterday' },
  'cooked.otherDay': { nl: 'Andere datum', en: 'Another date' },
  'cooked.dateLabel': { nl: 'Datum', en: 'Date' },
  'cooked.cookedOn': { nl: 'Gekookt op {date}', en: 'Cooked on {date}' },
  'cooked.save': { nl: 'Bewaar', en: 'Save' },
  'cooked.saveRating': { nl: 'Bewaar beoordeling', en: 'Save rating' },
  'cooked.saving': { nl: 'Bewaren…', en: 'Saving…' },
  'cooked.dismissHint': {
    nl: 'Alleen Bewaar bewaart. Naar beneden vegen of ernaast tikken sluit zonder te bewaren.',
    en: 'Only Save saves. Swiping down or tapping beside this closes without saving.',
  },
  'cooked.photoHint': { nl: 'Deze foto wordt bewaard als je op Bewaar tikt.', en: 'This photo is saved when you tap Save.' },
  'cooked.photoRemove': { nl: 'Foto weghalen', en: 'Remove photo' },
  'cooked.photoAlt': { nl: 'De gekozen foto', en: 'The chosen photo' },
  'cooked.saved': { nl: 'Gekookt ✓ — staat in je kooklog', en: 'Cooked ✓ — added to your cook log' },
  'cooked.ratedSaved': { nl: 'Beoordeling bewaard ✓', en: 'Rating saved ✓' },
  'cooked.failed': { nl: 'Bewaren lukte niet. Probeer het nog eens.', en: 'Saving failed. Please try again.' },
  'cooked.noProfile': { nl: 'Kies eerst een profiel (Meer) om een kookbeurt te bewaren.', en: 'Choose a profile first (More) to save a cook.' },

  // --- Servings scaler + ingredient lines (detail and cook mode) ---
  'servings.label': { nl: 'Aantal personen', en: 'Number of people' },
  'servings.less': { nl: 'Minder personen', en: 'Fewer people' },
  'servings.more': { nl: 'Meer personen', en: 'More people' },
  'servings.persons': { nl: '{n} pers.', en: 'serves {n}' },
  'servings.base': { nl: 'recept: {n}', en: 'recipe: {n}' },
  'servings.orig': { nl: '({n} pers.: {amt})', en: '(serves {n}: {amt})' },
  'line.link': { nl: 'Koppel ingrediënt', en: 'Link ingredient' },
  'line.linkHint': {
    nl: 'Regels met een ? kent de app nog niet: tik erop om het ingrediënt te koppelen.',
    en: 'Lines with a ? are not recognised yet: tap one to link the ingredient.',
  },

  // --- Cook mode ---
  'cook.title': { nl: 'Koken', en: 'Cooking' },
  'cook.prepare': { nl: 'Klaarzetten', en: 'Get ready' },
  'cook.prepareHint': { nl: 'Vink af wat je hebt klaargezet.', en: 'Tick what you have set out.' },
  'cook.ready': { nl: '{n} van {total} klaar', en: '{n} of {total} ready' },
  'cook.tickAll': { nl: 'Alles klaar ✓', en: 'All ready ✓' },
  'cook.untickAll': { nl: 'Alles uitvinken', en: 'Untick all' },
  'cook.stepOf': { nl: 'Stap {n} van {total}', en: 'Step {n} of {total}' },
  'cook.stepShort': { nl: 'stap {n}', en: 'step {n}' },
  'cook.prev': { nl: 'Vorige', en: 'Previous' },
  'cook.next': { nl: 'Volgende', en: 'Next' },
  'cook.begin': { nl: 'Begin', en: 'Start' },
  'cook.finish': { nl: 'Klaar', en: 'Done' },
  'cook.doneTitle': { nl: 'Gekookt!', en: 'Cooked!' },
  'cook.doneText': { nl: 'Lekker gewerkt. Hoe was het?', en: 'Nice work. How was it?' },
  'cook.stars': { nl: 'Sterren (optioneel)', en: 'Stars (optional)' },
  'cook.starN': { nl: '{n} van 5 sterren', en: '{n} of 5 stars' },
  'cook.noteLabel': { nl: 'Notitie (optioneel)', en: 'Note (optional)' },
  'cook.notePlaceholder': { nl: 'Bv. volgende keer minder peper', en: 'E.g. less pepper next time' },
  'cook.logIt': { nl: 'Gekookt!', en: 'Cooked!' },
  'cook.notYet': { nl: 'Nog niet klaar', en: 'Not done yet' },
  'cook.noProfile': { nl: 'Kies eerst een profiel (Meer) om dit te bewaren.', en: 'Choose a profile first (More) to save this.' },
  'cook.wakeHint': { nl: 'Het scherm blijft aan tijdens het koken.', en: 'The screen stays on while you cook.' },
  'cook.wakeNo': { nl: 'Scherm aan houden lukt niet op dit toestel.', en: 'Keeping the screen on is not supported on this phone.' },
  'cook.swipeHint': { nl: 'Veeg of tik om te bladeren.', en: 'Swipe or tap to move on.' },

  // --- Cook mode, phase 5 B.1-2: read-aloud + voice commands ---
  'cook.readAloud': { nl: 'Lees voor', en: 'Read aloud' },
  'cook.readAloudStop': { nl: 'Stop voorlezen', en: 'Stop reading' },
  'cook.readAloudOn': { nl: 'Voorlezen staat aan', en: 'Reading aloud is on' },
  'cook.readAloudOnNote': { nl: 'Elke volgende stap wordt ook voorgelezen. Tik nog eens om het uit te zetten.', en: 'Every next step is read aloud too. Tap again to turn it off.' },
  'cook.readAloudList': { nl: 'Ingrediënten voorlezen', en: 'Read the ingredients' },
  'cook.readAloudHint': { nl: 'Houd ingedrukt voor de ingrediënten', en: 'Hold to hear the ingredients' },
  'cook.mic': { nl: 'Spraakcommando’s', en: 'Voice commands' },
  'cook.micOff': { nl: 'Mic uit', en: 'Mic off' },
  'cook.micOn': { nl: 'Mic aan…', en: 'Mic on…' },
  'cook.micListening': { nl: 'Luistert…', en: 'Listening…' },
  'cook.micError': { nl: 'Mic-fout', en: 'Mic error' },

  // --- Cook mode, phase 6 block A (6A.8): the "?" sheet with every voice command + example phrases
  //     (src/components/VoiceHelp.tsx reads `${key}Say` for the examples) and the spoken answers of
  //     the new "hoe lang nog" command. Honest about the echo guard (invariant 13). ---
  'cook.help': { nl: 'Welke commando’s kan ik zeggen?', en: 'What can I say?' },
  'cook.helpIntro': {
    nl: 'Zet de mic aan en zeg één van deze woorden. De app verstaat de taal van je profiel.',
    en: 'Turn the mic on and say one of these. The app listens in the language of your profile.',
  },
  'cook.helpEcho': {
    nl: 'Tijdens het voorlezen luistert de mic even niet; wacht tot de stem klaar is en zeg het dan.',
    en: 'While the app reads aloud the mic pauses; wait until the voice has finished, then speak.',
  },
  'cook.cmd.next': { nl: 'Volgende stap', en: 'Next step' },
  'cook.cmd.nextSay': { nl: 'volgende · volgende stap', en: 'next · next step' },
  'cook.cmd.prev': { nl: 'Vorige stap', en: 'Previous step' },
  'cook.cmd.prevSay': { nl: 'vorige · ga terug', en: 'previous · go back' },
  'cook.cmd.read': { nl: 'Lees deze stap voor', en: 'Read this step' },
  'cook.cmd.readSay': { nl: 'lees voor · voorlezen', en: 'read · read aloud' },
  'cook.cmd.repeat': { nl: 'Zeg het nog eens', en: 'Say that again' },
  'cook.cmd.repeatSay': { nl: 'herhaal · nog een keer · wat zeg je?', en: 'repeat · again · say that again · what?' },
  'cook.cmd.ingredients': { nl: 'Lees de ingrediënten voor', en: 'Read the ingredients' },
  'cook.cmd.ingredientsSay': { nl: 'ingrediënten · boodschappen', en: 'ingredients · read the ingredients' },
  'cook.cmd.timer': { nl: 'Zet een timer', en: 'Set a timer' },
  'cook.cmd.timerSay': {
    nl: 'timer 10 minuten · zet een timer voor een kwartier',
    en: 'timer 10 minutes · set a timer for a quarter of an hour',
  },
  'cook.cmd.quantities': {
    nl: 'Hoeveel van elk ingrediënt in deze stap (en zet Toon hoeveelheden aan)',
    en: 'How much of each ingredient this step uses (and turns on Show amounts)',
  },
  'cook.cmd.quantitiesSay': { nl: 'hoeveel? · hoeveel heb ik nodig?', en: 'how much? · how many? · how much do I need?' },
  'cook.cmd.timeLeft': { nl: 'Hoe lang de timer nog loopt', en: 'How long the timer has left' },
  'cook.cmd.timeLeftSay': { nl: 'hoe lang nog · hoeveel tijd nog', en: 'how long left · how much time' },
  'cook.cmd.stop': { nl: 'Stop met voorlezen', en: 'Stop reading' },
  'cook.cmd.stopSay': { nl: 'stop', en: 'stop' },
  'cook.voice.noTimer': { nl: 'Er loopt geen timer voor dit recept.', en: 'No timer is running for this recipe.' },
  'cook.voice.leftMin': { nl: 'nog {n} minuten', en: '{n} minutes left' },
  'cook.voice.leftMin1': { nl: 'nog 1 minuut', en: '1 minute left' },
  'cook.voice.leftSec': { nl: 'nog {n} seconden', en: '{n} seconds left' },

  // --- 13I: the ingredients a step names are green; a tap shows the amount, "Toon hoeveelheden"
  //     shows them all (remembered per device), "hoeveel?" reads them aloud. ---
  'cook.showAmounts': { nl: 'Toon hoeveelheden', en: 'Show amounts' },
  'cook.hideAmounts': { nl: 'Verberg hoeveelheden', en: 'Hide amounts' },
  // Spoken by the app while the mic listens: no voice command word in it ("ingrediënten" would
  // make the app read the whole list to itself; tests/voice.test.ts checks every cook.voice.* line).
  'cook.voice.noQuantities': { nl: 'In deze stap staat niets uit de lijst.', en: 'This step uses nothing from the list.' },
  // Only underlined green words are buttons; shown only while "Toon hoeveelheden" is off.
  'recipe.amountsHint': { nl: 'Tik op een onderstreept ingrediënt voor de hoeveelheid.', en: 'Tap an underlined ingredient to see how much.' },

  // --- Cook mode, phase 5 block D.1: "Foto toevoegen" on the "Gekookt!" page ---
  'cook.photoAdd': { nl: 'Foto toevoegen', en: 'Add a photo' },
  'cook.photoBusy': { nl: 'Foto toevoegen…', en: 'Adding photo…' },
  'cook.photoAdded': { nl: 'Foto toegevoegd', en: 'Photo added' },
  'cook.photoFailed': { nl: 'Foto toevoegen lukte niet — probeer opnieuw', en: 'Could not add the photo — try again' },

  // --- Timers ---
  'timer.title': { nl: 'Timers', en: 'Timers' },
  'timer.done': { nl: 'Klaar!', en: 'Done!' },
  'timer.minus': { nl: '1 minuut korter', en: '1 minute less' },
  'timer.plus': { nl: '1 minuut langer', en: '1 minute more' },
  'timer.stop': { nl: 'Timer stoppen', en: 'Stop timer' },
  'timer.openStep': { nl: '{label} — naar deze stap', en: '{label} — go to this step' },
  'timer.reset': { nl: 'Opnieuw vanaf {d}', en: 'Restart from {d}' },
  'timer.start': { nl: 'Start timer {d}', en: 'Start {d} timer' },
  'timer.running': { nl: 'Timer loopt', en: 'Timer running' },
  'timer.notif.left': { nl: 'nog {n} min', en: '{n} min left' },
  'timer.notif.done': { nl: 'Timer klaar — {label}', en: 'Timer done — {label}' },
  'timer.notif.doneBody': { nl: 'De tijd is om.', en: 'Time is up.' },
  'timer.askTitle': { nl: 'Meldingen aanzetten?', en: 'Turn on notifications?' },
  // Honest wording (invariant 13): the updates come from the open app, not from a background alarm.
  'timer.askBody': {
    nl: 'Dan zie je de resterende minuten in je meldingen zolang de app open staat, en krijg je een melding als de timer klaar is.',
    en: 'While the app is open you will see the minutes left in your notifications, and you get a notification when the timer is done.',
  },
  'timer.askYes': { nl: 'Meldingen aanzetten', en: 'Turn on notifications' },
  'timer.askNo': { nl: 'Niet nu', en: 'Not now' },
  // Phase 5 B.3: the 🔔/🔕 sound toggle in the timer bar. 'timer.sound' is the fixed accessible
  // name (the on/off state comes from aria-pressed); soundOn/soundOff feed the sighted tooltip.
  'timer.sound': { nl: 'Timergeluid', en: 'Timer sound' },
  'timer.soundOn': { nl: 'Timergeluid aan', en: 'Timer sound on' },
  'timer.soundOff': { nl: 'Timergeluid uit', en: 'Timer sound off' },
  // 13K cooking bar (docs/specs/kookbalk.md §1f): head label, the recipe row "Afwasmachinezalm ·
  // stap 3 van 7 ›" with its aria-labels, the × that ends a session, and the "Losse timers" sub-head.
  'cooking.title': { nl: 'Nu aan het koken', en: 'Cooking now' },
  'cooking.stepOf': { nl: 'stap {n} van {total}', en: 'step {n} of {total}' },
  'cooking.prepare': { nl: 'klaarzetten', en: 'getting ready' },
  'cooking.open': { nl: '{name} — verder bij stap {n}', en: '{name} — continue at step {n}' },
  'cooking.openPrepare': { nl: '{name} — naar klaarzetten', en: '{name} — back to getting ready' },
  'cooking.stop': { nl: 'Klaar met {name}', en: 'Done with {name}' },
  'cooking.loose': { nl: 'Losse timers', en: 'Other timers' },
  'cooking.timerNoStep': { nl: 'timer', en: 'timer' },
};
