# Spec 13E-bijgerechten — De 20 bijgerechten, volledig uitgeschreven

Status: compleet (Fable, 22 okt 2026)

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (besluiten over specs heen in
docs/specs/README.md §2; bij tegenspraak wint README.md). Voor deze spec:
- Bouwvolgorde: dit blok komt **ná 6B + 13E** (docs/specs/labels-categorieen.md, vijf blokken). Daardoor:
  (a) `DATA_VERSION` wordt hier **7 → 8** (niet 4 → 5; 6B neemt 5/6/7, 13F daarna 9) — overal in deze spec
  aangepast; (b) de categorie `bijgerecht` (order 13) en de vijf hercategorisaties bestaan al: dit blok raakt
  `data/categories.json` **niet**; (c) `NON_MAIN_CATEGORIES`, `isMainDish`, `excludeNonMain` en
  `applyPickFilter(…, { mainOnly })` + de chip `pick.all` bestaan al (6B blok 4) en dekken Kies N, Verras me,
  🎲, "Verras me · N" ín de Kies-sheet én de Home-dobbelsteen; **bouwer C bouwt géén eigen poolfilter** in
  WeekScreen/HomeScreen (§3 bouwer C, §4 stap 2, §5 punt 8 en §7 punt 7 zijn daarop aangepast). De
  feitencheck-⚠'s over de Kies-sheet en de Oven-chip zijn daarmee verwerkt (met `mainOnly` telt een
  Oven-chip niet als "ik wil bijgerechten").
- Het inbouwpad van deze spec (`data/source/bijgerechten.json` + `tools/sides.ts`) **is** het pad voor de
  20; labels-categorieen.md §2e verwijst er nu naar (geen `recipes-extra.json`, geen batch-21). Volgorde in
  `migrate()`: bron → batches → `applyReview` → **sides** → extras (13F) → `applyMeta` → `applyDerivedTags`
  → sorteren. Bouwer A voegt aan `data/review/meta.json` onder `cuisine` toe: `b:tzatziki` grieks,
  `b:guacamole` mexicaans, `b:focaccia-met-rozemarijn` italiaans, `b:couscous` marokkaans (6B §2e).
- `checkSides(file, classics, dict)` krijgt als `classics` het gecommitte recipes.json **zonder** de ids uit
  het sides-bestand zelf (anders vuurt de botsingsregel na de eerste migrate op alle 20).
- tests/diet.test.ts ("three quarters") filtert voortaan op `createdAt === BUILTIN_TIMESTAMP` (import uit
  `../tools/migrate-from-recepten2.ts`, zoals migrate.test.ts dat al doet); bouwer B bezit dat testbestand.
- Niet-bijgewerkte telefoon ontvangt een `b:`-id dat hij nog niet heeft → "Nieuw" + ontvangen kopie onder
  het b:-id (bestaand gedrag). Opruimen gebeurt in 13F blok 3: `ensureBuiltins` verwijdert bij een
  versiewissel elke `userRecipes`-rij met een ingebouwd id waarvan `contentFingerprint` gelijk is aan de
  ingebouwde; een afwijkende kopie blijft staan (overschaduwt, gedocumenteerd). §1/§5 zeggen dat nu.
- Badges "Het hele boek"/"Halverwege het boek" tellen na dit blok 216/108 en na 13F 236/118
  (`classicsTotal` volgt de bundel). DEVICE-TEST-rij is definitief **81**.
- De twee open vragen voor Stijn blijven (tellen de 20 mee als klassieker — standaard ja; direct naar
  main — standaard ja).

Feitencheck Opus, 22 okt 2026: 26 correcties (⚠ = keuze blijft staan, rust op een verkeerd feit)
- Nagerekend en juist: alle 20 blokken (20 recepten, 127 regels, 66 stappen; NL+EN zelfde `ing`,
  confidence 1; ids = `builtinId(name.nl)`; alle `goesWith`-ids bestaan; tags ⊂ `RECIPE_TAGS`; dieetlabels
  zoals in §2g; 18 met timer), golden 1377 → 1443, 1900 → 2027, Dexie v7, `DATA_VERSION` 4, i18n-keys.
- §1 tijdregel: "10 min **bezig** · 20 min totaal" (`recipe.timeActive`), niet "actief".
- §1 Boodschappen: water (2 regels) heeft gangpad `overig` en komt als staple ≥ 250 ml onder Overig.
- §1/§2f/§6d.8/§8: de badges heten "Het hele boek" (`allClassics`) en "Halverwege het boek"
  (`halfClassics`), niet "Alle klassiekers" / "De helft van de klassiekers".
- §1/§6d.9: de status heet "Heb je al" / "Already have it" (`inbox.status.present`), niet "staat er al".
- ⚠ §1/§5: merge.ts regel 346 geldt alleen als het recept er al is; een niet-bijgewerkte telefoon krijgt
  "Nieuw" en bewaart een ontvangen kopie onder het `b:`-id (die later de ingebouwde overschaduwt).
- ⚠ §1/§3 C: "Verras me · N" ín de Kies-N-sheet heeft een eigen pool (PickSheet.tsx regel 251) en wordt
  door de filter op WeekScreen regel 88 niet geraakt.
- ⚠ §3 C: een categoriechip matcht ook een tag met hetzelfde id; met chip Oven komen 5 bijgerechten mee.
- §2a: migrate.test.ts vergelijkt `recipes` deep-equal + `dataVersion`, niet byte-gelijk.
- ⚠ §2a/§3/§6d.1: er is een vijfde bestaand bijgerecht, Polenta (voor ratatouille); "+4/24" → "+5/25".
- ⚠ §2c: `description` wordt wél getoond (src/landing.ts, src/domain/message.ts); alle 196 hebben er een.
- ⚠ §2d: `sourceLines` voedt ook tools/measure-resolution.ts en data/work/name-parts.json.
- ⚠ §2d: validate-data `main()` heeft geen `Dictionary` (alleen `dictData`); het gecommitte recipes.json
  bevat na migrate de 20 zelf, dus als `classics` doorgeven laat de id-botsingsregel vuren.
- §2d: in data/README.md is review stap 4; de bijgerechten worden stap 4½, niet 3½.
- §3 B: derive-tags ↔ migrate is geen statische kring (dynamische `import()` in `main()`).
- §3 C: de dobbelsteen-pool staat in HomeScreen.tsx regel **92**, niet 91.
- §3 C: "guac" vindt guacamole via de gewone deeltekst-match, niet via de 4-letter-prefixregel.
- §3 Integrator: de migrate-uitvoer toont `2010 ingredient lines + 17 headers` (2027 is mét koppen).
- ⚠ §6b: tests/diet.test.ts ("three quarters" categorie-overeenkomst) zakt naar 153/216 = 0,71 en breekt.
- §6d.1: met een chip aan is de lijst plat, zonder letterrail.
- §6d.2/§6e: NL-naam is "Penne all’ arrabbiata"; "Bij dit gerecht" staat alfabetisch in de app-taal.
- §6d.3: "rode kool" is groen in stap 2 (stap 3 heeft alleen de timer).
- §6d.6: peterselie wordt niet opgeteld (7 g + 2 el blijven twee regels); knoflook wel (5 teentjes).
- §6d.7: het menu heet "Opslag & back-up".
- §6e EN: A–Z begint bij "Baguette with herb butter", niet bij "Coleslaw".
- §6e: de knop in de Kies-sheet is `pick.surprise` ("Verras me · 7").
- §8 vraag 1: `BUILTIN_TIMESTAMP` bestaat alleen in tools/, niet in src/.

Bron: docs/phase-6-spec.md 13E (antwoord Stijn 13 okt 2026: categorie **Bijgerecht**; "Fable schrijft 20
gewone bijgerechten, eigen tekst, NL+EN"; naanbrood bestaat al → focaccia), CLAUDE.md-invarianten 1–3 en
15, data/README.md (recipes.json is gegenereerd, nooit met de hand bewerkt), tools/migrate-from-recepten2.ts,
tests/migrate.test.ts en tests/parser.golden.test.ts. De 20 recepten zijn eigen tekst van Fable (22 okt 2026),
geen kopieën van websites; elke ingrediëntregel is op 22 okt met de echte parser en het woordenboek van
1603 ingrediënten gecontroleerd (alle 127 regels resolven, NL én EN, confidence 1). Alles wat een keuze
is, staat hier gekozen; bij twijfel §5.

## 1. Doel en gebruikersgedrag

**In één zin:** de app krijgt 20 ingebouwde, tweetalige bijgerechten in de categorie **Bijgerecht**
(stokbrood met kruidenboter, knoflookbrood, drie salades, coleslaw, puree, krieltjes, frietjes,
aardappelpartjes, rijst, couscous, broccoli, sperziebonen, gegrilde groenten, worteltjes, rode kool,
tzatziki, guacamole, focaccia), die zich overal gedragen als klassiekers, behalve dat "Verras me" en
Kies 7 ze nooit als avondmaal kiezen.

**Recepten (`#/recipes`).** Na de update staan de 20 tussen de klassiekers (A–Z, letterrail, zoeken) en
onder de chip **Bijgerecht** / **Side dish** (categorienaam uit data/categories.json; geen i18n-key).
Zoeken op "patat", "friet", "frietjes" vindt Ovenfrietjes; "koolsalade" vindt Coleslaw (spelling-
varianten in src/domain/search.ts). Zoeken op een ingrediënt werkt in beide talen via de gestructureerde
regels ("sesame" → Gestoomde broccoli). Lege staten en foutmeldingen: geen nieuwe (data, geen flow).

**Receptpagina (`#/recipe/b:knoflookbrood`).** Precies als een klassieker: naam in de app-taal, tijd
("10 min bezig · 20 min totaal", keys `recipe.timeActive` / `recipe.timeTotal`), ingrediënten per 4 personen met schaalknop, bereiding met timerchips
(**⏱ 10 min**), 13I-markering van ingrediënten in de stappen, ★ favoriet, ✓ Gekookt, foto's, delen,
"Maak eigen kopie". Nieuw zichtbaar: onder **Bij dit gerecht** / **Goes with** (bestaande key
`recipe.goesWith`) staan de hoofdgerechten uit `goesWith`, en op de pagina van zo'n hoofdgerecht staat
het bijgerecht terug (RecipeScreen.tsx regel 382 kijkt in beide richtingen). De Engelse editie krijgt
géén hint "machinevertaling": de tekst is door een mens geschreven (`text.en = 'human'`).

**Kookstand.** Werkt zonder aanpassing: timers ("Kook 12 minuten", "een half uur", "1 uur") worden
herkend; "hoeveel?" (Android) leest de hoeveelheden voor; voorlezen in beide talen.

**Week (`#/week`).** **Verras me** / **Surprise me** en de 🎲 per plek kiezen alleen hoofdgerechten:
een recept met categorie `bijgerecht` (en straks nagerecht/gebak/ontbijt-lunch uit de labels-spec) komt
niet in de pool. In de Kies-N-sheet staan ze gewoon in de lijst (aanvinken mag altijd), en wie daar de
chip **Bijgerecht** aanzet en dan Verras me tikt, krijgt juist bijgerechten (hij vraagt erom). Op Home
geldt hetzelfde voor de dobbelsteen. Geen nieuwe tekst: wie een bijgerecht wil, zoekt of vinkt het aan.
"+ bijgerecht" per gerecht in de weekplanner is de labels-spec (13E), niet deze.
Besluit (kritische lezer): de pool wordt gefilterd door `applyPickFilter(…, { mainOnly: true })` uit 6B
blok 4 (labels-categorieen.md §2d/§3), dat ook "Verras me · N" ín de Kies-N-sheet en de Home-dobbelsteen
bedient; de chip `pick.all` ("ook bijgerechten & zoet") of een categoriechip Bijgerecht heft het op. Dit
blok bouwt daar niets aan.

**Boodschappen.** Een bijgerecht in het weekplan telt mee als elk recept: regels worden per ingrediënt
samengevoegd (knoflook van het knoflookbrood bij de knoflook van de bolognese), gangpaden uit het
woordenboek, "in huis" werkt. Alle 127 regels zijn geresolved. Eén uitzondering op "nooit onder Overig":
**water** (`450 ml water` bij Witte rijst, `350 ml water` bij Focaccia) heeft in data/ingredients.json
`aisle: "overig"` en `staple: true`; vanaf 250 ml (`STAPLE_THRESHOLD`, src/domain/aggregate.ts) gaat het
van Voorraad naar de lijst en staat dan onder **Overig** (gecontroleerd met `aggregate` + `groupByAisle`).

**Badges.** "Het hele boek" / "The whole book" (`het-hele-boek`, regel `allClassics`) en "Halverwege
het boek" / "Halfway through the book" (`halverwege-het-boek`, regel `halfClassics`) in data/badges.json
tellen voortaan 216 en 108 (de bijgerechten zijn ingebouwd en tellen dus mee). Wie "Halverwege het boek"
al had, houdt hem (`badges.earned`).

**Delen en ontvangen.** Een gedeeld bijgerecht reist als recept met `b:`-id. Een telefoon met deze
update heeft het al ("Heb je al" / "Already have it", `inbox.status.present`). Een telefoon die nog
**niet** is bijgewerkt zegt bij een binnenkomend `b:`-id **niet** "Heb je al": src/domain/merge.ts
regel 346 geldt alleen binnen `if (existing)`; zonder eigen exemplaar geeft `planRecipe` status `'new'`
("Nieuw", regel 365) en `applyImportPlan` (src/db/repo.ts) schrijft het als ontvangen recept in
`db.userRecipes` onder hetzelfde `b:`-id. Het is dan wél te openen; na de update wint die ontvangen kopie
van de ingebouwde (`allRecipes`: "a user recipe with a builtin id would win"; `getRecipe` leest eerst
`userRecipes`) — beide telefoons eerst bijwerken ("Nieuwe versie — vernieuwen").
Besluit (kritische lezer): dit blok verandert er niets aan. 13F blok 3 ruimt het op: `ensureBuiltins`
verwijdert bij een versiewissel elke `userRecipes`-rij met een ingebouwd id waarvan `contentFingerprint`
gelijk is aan de ingebouwde (de ontvangen kopie was identiek); een afwijkende kopie blijft staan en
overschaduwt (bekende beperking, in STATUS.md noemen). Tot 13F: beide telefoons eerst bijwerken.

**iPhone vs Android.** Geen verschil: data en een poolfilter. Spraakcommando's blijven alleen Android.

**Teksten.** Alle gebruikersteksten van dit blok zijn de recepten zelf (NL + Brits-Engels, §2g) en de
categorienaam **Bijgerecht / Side dish** uit data/categories.json. Er komen **geen nieuwe i18n-keys**.

## 2. Datamodel en migraties

### 2a. Inbouwpad: een tweede bronbestand, ingelezen door de bestaande migratie (gekozen)
`data/recipes.json` is gegenereerd ("do not edit by hand", data/README.md): `tests/migrate.test.ts` eist
dat het bestand inhoudelijk gelijk is aan `migrate()` over de bronnen (`recipes` deep-equal en
`dataVersion` gelijk; `generatedAt` telt niet), en golden fixture, validator en
`DATA_VERSION` hangen aan diezelfde pijplijn. Daarom:
- **Gekozen:** nieuw, met de hand geschreven bronbestand **`data/source/bijgerechten.json`** (de 20 blokken
  van §2d, letterlijk), plus een nieuwe module **`tools/sides.ts`** die het bestand controleert en per
  recept `parseLine(nl, dict, 'nl')` doet. `tools/migrate-from-recepten2.ts` leest het als vierde
  invoer en plakt de 20 achter de 196; daarna de bestaande stappen (dieetlabels afleiden, sorteren).
  `npm run migrate` blijft dus de enige weg naar recipes.json.
- **Afgewezen:** een los `tools/add-recipes.ts` dat direct in recipes.json schrijft: `npm run migrate` zou
  de 20 bij de volgende run weer wissen en de migrate-test zou rood staan. Ook afgewezen: de 20 in
  `data/source/recipes-recepten2.json` zetten (read-only export, kent geen Engels en geen structuur) of
  via een LLM-batch (de tekst is al door een mens geschreven en gecontroleerd).
- De bestaande vier bijgerechten (Aardappelpuree, Rucola-spinaziepesto, Tomatensalsa, Naanbrood) krijgen
  hun categorie `bijgerecht` in de **labels-spec** (6B + 13E), niet hier. Deze spec raakt geen bestaande
  recepten.
  ⚠ Feitencheck: er is een **vijfde** bestaand bijgerecht: "Polenta (voor ratatouille)"
  (`b:polenta-voor-ratatouille`, nu `overig`, `goesWith: []`); docs/specs/labels-categorieen.md telt er
  ook vijf. Waar deze spec "+4" / "24" zegt (§3 Integrator 5, §6d.1), wordt het dan "+5" / "25".

### 2b. Het bronbestand `data/source/bijgerechten.json`
```ts
// tools/sides.ts — types (Node 22 type-stripping: alleen type-syntax, .ts-extensies in imports)
export interface SideSourceText { nl: string; en: string }           // beide verplicht, niet leeg
export interface SideSource {
  /** 'b:' + slugId(name.nl) op het moment van schrijven. Daarna NOOIT meer wijzigen (invariant 1). */
  id: string;
  name: SideSourceText;
  time: { active: number; total: number };                          // minuten, > 0, active <= total
  /** Subset van RECIPE_TAGS zónder de dieetlabels: die leidt derive-tags af. */
  tags: string[];
  /** 1..3 ids van bestaande klassiekers (hoofdgerechten waar dit bijgerecht bij past). */
  goesWith: string[];
  /** Ingrediëntregels in app-formaat "hoeveelheid eenheid naam [bereiding] (notitie)"; en = vertaling. */
  lines: SideSourceText[];
  /** 3..6 korte stappen; tijden als "Kook 12 minuten" (timer-herkenning via findTimers op nl). */
  steps: SideSourceText[];
}
export interface SidesFile { schema: 'sides-1'; author: string; written: string; recipes: SideSource[] }
```
Bestand: `{ "schema": "sides-1", "author": "Fable", "written": "2026-10-22", "recipes": [ …20 blokken… ] }`.

### 2c. Wat er van wordt gemaakt (`sideToRecipe`)
```ts
export const SIDE_CATEGORY = 'bijgerecht';
/** "Tweede druk": aanmaakdatum van de 20 (deterministisch, net als BUILTIN_TIMESTAMP). */
export const SIDES_TIMESTAMP = '2026-10-22T00:00:00.000Z';
export function readSides(root: string): SidesFile | null;        // null als het bestand ontbreekt
export function checkSides(file: unknown, classics: readonly Recipe[], dict: Dictionary): string[];
export function sideToRecipe(s: SideSource, dict: Dictionary): Recipe;
export function sidesToRecipes(file: SidesFile, dict: Dictionary): Recipe[];
```
`sideToRecipe` levert exact dit `Recipe` (src/domain/model.ts), in deze sleutelvolgorde:
```ts
{ schema: 2, id: s.id, rev: 1, createdAt: SIDES_TIMESTAMP, updatedAt: SIDES_TIMESTAMP,
  origin: { kind: 'builtin' }, name: { nl, en }, tags: [...s.tags], servings: 4,
  time: { active, total }, category: 'bijgerecht',
  lines: s.lines.map((l) => ({ ...parseLine(l.nl, dict, 'nl'), raw: { nl: l.nl, en: l.en } })),
  steps: s.steps.map((st) => { const timers = findTimers(st.nl);
           return timers.length ? { text: { nl: st.nl, en: st.en }, timers } : { text: { nl: st.nl, en: st.en } }; }),
  goesWith: [...s.goesWith], aliases: [], text: { en: 'human' } }
```
Geen `description`, geen `servingTip` (niets in de UI toont `description`; niet verzinnen).
⚠ Feitencheck: RecipeScreen toont `description` inderdaad niet, maar de Safari-viewer
(src/landing.ts regel 250) en de deeltekst (src/domain/message.ts regel 192) tonen hem wél, en alle 196
klassiekers hebben er een (`description {nl, en}` in data/recipes.json). De keuze "geen description"
blijft staan; gevolg: een gedeeld bijgerecht heeft in WhatsApp/Safari geen omschrijvingsalinea. `text.en =
'human'`: de Engelse tekst is door een mens geschreven, dus RecipeScreen toont géén "machinevertaling"-
hint (`machineEn` kijkt op `=== 'llm'`). `raw` krijgt **beide talen**: de parser zet `raw: { nl }`, de
tool voegt `en` toe (zoeken leest `raw.en`, src/domain/search.ts regel 85; de weergave blijft de
gestructureerde regel via `renderLine`). Een regel die eindigt op `:` is een kop (`kind: 'header'`) —
komt in deze 20 niet voor.

`checkSides` geeft fouten (de migratie gooit dan, zoals bij een kapotte batch) bij: `schema !== 'sides-1'`;
een id dat niet op `/^b:[a-z0-9-]+$/` past; dubbel id; id gelijk aan een klassieker; `name.nl`/`name.en`
leeg; `time.active > time.total` of ≤ 0; een tag buiten `RECIPE_TAGS` of een dieettag (`vegetarisch`,
`vegan`, `glutenvrij`, `*-optie`) in `tags`; `goesWith` leeg, > 3, onbekend id of het eigen id; minder dan
1 regel of een regel zonder `nl` of `en`; minder dan 3 of meer dan 6 stappen of een stap zonder `nl`/`en`.
**Niet** een fout: een regel die de parser niet resolvet (dat bewaakt de test, met uitzonderingslijst).

### 2d. Wijzigingen in de pijplijn
- `tools/migrate-from-recepten2.ts`: `DATA_VERSION` **7 → 8** (elke telefoon laadt de bundel opnieuw via
  `ensureBuiltins`; favorieten, kooklog, overrides en instellingen blijven staan — zelfde mechanisme als
  3 → 4 op 8 okt). `MigrationInputs` krijgt `sides?: SidesFile | null`; `loadMigrationInputs` vult het met
  `readSides(root)`. In `migrate()` ná `applyReview` en vóór `applyMeta` (6B; die zet de keuken van vier
  bijgerechten) en `applyDerivedTags`:
  `if (inputs.sides) { const errs = checkSides(inputs.sides, recipes, dict); if (errs.length) throw …;
  recipes = recipes.concat(sidesToRecipes(inputs.sides, dict)); }`. De sortering op `name.nl` zet ze
  vanzelf tussen de klassiekers. Kopcommentaar van het bestand bijwerken (vier invoeren; 13F maakt er
  later vijf van met `extras`).
- `tools/build-dictionary-seed.ts` `sourceLines(root)`: ook de `nl`-regels van bijgerechten.json
  (bestand aanwezig → `concat`). Daarmee dekt de golden fixture ze automatisch; `gen-golden.ts` zet
  `source: 'data/source/recipes-recepten2.json + data/source/bijgerechten.json'`. Verwacht na
  hergenereren: 1377 → **1443** unieke regels (66 nieuw), resolutie blijft > 0,95 (alle 66 resolven).
  ⚠ Feitencheck: `sourceLines` wordt ook gebruikt door tools/measure-resolution.ts (regel 135) en door
  `main()` van build-dictionary-seed.ts zelf (data/work/name-parts.json); die uitvoer verandert dus mee
  als ze opnieuw draaien. tools/measure-parse.ts gebruikt `sourceLines` niet (leest de bron zelf).
- `tools/validate-data.ts` `main()`: na de bron-export ook `data/source/bijgerechten.json` lezen en
  `checkSides(file, recipesFromCommittedJson, dict)` draaien; print `"20 side dishes, 127 lines"`;
  fouten → exit 1. `validateSchema2` hoeft niets nieuws: `text.en` met `name.en` + alle `steps[].text.en`
  aanwezig, `category` bestaat (zie 2e), tags binnen `RECIPE_TAGS`, `goesWith`-ids bestaan.
  ⚠ Feitencheck: (a) `main()` van validate-data.ts heeft alleen `dictData` (`DictionaryData`), geen
  `Dictionary`; `checkSides` vraagt een `Dictionary`, dus daar is `loadDictionary(dictData)` nodig
  (validate-data.ts importeert uit dictionary.ts nu alleen `normalizeKey` en `type DictionaryData`). (b) Na `npm run migrate`
  staan de 20 zelf in het gecommitte data/recipes.json; geef je dát als `classics` mee, dan vuurt de regel
  "id gelijk aan een klassieker" voor alle 20. **Besluit:** `classics` = het gecommitte bestand zonder de ids
  uit het sides-bestand (`recipes.filter((r) => !sideIds.has(r.id))`); zo blijft de botsingsregel werken
  voor alle andere recepten (ook de 13F-klassiekers later).
- `tools/measure-parse.ts` en docs/measure-parse.md: **ongewijzigd** (meting van de Recepten2-export);
  wel draaien als regressiecheck (uitvoer identiek).
- `data/README.md`: rij voor `source/bijgerechten.json` en `tools/sides.ts`; `dataVersion`-alinea:
  "version 8 = the 20 side dishes (phase 6, 13E, October 2026)"; in de compositie-lijst stap 4½ "sides"
  (in data/README.md is stap 3 = LLM batches en stap 4 = review; de bijgerechten komen ná review).

### 2e. Categorie `bijgerecht`
Bestaat al als dit blok start: 6B blok 4 (labels-categorieen.md §2d) voegde `{ "id": "bijgerecht",
"nl": "Bijgerecht", "en": "Side dish", "order": 13 }` toe en zette de vijf bestaande bijgerechten erin.
Dit blok raakt `data/categories.json` niet. Geen i18n-key: categorienamen komen uit dit bestand
(`categoryLabel`, src/components/FilterChips.tsx). Ontbreekt de categorie toch (6B niet gebouwd), dan
stopt de bouw en meldt Opus dat; niet zelf toevoegen.

### 2f. Wat NIET verandert
- **Dexie blijft v7**; geen tabel, geen settings-key. De 20 zitten in `builtins` zoals de 196.
- **Deelformaat ongewijzigd**: `raw` is al `Text` (`{nl, en}`); `normalizeRecipe` bewaart het
  (recipe-io.ts `readLine` → `readText(v.raw)`). Geen nieuw fragment, geen nieuwe bevroren tokens.
- **Back-up**: builtins reizen niet mee (`exportBundle` laat `builtins` en `dataVersion` weg); na herstel
  seedt `ensureBuiltins` ze uit de bundel. Overrides op klassiekers (`db.overrides`) raken ze niet.
- **Badges**: `classicsTotal` telt builtins (src/badges.ts regel 68) en wordt 196 → **216** (na 13F 236);
  doelen "Het hele boek" (`allClassics`) 216 en "Halverwege het boek" (`halfClassics`) 108 (na 13F
  236/118). Al verdiende badges blijven (`badges.earned`). Besluit: de bijgerechten tellen als klassieker
  (ze zijn ingebouwd; "alle klassiekers" = alles wat de app meebrengt).
- **Planner**: `isMainDish`/`NON_MAIN_CATEGORIES` en de poolfilter `mainOnly` bestaan al (6B blok 4);
  dit blok voegt daar niets aan toe.

### 2g. De 20 bijgerechten (letterlijk overnemen in `data/source/bijgerechten.json` → `recipes`)
Elke regel is op 22 okt 2026 met de echte parser gecontroleerd: NL én EN resolven naar hetzelfde
ingrediënt-id, confidence 1, alle `[bereiding]`-woorden staan in prep-phrases.json, `(optioneel)` en
`(lauwwarm)` worden notitie/optioneel. De regel "Afgeleide dieetlabels" is wat `applyDerivedTags` erbij
zet (test 6a-5 controleert dit); `tags` in het blok bevat ze dus NIET. Teksten niet "verbeteren"
(zie §5). `servings` is altijd 4 en staat niet in het blok (`sideToRecipe` zet het).

**1. Stokbrood met kruidenboter / Baguette with herb butter** — past bij soep, salades, bbq en pasta. Afgeleide dieetlabels: vegetarisch.
```json
{ "id": "b:stokbrood-met-kruidenboter", "name": {"nl":"Stokbrood met kruidenboter","en":"Baguette with herb butter"},
  "time": {"active":10,"total":25}, "tags": ["snel","oven","zomer"],
  "goesWith": ["b:goulash-maaltijdsoep","b:hamburgers-voor-op-de-bbq","b:salade-nicoise"],
  "lines": [
    {"nl":"1 stokbrood","en":"1 baguette"},
    {"nl":"125 g boter [op kamertemperatuur]","en":"125 g butter [at room temperature]"},
    {"nl":"2 teentjes knoflook [geperst]","en":"2 cloves garlic [crushed]"},
    {"nl":"3 el peterselie [fijngehakt]","en":"3 tbsp parsley [finely chopped]"},
    {"nl":"1 el bieslook [fijngeknipt]","en":"1 tbsp chives [finely snipped]"},
    {"nl":"rasp van ½ citroen","en":"zest of ½ lemon"},
    {"nl":"½ tl zout","en":"½ tsp salt"}
  ],
  "steps": [
    {"nl":"Verwarm de oven voor op 180 °C. Roer de zachte boter los met de knoflook, peterselie, bieslook, citroenrasp en het zout.","en":"Preheat the oven to 180°C. Beat the soft butter with the garlic, parsley, chives, lemon zest and salt."},
    {"nl":"Snijd het stokbrood schuin in plakken, maar niet helemaal door. Smeer tussen elke plak een beetje kruidenboter.","en":"Cut the baguette diagonally into slices without cutting all the way through. Spread a little herb butter between the slices."},
    {"nl":"Wikkel het brood in aluminiumfolie en bak het 10 minuten in de oven. Vouw de folie open en bak nog 3 minuten tot de korst knapperig is.","en":"Wrap the bread in foil and bake for 10 minutes. Open the foil and bake for another 3 minutes until the crust is crisp."},
    {"nl":"Serveer warm. De kruidenboter blijft een week goed in de koelkast.","en":"Serve warm. The herb butter keeps for a week in the fridge."}
  ] }
```

**2. Knoflookbrood / Garlic bread** — past bij pasta, lasagne en ovenschotels. Afgeleide dieetlabels: vegetarisch.
```json
{ "id": "b:knoflookbrood", "name": {"nl":"Knoflookbrood","en":"Garlic bread"},
  "time": {"active":10,"total":20}, "tags": ["snel","oven","kids"],
  "goesWith": ["b:spaghetti-bolognese","b:klassieke-lasagne","b:penne-all-arrabbiata"],
  "lines": [
    {"nl":"1 ciabatta","en":"1 ciabatta"},
    {"nl":"100 g boter [op kamertemperatuur]","en":"100 g butter [at room temperature]"},
    {"nl":"3 teentjes knoflook [geperst]","en":"3 cloves garlic [crushed]"},
    {"nl":"2 el peterselie [fijngehakt]","en":"2 tbsp parsley [finely chopped]"},
    {"nl":"1 snufje zout","en":"1 pinch salt"},
    {"nl":"50 g geraspte kaas (optioneel)","en":"50 g grated cheese (optional)"}
  ],
  "steps": [
    {"nl":"Verwarm de oven voor op 200 °C. Meng de boter met de knoflook, peterselie en het zout.","en":"Preheat the oven to 200°C. Mix the butter with the garlic, parsley and salt."},
    {"nl":"Snijd de ciabatta in de lengte doormidden en besmeer beide helften dik met de knoflookboter. Strooi er eventueel de kaas over.","en":"Cut the ciabatta in half lengthways and spread both halves thickly with the garlic butter. Sprinkle over the cheese if using."},
    {"nl":"Bak 10 minuten in de oven tot de randen goudbruin zijn. Snijd in stukken en serveer meteen.","en":"Bake for 10 minutes until the edges are golden. Cut into pieces and serve straight away."}
  ] }
```

**3. Groene salade / Green salad** — past bij hartige taart, quiche, gevuld stokbrood en ovenschotels. Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:groene-salade", "name": {"nl":"Groene salade","en":"Green salad"},
  "time": {"active":10,"total":10}, "tags": ["snel","zomer"],
  "goesWith": ["b:quiche-lorraine","b:kaastaart","b:gevuld-stokbrood"],
  "lines": [
    {"nl":"1 krop sla","en":"1 head lettuce"},
    {"nl":"½ komkommer [dunne plakjes]","en":"½ cucumber [thinly sliced]"},
    {"nl":"1 avocado [blokjes]","en":"1 avocado [diced]"},
    {"nl":"4 bosuitjes [ringetjes]","en":"4 spring onions [sliced into rings]"},
    {"nl":"3 el olijfolie","en":"3 tbsp olive oil"},
    {"nl":"1 el witte wijnazijn","en":"1 tbsp white wine vinegar"},
    {"nl":"1 tl mosterd","en":"1 tsp mustard"},
    {"nl":"½ tl honing","en":"½ tsp honey"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Was de sla, slinger hem droog en scheur de bladeren in stukken.","en":"Wash the lettuce, spin it dry and tear the leaves into pieces."},
    {"nl":"Klop de olijfolie, azijn, mosterd en honing met zout en peper tot een dressing.","en":"Whisk the olive oil, vinegar, mustard and honey with salt and pepper into a dressing."},
    {"nl":"Meng de sla met de komkommer, avocado en bosui. Schep de dressing er vlak voor het serveren door.","en":"Toss the lettuce with the cucumber, avocado and spring onion. Stir in the dressing just before serving."}
  ] }
```

**4. Komkommersalade / Cucumber salad** — past bij vis, gehakt en bbq. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:komkommersalade", "name": {"nl":"Komkommersalade","en":"Cucumber salad"},
  "time": {"active":10,"total":25}, "tags": ["snel","zomer","kids"],
  "goesWith": ["b:hamburgers-voor-op-de-bbq","b:gehaktballetjes-in-dille-yoghurt-saus","b:afwasmachinezalm"],
  "lines": [
    {"nl":"1 komkommer [dunne plakjes]","en":"1 cucumber [thinly sliced]"},
    {"nl":"3 el witte wijnazijn","en":"3 tbsp white wine vinegar"},
    {"nl":"1 el suiker","en":"1 tbsp sugar"},
    {"nl":"½ tl zout","en":"½ tsp salt"},
    {"nl":"2 el dille [fijngehakt]","en":"2 tbsp dill [finely chopped]"},
    {"nl":"versgemalen peper","en":"freshly ground pepper"}
  ],
  "steps": [
    {"nl":"Meng de azijn met de suiker en het zout tot de suiker is opgelost.","en":"Mix the vinegar with the sugar and salt until the sugar has dissolved."},
    {"nl":"Schep de komkommer en de dille erdoor en maal er wat peper over.","en":"Stir in the cucumber and dill and grind over some pepper."},
    {"nl":"Laat 15 minuten staan in de koelkast. Schep nog eens om en serveer koud.","en":"Leave in the fridge for 15 minutes. Toss once more and serve cold."}
  ] }
```

**5. Tomatensalade / Tomato salad** — past bij pasta, hartige taart en ovenschotels. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:tomatensalade", "name": {"nl":"Tomatensalade","en":"Tomato salad"},
  "time": {"active":10,"total":20}, "tags": ["snel","zomer"],
  "goesWith": ["b:tortellini-al-gratin","b:quiche-met-kip","b:macaroni-ham-kaas"],
  "lines": [
    {"nl":"500 g tomaten [partjes]","en":"500 g tomatoes [in wedges]"},
    {"nl":"1 rode ui [in halve ringen]","en":"1 red onion [in half rings]"},
    {"nl":"3 el olijfolie","en":"3 tbsp olive oil"},
    {"nl":"1 el balsamicoazijn","en":"1 tbsp balsamic vinegar"},
    {"nl":"1 handje basilicum","en":"1 handful basil"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Leg de tomaten en ui op een platte schaal.","en":"Arrange the tomatoes and onion on a flat dish."},
    {"nl":"Besprenkel met de olijfolie en balsamicoazijn en bestrooi met zout en peper.","en":"Drizzle with the olive oil and balsamic vinegar and season with salt and pepper."},
    {"nl":"Laat 10 minuten staan zodat de smaken intrekken. Scheur de basilicum erover vlak voor het serveren.","en":"Leave for 10 minutes so the flavours mingle. Tear the basil over just before serving."}
  ] }
```

**6. Coleslaw / Coleslaw** — past bij bbq, kip, buikspek en hamburgers. Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:coleslaw", "name": {"nl":"Coleslaw","en":"Coleslaw"},
  "time": {"active":15,"total":45}, "tags": ["zomer","kids"],
  "goesWith": ["b:hamburgers-voor-op-de-bbq","b:sticky-chicken","b:buikspek-met-5-spices"],
  "lines": [
    {"nl":"½ witte kool [dunne reepjes]","en":"½ white cabbage [thin strips]"},
    {"nl":"2 wortelen [geraspt]","en":"2 carrots [grated]"},
    {"nl":"4 el mayonaise","en":"4 tbsp mayonnaise"},
    {"nl":"2 el yoghurt","en":"2 tbsp yoghurt"},
    {"nl":"1 el appelazijn","en":"1 tbsp cider vinegar"},
    {"nl":"1 tl mosterd","en":"1 tsp mustard"},
    {"nl":"1 tl suiker","en":"1 tsp sugar"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Snijd de kool zo fijn mogelijk en rasp de wortelen grof.","en":"Shred the cabbage as finely as you can and coarsely grate the carrots."},
    {"nl":"Roer de mayonaise, yoghurt, azijn, mosterd en suiker met zout en peper tot een gladde dressing.","en":"Stir the mayonnaise, yoghurt, vinegar, mustard and sugar with salt and pepper into a smooth dressing."},
    {"nl":"Meng de dressing door de kool en wortel. Laat minstens 30 minuten staan in de koelkast; de kool wordt dan zachter.","en":"Mix the dressing through the cabbage and carrot. Leave in the fridge for at least 30 minutes; the cabbage softens."}
  ] }
```

**7. Romige aardappelpuree / Creamy mashed potato** — past bij stoofvlees, vlees in saus en vis. Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:romige-aardappelpuree", "name": {"nl":"Romige aardappelpuree","en":"Creamy mashed potato"},
  "time": {"active":10,"total":30}, "tags": ["snel","kids","winter"],
  "goesWith": ["b:runderlapjes-met-tomaat","b:runderstoofpot-met-paddenstoelen","b:kip-in-dragon-roomsaus"],
  "lines": [
    {"nl":"1 kg kruimige aardappelen [geschild in stukken]","en":"1 kg floury potatoes [peeled and cut into chunks]"},
    {"nl":"150 ml melk","en":"150 ml milk"},
    {"nl":"50 g boter","en":"50 g butter"},
    {"nl":"1 snufje nootmuskaat","en":"1 pinch nutmeg"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Kook de aardappelen in ruim water met zout in 20 minuten gaar. Giet af en laat 1 minuut uitdampen.","en":"Boil the potatoes in plenty of salted water for 20 minutes until tender. Drain and let them steam dry for 1 minute."},
    {"nl":"Verwarm intussen de melk met de boter in een steelpan.","en":"Meanwhile warm the milk with the butter in a small pan."},
    {"nl":"Stamp de aardappelen fijn en roer de warme melk erdoor tot de puree romig is. Breng op smaak met nootmuskaat, zout en peper.","en":"Mash the potatoes and beat in the warm milk until the mash is creamy. Season with nutmeg, salt and pepper."}
  ] }
```

**8. Gebakken krieltjes / Pan-fried baby potatoes** — past bij vis, gebraden vlees en kip. Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:gebakken-krieltjes", "name": {"nl":"Gebakken krieltjes","en":"Pan-fried baby potatoes"},
  "time": {"active":15,"total":30}, "tags": ["snel","kids"],
  "goesWith": ["b:afwasmachinezalm","b:lamsbout-met-rozemarijn","b:kipkarbonades-in-witte-wijn"],
  "lines": [
    {"nl":"750 g krieltjes [gehalveerd]","en":"750 g baby potatoes [halved]"},
    {"nl":"2 el olijfolie","en":"2 tbsp olive oil"},
    {"nl":"20 g boter","en":"20 g butter"},
    {"nl":"2 teentjes knoflook [gekneusd]","en":"2 cloves garlic [bruised]"},
    {"nl":"2 takjes rozemarijn","en":"2 sprigs rosemary"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Kook de krieltjes 8 minuten in water met zout. Giet af en laat uitdampen.","en":"Boil the baby potatoes in salted water for 8 minutes. Drain and let them steam dry."},
    {"nl":"Verhit de olijfolie met de boter in een grote koekenpan. Bak de krieltjes met de snijkant naar beneden 10 minuten op middelhoog vuur zonder te roeren.","en":"Heat the olive oil and butter in a large frying pan. Fry the potatoes cut side down over a medium heat for 10 minutes without stirring."},
    {"nl":"Voeg de knoflook en rozemarijn toe, schud de pan om en bak nog 5 minuten tot ze goudbruin en knapperig zijn. Bestrooi met zout en peper.","en":"Add the garlic and rosemary, shake the pan and fry for another 5 minutes until golden and crisp. Season with salt and pepper."}
  ] }
```

**9. Ovenfrietjes / Oven chips** — past bij hamburgers, kip en gehakt. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:ovenfrietjes", "name": {"nl":"Ovenfrietjes","en":"Oven chips"},
  "time": {"active":15,"total":45}, "tags": ["oven","kids"],
  "goesWith": ["b:hamburgers-voor-op-de-bbq","b:sticky-chicken","b:gehakttaart"],
  "lines": [
    {"nl":"1 kg aardappelen","en":"1 kg potatoes"},
    {"nl":"2 el zonnebloemolie","en":"2 tbsp sunflower oil"},
    {"nl":"1 tl paprikapoeder","en":"1 tsp paprika"},
    {"nl":"1 tl zout","en":"1 tsp salt"}
  ],
  "steps": [
    {"nl":"Verwarm de oven voor op 220 °C. Schil de aardappelen (of was ze goed) en snijd ze in frietjes van 1 cm dik.","en":"Preheat the oven to 220°C. Peel the potatoes (or wash them well) and cut them into chips about 1 cm thick."},
    {"nl":"Spoel de frietjes af onder koud water en dep ze goed droog met een theedoek.","en":"Rinse the chips under cold water and pat them thoroughly dry with a tea towel."},
    {"nl":"Meng ze op een bakplaat met de olie, het paprikapoeder en het zout. Leg ze in één laag.","en":"Toss them on a baking tray with the oil, paprika and salt. Spread them out in a single layer."},
    {"nl":"Bak 30 minuten in de oven; schep ze halverwege om. Ze zijn klaar als ze goudbruin en knapperig zijn.","en":"Bake for 30 minutes, turning them halfway. They are done when golden and crisp."}
  ] }
```

**10. Aardappelpartjes uit de oven / Roast potato wedges** — past bij kip en vlees uit de pan. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:aardappelpartjes-uit-de-oven", "name": {"nl":"Aardappelpartjes uit de oven","en":"Roast potato wedges"},
  "time": {"active":10,"total":45}, "tags": ["oven"],
  "goesWith": ["b:drumsticks-in-kruidige-roomsaus","b:gebakken-kipfilet-met-chorizo-in-romige-mosterdsaus","b:kip-met-sesamzaad"],
  "lines": [
    {"nl":"1 kg aardappelen [partjes]","en":"1 kg potatoes [in wedges]"},
    {"nl":"3 el olijfolie","en":"3 tbsp olive oil"},
    {"nl":"2 teentjes knoflook [fijngehakt]","en":"2 cloves garlic [finely chopped]"},
    {"nl":"1 tl gedroogde oregano","en":"1 tsp dried oregano"},
    {"nl":"1 tl paprikapoeder","en":"1 tsp paprika"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Verwarm de oven voor op 200 °C. Was de aardappelen en snijd ze met schil in partjes.","en":"Preheat the oven to 200°C. Wash the potatoes and cut them, skin on, into wedges."},
    {"nl":"Meng de partjes in een kom met de olijfolie, knoflook, oregano, paprikapoeder, zout en peper.","en":"Toss the wedges in a bowl with the olive oil, garlic, oregano, paprika, salt and pepper."},
    {"nl":"Verdeel ze over een bakplaat met bakpapier en bak 35 minuten in de oven; keer ze halverwege. Serveer direct.","en":"Spread them over a lined baking tray and roast for 35 minutes, turning halfway. Serve straight away."}
  ] }
```

**11. Witte rijst / Plain white rice** — past bij curry, rendang en stoofgerechten met saus. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:witte-rijst", "name": {"nl":"Witte rijst","en":"Plain white rice"},
  "time": {"active":5,"total":20}, "tags": ["snel"],
  "goesWith": ["b:curry-met-groenten-en-kip","b:rendang-met-zelfgemaakt-boemboe","b:gesmoorde-kip-met-tomaat-en-kokos"],
  "lines": [
    {"nl":"300 g basmatirijst","en":"300 g basmati rice"},
    {"nl":"450 ml water","en":"450 ml water"},
    {"nl":"½ tl zout","en":"½ tsp salt"}
  ],
  "steps": [
    {"nl":"Spoel de rijst in een zeef onder de kraan tot het water helder is.","en":"Rinse the rice in a sieve under the tap until the water runs clear."},
    {"nl":"Doe de rijst met het water en het zout in een pan met deksel en breng aan de kook.","en":"Put the rice in a lidded pan with the water and salt and bring to the boil."},
    {"nl":"Zet het vuur laag en kook 12 minuten met het deksel erop. Zet het vuur uit en laat 5 minuten staan zonder het deksel op te tillen.","en":"Turn the heat right down and cook with the lid on for 12 minutes. Turn off the heat and leave for 5 minutes without lifting the lid."},
    {"nl":"Roer de rijst los met een vork.","en":"Fluff the rice with a fork."}
  ] }
```

**12. Couscous / Couscous** — past bij ratatouille, lamsvlees en stoofvlees. Afgeleide dieetlabels: vegetarisch, vegan.
```json
{ "id": "b:couscous", "name": {"nl":"Couscous","en":"Couscous"},
  "time": {"active":5,"total":15}, "tags": ["snel","wereld"],
  "goesWith": ["b:ratatouille","b:lamsvlees-in-reepjes","b:rundvlees-met-uien"],
  "lines": [
    {"nl":"300 g couscous","en":"300 g couscous"},
    {"nl":"350 ml groentebouillon","en":"350 ml vegetable stock"},
    {"nl":"2 el olijfolie","en":"2 tbsp olive oil"},
    {"nl":"sap van ½ citroen","en":"juice of ½ lemon"},
    {"nl":"3 el peterselie [fijngehakt]","en":"3 tbsp parsley [finely chopped]"},
    {"nl":"versgemalen peper","en":"freshly ground pepper"}
  ],
  "steps": [
    {"nl":"Breng de bouillon aan de kook. Doe de couscous in een kom, giet de hete bouillon erover en roer de olijfolie erdoor.","en":"Bring the stock to the boil. Put the couscous in a bowl, pour the hot stock over it and stir in the olive oil."},
    {"nl":"Dek af met een bord en laat 5 minuten staan.","en":"Cover with a plate and leave for 5 minutes."},
    {"nl":"Roer de couscous los met een vork en meng het citroensap en de peterselie erdoor. Breng op smaak met peper.","en":"Fluff the couscous with a fork and stir in the lemon juice and parsley. Season with pepper."}
  ] }
```

**13. Gestoomde broccoli / Steamed broccoli** — past bij kip, vis en gehakt. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:gestoomde-broccoli", "name": {"nl":"Gestoomde broccoli","en":"Steamed broccoli"},
  "time": {"active":5,"total":15}, "tags": ["snel"],
  "goesWith": ["b:kip-met-sesamzaad","b:gehakttaart","b:tonijn-met-nieuwe-aardappeltjes"],
  "lines": [
    {"nl":"1 broccoli [roosjes]","en":"1 broccoli [florets]"},
    {"nl":"1 el olijfolie","en":"1 tbsp olive oil"},
    {"nl":"sap van ½ citroen","en":"juice of ½ lemon"},
    {"nl":"1 el sesamzaad [geroosterd] (optioneel)","en":"1 tbsp sesame seeds [toasted] (optional)"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Snijd de broccoli in roosjes en de stronk in plakjes. Breng een laagje water aan de kook in een pan met een stoommandje.","en":"Cut the broccoli into florets and slice the stalk. Bring a little water to the boil in a pan with a steamer basket."},
    {"nl":"Stoom de broccoli 6 minuten tot hij knapperig gaar en felgroen is. Geen stoommandje? Kook hem dan 4 minuten in weinig water.","en":"Steam the broccoli for 6 minutes until just tender and bright green. No steamer? Boil it in a little water for 4 minutes instead."},
    {"nl":"Schep de broccoli in een schaal en besprenkel met de olijfolie en het citroensap. Bestrooi met zout, peper en het sesamzaad.","en":"Tip the broccoli into a dish and drizzle with the olive oil and lemon juice. Sprinkle with salt, pepper and the sesame seeds."}
  ] }
```

**14. Sperziebonen met knoflook / Green beans with garlic** — past bij vlees, lam en gehakt. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:sperziebonen-met-knoflook", "name": {"nl":"Sperziebonen met knoflook","en":"Green beans with garlic"},
  "time": {"active":10,"total":20}, "tags": ["snel"],
  "goesWith": ["b:gehakttaart","b:runderlapjes-met-tomaat","b:lamsbout-met-rozemarijn"],
  "lines": [
    {"nl":"500 g sperziebonen","en":"500 g green beans"},
    {"nl":"2 el olijfolie","en":"2 tbsp olive oil"},
    {"nl":"2 teentjes knoflook [in dunne plakjes]","en":"2 cloves garlic [thinly sliced]"},
    {"nl":"½ tl chilivlokken (optioneel)","en":"½ tsp chilli flakes (optional)"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Haal de puntjes van de bonen. Kook ze 6 minuten in water met zout; ze moeten nog een beetje bite hebben. Giet af.","en":"Top and tail the beans. Boil them in salted water for 6 minutes; they should still have a little bite. Drain."},
    {"nl":"Verhit de olijfolie in een koekenpan en bak de knoflook 1 minuut op laag vuur tot hij geurt, niet bruin.","en":"Heat the olive oil in a frying pan and fry the garlic over a low heat for 1 minute until fragrant, not brown."},
    {"nl":"Schep de bonen erdoor met de chilivlokken en bak nog 2 minuten. Breng op smaak met zout en peper.","en":"Add the beans and chilli flakes and toss for another 2 minutes. Season with salt and pepper."}
  ] }
```

**15. Gegrilde groenten / Griddled vegetables** — past bij bbq, lam en gehaktbrood. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:gegrilde-groenten", "name": {"nl":"Gegrilde groenten","en":"Griddled vegetables"},
  "time": {"active":20,"total":30}, "tags": ["snel","zomer"],
  "goesWith": ["b:hamburgers-voor-op-de-bbq","b:lamsbout-met-rozemarijn","b:italiaans-gehaktbrood-met-yoghurtsaus"],
  "lines": [
    {"nl":"1 courgette [plakken]","en":"1 courgette [sliced]"},
    {"nl":"1 aubergine [plakken]","en":"1 aubergine [sliced]"},
    {"nl":"2 rode paprika's [repen]","en":"2 red peppers [in strips]"},
    {"nl":"1 rode ui [partjes]","en":"1 red onion [in wedges]"},
    {"nl":"3 el olijfolie","en":"3 tbsp olive oil"},
    {"nl":"1 el balsamicoazijn","en":"1 tbsp balsamic vinegar"},
    {"nl":"2 takjes tijm","en":"2 sprigs thyme"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Snijd de courgette en aubergine in plakken van ½ cm, de paprika in brede repen en de ui in partjes. Meng ze met 2 el van de olijfolie, zout en peper.","en":"Slice the courgette and aubergine ½ cm thick, cut the peppers into wide strips and the onion into wedges. Toss with 2 tbsp of the olive oil, salt and pepper."},
    {"nl":"Verhit een grillpan heet. Gril de groenten in porties 3 minuten per kant tot ze donkere strepen hebben en zacht zijn.","en":"Heat a griddle pan until very hot. Griddle the vegetables in batches for 3 minutes per side until striped and soft."},
    {"nl":"Leg ze op een schaal, besprenkel met de rest van de olie en de balsamicoazijn en strooi de tijmblaadjes erover. Lekker warm én koud.","en":"Arrange on a platter, drizzle with the remaining oil and the balsamic vinegar and scatter over the thyme leaves. Good warm or cold."}
  ] }
```

**16. Worteltjes met honing / Honey-glazed carrots** — past bij gehakt, kip en stoofvlees. Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:worteltjes-met-honing", "name": {"nl":"Worteltjes met honing","en":"Honey-glazed carrots"},
  "time": {"active":10,"total":25}, "tags": ["snel","kids","winter"],
  "goesWith": ["b:gehakttaart","b:kip-in-dragon-roomsaus","b:runderstoofpot-met-paddenstoelen"],
  "lines": [
    {"nl":"600 g wortelen [plakjes]","en":"600 g carrots [sliced]"},
    {"nl":"25 g boter","en":"25 g butter"},
    {"nl":"1 el honing","en":"1 tbsp honey"},
    {"nl":"1 el peterselie [fijngehakt]","en":"1 tbsp parsley [finely chopped]"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Kook de wortelen 8 minuten in weinig water met zout tot ze bijna gaar zijn. Giet af.","en":"Boil the carrots in a little salted water for 8 minutes until almost tender. Drain."},
    {"nl":"Smelt de boter in dezelfde pan, roer de honing erdoor en voeg de wortelen toe.","en":"Melt the butter in the same pan, stir in the honey and add the carrots."},
    {"nl":"Bak 5 minuten op middelhoog vuur, af en toe omscheppend, tot ze glanzen. Bestrooi met peterselie, zout en peper.","en":"Cook over a medium heat for 5 minutes, stirring now and then, until glossy. Sprinkle with parsley, salt and pepper."}
  ] }
```

**17. Rode kool met appel / Red cabbage with apple** — past bij stoofvlees, gehakt en lam (winter). Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:rode-kool-met-appel", "name": {"nl":"Rode kool met appel","en":"Red cabbage with apple"},
  "time": {"active":15,"total":60}, "tags": ["winter"],
  "goesWith": ["b:runderstoofpot-met-paddenstoelen","b:gehakttaart","b:lamsbout-met-rozemarijn"],
  "lines": [
    {"nl":"1 rode kool [fijngesneden]","en":"1 red cabbage [finely sliced]"},
    {"nl":"2 appels [geschild in blokjes]","en":"2 apples [peeled and diced]"},
    {"nl":"1 ui [gesnipperd]","en":"1 onion [finely chopped]"},
    {"nl":"25 g boter","en":"25 g butter"},
    {"nl":"3 el azijn","en":"3 tbsp vinegar"},
    {"nl":"2 el appelstroop","en":"2 tbsp apple syrup"},
    {"nl":"¼ tl gemalen kruidnagel","en":"¼ tsp ground cloves"},
    {"nl":"1 laurierblad","en":"1 bay leaf"},
    {"nl":"1 kaneelstokje","en":"1 cinnamon stick"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Smelt de boter in een grote pan en fruit de ui 3 minuten.","en":"Melt the butter in a large pan and soften the onion for 3 minutes."},
    {"nl":"Voeg de rode kool, appel, azijn, appelstroop, kruidnagel, het laurierblad en het kaneelstokje toe met een scheut water en wat zout.","en":"Add the red cabbage, apple, vinegar, apple syrup, cloves, bay leaf and cinnamon stick with a splash of water and some salt."},
    {"nl":"Stoof met het deksel op de pan 45 minuten op laag vuur; roer af en toe en voeg water toe als het droog wordt.","en":"Cover and stew over a low heat for 45 minutes; stir now and then and add water if it looks dry."},
    {"nl":"Haal het laurierblad en kaneelstokje eruit en breng op smaak met zout, peper en eventueel nog wat azijn.","en":"Remove the bay leaf and cinnamon stick and season with salt, pepper and a little more vinegar if you like."}
  ] }
```

**18. Tzatziki / Tzatziki** — past bij Griekse salade, moussaka en bbq. Afgeleide dieetlabels: vegetarisch, glutenvrij.
```json
{ "id": "b:tzatziki", "name": {"nl":"Tzatziki","en":"Tzatziki"},
  "time": {"active":15,"total":25}, "tags": ["snel","zomer","wereld"],
  "goesWith": ["b:griekse-salade","b:moussaka","b:hamburgers-voor-op-de-bbq"],
  "lines": [
    {"nl":"500 g Griekse yoghurt","en":"500 g Greek yoghurt"},
    {"nl":"1 komkommer","en":"1 cucumber"},
    {"nl":"2 teentjes knoflook [geperst]","en":"2 cloves garlic [crushed]"},
    {"nl":"1 el olijfolie","en":"1 tbsp olive oil"},
    {"nl":"1 el dille [fijngehakt]","en":"1 tbsp dill [finely chopped]"},
    {"nl":"1 tl witte wijnazijn","en":"1 tsp white wine vinegar"},
    {"nl":"zout en peper","en":"salt and pepper"}
  ],
  "steps": [
    {"nl":"Rasp de komkommer grof, bestrooi met wat zout en laat 10 minuten uitlekken in een zeef. Knijp het vocht er goed uit.","en":"Coarsely grate the cucumber, sprinkle with a little salt and leave to drain in a sieve for 10 minutes. Squeeze out the liquid well."},
    {"nl":"Meng de komkommer met de yoghurt, knoflook, olijfolie, dille en azijn.","en":"Mix the cucumber with the yoghurt, garlic, olive oil, dill and vinegar."},
    {"nl":"Breng op smaak met zout en peper. Laat liefst een half uur koud staan; de smaak wordt dan voller.","en":"Season with salt and pepper. Ideally chill for half an hour; the flavour deepens."}
  ] }
```

**19. Guacamole / Guacamole** — past bij taco's en Mexicaanse ovenschotels. Afgeleide dieetlabels: vegetarisch, vegan, glutenvrij.
```json
{ "id": "b:guacamole", "name": {"nl":"Guacamole","en":"Guacamole"},
  "time": {"active":10,"total":10}, "tags": ["snel","zomer","wereld"],
  "goesWith": ["b:taco-schotel","b:mexicaanse-bonenschotel","b:mexicaanse-ovenschotel-met-zoete-aardappel"],
  "lines": [
    {"nl":"3 rijpe avocado's","en":"3 ripe avocados"},
    {"nl":"1 rode ui [fijngesnipperd]","en":"1 red onion [finely chopped]"},
    {"nl":"1 tomaat [blokjes]","en":"1 tomato [diced]"},
    {"nl":"1 rode peper [fijngehakt]","en":"1 red chilli [finely chopped]"},
    {"nl":"sap van 1 limoen","en":"juice of 1 lime"},
    {"nl":"3 el verse koriander [fijngehakt]","en":"3 tbsp fresh coriander [finely chopped]"},
    {"nl":"zout","en":"salt"}
  ],
  "steps": [
    {"nl":"Halveer de avocado's, verwijder de pit en schep het vruchtvlees in een kom. Prak grof met een vork.","en":"Halve the avocados, remove the stones and scoop the flesh into a bowl. Mash roughly with a fork."},
    {"nl":"Meng de ui, tomaat, rode peper, het limoensap en de koriander erdoor.","en":"Stir in the onion, tomato, chilli, lime juice and coriander."},
    {"nl":"Breng op smaak met zout. Serveer meteen, of druk folie op de guacamole zodat hij niet bruin wordt.","en":"Season with salt. Serve straight away, or press cling film onto the surface so it does not brown."}
  ] }
```

**20. Focaccia met rozemarijn / Rosemary focaccia** — past bij ratatouille, pastasalade, Griekse salade en soep. Afgeleide dieetlabels: vegetarisch, vegan.
```json
{ "id": "b:focaccia-met-rozemarijn", "name": {"nl":"Focaccia met rozemarijn","en":"Rosemary focaccia"},
  "time": {"active":20,"total":120}, "tags": ["oven"],
  "goesWith": ["b:ratatouille","b:warme-pastasalade","b:griekse-salade"],
  "lines": [
    {"nl":"500 g bloem","en":"500 g flour"},
    {"nl":"7 g gedroogde gist","en":"7 g dried yeast"},
    {"nl":"1 tl suiker","en":"1 tsp sugar"},
    {"nl":"2 tl zout","en":"2 tsp salt"},
    {"nl":"350 ml water (lauwwarm)","en":"350 ml water (lukewarm)"},
    {"nl":"6 el olijfolie","en":"6 tbsp olive oil"},
    {"nl":"3 takjes rozemarijn","en":"3 sprigs rosemary"},
    {"nl":"1 tl zeezoutvlokken","en":"1 tsp sea salt flakes"}
  ],
  "steps": [
    {"nl":"Meng de bloem met de gist, suiker en het zout. Voeg het water en 3 el van de olijfolie toe en kneed 10 minuten tot een soepel, plakkerig deeg.","en":"Mix the flour with the yeast, sugar and salt. Add the water and 3 tbsp of the olive oil and knead for 10 minutes into a smooth, sticky dough."},
    {"nl":"Dek de kom af en laat het deeg 1 uur rijzen op een warme plek tot het verdubbeld is.","en":"Cover the bowl and leave the dough to rise in a warm place for 1 hour until doubled."},
    {"nl":"Vet een bakplaat in met olie. Druk het deeg uit tot een rechthoek van 2 cm dik en laat nog 20 minuten rijzen.","en":"Oil a baking tray. Press the dough out into a rectangle 2 cm thick and leave to rise for another 20 minutes."},
    {"nl":"Verwarm de oven voor op 220 °C. Druk met je vingers kuiltjes in het deeg, besprenkel met de rest van de olie en strooi de rozemarijnnaaldjes en het zeezout erover.","en":"Preheat the oven to 220°C. Dimple the dough with your fingers, drizzle with the remaining oil and scatter over the rosemary needles and sea salt."},
    {"nl":"Bak 20 minuten tot de focaccia goudbruin is. Laat even afkoelen op een rooster en snijd in stukken.","en":"Bake for 20 minutes until golden. Cool briefly on a rack and cut into pieces."}
  ] }
```

## 3. Bestandsverdeling en contracten

Eén Opus-workflow: drie bouwers parallel + integrator. Bestandsnamen zijn op 22 okt 2026 gecontroleerd.

### Bouwer A — data (bezit: `data/source/bijgerechten.json` NIEUW, `data/review/meta.json`)
- Schrijft `data/source/bijgerechten.json` met de envelop uit §2b en de 20 blokken uit §2g, **letterlijk**
  (kopiëren, niet hertypen; `½`, `¼`, `°C` en `é` blijven staan; bestand UTF-8 zonder BOM, 2 spaties inspringing, afsluitende newline).
- Voegt in `data/review/meta.json` (6B) onder `cuisine` vier regels toe: `"b:tzatziki": "grieks"`,
  `"b:guacamole": "mexicaans"`, `"b:focaccia-met-rozemarijn": "italiaans"`, `"b:couscous": "marokkaans"`.
  Raakt `data/categories.json` niet (§2e).
- Controle vóór overdracht: `node -e` dat het bestand parset en 20 recepten, 127 regels en 66 stappen telt
  (de getallen staan in §6a).

### Bouwer B — pijplijn en tests (bezit: `tools/sides.ts` NIEUW, `tools/migrate-from-recepten2.ts`,
`tools/build-dictionary-seed.ts`, `tools/gen-golden.ts`, `tools/validate-data.ts`, `data/README.md`,
`tests/sides.test.ts` NIEUW, `tests/migrate.test.ts`, `tests/diet.test.ts` (alleen het filter
`createdAt === BUILTIN_TIMESTAMP` in de "three quarters"-test, zie §6b), `tests/apply-meta.test.ts`
(telling: 75 keukens i.p.v. 71))
- Exporteert uit `tools/sides.ts` precies de signaturen van §2b/§2c. Import-stijl als de andere tools
  (`import type { Recipe } from '../src/domain/model.ts'`, `parseLine` uit `../src/domain/parser.ts`,
  `findTimers` uit `../src/domain/timers.ts`, `RECIPE_TAGS` uit `./validate-data.ts`, `readJson` uit
  `./apply-llm-batch.ts`). Let op de kringimport: `validate-data.ts` importeert straks `sides.ts` en
  `sides.ts` importeert `RECIPE_TAGS` uit `validate-data.ts` — dat werkt in ESM zolang beide alleen
  functies/consts op top-level gebruiken bij aanroep; anders
  `RECIPE_TAGS` als parameter aan `checkSides` meegeven (gekozen fallback).
  ⚠ Feitencheck: derive-tags ↔ migrate is géén voorbeeld van zo'n statische kring: derive-tags.ts laadt
  migrate-from-recepten2.ts met een dynamische `await import()` in `main()` (regel 161–162), juist om de
  kring te vermijden. Er is nu geen statische kring tussen de tools. Wel geldt: apply-llm-batch.ts
  gebruikt `RECIPE_TAGS` alleen binnen functies, dus ook de kring validate-data → sides → apply-llm-batch
  → validate-data (via `readJson`) faalt niet bij het laden.
- Kan beginnen vóór A klaar is: het bestandsformaat ligt hier vast; voor de tests mag B tijdelijk het blok
  van §2g kopiëren naar een fixture, maar de definitieve tests lezen `data/source/bijgerechten.json`.
- `DATA_VERSION = 8`; `tests/migrate.test.ts` aanpassen (§6b).

### Bouwer C — app (bezit: `src/domain/search.ts`, `tests/search.test.ts`, `tests/planner.test.ts`)
Besluit kritische lezer: de poolfilter komt uit **6B blok 4** (labels-categorieen.md §2d/§3):
`NON_MAIN_CATEGORIES` (ReadonlySet met nagerecht, gebak, bijgerecht, ontbijt-lunch), `isMainDish`,
`excludeNonMain` in src/domain/planner.ts en `applyPickFilter(recipes, f, dict, l, { mainOnly })` in
PickSheet.tsx, aangeroepen door WeekScreen (hero, open plekken, 🎲), PickSheet ("Verras me · N") en
TonightCard (Home-dobbelsteen); de chip `pick.all` of een categoriechip uit NON_MAIN heft het op. Een
Oven-chip telt dus niet als "ik wil bijgerechten". **Bouwer C raakt planner.ts, WeekScreen.tsx,
HomeScreen.tsx en PickSheet.tsx niet.** Hij doet alleen:
- `tests/planner.test.ts` (uitbreiden): `NON_MAIN_CATEGORIES.has('bijgerecht')`; `isMainDish` false voor
  elk van de 20 ids uit `data/source/bijgerechten.json` (via `sidesToRecipes`) en `excludeNonMain` laat ze
  weg zonder chip, houdt ze met `{ all: true }` of `{ cats: ['bijgerecht'] }`.
- `src/domain/search.ts` `SPELLING_VARIANTS`: twee groepen erbij, onderaan:
  `['friet', 'frieten', 'frietjes', 'patat', 'frites', 'chips']` en `['coleslaw', 'koolsalade', 'koolsla']`.
  (`tzatziki`/`tsatsiki` staat er al; "guac" vindt guacamole al via de gewone deeltekst-match in
  `matchesName` (`haystack.includes`); de 4-letter-prefixregel van `termVariants` geldt alleen voor
  woorden uit `SPELLING_VARIANTS`.)
- Geen i18n-wijziging, geen CSS.

### Integrator
1. Volgorde: A en C mogen samen landen; B's `npm run migrate` pas als A's bestand er staat.
2. Draait in deze volgorde: `npm run migrate` → `node --experimental-strip-types tools/gen-golden.ts` →
   `npm run validate:data` → `npm run measure-parse` (uitvoer identiek) → `npm run check` → `npm test` →
   `npm run build` → `npm run build:next`.
3. Controleert de kerngetallen van §6a in de migrate-uitvoer: `216 recipes (216 unique ids)`,
   `2010 ingredient lines + 17 headers` (de uitvoer telt regels zonder koppen; nu `1883 + 17`; 2027 is
   het totaal mét koppen uit migrate.test.ts), `dataVersion 8`, en 20 nieuwe `goesWith:`-regels.
4. Voegt DEVICE-TEST-rij 81 toe (§6e), werkt docs/STATUS.md bij (één alinea: wat er online staat, 216
   recepten, DATA_VERSION 8), en commit in het Nederlands.
5. Smoke in de dev-app (§6d) op 375 px: Recepten → chip Bijgerecht → 20 (+4 zodra de labels-spec er is;
   ⚠ Feitencheck: +5, zie §2a Polenta);
   Knoflookbrood openen; Week → Verras me 3× zonder bijgerecht.

## 4. Stappenplan

Eén bouwblok, één workflow, in één keer online op `main` (geen vlag, geen /next/-fase): het zijn
afgeronde data plus een kleine, geteste poolfilter; een tekstfout later is één regel in
bijgerechten.json + `npm run migrate` + `DATA_VERSION` ophogen. Toch twee stappen, zodat een afgebroken
run een bruikbaar deel achterlaat:

**Stap 1 — data en pijplijn (bouwers A + B).** Klaar als: `data/source/bijgerechten.json` staat er,
`tools/sides.ts` bestaat, `npm run migrate` schrijft 216 recepten met `dataVersion: 8`, golden
hergenereerd (1443 regels), `validate:data`, `check`, `test`, `build` groen, `tests/sides.test.ts`
groen. Alléén stap 1 online zetten mag **niet**: dan verschijnen bijgerechten in Verras me; is stap 2
niet gehaald, dan alleen `npm run build:next` en pushen naar /next/ (eigen database, invariant 12).

**Stap 2 — app (bouwer C).** Klaar als: zoekvarianten erin, `tests/planner.test.ts` (de 20 vallen onder
`excludeNonMain`, bestaand filter uit 6B) en `tests/search.test.ts` groen, acceptatiechecks §6d gedaan.

**Stap 3 — integrator.** Volledige groene reeks (§3 Integrator punt 2), DEVICE-TEST-rij 81, STATUS.md,
commit, build naar `main` én /next/. Daarna de live app openen en Knoflookbrood controleren (data-bump
zichtbaar: het recept bestaat, categorie Bijgerecht).

Relatie met andere blokken: de labels-spec (6B + 13E, gebouwd vóór dit blok) zette de vijf bestaande
bijgerechten in `bijgerecht`, bouwde "+ bijgerecht" in de weekplanner op `goesWith` en levert
`NON_MAIN_CATEGORIES`/`isMainDish`/`excludeNonMain`/`mainOnly`. 13F
(inbouwen met id-migratie) gebruikt hetzelfde patroon (eigen bronbestand → `migrate`) en kan `tools/sides.ts`
als voorbeeld nemen, maar deelt er geen code mee (andere brondata: bestaande `u:`-recepten met aliassen).

## 5. Regels en eerlijkheid

**Invarianten die dit blok raakt**
- **1 (ids nooit wijzigen):** de 20 ids staan in §2g en in het bronbestand; `id` is daar een expliciet veld,
  niet afgeleid bij elke run. Een latere naamswijziging ("Worteltjes met honing" → "Honingworteltjes")
  verandert `name`, nooit `id` (test 6b-1 krijgt dan een `RENAMED_OK`-regel). De 196 bestaande ids en
  `goesWith`-relaties blijven ongemoeid.
- **2 (raw nooit weg):** elke regel houdt `raw.nl` én `raw.en`; `reparseLine` leest `raw[lang]` terug.
- **3 ({nl, en}):** naam, elke regel en elke stap hebben beide talen; `text.en = 'human'`.
- **4 (deelformaat):** niets verandert aan envelop, `v`, fragmentsleutels of bevroren tokens.
- **12 (database per kanaal):** `DATA_VERSION 8` bumpt `recepten` en `recepten-next` elk apart.
- **13 (timers eerlijk):** de tijden in de stappen zijn kooktijden, geen beloften over achtergrondgedrag.
- **14/15:** geen backend, geen analytics, geen nieuwe dependency.

**Eerlijkheid**
- Een niet-bijgewerkte telefoon zegt bij een gedeeld bijgerecht "Nieuw" en bewaart een ontvangen kopie
  onder het `b:`-id, die na de update de ingebouwde overschaduwt (§1 Delen). Dit is bestaand gedrag voor elk
  `b:`-id; dit blok verandert het niet. 13F blok 3 ruimt identieke kopieën op bij een versiewissel
  (`ensureBuiltins`, zie de kritische lezer bovenaan); tot dan: beide telefoons eerst bijwerken.
- De dieetlabels zijn afgeleid uit het woordenboek (zoals bij de 196), niet met de hand gezet; de tabel in
  §2g is wat de afleiding op 22 okt gaf. Verandert het woordenboek (bv. een vlag op `couscous`), dan
  verandert het label mee en faalt test 6b-5 bewust: dan de tabel in de test bijwerken, niet de data.
- `glutenvrij` staat alleen waar elk ingrediënt `gluten: false` heeft zonder `glutenUnsure`
  (groentebouillon in de couscous is al glutenhoudend door de couscous zelf, dus geen "waarschijnlijk").
- Tijden zijn totaal inclusief wachten (coleslaw 45 min door het koud staan, focaccia 120 min door het
  rijzen); `snel` alleen bij totaal ≤ 30 min (zelfde regel als `isQuick`).

**Opus mag dit NIET zelf beslissen (zo doen als hier staat, anders vragen aan Stijn/Fable)**
1. De recepttekst (NL of EN), ingrediënten, hoeveelheden, volgorde van regels of stappen, tijden en
   tags van §2g — niet "verbeteren", niet inkorten, geen ingrediënt vervangen omdat een parse niet lukt
   (ze zijn allemaal gecontroleerd; lukt er tóch een niet, dan ligt het aan een woordenboekwijziging:
   melden, niet omschrijven).
2. Geen `description`, `servingTip`, `aliases` of `origin.author` toevoegen.
3. Geen dieettags in `tags` zetten (afleiden) en de afgeleide uitkomst niet "corrigeren" in de data.
4. Het inbouwpad (§2a): geen direct schrijven in recipes.json, geen LLM-batch, geen review-laag.
5. `DATA_VERSION` precies 8; niet overslaan "omdat alleen data is toegevoegd" (anders ziet geen telefoon
   de 20) en niet hoger.
6. `SIDES_TIMESTAMP` = `2026-10-22T00:00:00.000Z`; geen `new Date()` (determinisme van de migratie).
7. Dexie blijft v7; geen settings-key; geen i18n-key; geen CSS.
8. Geen eigen poolfilter: de filter is `applyPickFilter(…, { mainOnly: true })` uit 6B blok 4 (alleen de
   kiezers geven `mainOnly` mee; de Recepten-lijst niet, daar blijven bijgerechten zichtbaar). Niets aan
   `pickRecipes`, `applyPickFilter`, planner.ts, WeekScreen.tsx, HomeScreen.tsx of PickSheet.tsx veranderen.
9. De bestaande vier bijgerechten niet verplaatsen naar `bijgerecht` (labels-spec), geen "+ bijgerecht"
   bouwen in de weekplanner (labels-spec), `goesWith` van bestaande klassiekers niet aanvullen (de
   relatie is eenzijdig in data en tweezijdig in de UI).
10. `measure-parse` niet uitbreiden naar het nieuwe bronbestand.
11. De DEVICE-TEST-rij 81 letterlijk overnemen (alleen knopnamen aanpassen als de i18n anders blijkt).
12. Vier namen zijn in beide talen gelijk (Coleslaw, Tzatziki, Guacamole, Couscous): dat is bedoeld, geen
    ontbrekende vertaling; `otherLanguageName` op Home toont dan geen tweede naam.

## 6. Testplan

### 6a. Kerngetallen (gecontroleerd 22 okt 2026 met de echte parser)
20 recepten · 127 ingrediëntregels (0 koppen) · 66 stappen · 99 unieke NL-regels, waarvan 66 nog niet in
de Recepten2-corpus · golden fixture 1377 → 1443 · 1900 + 127 = 2027 regels in recipes.json · 196 + 20 =
216 recepten · 18 recepten met minstens één timer; zonder timer: `b:groene-salade`, `b:guacamole`.

### 6b. Unit tests
**`tests/sides.test.ts` (nieuw; Vitest, node; leest `data/source/bijgerechten.json` en de echte
dictionary via `loadDictionary(readDictionaryData(ROOT))`, zoals parser.golden.test.ts):**
1. `bestand`: schema `'sides-1'`, precies 20 recepten; ids uniek, `/^b:[a-z0-9-]+$/`, geen id uit
   `data/recipes.json`-klassiekers (lees de 196 via `migrate(...)` met `sides: null`, of het gecommitte
   bestand gefilterd op `createdAt === BUILTIN_TIMESTAMP`); `id === builtinId(name.nl)` voor alle 20
   (geldt nu; wordt een naam later aangepast, dan verhuist dat id naar een lijst `RENAMED_OK` in de test
   en blijft het id — invariant 1).
2. `regels resolven`: voor elke regel `parseLine(nl, dict, 'nl').ing !== null` behalve ids in
   `UNRESOLVED_OK: string[] = []` (leeg); `confidence === 1`; en `parseLine(en, dict, 'en').ing` is gelijk
   aan de NL-`ing` behalve regels in `EN_DIFFERS_OK: string[] = []` (leeg). Faalt dit na een
   woordenboekwijziging, dan eerst het woordenboek bekijken; een regel in de uitzonderingslijst zetten
   is de laatste optie en krijgt een `// why`.
3. `vorm`: `goesWith` 1..3 bestaande klassiekers (niet zichzelf); `tags` ⊂ `RECIPE_TAGS` zonder
   dieettags; 3..6 stappen, elk met niet-lege `nl` én `en`; `time.active <= time.total`, beide > 0;
   `name.en` niet gelijk aan `name.nl` behalve bij `Coleslaw`, `Tzatziki`, `Guacamole`, `Couscous`.
4. `timers`: elk recept behalve `b:groene-salade` en `b:guacamole` heeft ≥ 1 stap met timers; elke
   timer-`label` komt letterlijk voor in de NL-staptekst; `findTimers(en)` geeft per stap evenveel timers
   als `findTimers(nl)` (de Engelse tekst noemt dezelfde tijden).
5. `sidesToRecipes`: 20 `Recipe`s; per recept `category === 'bijgerecht'`, `servings === 4`,
   `origin` deep-equal `{ kind: 'builtin' }`, `text` deep-equal `{ en: 'human' }`, `createdAt ===
   SIDES_TIMESTAMP`, geen `description`, elke regel `raw.nl` én `raw.en` gevuld en `kind === 'line'`;
   `applyDerivedTags(recipe, dict).tags` bevat precies de dieetlabels uit de regel "Afgeleide
   dieetlabels" van §2g (tabel in de test, per id) en verder exact de `tags` van het blok.
6. `checkSides weigert`: elk van de gevallen in §2c één voor één (muteer een kopie van het echte
   bestand: dubbel id, id `b:erwtensoep`, `goesWith: []`, `goesWith` met `'b:nope'`, tag `'vegan'`,
   tag `'lekker'`, een regel zonder `en`, 2 stappen, 7 stappen, `time.active 40 / total 30`,
   `schema: 'sides-2'`) → minstens één foutregel die het recept-id noemt; het ongemuteerde bestand → `[]`.
7. `normalizeRecipe` (recipe-io) op elk gegenereerd recept geeft het recept zelf terug (deep-equal) en
   `recipeFingerprint` is stabiel — zoals migrate.test.ts dit voor de eerste 20 klassiekers doet.

**`tests/migrate.test.ts` (aanpassen):** 196 → **216** in de drie plekken (lengte, unieke ids,
validator-stats); `expect(DATA_VERSION).toBe(8)`; `s.lines + s.headers` 1900 → **2027**; de test
"origin builtin, 4 servings" blijft gelden voor alle 216; nieuw: `b:knoflookbrood` bestaat met
`category 'bijgerecht'`, `text.en 'human'`, `goesWith` bevat `b:spaghetti-bolognese`, en
`b:spaghetti-bolognese` zelf is ongewijzigd (`goesWith: []` — de relatie is eenzijdig in data,
RecipeScreen toont hem in beide richtingen). Sortering: `Coleslaw` staat tussen `Chorizo met
tomatengnocchi` en `Courgettestamppot met zalm`.

**`tests/parser.golden.test.ts`:** ongewijzigd; alleen hergenereren. Verwachting: `count 1443`,
`resolved` stijgt met 66, ratio > 0,95 blijft. De diff van parser.golden.json bevat uitsluitend
toegevoegde regels (geen gewijzigde bestaande: de dictionary verandert niet).

**`tests/planner.test.ts` (uitbreiden; `isMainDish`/`excludeNonMain` bestaan sinds 6B):** elk van de 20
gegenereerde bijgerechten geeft `isMainDish` false; `excludeNonMain(sides ++ [rec('a','pasta')], {})` houdt
alleen de pasta over, met `{ all: true }` of `{ cats: ['bijgerecht'] }` alles; `pickRecipes` over de
gefilterde pool kiest nooit een bijgerecht (seeded rng, 50 runs).

**`tests/search.test.ts` (uitbreiden):** `matchesName(recipe('Ovenfrietjes', 'Oven chips'),
queryTerms('patat'))` true; `queryTerms('friet')` true; `matchesName(recipe('Coleslaw'),
queryTerms('koolsalade'))` true; `termVariants('goulash')` ongewijzigd.

**`tests/badges.test.ts`:** geen wijziging (fixtures geven `classicsTotal` expliciet mee); in de app wordt
het doel 216/108 — dat staat in §2f en in STATUS.md, niet in een test.

**`tests/diet.test.ts` (bouwer B; besluit kritische lezer):** de test "agrees with the LLM category on at
least three quarters of the classics" zou met de 20 erbij zakken naar 153/216 = 0,71 (`suggestMeta` raadt
nooit `bijgerecht`). Hij loopt voortaan alleen over `recipes.filter((r) => r.createdAt ===
BUILTIN_TIMESTAMP)` (import `BUILTIN_TIMESTAMP` uit `../tools/migrate-from-recepten2.ts`, zoals
tests/migrate.test.ts al uit dat bestand importeert); dat houdt hem ook na 13F op de 196 originelen.

### 6c. Fixtures
Geen nieuwe fixture-bestanden: de bron zelf (`data/source/bijgerechten.json`) is de fixture, en
`tests/parser.golden.json` wordt hergenereerd. `tests/fixtures/frozen-share-tokens.ts` blijft onaangeroerd.

### 6d. Acceptatiechecks in de dev-app (`npm run dev`, 375 px breed, NL en daarna EN)
1. Recepten → chip **Bijgerecht**: 20 recepten (24 zodra de labels-spec de bestaande vier verplaatst;
   ⚠ Feitencheck: 25, zie §2a Polenta), A–Z gesorteerd als platte lijst (met een chip aan zijn er geen
   lettergroepen en geen letterrail, RecipesScreen.tsx regel 4 en 222–224; de letterrail werkt zonder
   chip, met de 20 ertussen); zoek "patat" → Ovenfrietjes; "koolsalade" → Coleslaw;
   "sesame" (EN) → Gestoomde broccoli via de ingrediëntgroep.
2. Open **Knoflookbrood**: 6 regels, "50 g geraspte kaas (optioneel)" / EN "50 g grated cheese
   (optional)"; onder Bereiding stap 3 heeft een timerchip **⏱ 10 min**; onder "Bij dit gerecht" staan
   (alfabetisch op naam in de app-taal, RecipeScreen.tsx regel 384) Klassieke lasagne, Penne all’
   arrabbiata, Spaghetti Bolognese (EN: Classic lasagne, Penne all'arrabbiata, Spaghetti Bolognese).
   Open Spaghetti Bolognese: onder "Bij dit gerecht" staat Knoflookbrood.
3. Open **Rode kool met appel** → Koken → Begin: stap 3 toont ⏱ 45 min; in **stap 2** is het woord
   **rode kool** groen en onderstreept, tik → "(1)" verschijnt erachter (13I werkt op de nieuwe regels;
   stap 3 bevat geen ingrediëntwoorden, nagerekend met `findStepIngredients`).
4. Schaal **Witte rijst** naar 2 personen: "150 g basmatirijst", "225 ml water"; EN: "150 g basmati rice".
5. Week → **Verras me** (leeg plan, 7): geen bijgerecht; 🎲 op een plek 5×: geen bijgerecht; Kies N →
   chip **Bijgerecht** → Verras me: alleen bijgerechten. Home-dobbelsteen zonder chips: 10× geen bijgerecht.
6. Zet Knoflookbrood en Spaghetti Bolognese in het weekplan → Boodschappen: knoflook is samengevoegd met
   die van de bolognese (één regel, "5 teentjes knoflook"). Peterselie blijft twee regels: de bolognese
   heeft `7 g`, het knoflookbrood `2 el`, en `aggregate` telt g en el niet op (nagerekend op 22 okt).
7. Meer → **Opslag & back-up**: back-up maken en herstellen → de 20 staan er nog (ze komen uit de bundel).
8. Meer → Badges: "Het hele boek" toont …/216 en "Halverwege het boek" …/108 (BadgesScreen toont
   `current/target` zolang een badge niet verdiend is).
9. Deel Knoflookbrood als link en plak hem in de Inbox van dezelfde app: status "Heb je al"
   (`inbox.status.present`).

### 6e. DEVICE-TEST-rij (definitief 81; de kritische lezer hernummert)
NL:
| 81 | **Bijgerechten: 20 nieuwe recepten, niet in Verras me (fase 6, 13E).** 1. Open de app opnieuw na
de update. Tik onderaan op **Recepten**. 2. Tik bovenaan op de chip **Bijgerecht**. 3. Tik op
**Knoflookbrood** en scrol naar beneden. 4. Tik onder "Bij dit gerecht" op **Spaghetti Bolognese**. 5. Tik
onderaan op **Week**. Haal het weekplan leeg als er iets in staat. Tik op **Verras me**. Doe dit drie
keer. 6. Tik op **Kies 7**. Tik op de chip **Bijgerecht**. Tik op **Verras me**. | 1. De app opent gewoon;
je favorieten en kookbeurten staan er nog. 2. Je ziet twintig bijgerechten, van Aardappelpartjes uit de
oven tot Worteltjes met honing. 3. Je ziet zes ingrediënten, drie stappen en bij stap 3 een knop
**⏱ 10 min**. Onder "Bij dit gerecht" staan Klassieke lasagne, Penne all’ arrabbiata en Spaghetti
Bolognese. 4. Onder "Bij dit gerecht" van de bolognese staat Knoflookbrood. 5. Geen van de zeven
gerechten is een bijgerecht (geen frietjes, rijst, salade-bijgerecht, tzatziki of guacamole), alle drie
de keren. 6. Nu zijn het juist alleen bijgerechten. |

EN:
| 81 | **Side dishes: 20 new recipes, never in Surprise me (phase 6, 13E).** 1. Open the app again after
the update. Tap **Recipes** at the bottom. 2. Tap the chip **Side dish** at the top. 3. Tap **Garlic
bread** and scroll down. 4. Under "Goes with", tap **Spaghetti Bolognese**. 5. Tap **Week** at the
bottom. Empty the week plan if anything is in it. Tap **Surprise me**. Do this three times. 6. Tap
**Pick 7**. Tap the chip **Side dish**. Tap **Surprise me**. | 1. The app opens as usual; your
favourites and cooking history are still there. 2. You see twenty side dishes, from Baguette with herb
butter to Tzatziki. 3. You see six ingredients, three steps and a **⏱ 10 min** button on step 3. Under "Goes
with" are Classic lasagne, Penne all'arrabbiata and Spaghetti Bolognese. 4. Under "Goes with" on the
Bolognese is Garlic bread. 5. None of the seven dishes is a side dish (no chips, rice, side salad,
tzatziki or guacamole), all three times. 6. Now they are all side dishes. |

De rijen staan hier over meerdere regels gevouwen; in docs/DEVICE-TEST.md komt elke rij op **één**
regel in de bestaande tabel (zoals rij 65–69), NL in het Nederlandse deel en EN in het Engelse. De
knopnamen zijn gecontroleerd op 22 okt: `week.surprise` = Verras me / Surprise me, `week.pickN` =
Kies {n} / Pick {n}, `recipe.goesWith` = Bij dit gerecht / Goes with (src/i18n/week.ts, browse.ts).
Feitencheck: de "Verras me" van stap 6 (in de Kies-sheet) is `pick.surprise` (zelfde tekst, met "· 7"
erachter: "Verras me · 7" / "Surprise me · 7"). De Engelse A–Z-lijst sorteert op `name.en`
(`sortByName`, RecipesScreen.tsx regel 64): eerste is Baguette with herb butter, laatste Tzatziki.
"Bij dit gerecht" sorteert alfabetisch in de app-taal (RecipeScreen.tsx regel 384); de Nederlandse naam
is "Penne all’ arrabbiata" (krul-apostrof + spatie, zo in data/recipes.json).

## 7. Controlelijst voor Fable (eindcontrole)

1. `data/source/bijgerechten.json` is byte-voor-byte de 20 blokken van §2g (diff tegen de spec; let op
   `½ ¼ °C é`, "paprika's", "avocado's"); envelop `schema 'sides-1'`.
2. `data/recipes.json` heeft `dataVersion: 8`, 216 recepten, en de 20 staan erin met `category
   'bijgerecht'`, `text {en:'human'}`, `createdAt '2026-10-22T00:00:00.000Z'`, `raw.nl` + `raw.en` op
   elke regel; `npm run migrate` opnieuw draaien verandert niets behalve `generatedAt`.
3. `tests/parser.golden.json`: `count 1443`, diff bevat alleen toevoegingen; `source`-regel noemt beide
   bestanden.
4. `npm run validate:data` toont de bijgerechten-regel (20 recepten, 127 regels) en exit 0;
   `npm run measure-parse` laat docs/measure-parse.md ongewijzigd.
5. `tests/sides.test.ts` bestaat met de zeven groepen van §6b, `UNRESOLVED_OK` en `EN_DIFFERS_OK` zijn
   leeg, en de dieettabel komt overeen met §2g.
6. `tests/migrate.test.ts` controleert 216 / 2027 / `DATA_VERSION 8` en de Knoflookbrood-asserties.
7. De 20 vallen onder het bestaande `excludeNonMain`/`mainOnly` van 6B (test in planner.test.ts); dit blok
   heeft planner.ts, PickSheet.tsx, WeekScreen.tsx en HomeScreen.tsx niet aangeraakt (`git diff --stat`).
8. In de dev-app: Verras me 3× zonder bijgerecht; chip Bijgerecht + Verras me geeft alleen bijgerechten;
   Recepten-lijst toont ze gewoon.
9. Knoflookbrood ↔ Spaghetti Bolognese staan bij elkaar onder "Bij dit gerecht"; de Engelse pagina toont
   geen machinevertaling-hint.
10. Zoeken: "patat" → Ovenfrietjes, "koolsalade" → Coleslaw; `SPELLING_VARIANTS` heeft precies twee
    groepen erbij.
11. Geen nieuwe i18n-keys, geen Dexie-versie, geen dependency, geen wijziging aan tests/token.test.ts of
    tests/fixtures/frozen-share-tokens.ts; `git diff --stat` toont alleen de bestanden uit §3.
12. Badges: `classicsTotal` 216 in de live app (Meer → Badges), eerder verdiende klassiekers-badges staan
    er nog.
13. docs/DEVICE-TEST.md rij 81 (NL én EN) ingevoegd met de juiste knopnamen; STATUS.md noemt 216 recepten
    en `DATA_VERSION 8`; data/README.md beschrijft het bronbestand en versie 8.
14. Steekproef Engels (Gabi-blik): Knoflookbrood, Rode kool met appel, Focaccia — Brits (tsp/tbsp, griddle,
    chips, cling film), geen Amerikaanse maten, geen letterlijk vertaald Nederlands.
15. `npm run check`, `npm test`, `npm run build`, `npm run build:next` groen; live app op `main` toont
    Knoflookbrood na "Nieuwe versie — vernieuwen".

## 8. Open vragen voor Stijn

1. **Tellen de bijgerechten mee voor "Het hele boek" / "Halverwege het boek" (216 i.p.v. 196)?** Hier
   gekozen: ja (ze zijn ingebouwd). Wil je dat de badge alleen de 196 originele telt, dan krijgt
   `buildFacts` (src/badges.ts) een filter op `createdAt === BUILTIN_TIMESTAMP` — één regel, maar wel een
   keuze over wat "klassieker" betekent. (Feitencheck: `BUILTIN_TIMESTAMP` staat nu alleen in
   tools/migrate-from-recepten2.ts, niet in src/; de app zou de waarde zelf moeten kennen.)
2. **Mogen de 20 meteen op `main`?** Hier gekozen: ja, na de groene reeks (data is af en gecontroleerd).
   Wil jij of Gabi de teksten eerst op /next/ lezen, zeg dat bij "door"; dan stap 3 eerst alleen
   `build:next`.

Alles overige (inbouwpad, namen, ids, tijden, tags, `goesWith`-keuzes, uitsluiting uit Verras me) is
hierboven gekozen.
