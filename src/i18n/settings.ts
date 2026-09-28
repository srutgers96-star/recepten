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
  'more.storage': { nl: 'Opslag & back-up', en: 'Storage & backup' },
  'more.story': { nl: 'Het verhaal', en: 'The story' },
  'more.check': { nl: 'Apparaatcheck', en: 'Device check' },
  'more.about': { nl: 'Over', en: 'About' },
  'more.version': { nl: 'Versie', en: 'Version' },
  'more.channel': { nl: 'Kanaal', en: 'Channel' },
  'more.build': { nl: 'Build', en: 'Build' },
  'more.github': { nl: 'Broncode op GitHub', en: 'Source code on GitHub' },

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
  'storage.backup': { nl: 'Back-up', en: 'Backup' },
  'storage.lastBackup': { nl: 'Laatste back-up', en: 'Last backup' },
  'storage.never': { nl: 'nog nooit', en: 'never yet' },
  'storage.makeBackup': { nl: 'Back-up maken', en: 'Make a backup' },
  'storage.backupHint': {
    nl: 'Eén bestand met je eigen en ontvangen recepten, favorieten, notities, kooklog en profielen. Deel het naar Bestanden, Drive of WhatsApp.',
    en: 'One file with your own and received recipes, favourites, notes, cook log and profiles. Share it to Files, Drive or WhatsApp.',
  },
  'storage.backupShared': { nl: 'Back-up gedeeld', en: 'Backup shared' },
  'storage.backupDownloaded': { nl: 'Back-up gedownload', en: 'Backup downloaded' },
  'storage.backupFailed': { nl: 'Back-up mislukt', en: 'Backup failed' },
  'storage.restore': { nl: 'Herstel', en: 'Restore' },
  'storage.restoreHint': {
    nl: 'Kies een back-upbestand (recepten-….json). Bestaande gegevens blijven; wat in het bestand staat wordt toegevoegd of bijgewerkt.',
    en: 'Choose a backup file (recepten-….json). Existing data stays; what is in the file is added or updated.',
  },
  'storage.restoring': { nl: 'Bezig met herstellen…', en: 'Restoring…' },
  'storage.restored': {
    nl: 'Hersteld: {recipes} recepten, {favorites} favorieten, {notes} notities, {cookLog} kooklog, {profiles} profielen.',
    en: 'Restored: {recipes} recipes, {favorites} favourites, {notes} notes, {cookLog} cook log, {profiles} profiles.',
  },
  'storage.invalid': { nl: 'Dit is geen back-upbestand van Recepten.', en: 'This is not a Recepten backup file.' },
  'storage.readFailed': { nl: 'Bestand kon niet worden gelezen.', en: 'Could not read the file.' },

  // --- Het verhaal ------------------------------------------------------------------------------
  'story.title': { nl: 'Het verhaal', en: 'The story' },
  'story.p1': { nl: 'En dan is hij er dan toch gekomen!', en: 'And so, here it is after all!' },
  'story.p2': {
    nl: "De afgelopen dertig jaar heeft de familie Rutgers voor hun avondmaaltijd gebruikgemaakt van een kleine Microsoft Access-database met 199 gerechten. Wekelijks werden hieruit zeven gerechten geselecteerd, waarna alle nodige boodschappen uit de printer rolden. De Rutgers' Recepten-app is de digitale bundeling van al deze gerechten. Met deze app hopen wij onze culinaire stempel te waarborgen, Julia en Katinka tevreden te stellen met het voltooien van wederom een klein projectje, én u, de gebruiker, inspiratie te bieden in de familiekeuken.",
    en: "For the past thirty years the Rutgers family has planned their evening meals from a small Microsoft Access database of 199 dishes. Every week seven dishes were picked from it, after which all the necessary groceries rolled out of the printer. The Rutgers' Recipes app is the digital collection of all those dishes. With this app we hope to safeguard our culinary stamp, to satisfy Julia and Katinka with the completion of yet another little project, and to offer you, the user, inspiration in the family kitchen.",
  },
  'story.p3': {
    nl: 'De 199 recepten bevatten zowel de ingrediëntenlijst voor vier personen als een instructie in begrijpelijke taal. Verder is er een poging gedaan om de gerechten in de volgende categorieën te verdelen: Soep, Salade, Hartige taart, Pasta, Rijst, Vlees, Stamppot, Oven en Overig. Om bij de tijd te blijven worden vegetarische gerechten en vegetarische opties vermeld. Er is ook een fysiek boek beschikbaar van deze recepten.',
    en: 'The 199 recipes contain both the ingredient list for four people and instructions in plain language. An attempt has also been made to divide the dishes into the following categories: Soup, Salad, Savoury pie, Pasta, Rice, Meat, Stamppot, Oven and Other. To keep up with the times, vegetarian dishes and vegetarian options are indicated. A physical book of these recipes is available too.',
  },
  'story.p4': { nl: 'Veel kookplezier!', en: 'Happy cooking!' },
  'story.sign': { nl: 'Stijn Rutgers', en: 'Stijn Rutgers' },
  'story.edition': {
    nl: 'Eerste editie december 2025 · Tweede editie (app) 2026',
    en: 'First edition December 2025 · Second edition (app) 2026',
  },
  'story.cooked': { nl: 'Samen al {n} van de {total} gekookt', en: 'Together we have cooked {n} of the {total}' },
  'story.cookedHint': { nl: 'Tik in de kookstand op "Gekookt!" en de teller loopt op.', en: 'Tap "Cooked!" in cooking mode and the counter goes up.' },
};
