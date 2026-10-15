// A recipe copied straight from a website (docs/phase-6-spec.md 6A.17, 13A). Framework-free.
//
// Gabi pastes the text of a recipe page into the app without the AI prompt. Such a copy is the
// page top to bottom: title, intro, "Serves 4", times, a heading plus the ingredient lines (with
// bullets, boxes or nothing), a heading plus the steps (numbered or not), and noise around it all
// ("Jump to recipe", "Save", "Print", nutrition, comments). `parseWebsiteRecipe` finds the name,
// servings, times, ingredient lines and steps in that, in Dutch or English.
//
// Principle (Gabi): rather too much than too little. Removing a line is easy, adding one is not.
// So inside the ingredient and method sections every line that is not known noise or a heading is
// kept; a sub-heading ("For the sauce", "Kruiden:") becomes a header line ending in ":" (the line
// parser reads that as a group header); a doubtful line goes to `leftovers`, never into the bin.
// Only known noise (buttons, nutrition, comments, ads) is dropped. Without any heading the text is
// read by shape: a block of short lines with quantities is the ingredient list, long sentences after
// it are the steps. The fixtures in tests/fixtures/paste/ are real copies of the sites Stijn and
// Gabi use (method steps truncated for copyright).
import { cleanPastedText } from './photo-import.ts';

export interface WebsiteRecipe {
  name: string | null;
  servings: number | null;
  /** Minutes: `active` = prep / hands-on, `total` = ready in (or prep + cook). Null when the page gave none. */
  time: { active?: number; total?: number } | null;
  /** Ingredient lines as copied (bullets stripped); a sub-heading becomes "Name:" (a header line). */
  ingredients: string[];
  steps: string[];
  lang: 'nl' | 'en' | null;
  /** high = both headings found; medium = one heading, or a convincing headless shape; low = a guess. */
  confidence: 'high' | 'medium' | 'low';
  /** Lines that may belong to the recipe but did not fit: intro sentences, tips, equipment, a lone word in the method. */
  leftovers: string[];
}

// --- line shapes ----------------------------------------------------------------------------------

const BULLET_RE = /^\s*(?:[-*•–·▢☐□■▪○●✓✔►▸]\s*|\d{1,3}\s*[.)]\s+)/u;
/** Numbering in front of a step: "1.", "1)", "Step 1", "Stap 1:", "STEP 1". */
const STEP_NUMBER_RE = /^\s*(?:(?:stap|step)\s*\d{1,3}\s*[.:)]?\s+|\d{1,3}\s*[.):]\s+)/iu;
const DECORATION_RE = /^[\s#*_>]+|[\s*_:]+$/gu;
const QUANTITY_START_RE = /^(?:\d|[½¼¾⅓⅔⅛]|(?:een|één|a|an)\s)/iu;

/** Whole lines that are page furniture, after bullet stripping and trimming (case-insensitive). */
const NOISE_LINE_RE = [
  /^(?:save|saved|save recipe|save it|print|print recipe|print me|print this recipe(?: \(.*\))?|print recept|printen|afdrukken|recept afdrukken|recept opslaan|opslaan|delen|deel|deel dit recept|share|share recipe|share this recipe|share or save this|share your thoughts|pin|pin it|pin recipe|rate|rate this recipe|rate recipe|rate it|beoordeel(?: het)? recept|beoordeel recept '.*'|jump to recipe|jump to nutrition facts|direct naar(?: het)? recept|scroll naar recept|kookmodus|kookstand|kookstand aanzetten|scherm aanhouden|cook mode|login|log in|inloggen|login to review|account aanmaken|sign up|aanmelden|nieuwsbrief|newsletter|advertisement|advertentie|advertenties|read more|lees meer|tags|tag|kies producten|ingrediënten kopiëren|ingredienten kopiëren|minder porties meer porties|minder porties|meer porties|metric u\.s\.?|metric|u\.s\.?|us customary – metric|us customary|deselect all|select all ingredients|add to shopping list|vorige|volgende|next|previous|introduction|about the recipe|over dit recept|comments?|reviews?|beoordelingen|reacties|leave a comment|leave a comment & rating|laat een reactie achter|geef een reactie|geef een reactie reactie annuleren|reactie annuleren|annuleer reactie|plaats beoordeling|geef je beoordeling|wat vind je van dit recept\??|did you make this recipe\??|i made it|made this\??|tell us what you think|explore more recipes|recipes you may like|ook lekker|probeer ook|gerelateerde recepten|related recipes|onze kookboeken|week ?menu(?: \(deze week\))?|kies een dag|something went wrong\.? please try again|bewaar het recept op pinterest|bewaren via pinterest|of deel via|deel via|whatsapp facebook pinterest|pinterest|facebook|whatsapp|twitter|instagram|watch now on discovery\+|overall rating|asked and answered|try this tip|life of dozer|cook'?s note|cooks note|opslaan print delen|printen opslaan)$/iu,
  /^(?:prevent your screen from going dark|cook mode prevent your screen from going dark|cook mode\b.*)$/iu,
  /^(?:ingredi[eë]nten|ingredients?)\s+(?:kopi[eë]ren|copy)$/iu,
  /^\d+(?:[.,]\d+)?\s*(?:out of 5\s*)?stars?\b.*$/iu,
  /^\(\d+\)$/u,
  /^\d+(?:[.,]\d+)?$/u,
  /^\d+(?:[.,]\d+)?\s*(?:from|van)\s+\d+\s*(?:votes?|stemmen|reviews?|beoordelingen)\b.*$/iu,
  /^\d+\s*(?:reacties?|comments?|reviews?)\b.*$/iu,
  /^what \d+ others have said$/iu,
  /^\d+(?:[.,]\d+)?\s*kcal\b.*$/iu,
  /^(?:calories|energie|energy|kcal|fat|vet|saturates|saturated fat|verzadigd vet|sugars?|suikers?|salt|zout|protein|eiwit|eiwitten|carbs|carbohydrates?|koolhydraten|fibre|fiber|vezels?)\s*:?\s*[\d<>-]+.*$/iu,
  /^(?:nutrition|nutritional)\b.*$/iu,
  /^voedingswaarden?\b.*$/iu,
  /^(?:course|cuisine|category|keywords?|author|dietary|diet|difficulty|level|moeilijkheid|moeilijkheidsgraad|freezer friendly|does it keep\??)\s*:?\s.*$/iu,
  /^de moeilijkheidsgraad van .*$/iu,
  /^(?:recipe )?(?:by|door)\s+\S.*$/iu,
  /^(?:photo|foto)\s+(?:by|door|van)\b.*$/iu,
  /^(?:get my best|sign up for|subscribe|meld je aan|schrijf je in|tap here|tik hier)\b.*$/iu,
  /^.*\b(?:preorder|pre-order|in your inbox)\b.*$/iu,
  /^.*\b(?:cookies?)\b.*\b(?:accept|accepteer|akkoord|policy|beleid|settings|instellingen|voorkeuren|preferences)\b.*$/iu,
  /^tag @\S+.*$/iu,
  /^(?:login|inloggen) (?:to|om te) .*$/iu,
];

/** Lines of at most five words that contain one of these are page furniture too. */
const NOISE_WORD_RE = /\b(?:print|printen|afdrukken|opslaan|saved?|share|delen|pinterest|facebook|whatsapp|twitter|instagram|rate|rating|beoordeel|beoordelingen?|reviews?|reacties?|comments?|votes?|jump to|login|inloggen|sign up|aanmelden|nieuwsbrief|newsletter|subscribe|inbox|advertisement|advertentie|kopi[eë]ren|kookstand|kookmodus|cook mode|read more|lees meer|kcal|calories|calorieën|preorder|pre-order|bookmarks?|favou?rites?|customary|deselect|annuleer|annuleren|cancel|moeilijkheidsgraad|difficulty)\b/iu;

/** Short labels that say nothing about the recipe (difficulty, course, diet tags) — dropped outside sections. */
const LABEL_LINE_RE = /^(?:makkelijk|gemiddeld|moeilijk|easy|super easy|simple|medium|hard|hoofdgerecht|voorgerecht|bijgerecht|nagerecht|lunch|ontbijt|brunch|borrel|snack|dessert|main|main course|starter|side|side dish|vegetarian|vegetarisch|vegan|veganistisch|gluten-?free|glutenvrij|dairy-?free|lactosevrij|koolhydraatarm|low-?carb|nederlands|hollands|italiaans|frans|basisrecepten?|budget|kids|family)$/iu;

const ING_HEAD_RE = /^(?:ingredi[eë]nten|ingredients?|dit heb je nodig|wat heb je nodig|wat je nodig hebt|je hebt nodig|boodschappen(?:lijst)?|shopping list|you will need|what you need|what you'll need)\b\s*(.*)$/iu;
const BENODIGDHEDEN_RE = /^benodigdheden\b\s*(.*)$/iu;
const METHOD_HEAD_RE = /^(?:method|instructions?|directions?|preparation|how to make(?: it)?|how to|steps|bereiding|bereidingswijze|werkwijze|zo maak je(?: het)?(?: \S+)?|zo bereid je(?: het)?(?: \S+)?|aan de slag|stappen(?:plan)?|voorbereiding en bereiding|recept)\b\s*(.*)$/iu;
/** Headings whose lines may still be recipe text (a substitution tip, how to store it): they go to `leftovers`. */
const NOTES_HEAD_RE = /^(?:notes?|recipe notes?|opmerkingen?|notities?|(?:[\p{L}']+ )?tips?|tip van .*|chef'?s note|additional information|make ahead(?: \/ store)?|storage|variaties?|variations?|serving suggestions?|serveertip|bewaren|leftovers|makes? ahead|tips from our bakers)\b\s*(.*)$/iu;
/** Headings whose lines are never recipe text (nutrition, equipment, related recipes, FAQ, video): dropped. */
const OTHER_HEAD_RE = /^(?:nutrition(?:al)?(?: information| facts)?|voedingswaarden?|equipment|special equipment|materialen|benodigde materialen|keukengerei|kitchen tools|faq|veelgestelde vragen|related(?: recipes| posts| features)?|more recipes|video)\b\s*(.*)$/iu;
/** The tail a heading may carry: nothing, ": title", "voor/for …", "(…)", "– …". */
const HEAD_TAIL_RE = /^(?:$|[:(–-]|(?:voor|for|van|of|from|per)\b)/iu;

/** Sub-headings inside the ingredient list that are not products. */
const GROUP_WORD_RE = /^(?:to serve|for serving|om te serveren|voor erbij|erbij|garnish|garnering|topping|sauce|saus|dressing|marinade|filling|vulling|dough|deeg|base|bodem|crust|glaze|glazuur|salad|salade|kruiden|spices|spice mix|kruidenmix|optional|optioneel|extra|extras|rest|overig|overige|basics?|batter|beslag|frosting|icing|crumble|the rest|de rest)$/iu;

const DURATION_RE = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|uur|u|minutes?|mins?|min\.|minuten)\b\.?/giu;
const PLUS_FORM_RE = /^(?:\S+\s+)?(\d+)\s*(?:m|min\.?|mins?|minuten|minutes?)\s*\+\s*(\d+)\s*(?:m|min\.?|mins?|minuten|minutes?)\b(.*)$/iu;
const TIME_TOTAL_RE = /\b(?:total|totaal|totale|klaar in|ready in|cooks? in|bereidingstijd|bereiden)\b/iu;
const TIME_ACTIVE_RE = /\b(?:prep|preparation|voorbereid(?:ing|en|ingstijd)?|hands-?on|active|werktijd|actief)\b/iu;
const TIME_COOK_RE = /\b(?:cook|cooking|bake|baking|oven|koken|kooktijd|baktijd|oventijd|wachttijd|rusttijd|rest|resting|additional|extra|chill|inactive)\b/iu;

const SERVINGS_RES = [
  // "Yield: 1 loaf" is not a number of people: yield/makes only count with a portion word (last pattern).
  /^(?:serves|servings?|porties|personen|voor|portions?|aantal personen|aantal porties)\s*:?\s*(?:about|ongeveer|ca\.?|approx\.?)?\s*(\d{1,3})\b/iu,
  /^(?:ingredi[eë]nten|ingredients)\s+(?:voor|for)\s+(\d{1,3})\s*(?:[-–]\s*\d{1,3}\s*)?(?:personen|persons?|people|servings?|porties|portions?|pers\.?)\b/iu,
  /^(?:about |ongeveer |ca\.? |voor |for )?(\d{1,3})\s*(?:[-–]\s*\d{1,3}\s*)?(?:personen|persons?|people|servings?|porties|portions?|pers\.?|slices|sneden|plakken)\b/iu,
  /\b(?:yields?|makes)\s*:?\s*(?:about\s+)?(\d{1,3})\s*(?:slices|servings|portions|pieces|people|personen|porties)\b/iu,
];

function words(s: string): number {
  return s.split(/\s+/u).filter((w) => /\p{L}|\d/u.test(w)).length;
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim();
}

function foldTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isNoise(line: string): boolean {
  const t = line.trim().replace(/[\s:!.]+$/u, '');
  if (!t) return true;
  if (!/\p{L}|\d/u.test(t)) return true;
  if (NOISE_LINE_RE.some((re) => re.test(t))) return true;
  return words(t) <= 5 && NOISE_WORD_RE.test(t);
}

/** The heading core: "## Ingrediënten:" -> "Ingrediënten". */
function headingCore(line: string): string {
  return line.replace(DECORATION_RE, '').trim();
}

function servingsOf(line: string): number | null {
  const t = line.trim();
  if (words(t) > 8) return null;
  for (const re of SERVINGS_RES) {
    const m = re.exec(t);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 100) return n;
    }
  }
  return null;
}

interface TimeLine {
  kind: 'total' | 'active' | 'cook' | 'plus';
  minutes: number;
  /** The first part of a "10 min + 15 min" line. */
  first?: number;
}

function minutesOf(value: string, unit: string): number {
  const n = parseFloat(value.replace(',', '.'));
  return /^(?:h|hr|hrs|hour|hours|uur|u)$/iu.test(unit) ? Math.round(n * 60) : Math.round(n);
}

/** A line that is (almost) only a duration: "30 mins", "Prep: 10 minutes mins", "10 M + 15 M koken". */
function timeOf(line: string): TimeLine | null {
  const t = line.trim();
  if (words(t) > 9) return null;
  const plus = PLUS_FORM_RE.exec(t);
  if (plus) {
    const a = Number(plus[1]);
    const b = Number(plus[2]);
    return { kind: 'plus', minutes: a + b, first: a };
  }
  let total = 0;
  let count = 0;
  const rest = t.replace(DURATION_RE, (_m, v: string, u: string) => {
    total += minutesOf(v, u);
    count++;
    return ' ';
  });
  if (!count || total <= 0) return null;
  const leftover = rest
    .replace(/[:()\-–+.,]/g, ' ')
    .replace(/\b(?:time|tijd|plus|and|en|mins?|min\.?|minutes?|minuten|hours?|hrs?|uur)\b/giu, ' ')
    .trim();
  if (words(leftover) > 3) return null;
  if (/\d/.test(leftover)) return null;
  if (TIME_TOTAL_RE.test(t)) return { kind: 'total', minutes: total };
  if (TIME_ACTIVE_RE.test(t)) return { kind: 'active', minutes: total };
  if (TIME_COOK_RE.test(t)) return { kind: 'cook', minutes: total };
  return { kind: 'total', minutes: total };
}

type Section = 'none' | 'ingredients' | 'steps' | 'notes' | 'other' | 'done';

interface Heading {
  kind: 'ingredients' | 'method' | 'notes' | 'other';
  /** For an ingredient heading: a group name ("de kaasstengels (optioneel)") or servings it carries. */
  group?: string;
  servings?: number;
  /** For a notes heading: the text on the heading line itself ("Sandra's tip: voor een vegetarische variant …"). */
  tail?: string;
}

function headingOf(line: string, haveIngredients: boolean): Heading | null {
  const core = headingCore(line);
  if (!core || words(core) > 8) return null;
  const check = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(core);
    if (!m) return null;
    const tail = (m[1] ?? '').trim();
    return HEAD_TAIL_RE.test(tail) ? m : null;
  };
  const ing = check(ING_HEAD_RE) ?? (!haveIngredients ? check(BENODIGDHEDEN_RE) : null);
  if (ing) {
    const tail = (ing[1] ?? '').trim();
    const out: Heading = { kind: 'ingredients' };
    const srv = servingsOf(core);
    if (srv) out.servings = srv;
    else {
      const g = /^(?:voor|for)\s+(?:de |het |the )?(.+)$/iu.exec(tail);
      if (g && !/\d/.test(g[1] as string)) out.group = (g[1] as string).trim();
    }
    return out;
  }
  if (check(METHOD_HEAD_RE)) return { kind: 'method' };
  if (haveIngredients && check(BENODIGDHEDEN_RE)) return { kind: 'other' };
  const notes = check(NOTES_HEAD_RE);
  if (notes) {
    const tail = (notes[1] ?? '').replace(/^[:\s]+/u, '').trim();
    return tail ? { kind: 'notes', tail } : { kind: 'notes' };
  }
  if (check(OTHER_HEAD_RE)) return { kind: 'other' };
  return null;
}

/** A sub-heading inside the ingredient list, as a header line "Name:"; null for a product line. */
function groupHeader(line: string): string | null {
  const raw = line.trim();
  if (/\d/.test(raw)) return null;
  // "RICE + VEGETABLES", "SAUCE": shouting is a heading, not a product; written out as "Rice + vegetables:".
  const shouted = raw.length >= 3 && raw === raw.toUpperCase() && /\p{L}{3,}/u.test(raw) && words(raw) <= 5;
  const t = shouted ? raw.toLowerCase() : raw;
  if (/:$/.test(t) && words(t) <= 6) return capitalise(t.replace(/\s*:+$/, '')) + ':';
  const g = /^(?:voor|for)\s+(?:de |het |the )?(.+)$/iu.exec(t);
  if (g && words(t) <= 6) return capitalise((g[1] as string).trim()) + ':';
  if (words(t) <= 4 && GROUP_WORD_RE.test(t)) return capitalise(t.toLowerCase()) + ':';
  if (shouted) return capitalise(t) + ':';
  return null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isStepLike(line: string, numbered: boolean): boolean {
  if (numbered) return true;
  const n = words(line);
  if (/[?]$/.test(line) && n <= 7) return false;
  if (/:$/.test(line) && n <= 8) return false;
  return n >= 4 || /[.!…]$/u.test(line);
}

/** Something that could be recipe content outside its section: a quantity line or a sentence. */
function isContentLike(line: string): boolean {
  const n = words(line);
  if (QUANTITY_START_RE.test(line) && n <= 10) return true;
  return n >= 6 && /[.!?…]$/u.test(line);
}

function isNameCandidate(line: string): boolean {
  const t = line.trim();
  if (!/\p{L}{2,}/u.test(t)) return false;
  const n = words(t);
  if (n === 0 || n > 12) return false;
  if (n > 4 && /[.!?]$/.test(t)) return false;
  if (/^(?:by|door|van|from)\s/iu.test(t)) return false;
  if (LABEL_LINE_RE.test(t)) return false;
  if (QUANTITY_START_RE.test(t)) return false;
  return true;
}

function cleanName(line: string): string {
  return line
    .replace(DECORATION_RE, '')
    .replace(/\s*\|\s*.*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- language --------------------------------------------------------------------------------------

const NL_WORD_RE = /\b(?:de|het|een|en|met|van|voor|tot|op|bij|ui|uien|el|tl|gram|gr|teen|teentje|teentjes|snufje|scheutje|bosje|zout|peper|olie|kook|snijd|voeg|roer|bak|laat|verwarm|meng|doe|giet|schil|breng|ingrediënten|bereiding|bereidingswijze|personen|porties|minuten|eieren|knoflook)\b/giu;
const EN_WORD_RE = /\b(?:the|a|an|and|with|of|for|to|into|until|onion|onions|tbsp|tsp|cup|cups|oz|lb|cloves?|pinch|salt|pepper|oil|cook|slice|add|stir|fry|heat|preheat|mix|pour|peel|bring|ingredients|method|instructions|directions|serves|servings|minutes|mins|eggs|garlic)\b/giu;

/** The language of a text by its small words and kitchen words; null when it is a toss-up. */
export function detectRecipeLang(text: string): 'nl' | 'en' | null {
  const nl = (text.match(NL_WORD_RE) ?? []).length;
  const en = (text.match(EN_WORD_RE) ?? []).length;
  if (nl === 0 && en === 0) return null;
  if (nl > en * 1.2) return 'nl';
  if (en > nl * 1.2) return 'en';
  return null;
}

// --- the parser -----------------------------------------------------------------------------------

/**
 * A website recipe out of pasted page text. Null when the text holds neither ingredient lines nor
 * steps. Headings decide the sections; without headings the shape of the lines decides (a block of
 * quantity lines, then sentences). Doubtful lines land in `leftovers`.
 */
export function parseWebsiteRecipe(text: string): WebsiteRecipe | null {
  const rows = cleanPastedText(text ?? '')
    .split('\n')
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!rows.length) return null;

  let name: string | null = null;
  let servings: number | null = null;
  let total: number | undefined;
  let active: number | undefined;
  let cook: number | undefined;
  const ingredients: string[] = [];
  const steps: string[] = [];
  const leftovers: string[] = [];
  let section: Section = 'none';
  let sawIngHead = false;
  let sawMethodHead = false;

  const sameAsName = (line: string) => name !== null && foldTitle(line) === foldTitle(name) && foldTitle(line).length > 0;
  const takeTime = (tl: TimeLine) => {
    if (tl.kind === 'plus') {
      if (active === undefined) active = tl.first;
      if (total === undefined) total = tl.minutes;
    } else if (tl.kind === 'total') {
      if (total === undefined) total = tl.minutes;
    } else if (tl.kind === 'active') {
      if (active === undefined) active = tl.minutes;
    } else if (cook === undefined) cook = tl.minutes;
  };

  for (const row of rows) {
    const bare = stripBullet(row);
    const numbered = STEP_NUMBER_RE.test(row);
    if (!bare) continue;

    // Headings first: they move between sections from anywhere.
    const head = headingOf(bare, ingredients.length >= 3);
    if (head) {
      if (head.kind === 'ingredients') {
        if (head.servings && servings === null) servings = head.servings;
        if (head.group && sawIngHead && ingredients.length && !sameAsName(head.group)) ingredients.push(capitalise(head.group) + ':');
        section = 'ingredients';
        sawIngHead = true;
      } else if (head.kind === 'method') {
        section = 'steps';
        sawMethodHead = true;
      } else if (head.kind === 'notes') {
        section = 'notes';
        // "Sandra's tip: voor een vegetarische variant kun je …": the tip is on the heading line itself.
        if (head.tail && words(head.tail) >= 3) leftovers.push(bare);
      } else {
        section = 'other';
      }
      continue;
    }

    if (section === 'other') continue;
    if (sameAsName(bare)) continue;
    // Notes, tips, variations, storage: rather too much than too little — into "Controleer", not the bin.
    if (section === 'notes') {
      if (!isNoise(bare) && !LABEL_LINE_RE.test(bare)) leftovers.push(bare);
      continue;
    }

    if (section !== 'steps') {
      const srv = servingsOf(bare);
      if (srv !== null) {
        if (servings === null) servings = srv;
        continue;
      }
      const tl = timeOf(bare);
      if (tl) {
        takeTime(tl);
        continue;
      }
    }

    if (section === 'ingredients') {
      if (isNoise(bare)) continue;
      const group = groupHeader(bare);
      ingredients.push(group ?? bare);
      continue;
    }

    if (section === 'steps') {
      // "Step 3: Season well." / "Stap 3 Breng op smaak": the label goes, the step stays.
      const step = bare.replace(STEP_NUMBER_RE, '').trim();
      if (!step || isNoise(step)) {
        if (steps.length) section = 'done';
        continue;
      }
      if (isStepLike(step, numbered)) steps.push(step);
      else leftovers.push(step);
      continue;
    }

    // 'none' (before any section) and 'done' (after the method ended).
    if (isNoise(bare)) continue;
    if (section === 'none' && name === null) {
      if (isNameCandidate(row)) {
        name = cleanName(row);
        continue;
      }
    }
    if (LABEL_LINE_RE.test(bare)) continue;
    if (isContentLike(bare)) leftovers.push(bare);
  }

  // Without headings: read the shape of the lines.
  if (!sawIngHead && !sawMethodHead) return headless(rows, { leftovers });

  if (!ingredients.length && !steps.length) return null;
  // Prep + cook add up to a total; a prep time alone says nothing about the total.
  if (total === undefined && cook !== undefined) total = (active ?? 0) + cook;
  const time = total !== undefined || active !== undefined ? { ...(active !== undefined ? { active } : {}), ...(total !== undefined ? { total } : {}) } : null;
  const confidence: WebsiteRecipe['confidence'] =
    sawIngHead && sawMethodHead && ingredients.length >= 2 && steps.length >= 1 ? 'high' : (sawIngHead && ingredients.length >= 2) || (sawMethodHead && steps.length >= 1) ? 'medium' : 'low';
  return {
    name,
    servings,
    time,
    ingredients,
    steps,
    lang: detectRecipeLang(rows.join('\n')),
    confidence,
    leftovers: unique(leftovers),
  };
}

function unique(list: readonly string[]): string[] {
  return [...new Set(list)];
}

/** A line that reads as an ingredient when there is no heading: a quantity in front, or a short product name. */
function ingredientLike(line: string): boolean {
  const n = words(line);
  if (n === 0 || n > 12) return false;
  if (/[.!?…]$/u.test(line) && n > 3) return false;
  if (QUANTITY_START_RE.test(line)) return true;
  return n <= 4 && !/[.!?]/.test(line);
}

/**
 * No headings: the longest run of quantity-shaped lines (opened by a quantity line; short product
 * names such as "zout en peper" may follow) is the ingredient list, the sentences after it are the
 * steps, the short line before it the name. Servings and time lines are read wherever they stand.
 */
function headless(rows: readonly string[], extra: { leftovers: string[] }): WebsiteRecipe | null {
  let servings: number | null = null;
  let total: number | undefined;
  let active: number | undefined;
  const lines: string[] = [];
  for (const row of rows) {
    const l = stripBullet(row);
    if (!l || isNoise(l)) continue;
    const srv = servingsOf(l);
    if (srv !== null) {
      if (servings === null) servings = srv;
      continue;
    }
    const tl = timeOf(l);
    if (tl) {
      if (tl.kind === 'active') active = active ?? tl.minutes;
      else if (tl.kind === 'plus') {
        active = active ?? tl.first;
        total = total ?? tl.minutes;
      } else total = total ?? tl.minutes;
      continue;
    }
    lines.push(l);
  }
  let best: [number, number] = [0, 0];
  let start = -1;
  let strong = 0;
  for (let i = 0; i <= lines.length; i++) {
    const l = lines[i];
    const quantity = l !== undefined && QUANTITY_START_RE.test(l);
    const ok = l !== undefined && ingredientLike(l) && (start >= 0 || quantity);
    if (ok) {
      if (start < 0) {
        start = i;
        strong = 0;
      }
      if (quantity) strong++;
    } else if (start >= 0) {
      if (strong >= 2 && i - start > best[1] - best[0]) best = [start, i];
      start = -1;
    }
  }
  if (best[1] - best[0] < 3) return null;
  const ingredients = lines.slice(best[0], best[1]).map((l) => groupHeader(l) ?? l);
  const steps: string[] = [];
  const leftovers = [...extra.leftovers];
  for (let i = best[1]; i < lines.length; i++) {
    const l = lines[i] as string;
    const step = l.replace(STEP_NUMBER_RE, '').trim();
    if (isStepLike(step, STEP_NUMBER_RE.test(l)) && words(step) >= 4) steps.push(step);
    else leftovers.push(step);
  }
  let name: string | null = null;
  for (let i = 0; i < best[0]; i++) {
    const l = lines[i] as string;
    if (name === null && isNameCandidate(l) && words(l) <= 8) name = cleanName(l);
    else if (isContentLike(l)) leftovers.push(l);
  }
  const time = total !== undefined || active !== undefined ? { ...(active !== undefined ? { active } : {}), ...(total !== undefined ? { total } : {}) } : null;
  return {
    name,
    servings,
    time,
    ingredients,
    steps,
    lang: detectRecipeLang(rows.join('\n')),
    confidence: ingredients.length >= 3 && steps.length >= 1 ? 'medium' : 'low',
    leftovers: unique(leftovers.filter((l) => !ingredients.includes(l) && !steps.includes(l))),
  };
}
