// Strings of XP, levels, the "+12" pop, the level-up sheet and the honest 0-XP notes
// (docs/specs/xp-levels.md §1a–§1e, block 6D-1; literal from the spec, NL and British English).
// Merged in ./index.ts after badges. Level TITLES and NOTES come from data/levels.json
// (src/domain/levels.ts), never from here. Block 6D-3 (unlocks, = 6D-4a) adds `unlocks.*`; 6D-4
// adds `progress.*` and `calendar.*`. Numbers with thousands go through Intl.NumberFormat at the
// call site.
import type { Dict } from './index';

export const xp: Dict = {
  // §1a XP bar on the profile card (Meer → Profielen); §1b the level line on Home reuses levelTitle.
  'xp.levelTitle': { nl: 'Level {level} · {title}', en: 'Level {level} · {title}' },
  'xp.ofNext': { nl: '{xp} / {next} XP', en: '{xp} / {next} XP' },
  'xp.maxLevel': { nl: 'MAX LEVEL · {xp} XP', en: 'MAX LEVEL · {xp} XP' },
  'xp.streak': { nl: '🔥 {n} dagen op rij', en: '🔥 {n} days in a row' },
  'xp.streakOne': { nl: '🔥 vandaag gekookt', en: '🔥 cooked today' },
  'xp.streakFree': { nl: '🔥 {n} dagen op rij · vrije dag gebruikt', en: '🔥 {n} days in a row · free day used' },
  'xp.toNext': { nl: 'nog {n} XP tot level {level}', en: '{n} XP to level {level}' },
  // §1c the pop: a sum line under a series, and the two crits.
  'xp.sum': { nl: 'samen +{n} XP', en: '+{n} XP in total' },
  'xp.cooked': { nl: '+{n} · Cooked!', en: '+{n} · Cooked!' },
  'xp.overcooked': { nl: '+{n} · OVERCOOKED!', en: '+{n} · OVERCOOKED!' },
  // §1d the level-up sheet ("Ontgrendeld" + "Bekijk Vrijgespeeld" only show from 6D-3 on).
  'levelup.title': { nl: '🎉 Level {level}!', en: '🎉 Level {level}!' },
  'levelup.unlocked': { nl: 'Ontgrendeld', en: 'Unlocked' },
  'levelup.seeUnlocks': { nl: 'Bekijk Vrijgespeeld', en: 'See Unlocked' },
  // §1e honest about 0 XP: the CookedSheet line, the two toasts and the rules-version toast.
  'xp.backdated': {
    nl: 'Langer dan een week geleden: telt voor je badges en de kalender, niet voor XP.',
    en: 'More than a week ago: counts for your badges and the calendar, not for XP.',
  },
  'xp.busyWeek': { nl: 'Drukke keukenweek! Morgen weer XP.', en: 'Busy kitchen week! XP again tomorrow.' },
  'xp.dayCap': { nl: 'Genoeg gekookt voor vandaag — morgen weer XP.', en: "That's plenty for today — XP again tomorrow." },
  'xp.rulesChanged': {
    nl: 'De XP-regels zijn vernieuwd; je level is opnieuw berekend.',
    en: 'The XP rules were updated; your level has been recalculated.',
  },
  // §1f the Vrijgespeeld screen (#/more/unlocks, block 6D-3 = 6D-4a): one card per kind, a row per
  // unlock; names and descriptions of the unlocks themselves come from data/unlocks.json.
  'unlocks.title': { nl: 'Vrijgespeeld', en: 'Unlocked' },
  'unlocks.kind.confetti': { nl: 'Confetti', en: 'Confetti' },
  'unlocks.kind.timerSound': { nl: 'Timergeluiden', en: 'Timer sounds' },
  'unlocks.kind.cookedSound': { nl: 'Geluid bij Gekookt!', en: 'Sound on Cooked!' },
  'unlocks.kind.cookFont': { nl: 'Lettertype kookstand', en: 'Cook-mode typeface' },
  'unlocks.kind.feature': { nl: "Extra's", en: 'Extras' },
  'unlocks.try': { nl: 'Probeer', en: 'Try' },
  'unlocks.atLevel': { nl: 'Level {level}', en: 'Level {level}' },
  'unlocks.atBadge': { nl: 'Badge: {name}', en: 'Badge: {name}' },
  'unlocks.soon': { nl: 'Binnenkort', en: 'Coming soon' },
  'unlocks.phoneWide': {
    nl: 'Wat iemand op deze telefoon vrijspeelt, kan iedereen hier gebruiken. Aan/uit geldt voor deze telefoon.',
    en: 'Whatever anyone unlocks on this phone, everyone here can use. On/off applies to this phone.',
  },
  // §1h "Sync mijn voortgang" (block 6D-4 = 6D-4b): the button on the active profile card and under
  // Huishouden → Mijn kaartje, and <ProgressSharePanel/> (the iPhone line reuses household.cardIosHint).
  'progress.share': { nl: 'Sync mijn voortgang', en: 'Sync my progress' },
  'progress.intro': {
    nl: "Stuur je level, badges en kookdagen van de laatste 90 dagen naar je huishouden of een vriend. Geen notities, geen sterren, geen foto's.",
    en: 'Send your level, badges and the cooking days of the last 90 days to your household or a friend. No notes, no stars, no photos.',
  },
  'progress.send': { nl: 'Deel', en: 'Share' },
  'progress.copy': { nl: 'Kopieer link', en: 'Copy link' },
  'progress.shared': { nl: 'Voortgang gedeeld.', en: 'Progress shared.' },
  'progress.copied': { nl: 'Gekopieerd — plak het in WhatsApp.', en: 'Copied — paste it into WhatsApp.' },
  'progress.honest': {
    nl: 'Dit is een momentopname: de ander ziet wat je nú deelt, niet wat je daarna kookt. Deel het af en toe opnieuw.',
    en: 'This is a snapshot: the other person sees what you share now, not what you cook afterwards. Share it again now and then.',
  },
  // §1i receiving a `#x=` (In & uit card, the Household paste box, the member rows and Vrienden).
  'progress.from': { nl: 'Voortgang van {name}', en: "{name}'s progress" },
  'progress.streakBadges': { nl: '🔥 {streak} · {badges} badges', en: '🔥 {streak} · {badges} badges' },
  'progress.cookDays30': { nl: '{n} kookdagen in de laatste 30 dagen', en: '{n} cooking days in the last 30 days' },
  'progress.sentAt': { nl: 'gedeeld op {date}', en: 'shared on {date}' },
  'progress.update': { nl: 'Werk {name} bij', en: 'Update {name}' },
  'progress.updated': { nl: '{name} is bijgewerkt.', en: '{name} was updated.' },
  'progress.local': {
    nl: '{name} is een profiel op deze telefoon — die voortgang zie je al.',
    en: '{name} is a profile on this phone — you already see that progress.',
  },
  'progress.saveFriend': { nl: 'Bewaar als vriend', en: 'Save as a friend' },
  'progress.updatedAgo': { nl: '· bijgewerkt {date}', en: '· updated {date}' },
  'progress.friends': { nl: 'Vrienden', en: 'Friends' },
  // §1j the cooking calendar (#/more/calendar): always there, also with badges off (it is a log).
  // The Meer row lives here too (more.calendar*), next to the calendar's own strings.
  'more.calendar': { nl: 'Kookkalender', en: 'Cooking calendar' },
  'more.calendarHint': { nl: 'Wie kookte wat, per dag', en: 'Who cooked what, by day' },
  'calendar.prev': { nl: 'Vorige maand', en: 'Previous month' },
  'calendar.next': { nl: 'Volgende maand', en: 'Next month' },
  'calendar.weekdays': { nl: 'ma di wo do vr za zo', en: 'Mo Tu We Th Fr Sa Su' },
  'calendar.someRecipe': { nl: 'een recept', en: 'a recipe' },
  'calendar.nothing': { nl: 'Niets gekookt.', en: 'Nothing cooked.' },
  'calendar.emptyMonth': { nl: 'Nog niets gekookt deze maand.', en: 'Nothing cooked this month yet.' },
  'calendar.honest': {
    nl: 'Anderen zie je zoals ze het laatst deelden via Sync mijn voortgang.',
    en: 'You see others as they last shared with Sync my progress.',
  },
};
