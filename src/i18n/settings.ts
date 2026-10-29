// Strings of the settings screens: more, profiles, onboarding, storage, story (check keys live in
// common.ts since phase 0). Owned by the settings agent. Every key needs both nl and en. Keys are
// merged in ./index.ts (later wins).
import type { Dict } from './index';

export const settings: Dict = {
  // --- Meer -------------------------------------------------------------------------------------
  'more.title': { nl: 'Meer', en: 'More' },
  'more.profile': { nl: 'Actief profiel', en: 'Active profile' },
  'more.switchTo': { nl: 'Wissel naar', en: 'Switch to' },
  'more.addProfile': { nl: '+ profiel', en: '+ profile' },
  'more.manageProfiles': { nl: 'Profielen beheren', en: 'Manage profiles' },
  'more.settings': { nl: 'Instellingen', en: 'Settings' },
  'more.language': { nl: 'Taal', en: 'Language' },
  'more.languageHint': { nl: 'Wordt onthouden op je profiel', en: 'Remembered on your profile' },
  'more.theme': { nl: 'Thema', en: 'Theme' },
  'more.theme.system': { nl: 'Systeem', en: 'System' },
  'more.theme.light': { nl: 'Licht', en: 'Light' },
  'more.theme.dark': { nl: 'Donker', en: 'Dark' },
  'more.confetti': { nl: 'Confetti', en: 'Confetti' },
  'more.confettiHint': { nl: 'Bij "Gekookt!" en je eerste eigen recept', en: 'On "Cooked!" and your first own recipe' },
  // --- Phase 5 block C: badges (PLAN §0 Gamification: both off = no gamification at all) ---
  'more.badges': { nl: 'Badges', en: 'Badges' },
  'more.badgesHint': {
    nl: 'Badgepagina en een melding bij een nieuwe badge. Badges én Confetti uit = nergens gamification.',
    en: 'Badge page and a toast for a new badge. Badges and Confetti both off = no gamification anywhere.',
  },
  'more.badgesRowHint': { nl: 'Verdiend en nog te verdienen, per lid en Samen', en: 'Earned and still to earn, per member and Together' },
  // --- 6D (docs/specs/xp-levels.md §1f, block 6D-3 = 6D-4a): the Vrijgespeeld row under Badges ---
  'more.unlocks': { nl: 'Vrijgespeeld', en: 'Unlocked' },
  'more.unlocksHint': { nl: 'Confetti, geluiden en lettertypes die je hebt verdiend', en: 'Confetti, sounds and typefaces you have earned' },
  'more.storage': { nl: 'Opslag & back-up', en: 'Storage & backup' },
  'more.storageHint': { nl: 'Back-up maken of terugzetten, foto’s, opslagruimte', en: 'Make or restore a backup, photos, storage space' },
  // Phase 6 (docs/phase-6-spec.md 6A.5): "Stuur nieuwe naar …" became "Deel je nieuwe recepten".
  'more.sendNew': { nl: 'Deel je nieuwe recepten', en: 'Share your new recipes' },
  'more.sendNewHint': {
    nl: 'Alles wat je sinds de vorige keer maakte of aanpaste, in één bericht',
    en: 'Everything you made or changed since last time, in one message',
  },
  'more.backupDue': { nl: 'back-up nodig', en: 'backup due' },
  // --- Phase 6 (docs/phase-6-spec.md 6A.6): the Meer screen in collapsible groups ---
  'more.group.you': { nl: 'Jij & je huishouden', en: 'You & your household' },
  'more.group.recipes': { nl: 'Recepten & delen', en: 'Recipes & sharing' },
  'more.group.help': { nl: 'Hulp & over', en: 'Help & about' },
  // --- Phase 6 (docs/phase-6-spec.md 6A.7): feedback + the donate link ---
  'more.feedback': { nl: 'Feedback voor Stijn', en: 'Feedback for Stijn' },
  'more.feedbackHint': { nl: 'Een idee, een fout of een compliment', en: 'An idea, a bug or a compliment' },
  'more.donate': { nl: '☕ Steun dit project', en: '☕ Support this project' },
  'more.donateHint': { nl: 'Vrijwillig; de app blijft gratis.', en: 'Voluntary; the app stays free.' },
  'feedback.intro': {
    nl: 'Schrijf wat je kwijt wilt. De app zet er zelf de versie en je toestel onder; daarna kies je zelf Stijn in WhatsApp of mail.',
    en: 'Write whatever you want to say. The app adds the version and your device underneath; then you pick Stijn yourself in WhatsApp or mail.',
  },
  'feedback.placeholder': { nl: 'Bijvoorbeeld: de timer ging niet af toen …', en: 'For example: the timer did not go off when …' },
  'feedback.auto': { nl: 'Gaat automatisch mee', en: 'Added automatically' },
  'feedback.header': { nl: "Feedback over Rutgers' Recepten", en: "Feedback about Rutgers' Recipes" },
  'feedback.app': { nl: 'App', en: 'App' },
  'feedback.device': { nl: 'Toestel', en: 'Device' },
  'feedback.installed': { nl: 'geïnstalleerd als app', en: 'installed as an app' },
  'feedback.inBrowser': { nl: 'in de browser', en: 'in the browser' },
  'feedback.send': { nl: 'Verstuur via WhatsApp of mail', en: 'Send via WhatsApp or mail' },
  'feedback.copy': { nl: 'Kopieer de tekst', en: 'Copy the text' },
  'feedback.empty': { nl: 'Schrijf eerst iets.', en: 'Write something first.' },
  'feedback.sent': { nl: 'Verstuurd — dank je!', en: 'Sent — thank you!' },
  'feedback.copied': { nl: 'Gekopieerd — plak het in WhatsApp of in een mail aan Stijn.', en: 'Copied — paste it into WhatsApp or an email to Stijn.' },
  'feedback.noShare': {
    nl: 'Dit toestel heeft geen deelmenu: kopieer de tekst en plak hem in WhatsApp of een mail.',
    en: 'This device has no share sheet: copy the text and paste it into WhatsApp or an email.',
  },
  'more.story': { nl: 'Het verhaal', en: 'The story' },
  'more.check': { nl: 'Apparaatcheck', en: 'Device check' },
  // --- Phase 6 (docs/phase-6-spec.md 13B): "Links openen in de app" — a sheet with the steps per phone ---
  'more.links': { nl: 'Links openen in de app', en: 'Opening links in the app' },
  'more.linksHint': { nl: 'Wat op Android kan en wat op een iPhone niet', en: 'What Android can do and what an iPhone cannot' },
  'links.intro': {
    nl: 'Een deellink uit WhatsApp hoort in de app te openen, niet in een browser. Dat werkt per telefoon anders.',
    en: 'A share link from WhatsApp should open in the app, not in a browser. That works differently per phone.',
  },
  'links.android': { nl: 'Android', en: 'Android' },
  'links.android.step2': {
    nl: 'Zet Chrome als standaardbrowser: Instellingen → Apps → Standaard-apps → Browser-app → Chrome.',
    en: 'Make Chrome the default browser: Settings → Apps → Default apps → Browser app → Chrome.',
  },
  'links.android.step3': {
    nl: "Instellingen → Apps → Rutgers' Recepten → Standaard openen → zet 'Ondersteunde links openen' aan.",
    en: "Settings → Apps → Rutgers' Recipes → Open by default → switch 'Open supported links' on.",
  },
  'links.android.step4': {
    nl: 'Tik in WhatsApp op een deellink. Opent hij toch in Chrome? Geen ramp: Chrome en de app delen dezelfde opslag, dus het recept komt ook in de app.',
    en: 'Tap a share link in WhatsApp. Does it still open in Chrome? No harm done: Chrome and the app share the same storage, so the recipe reaches the app too.',
  },
  'links.android.honest': {
    nl: 'Android beslist zelf of een link de app opent; de app kan dat niet afdwingen. Een andere browser (Opera, Samsung Internet, Firefox) heeft een eigen opslag: wat je daar bewaart, komt niet in de app.',
    en: 'Android itself decides whether a link opens the app; the app cannot force it. Another browser (Opera, Samsung Internet, Firefox) has storage of its own: what you save there does not reach the app.',
  },
  'links.ios': { nl: 'iPhone', en: 'iPhone' },
  'links.ios.honest': {
    nl: 'Op een iPhone opent een link altijd Safari. Dat kan de app niet veranderen, en Safari heeft een eigen opslag. Zo komt een recept toch in de app:',
    en: 'On an iPhone a link always opens Safari. The app cannot change that, and Safari has storage of its own. This is how a recipe still reaches the app:',
  },
  'links.ios.step1': { nl: 'Tik op de link. Je ziet een voorproefje van het recept.', en: 'Tap the link. You see a preview of the recipe.' },
  'links.ios.step2': { nl: 'Tik op Kopieer receptcode.', en: 'Tap Copy recipe code.' },
  'links.ios.step3': { nl: 'Open de app via het icoon op je beginscherm.', en: 'Open the app from the icon on your Home Screen.' },
  'links.ios.step4': { nl: 'Tik onderaan op Meer → In & uit → Plak van klembord en bewaar het recept.', en: 'Tap More at the bottom → In & out → Paste from clipboard and save the recipe.' },
  'links.ios.alt': {
    nl: 'Sneller: houd het bericht in WhatsApp ingedrukt → Kopieer, open de app en plak.',
    en: 'Quicker: long-press the message in WhatsApp → Copy, open the app and paste.',
  },
  'links.nowIn': { nl: 'Je zit nu in {browser}.', en: 'You are in {browser} right now.' },
  'more.about': { nl: 'Over', en: 'About' },
  'more.version': { nl: 'Versie', en: 'Version' },
  'more.channel': { nl: 'Kanaal', en: 'Channel' },
  'more.build': { nl: 'Build', en: 'Build' },
  'more.github': { nl: 'Broncode op GitHub', en: 'Source code on GitHub' },
  'more.fahrenheit': { nl: '°F erbij', en: 'Show °F too' },
  'more.fahrenheitHint': { nl: 'Oventemperaturen ook in Fahrenheit: 200 °C (400 °F)', en: 'Oven temperatures in Fahrenheit as well: 200 °C (400 °F)' },
  'more.dictionary': { nl: 'Woordenboek', en: 'Dictionary' },
  'more.dictCounts': { nl: '{builtin} ingrediënten · {own} eigen', en: '{builtin} ingredients · {own} own' },
  'more.dictHint': { nl: 'Eigen ingrediënten bekijken, bewerken en samenvoegen', en: 'View, edit and merge your own ingredients' },
  'more.dictNone': {
    nl: 'Nog geen eigen ingrediënten. Die maak je via "Koppel ingrediënt" → "Nieuw ingrediënt".',
    en: 'No own ingredients yet. Create one via "Link ingredient" → "New ingredient".',
  },
  'more.dictDelete': { nl: 'Verwijder', en: 'Delete' },
  'more.dictDeleteConfirm': {
    nl: 'Ingrediënt "{name}" verwijderen? Regels die eraan gekoppeld zijn tonen daarna weer de losse tekst.',
    en: 'Delete ingredient "{name}"? Lines linked to it will show their plain text again.',
  },

  // --- Phase 5 block B: Kookstand & timer (docs/phase-5-spec.md B.1–B.3) ---
  'more.cookTimer': { nl: 'Kookstand & timer', en: 'Cook mode & timer' },
  'more.readAloud': { nl: 'Voorlezen', en: 'Read aloud' },
  'more.readAloudHint': {
    nl: 'Leest elke stap automatisch voor in de kookstand; 🔊 per stap blijft altijd werken',
    en: 'Reads each step aloud automatically in cooking mode; 🔊 per step always keeps working',
  },
  'more.readAloudUnavailable': {
    nl: 'Voorlezen is op dit toestel niet beschikbaar',
    en: 'Read-aloud is not available on this device',
  },
  'more.voiceCommands': { nl: 'Spraakcommando’s', en: 'Voice commands' },
  // Honest capability text (CLAUDE.md invariant 13), phrased platform-neutrally: Android recognises
  // through Google (internet required), iPhone through Apple dictation (can even work on-device).
  'more.voiceCommandsHint': {
    nl: 'Zeg "volgende", "vorige", "timer 10 minuten", "lees voor" of "stop" in de kookstand. Herkenning loopt via de spraakdienst van je telefoon en heeft meestal internet nodig.',
    en: 'Say "next", "previous", "timer 10 minutes", "read" or "stop" in cooking mode. Recognition uses your phone’s speech service and usually needs internet.',
  },
  'more.voiceUnavailable': {
    nl: 'Spraakcommando’s werken alleen op Android; voorlezen werkt overal',
    en: 'Voice commands only work on Android; reading aloud works everywhere',
  },
  'more.timerSound': { nl: 'Timergeluid', en: 'Timer sound' },
  'more.timerSound.beeps': { nl: 'Piepjes', en: 'Beeps' },
  'more.timerSound.bell': { nl: 'Belletje', en: 'Bell' },
  'more.timerSound.melody': { nl: 'Melodietje', en: 'Melody' },
  'more.timerSound.off': { nl: 'Uit', en: 'Off' },
  // 6D (docs/specs/xp-levels.md §1g): the unlockable timer sounds, the cook-mode typeface and the
  // sound on Cooked! (each only shown once unlocked on this phone and switched on).
  'more.timerSound.cowbell': { nl: 'Koebel', en: 'Cowbell' },
  'more.timerSound.gong': { nl: 'Gong', en: 'Gong' },
  'more.timerSound.kitchen': { nl: 'Keukenwekker', en: 'Kitchen timer' },
  'more.timerSound.fanfare': { nl: 'Fanfare', en: 'Fanfare' },
  'more.cookFont': { nl: 'Lettertype kookstand', en: 'Cook-mode typeface' },
  'more.cookFont.default': { nl: 'Standaard', en: 'Default' },
  'more.cookFont.chalk': { nl: 'Krijtbord', en: 'Chalkboard' },
  'more.cookFont.hand': { nl: 'Handschrift', en: 'Handwriting' },
  'more.cookedSound': { nl: 'Geluid bij Gekookt!', en: 'Sound on Cooked!' },
  'more.cookedSoundHint': { nl: 'Een kort tadaa als je een kookbeurt opslaat', en: 'A short ta-da when you save a cook' },
  'more.timerSoundPreview': { nl: 'Luister', en: 'Listen' },
  'more.timerSoundIOSHint': {
    nl: 'iPhone: staat de stil-schakelaar aan de zijkant aan, dan is er geen geluid uit de app — de melding is dan de enige weg.',
    en: 'iPhone: with the silent switch on the side on, the app cannot make a sound — the notification is then the only way.',
  },
  'more.timerVibrate': { nl: 'Trillen bij afloop', en: 'Vibrate when done' },
  'more.timerVibrateHint': {
    nl: 'iPhone kan niet trillen vanuit een web-app; daar trilt alleen de melding.',
    en: 'An iPhone cannot vibrate from a web app; only the notification vibrates there.',
  },

  // --- Phase 5: Meer rows (docs/phase-5-spec.md A.6 + A.8) ---
  'more.checkRecipes': { nl: 'Controleer mijn recepten', en: 'Check my recipes' },
  'more.checkRecipesHint': { nl: 'Voorstel voor categorie en dieet per eigen recept', en: 'Suggested category and diet per own recipe' },
  // --- Phase 5 block D (docs/phase-5-spec.md D.4): the experiments switch ---
  'more.experiments': { nl: 'Experimenten', en: 'Experiments' },
  'more.experimentsHint': {
    nl: 'Functies in aanbouw. Nu: "Toon QR" op het deelscherm en bij je kaartje.',
    en: 'Features under construction. Currently: "Show QR" on the share screen and for your card.',
  },
  'more.householdRow': { nl: 'Huishouden', en: 'Household' },
  'more.householdRowHint': { nl: 'Naam en wie er meekookt', en: 'Name and who cooks along' },

  // --- Phase 5: Huishouden (docs/phase-5-spec.md A.8) ---
  'household.title': { nl: 'Huishouden', en: 'Household' },
  'household.intro': {
    nl: 'Eén huishouden per telefoon. De profielen op deze telefoon zijn automatisch lid; wie op een andere telefoon kookt stuurt je een kaartje (of je typt de naam zelf).',
    en: 'One household per phone. The profiles on this phone are members automatically; someone who cooks on another phone sends you a card (or you type the name yourself).',
  },
  'household.name': { nl: 'Naam van het huishouden', en: 'Household name' },
  // The default household name is never stored (the setting keeps ''); it is rendered in the active language.
  'household.defaultName': { nl: 'Thuis', en: 'Home' },
  'household.members': { nl: 'Leden', en: 'Members' },
  'household.memberCount': { nl: '{n} leden', en: '{n} members' },
  'household.memberOne': { nl: '1 lid', en: '1 member' },
  'household.local': { nl: 'op deze telefoon', en: 'on this phone' },
  'household.byHand': { nl: 'met de hand toegevoegd', en: 'added by hand' },
  'household.fromCard': { nl: 'via kaartje', en: 'via card' },
  'household.manageProfiles': { nl: 'Profielen op deze telefoon beheren', en: 'Manage the profiles on this phone' },
  'household.add': { nl: 'Voeg lid toe', en: 'Add member' },
  'household.memberName': { nl: 'Naam', en: 'Name' },
  'household.memberNamePlaceholder': { nl: 'bv. Oma', en: 'e.g. Grandma' },
  'household.memberColor': { nl: 'Kleur', en: 'Colour' },
  'household.edit': { nl: 'Bewerk', en: 'Edit' },
  'household.remove': { nl: 'Verwijder', en: 'Remove' },
  'household.removeConfirm': {
    nl: 'Lid "{name}" uit het huishouden halen? De kooklog blijft staan.',
    en: 'Remove member "{name}" from the household? The cook log stays.',
  },
  'household.nameExists': { nl: 'Er is al een lid met deze naam.', en: 'There is already a member with this name.' },
  'household.saved': { nl: 'Bewaard', en: 'Saved' },

  // --- Phase 5 block F: member cards (`#f=`) — share mine, add someone else's ---
  'household.myCard': { nl: 'Mijn kaartje', en: 'My card' },
  'household.myCardHint': {
    nl: 'Deel je kaartje met wie op een andere telefoon kookt. Die voegt je toe aan zijn huishouden: wat je stuurt krijgt dan jouw naam en kleur, en "Deel je nieuwe recepten" kent je al.',
    en: 'Share your card with someone who cooks on another phone. They add you to their household: what you send then carries your name and colour, and "Share your new recipes" already knows you.',
  },
  'household.shareCard': { nl: 'Deel mijn kaartje', en: 'Share my card' },
  'household.copyCard': { nl: 'Kopieer link', en: 'Copy link' },
  'household.cardShared': { nl: 'Kaartje gedeeld.', en: 'Card shared.' },
  'household.cardCopied': { nl: 'Gekopieerd — plak het in WhatsApp.', en: 'Copied — paste it into WhatsApp.' },
  // The one-sentence WhatsApp text itself comes from the domain layer (share.ts buildMemberShareMessage).
  'household.cardBuildFailed': { nl: 'Kaartje kon niet worden gemaakt.', en: 'Could not create the card.' },
  // Honest (CLAUDE.md invariants 5 + 13): on an iPhone a link never opens the installed app.
  'household.cardIosHint': {
    nl: 'Android: de ander tikt op de link. iPhone: de link opent de app niet — de ander kopieert het bericht en plakt het in de app (Huishouden → "Voeg lid toe via link of plak", of In & uit).',
    en: 'Android: the other person taps the link. iPhone: the link does not open the app — they copy the message and paste it into the app (Household → "Add a member via link or paste", or In & out).',
  },
  'household.cardQrAlt': { nl: 'QR-code met mijn kaartje', en: 'QR code with my card' },
  'household.cardQrHint': {
    nl: 'Scan met de camera-app van de andere telefoon. Android opent de app; een iPhone opent een voorproefpagina in Safari — kopieer daar de code en plak hem in de app.',
    en: 'Scan with the other phone’s camera app. Android opens the app; an iPhone opens a preview page in Safari — copy the code there and paste it into the app.',
  },
  'household.addViaLink': { nl: 'Voeg lid toe via link of plak', en: 'Add a member via link or paste' },
  // 13A: the box is the universal one; a recipe link or website text pasted here is named and sent on.
  'household.addViaLinkHint': {
    nl: 'Plak hier het kaartje-bericht (of alleen de link) dat de ander je stuurde. Iets anders geplakt? De app zegt wat het is en waar het heen kan.',
    en: 'Paste the card message (or just the link) the other person sent you here. Pasted something else? The app says what it is and where it can go.',
  },
  'household.noCard': { nl: 'Geen kaartje gevonden in deze tekst.', en: 'No card found in this text.' },
  'household.cardFrom': { nl: 'Kaartje van {name}', en: 'Card from {name}' },
  'household.addCard': { nl: 'Voeg {name} toe aan je huishouden', en: 'Add {name} to your household' },
  'household.updateCard': { nl: 'Werk {name} bij', en: 'Update {name}' },
  'household.cardKnown': {
    nl: '{name} is al lid; het kaartje werkt naam, kleur en taal bij.',
    en: '{name} is already a member; the card updates name, colour and language.',
  },
  'household.cardLocal': { nl: '{name} is een profiel op deze telefoon — al lid.', en: '{name} is a profile on this phone — already a member.' },
  'household.cardAdded': { nl: '{name} is toegevoegd aan je huishouden.', en: '{name} was added to your household.' },
  'household.cardUpdated': { nl: '{name} is bijgewerkt.', en: '{name} was updated.' },
  'household.cardFailed': { nl: 'Toevoegen mislukt', en: 'Adding failed' },
  'household.toHousehold': { nl: 'Naar huishouden', en: 'To household' },
  // "Deel je nieuwe recepten" (DeltaShareScreen; the other delta.* keys live in phase2.ts)
  'delta.memberHint': {
    nl: 'Leden van je huishouden staan vooraan. Iemand op een andere telefoon voeg je toe met een kaartje.',
    en: 'Members of your household come first. Someone on another phone is added with a card.',
  },

  // --- Profielen --------------------------------------------------------------------------------
  'profiles.title': { nl: 'Profielen', en: 'Profiles' },
  'profiles.intro': {
    nl: 'Iedereen heeft eigen favorieten en notities. Op deze telefoon ben je nu:',
    en: 'Everyone has their own favourites and notes. On this phone you are now:',
  },
  'profiles.name': { nl: 'Naam', en: 'Name' },
  'profiles.namePlaceholder': { nl: 'bv. Stijn', en: 'e.g. Emma' },
  'profiles.language': { nl: 'Taal', en: 'Language' },
  'profiles.color': { nl: 'Kleur', en: 'Colour' },
  'profiles.add': { nl: 'Profiel toevoegen', en: 'Add profile' },
  'profiles.edit': { nl: 'Bewerk', en: 'Edit' },
  'profiles.use': { nl: 'Gebruik', en: 'Use' },
  'profiles.active': { nl: 'actief', en: 'active' },
  'profiles.delete': { nl: 'Verwijder', en: 'Delete' },
  'profiles.deleteConfirm': {
    nl: 'Profiel "{name}" verwijderen? De favorieten en notities van dit profiel verdwijnen ook.',
    en: 'Delete profile "{name}"? Its favourites and notes are removed as well.',
  },
  'profiles.nameRequired': { nl: 'Geef een naam op', en: 'Enter a name' },
  'profiles.empty': { nl: 'Nog geen profielen', en: 'No profiles yet' },

  // --- Onboarding -------------------------------------------------------------------------------
  'onboarding.title': { nl: 'Wie ben jij?', en: 'Who are you?' },
  'onboarding.intro': {
    nl: 'Je naam staat straks bij wat je deelt en kookt. Favorieten en notities zijn per persoon.',
    en: 'Your name goes with what you share and cook. Favourites and notes are per person.',
  },
  'onboarding.start': { nl: 'Aan de slag', en: "Let's go" },

  // --- Opslag & back-up -------------------------------------------------------------------------
  'storage.title': { nl: 'Opslag & back-up', en: 'Storage & backup' },
  'storage.status': { nl: 'Status', en: 'Status' },
  'storage.standalone': { nl: 'Geïnstalleerd als app', en: 'Installed as an app' },
  'storage.persisted': { nl: 'Opslag beschermd (persisted)', en: 'Storage protected (persisted)' },
  'storage.usage': { nl: 'Gebruikt', en: 'In use' },
  'storage.persistHint': {
    nl: 'Beschermde opslag wordt niet zomaar gewist, maar een back-up is de echte garantie.',
    en: 'Protected storage is not cleared lightly, but a backup is the real guarantee.',
  },
  'storage.counts': { nl: 'Inhoud', en: 'Contents' },
  'storage.builtins': { nl: 'Klassiekers', en: 'Classics' },
  'storage.ownRecipes': { nl: 'Eigen recepten', en: 'Own recipes' },
  'storage.received': { nl: 'Ontvangen recepten', en: 'Received recipes' },
  'storage.favorites': { nl: 'Favorieten', en: 'Favourites' },
  'storage.notes': { nl: 'Notities', en: 'Notes' },
  'storage.cookLog': { nl: 'Keer gekookt', en: 'Times cooked' },
  'storage.profiles': { nl: 'Profielen', en: 'Profiles' },
  // Phase 6 (docs/phase-6-spec.md 13G): two named blocks — "Back-up voor mezelf" and "Mijn recepten
  // aan iemand geven" — each with ONE primary "Bewaar of deel" that opens a Delen / Download sheet.
  // The words "exporteer/export" left the UI: every button says what it does.
  'storage.backupTitle': { nl: 'Back-up voor mezelf', en: 'Backup for myself' },
  'storage.backupWhat': {
    nl: 'Eén bestand met alles op deze telefoon: eigen en ontvangen recepten, favorieten, notities, kooklog, profielen en weekplan (foto’s alleen met de schakelaar hieronder aan). Zet het terug met Herstel, hier of op een nieuwe telefoon.',
    en: 'One file with everything on this phone: own and received recipes, favourites, notes, cook log, profiles and week plan (photos only with the switch below on). Put it back with Restore, here or on a new phone.',
  },
  'storage.saveOrShare': { nl: 'Bewaar of deel', en: 'Save or share' },
  'storage.lastBackup': { nl: 'Laatste back-up', en: 'Last backup' },
  'storage.never': { nl: 'nog nooit', en: 'never yet' },
  'storage.backupShared': { nl: 'Back-up gedeeld', en: 'Backup shared' },
  'storage.backupFailed': { nl: 'Back-up mislukt', en: 'Backup failed' },
  'storage.restore': { nl: 'Herstel', en: 'Restore' },
  'storage.restoreTitle': { nl: 'Een back-up terugzetten', en: 'Put a backup back' },
  'storage.restoreWhat': {
    nl: 'Kies een back-upbestand (recepten-….json): wat erin staat wordt toegevoegd of bijgewerkt, wat al op deze telefoon staat blijft.',
    en: 'Choose a backup file (recepten-….json): what is in it is added or updated, what is already on this phone stays.',
  },
  'storage.restoring': { nl: 'Bezig met herstellen…', en: 'Restoring…' },
  'storage.restored': {
    nl: 'Hersteld: {recipes} recepten, {favorites} favorieten, {notes} notities, {cookLog} kooklog, {profiles} profielen.',
    en: 'Restored: {recipes} recipes, {favorites} favourites, {notes} notes, {cookLog} cook log, {profiles} profiles.',
  },
  'storage.invalid': { nl: 'Dit is geen back-upbestand van Recepten.', en: 'This is not a Recepten backup file.' },
  'storage.readFailed': { nl: 'Bestand kon niet worden gelezen.', en: 'Could not read the file.' },
  // --- Phase 3: counters per table, backup health, export ---
  'storage.overrides': { nl: 'Aangepaste klassiekers', en: 'Adjusted classics' },
  'storage.lineOverrides': { nl: 'Gekoppelde regels (klassiekers)', en: 'Linked lines (classics)' },
  'storage.ingredients': { nl: 'Eigen ingrediënten', en: 'Own ingredients' },
  'storage.unbacked': { nl: 'Sinds de laatste back-up', en: 'Since the last backup' },
  'storage.changes': { nl: '{n} wijzigingen', en: '{n} changes' },
  'storage.upToDate': { nl: 'Alles zit in de laatste back-up.', en: 'Everything is in the last backup.' },
  'storage.overdue': {
    nl: 'Je laatste back-up is meer dan 30 dagen oud en er zijn {n} wijzigingen die nog nergens anders staan. Maak nu een back-up.',
    en: 'Your last backup is more than 30 days old and {n} changes exist nowhere else yet. Make a backup now.',
  },
  'storage.overdueNever': {
    nl: 'Nog nooit een back-up gemaakt en er zijn al {n} wijzigingen die nergens anders staan. Maak er nu een.',
    en: 'No backup ever made, and {n} changes exist nowhere else yet. Make one now.',
  },
  'storage.restoredMore': {
    nl: 'Ook hersteld: {overrides} aangepaste klassiekers, {lineOverrides} gekoppelde regels, {ingredients} eigen ingrediënten.',
    en: 'Also restored: {overrides} adjusted classics, {lineOverrides} linked lines, {ingredients} own ingredients.',
  },
  'storage.shareBundle': {
    nl: 'Dit is een receptenbestand van iemand anders ("Mijn recepten aan iemand geven"), geen back-up. Zet het in het plakvak (In & uit).',
    en: 'This is someone else’s recipes file ("Give my recipes to someone"), not a backup. Put it in the paste box (In & out).',
  },
  'storage.goInbox': { nl: 'Naar In & uit', en: 'Go to In & out' },
  // "Mijn recepten aan iemand geven" (the former "Exporteer eigen recepten")
  'storage.giveTitle': { nl: 'Mijn recepten aan iemand geven', en: 'Give my recipes to someone' },
  'storage.giveWhat': {
    nl: 'Alleen je eigen en ontvangen recepten, aangepaste klassiekers en eigen ingrediënten; geen favorieten of geschiedenis. De ander zet het bestand in het plakvak van de app (In & uit) en ziet per recept wat nieuw is.',
    en: 'Only your own and received recipes, adjusted classics and own ingredients; no favourites or history. The other person puts the file in the app’s paste box (In & out) and sees per recipe what is new.',
  },
  'storage.giveShared': { nl: 'Recepten gedeeld', en: 'Recipes shared' },
  'storage.exportFailed': { nl: 'Bewaren of delen mislukt', en: 'Saving or sharing failed' },
  'storage.exportEmpty': { nl: 'Nog niets te geven: je hebt nog geen eigen recepten of aanpassingen.', en: 'Nothing to give yet: you have no own recipes or adjustments yet.' },
  // The "Bewaar of deel" sheet: file line + the two rows "Delen" and "Download", honest per phone.
  'storage.fileLine': { nl: 'Bestand: {name} (±{size})', en: 'File: {name} (about {size})' },
  'storage.fileLineNoSize': { nl: 'Bestand: {name}', en: 'File: {name}' },
  'storage.chooseShare': { nl: 'Delen', en: 'Share' },
  'storage.chooseShareHint': { nl: 'Jij kiest waarheen: WhatsApp (aan jezelf), Drive, Bestanden …', en: 'You choose where it goes: WhatsApp (to yourself), Drive, Files …' },
  'storage.download': { nl: 'Download', en: 'Download' },
  'storage.chooseDownloadHint': { nl: 'Het bestand komt in de map Downloads van deze telefoon.', en: 'The file lands in this phone’s Downloads folder.' },
  'storage.chooseDownloadHintIos': {
    nl: 'De iPhone vraagt eerst of je wilt downloaden; daarna staat het bestand in Bestanden → Downloads.',
    en: 'The iPhone first asks whether to download; the file is then in Files → Downloads.',
  },
  'storage.savedDownloads': { nl: 'Opgeslagen als {name} in Downloads', en: 'Saved as {name} in Downloads' },
  'storage.savedDownloadsIos': { nl: 'Heb je Download gekozen? Dan staat {name} in Bestanden → Downloads.', en: 'Did you choose Download? Then {name} is in Files → Downloads.' },
  // --- Phase 5 block D.1: photos in the counters card + the "Met foto's" backup toggle ---
  'storage.photos': { nl: 'Foto’s', en: 'Photos' },
  'storage.withPhotos': { nl: 'Met foto’s', en: 'With photos' },
  'storage.withPhotosHint': { nl: '{n} foto’s; maakt het bestand flink groter.', en: '{n} photos; makes the file much larger.' },
  'storage.withPhotosHintOne': { nl: '1 foto; maakt het bestand flink groter.', en: '1 photo; makes the file much larger.' },
  'storage.withPhotosNone': { nl: 'Nog geen foto’s op dit toestel.', en: 'No photos on this phone yet.' },
  'storage.withPhotosBuilding': { nl: 'Foto’s inpakken…', en: 'Packing photos…' },
  'storage.withPhotosSize': { nl: '{n} foto’s erbij — bestand wordt ±{size}.', en: '{n} photos included — file will be about {size}.' },
  'storage.withPhotosSizeOne': { nl: '1 foto erbij — bestand wordt ±{size}.', en: '1 photo included — file will be about {size}.' },
  'storage.restoredPhotos': { nl: '{n} foto’s teruggezet', en: '{n} photos restored' },
  'storage.restoredPhotosOne': { nl: '1 foto teruggezet', en: '1 photo restored' },
  // --- Phase 5 (docs/phase-5-spec.md 30-09 "Reset app") ---
  'storage.reset': { nl: 'App resetten', en: 'Reset app' },
  'storage.resetHint': {
    nl: 'Wist alles op deze telefoon: eigen en ontvangen recepten, favorieten, notities, kooklog, profielen, week en boodschappenlijst. De klassiekers komen terug; de app begint opnieuw bij "Wie ben jij?".',
    en: 'Wipes everything on this phone: own and received recipes, favourites, notes, cook log, profiles, week and shopping list. The classics come back; the app starts over at "Who are you?".',
  },
  'storage.resetConfirm': { nl: 'Weet je het zeker? Je verliest je geschiedenis en eigen recepten.', en: 'Are you sure? You will lose your history and your own recipes.' },
  'storage.resetYes': { nl: 'Ja', en: 'Yes' },
  'storage.resetNo': { nl: 'Nee', en: 'No' },
  'storage.resetExportFirst': { nl: 'Ja, maar deel eerst mijn recepten', en: 'Yes, but share my recipes first' },
  'storage.resetHistoryHint': {
    nl: 'Dat delen is hetzelfde als "Mijn recepten aan iemand geven": alleen eigen recepten en aanpassingen. Geschiedenis (kooklog, favorieten, notities) zit alleen in een back-up.',
    en: 'That share is the same as "Give my recipes to someone": only own recipes and adjustments. History (cook log, favourites, notes) is only in a backup.',
  },
  'storage.resetting': { nl: 'Bezig met resetten…', en: 'Resetting…' },
  'storage.resetExporting': { nl: 'Eerst je recepten delen…', en: 'Sharing your recipes first…' },
  'storage.resetExportAborted': { nl: 'Delen afgebroken — er is niets gewist.', en: 'Sharing cancelled — nothing was wiped.' },
  'storage.resetExportFailed': { nl: 'Delen mislukt — er is niets gewist.', en: 'Sharing failed — nothing was wiped.' },
  'storage.resetFailed': { nl: 'Resetten mislukt', en: 'Reset failed' },

  // --- Het verhaal ------------------------------------------------------------------------------
  'story.title': { nl: 'Het verhaal', en: 'The story' },
  'story.p1': { nl: 'En dan is hij er dan toch gekomen!', en: 'And so, here it is after all!' },
  'story.p2': {
    nl: "De afgelopen dertig jaar heeft de familie Rutgers voor hun avondmaaltijd gebruikgemaakt van een kleine Microsoft Access-database met 199 gerechten. Wekelijks werden hieruit zeven gerechten geselecteerd, waarna alle nodige boodschappen uit de printer rolden. De Rutgers' Recepten-app is de digitale bundeling van al deze gerechten. Met deze app hopen wij onze culinaire stempel te waarborgen, Julia en Katinka tevreden te stellen met het voltooien van wederom een klein projectje, én u, de gebruiker, inspiratie te bieden in de familiekeuken.",
    en: "For the past thirty years the Rutgers family has planned their evening meals from a small Microsoft Access database of 199 dishes. Every week seven dishes were picked from it, after which all the necessary groceries rolled out of the printer. The Rutgers' Recipes app is the digital collection of all those dishes. With this app we hope to safeguard our culinary stamp, to satisfy Julia and Katinka with the completion of yet another little project, and to offer you, the user, inspiration in the family kitchen.",
  },
  'story.p3': {
    nl: 'De 196 recepten in deze app (van de 199 in de database zijn er drie onderweg gesneuveld) bevatten zowel de ingrediëntenlijst voor vier personen als een instructie in begrijpelijke taal. Verder is er een poging gedaan om de gerechten in de volgende categorieën te verdelen: Soep, Salade, Hartige taart, Pasta, Rijst, Vlees, Stamppot, Oven en Overig. Om bij de tijd te blijven worden vegetarische gerechten en vegetarische opties vermeld. Er is ook een fysiek boek beschikbaar van deze recepten.',
    en: 'The 196 recipes in this app (three of the 199 in the database were lost along the way) contain both the ingredient list for four people and instructions in plain language. An attempt has also been made to divide the dishes into the following categories: Soup, Salad, Savoury pie, Pasta, Rice, Meat, Stamppot, Oven and Other. To keep up with the times, vegetarian dishes and vegetarian options are indicated. A physical book of these recipes is available too.',
  },
  'story.p4': { nl: 'Veel kookplezier!', en: 'Happy cooking!' },
  'story.sign': { nl: 'Stijn Rutgers', en: 'Stijn Rutgers' },
  'story.edition': {
    nl: 'Eerste editie december 2025 · Tweede editie (app) 2026',
    en: 'First edition December 2025 · Second edition (app) 2026',
  },
  'story.cooked': { nl: 'Samen al {n} van de {total} gekookt', en: 'Together we have cooked {n} of the {total}' },
  'story.cookedHint': { nl: 'Tik in de kookstand op "Gekookt!" en de teller loopt op.', en: 'Tap "Cooked!" in cooking mode and the counter goes up.' },
  // --- Phase 5 block D (docs/phase-5-spec.md D.3): the household on the story page ---
  'story.members': { nl: 'Wie koken er mee', en: 'Who cooks along' },
};
