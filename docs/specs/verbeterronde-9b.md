# Spec V9b — Voedingswaarden van schatting naar tabelwaarde (USDA nu, NEVO zodra Stijn het bestand heeft) (Stijn, 9 nov 2026)

Status: compleet (Fable, 9 nov 2026; USDA én NEVO toegepast). Eén blok, twee bouwers + integrator + Sonnet-koppelronde (negentien batches) + toepasser (lichte
modus met data-fase, zoals V9). Bron: docs/IDEAS.md idee 1, "Voorwerk V9b" (Stijn 9 nov: "kan je die niet alvast van internet afvissen en
met Sonnet integreren?", daarna "V9b klinkt goed", en hij zet zelf het vinkje bij de NEVO-voorwaarden). Leidend bij tegenspraak:
docs/specs/README.md §2–§4, docs/specs/verbeterronde-9.md (het model, de tools en de UI die dit blok uitbreidt), CLAUDE.md invariant 14
(de tabel zit in de app, geen backend) en 15 (geen dependency: CSV lezen met een eigen parser).
Gebouwd: 9 nov 2026 (V9b, lichte workflow met data-fase wf_454c9c2e-ac0, tweede data-ronde wf_436cc33b-93b; besluiten Fable na de lens: (1) de puntentelling is herzien — het hoofddeel is het komma-deel met de meeste treffers (USDA zet het groepswoord vooraan: "Spices, cinnamon, ground"), de synoniemen van `name2` tellen als eigen delen, een kandidaat moet minstens één woord van de hoofdnaam bevatten (anker), merkregels (HOOFDLETTERS) zijn nooit kandidaat, NEVO-vulwoorden (gem, bereid, av) en Engelse meervouden (tomatoes → tomato) worden netjes behandeld; daarna zijn 876 USDA-ids herkoppeld; (2) de NEVO-ronde over alle 1448 ids: 543 sure, 284 close, 621 none; (3) eindstand: 825 nevo, 254 usda, 369 schatting; dekking 99,8 %; de validator geeft 29 waarschuwingen (kcal met vezelenergie bij kruiden en zaden, zoals verwacht); (4) de verplichte RIVM-zin "Gebaseerd op gegevens van NEVO-online versie 2025/9.0, RIVM, Bilthoven en andere gegevens" staat onder Over, in de voetnoot en in de note van nutrition.json; (5) DEVICE-TEST rij 119 gebruikt ui (NEVO), kikkererwt (USDA) en speculaaskruiden (schatting); rij 118 houdt 900 kcal voor olijfolie (NEVO); (6) bouwerskeuzes bevestigd: gekookt +2, pot = blik, meervouden in de zoekvraag, diakrieten weg, toestand-voorrang, tabelregel zonder macro's geweigerd)

**Kritische lezer (Fable, vooraf).** (1) V9 gaf alle 1448 voedsel-ingrediënten waarden met `source: 'estimate'`; `apply-nutrition`
vervangt zo'n item al wanneer er een beter komt. Dit blok voegt twee bronnen toe en laat de rest staan: de UI, de drempel en de regel
op de receptpagina veranderen niet, alleen de getallen en de bronvermelding. (2) **USDA SR Legacy** (FoodData Central, release 04/2018,
7.793 producten, Amerikaanse overheidsdata) staat al klaar in `data/work/tables/usda/` (map in .gitignore): `food.csv` (fdc_id,
data_type, description, food_category_id), `nutrient.csv`, `food_nutrient.csv` (36 MB; fdc_id, nutrient_id, amount), `food_category.csv`
(28 categorieën). Nutriënt-ids: energie 1008 (kcal; 2047/2048 zijn de Atwater-varianten, 1062 kJ), eiwit 1003, vet 1004, koolhydraten
1005 (by difference, dus inclusief vezels — Amerikaanse conventie), vezels 1079, natrium 1093 (mg), alcohol 1018. De Foundation-download
van 10/2026 bevat geen food.csv/food_nutrient.csv meer (alleen monsters) en doen we niet. (3) **NEVO-online 2025/9.0** (RIVM) komt pas na
Stijns vinkje; het bestand (Excel of CSV) zet hij in `data/work/tables/nevo/`. Fable maakt er met een los python-script een genormaliseerde
CSV van; de tools kennen alleen die genormaliseerde vorm (§1a). NEVO-koolhydraten zijn exclusief vezels (Europese conventie), USDA
inclusief: de toepasser trekt bij USDA de vezels van de koolhydraten af, zodat `nutrition.json` één conventie houdt (exclusief, zoals
V9 al deed voor de kruiden). (4) De kcal van een tabel is gezaghebbend: de consistentieregel (kcal binnen 15 % van de macro's) blijft
een **fout** voor `estimate` en wordt een **waarschuwing** voor `usda`/`nevo` (vezels leveren 2 kcal/g, polyolen, enz.). (5) Rangorde:
`nevo` > `usda` > `estimate`; een item wordt vervangen als de nieuwe bron minstens even hoog staat (herhaald draaien verandert niets).
(6) Koppelen is het echte werk: een naamzoeker levert kandidaten, Sonnet kiest, en alleen `sure` en `close` worden toegepast; `none`
blijft schatting. Een "close" is dezelfde productfamilie in dezelfde toestand (generieke gerookte varkensworst voor rookworst), nooit
een ander product. (7) Rauw/droog zoals in het recept (V9 punt 4): USDA heeft per product vaak "raw", "cooked", "canned, drained solids";
de kandidatenlijst zet "raw" bovenaan en "cooked" onderaan, behalve voor ids die zelf een bereiding of blikvorm zijn (tomaten-uit-blik,
kikkererwt met defaultUnit blik → "canned, drained"). (8) Bronvermelding: USDA FoodData Central (U.S. Department of Agriculture,
Agricultural Research Service; SR Legacy 04/2018) en "NEVO-online versie 2025/9.0, RIVM, Bilthoven", in Over, in het handboek en in
`data/nutrition.json` zelf (`note`). (9) De licentie van NEVO eist ongewijzigd gebruik: we nemen de waarden per 100 g letterlijk over
(afgerond op één decimaal is de enige bewerking) en noemen versie en bron; de conventie-omrekening (3) raakt NEVO niet.

**Feitencheck (Fable, in de code).** `tools/apply-nutrition.ts` (V9): `checkBatchItem`, `applyNutritionItems`, `formatNutritionFile`,
`formatIngredientsFile`; vervangt een item alleen als het bestaande `source: 'estimate'` heeft; weigert `unitGrams.ml`. `tools/validate-data.ts`:
`checkNutritionItem` (kcal binnen max(15 %, 20 kcal) van 4P + 4C + 9F + 7A; som ≤ 101; `source` uit estimate|nevo|usda; onbekende sleutels =
fout), `validateNutrition(data, ingredientIds, nonFoodIds)`, `GRAMS_PER_RANGE`, `GRAMS_PER_ML_RANGE`. `src/domain/nutrition.ts`:
`NutritionItem { kcal, protein, fat, carbs, fibre, salt, alcohol?, source? }`. `data/nutrition.json`: `{ schema: 1, per: "100 g", note: {nl,en},
items: { id: {…} } }`, 1448 items, één per regel. `src/screens/DictionaryScreen.tsx` `EntryDetail`: regel `dict.per100` / `dict.per100Line`.
`src/screens/MoreScreen.tsx` Over: `<p class="muted small">{t('more.nutritionSource')}</p>`. i18n: `recipe.nutriNote` (browse.ts),
`more.nutritionSource` (settings.ts), `dict.per100*` (edit.ts). Handboek: `recepten.voedingswaarden` (02), `instellingen-en-opslag.voedingswaarden`
(08). DEVICE-TEST: rij 118 is de laatste; dit blok krijgt rij 119. `data/work/` staat in git (batches van fase 2); `data/work/tables/` niet
(.gitignore, 9 nov). Node 22 type-stripping: alleen type-syntax, plain ESM, geen enums.

## 1. Gedrag

### 1a. Tools en validator (bouwer A: `tools/nutrition-match.ts` [nieuw], `tools/apply-nutrition.ts`, `tools/validate-data.ts`,
`src/domain/nutrition.ts` (één veld), `package.json` (één script), `tests/nutrition-match.test.ts` [nieuw], `tests/validate-nutrition.test.ts`)

- `NutritionItem.ref?: string` — de code in de brontabel (USDA fdc_id, NEVO-code); alleen bij `source` usda/nevo. Validator: string,
  1–16 tekens, alleen bij een tabelbron. `checkNutritionItem(item)` geeft de kcal-afwijking als **waarschuwing** (apart veld of prefix
  `warn:`) wanneer `source` usda of nevo is, en als fout bij estimate of ontbrekend; `validateNutrition` telt de waarschuwingen in `warnings`.
- **Genormaliseerde tabel** (de enige vorm die de tools lezen): `data/work/tables/<bron>.csv` met kopregel
  `code,name,name2,category,kcal,protein,fat,carbs,fibre,sodium_mg,alcohol,state` — `name` = primaire naam (USDA: description; NEVO:
  Nederlandse naam), `name2` = tweede naam (USDA: leeg; NEVO: Engelse naam), `category` tekst, getallen per 100 g (leeg = onbekend),
  `state` = `raw` | `cooked` | `canned` | `dried` | `other` (afgeleid uit de naam: woorden raw/rauw, cooked/boiled/gekookt/bereid,
  canned/blik/drained, dried/dry/gedroogd). Eigen CSV-parser (aanhalingstekens, komma's in velden, CRLF), geen dependency.
- `tools/nutrition-match.ts`:
  - `--normalize usda`: leest `data/work/tables/usda/food.csv`, `food_nutrient.csv`, `food_category.csv`, schrijft `data/work/tables/usda.csv`
    (7.793 regels). Energie = nutriënt 1008, anders 2047, anders leeg. Categorieën "Branded Food Products Database", "Fast Foods",
    "Restaurant Foods", "Baby Foods", "Meals, Entrees, and Side Dishes", "Quality Control Materials", "American Indian/Alaska Native Foods"
    worden overgeslagen (merk- en maaltijdproducten koppelen nooit aan een ingrediënt). Streamt food_nutrient.csv regel voor regel (36 MB).
  - `--candidates <bron>`: leest `data/work/tables/<bron>.csv`, `data/ingredients.json` en `data/nutrition.json`; voor elk voedsel-ingrediënt
    (geen huishoudelijk/drogisterij) de acht beste kandidaten. Score (pure functie `scoreCandidate(query, row)`, met tests; herzien na de lens): tokens van onze
    Engelse naam + Engelse aliassen (voor NEVO ook de Nederlandse naam + aliassen) tegen de tokens van `name` en `name2` (kleine letters,
    splitsen op niet-letters, stopwoorden the/and/with/of/or/zonder/met en NEVO-vulwoorden gem/bereid/av weg, Engels enkelvoud: tomatoes →
    tomato, cherries → cherry): de delen zijn de komma-delen van `name` plus elk `;`-synoniem van `name2`; het hoofddeel is het deel met de
    meeste treffers (gelijk → het eerste); +3 per gedeeld token in het hoofddeel, +1 per gedeeld token elders, −2 per token van het hoofddeel
    dat NIET in de vraag zit; een kandidaat zonder enig token van de hoofdnaam (`anchors`: en.one, voor NEVO ook nl.one) valt af, net als een
    merkregel (een woord in HOOFDLETTERS: RED BULL, HEINZ); +2 voor `state` raw, −2 voor cooked,
    −1 voor canned en dried — tenzij de id-naam zelf blik/ingeblikt/uit-blik/gedroogd/gekookt bevat of `defaultUnit` blik/pot is, dan +2
    voor canned resp. dried en 0 voor raw. Gelijke score: kortere naam eerst. Schrijft `data/llm/nutrition/match-input-<bron>-NN.json`
    (80 ids per batch, op id): `{ "batch": "NN", "source": "<bron>", "items": [{ "id", "nl", "en", "aliasesEn": [], "defaultUnit", "aisle",
    "current": { "kcal", "protein", "fat", "carbs", "source" }, "candidates": [{ "code", "name", "category", "state", "kcal", "protein",
    "fat", "carbs" }] }] }`. Ids zonder enige kandidaat met score > 0 krijgen een lege lijst (Sonnet antwoordt dan `none`).
  - `package.json`: `"nutrition-match": "node --experimental-strip-types tools/nutrition-match.ts"`.
- `tools/apply-nutrition.ts --from-tables <bron>`: leest `data/work/tables/<bron>.csv` en alle `data/llm/nutrition/match-<bron>-NN.json`
  (`{ "batch", "source", "items": [{ "id", "choice": "<code>" | null, "confidence": "sure" | "close" | "none", "why" }] }`). Per item met
  `choice` en confidence sure/close: de tabelregel → `{ kcal, protein, fat, carbs, fibre, salt: sodium_mg × 2,5 / 1000, alcohol, source:
  <bron>, ref: code }`; bij `usda` `carbs = max(0, carbs − fibre)` (conventie, punt 3); ontbrekende kcal → 4P + 4C + 9F + 7A; ontbrekende
  vezels of natrium → 0 met een `note:`-regel in de uitvoer; één decimaal. Vervangen volgens de rangorde `estimate 0 < usda 1 < nevo 2`
  (nieuwe rang ≥ bestaande rang → vervangen; anders `kept`). Weigeren (met reden, zoals nu): code niet in de tabel, id geen voedsel,
  protein + fat + carbs + fibre > 101 na de omrekening, negatieve waarde. Schrijft `data/nutrition.json` in de bestaande stijl; raakt
  `data/ingredients.json` niet. De `note` in nutrition.json wordt: nl "Waarden per 100 g product zoals het in het recept staat (pasta en
  rijst droog). Bron per item: USDA FoodData Central SR Legacy (U.S. Department of Agriculture, 04/2018), NEVO-online versie 2025/9.0
  (RIVM, Bilthoven) of een schatting op dat niveau; nooit merkwaarden. Koolhydraten exclusief vezels." · en "Values per 100 g of the
  product as it appears in the recipe (pasta and rice dry). Source per item: USDA FoodData Central SR Legacy (U.S. Department of
  Agriculture, 04/2018), NEVO-online version 2025/9.0 (RIVM, Bilthoven) or an estimate at that level; never brand values. Carbohydrates
  exclude fibre." Samenvatting aan het eind: per bron aantal vervangen, gehouden, geweigerd, en hoeveel items nu per bron.
- Tests: `scoreCandidate` (de puntentelling hierboven met "onion"/"Onions, raw"/"Onions, spring or scallions, raw"/"Onions, cooked";
  blik-id met canned bovenaan), de CSV-parser (aanhalingstekens met komma, CRLF), `state` uit de naam, de rangorde (estimate → usda
  vervangt, usda → estimate niet, nevo over usda wel), de USDA-vezelomrekening, salt uit natrium, kcal uit macro's als de tabel leeg is,
  en de validator-wijziging (kcal-afwijking = waarschuwing bij usda, fout bij estimate; `ref` alleen bij een tabelbron).

### 1b. UI-teksten en handboek (bouwer B: `src/i18n/browse.ts`, `src/i18n/settings.ts`, `src/i18n/edit.ts`, `src/screens/DictionaryScreen.tsx`,
`data/handbook/02-recepten.json`, `data/handbook/08-instellingen-en-opslag.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md`)

- i18n, letterlijk (na de NEVO-voorwaarden, "Bronvermelding": de zin "Gebaseerd op gegevens van NEVO-online versie 2025/9.0, RIVM,
  Bilthoven en andere gegevens" is verplicht bij berekende output): `recipe.nutriNote` wordt "Gebaseerd op gegevens van NEVO-online versie
  2025/9.0, RIVM, Bilthoven en andere gegevens (USDA, schattingen); gemiddelde waarden per ingrediënt, niet van jouw merk. {counted} van de
  {total} regels geteld." · "Based on data from NEVO-online version 2025/9.0, RIVM, Bilthoven and other data (USDA, estimates); average values
  per ingredient, not your brand. {counted} of {total} lines counted."; `more.nutritionSource` wordt "Gebaseerd op gegevens van NEVO-online
  versie 2025/9.0, RIVM, Bilthoven en andere gegevens (USDA FoodData Central; een schatting waar geen tabel het product kent); nooit
  merkwaarden." · "Based on data from NEVO-online version 2025/9.0, RIVM, Bilthoven and other data (USDA FoodData Central; an estimate where no
  table knows the product); never brand values."; nieuw `dict.per100Source`: "Bron: {source}" · "Source: {source}"; `nutri.source.estimate`:
  "schatting" · "estimate"; `nutri.source.usda`: "USDA" · "USDA"; `nutri.source.nevo`: "NEVO (RIVM)" · "NEVO (RIVM)".
- DictionaryScreen `EntryDetail`: onder de regel Per 100 g dezelfde `dd` krijgt een tweede regel `<small>` met `dict.per100Source`
  (`nutri.source.<source>`, ontbrekende source = estimate).
- Handboek: in `recepten.voedingswaarden` de `know`-tekst nl "Het zijn gemiddelde waarden per ingrediënt uit de voedingstabellen van de
  Amerikaanse overheid (USDA) en het RIVM (NEVO), of een schatting op dat niveau, niet van jouw merk. Olie en marinade tellen helemaal mee,
  ook wat in de pan achterblijft. Kent de app minder dan de helft van de regels, dan staat er geen regel. Je zet de regel uit onder **Meer**
  → **Voedingswaarden**." · en "They are average values per ingredient from the food tables of the US government (USDA) and the RIVM
  (NEVO), or an estimate at that level, not your brand. Oil and marinade count in full, including what stays in the pan. If the app knows
  fewer than half of the lines, there is no line. You switch it off under **More** → **Nutrition**." In `instellingen-en-opslag.voedingswaarden`
  de `know`-tekst nl "De instelling gaat mee in je back-up. In het woordenboek blijven de waarden per 100 g zichtbaar, met de bron erbij
  (USDA, NEVO of schatting)." · en "The setting travels with your backup. In the dictionary the values per 100 g stay visible, with their
  source (USDA, NEVO or estimate)." Daarna `node --experimental-strip-types tools/handbook-md.ts`.
- DEVICE-TEST rij 119, NL én EN, in de stijl van rij 118: **Bron van de voedingswaarden (V9b).** 1. Tik op **Meer** → **Recepten & delen** →
  **Woordenboek**, zoek *ui* en tik erop; zoek daarna *rookworst* en tik erop. 2. Open het recept uit rij 118 en tik op de regel met kcal.
  3. Tik op **Meer** en kijk onder **Over**. 4. Zet de app op Engels en doe stap 1 en 3 nog eens. | 1. Onder Per 100 g staat bij ui een
  regel "Bron: USDA" (de waarden komen uit de Amerikaanse tabel: 40 kcal); bij rookworst staat "Bron: schatting" of, als de NEVO-tabel
  is ingelezen, "Bron: NEVO (RIVM)". 2. Onder het tabelletje staat nu "Gemiddelde waarden per ingrediënt uit de tabellen van USDA en NEVO,
  of een schatting; niet van jouw merk. … van de … regels geteld." 3. De bronregel noemt USDA FoodData Central en NEVO-online versie
  2025/9.0 (RIVM, Bilthoven). 4. In het Engels: "Source: USDA" / "Source: estimate", de voetnoot "Average values per ingredient from the
  USDA and NEVO tables, or an estimate; not your brand." en de Engelse bronregel onder **About**.

### 1c. De koppelronde (negentien Sonnet-agents, één per `match-input-usda-NN.json`; daarna de toepasser)

- Elke agent leest `data/llm/nutrition/match-input-usda-NN.json` en schrijft `data/llm/nutrition/match-usda-NN.json` (schema in §1a bij
  `--from-tables`). Per id precies één antwoord. Keuze: de kandidaat die hetzelfde product is in de toestand waarin het in een recept staat
  (rauw; pasta/rijst/peulvruchten droog, tenzij de id of defaultUnit blik zegt; "drained solids" voor blikproducten); `sure` als naam en
  toestand kloppen, `close` als het dezelfde productfamilie in dezelfde toestand is (een generieke worst voor rookworst, "Cheese, gouda"
  voor jonge kaas), `none` als geen kandidaat hetzelfde product is (dan `choice` null) — liever `none` dan een verkeerde buur; de
  `current`-waarden helpen als zeefje (een kandidaat met 3× de kcal van de schatting is meestal een ander product). `why` één korte regel.
  De agent draait geen tools en raakt alleen zijn eigen bestand.
- Toepasser (Opus): `npm run apply-nutrition -- --from-tables usda`, bekijkt de weigeringen en de `note:`-regels, draait `npm run
  validate:data`, `npm run measure-grams`, `npm test`, `npm run check`; schrijft in STATUS onder de V9b-kop één alinea "Koppelronde USDA"
  met: aantal sure/close/none, aantal vervangen items, hoeveel items nu per bron (usda/estimate), het aantal waarschuwingen van de
  validator, en vijf voorbeelden van `close`-koppelingen ter controle door Fable. Commit NIET.
- **NEVO (later, Fable zelf):** zodra het bestand in `data/work/tables/nevo/` staat: python-script → `data/work/tables/nevo.csv`
  (genormaliseerde vorm), `npm run nutrition-match -- --candidates nevo`, een Sonnet-ronde over `match-input-nevo-NN.json`, daarna
  `--from-tables nevo` (nevo wint van usda). Geen code-wijziging nodig; wel een STATUS-alinea en de rij 119-verwachting "Bron: NEVO (RIVM)".

## 2. Opus mag dit NIET zelf beslissen

- De puntentelling van de kandidaten en het aantal acht; de rangorde estimate < usda < nevo; vezels van de USDA-koolhydraten af, NEVO
  ongewijzigd; kcal-afwijking als waarschuwing bij tabelbronnen; één decimaal; `ref` als veld in het item (geen apart bestand).
- Geen UI-verandering behalve de teksten en de bronregel in het woordenboek; de drempel (50 %), de afronding en de receptregel blijven.
- Alleen `sure` en `close` toepassen; `none` blijft schatting. De CSV's blijven buiten git (`data/work/tables/`); de match-bestanden in
  `data/llm/nutrition/` gaan wél mee (reproduceerbaar zoals de vertaalbatches).
- Geen dependency; Node 22 type-stripping.

## 3. Bestandsverdeling

| Bouwer | Bestanden |
|---|---|
| A (tools) | `tools/nutrition-match.ts`, `tools/apply-nutrition.ts`, `tools/validate-data.ts`, `src/domain/nutrition.ts` (veld `ref`), `package.json` (script), `tests/nutrition-match.test.ts`, `tests/validate-nutrition.test.ts` |
| B (teksten + docs) | `src/i18n/browse.ts`, `src/i18n/settings.ts`, `src/i18n/edit.ts`, `src/screens/DictionaryScreen.tsx`, `data/handbook/02-recepten.json`, `data/handbook/08-instellingen-en-opslag.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md` (rij 119 NL + EN) |
| Integrator | samenvoegen, check/test/build/validate groen, `npm run nutrition-match -- --normalize usda` en `-- --candidates usda` draaien (de match-input-bestanden zijn de invoer van de koppelronde), acceptatie in de dev-app (woordenboekregel Bron, Over, voetnoot in NL/EN), `docs/STATUS.md`, de regel "Gebouwd" in deze spec |
| Koppel-agents | `data/llm/nutrition/match-usda-NN.json` (elk alleen het eigen bestand) |
| Toepasser | `data/nutrition.json` (via de tool), `docs/measure-grams.md`, STATUS-alinea "Koppelronde USDA" |

De koppelronde kan pas starten als de integrator de match-input-bestanden heeft gemaakt; de workflow van dit blok draait de bouwers, dan de
integrator, dan de negentien agents, dan de toepasser, dan lens en gate.
