# Spec V9 — Voedingswaarden: één rustige kcal-regel per portie, met uitklap voor de macro's (Stijn, 17 okt + 8 nov 2026)

Status: in aanbouw (Fable, 9 nov 2026). Eén blok, drie bouwers + data-ronde (Sonnet, negentien batches van ±80 ingrediënten: 1448 voedsel-ids) + integrator + toepasser (lichte
modus met een extra data-fase). Bron: docs/IDEAS.md idee 1 (Stijn 17 okt: "klein ≈ 620 kcal p.p. met een subtiel uitklapmenu voor
eiwit, vet, koolhydraten en meer; klein en rustig"; 8 nov: "subtiel met calorieën in recepten; de waarden bij de ingrediënten, verder
niet standaard tonen; misschien bij calorieën een uitklap voor de macro's"). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/handbook.md §4, CLAUDE.md invarianten 2 (een ruwe regel wordt nooit verwijderd), 4 (de deellink verandert niet: niets van
dit blok reist mee in een token) en 14 (geen backend: de tabel zit in de app).
Gebouwd: 9 nov 2026 (V9, lichte workflow met data-fase; run-id in STATUS)

**Kritische lezer (Fable, vooraf).** (1) Het moeilijke is niet de voedingstabel maar grammen per regel. Meting 9 nov over
data/recipes.json (216 recepten, 2010 regels, 104 zonder hoeveelheid): 1114 van de 1906 regels met een hoeveelheid zijn nu in grammen
om te rekenen (58 %). Het gat: 622 regels van 137 ingrediënten in een volume-eenheid zonder dichtheid (olijfolie 40, peterselie 30,
melk 24, bloem 22, slagroom 21, wijn 21, …), 74 regels van 30 ingrediënten in stuks zonder stukgewicht (prei 14, laurierblad 10,
olijf 7, …) en 96 regels van 59 (ingrediënt, eenheid)-paren zonder gewicht (takje tijm 6, blik maïs 5, snee witbrood 3, mespunt
cayennepeper 2, …). (2) Dichtheid komt in een EIGEN veld `gramsPerMl` en niet in `gramsPer.ml`: `aggregate.ts` vouwt ml-regels naar
grammen zodra `gramsPer.ml` bestaat (`gramsOf`), en dan verandert de boodschappenlijst ("113 g olijfolie"). Stukgewichten en
eenheidsgewichten gaan wél in het bestaande `gramsPer` (dat is precies waar de lijst ze ook voor gebruikt: "1 prei" blijft 1 prei, de
lijst verandert alleen bij een gewichtsproduct dat in stuks staat, zoals nu al bij kipfilet). (3) De waarden per 100 g worden door een
taalmodel ingevuld als SCHATTING op het niveau van de openbare tabellen (NEVO van het RIVM, USDA); we downloaden geen tabel en verzinnen
geen NEVO-codes. De validator eist consistentie (kcal ≈ 4·eiwit + 4·koolhydraten + 9·vet + 7·alcohol, binnen 15 % of 20 kcal), de UI
zegt "≈", toont het dekkingspercentage en noemt het in de uitklap een schatting. Stijn kan later per ingrediënt eigen waarden geven
(IDEAS 1, "later"). (4) Pasta en rijst staan droog in recepten; de tabel geeft dus waarden per 100 g PRODUCT ZOALS HET IN HET RECEPT
STAAT (droog), net als NEVO. Frituurolie en marinades tellen volledig mee: een bekende overschatting, eerlijk in het handboek. (5) Per
portie = totaal / `servings` van het recept dat de tab toont (`shownRecipe.servings`); schalen verandert per portie niets, een dieettab
of eigen versie telt met haar eigen regels (`shownLines`). (6) Geen weektotalen, niets in de kookstand, niets in lijsten (Stijn 8 nov).
(7) Niet-voedsel (gangpaden `huishoudelijk` en `drogisterij`, 164 ingrediënten) krijgt geen waarden en telt niet mee in de dekking.
(8) De tabel (±1450 items × 7 getallen, ±100 KB) laadt apart (`import()`), pas als een receptpagina of het woordenboek hem nodig heeft.
(9) Een eigen recept met veel vrije tekst krijgt een laag percentage: onder 50 % tonen we niets (een getal op een halve lijst is
misleidender dan geen getal); het handboek legt dat uit. (10) Badges ("Eiwitkampioen", "10.000 kcal gekookt") blijven voor later
(IDEAS 1); geen feature-event.

**Feitencheck (Fable, in de code).** `src/domain/dictionary.ts` `Ingredient { defaultUnit: string | null; buyUnit?; gramsPer?:
Record<string, number>; staple; aisle; … [k: string]: unknown }`; `Dictionary.unit(id)` → `Unit { id, group: 'mass'|'volume'|'count'|
'package'|'pinch'|'length', g?, ml? }` (units.json: g 1, kg 1000, oz 28.35, lb 453.6, stick 113; ml 1, dl 100, l 1000, el 15, tl 5, kop 250,
cup 240, glas 200, floz 30, pint 500, quart 950; pinch: snuf, mp, scheut, klont, druppel; count: stuk, teen, bos, takje, snee, plak, …;
package: pak, blik, pot, fles, zak, zakje, bakje, beker, envelopje). `src/domain/model.ts` `Line { raw; kind?; qty?: Qty | null; unit?:
string | null; ing?: string | null; … }`, `Qty { min, max? }` (aggregate leest `qty.max ?? qty.min`). `src/domain/aggregate.ts`
`contributionOf` (r. 249–287) bepaalt de eenheid: `unitId = line.unit ?? ing.defaultUnit`; geen `line.unit` én een getal én defaultUnit
geen telwoord → `'stuk'`; `gramsPer[unit]` wint voor lepels van een gewichtsproduct. `src/screens/RecipeScreen.tsx`: `shownRecipe`,
`shownLines` (r. 455–458), `base = shownRecipe.servings || 4` (r. 542), de metaregel `<p class="detail-meta recipe-meta">` (r. 918–926),
daarna `detail-variant-of` en de fotostrook. `src/screens/MoreScreen.tsx`: Instellingen met `.setting` + `label.switch` (confetti, badges)
en het Temperatuur-`Segmented` (r. 630–651); het blok Over (`.about`, r. 728). `src/screens/DictionaryScreen.tsx` `EntryDetail` (r. 95–140):
`<dl class="dw-facts">` met Naam, Engels, Aliassen, Schap, Eenheid. `src/db/repo.ts`: `getTemperatureMode/setTemperatureMode` als voorbeeld
van een instelling met default; `DEVICE_LOCAL_SETTINGS` (dit blok voegt niets toe: de schakelaar reist mee in de back-up). `src/dictionary.ts`:
`dictionary` signal. `src/domain/data.ts` importeert de JSON-data statisch; `src/app.tsx` laadt het handboek met `import()`. `tools/validate-data.ts`:
`validateDictionary` (gramsPer: eenheid-id of "stuk" → positief getal, r. 606–609), `main()` r. 2018; i18n: recipe.* in src/i18n/browse.ts,
dict.* in src/i18n/edit.ts, more.* in src/i18n/settings.ts. `tools/apply-llm-batch.ts` is het voorbeeld van een batch-samenvoeger
(--check / --apply, weigeren bij een onbekende id). Handboek: 02-recepten (43 rijen, o.a. `recepten.receptpagina`, `recepten.porties`),
08-instellingen-en-opslag (20 rijen, o.a. `instellingen-en-opslag.fahrenheit`). DEVICE-TEST: na V8 is rij 117 bezet; dit blok krijgt rij 118.

## 1. Gedrag

### 1a. Data-model en domein (bouwer A: `src/domain/nutrition.ts` [nieuw], `src/domain/dictionary.ts` (één veld), `tools/validate-data.ts`,
`tools/apply-nutrition.ts` [nieuw], `tools/measure-grams.ts` [nieuw], `package.json` (twee scripts; geen dependency), `tests/nutrition.test.ts` [nieuw],
`tests/validate-nutrition.test.ts` [nieuw], `data/nutrition.json` [nieuw, leeg skelet])

- `Ingredient.gramsPerMl?: number` — dichtheid in g/ml (olie 0,92, bloem 0,55, melk 1,03, honing 1,42). Validator: getal in [0,2, 2,0].
  `gramsPer`-waarden: getal in [0,05, 5000] (laurierblad 0,2 g, een pompoen 1500 g); controleer dat de bestaande data daaraan voldoet.
- `data/nutrition.json`:
  ```json
  { "schema": 1, "per": "100 g", "note": { "nl": "Schattingen per 100 g product zoals het in het recept staat (pasta en rijst droog), op het niveau van de openbare tabellen NEVO (RIVM) en USDA; geen merkwaarden.", "en": "Estimates per 100 g of the product as it appears in the recipe (pasta and rice dry), at the level of the public NEVO (RIVM) and USDA tables; no brand values." },
    "items": { "<ingredient-id>": { "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "fibre": 0, "salt": 0, "alcohol": 0, "source": "estimate" } } }
  ```
  `alcohol` (g/100 g) en `source` ('estimate' | 'nevo' | 'usda') optioneel; de rest verplicht, getallen ≥ 0, één decimaal genoeg.
  Items gesorteerd op id. Bouwer A levert het skelet met drie handmatige items (`olijfolie` 884/0/100/0/0/0; `bloem` 364/10/1/76/3/0;
  `ui` 40/1.1/0.1/9.3/1.7/0) zodat de tests en de UI iets hebben; de data-ronde vult de rest.
- `validateNutrition(data, ingredientIds, nonFoodIds)` in tools/validate-data.ts: schema 1; elke id bestaat in de woordenlijst; geen id uit
  `nonFoodIds` (gangpad huishoudelijk/drogisterij); getallen ≥ 0; protein + fat + carbs + fibre ≤ 101; salt ≤ 100; kcal binnen
  max(15 %, 20 kcal) van 4·protein + 4·carbs + 9·fat + 7·alcohol; `source` uit de drie waarden. `main()` valideert het bestand als het bestaat.
- `src/domain/nutrition.ts` (framework-vrij):
  ```ts
  export interface Nutrients { kcal: number; protein: number; fat: number; carbs: number; fibre: number; salt: number }
  export interface NutritionItem extends Nutrients { alcohol?: number; source?: 'estimate' | 'nevo' | 'usda' }
  export type NutritionTable = Readonly<Record<string, NutritionItem>>;
  export const NON_FOOD_AISLES: ReadonlySet<string> = new Set(['huishoudelijk', 'drogisterij']);
  /** Grams of one pinch unit when the dictionary has no gramsPer for it. */
  export const PINCH_GRAMS: Readonly<Record<string, number>> = { snuf: 0.3, mp: 0.5, scheut: 10, klont: 15, druppel: 0.05 };
  export const NUTRITION_MIN_COVERAGE = 0.5;
  export const KCAL_ROUND = 10;
  /** The quantity a line counts with: the midpoint of a range ("2-3" → 2.5); a unit with a known weight and no number → 1; else null. */
  export function lineQty(line: Line, ing: Ingredient | undefined): number | null
  /** Grams of a line, or null when they cannot be known. */
  export function lineGrams(line: Line, dict: Dictionary): number | null
  export interface RecipeNutrition { perServing: Nutrients | null; counted: number; total: number; coverage: number }
  export function recipeNutrition(lines: readonly Line[], servings: number, dict: Dictionary, table: NutritionTable): RecipeNutrition
  /** kcal to the nearest KCAL_ROUND, grams to whole grams, salt to one decimal. */
  export function roundNutrients(n: Nutrients): Nutrients
  ```
  `lineGrams`: header → null. `ing` onbekend in `dict` → null. `qty = lineQty(...)`; null → null. Eenheid als `aggregate.contributionOf`:
  `unitId = line.unit ?? ing.defaultUnit`; geen `line.unit`, wel een getal en `defaultUnit` geen telwoord (`group !== 'count'`) → `'stuk'`.
  Dan: `ing.gramsPer?.[unitId]` (ook voor 'stuk') wint altijd als het er is; anders per groep: mass → `qty · unit.g`; volume → `qty · unit.ml ·
  ing.gramsPerMl` (geen dichtheid → null); 'stuk' zonder gramsPer.stuk → als `defaultUnit` een telwoord is met `gramsPer[defaultUnit]` dat,
  anders null; count/package/length zonder gramsPer → null; pinch zonder gramsPer → `qty · PINCH_GRAMS[unitId]` (onbekende pinch → null).
  `recipeNutrition`: `total` = regels (geen header) met `lineQty !== null` óf met `qty` ingevuld maar zonder `ing` (telt als onbekend);
  `counted` = regels met `lineGrams !== null` én `table[ing]`; som = Σ grams/100 · item; `perServing` = som / servings als `servings ≥ 1` en
  `counted > 0`, anders null; `coverage = total ? counted / total : 0`. Tests: elke eenheidsgroep, midden van een bereik, "klontje boter"
  = 1 klont, dichtheid ontbreekt → null maar telt in total, niet-herkende regel telt in total, header telt nergens, pinch-standaard,
  afronding (618 → 620; 7,24 → 7; zout 1,26 → 1,3), coverage met en zonder onbekende regels, servings 0 → perServing null.
- `tools/apply-nutrition.ts`: `--check <files…> | --apply <files…> | --apply all` (all = data/llm/nutrition/batch-*.json). Batchbestand:
  `{ "batch": "01", "items": [{ "id", "kcal", "protein", "fat", "carbs", "fibre", "salt", "alcohol"?, "gramsPerMl"?, "pieceGrams"?,
  "unitGrams"?: { "<unit-id>": g } }] }`. Controle per item: id bestaat en is voedsel; de nutritiegetallen volgens `validateNutrition`
  (met `source: 'estimate'`); `gramsPerMl` in [0,2, 2,0]; `pieceGrams` in [0,05, 5000]; `unitGrams`-sleutels bestaan in units.json.
  Toepassen: nutritie → `data/nutrition.json` items (een bestaand item wordt alleen vervangen als het `source: 'estimate'` heeft);
  `gramsPerMl` → `ingredients[id].gramsPerMl` alleen als het ontbreekt; `pieceGrams` → `gramsPer.stuk` als `defaultUnit` 'stuk' of null is,
  anders `gramsPer[defaultUnit]` als dat een telwoord is — alleen als die sleutel ontbreekt; `unitGrams` → `gramsPer[unit]` alleen als de
  sleutel ontbreekt. Een geweigerd item wordt genoemd (bestand, id, reden) en overgeslagen; de rest gaat door. Schrijft beide JSON-bestanden in
  dezelfde stijl als nu (ingredients.json: één object per regel; nutrition.json: één item per regel) zodat de git-diff leesbaar blijft.
- `tools/measure-grams.ts`: leest data/recipes.json, de woordenlijst en data/nutrition.json; rapporteert over alle regels met een hoeveelheid:
  in grammen (aantal, %), in grammen én met waarden (aantal, %), en de top-20 ontbrekende per soort (dichtheid, stukgewicht, eenheidsgewicht,
  nutritie-item) met het aantal regels; schrijft docs/measure-grams.md en print hetzelfde. `package.json`: `"measure-grams"` en
  `"apply-nutrition"` (beide `node --experimental-strip-types tools/…`). Geen nieuwe dependency.

### 1b. App en UI (bouwer B: `src/nutrition.ts` [nieuw], `src/components/NutritionLine.tsx` [nieuw], `src/screens/RecipeScreen.tsx`,
`src/screens/MoreScreen.tsx`, `src/screens/DictionaryScreen.tsx`, `src/db/repo.ts`, `src/i18n/browse.ts`, `src/i18n/settings.ts`,
`src/i18n/edit.ts`, `src/styles/browse.css`)

- `src/nutrition.ts`: `nutritionTable = signal<NutritionTable | null>(null)`; `loadNutrition(): Promise<void>` laadt één keer met
  `import('../data/nutrition.json')` (memoised promise; een fout → console.error en een lege tabel, nooit een kapotte pagina);
  `nutritionEnabled = signal(true)`; `loadNutritionSetting()` / `setNutritionEnabled(on)` via repo: setting `'nutrition.show'` (boolean,
  default true, reist mee in de back-up). Repo: `NUTRITION_KEY = 'nutrition.show'`, `getNutritionEnabled()`, `setNutritionEnabled(on)`
  naar het voorbeeld van de temperatuur-instelling.
- `NutritionLine.tsx`: props `{ lines: readonly Line[]; servings: number }`. Rendert niets als `!nutritionEnabled.value`, de tabel nog
  niet geladen is (roep `loadNutrition()` aan in een effect), `perServing` null is of `coverage < NUTRITION_MIN_COVERAGE`. Anders:
  ```
  <div class="nutri">
    <button type="button" class="nutri-line" aria-expanded={open}>≈ 620 kcal p.p. · 92 % bekend <chevron/></button>
    {open && <dl class="nutri-table"> Energie 620 kcal · Eiwit 32 g · Vet 24 g · Koolhydraten 61 g · Vezels 6 g · Zout 1,3 g </dl>
             <p class="nutri-note">Schatting op basis van gemiddelde waarden per ingrediënt, niet van jouw merk. 11 van de 12 regels geteld.</p>}
  </div>
  ```
  Getallen via `roundNutrients`; het percentage afgerond op hele procenten; `open` is lokale state (dicht bij elke receptpagina). Geen
  `no-print`: de dichte regel mag mee op papier. In RecipeScreen direct onder `<p class="detail-meta recipe-meta">`, vóór `detail-variant-of`:
  `<NutritionLine lines={shownLines} servings={base} />`. Niet in CookScreen, niet in de deeltekst, niet in lijsten.
- i18n (NL · EN), letterlijk:
  `recipe.kcalLine`: "≈ {kcal} kcal p.p." · "≈ {kcal} kcal per serving"; `recipe.nutriKnown`: "{pct} % bekend" · "{pct} % known";
  `recipe.nutriTitle`: "Per portie" · "Per serving"; `recipe.nutriNote`: "Schatting op basis van gemiddelde waarden per ingrediënt, niet
  van jouw merk. {counted} van de {total} regels geteld." · "An estimate based on average values per ingredient, not your brand. {counted}
  of {total} lines counted."; `nutri.kcal`: "Energie" · "Energy"; `nutri.protein`: "Eiwit" · "Protein"; `nutri.fat`: "Vet" · "Fat";
  `nutri.carbs`: "Koolhydraten" · "Carbohydrates"; `nutri.fibre`: "Vezels" · "Fibre"; `nutri.salt`: "Zout" · "Salt" (alle zes in browse.ts);
  `more.nutrition`: "Voedingswaarden" · "Nutrition"; `more.nutritionHint`: "Een rustige regel met calorieën per portie op de receptpagina"
  · "A quiet line with calories per serving on the recipe page"; `more.nutritionSource`: "Voedingswaarden zijn schattingen naar de openbare
  tabellen NEVO (RIVM) en USDA, niet van jouw merk." · "Nutrition values are estimates after the public NEVO (RIVM) and USDA tables, not
  your brand." (settings.ts); `dict.per100`: "Per 100 g" · "Per 100 g"; `dict.per100Line`: "{kcal} kcal · eiwit {protein} g · vet {fat} g ·
  koolhydraten {carbs} g" · "{kcal} kcal · protein {protein} g · fat {fat} g · carbs {carbs} g" (edit.ts).
- MoreScreen: in Instellingen direct onder het Temperatuur-blok een `.setting` met `label` (titel `more.nutrition`, `small` `more.nutritionHint`)
  en een `label.switch` zoals bij Confetti (zonder link). In het blok Over één `<p class="muted small">{t('more.nutritionSource')}</p>` onder de
  bestaande regels.
- DictionaryScreen `EntryDetail`: roep `loadNutrition()` aan (effect) en toon, als `nutritionTable.value?.[ing.id]` bestaat, onderaan de
  `<dl class="dw-facts">` `<dt>{t('dict.per100')}</dt><dd>{t('dict.per100Line', …)}</dd>` met kcal afgerond op hele kcal en de macro's op
  één decimaal (hier geen tientallen: het is een tabelwaarde).
- CSS (browse.css, bij `.detail-meta`): `.nutri { margin: -4px 0 10px; }`, `.nutri-line` = tekstknop in `var(--muted)`, 14 px, zonder
  rand, met een chevron (`.chev`, draait 180° bij open, `transition` 150 ms; `prefers-reduced-motion` → geen transition), `.nutri-table`
  = `dl` in twee kolommen (`grid-template-columns: auto 1fr`, gap 2 px 12 px, 14 px, max-width 320 px), `.nutri-note` 13 px muted.
  Werkt op 360 px; het gouden thema erft de tokens.

### 1c. Handboek en testrij (bouwer C: `data/handbook/02-recepten.json`, `data/handbook/08-instellingen-en-opslag.json`,
`docs/HANDLEIDING.md` + `docs/HANDBOOK.md` via `node --experimental-strip-types tools/handbook-md.ts`, `docs/DEVICE-TEST.md`)

- 02-recepten, direct ná `recepten.porties`, id `recepten.voedingswaarden`, `route: "/recipes"`, `platform: "all"`:
  title "Calorieën en voedingswaarden" · "Calories and nutrition"; what "Onder de tijd en de herkomst van een recept staat een rustige regel
  met ongeveer het aantal calorieën per portie en hoeveel procent van de ingrediënten de app kent. Tik erop voor eiwit, vet, koolhydraten,
  vezels en zout per portie." · "Below a recipe's time and origin there is a quiet line with roughly the calories per serving and what
  percentage of the ingredients the app knows. Tap it for protein, fat, carbohydrates, fibre and salt per serving."; where nl ["Open een recept.",
  "Kijk onder de regel met de tijd.", "Tik op de regel met kcal."] · en ["Open a recipe.", "Look under the line with the time.", "Tap the line
  with kcal."]; see "De regel klapt uit tot een klein tabelletje per portie, met eronder hoeveel regels van de ingrediëntenlijst meegeteld
  zijn. Nog een tik klapt het dicht." · "The line unfolds into a small table per serving, with below it how many lines of the ingredient
  list were counted. Another tap folds it away."; know "Het zijn schattingen op basis van gemiddelde waarden per ingrediënt, niet van jouw
  merk. Olie en marinade tellen helemaal mee, ook wat in de pan achterblijft. Kent de app minder dan de helft van de regels, dan staat er
  geen regel. Je zet de regel uit onder **Meer** → **Voedingswaarden**." · "They are estimates based on average values per ingredient, not
  your brand. Oil and marinade count in full, including what stays in the pan. If the app knows fewer than half of the lines, there is no
  line. You switch it off under **More** → **Nutrition**."; keywords nl ["calorieën", "kcal", "voedingswaarden", "eiwit", "koolhydraten",
  "macro's"] · en ["calories", "kcal", "nutrition", "protein", "carbs", "macros"].
- 08-instellingen-en-opslag, direct ná `instellingen-en-opslag.fahrenheit`, id `instellingen-en-opslag.voedingswaarden`, `route: "/more"`,
  `platform: "all"`: title "De regel met calorieën uitzetten" · "Switching the calorie line off"; what "De regel met calorieën op de
  receptpagina staat standaard aan. Wil je hem niet zien, dan zet je hem hier uit." · "The calorie line on the recipe page is on by default.
  If you would rather not see it, switch it off here."; where nl ["Tik onderaan op **Meer**.", "Zoek onder Instellingen de schakelaar
  **Voedingswaarden**.", "Zet hem uit."] · en ["Tap **More** at the bottom.", "Under Settings find the switch **Nutrition**.", "Switch it
  off."]; see "De regel met kcal verdwijnt van elke receptpagina. Zet je de schakelaar weer aan, dan staat hij er weer." · "The kcal line
  disappears from every recipe page. Switch it back on and it is back."; know "De instelling gaat mee in je back-up. In het woordenboek
  blijven de waarden per 100 g gewoon zichtbaar." · "The setting travels with your backup. In the dictionary the values per 100 g stay
  visible."; keywords nl ["calorieën", "voedingswaarden", "uitzetten", "instelling"] · en ["calories", "nutrition", "switch off",
  "setting"].
- DEVICE-TEST rij 118, NL én EN, in de stijl van rij 116. **Calorieën per portie (V9).** 1. Open **Recepten** en tik op de klassieker
  *«naam: de integrator vult het recept met de hoogste dekking uit docs/measure-grams.md in»*. Kijk onder de regel met de tijd. 2. Tik op de
  regel met kcal; tik er nog een keer op. 3. Zet het aantal personen twee keer hoger en kijk naar de regel. 4. Tik op **Koken**; ga terug.
  5. Open een eigen recept dat je zelf als tekst hebt geplakt met weinig herkende ingrediënten (of maak er een met drie regels vrije tekst).
  6. Tik op **Meer** → **Recepten & delen** → **Woordenboek**, zoek *olijfolie* en tik erop. 7. Tik op **Meer** en zet **Voedingswaarden** uit;
  open het recept van stap 1. Zet de schakelaar weer aan. 8. Zet de app op Engels en doe stap 1–2 nog eens. | 1. Onder de tijd staat in
  grijs "≈ … kcal p.p. · … % bekend" met een pijltje; het getal is een rond tiental. 2. Een klein tabelletje klapt uit: Energie, Eiwit, Vet,
  Koolhydraten, Vezels, Zout per portie, met eronder "Schatting op basis van gemiddelde waarden per ingrediënt, niet van jouw merk. … van de
  … regels geteld."; de tweede tik klapt het dicht. 3. De regel verandert niet: het is per portie. 4. In de kookstand staat geen kcal-regel.
  5. Geen kcal-regel (minder dan de helft van de regels bekend). 6. In het detail staat "Per 100 g: 884 kcal · eiwit 0 g · vet 100 g ·
  koolhydraten 0 g". 7. De regel is weg; na het aanzetten staat hij er weer. 8. "≈ … kcal per serving · … % known", de tabel heet Per serving
  met Energy, Protein, Fat, Carbohydrates, Fibre, Salt. Onder **Over** staat in beide talen de bronregel over NEVO en USDA.

### 1d. De data-ronde (negentien Sonnet-agents, daarna de toepasser)

- Invoer: `data/llm/nutrition/input-NN.json` (door Fable gemaakt vóór de run): `{ "batch": "NN", "items": [{ "id", "nl", "en", "defaultUnit",
  "aisle", "needPiece": bool, "needUnits": ["takje"] }] }` — alle voedsel-ingrediënten (geen huishoudelijk/drogisterij), ±80 per batch, op id.
- Elke agent schrijft `data/llm/nutrition/batch-NN.json` (schema in §1a bij apply-nutrition.ts) met per item: de zes waarden per 100 g
  product zoals het in een recept staat (droog voor pasta, rijst, peulvruchten; bouillonBLOKJE als blokje, bouillon als vloeistof;
  `alcohol` alleen voor drank), `gramsPerMl` voor ALLES wat in een recept per ml, lepel of kopje kan staan (vloeistoffen, poeders, meel,
  suiker, rijst, gehakte kruiden; een heel stuk zoals een kipfilet krijgt géén dichtheid), `pieceGrams` alleen als `needPiece` true is
  (het gewicht van één `defaultUnit`: één prei 150, één laurierblad 0,2, één teen knoflook 5), `unitGrams` alleen voor de genoemde
  `needUnits` (één takje tijm 1, één blik maïs 300 uitlekgewicht 285 → neem het uitlekgewicht als het recept dat gebruikt, anders de
  inhoud). Bij twijfel: het gemiddelde Nederlandse supermarktproduct. Nooit een id overslaan; nooit een id toevoegen.
- Toepasser (Opus): `npm run apply-nutrition -- --check all`, bekijkt de weigeringen, herstelt evidente tikfouten zelf (kcal 10× te hoog,
  komma/punt), laat twijfelgevallen weg en noemt ze; dan `--apply all`, `npm run validate:data`, `npm run measure-grams` (doel: ≥ 90 % van de
  regels met een hoeveelheid in grammen én met waarden; haalt het dat niet, dan de top-20 ontbrekende in het rapport en in STATUS), `npm test`,
  en vult in DEVICE-TEST rij 118 de receptnaam in.

## 2. Opus mag dit NIET zelf beslissen

- `gramsPerMl` is een eigen veld, géén `gramsPer.ml` (boodschappenlijst ongemoeid). Stuk- en eenheidsgewichten wél in `gramsPer`, alleen
  waar de sleutel ontbreekt.
- Midden van een bereik; per 100 g product zoals in het recept (droog); olie en marinade tellen volledig; pinch-standaardgewichten uit
  `PINCH_GRAMS`; drempel 50 %; kcal op tientallen; niets onder de drempel (ook geen "onbekend"-regel).
- Standaard AAN; de schakelaar reist mee in de back-up; geen weektotalen, niets in kookstand, deeltekst of lijsten; geen feature-event,
  geen badge; de tabel laadt met `import()`; niets van dit blok in een token of in `Recipe`.
- De teksten (i18n, handboek, Over) letterlijk; "schatting" blijft staan.

## 3. Bestandsverdeling

| Bouwer | Bestanden |
|---|---|
| A (domein + tools) | `src/domain/nutrition.ts`, `src/domain/dictionary.ts` (veld `gramsPerMl`), `tools/validate-data.ts`, `tools/apply-nutrition.ts`, `tools/measure-grams.ts`, `package.json` (scripts), `data/nutrition.json` (skelet), `tests/nutrition.test.ts`, `tests/validate-nutrition.test.ts` |
| B (app + UI) | `src/nutrition.ts`, `src/components/NutritionLine.tsx`, `src/screens/RecipeScreen.tsx`, `src/screens/MoreScreen.tsx`, `src/screens/DictionaryScreen.tsx`, `src/db/repo.ts`, `src/i18n/browse.ts`, `src/i18n/settings.ts`, `src/i18n/edit.ts`, `src/styles/browse.css` |
| C (docs) | `data/handbook/02-recepten.json`, `data/handbook/08-instellingen-en-opslag.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md` (rij 118 NL + EN) |
| Data-agents | `data/llm/nutrition/batch-NN.json` (elk alleen het eigen bestand) |
| Toepasser | `data/nutrition.json`, `data/ingredients.json` (via de tool), `docs/measure-grams.md`, DEVICE-TEST rij 118 (receptnaam) |
| Integrator | samenvoegen, check/test/build/validate groen, acceptatie in de dev-app (receptpagina NL/EN, uitklap, schakelaar, woordenboek, kookstand zonder regel), `docs/STATUS.md`, de regel "Gebouwd" in deze spec |

Bouwer B bouwt tegen de handtekeningen van §1a; is `src/domain/nutrition.ts` er nog niet, dan schrijft B een minimale stub met precies die
handtekeningen en meldt het als open; de integrator houdt A's versie.
