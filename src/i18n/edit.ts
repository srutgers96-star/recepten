// Strings of the edit screens: editor (add/edit), share, inbox/import. Owned by the edit agent.
// Every key needs both nl and en. Keys are merged in ./index.ts (later dictionaries win), so the
// `share.*` keys below override the phase-0 ones in common.ts where they are redefined.
// Placeholders of per-language fields are looked up with tIn(fieldLang, key), not in the UI language.
import type { Dict } from './index';

export const edit: Dict = {
  // --- Editor (/add, /edit/:id) ---
  'edit.titleNew': { nl: 'Nieuw recept', en: 'New recipe' },
  'edit.titleEdit': { nl: 'Bewerk recept', en: 'Edit recipe' },
  'edit.lang': { nl: 'Taal van het recept', en: 'Recipe language' },
  'edit.lang.nl': { nl: 'NL', en: 'NL' },
  'edit.lang.en': { nl: 'EN', en: 'EN' },
  'edit.lang.both': { nl: 'beide', en: 'both' },
  'edit.name': { nl: 'Naam', en: 'Name' },
  'edit.namePlaceholder': { nl: 'bv. Pasta pesto', en: 'e.g. Pesto pasta' },
  'edit.servings': { nl: 'Personen', en: 'Servings' },
  'edit.fewer': { nl: 'Minder personen', en: 'Fewer servings' },
  'edit.more': { nl: 'Meer personen', en: 'More servings' },
  'edit.ingredients': { nl: 'Ingrediënten', en: 'Ingredients' },
  'edit.linePlaceholder': { nl: 'bv. 400 g aardappelen', en: 'e.g. 400 g potatoes' },
  'edit.lineHint': {
    nl: 'Een regel die eindigt op ":" wordt een kopje, bv. "Dressing:".',
    en: 'A line ending in ":" becomes a header, e.g. "Dressing:".',
  },
  'edit.enFromDictionaryHint': {
    nl: 'Herkende ingrediënten (✓) worden in het Engels uit het woordenboek weergegeven; de Engelse tekst van zo\'n regel telt niet mee. Pas ze aan via de chips of "Koppel".',
    en: 'Recognised ingredients (✓) are shown in English from the dictionary; the English text of such a line is not used. Adjust them through the chips or "Link".',
  },
  'edit.addLine': { nl: '+ regel', en: '+ line' },
  'edit.removeLine': { nl: 'Verwijder regel', en: 'Remove line' },
  'edit.steps': { nl: 'Bereiding', en: 'Method' },
  'edit.stepPlaceholder': { nl: 'bv. Kook de aardappelen in 20 minuten gaar.', en: 'e.g. Boil the potatoes for 20 minutes.' },
  'edit.addStep': { nl: '+ stap', en: '+ step' },
  'edit.removeStep': { nl: 'Verwijder stap', en: 'Remove step' },
  'edit.pasteMethod': { nl: 'Plak hele bereiding', en: 'Paste whole method' },
  'edit.pasteHint': {
    nl: 'Plak de hele bereiding in één keer; lege regels worden stapgrenzen, lange alinea’s worden gesplitst.',
    en: 'Paste the whole method at once; blank lines become step boundaries, long paragraphs are split.',
  },
  'edit.pasteLang': { nl: 'Taal van de tekst', en: 'Language of the text' },
  'edit.split': { nl: 'Splits in stappen', en: 'Split into steps' },
  'edit.splitNone': { nl: 'Geen tekst om te splitsen.', en: 'No text to split.' },
  'edit.splitDone': { nl: '{n} stappen toegevoegd', en: '{n} steps added' },
  'edit.save': { nl: 'Bewaar', en: 'Save' },
  'edit.saving': { nl: 'Bewaren…', en: 'Saving…' },
  'edit.invalidHint': {
    nl: 'Nodig: een naam, minstens 1 ingrediënt en 1 stap.',
    en: 'Needed: a name, at least 1 ingredient and 1 step.',
  },
  'edit.saveError': { nl: 'Bewaren mislukt', en: 'Saving failed' },
  'edit.delete': { nl: 'Verwijder recept', en: 'Delete recipe' },
  'edit.confirmDelete': {
    nl: 'Dit recept verwijderen? Dit kan niet ongedaan worden gemaakt.',
    en: 'Delete this recipe? This cannot be undone.',
  },
  'edit.notFound': { nl: 'Recept niet gevonden', en: 'Recipe not found' },
  'edit.makeCopy': { nl: 'Maak eigen kopie', en: 'Make my own copy' },
  'edit.servingTip': { nl: 'Serveertip', en: 'Serving tip' },
  'edit.servingTipPlaceholder': { nl: 'bv. Lekker met stokbrood', en: 'e.g. Nice with crusty bread' },

  // --- Editor: builtin in override mode (docs/phase-2-spec.md §5 "Curator") ---
  'edit.titleOverride': { nl: 'Aanpassing van klassieker', en: 'Tweak of a classic' },
  'edit.overrideHint': {
    nl: 'De klassieker zelf blijft zoals hij is; alleen wat je hier verandert wordt bewaard als aanpassing. Personen kun je niet wijzigen (maak daarvoor een eigen kopie).',
    en: 'The classic itself stays as it is; only what you change here is kept as a tweak. Servings cannot be changed (make your own copy for that).',
  },
  'edit.overrideActive': { nl: 'Aangepast op {date}', en: 'Tweaked on {date}' },
  'edit.restoreOriginal': { nl: 'Herstel origineel', en: 'Restore original' },
  'edit.confirmRestore': {
    nl: 'Alle aanpassingen van deze klassieker wissen en het origineel terugzetten?',
    en: 'Remove all tweaks of this classic and restore the original?',
  },

  // --- Editor: ingredient chips ---
  'edit.headerChip': { nl: 'kopje', en: 'heading' },
  'edit.unresolved': { nl: 'Ingrediënt niet herkend', en: 'Ingredient not recognised' },
  'edit.link': { nl: 'Koppel', en: 'Link' },
  'edit.newIngredient': { nl: 'Nieuw ingrediënt', en: 'New ingredient' },
  'edit.chipEdit': { nl: 'Regel aanpassen', en: 'Adjust line' },
  'edit.qty': { nl: 'Hoeveelheid', en: 'Quantity' },
  'edit.qtyInvalid': { nl: 'Hoeveelheid niet begrepen (bv. 2, 2-3, ½, 1,5).', en: 'Quantity not understood (e.g. 2, 2-3, ½, 1.5).' },
  'edit.unit': { nl: 'Eenheid', en: 'Unit' },
  'edit.unitNone': { nl: 'stuks / geen', en: 'pieces / none' },
  'edit.prep': { nl: 'Bewerking', en: 'Preparation' },
  'edit.prepPlaceholder': { nl: 'bv. fijngehakt', en: 'e.g. finely chopped' },
  'edit.optional': { nl: 'Optioneel', en: 'Optional' },
  'edit.apply': { nl: 'Pas toe', en: 'Apply' },
  'edit.relink': { nl: 'Ander ingrediënt', en: 'Other ingredient' },

  // --- Editor: language pair (translate via an external AI) ---
  'edit.translate': { nl: 'Vertaling', en: 'Translation' },
  'edit.translateHint': {
    nl: 'Kopieer de genummerde opdracht, plak hem in ChatGPT of Claude, en plak het antwoord hieronder terug. Alleen de andere taal wordt ingevuld.',
    en: 'Copy the numbered prompt, paste it into ChatGPT or Claude, and paste the answer back below. Only the other language is filled in.',
  },
  'edit.translateFrom': { nl: 'Richting', en: 'Direction' },
  'edit.copyForTranslation': { nl: 'Kopieer voor vertaling', en: 'Copy for translation' },
  'edit.pasteTranslation': { nl: 'Plak vertaling', en: 'Paste translation' },
  'edit.applyTranslation': { nl: 'Vul in', en: 'Fill in' },
  'edit.promptCopied': { nl: 'Gekopieerd — plak in ChatGPT of Claude', en: 'Copied — paste into ChatGPT or Claude' },
  'edit.copyFailed': { nl: 'Kopiëren mislukt — kopieer de tekst hieronder zelf.', en: 'Copy failed — copy the text below yourself.' },
  'edit.translateNone': { nl: 'Geen genummerde vertaling gevonden in de tekst.', en: 'No numbered translation found in the text.' },
  'edit.translateStepsMismatch': {
    nl: 'Aantal stappen klopt niet: {got} in de vertaling, {expected} in het recept. Niets ingevuld.',
    en: 'Step count does not match: {got} in the translation, {expected} in the recipe. Nothing filled in.',
  },
  'edit.translateLinesMismatch': {
    nl: 'Aantal ingrediëntregels klopt niet: {got} in de vertaling, {expected} in het recept. Niets ingevuld.',
    en: 'Ingredient line count does not match: {got} in the translation, {expected} in the recipe. Nothing filled in.',
  },
  'edit.translateDone': { nl: 'Vertaling ingevuld: {lines} regels, {steps} stappen', en: 'Translation filled in: {lines} lines, {steps} steps' },

  // --- Editor: import from a photo / text via an external AI ---
  'edit.import': { nl: 'Importeer van foto/tekst', en: 'Import from photo/text' },
  'edit.importHint': {
    nl: 'Kopieer de instructie, plak hem met de foto (of de tekst) van het recept in ChatGPT of Claude, en plak het resultaat hieronder.',
    en: 'Copy the instruction, paste it together with the photo (or the text) of the recipe into ChatGPT or Claude, and paste the result below.',
  },
  'edit.copyImportPrompt': { nl: 'Kopieer instructie-prompt', en: 'Copy instruction prompt' },
  'edit.importPaste': { nl: 'Plak het resultaat', en: 'Paste the result' },
  'edit.importApply': { nl: 'Vul in', en: 'Fill in' },
  'edit.importNone': { nl: 'Geen recept herkend in de tekst.', en: 'No recipe recognised in the text.' },
  'edit.importDone': { nl: 'Ingevuld: {lines} ingrediënten, {steps} stappen', en: 'Filled in: {lines} ingredients, {steps} steps' },
  'edit.promptText': { nl: 'Tekst om te kopiëren', en: 'Text to copy' },

  // --- Share (/share/:id) ---
  'share.title': { nl: 'Delen', en: 'Share' },
  'share.notFound': { nl: 'Recept niet gevonden', en: 'Recipe not found' },
  'share.intro': {
    nl: 'Bericht met receptcode voor WhatsApp. De ontvanger tikt op de link of plakt het bericht in de Inbox van de app.',
    en: 'Message with the recipe code for WhatsApp. The recipient taps the link or pastes the message into the Inbox of the app.',
  },
  'share.noProfile': {
    nl: 'Kies eerst een profiel onder Meer, dan staat je naam in het bericht.',
    en: 'Choose a profile under More first, so your name is in the message.',
  },
  'share.message': { nl: 'Bericht', en: 'Message' },
  'share.length': { nl: '{n} tekens', en: '{n} characters' },
  'share.whatsapp': { nl: 'Deel via WhatsApp', en: 'Share via WhatsApp' },
  'share.copy': { nl: 'Kopieer', en: 'Copy' },
  'share.copied': { nl: 'Gekopieerd', en: 'Copied' },
  'share.encoding': { nl: 'Bezig met coderen…', en: 'Encoding…' },
  'share.error': { nl: 'Delen mislukt', en: 'Sharing failed' },
  'share.copyError': { nl: 'Kopiëren mislukt', en: 'Copy failed' },
  'share.noShareApi': { nl: 'Geen deelmenu — WhatsApp wordt direct geopend', en: 'No share sheet — opening WhatsApp directly' },
  'share.asText': { nl: 'Deel als tekst', en: 'Share as text' },
  'share.asTextHint': {
    nl: 'Leesbaar recept voor mensen zonder de app; de link staat onderaan.',
    en: 'Readable recipe for people without the app; the link comes last.',
  },
  'share.textLang': { nl: 'Taal', en: 'Language' },
  'share.copyText': { nl: 'Kopieer tekst', en: 'Copy text' },

  // --- Inbox (/inbox): import + received ---
  'inbox.title': { nl: 'Inbox', en: 'Inbox' },
  'inbox.hint': {
    nl: 'Plak hier een WhatsApp-bericht, een link of een receptbestand.',
    en: 'Paste a WhatsApp message, a link or a recipe file here.',
  },
  'inbox.paste': { nl: 'Plak van klembord', en: 'Paste from clipboard' },
  'inbox.pasteHint': {
    nl: 'iPhone: tik op "Plak" als dat verschijnt, of houd het tekstvak ingedrukt → Plak.',
    en: 'iPhone: tap "Paste" when it appears, or long-press the text box → Paste.',
  },
  'inbox.file': { nl: 'Kies bestand', en: 'Choose file' },
  'inbox.clear': { nl: 'Wis', en: 'Clear' },
  'inbox.noToken': { nl: 'Geen recept gevonden in deze tekst.', en: 'No recipe found in this text.' },
  'inbox.invalid': { nl: 'Ongeldige receptcode.', en: 'Invalid recipe code.' },
  'inbox.unsupported': { nl: 'Update de app eerst (nieuwere versie van de code).', en: 'Update the app first (newer code version).' },
  'inbox.unsupportedType': { nl: 'Dit type wordt nog niet ondersteund:', en: 'This type is not supported yet:' },
  'inbox.backup': {
    nl: 'Dit is een back-up. Herstel die via Meer → Opslag & back-up.',
    en: 'This is a backup. Restore it via More → Storage & backup.',
  },
  'inbox.preview': { nl: 'Voorproefje', en: 'Preview' },
  'inbox.at': { nl: 'gedeeld op', en: 'shared on' },
  'inbox.ingredients': { nl: '{n} ingrediënten', en: '{n} ingredients' },
  'inbox.steps': { nl: '{n} stappen', en: '{n} steps' },
  'inbox.new': { nl: 'Nieuw', en: 'New' },
  'inbox.exists': { nl: 'Al aanwezig', en: 'Already present' },
  'inbox.existsHint': { nl: 'Dit recept staat al in je lijst.', en: 'This recipe is already in your list.' },
  'inbox.updated': { nl: 'Bijgewerkt', en: 'Updated' },
  'inbox.updatedHint': {
    nl: 'Een nieuwere versie van een recept dat je al hebt; bewaren vervangt de oude.',
    en: 'A newer version of a recipe you already have; saving replaces the old one.',
  },
  'inbox.save': { nl: 'Bewaar', en: 'Save' },
  'inbox.saved': { nl: 'Bewaard', en: 'Saved' },
  'inbox.skipped': { nl: 'Niet bewaard (al aanwezig)', en: 'Not saved (already present)' },
  'inbox.saveError': { nl: 'Bewaren mislukt', en: 'Saving failed' },
  'inbox.open': { nl: 'Open', en: 'Open' },
  'inbox.fromShare': { nl: 'Ontvangen via het deelmenu', en: 'Received via the share sheet' },
  'inbox.pasteFailed': { nl: 'Plakken mislukt — plak in het tekstvak.', en: 'Paste failed — paste into the text box instead.' },
  'inbox.fileFailed': { nl: 'Bestand kon niet worden gelezen.', en: 'Could not read the file.' },
  'inbox.received': { nl: 'Ontvangen recepten', en: 'Received recipes' },
  'inbox.empty': { nl: 'Nog niets ontvangen. Gedeelde recepten verschijnen hier.', en: 'Nothing received yet. Shared recipes appear here.' },
  'inbox.unseen': { nl: 'nieuw', en: 'new' },
};
