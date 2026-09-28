// The WhatsApp share message (PLAN.md §7 "Het bericht (exact)"):
//
//   🍲 Afwasmachinezalm · Dishwasher salmon
//   4 pers · 10 ingrediënten · van Stijn
//   Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):
//   https://srutgers96-star.github.io/recepten/#r=eJx9kU1v2zAMhu_5FYQv...
//
// Both names on line 1 (a readable bubble for either phone), the URL alone on the last line so
// WhatsApp renders one tappable link. Framework-free.

export interface ShareMessageInput {
  nameNl: string;
  nameEn?: string;
  servings?: number;
  ingredientCount: number;
  by: string;
  url: string;
  /** Language of the sender's UI: decides the wording of lines 2 and 3. */
  lang: 'nl' | 'en';
}

export const APP_NAME = { nl: "Rutgers' Recepten", en: "Rutgers' Recipes" } as const;

const OPEN_LINE = {
  nl: `Open in ${APP_NAME.nl} (of tik voor een voorproefje / or tap to preview):`,
  en: `Open in ${APP_NAME.en} (or tap to preview / of tik voor een voorproefje):`,
} as const;

export function buildShareMessage(i: ShareMessageInput): string {
  const lang = i.lang === 'en' ? 'en' : 'nl';
  const n = Math.max(0, Math.floor(i.ingredientCount));
  const by = i.by.trim();

  const line1 = '🍲 ' + titleNames(i.nameNl, i.nameEn).join(' · ');

  const facts: string[] = [];
  if (typeof i.servings === 'number' && i.servings > 0) {
    facts.push(
      lang === 'nl' ? `${i.servings} pers` : `${i.servings} ${i.servings === 1 ? 'serving' : 'servings'}`,
    );
  }
  facts.push(
    lang === 'nl' ? `${n} ${n === 1 ? 'ingrediënt' : 'ingrediënten'}` : `${n} ${n === 1 ? 'ingredient' : 'ingredients'}`,
  );
  if (by) facts.push(lang === 'nl' ? `van ${by}` : `from ${by}`);
  const line2 = facts.join(' · ');

  return [line1, line2, OPEN_LINE[lang], i.url.trim()].join('\n');
}

/** "<nameNl> · <nameEn>"; the English name is omitted when missing or identical to the Dutch one. */
function titleNames(nameNl: string, nameEn?: string): string[] {
  const nl = nameNl.trim();
  const en = (nameEn ?? '').trim();
  if (!nl) return [en || '?'];
  if (!en || en.toLowerCase() === nl.toLowerCase()) return [nl];
  return [nl, en];
}
