// Strings of XP, levels, the "+12" pop, the level-up sheet and the honest 0-XP notes
// (docs/specs/xp-levels.md §1a–§1e, block 6D-1; literal from the spec, NL and British English).
// Merged in ./index.ts after badges. Level TITLES and NOTES come from data/levels.json
// (src/domain/levels.ts), never from here. Later blocks add `unlocks.*`, `progress.*` and
// `calendar.*` to this file. Numbers with thousands go through Intl.NumberFormat at the call site.
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
};
