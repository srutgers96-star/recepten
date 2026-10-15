// src/domain/paste-recipe.ts (docs/phase-6-spec.md 6A.17): a recipe copied straight from a website.
// The fixtures in tests/fixtures/paste/ are real copies of the sites Stijn and Gabi use (nl-*) and
// of English sites (en-*): title, intro, times, servings, the ingredient list with the site's own
// bullets, the method (steps truncated to ~8 words for copyright) and the noise around it all.
// Gabi's principle: rather too much than too little — a doubtful line is a leftover, never dropped.
import { describe, expect, it } from 'vitest';
import { detectRecipeLang, parseWebsiteRecipe, type WebsiteRecipe } from '../src/domain/paste-recipe';
import { PASTE_FIXTURES, readPasteFixture } from './fixtures/paste/read';

interface Expected {
  name: string;
  servings: number | null;
  lang: 'nl' | 'en';
  /** Exact counts, checked by hand against the fixture (group headers like "Kruiden:" count as lines). */
  ingredients: number;
  steps: number;
  time: WebsiteRecipe['time'];
}

// Hand-checked against each fixture (see the fixture files for the lines).
const EXPECTED: Record<string, Expected> = {
  'en-foodnetwork-perfect-roast-chicken.txt': { name: 'Perfect Roast Chicken', servings: null, lang: 'en', ingredients: 11, steps: 4, time: null },
  'en-jamieoliver-classic-tomato-spaghetti.txt': { name: 'Classic tomato spaghetti', servings: 8, lang: 'en', ingredients: 8, steps: 11, time: { total: 30 } },
  'en-jamieoliver-easy-roast-chicken.txt': { name: 'Easy roast chicken', servings: 4, lang: 'en', ingredients: 8, steps: 14, time: { total: 85 } },
  'en-kingarthur-banana-bread.txt': { name: 'Banana Bread', servings: null, lang: 'en', ingredients: 14, steps: 8, time: { active: 20, total: 90 } },
  'en-loveandlemons-banana-bread.txt': { name: 'Banana Bread', servings: 8, lang: 'en', ingredients: 11, steps: 6, time: { active: 15, total: 70 } },
  // 12 products + the two group headers "Rice + vegetables:" and "Sauce:".
  'en-minimalistbaker-vegan-fried-rice.txt': { name: 'Easy Vegan Fried Rice', servings: 4, lang: 'en', ingredients: 14, steps: 10, time: { active: 15, total: 75 } },
  // Metric and US lists both kept (too much rather than too little): 2 × 13 products + 4 group headers.
  'en-nigella-chocolate-guinness-cake.txt': { name: 'Chocolate Guinness Cake', servings: 12, lang: 'en', ingredients: 30, steps: 6, time: null },
  // 16 products + "To serve:".
  'en-recipetineats-spaghetti-bolognese.txt': { name: 'Spaghetti Bolognese', servings: 5, lang: 'en', ingredients: 17, steps: 10, time: { active: 10, total: 40 } },
  'nl-24kitchen-chili-con-carne.txt': { name: 'Chili con carne', servings: 4, lang: 'nl', ingredients: 16, steps: 7, time: { active: 30 } },
  'nl-24kitchen-pompoen-stamppot.txt': { name: 'Pompoen stamppot', servings: 4, lang: 'nl', ingredients: 8, steps: 5, time: { active: 45 } },
  'nl-jumbo-pasta-met-champignons.txt': { name: 'Pasta met champignons', servings: 4, lang: 'nl', ingredients: 12, steps: 4, time: { total: 15 } },
  // 15 products + "Kruiden:".
  'nl-lekkerensimpel-chili-con-carne.txt': { name: 'Chili con carne', servings: 2, lang: 'nl', ingredients: 16, steps: 8, time: { total: 45 } },
  // 10 products + "Pesto:".
  'nl-lekkerensimpel-pasta-pesto.txt': { name: 'Pasta pesto', servings: 2, lang: 'nl', ingredients: 11, steps: 7, time: { total: 20 } },
  'nl-leukerecepten-pasta-carbonara.txt': { name: 'Pasta carbonara: romige klassieker', servings: null, lang: 'nl', ingredients: 6, steps: 7, time: { active: 10, total: 25 } },
  'nl-leukerecepten-pompoensoep.txt': { name: 'Pompoensoep', servings: null, lang: 'nl', ingredients: 7, steps: 5, time: { active: 10, total: 40 } },
  // 12 products + "Kaasstengels (optioneel):".
  'nl-uitpaulineskeuken-champignonsoep.txt': { name: 'Champignonsoep', servings: 4, lang: 'nl', ingredients: 13, steps: 10, time: { total: 20 } },
  'nl-uitpaulineskeuken-witlofsalade.txt': { name: 'Witlofsalade met ei en oude kaas', servings: 4, lang: 'nl', ingredients: 10, steps: 4, time: { total: 15 } },
};

const NOISE = /jump to recipe|print|share|opslaan|delen|kookstand|scherm aanhouden|cook mode|advertentie|advertisement|kcal|calories|votes|reacties|comments|nieuwsbrief|login|facebook|pinterest/i;

describe('parseWebsiteRecipe: every fixture', () => {
  it('the fixture list matches the expectation table (add a row for a new fixture)', () => {
    expect(PASTE_FIXTURES).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const file of PASTE_FIXTURES) {
    const want = EXPECTED[file];
    if (!want) continue;
    it(file, () => {
      const r = parseWebsiteRecipe(readPasteFixture(file));
      expect(r).not.toBeNull();
      const got = r as WebsiteRecipe;
      expect(got.name).toBe(want.name);
      expect(got.servings).toBe(want.servings);
      expect(got.lang).toBe(want.lang);
      expect(got.time).toEqual(want.time);
      expect(got.confidence).toBe('high');
      expect(got.ingredients, got.ingredients.join('\n')).toHaveLength(want.ingredients);
      expect(got.steps, got.steps.join('\n')).toHaveLength(want.steps);
      // No page furniture among the lines, and nothing twice.
      for (const l of [...got.ingredients, ...got.steps]) expect(l, l).not.toMatch(NOISE);
      expect(new Set(got.steps).size).toBe(got.steps.length);
      // Every ingredient line is a product line or a group header, never a nutrition number.
      for (const l of got.ingredients) expect(l).not.toMatch(/^(?:energie|koolhydraten|eiwitten|vet|fat|carbs|protein)\b/i);
    });
  }
});

describe('parseWebsiteRecipe: what the fixtures must keep and drop', () => {
  it('keeps group headers as header lines ending in ":" and the odd quantity forms as written', () => {
    const chili = parseWebsiteRecipe(readPasteFixture('nl-lekkerensimpel-chili-con-carne.txt'));
    expect(chili?.ingredients).toContain('Kruiden:');
    expect(chili?.ingredients).toContain('snuf chilivlokken');
    expect(chili?.ingredients).toContain('zout en peper');
    const soep = parseWebsiteRecipe(readPasteFixture('nl-uitpaulineskeuken-champignonsoep.txt'));
    expect(soep?.ingredients).toContain('Kaasstengels (optioneel):');
    expect(soep?.ingredients).toContain('30 + 10 g Grana Padano of Parmezaanse kaas');
    expect(soep?.ingredients).toContain('1 ltr (kippen)bouillon');
    // The equipment list under "Benodigdheden" (after the ingredients) is not an ingredient.
    expect(soep?.ingredients.some((l) => /staafmixer/i.test(l))).toBe(false);
    const rice = parseWebsiteRecipe(readPasteFixture('en-minimalistbaker-vegan-fried-rice.txt'));
    expect(rice?.ingredients[0]).toBe('Rice + vegetables:');
    expect(rice?.ingredients).toContain('Sauce:');
    expect(rice?.ingredients).toContain('1 cup extra-firm tofu* (8 ounces yields ~1 cup)');
    const bolo = parseWebsiteRecipe(readPasteFixture('en-recipetineats-spaghetti-bolognese.txt'));
    expect(bolo?.ingredients).toContain('To serve:');
    expect(bolo?.ingredients[0]).toBe('1 1/2 tbsp olive oil');
    const cake = parseWebsiteRecipe(readPasteFixture('en-nigella-chocolate-guinness-cake.txt'));
    expect(cake?.ingredients.filter((l) => l === 'Cake:')).toHaveLength(2);
  });

  it('strips the site bullets, boxes and step numbers', () => {
    const r = parseWebsiteRecipe(readPasteFixture('nl-24kitchen-chili-con-carne.txt'));
    expect(r?.ingredients[0]).toBe('1 rode ui');
    expect(r?.steps[0]).toMatch(/^Pel en snipper de ui/);
    const w = parseWebsiteRecipe(readPasteFixture('nl-uitpaulineskeuken-witlofsalade.txt'));
    expect(w?.ingredients[0]).toBe('6 stronkjes witlof');
    const fn = parseWebsiteRecipe(readPasteFixture('en-foodnetwork-perfect-roast-chicken.txt'));
    expect(fn?.steps[0]).toMatch(/^Preheat the oven/);
  });

  it('drops the furniture: buttons, nutrition, comments, the repeated title, "PRINT THIS RECIPE" as step 12', () => {
    const j = parseWebsiteRecipe(readPasteFixture('en-jamieoliver-classic-tomato-spaghetti.txt'));
    expect(j?.steps.at(-1)).toMatch(/^Serve with the reserved basil/);
    expect(j?.steps.some((s) => /PRINT/.test(s))).toBe(false);
    expect(j?.ingredients.some((l) => /Calories|Fibre/.test(l))).toBe(false);
    const c = parseWebsiteRecipe(readPasteFixture('nl-24kitchen-chili-con-carne.txt'));
    expect(c?.ingredients).not.toContain('Chili con carne');
    expect(c?.steps.some((s) => /Scherm aanhouden|Deel dit recept/.test(s))).toBe(false);
    const ll = parseWebsiteRecipe(readPasteFixture('en-loveandlemons-banana-bread.txt'));
    expect(ll?.steps.some((s) => /inbox|Preorder/i.test(s))).toBe(false);
    expect(ll?.ingredients.some((l) => /Loaf Pan|Cook Mode/i.test(l))).toBe(false);
    const ka = parseWebsiteRecipe(readPasteFixture('en-kingarthur-banana-bread.txt'));
    expect(ka?.steps).toHaveLength(8);
    expect(ka?.ingredients.some((l) => /Nutrition/.test(l))).toBe(false);
  });

  it('puts doubtful lines in leftovers instead of the bin', () => {
    const pesto = parseWebsiteRecipe(readPasteFixture('nl-lekkerensimpel-pasta-pesto.txt'));
    expect(pesto?.leftovers).toContain('Maak de pesto:');
    expect(pesto?.leftovers.some((l) => /Een snelle, smaakvolle pastamaaltijd/.test(l))).toBe(true);
    const soep = parseWebsiteRecipe(readPasteFixture('nl-uitpaulineskeuken-champignonsoep.txt'));
    expect(soep?.leftovers).toContain('Kaasstengels maken – optioneel');
    const j = parseWebsiteRecipe(readPasteFixture('en-jamieoliver-easy-roast-chicken.txt'));
    expect(j?.leftovers.some((l) => /super-reliable roast chicken/.test(l))).toBe(true);
    expect(j?.leftovers).not.toContain('Share Your Thoughts!');
  });

  it('notes, tips and variations under their own heading are leftovers, never dropped; nutrition still is', () => {
    const chili = parseWebsiteRecipe(readPasteFixture('nl-24kitchen-chili-con-carne.txt'));
    expect(chili?.leftovers).toContain('Lekker met een schep zure room en wat extra koriander erover.');
    const rice = parseWebsiteRecipe(readPasteFixture('en-minimalistbaker-vegan-fried-rice.txt'));
    expect(rice?.leftovers.some((l) => /sub 1 cup fresh or frozen edamame/.test(l))).toBe(true);
    expect(rice?.leftovers.some((l) => /Calories/.test(l))).toBe(false);
    // The tip on the heading line itself ("Sandra's tip: …") travels along.
    const carbonara = parseWebsiteRecipe(readPasteFixture('nl-leukerecepten-pasta-carbonara.txt'));
    expect(carbonara?.leftovers.some((l) => /^Sandra's tip: voor een vegetarische variant/.test(l))).toBe(true);
    const blog = parseWebsiteRecipe('Soup\nIngredients\n1 onion\n2 carrots\n1 l stock\nInstructions\nChop everything and cook for 20 minutes.\nServe hot with bread.\nNotes\n*If you do not like tofu, you can sub 1 cup edamame.\nRate this recipe\nNutrition\nCalories: 300');
    expect(blog?.steps).toHaveLength(2);
    expect(blog?.leftovers).toEqual(['If you do not like tofu, you can sub 1 cup edamame.']);
  });
});

describe('parseWebsiteRecipe: headings, servings, times and bullets in every form', () => {
  it('reads Dutch and English heading synonyms, with or without # and :', () => {
    for (const [ing, method] of [
      ['Ingrediënten', 'Bereiding'],
      ['Benodigdheden', 'Werkwijze'],
      ['Dit heb je nodig:', 'Zo maak je het'],
      ['## Ingredients', '## Instructions'],
      ['INGREDIENTS', 'DIRECTIONS'],
      ['Ingredients:', 'Preparation'],
      ['Boodschappen', 'Aan de slag'],
      ['What you need', 'Method'],
    ]) {
      const r = parseWebsiteRecipe(`Soep\n${ing}\n1 ui\n2 wortels\n${method}\nSnijd alles en kook het 20 minuten.\nServeer warm.`);
      expect(r?.confidence, ing).toBe('high');
      expect(r?.ingredients, ing).toEqual(['1 ui', '2 wortels']);
      expect(r?.steps, method).toEqual(['Snijd alles en kook het 20 minuten.', 'Serveer warm.']);
    }
  });

  it('servings in every form; "Yield: 1 loaf" is not a number of people', () => {
    const forms: [string, number | null][] = [
      ['Serves 4', 4],
      ['Serves 4-6', 4],
      ['4 servings', 4],
      ['Servings: 6', 6],
      ['Voor 4 personen', 4],
      ['4 personen', 4],
      ['2–4 pers.', 2],
      ['Porties: 3', 3],
      ['Yields: about 12 slices', 12],
      ['Original recipe (1X) yields 12 servings', 12],
      ['Yield: 1 loaf', null],
      ['Voor personen', null],
    ];
    for (const [line, want] of forms) {
      const r = parseWebsiteRecipe(`Soep\n${line}\nIngrediënten\n1 ui\n2 wortels\nBereiding\nKook alles 20 minuten.`);
      expect(r?.servings, line).toBe(want);
      expect(r?.ingredients, line).toEqual(['1 ui', '2 wortels']);
    }
    const head = parseWebsiteRecipe('Soep\nIngrediënten voor 4 personen\n1 ui\n2 wortels\nBereiding\nKook alles 20 minuten.');
    expect(head?.servings).toBe(4);
    expect(head?.ingredients).toEqual(['1 ui', '2 wortels']);
  });

  it('times: prep + cook add up, a total line wins, a lone prep time is not a total', () => {
    const base = (lines: string) => parseWebsiteRecipe(`Soep\n${lines}\nIngrediënten\n1 ui\nBereiding\nKook alles 20 minuten.`)?.time;
    expect(base('Prep: 10 mins\nCook: 20 mins')).toEqual({ active: 10, total: 30 });
    expect(base('Prep Time 15 minutes minutes\nCook Time 1 hour hour\nTotal Time 1 hour hour 15 minutes minutes')).toEqual({ active: 15, total: 75 });
    expect(base('10 M + 30 M kooktijd')).toEqual({ active: 10, total: 40 });
    expect(base('Bereidingstijd: 45 minuten min')).toEqual({ total: 45 });
    expect(base('30 min. voorbereiden')).toEqual({ active: 30 });
    expect(base('1 hr 25 mins plus resting time')).toEqual({ total: 85 });
    expect(base('Hands-on: 20 mins\nBake: 1 hr 10 mins')).toEqual({ active: 20, total: 90 });
    expect(base('Makkelijk')).toBeNull();
    // A step with minutes in it is a step, not a time line.
    expect(parseWebsiteRecipe('Soep\nIngrediënten\n1 ui\nBereiding\nKook 20 minuten.\nLaat 10 min rusten.')?.steps).toEqual(['Kook 20 minuten.', 'Laat 10 min rusten.']);
  });

  it('bullets, boxes and numbering in every form', () => {
    const r = parseWebsiteRecipe('Soep\nIngredients\n▢ 1 onion\n• 2 carrots\n- 1 l stock\n* salt\n☐ pepper\nMethod\n1. Chop everything.\n2) Boil it.\nStep 3: Season well.\nSTEP 4 Serve hot.');
    expect(r?.ingredients).toEqual(['1 onion', '2 carrots', '1 l stock', 'salt', 'pepper']);
    expect(r?.steps).toEqual(['Chop everything.', 'Boil it.', 'Season well.', 'Serve hot.']);
  });

  it('group headers: "For the sauce" / "Voor de pesto" / "SAUCE" / "Kruiden:"', () => {
    const r = parseWebsiteRecipe('Soep\nIngredients\n1 onion\nFor the sauce\n2 tbsp butter\nSAUCE\n1 tsp salt\nKruiden:\n1 tl komijn\nTo serve\nbread\nMethod\nCook it all for 20 minutes.');
    expect(r?.ingredients).toEqual(['1 onion', 'Sauce:', '2 tbsp butter', 'Sauce:', '1 tsp salt', 'Kruiden:', '1 tl komijn', 'To serve:', 'bread']);
  });

  it('a second "Ingrediënten voor …" heading becomes a group header; "Benodigdheden" after the list is equipment', () => {
    const r = parseWebsiteRecipe('Taart\nIngrediënten\n1 ei\n2 appels\n3 peren\nIngrediënten voor de topping\n50 g suiker\nBenodigdheden\nspringvorm\nBereiding\nBak 30 minuten.');
    expect(r?.ingredients).toEqual(['1 ei', '2 appels', '3 peren', 'Topping:', '50 g suiker']);
    // "Benodigdheden" as the only heading IS the ingredient list.
    const only = parseWebsiteRecipe('Taart\nBenodigdheden\n1 ei\n2 appels\nBereiding\nBak 30 minuten.');
    expect(only?.ingredients).toEqual(['1 ei', '2 appels']);
  });
});

describe('parseWebsiteRecipe: without headings, and when there is no recipe', () => {
  it('reads the shape: a block of quantity lines is the list, the sentences after it the steps', () => {
    const r = parseWebsiteRecipe(
      'Snelle tomatensoep\n4 personen\n1 ui\n2 teentjes knoflook\n800 g tomatenblokjes\n500 ml bouillon\nzout en peper\nSnipper de ui en fruit hem in olie.\nVoeg de knoflook en tomaten toe en laat 15 minuten koken.\nBreng op smaak met zout en peper.',
    );
    expect(r?.confidence).toBe('medium');
    expect(r?.name).toBe('Snelle tomatensoep');
    expect(r?.servings).toBe(4);
    expect(r?.ingredients).toEqual(['1 ui', '2 teentjes knoflook', '800 g tomatenblokjes', '500 ml bouillon', 'zout en peper']);
    expect(r?.steps).toHaveLength(3);
    expect(r?.lang).toBe('nl');
  });

  it('English without headings, with an intro sentence that lands in leftovers', () => {
    const r = parseWebsiteRecipe('Quick tomato soup\nThis is the soup my grandmother made every Sunday.\n1 onion\n2 cloves garlic\n800 g chopped tomatoes\n500 ml stock\nFry the onion in a little oil until soft.\nAdd the garlic and tomatoes and simmer for 15 minutes.');
    expect(r?.confidence).toBe('medium');
    expect(r?.name).toBe('Quick tomato soup');
    expect(r?.ingredients).toHaveLength(4);
    expect(r?.steps).toHaveLength(2);
    expect(r?.leftovers).toContain('This is the soup my grandmother made every Sunday.');
    expect(r?.lang).toBe('en');
  });

  it('returns null for empty text, prose and a lone list of words', () => {
    expect(parseWebsiteRecipe('')).toBeNull();
    expect(parseWebsiteRecipe('   \n\n')).toBeNull();
    expect(parseWebsiteRecipe('Hallo, hoe gaat het? Ik zie je morgen om half acht bij de bakker.')).toBeNull();
    expect(parseWebsiteRecipe('appel\npeer\nbanaan')).toBeNull();
  });

  it('a heading with ingredients but no method is medium; markdown escapes are cleaned first', () => {
    const r = parseWebsiteRecipe('Soep\nIngrediënten\n1 ui \\[gesnipperd\\]\n2 wortels\n3 aardappelen');
    expect(r?.confidence).toBe('medium');
    expect(r?.ingredients).toEqual(['1 ui [gesnipperd]', '2 wortels', '3 aardappelen']);
    expect(r?.steps).toEqual([]);
  });

  it('detectRecipeLang', () => {
    expect(detectRecipeLang('Snipper de ui en bak hem in de olie met zout en peper.')).toBe('nl');
    expect(detectRecipeLang('Chop the onion and fry it in the oil with salt and pepper.')).toBe('en');
    expect(detectRecipeLang('123 456')).toBeNull();
  });
});
