# Spec 6B + 13E — Labels: lactosevrij, keukens, nieuwe categorieën, "+ bijgerecht"

Status: compleet (Fable, 22 okt 2026)
Gebouwd: 23 okt 2026 (blok 1 lactose-data, workflow wf_7fcf0fb3-698)
Gebouwd: 23 okt 2026 (blok 2 lactose-UI, workflow wf_1d108e95-3cf)

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (besluiten over specs heen in
docs/specs/README.md §2; bij tegenspraak wint README.md). Voor deze spec:
- Bouwvolgorde: Home A+ → 13K → **deze spec (5 blokken)** → bijgerechten → 13F → 13D → 6C → 6D.
  DEVICE-TEST-rijen zijn definitief **75–80**. DT 77 "Bijgerecht 5" klopt bij de bouw; na het
  bijgerechten-blok zijn het er 25.
- `DATA_VERSION` 5/6/7 (blok 2/3/4) staat vast; het bijgerechten-blok neemt daarna **8**, 13F **9**.
- **Het pad voor de 20 bijgerechten is niet `recipes-extra.json` + batch-21** maar het pad van
  docs/specs/bijgerechten.md: `data/source/bijgerechten.json` (NL+EN inline, schema `sides-1`) +
  `tools/sides.ts`, in `migrate()` ná `applyReview` en vóór `applyMeta`. §2e en §5 punt 14 zijn daarop
  aangepast. De keukens van vier bijgerechten (tzatziki grieks, guacamole mexicaans, focaccia italiaans,
  couscous marokkaans) komen via `data/review/meta.json`; `applyMeta` draait dus NA het toevoegen van
  sides en (13F) extras en `checkMeta` kent hun ids.
- `VARIANT_DIETS` = **`['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']`** (de tabvolgorde van 13D),
  ook al in blok 2 van deze spec; de knopvolgorde in §1a en het contract in §2b/§3 zijn aangepast.
  `DIET_TAGS` blijft `['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij']` (chipvolgorde).
- De lactosevrij-knop en -sheet van §1a (`variant.make.lactosevrij`, `variant.title.lactosevrij`) zijn
  tijdelijk: 13D blok 2 vervangt alle blok-F-knoppen door tabs en haalt die keys weg. 13D blok 5
  (lactosevrij-swaps) vervalt, omdat blok 2 van deze spec `SWAP_DIETS`/`SWAP_RULES`/swaps.json al doet.
- De swap margarine → vegan-boter krijgt **geen** `lactosevrij` (margarine is `false, unsure`; de swap zou
  nooit vuren). Validatorregel H1 is nu expliciet: `vegan: true` + `lactoseUnsure: true` is óók een error.
- Zoeken: een recept waarvan de keuken op de zoekterm matcht komt in de groep `category`, ook als het
  op een ingrediënt matcht (de keukencheck gaat in `searchRecipes` vóór `matchesIngredient`; gewone
  categorie- en tagtreffers houden de huidige volgorde). Zo staat Spaghetti Bolognese bij "italiaans" onder
  het keukenkopje en blijft "pasta" zoals het was.
- "Zonder Engelse naam" in §1f = `en.one` gelijk aan `nl.one` (hoofdletterongevoelig); dan staat `en: ?`
  in de prompt. `nl` wordt nooit als ontbrekend gemeld.
- `PickChips` krijgt de prop `cuisines` op vijf plekken; na Home A+ zit de Home-aanroep in
  `src/components/TonightCard.tsx` (niet HomeScreen.tsx). Blok 3 bouwer B bezit daarvoor ook TonightCard.tsx,
  RecipesScreen.tsx en WeekScreen.tsx (alleen die prop). Blok 4: de dobbelsteenpool met `mainOnly` staat in
  TonightCard.tsx, de weekregel met alleen hoofdgerechten in `WeekCard.tsx`.
- `planDishCount` (share.ts) telt alleen items zonder `of`; de Inbox-kop telt alleen items zonder
  `sideOfRecipeId`. `takePlan` koppelt `sideOf` (§2d) en mapt vanaf 13F ook alias-ids (inbouwen.md).
- `Dictionary.toData()` en `refsFromData` krijgen `cuisines` erbij (blok 3 bouwer A), anders verdwijnen
  de keukens bij eigen ingrediënten.
- tests/diet.test.ts: het "unsure"-geval gebruikt `worst` (`vegan: false`, bestaat in de fixture), niet
  `bouillonblokje` (vegan ⇒ H1 ⇒ geen unsure). tests/fixtures/test-dictionary.ts volgt de rule sheet
  (§6b aangepast).
- De badge `zuivelvrije-ziel` (🥥) blijft bestaan; 6D-2 maakt er de ladder "tag lactosevrij" van onder
  hetzelfde id (badges-avatar.md laat zijn `zonder-zuivel` vervallen).
- DT 78 stap 6 gaat uit van de standaard 4 personen in het huishouden.
- De drie open vragen voor Stijn blijven (ghee; Nederlands-Italiaanse pasta's; lactosevrij-optie op
  klassiekers); standaard = zoals hier gekozen.

Feitencheck Opus, 22 okt 2026: 32 correcties
(DT = DEVICE-TEST-rij in §6d; ⚠ = feit genoteerd onder een keuze die blijft staan; de rest is in de
tekst zelf verbeterd.)
- §1a, DT 75: de dieetrij scrollt opzij (`.chips`: `overflow-x: auto`), hij breekt niet af.
- §1a: "waarschijnlijk" in de editor = chip "lactosevrij ?" + `meta.probablyLine`; `meta.probably`
  zit in `metaSummary`.
- §1a, DT 75 stap 6: dieetchip staat in `.detail-diet`; "Varianten" is alleen een aria-label.
- §6c.2, DT 75 stap 8: Tagliatelle Carbonara heeft boter, slagroom en kaas (geen room/Parmezaan).
- DT 76 stap 2: Home heeft geen knop "Verras me"; de knop heet "🎲 Nog een" / "🎲 Another".
- DT 79 stap 2: de knop heet "Kopieer opdracht" / "Copy instruction" (`edit.copyImportPrompt`).
- ⚠ §1b, §6a, §6c.6, DT 76: zoeken op italiaans/hollands vult nu eerst de ingrediëntgroep.
- ⚠ §1b, §3 blok 3: `<PickChips>` staat op vijf plekken; drie schermen missen bij Bouwer B.
- ⚠ §1d: bestaande plan-logica werkt op `recipeId`/item-id zonder weet van sides.
- ⚠ §1d: `planDishCount` en de Inbox-kop tellen bijgerechten als gerechten.
- ⚠ §1f, §6a, DT 80: een eigen ingrediënt heeft altijd `nl.one` én `en.one` (kopie).
- §2a: `INGREDIENT_DIET_FLAGS` en de alles-of-niets-lus bestaan al; alleen `'lactose'` erbij.
- ⚠ §2a: zes ids staan in een ander gangpad dan het kopje van de rule sheet.
- ⚠ §2a: advocaat, koffiecreamer, oploscappuccino (dranken) en flesvoeding (drogisterij).
- §2a: `formatIngredientsFile` (tools/apply-llm-batch.ts) schrijft de stijl van ingredients.json al.
- ⚠ §2b: type van `DIET_QUALIFIERS`, verdict-record en uitputtende `Record<DietTag, …>`.
- ⚠ §2b: swap margarine → vegan-boter (lactosevrij) geeft een warning en vuurt nooit.
- §2c: signatuur is `readDictionaryData(root, withIngredients = true)`.
- ⚠ §2c: `Dictionary.toData()` en `refsFromData` kennen geen `cuisines` (migrate.test.ts r. 108).
- §2d: echte repo-signaturen; `generateList` staat in src/db/repo.ts.
- §2d, §3 blok 4 C: weekplan-ontvangst is alleen `takePlan` in InboxScreen.tsx (⚠ geen unittest).
- ⚠ §2d, §6a: `FROZEN_TOKEN_W` wordt in tests/share.test.ts getest, niet in token.test.ts.
- ⚠ §2e: `loadMigrationInputs` leest de bron niet; `validateSource` draait in validate-data `main()`.
- §2f: localStorage-keys `recepten.surpriseFilters` en `recepten.filters`; Week-filter niet bewaard.
- §3 blok 2, §6a: tests/migrate.test.ts r. 20 `expect(DATA_VERSION).toBe(4)` gaat mee per bump.
- ⚠ §3 blok 2 B: de `-optie`-filterkeys staan in src/i18n/phase2.ts, de basiskeys in week.ts.
- ⚠ §3 blok 4 A: `'bake'` hoort al bij `oven`; promptvolgorde = sleutelvolgorde `CATEGORY_WORDS`.
- §3 blok 4 B: stijlbestand is src/styles/week.css (`.week-slot`).
- §5 punt 5: na de vijf blijven er 12 in Overig: Boerenomelet, Roerei "en de andere tien".
- ⚠ §6a: `validateSwaps`-tests staan in tests/variants.test.ts; validate-data.test.ts is nieuw.
- ⚠ §6a: `bouillonblokje` is `vegan: true` (fixture én data), dus volgens H1 niet unsure.
- ⚠ §6b: tests/fixtures/test-dictionary.ts bevat ook `parmezaanse-kaas`, worsten en bouillon.

Bouwspec door Fable (22 okt 2026) voor Opus 5.5. Bron: docs/phase-6-spec.md blok 6B (1–4) en 13E, met
Stijns antwoorden: lactose STRENG (ook oude en harde kaas telt als lactosehoudend; alle ±1600
ingrediënten krijgen de vlag); één keuken per recept en alleen als het écht uit die keuken komt;
categorieën Nagerecht, Gebak, Bijgerecht en Ontbijt & lunch erbij; Kies 7 en Verras me kiezen alleen
hoofdgerechten; "+ bijgerecht" in de week sluit aan op `goesWith`; de importprompt vraagt om de nieuwe
categorieën. De 20 bijgerechten zelf staan in docs/specs/bijgerechten.md (andere schrijver); hier staat
alleen het pad waarlangs ze erin komen (§2e). Bestandsnamen, signaturen en data-ids zijn op 22 okt 2026
gecontroleerd in de code. Alles wat een keuze is, staat hier gekozen; bij twijfel §5.

## 1. Doel en gebruikersgedrag

**In één zin:** de app krijgt een vierde dieet (lactosevrij, streng), een keukenlabel met vlag,
vier categorieën die geen hele maaltijd zijn (en daarom buiten Kies 7 en Verras me vallen), een
"+ bijgerecht" in de week, een nette laatste stap "Labels" in de editor en een AI-prompt die gaten in
je eigen woordenboek vult. Alles werkt op Android en iPhone gelijk; alleen kopiëren naar het klembord
heeft op de iPhone de bestaande terugval (de tekst staat ook zichtbaar in een vak om zelf te kopiëren).

### 1a. Lactosevrij, overal waar glutenvrij nu is

- **Dieetchips** (Home-dobbelsteen, Recepten, Kies 7-venster, Week-filter; `DietChips` in
  src/components/FilterChips.tsx): `Dieet  Vegetarisch · Vegan · Glutenvrij · Lactosevrij · ook als
  optie`. Op 360 px past de rij niet helemaal; dat mag (de chips-container `.chips` in
  src/styles/browse.css scrollt horizontaal: `overflow-x: auto`, geen `flex-wrap`). Teksten:
  `filter.lactosevrij` NL "Lactosevrij" · EN "Lactose-free"; `tag.lactosevrij` NL "lactosevrij" · EN
  "lactose-free"; `filter.lactosevrij-optie` NL "Lactosevrij-optie" · EN "Lactose-free option";
  `tag.lactosevrij-optie` NL "lactosevrij-optie" · EN "lactose-free option"; `meta.tag.lactosevrij` en
  `meta.tag.lactosevrij-optie` gelijk aan de `tag.`-teksten. De chip "Lactosevrij" vindt alleen recepten
  met de ZEKERE tag; met "ook als optie" ook `lactosevrij-optie`. Eerlijk: een recept met een
  onherkende regel of een "misschien lactose"-ingrediënt krijgt de tag niet vanzelf; de editor toont
  dan de chip "lactosevrij ?" en de regel "Waarschijnlijk ook lactosevrij — tik op de chip om dat te
  bevestigen." (bestaand gedrag in MetaRows: `.meta-chip-q` en `meta.probablyLine`; `meta.probably`
  "waarschijnlijk {tag}" staat in `metaSummary`, de voorsteltekst).
- **Receptpagina**: het chipje "lactosevrij" staat in de dieetrij onder de titel (`.detail-diet`,
  `dietChipsFor` loopt over `DIET_TAGS`), niet tussen de overige tags. In het blok Varianten
  staat `variant.make.lactosevrij` NL "Maak lactosevrije versie" · EN "Make lactose-free version"
  zodra een herkende regel lactose bevat (`variantDietsFor`); de sheet heet `variant.title.lactosevrij`
  NL "Lactosevrije versie" · EN "Lactose-free version" en werkt exact als de glutenvrije (SheetPortal,
  Annuleer/Bewaar bovenaan, "controleer zelf" voor regels zonder swap). Volgorde van de knoppen:
  glutenvrij · vegetarisch · vegan · lactosevrij (= `VARIANT_DIETS`, de tabvolgorde van 13D; 13D blok 2
  vervangt deze knoppen en hun keys later door tabs). ("Blok Varianten" = de knoppengroep
  `.detail-variant-make` boven het kopje Ingrediënten; "Varianten" is daar alleen een aria-label,
  geen zichtbare kop; src/screens/RecipeScreen.tsx r. 786–795.)
- **Editor en "Controleer mijn recepten"**: de chip "lactosevrij" (en "lactosevrij-optie") in Dieet &
  labels; het voorstel ("Voorstel: Pasta · vegetarisch, lactosevrij") komt vanzelf uit `suggestMeta`.
- **Woordenboek** (src/screens/DictionaryScreen.tsx): detailchips `dict.flag.lactosefree` NL
  "lactosevrij" · EN "lactose-free" (groen, diet), `dict.flag.lactose` NL "bevat lactose" · EN
  "contains lactose", `dict.flag.lactoseUnsure` NL "misschien lactose" · EN "may contain lactose".
  In het bewerkformulier van een eigen ingrediënt een derde driewegkeuze onder Gluten:
  `dict.form.lactose` NL "Lactose" · EN "Lactose", `dict.form.lactoseYes` NL "ja, bevat lactose" · EN
  "yes, contains lactose", `dict.form.lactoseNo` NL "nee, lactosevrij" · EN "no, lactose-free",
  onbekend = bestaand `dict.form.unknown`. Het formulier "Nieuw ingrediënt" van de IngredientPicker
  vraagt nu geen dieetvlaggen; dat blijft zo (de vlag is dan onbekend en de app zegt "waarschijnlijk").
- **Badge** "Zuivelvrije ziel" (🥥, kook 5 lactosevrije recepten) verschijnt vanzelf op de badgepagina.

### 1b. Keukens

- **Keukenchips**: in `PickChips` een nieuwe rij tussen de dieetrij en de gewone rij, alleen als
  minstens één recept in de lijst een keuken heeft: `Keuken  🇮🇹 Italiaans · 🇳🇱 Hollands · 🇪🇸 Spaans …`
  (alleen keukens die voorkomen, in `order`-volgorde; label = vlag + naam in de UI-taal; aria-label
  `filter.cuisine` NL "Keuken" · EN "Cuisine"). Meerdere aan = OF; samen met de rest EN. Zo staat hij
  op Home (dobbelsteen), Recepten, in het Kies 7-venster en in het Week-filter, zonder extra code per
  scherm. Het ×-wisknopje wist ook de keukens.
  ⚠ Feitencheck: met de prop `cuisines` uit het contract van §3 (blok 3) is er wél één regel per
  aanroeper nodig, zoals nu met `tagIdsIn`: `<PickChips>` staat in src/screens/HomeScreen.tsx (r. 261),
  src/screens/RecipesScreen.tsx (r. 534), src/screens/WeekScreen.tsx (r. 283 en r. 374) en
  src/components/PickSheet.tsx (r. 296); elk berekent zijn eigen `tagIdsIn(...)`.
- **Receptpagina**: naast de categorie (de regel met "Categorie") een chipje `🇮🇹 Italiaans`
  (visueel verborgen label `recipe.cuisine` NL "Keuken" · EN "Cuisine"). Geen keuken = niets tonen
  (geen "geen keuken"-tekst; het label "wereld" blijft de losse verzamelnaam). Bij een eigen of
  ontvangen recept opent een tik op het chipje de editor (bestaande route `/edit/<id>`); bij een
  klassieker is het geen knop.
- **Zoeken**: "italiaans", "italian", "🇮🇹" niet (geen emoji-zoeken), "hollands" en "dutch" vinden de
  recepten met die keuken in de groep "categorie" van `searchRecipes` (`matchesCategory` kijkt ook naar
  `recipe.cuisine` + de nl/en-naam van de keuken).
  ⚠ Feitencheck: `searchRecipes` zet een recept in één groep, en "ingredient" gaat vóór "category".
  Nu al vindt `dict.search('italiaans')` (en 'italian') `italiaanse-bol`, `italiaanse-kruiden` en
  `peterselie` (alias "Italiaanse peterselie"): 42 recepten staan dan in de ingrediëntgroep, waaronder
  Spaghetti Bolognese (peterselie). 'hollands' vindt `kaas` (alias "hollandse kaas"), `haring`,
  `hollandse-garnaal`, `appeltaart`: 48 recepten in de ingrediëntgroep; Hutspot zit daar niet bij.
  'dutch' zet Hutspot in de ingrediëntgroep (rookworst "Dutch smoked sausage"). Gemeten op 22 okt
  met de echte data en src/domain/search.ts.
  **Besluit (kritische lezer):** in `searchRecipes` komt vóór `matchesIngredient` een check
  `matchesCuisine(r, terms, dict)` (keuken-id, nl- en en-naam); een treffer gaat in de groep `category`.
  Alleen de keuken springt zo voor; gewone categorie-/tagtreffers houden de huidige volgorde, dus
  "pasta" gedraagt zich als voorheen en Spaghetti Bolognese staat bij "italiaans" onder het keukenkopje.
- **Importprompt** (Met AI): de voorbeeldblokken krijgen een regel `Keuken: italiaans` / `Cuisine:
  italian` onder `Categorie:`; de regeltekst zegt: NL `"Keuken:" is één van: hollands, italiaans, frans,
  spaans, portugees, grieks, hongaars, brits, midden-oosten, marokkaans, indiaas, thais, chinees,
  japans, indonesisch, surinaams, mexicaans, amerikaans — alleen als het gerecht echt uit die keuken
  komt, anders de regel weglaten` · EN `"Cuisine:" is one of: … — only when the dish really comes from
  that cuisine, otherwise leave the line out`. Na plakken vult de editor de keukenchip in (metaManual),
  met de bestaande melding `edit.importMeta`, nieuwe tekst NL "Categorie, keuken en labels overgenomen
  uit de tekst." · EN "Category, cuisine and labels taken from the text." Plakken zonder prompt
  (websitetekst) raadt GEEN keuken.

### 1c. Vier nieuwe categorieën; Kies 7 en Verras me kiezen hoofdgerechten

- **Overal waar categorieën staan** (select in de editor en op de receptpagina, categoriechips, de
  plank op Home, de importprompt) komen Nagerecht · Gebak · Bijgerecht · Ontbijt & lunch erbij, vóór
  Overig. De plank op Home toont alleen categorieën met recepten: na dit blok "Bijgerecht 5"; de
  andere drie pas als iemand zo'n recept heeft.
- **Hoofdgerecht** = categorie ∉ {nagerecht, gebak, bijgerecht, ontbijt-lunch} (ook "geen categorie"
  telt als hoofdgerecht). Kies 7, Verras me, de 🎲 per slot, "Verras me" in het Kies-venster en de
  dobbelsteen op Home kiezen alleen uit hoofdgerechten. Wil je toch: in de gewone chiprij (direct na
  het ×) staat de schakelchip `pick.all` NL "ook bijgerechten & zoet" · EN "sides & sweet too"; en wie
  een categoriechip Bijgerecht/Nagerecht/Gebak/Ontbijt & lunch aanzet, krijgt die categorie natuurlijk
  wél (de chip is dan de vraag). Op het Recepten-scherm staat de schakelchip NIET en zie je altijd alles.
  Onder de chips in de Week-hero en in de filtersectie: `week.mainOnlyHint` NL "Alleen hoofdgerechten,
  tenzij je 'ook bijgerechten & zoet' aanzet." · EN "Main dishes only, unless you switch on 'sides &
  sweet too'." (klein, grijs).
- **De vijf bijgerechten** uit de 196 (Aardappelpuree, Rucola-spinazie pesto, Tomatensalsa, Naanbrood,
  Polenta) staan na dit blok in Bijgerecht en komen dus niet meer als "gerecht" in de week terecht.
  "+ Deze week" op hun receptpagina werkt nog gewoon (dan is het een los item in de week).

### 1d. "+ bijgerecht" in de week

- Onder elk hoofdgerecht in de weeklijst (niet bij een gekookt slot, niet bij een slot waarvan het
  recept zelf geen hoofdgerecht is) staat een klein tekstknopje `week.addSide` NL "+ bijgerecht" · EN
  "+ side dish". Tik → **SideSheet** (SheetPortal, zelfde opbouw als het Kies-venster): kop
  `week.sideTitle` NL "Bijgerecht bij {name}" · EN "Side dish for {name}" met ×; zoekvak
  (`pick.search`, bestaand); daaronder twee groepen: `week.sideSuggested` NL "Past erbij" · EN "Goes
  with it" = recepten die via `goesWith` aan dit gerecht hangen (in beide richtingen, elke categorie),
  dan `week.sideAll` NL "Alle bijgerechten" · EN "All side dishes" = categorie Bijgerecht A–Z (zonder
  de al genoemde). Rij = naam + naam in de andere taal; een bijgerecht dat al onder dit gerecht staat is
  uitgegrijsd met `week.sideAdded` NL "staat erbij" · EN "added". Eén tik op een rij voegt toe en sluit
  het venster; wegvegen of ernaast tikken voegt niets toe (dit is een kiezer, geen formulier: er is
  geen Bewaar). Leeg: `week.sideNone` NL "Nog geen bijgerechten. Geef een recept de categorie
  Bijgerecht, dan staat het hier." · EN "No side dishes yet. Give a recipe the category Side dish and it
  shows up here."
- **In de lijst** staat het bijgerecht ingesprongen onder zijn hoofdgerecht met "↳" ervoor: naam, naam
  in de andere taal, en alleen een × (aria `week.removeSide` NL "Bijgerecht weghalen" · EN "Remove side
  dish"). Geen personenstepper (volgt het hoofdgerecht), geen slotje, geen 🎲, geen vinkje (gekookt
  volgt het hoofdgerecht). Tik op de naam opent het recept. De samenvatting wordt "7 gerechten · 2
  bijgerechten" (`week.sides` NL "{n} bijgerechten" · EN "{n} side dishes"; `week.side` NL
  "1 bijgerecht" · EN "1 side dish"); het getal "gerechten" telt alleen hoofdgerechten.
- **Gedrag**: personen van het hoofdgerecht veranderen → het bijgerecht volgt; × op het hoofdgerecht →
  het bijgerecht gaat mee weg; 🎲 op het hoofdgerecht → het bijgerecht gaat weg (het hoorde bij dát
  gerecht); vinkje Gekookt op het hoofdgerecht → ook het bijgerecht gekookt (en beide van de
  boodschappenlijst af); Leeg → alles. Hetzelfde bijgerecht mag onder twee hoofdgerechten staan (twee
  keer stokbrood is een echte wens).
  ⚠ Feitencheck (bestaande code die op `recipeId` of op het item-id werkt, zonder weet van sides):
  `addToPlan` (src/db/repo.ts r. 1469) geeft een bestaand slot met hetzelfde `recipeId` terug, dus ook
  een side ("+ Deze week" op een bijgerecht dat al als side staat voegt niets toe);
  `markRecipeCookedInPlan` (r. 1527, "Gekookt!" in de kookstand) zet alleen slots van dát recept op
  gekookt, niet de sides; WeekScreen `onPicked` (r. 134) en `pickRecipes` (`existing`) slaan elk
  recept over dat al in het plan staat, ook als side; `surpriseUnlocked` ("Verras me" op een gevuld
  plan, r. 163) vervangt het recept van élk open slot, dus ook van side-items; `reroll` (r. 196) en
  `surpriseUnlocked` houden het item-`id` en wisselen alleen `recipeId`, zodat een side met
  `sideOf` = dat id er vanzelf aan blijft hangen (de cascade "🎲 → bijgerecht weg" moet expliciet).
- **Boodschappenlijst**: na een bijgerecht toevoegen toont Boodschappen de bestaande balk "Weekplan
  gewijzigd — Bijwerken"; na Bijwerken staan de regels van het bijgerecht in de lijst, met het bijgerecht
  als bron (bestaand gedrag per bron). Niets nieuws in het lijstscherm.
- **Delen** (`#w=`): het bijgerecht reist mee als item met `of` = recept-id van het hoofdgerecht; de
  ontvanger met deze versie ziet het ingesprongen, een oudere app ziet het als los gerecht. De kaart
  "Deze week" op Home noemt alleen hoofdgerechten (max 5 + "+N").
  ⚠ Feitencheck: `planDishCount(env)` (src/domain/share.ts r. 537) telt alle `w.items`; het
  WhatsApp-bericht ("🗓️ Weekplan van Stijn: N gerechten", `buildPlanShareMessage`) telt
  bijgerechten dus nu als gerechten; de Inbox-kop `inbox.plan.title` telt
  `received.share.items.length` (src/screens/InboxScreen.tsx r. 553), dus ook.
  **Besluit (kritische lezer):** `planDishCount` telt alleen items zonder `of` (blok 4 bouwer A, share.ts);
  de Inbox-kop telt alleen items zonder `sideOfRecipeId` (blok 4 bouwer C). "N gerechten" = hoofdgerechten.

### 1e. De laatste stap in de editor: "Labels"

De editor blijft één formulier; het blok met categorie en labels wordt een eigen kaart `Labels`
(`meta.title` NL "Labels" · EN "Labels") en verhuist naar de plek direct boven de knop Bewaar (na de
vertaalkaart). Inhoud, van boven naar beneden: de uitlegregel `meta.kindsHint` (nieuwe tekst: NL
"Categorie: één per recept (soep, salade, pasta …). Keuken: één, alleen als het gerecht er echt vandaan
komt. Dieet & labels: meerdere mogelijk (vegetarisch, snel …)." · EN "Category: one per recipe (soup,
salad, pasta …). Cuisine: one, only when the dish really comes from there. Diet & labels: as many as
apply (vegetarian, quick …)."); de rij **Categorie** (select, ongewijzigd, met de vier nieuwe); de rij
**Keuken** (`meta.cuisine` NL "Keuken" · EN "Cuisine"): chips `geen` (`meta.cuisineNone` NL "geen" ·
EN "none") en daarna alle 18 keukens met vlag, één tegelijk (nog eens tikken = geen); de rij **Dieet &
labels** (ongewijzigd, met lactosevrij). Het voorstel en "Overnemen" werken als nu; een keuken wordt
nooit voorgesteld (daar is geen betrouwbare heuristiek voor). Na "Met AI" plakken staan categorie,
keuken en labels al aan (metaManual). "Controleer mijn recepten" gebruikt dezelfde `MetaRows` en krijgt
de keukenrij er dus bij (zonder voorstel).

### 1f. Woordenboek: prompt voor ontbrekende ingrediënten

In Meer → Woordenboek, in de standaardweergave (geen zoekterm, geen schapfilter), onder "Eigen
ingrediënten"/Opruimen een kaart:
- Kop `dict.missingTitle` NL "Ontbrekende gegevens aanvullen met AI" · EN "Fill in missing details
  with AI". Uitleg `dict.missingHint` NL "Eigen ingrediënten zonder Engelse of Nederlandse naam, zonder
  schap of zonder dieetvlaggen, plus niet-herkende regels uit je eigen en ontvangen recepten. Kopieer
  de opdracht, plak hem in je AI en plak het antwoord hier terug." · EN "Own ingredients without an
  English or Dutch name, without an aisle or without diet flags, plus unrecognised lines from your own
  and received recipes. Copy the instruction, paste it into your AI and paste the answer back here."
  ⚠ Feitencheck: een eigen ingrediënt heeft in de data altijd `nl.one` én `en.one`. Beide formulieren
  (src/screens/DictionaryScreen.tsx `EntryForm.submit` r. 172–190 en
  src/components/IngredientPicker.tsx r. 195–196) kopiëren de ene naam naar de andere taal als die
  leeg is, en `importBundle`/de validator eisen beide. "Zonder Engelse/Nederlandse naam" is in de data
  dus `en.one === nl.one` (de kopie), geen ontbrekend veld. Het schap staat standaard op `overig`.
  **Besluit (kritische lezer):** `collectMissing` meldt `en` als ontbrekend wanneer `en.one` en `nl.one`
  hoofdletterongevoelig gelijk zijn (de promptregel krijgt `en: ?`, `nl` blijft ingevuld); `nl` wordt nooit
  als ontbrekend gemeld. Het schap `overig` telt als ontbrekend ("schap: ?").
- Telregel `dict.missingCount` NL "{n} om aan te vullen" · EN "{n} to fill in"; bij 0 alleen
  `dict.missingNone` NL "Niets aan te vullen: je eigen ingrediënten zijn compleet en alle regels zijn
  herkend." · EN "Nothing to fill in: your own ingredients are complete and every line is recognised."
  (knoppen dan verborgen). Boven 40: `dict.missingMore` NL "Eerst deze 40; daarna verschijnen de
  volgende." · EN "These 40 first; the next ones appear afterwards."
- Knoppen: `dict.missingCopy` NL "Kopieer prompt voor ontbrekende ingrediënten" · EN "Copy prompt for
  missing ingredients" (klembord via `copyText`; status `recipe.copied`; de prompt staat ook in een
  zichtbaar tekstvak zoals `promptBox` in de editor, zodat iPhone-gebruikers hem zelf kunnen
  selecteren) en `dict.missingPaste` NL "Plak antwoord" · EN "Paste answer" → textarea + knop
  `dict.missingReview` NL "Bekijk voorstel" · EN "Review".
- Voorstelvenster (SheetPortal, kop met `common.cancel` en `dict.missingSave` NL "Zet in woordenboek" ·
  EN "Add to dictionary" bovenaan; wegvegen bewaart niets): per regel een vinkje (standaard aan) en de
  tekst `dict.missingRowUpdate` NL "{name}: {fields} aanvullen" · EN "{name}: fill in {fields}" (fields =
  komma-lijst van "Engels", "Nederlands", "schap", "vegan", "gluten", "lactose" in de UI-taal) of
  `dict.missingRowNew` NL "Nieuw: {nl} / {en} · {aisle} · in {n} recept(en) gekoppeld" · EN "New: {nl} /
  {en} · {aisle} · linked in {n} recipe(s)". Een antwoordregel die niet te lezen is wordt overgeslagen
  met `dict.missingRowSkipped` NL "M{n}: niet te lezen, overgeslagen" · EN "M{n}: unreadable, skipped".
  Niets leesbaar: `dict.missingParseFail` NL "Ik herken het antwoord niet. Plak het hele antwoord,
  met de nummers M1, M2 …" · EN "I cannot read the answer. Paste the whole answer, with the numbers M1,
  M2 …". Na Bewaar: snack `dict.missingDone` NL "{updated} aangevuld, {created} nieuw, {linked}
  regels gekoppeld" · EN "{updated} filled in, {created} new, {linked} lines linked".
- De prompt (één codeblok, zoals de importprompt; NL-versie, EN analoog met "aisle" i.p.v. "schap"):
  ```
  Vul voor elk genummerd ingrediënt de ontbrekende gegevens aan (de vraagtekens). Antwoord ALLEEN met
  de regels hieronder, in één codeblok, één regel per nummer, in precies dit formaat:
  M1. nl: <naam, enkelvoud> | en: <British English name, singular> | schap: <id> | vegan: ja/nee |
  gluten: ja/nee/misschien | lactose: ja/nee/misschien
  Schap is één van: groente-fruit, brood-ontbijt, vlees-vis, zuivel-eieren, kaas, droog, blik-pot,
  kruiden-specerijen, sauzen-olie-azijn, wereld, bakken, diepvries, dranken, snacks-zoet,
  huishoudelijk, drogisterij, overig. Lactose streng: elk zuivelproduct (ook harde kaas, boter, ghee)
  is "ja". Verander niets wat al is ingevuld.

  M1. nl: sultana's | en: ? | schap: ? | vegan: ? | gluten: ? | lactose: ?
  M2. (uit "Dino's Gulyás": "2 tl csipetke") nl: csipetke | en: ? | schap: ? | vegan: ? | gluten: ? | lactose: ?
  ```
  Ingevulde velden staan al in de regel; `?` is wat ontbreekt. "misschien" wordt `false` + `…Unsure:
  true`. Een onbekend schap-id laat het huidige schap staan.

## 2. Datamodel en migraties

**Dexie blijft op v7.** Niets in deze spec is een index: `cuisine` en `category` zijn velden op
`Recipe`, `sideOf` is een veld in `plans.items[]`, `lactose` is een veld op een woordenboek-entry. Geen
`db.version(8)` in dit blok (v8 is gereserveerd voor 13F inbouwen).

### 2a. Woordenboek: de lactosevlag (data/ingredients.json, src/domain/dictionary.ts)

```ts
// src/domain/dictionary.ts, interface Ingredient — toevoegen na glutenUnsure:
/** Contains lactose (docs/phase-6-spec.md 6B.1, STRICT: every dairy product, also hard cheese and
 *  ghee). Missing = unknown (diet.ts says "unsure"). Plant-based entries (vegan: true) are always false. */
lactose?: boolean;
/** `lactose: false` is a best guess (margarine, a stock cube, crisps): diet.ts treats the line as
 *  unsure. Only next to `lactose: false`; `lactose: true` is a fact. */
lactoseUnsure?: boolean;
```

Validatorregels (tools/validate-data.ts `validateDictionary`, zelfde stijl als gluten):
- `INGREDIENT_DIET_FLAGS = ['vegan', 'gluten', 'lactose']` → "alles of niets": zodra één entry
  `lactose` heeft, is een entry zonder een ERROR (lijst van max 10 ids). Dit is de bewaking van de
  datapass: een half gemergde slice kan nooit gevalideerd worden. (De constante bestaat al als
  `['vegan', 'gluten']`, tools/validate-data.ts r. 56, en de alles-of-niets-lus met die melding ook,
  r. 621–630; alleen `'lactose'` toevoegen. Staat de vlag op géén entry, dan is het een warning.)
- `lactoseUnsure` zonder `lactose` → error; `lactose: true` + `lactoseUnsure: true` → error
  ("drop lactoseUnsure or use lactose: false, lactoseUnsure: true").
- NIEUW en hard: `vegan: true` + `lactose: true` → error ("a plant-based product cannot contain
  lactose"), en óók `vegan: true` + `lactoseUnsure: true` → error ("a plant-based product is never
  unsure about lactose"; regel H1 hieronder). Dit vangt de meeste typefouten van de agents.
- README-regel voor data/README.md (Opus voegt die toe): "`lactose` volgt de STRENGE lezing: elk
  zuivelproduct telt, ook oude en harde kaas (Parmezaan, Gruyère) en ghee. Lactosevrije producten
  (`lactosevrije-melk`), plantaardige zuivel en eieren zijn `false`. Producten die soms melkbestanddelen
  bevatten (margarine, bouillonblokje, chips, bladerdeeg, worst) zijn `lactose: false, lactoseUnsure: true`."

**Besluit ghee:** `lactose: true`. Ghee is geklaarde boter; er zit vrijwel geen lactose meer in, maar
Stijn koos STRENG ("ook oude kaas telt", die is óók vrijwel lactosevrij). "Lactosevrij" betekent in deze
app dus "zonder zuivelproduct"; dat is uitlegbaar en consequent. Wie ghee verdraagt, gebruikt
"lactosevrij-optie" of past de regel zelf aan. Een vervanging bestaat (ghee → kokosolie, zie 2b).

**Regels per gangpad (de rule sheet die elke slice-agent letterlijk krijgt).** Eerst de harde regels:
(H1) `vegan: true` ⇒ `lactose: false` ZONDER unsure, wat de gangpadregel hieronder ook zegt: de
veganvlag is al de uitspraak dat er geen melk in zit (zo zijn `pure-chocolade`, `chips`,
`bouillonblokje` en `aardappelpuree` in de huidige data vegan en dus gewoon `false`). De validator
weigert `vegan: true` met `lactose: true` én met `lactoseUnsure: true`. (H2) Non-food
(`huishoudelijk`, `drogisterij`, `overig`) ⇒ `lactose: false`. (H3) Twijfel bij een entry met `vegan:
false` ⇒ `lactose: false, lactoseUnsure: true`, nooit `true` op een gok; `true` alleen als het product
zuivel IS of zuivel als vast bestanddeel heeft (kaas, boter, room, melk, yoghurt, melkchocolade). De
"unsure"-gevallen hieronder gelden dus alleen voor entries met `vegan: false`. Dan per gangpad:
- `kaas` (44): alles `true`, inclusief parmezaanse-kaas, pecorino, grana-padano, gruyere, comte,
  manchego, halloumi, paneer, feta, mozzarella, burrata. Enige uitzondering: `vegan-kaas` → false (H1).
- `zuivel-eieren` (89): melk, room, slagroom, kookroom, crème fraîche, zure room, yoghurt (ook Grieks,
  geiten, schapen, drink-), kwark, skyr, kefir, ayran, labneh, hüttenkäse, roomkaas, Mon Chou, boter,
  kruidenboter, vla, pudding, panna cotta, tiramisu, crème brûlée, pap, milkshake, ijskoffie,
  chocolademelk, houdbare melk, geitenmelk, karnemelk, probiotisch drankje, croissantdeeg → `true`.
  Eieren (ei, eidooier, eiwit, kwartelei) en reuzel → `false`. Plantaardig (soja-, haver-, amandel-,
  rijst-, kokos-, erwten-, hazelnootdrink; sojaroom, haverroom; soja-/kokos-/amandel-/haveryoghurt;
  sojadessert; vegan-boter) → `false` (H1). `lactosevrije-melk`, `lactosevrije-yoghurt` → `false`.
  margarine, halvarine, vloeibare-margarine, zanddeeg, deeg-voor-hartige-taart → `false, unsure`.
  pizzadeeg → `false`.
- `bakken` (97): melkpoeder, gecondenseerde-melk, banketbakkersroom, chocoladedrops, chocoladeglazuur,
  kwarktaartmix, boterkoekmix, witte chocolade → `true`. Kant-en-klare bakmixen (cake, brownie,
  pannenkoek) en bladerdeeg → `false, unsure`. Bloem, suiker, gist, bakpoeder, cacao, vanille, noten,
  amandelspijs, paneermeel → `false`.
- `brood-ontbijt` (122): croissant, chocoladecroissant, kaasbroodje, brioche, vlaai, hagelslag,
  chocoladevlokken → `true`. Brood, beschuit, crackers, ontbijtgranen zonder chocolade, jam, honing,
  pindakaas, ontbijtkoek, rijstwafel → `false`. Muesli/granola met chocolade → `false, unsure`.
- `vlees-vis` (201): vers vlees, vis, schaal- en schelpdieren, hele gezouten/gerookte stukken (ham,
  bacon, pancetta, rosbief, gerookte zalm) → `false`. Worst, salami, chorizo, knakworst, rookworst,
  gehaktbal kant-en-klaar, gepaneerd (schnitzel, kipnuggets, vissticks), paté, salades uit de
  koeling (aardappelsalade, selderijsalade, huzarensalade) → `false, unsure`. Kaasschnitzel en alles
  met "kaas" in de naam → `true`. Vega-producten: vegan true → false (H1); vegan false zonder kaas in
  de naam → `false, unsure`.
- `sauzen-olie-azijn` (62): olie, azijn, mosterd, ketchup, sojasaus, sambal, worcestersaus,
  mayonaise → `false`. kaassaus, hollandaisesaus, bearnaisesaus, yoghurtdressing,
  olie-en-boter-om-in-te-bakken → `true`. Kant-en-klare sauzen (curry-, pasta-, saté-saus, dressings
  zonder yoghurt) → `false, unsure`.
- `blik-pot` (77): groente, peulvruchten, tomaten, vis in blik → `false`. bechamelsaus, pesto (bevat
  kaas; streng), roomsoepen → `true`. Andere kant-en-klare soepen en sauzen, knakworst → `false, unsure`.
- `kruiden-specerijen` (99): zuivere kruiden, specerijen, zout, peper, gedroogde kruidenmixen zonder
  drager → `false`. Bouillonblokjes, fonds, bouillon en "mix voor …"-zakjes → `false, unsure`.
- `droog` (67): pasta, rijst, peulvruchten, couscous, meel → `false`. kaastortellini → `true`. Gevulde
  pasta zonder "kaas" in de naam, instantnoedels, aardappelpuree (instant) → `false, unsure`.
- `wereld` (99): kokosmelk, tofu, tempeh, noedels, rijstpapier, sauzen op soja-basis → `false`.
  ghee → `true`. Kant-en-klare currysauzen/pasta's → `false, unsure`.
- `diepvries` (48): roomijs, ijsje, ijstaart, pizza, kaassoufflé, spinazie à la crème,
  mozzarellastick → `true`. sorbetijs, waterijsje, frites, groente, vis → `false`. Kroket, bitterbal,
  vlammetje, loempia, aardappelkroketje → `false, unsure`.
- `snacks-zoet` (115): chocolade, melkchocolade, chocolade-…, toffee, karamel, yoghurtrozijn, cake,
  boterkoek, stroopwafel, koekjes met boter/chocolade → `true`. pure-chocolade, chips, speculaas,
  zoute koekjes → `false, unsure`. Noten, drop, winegums, rijstcrackers, popcorn → `false`.
- `dranken` (122): koffiemelk, chocolademelkpoeder, roomlikeur → `true`. Al het andere (bier, wijn,
  sterke drank, sap, fris, koffie, thee, water) → `false`.
- `groente-fruit` (195): alles `false`, behalve tzatziki → `true` en kant-en-klare salades met
  dressing → `false, unsure`.
- `huishoudelijk`, `drogisterij`, `overig` → `false` (H2).

⚠ Feitencheck (gangpad in data/ingredients.json wijkt af van het kopje waaronder de rule sheet het
noemt): `bladerdeeg` staat in `diepvries` (niet `bakken`), `knakworst` in `blik-pot`, `sojasaus` en
`satesaus` in `wereld`, `pastasaus` in `blik-pot`, `tofu` in `vlees-vis`. Elke agent krijgt de hele
sheet, dus de regel zelf geldt nog; alleen het kopje klopt niet.
⚠ Feitencheck: `dranken` bevat ook `advocaat`, `koffiecreamer` en `oploscappuccino` (alle drie
`vegan: false`), die "al het andere → false" nu dekt; `drogisterij` bevat `flesvoeding` (`vegan:
false`, zuigelingenvoeding, meestal op melkbasis), die H2 nu `false` geeft.

**De datapass (±1600 entries in 10 slices).** Werkbestanden in `data/work/lactose/` (niet gebundeld):
`slice-01-groente-fruit.json`, `slice-02-vlees-vis.json`, `slice-03-brood-ontbijt.json`,
`slice-04-dranken.json`, `slice-05-snacks-zoet.json`, `slice-06-kruiden-droog.json`,
`slice-07-huishoudelijk-drogisterij-overig.json`, `slice-08-bakken-blik-pot.json`,
`slice-09-zuivel-kaas.json`, `slice-10-diepvries-wereld-sauzen.json` (±120–200 ids per slice; één
Haiku- of Opus-agent per slice, met de rule sheet hierboven en de entry zelf als input: id, nl, en,
aisle, vegan). Vorm = dezelfde als data/work/diet-flags-slice-1.json:
```json
{ "aardappel": { "lactose": false },
  "margarine": { "lactose": false, "lactoseUnsure": true },
  "kaas": { "lactose": true } }
```
Nieuw tool `tools/apply-flag-slices.ts` (Node 22, type-stripping; geen dependency):
```ts
export function readSlices(dir: string): Record<string, { lactose: boolean; lactoseUnsure?: true }>;
/** Errors: unknown id, id in two slices, id missing in every slice, lactoseUnsure on lactose true,
 *  lactose true on a vegan entry. Empty = the merge may run. */
export function checkSlices(slices: Record<string, unknown>, ingredients: readonly Ingredient[]): string[];
export function applySlices(ingredients: Ingredient[], slices: ...): Ingredient[]; // flags appended per entry
```
CLI: `node --experimental-strip-types tools/apply-flag-slices.ts --check` (alleen rapport: aantal ids
gedekt / ontbrekend / dubbel per slice) en `--apply` (schrijft data/ingredients.json in de bestaande
stijl: één entry per regel, zelfde sleutelvolgorde; de schrijfstap van data/work/block-e/merge.mjs
is het voorbeeld; `formatIngredientsFile(entries)` in tools/apply-llm-batch.ts (r. 468, export)
schrijft die stijl al: gesorteerd op id, één entry per regel). Daarna `npm run validate:data` (moet
groen zijn: alles-of-niets), `node --experimental-strip-types tools/gen-golden.ts` (het
golden-bestand bevat de dictionary-grootte, niet de vlaggen; verandert normaal niet), `npm run migrate` (block 2 leidt de tag af), `npm test`.

**Steekproef (Fable, nu al ingevuld; wordt tests/lactose.test.ts, zie §6):**
- `true`: kaas, parmezaanse-kaas, pecorino, gruyere, blauwe-kaas, feta, mozzarella, geitenkaas, paneer,
  boter, ghee, melk, room, slagroom, kookroom, creme-fraiche, zure-room, yoghurt, griekse-yoghurt,
  kwark, karnemelk, kefir, roomkaas, mon-chou, huttenkase, kruidenboter, vla, roomijs, pesto, kaassaus,
  bechamelsaus, hollandaisesaus, melkchocolade, chocolade, gecondenseerde-melk, melkpoeder, croissant,
  tzatziki, koffiemelk, pizza, kaastortellini, boterkoek, hagelslag,
  olie-en-boter-om-in-te-bakken.
- `false` zonder unsure: ei, eidooier, kokosmelk, sojamelk, havermelk, sojaroom, kokosyoghurt,
  vegan-boter, vegan-kaas, lactosevrije-melk, lactosevrije-yoghurt, mayonaise, olijfolie, mosterd,
  sojasaus, worcestersaus, kip, zalm, ham, rijst, spaghetti, aardappel, ui, bloemen, aanmaakblokje,
  sorbetijs, ontbijtkoek, pindakaas, kokosolie, edelgistvlokken, en (H1, want vegan in de data)
  pure-chocolade, bouillonblokje, chips, aardappelpuree.
- `false` + `lactoseUnsure: true`: margarine, halvarine, bladerdeeg, rookworst, knakworst,
  aardappelsalade, zanddeeg.
Alle ids hierboven bestaan op 22 okt 2026 in data/ingredients.json (gecontroleerd). Komt er bij het
bouwen toch een id niet voor: die regel uit de test laten en het in het eindrapport melden; niets
bijverzinnen.

### 2b. Tags, dieettype, varianten, swaps, badge

- tools/validate-data.ts `RECIPE_TAGS`: `'lactosevrij'`, `'lactosevrij-optie'` erbij (na
  `'glutenvrij-optie'`). `SWAP_DIETS` krijgt `'lactosevrij'`; `SWAP_RULES.lactosevrij = { flag:
  'lactose', toValue: false, fromBreaks: (ing) => ing.lactose === true }`; warning voor een `to` met
  `lactoseUnsure` ("controleer het etiket"), zoals bij gluten.
- src/domain/diet.ts: `export type DietTag = 'vegetarisch' | 'vegan' | 'glutenvrij' | 'lactosevrij'`;
  `DIET_TAGS = ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij']`; in `dietTags()` na de
  gluten-regels: `if (ing.lactose === true) v.lactosevrij.contradicted = true; else if (ing.lactose !==
  false || ing.lactoseUnsure === true) v.lactosevrij.unknown = true;`. `DIET_QUALIFIERS.plantaardige`
  krijgt ook `lactose: false` (plantaardige room is lactosevrij); `vegetarische` raakt lactose niet.
  `DietTags` krijgt `lactosevrij?: boolean`. Alles verder (applyDietTags, suggestMeta, SUGGESTED_TAGS)
  volgt automatisch via DIET_TAGS.
  ⚠ Feitencheck: `DIET_QUALIFIERS` heeft nu het type `Record<string, { vegan: boolean }>` en
  `ingredientOf` (diet.ts r. 65–77) past alleen `veg`/`vegan` aan; het type en `ingredientOf` moeten dus
  mee voor `lactose: false`. De verdict-record in `dietTags` (r. 92) is een letterlijk object met drie
  sleutels en krijgt er een vierde. Andere uitputtende `Record<DietTag|VariantDiet, …>`: `OPTIE_TAG`
  (FilterChips.tsx r. 18), `DIET_SUFFIX`/`DIET_TAGS_FOR`/`OPTIE_TAGS_FOR` (variants.ts r. 96–114) en
  `DietMeasure.perTag` (tools/derive-tags.ts r. 72).
- src/components/FilterChips.tsx `OPTIE_TAG.lactosevrij = 'lactosevrij-optie'`.
- src/domain/variants.ts: `VARIANT_DIETS = ['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']` (de
  tabvolgorde van 13D; kritische lezer);
  `DIET_SUFFIX.lactosevrij = { nl: 'lactosevrij', en: 'lactose-free' }`; `DIET_TAGS_FOR.lactosevrij =
  ['lactosevrij']`; `OPTIE_TAGS_FOR.lactosevrij = ['lactosevrij-optie']`. (De varianten-spec 13D
  bouwt hierop de tab "lactosevrij", kleur wit; zij veranderen de UI, niet deze vlag.)
- data/swaps.json: bij elke bestaande vegan-zuivelswap waarvan `to` straks `lactose: false` heeft,
  `'lactosevrij'` aan `diets` toevoegen: melk→havermelk, karnemelk→sojamelk, room→sojaroom,
  kookroom→sojaroom, slagroom→sojaroom, creme-fraiche→sojayoghurt, zure-room→sojayoghurt,
  yoghurt→sojayoghurt, griekse-yoghurt→kokosyoghurt, boter→vegan-boter,
  kaas→vegan-kaas, cheddar→vegan-kaas, mozzarella→vegan-kaas, parmezaanse-kaas→edelgistvlokken.
  NIET margarine→vegan-boter: margarine is `false, unsure`, dus die swap zou voor lactosevrij nooit vuren
  (kritische lezer; de ⚠ hieronder is daarmee verwerkt).
  Nieuw (alleen `lactosevrij`): `{ "from": "ghee", "to": "kokosolie", "diets": ["lactosevrij"], "note":
  { "nl": "Kokosolie bakt net zo heet als ghee; de smaak is iets zoeter.", "en": "Coconut oil takes the
  same heat as ghee; the taste is a little sweeter." } }`, `{ "from": "roomkaas", "to": "sojayoghurt",
  "diets": ["lactosevrij", "vegan"], "note": { "nl": "Laat sojayoghurt een uur uitlekken in een
  koffiefilter voor een stevige roomkaas.", "en": "Drain soya yoghurt in a coffee filter for an hour
  for a firm cream cheese." } }`, `{ "from": "kwark", "to": "sojayoghurt", "diets": ["lactosevrij",
  "vegan"] }`. Geen swap voor feta, geitenkaas, mascarpone, ricotta: die regels worden "controleer zelf".
  ⚠ Feitencheck: `margarine` wordt volgens §2a `lactose: false, lactoseUnsure: true`. `planVariant`
  ruilt alleen regels die het dieet breken (`lineBreaksDiet`, dus `lactose === true`), en
  `validateSwaps` geeft voor `fromBreaks === false` de warning "… can never fire"
  (validate-data.ts r. 835–837). De swap margarine → vegan-boter met `lactosevrij` geeft dus een
  warning en doet in de app niets.
- data/badges.json, één regel achter `glutenvrijbuiter`:
  `{ "id": "zuivelvrije-ziel", "nl": { "name": "Zuivelvrije ziel", "description": "Kook 5 lactosevrije
  recepten" }, "en": { "name": "Dairy-free soul", "description": "Cook 5 lactose-free recipes" },
  "icon": "🥥", "rule": { "kind": "tag", "id": "lactosevrij", "n": 5 }, "tier": 1 }` (44 badges; de
  grote catalogus is 6D).
- Classics: `applyDerivedTags` (tools/derive-tags.ts) zet `lactosevrij` vanzelf op elke klassieker
  waarvan geen enkele herkende regel lactose heeft en niets unsure is. Geen `lactosevrij-optie` op
  klassiekers in dit blok (dat is mensenwerk; de chip bestaat voor eigen recepten).

### 2c. Keukens: data/cuisines.json en `Recipe.cuisine`

Nieuw bestand `data/cuisines.json` (hand, tweetalig; `flag` is een emoji; `order` = de volgorde van de
chips):
```json
[
  { "id": "hollands",      "nl": "Hollands",      "en": "Dutch",          "flag": "🇳🇱", "order": 1 },
  { "id": "italiaans",     "nl": "Italiaans",     "en": "Italian",        "flag": "🇮🇹", "order": 2 },
  { "id": "frans",         "nl": "Frans",         "en": "French",         "flag": "🇫🇷", "order": 3 },
  { "id": "spaans",        "nl": "Spaans",        "en": "Spanish",        "flag": "🇪🇸", "order": 4 },
  { "id": "portugees",     "nl": "Portugees",     "en": "Portuguese",     "flag": "🇵🇹", "order": 5 },
  { "id": "grieks",        "nl": "Grieks",        "en": "Greek",          "flag": "🇬🇷", "order": 6 },
  { "id": "hongaars",      "nl": "Hongaars",      "en": "Hungarian",      "flag": "🇭🇺", "order": 7 },
  { "id": "brits",         "nl": "Brits",         "en": "British",        "flag": "🇬🇧", "order": 8 },
  { "id": "midden-oosten", "nl": "Midden-Oosters","en": "Middle Eastern", "flag": "🧆", "order": 9 },
  { "id": "marokkaans",    "nl": "Marokkaans",    "en": "Moroccan",       "flag": "🇲🇦", "order": 10 },
  { "id": "indiaas",       "nl": "Indiaas",       "en": "Indian",         "flag": "🇮🇳", "order": 11 },
  { "id": "thais",         "nl": "Thais",         "en": "Thai",           "flag": "🇹🇭", "order": 12 },
  { "id": "chinees",       "nl": "Chinees",       "en": "Chinese",        "flag": "🇨🇳", "order": 13 },
  { "id": "japans",        "nl": "Japans",        "en": "Japanese",       "flag": "🇯🇵", "order": 14 },
  { "id": "indonesisch",   "nl": "Indonesisch",   "en": "Indonesian",     "flag": "🇮🇩", "order": 15 },
  { "id": "surinaams",     "nl": "Surinaams",     "en": "Surinamese",     "flag": "🇸🇷", "order": 16 },
  { "id": "mexicaans",     "nl": "Mexicaans",     "en": "Mexican",        "flag": "🇲🇽", "order": 17 },
  { "id": "amerikaans",    "nl": "Amerikaans",    "en": "American",       "flag": "🇺🇸", "order": 18 }
]
```
Op Windows toont Chrome vlag-emoji als twee letters ("NL"); op Android en iPhone zijn het vlaggen. Dat
is geen bug.

```ts
// src/domain/dictionary.ts
export interface Cuisine { id: string; nl: string; en: string; flag: string; order: number }
// DictionaryData: cuisines?: Cuisine[]   (optioneel, zodat oude callers/tests blijven werken)
// Dictionary:     cuisines: Cuisine[] (gesorteerd op order; [] zonder data) + cuisine(id): Cuisine | undefined
// src/domain/data.ts: import cuisinesJson from '../../data/cuisines.json'; cuisinesData; in defaultDictionaryData()
// tools/build-dictionary-seed.ts readDictionaryData(root, withIngredients = true):
//   leest data/cuisines.json mee (bestaat het niet → [])
// src/domain/model.ts, interface Recipe — na `category`:
/** data/cuisines.json id (docs/phase-6-spec.md 6B.2): ONE cuisine, only when the dish really comes
 *  from it; null/absent = none (the 'wereld' tag stays the loose label). Travels in share tokens like
 *  any other key. */
cuisine?: string | null;
```
Validator: `DictionaryRefs.cuisines`; in `validateDictionary` dezelfde id/nl/en/order-checks als
categories plus `flag` non-empty string; in `validateSchema2`: `cuisine` is `undefined | null | bekend
id`, anders error. `tools/make-batch-inputs.ts buildVocab` krijgt `cuisines`.
⚠ Feitencheck: `Dictionary.toData()` (src/domain/dictionary.ts r. 586–596) kopieert nu alleen de
zeven bestaande lijsten. `withUserEntries` bouwt het woordenboek opnieuw uit `toData()`, en
tests/migrate.test.ts r. 108 valideert met `refsFromData(inputs.dict.toData())`; zonder `cuisines`
in `toData()` verdwijnen de keukens bij eigen ingrediënten en is `refs.cuisines` in die test leeg.
`refsFromData` (validate-data.ts r. 75) vult nu alleen de zes bestaande sets.
**Besluit (kritische lezer):** blok 3 bouwer A breidt `Dictionary.toData()` uit met `cuisines` en
`refsFromData` met `cuisines: Set<string>`; tests/migrate.test.ts r. 108 werkt dan ongewijzigd.

Toewijzing aan de 196 (Fable's lijst; de rest is null = geen keuken). Gaat in `data/review/meta.json`
(2e), NIET in de batches en NIET met de hand in recipes.json:
- italiaans: b:bavette-met-gerookte-pancetta, b:cannelloni-met-gehakt-salie-en-walnoten,
  b:farfalle-alla-boscaiola, b:fusilli-con-polpettine, b:gnocchi-met-spinazie-en-walnoten,
  b:italiaans-gehaktbrood-met-yoghurtsaus, b:klassieke-lasagne, b:ossobuco-met-gremolata,
  b:pappardelle-met-gorgonzola, b:penne-all-arrabbiata, b:penne-siciliana,
  b:rigatoni-con-melanzane-peperoni-e-pomodori, b:rigatoni-met-tonijncarbonara,
  b:risotto-met-bacon-en-lente-ui, b:safraan-risotto-met-garnalen, b:spaghetti-al-pomodoro-e-olive,
  b:spaghetti-bolognese, b:spaghetti-con-peperoni-e-pomodori, b:spaghetti-mediterranei,
  b:tagliatelle-alle-noci, b:tagliatelle-carbonara, b:tortellini-al-gratin (22).
- hollands: b:andijviestamp-met-danish-blue, b:boerenkool, b:hutspot, b:husselpot,
  b:hete-bliksem-met-speklapjes-en-mosterdsaus, b:erwtensoep, b:rode-kool-met-hachee,
  b:spruitjespuree, b:koolstamppot-met-prei-en-kaas, b:broccolistamppot-met-noten-en-geitenkaas,
  b:courgettestamppot-met-zalm, b:koolraapstamppot-met-gekarameliseerde-rode-uien-en-feta,
  b:visje-bij-de-thee, b:boerenomelet, b:witlofschotel-uit-de-oven, b:gehakttaart (16).
- frans: b:quiche-lorraine, b:salade-nicoise, b:ratatouille (3).
- spaans: b:huevos-a-la-flamenca, b:spaanse-gehaktballetjes-in-sherrysaus, b:spaanse-groenten,
  b:spaanse-rosti-met-spinazie, b:pasta-alpujarra, b:aardappeltortillataart-met-tonijn (6).
- portugees: b:portugese-visschotel (1). grieks: b:griekse-salade, b:moussaka (2).
- hongaars: b:hongaarse-goulash, b:goulash-maaltijdsoep (2). brits: b:kalkoenpie (1).
- marokkaans: b:couscous-met-kip-en-courgette, b:couscous-met-runderreepjes (2).
- indiaas: b:dahl-van-rode-linzen-boerenkool, b:naanbrood-voor-bij-dahl, b:mulligatawny (3).
- thais: b:groene-kalkoencurry (1). chinees: b:gebakken-rijst-met-pikante-chinese-kool,
  b:buikspek-met-5-spices (2). japans: b:zalm-teriyaki-met-pindaboontjes-en-noedels,
  b:vegetarische-ramen (2).
- indonesisch: b:nasi-sate-met-kip-en-shiitake, b:rendang-met-zelfgemaakt-boemboe, b:gado-gado,
  b:sambal-goreng-spruitjes (4). mexicaans: b:mexicaanse-bonenschotel,
  b:mexicaanse-ovenschotel-met-zoete-aardappel, b:taco-schotel (3). amerikaans:
  b:hamburgers-voor-op-de-bbq (1). midden-oosten, surinaams: 0 klassiekers (de keuken bestaat voor eigen
  recepten; de chip verschijnt pas als er een recept mee is).
Bewust null (Opus voegt NIETS toe): macaroni-/pasta-met-… (Nederlands-Italiaans), boeuf-stroganoff
(Russisch, niet in de lijst), zuid-afrikaanse-gehaktschotel, noorse-visschotel, groentecurry,
kipkerrie-met-rijst, sticky-chicken, chorizo-met-tomatengnocchi, zalm-en-croute, quiche-met-kip.

### 2d. Categorieën en de weekplanner

data/categories.json: vier regels erbij en `overig` naar achteren (ids veranderen nooit, `order` wel):
```json
{ "id": "nagerecht",     "nl": "Nagerecht",       "en": "Dessert",           "order": 11 },
{ "id": "gebak",         "nl": "Gebak",           "en": "Baking",            "order": 12 },
{ "id": "bijgerecht",    "nl": "Bijgerecht",      "en": "Side dish",         "order": 13 },
{ "id": "ontbijt-lunch", "nl": "Ontbijt & lunch", "en": "Breakfast & lunch", "order": 14 },
{ "id": "overig",        "nl": "Overig",          "en": "Other",             "order": 15 }
```
src/components/CategoryShelf.tsx `ICONS`: nagerecht 🍨, gebak 🍰, bijgerecht 🥖, ontbijt-lunch 🥪.

```ts
// src/domain/planner.ts
/** Categories that are not a whole meal: Kies N, Verras me, the reroll and the Home dice skip them
 *  unless the person asks for them (PickFilter.all or a chip of such a category). */
export const NON_MAIN_CATEGORIES: ReadonlySet<string> = new Set(['nagerecht', 'gebak', 'bijgerecht', 'ontbijt-lunch']);
export function isMainDish(r: Pick<Recipe, 'category'>): boolean; // !r.category || !NON_MAIN_CATEGORIES.has(r.category)
// PlanItem — toevoegen:
/** "+ bijgerecht" (13E): id of the PlanItem this side dish belongs to. Absent = a main dish. The side
 *  follows its main dish: same servings, cooked together, removed together. */
sideOf?: string;
export function sidesOf(items: readonly PlanItem[], mainId: string): PlanItem[];
export function mainItems(items: readonly PlanItem[]): PlanItem[];      // items zonder sideOf
export function newSideItem(main: PlanItem, recipeId: string): PlanItem; // servings = main.servings, sideOf = main.id
```
`pickRecipes` verandert niet; de aanroepers geven een pool zonder bijgerechten (§1c). `planHash` en
`planHashAll` tellen bijgerechten gewoon mee (het zijn items met rid+servings), dus de boodschappenlijst
wordt "gewijzigd" zodra je een bijgerecht toevoegt, en `generateList`/`aggregate` tellen de regels van het
bijgerecht automatisch mee (zij lopen over `plan.items`). Niets in src/domain/aggregate.ts verandert.

Repo (src/db/repo.ts): `addSideToPlan(mainItemId, recipeId): Promise<PlanItem>` (geen dubbel bijgerecht
onder dezelfde hoofd; servings = die van de hoofd); `removeFromPlan(itemId)` verwijdert ook de items met
`sideOf === itemId`; `setPlanServings(mainId, n)` zet dezelfde n op zijn sides; `markPlanCooked(mainId,
on)` zet `cooked` ook op zijn sides; `togglePlanLock` raakt sides niet; `savePlan` laat een `sideOf` die
naar een niet-bestaand item wijst vervallen (het item wordt een gewoon gerecht: `delete sideOf`).
(De bestaande signaturen: `removeFromPlan(itemId: string)`, `setPlanServings(itemId: string, n:
number)`, `markPlanCooked(itemId: string, cooked: boolean)`, `togglePlanLock(itemId: string):
Promise<boolean>`, `savePlan(plan: Plan): Promise<Plan>`; `generateList(dict)` staat ook in
src/db/repo.ts, r. 1593.)

Deelformaat `#w=` (src/domain/share.ts): `PlanPayloadItem` krijgt `of?: string` = het RECEPT-id van
de hoofdgerecht-slot (item-ids zijn lokaal). `buildPlanEnvelope` zet `of` op elk side-item waarvan de
hoofd niet gekookt is (een side van een gekookte hoofd reist niet mee, net als de hoofd zelf).
`parseEnvelope` leest `of` naar `PlanShare.items[].sideOfRecipeId?: string`; waar `PlanShare.items`
nu PlanItems worden (dat is alleen `takePlan` in src/screens/InboxScreen.tsx, r. 455–495: 'replace'
via `newPlanItem`, 'append' via `addToPlan` met een `have`-set op recipeId), krijgt een side-item
`sideOf` = het id van het zojuist gemaakte item voor dat recept, of wordt een gewoon gerecht als dat
recept niet in dit plan zit. Een oudere app negeert `of` en toont het bijgerecht als los gerecht: dat is
precies het bedoelde gedrag van een versioned contract (invariant 4); de sleutel blijft `#w=`, `v` blijft
2. Nieuw bevroren fixture in tests/fixtures/frozen-share-tokens.ts: `FROZEN_TOKEN_W_SIDE`,
`FROZEN_TOKEN_W_SIDE_FFLATE`, `FROZEN_ENVELOPE_W_SIDE` = `{ v: 2, t: 'w', by: 'Stijn', at:
'2026-10-22T12:00:00.000Z', w: { items: [{ rid: 'b:kabeljauw-met-notencrumble', srv: 4 }, { rid:
'b:aardappelpuree-bij-kabeljauw-met-notencrumble', srv: 4, of: 'b:kabeljauw-met-notencrumble' }],
recipes: [], note: 'Vrijdag' }, future: { keep: true } }`, ÉÉN keer geproduceerd met `encodeToken` op
beide engines en daarna nooit meer veranderd (§6).
⚠ Feitencheck: de bestaande `FROZEN_TOKEN_W`/`_FFLATE`/`FROZEN_ENVELOPE_W` (fixtures r. 101–156)
worden getest in tests/share.test.ts (r. 322), niet in tests/token.test.ts; token.test.ts importeert
alleen de P-, B- en F-fixtures (r. 22–32) plus zijn eigen V2-token.

### 2e. De bron van de klassiekers: data/review/meta.json en de extra bronlijst

`data/recipes.json` is gegenereerd (`npm run migrate`); categorie en keuken van een klassieker mogen
dus niet met de hand in dat bestand. Nieuw: `data/review/meta.json`, toegepast door een nieuw
`tools/apply-meta.ts` in `migrate()` NA `applyReview` en VÓÓR `applyDerivedTags`:
```json
{
  "category": {
    "b:aardappelpuree-bij-kabeljauw-met-notencrumble": "bijgerecht",
    "b:rucola-spinazie-pesto-bij-kabeljauw-met-notencrumble": "bijgerecht",
    "b:tomatensalsa-bij-kabeljauw-met-notencrumble": "bijgerecht",
    "b:naanbrood-voor-bij-dahl": "bijgerecht",
    "b:polenta-voor-ratatouille": "bijgerecht"
  },
  "goesWith": { "b:polenta-voor-ratatouille": ["b:ratatouille"] },
  "cuisine": { "b:bavette-met-gerookte-pancetta": "italiaans", "…": "… (de volledige lijst van 2c)" }
}
```
```ts
// tools/apply-meta.ts (Node 22; patroon van tools/apply-review.ts)
export interface MetaReview { category?: Record<string, string>; goesWith?: Record<string, string[]>; cuisine?: Record<string, string> }
export function readMeta(root: string): MetaReview | null;          // data/review/meta.json, null als afwezig
export function checkMeta(meta: MetaReview, recipes: readonly Recipe[], refs: DictionaryRefs): string[]; // onbekend recept-id, categorie-id, keuken-id of goesWith-id = error
export function applyMeta(recipes: Recipe[], meta: MetaReview): { recipes: Recipe[]; applied: number };
```
`loadMigrationInputs` krijgt `meta`; `apply-llm-batch --apply all` past meta ook toe (pariteit met
migrate). Alleen deze vijf recepten veranderen van categorie; de overige 12 in "Overig" blijven staan
(Opus mag er geen hercategoriseren, ook niet Boerenomelet of Roerei).

**Pad voor de 20 bijgerechten (docs/specs/bijgerechten.md; besluit kritische lezer).** Niet in
data/source/recipes-recepten2.json (dat is de read-only Recepten2-export) en niet met de hand in
recipes.json. Het pad is dat van bijgerechten.md: `data/source/bijgerechten.json` (schema `sides-1`,
NL én EN inline, geschreven en met de parser gecontroleerd) + `tools/sides.ts` (`readSides`,
`checkSides`, `sidesToRecipes`), door `migrate()` ingelezen ná `applyReview` en vóór `applyMeta`. De keuken
van vier bijgerechten komt via meta.json (tzatziki → grieks, guacamole → mexicaans, focaccia → italiaans,
couscous → marokkaans; de rest null): daarom draait `applyMeta` NA het toevoegen van de sides (en, vanaf
13F, van de stijnchat-extras), en kent `checkMeta` die ids. Dieettags komen uit `applyDerivedTags`.
`DATA_VERSION` wordt bij dat blok 8 (ná 7 uit blok 4 van deze spec). Vaste volgorde in `migrate()`:
bron → batches → `applyReview` → sides (bijgerechten) → extras (13F) → `applyMeta` → `applyDerivedTags`
→ sorteren. 13F heeft zijn eigen tool (`tools/import-stijnchat.ts`); er is dus géén
`recipes-extra.json` en géén batch-21.
⚠ Feitencheck: `loadMigrationInputs` (tools/migrate-from-recepten2.ts r. 161) leest de bron nu niet:
het geeft alleen `dict`, `batches` en `review`. De bron wordt gelezen door `main()` van dat tool
(r. 195, daarna `migrate(raw, …)`), door tests/migrate.test.ts zelf (r. 11) en los door
tools/derive-tags.ts (r. 163), tools/build-dictionary-seed.ts (r. 64, ook `sourceLines` voor
gen-golden), tools/measure-parse.ts en tests/token.test.ts (r. 34). `validateSource` draait in
`main()` van tools/validate-data.ts (r. 872), niet in de migratie.

### 2f. Overige velden, instellingen, back-up, deelformaat

- `MetaValue` (src/components/MetaRows.tsx): `{ category: string | null; cuisine: string | null; tags: string[] }`.
- `PlainRecipe` (src/domain/photo-import.ts): `cuisine?: string` (uit een "Keuken:" / "Cuisine:"-regel).
- `PickFilter` (src/components/PickSheet.tsx): `cuisines: string[]` (OR onderling, AND met de rest) en
  `all?: boolean` ("ook bijgerechten & zoet"). `sanitizePickFilter` vult `cuisines: []` aan voor oude
  localStorage-waarden; `savePickFilter` bewaart `cuisines` en `all` alleen als ze gezet zijn.
- Geen nieuwe settings-keys in deze spec. Geen nieuwe localStorage-keys (de bestaande
  `recepten.surpriseFilters` (HomeScreen.tsx r. 33) en de lijstfilter-key `recepten.filters`
  (`LIST_FILTERS_KEY`, RecipesScreen.tsx r. 58) dragen de nieuwe velden; het Week-filter wordt niet
  bewaard).
- Back-up (`exportBundle`/`importBundle`): ongewijzigd. `cuisine` en `metaManual` reizen als velden op
  `userRecipes[]`, `sideOf` als veld in `plans[0].items[]`, `lactose` op `userIngredients[]`
  (`importBundle` filtert op id/nl/en, laat overige velden staan). Een restore van een oudere back-up
  heeft die velden niet: dat is "geen keuken / geen bijgerecht / lactose onbekend" en dus correct.
- Deelformaat: `#r=`/`#p=`/`#b=` dragen `cuisine` via de recipe-spread in `travelRecipe`/`normalizeRecipe`
  (test erbij in tests/share.test.ts). `#w=` krijgt `of` (2d). `dict.ing[]` in een token draagt
  `lactose`/`lactoseUnsure` als gewone velden mee (eigen ingrediënten).
- `DATA_VERSION` (tools/migrate-from-recepten2.ts): 5 na blok 2 (lactosevrij-tags), 6 na blok 3
  (keukens), 7 na blok 4 (categorieën + goesWith van de polenta). Daarna: 8 = de 20 bijgerechten, 9 = 13F
  (vast over alle specs; README.md §2).

## 3. Bestandsverdeling en contracten

Vijf bouwblokken, elk één Opus-workflow (bouwers parallel op eigen bestanden → integrator → Haiku-gate).
Een bestand staat per blok bij precies één bouwer; de integrator raakt alleen aan wat hieronder bij hem
staat plus docs/STATUS.md en docs/DEVICE-TEST.md. "Nieuw" = bestaat nog niet.

### Blok 1 — Lactose-data (geen zichtbare verandering in de app)
- **Bouwer D1 (tool + validator):** tools/apply-flag-slices.ts (nieuw; §2a), tests/apply-flag-slices.test.ts
  (nieuw), tools/validate-data.ts (`INGREDIENT_DIET_FLAGS` + de drie lactoseregels), tools/README.md (één
  tabelregel), data/README.md (de lactose-alinea uit §2a). Export: `readSlices(dir)`,
  `checkSlices(slices, ingredients): string[]`, `applySlices(ingredients, slices): Ingredient[]`.
- **Slice-agents 1–10 (Haiku; parallel):** elk precies één bestand data/work/lactose/slice-NN-….json
  (§2a). Input per agent: de rule sheet van §2a letterlijk + de lijst `{ id, nl, en, aisle, vegan }` van
  zijn gangpad(en) (de integrator maakt die lijst met een node-oneliner). Een agent schrijft niets anders
  en past geen entry aan.
- **Integrator:** schrijft EERST tests/lactose.test.ts (de steekproef van §2a; rood vóór de merge), dan
  `--check` (ontbrekende/dubbele ids zelf aanvullen volgens de rule sheet, in het slicebestand van dat
  gangpad), `--apply`, `npm run validate:data` (alles-of-niets groen), gen-golden, `npm test`, `npm run
  check`, `npm run build`. Geen DATA_VERSION-bump (recipes.json verandert niet in dit blok).

### Blok 2 — Lactose-UI
- **Bouwer A (domein + data):** src/domain/diet.ts, src/domain/variants.ts, tools/validate-data.ts
  (`RECIPE_TAGS`, `SWAP_DIETS`, `SWAP_RULES`), tools/derive-tags.ts (contradictie "(lactose)" in
  `deriveTagChange`), data/swaps.json, data/badges.json, tools/migrate-from-recepten2.ts (`DATA_VERSION =
  5`) + `npm run migrate` (recipes.json krijgt de `lactosevrij`-tags), docs/measure-diet.md
  (hergenereren), tests/diet.test.ts, tests/variants.test.ts, tests/badges.test.ts.
  ⚠ Feitencheck: tests/migrate.test.ts r. 20 zegt `expect(DATA_VERSION).toBe(4)`; die regel gaat bij
  elke bump mee (blok 2 → 5, blok 3 → 6, blok 4 → 7), dus dat bestand hoort per blok bij Bouwer A.
  Contract: `DIET_TAGS` = `['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij']` (de volgorde is de
  UI-volgorde); `VARIANT_DIETS` = `['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']` (tabvolgorde 13D).
  Ook in dit blok: `SWAP_DIETS`/`SWAP_RULES.lactosevrij` + de swaps van §2b — 13D blok 5 vervalt daardoor.
- **Bouwer B (UI + i18n):** src/components/FilterChips.tsx (`OPTIE_TAG`), src/screens/DictionaryScreen.tsx
  (`entryFlags`, `EntryForm` driewegkeuze lactose), src/domain/photo-import.ts (`TAG_WORDS`:
  `lactosevrij: ['lactosevrij', 'lactose-free', 'lactose free', 'lactosefree', 'zuivelvrij',
  'dairy-free', 'dairy free']`, `'lactosevrij-optie': ['lactosevrij-optie', 'lactosevrij optie',
  'lactose-free option', 'lactosevrije optie', 'lactosevrij mogelijk']`), src/i18n/week.ts
  (`filter.lactosevrij`, `tag.lactosevrij`, `filter.lactosevrij-optie`, `tag.lactosevrij-optie`),
  src/i18n/browse.ts (`variant.make.lactosevrij`, `variant.title.lactosevrij`), src/i18n/edit.ts
  (`meta.tag.lactosevrij`, `meta.tag.lactosevrij-optie`, `dict.flag.lactose`, `dict.flag.lactosefree`,
  `dict.flag.lactoseUnsure`, `dict.form.lactose`, `dict.form.lactoseYes`, `dict.form.lactoseNo`),
  tests/photo-import.test.ts.
  ⚠ Feitencheck: de bestaande `filter.glutenvrij`/`tag.glutenvrij` staan in src/i18n/week.ts
  (r. 104, 112), maar `filter.glutenvrij-optie`/`tag.glutenvrij-optie` (en `filter.vegan-optie`,
  `filter.diet*`) in src/i18n/phase2.ts (r. 24–33).
  RecipeScreen en MetaRows hoeven niet aangeraakt: zij lopen over
  `DIET_TAGS` / `variantDietsFor` / `META_TAG_IDS` (= `IMPORT_TAG_IDS`, dus de nieuwe TAG_WORDS-keys).
- **Integrator:** check/test/build, DEVICE-TEST rij 75, STATUS.md.

### Blok 3 — Keukens
- **Bouwer A (data + domein + tools):** data/cuisines.json (nieuw; §2c), src/domain/dictionary.ts
  (`Cuisine`, `DictionaryData.cuisines?`, `Dictionary.cuisines`, `Dictionary.cuisine(id)`),
  src/domain/data.ts (`cuisinesData`, in `defaultDictionaryData`), tools/build-dictionary-seed.ts
  (`readDictionaryData` leest cuisines.json), src/domain/model.ts (`Recipe.cuisine`),
  tools/validate-data.ts (`DictionaryRefs.cuisines`, cuisines-checks, schema-2 `cuisine`),
  tools/apply-meta.ts (nieuw; §2e) + data/review/meta.json (nieuw; nu alleen het `cuisine`-deel met de
  71 ids van §2c), tools/migrate-from-recepten2.ts (meta-stap, `DATA_VERSION = 6`) + migrate,
  tools/apply-llm-batch.ts (`--apply all` past meta toe), tools/make-batch-inputs.ts (`vocab.cuisines`),
  src/domain/search.ts (`matchesCategory` kent de keuken), src/domain/photo-import.ts (`CUISINE_WORDS`,
  `cuisineIdFromWord`, `IMPORT_CUISINE_IDS`, `PlainRecipe.cuisine`, de `Keuken:`/`Cuisine:`-regel in
  `formatBlock`, `META_RULE`, `META_WORDS`, `parseBilingualPlain`; EditScreen's eigen `META_LINE_RE` en
  `META_SPLIT_RE` krijgen `keuken|cuisine` erbij — dat regelt bouwer B), tests/validate-data.test.ts
  (nieuw), tests/apply-meta.test.ts (nieuw), tests/search.test.ts, tests/photo-import.test.ts,
  tests/share.test.ts (`cuisine` reist mee in `#r=`), data/README.md (cuisines.json + meta.json regels).
  Contract: `cuisineIdFromWord('Italian') === 'italiaans'`, `cuisineIdFromWord('Hollands') ===
  'hollands'`, onbekend → `undefined`; `CUISINE_WORDS` bevat per id de nl- en en-naam, het bijvoeglijk
  naamwoord in beide talen (italiaanse, nederlands, dutch, holland, italy, italië …) en de id zelf.
- **Bouwer B (UI):** src/components/FilterChips.tsx (`CuisineChips`, `cuisineLabel`),
  src/components/PickSheet.tsx (`PickFilter.cuisines`, `sanitizePickFilter`, `savePickFilter`,
  `applyPickFilter`, `cuisineIdsIn(recipes)`, de rij in `PickChips`), src/screens/RecipeScreen.tsx (het
  chipje), src/components/MetaRows.tsx (`MetaValue.cuisine`, de rij Keuken, `metaSummary` met vlag +
  naam, `metaEqual`, `applySuggestion` laat `cuisine` ongemoeid), src/screens/EditScreen.tsx (`meta`-state
  met `cuisine`, `importMeta` leest `cuisine`, `build()` schrijft `cuisine: meta.cuisine`, laden van een
  bestaand recept, `META_LINE_RE`/`META_SPLIT_RE`), src/screens/CheckRecipesScreen.tsx (`MetaValue`-vorm),
  src/i18n/phase2.ts (`filter.cuisine`), src/i18n/browse.ts (`recipe.cuisine`), src/i18n/edit.ts
  (`meta.cuisine`, `meta.cuisineNone`, nieuwe tekst `edit.importMeta`), src/styles/browse.css
  (`.chip-cuisine`, `.recipe-cuisine`), src/styles/edit.css (`.meta-cuisine-chips`).
  Contract: `applyPickFilter(recipes, f, dict, l)` filtert `f.cuisines` als OF-groep; `PickChips` krijgt
  prop `cuisines: readonly string[]` (ids die in de lijst voorkomen; `cuisineIdsIn` maakt die, zoals
  `tagIdsIn`) en toont de rij alleen als die niet leeg is.
  Die prop wordt gevuld op elke plek waar `<PickChips>` staat: na Home A+ is dat
  src/components/TonightCard.tsx (de dobbelsteen van Home; vóór Home A+ stond hij in HomeScreen.tsx r. 261),
  src/screens/RecipesScreen.tsx (r. 534), src/screens/WeekScreen.tsx (r. 283, r. 374) en
  src/components/PickSheet.tsx (r. 296). **Bouwer B bezit in dit blok daarom ook TonightCard.tsx,
  RecipesScreen.tsx en WeekScreen.tsx, uitsluitend voor die ene prop-regel** (kritische lezer).
- **Integrator:** check/test/build, DEVICE-TEST rij 76, STATUS.md.

### Blok 4 — Categorieën + "+ bijgerecht" (eerst op /next/)
- **Bouwer A (data + domein):** data/categories.json (§2d), data/review/meta.json (`category` + `goesWith`
  erbij), tools/migrate-from-recepten2.ts (`DATA_VERSION = 7`) + migrate, src/components/CategoryShelf.tsx
  (`ICONS`), src/domain/planner.ts (`NON_MAIN_CATEGORIES`, `isMainDish`, `PlanItem.sideOf`, `sidesOf`,
  `mainItems`, `newSideItem`), src/domain/share.ts (`PlanPayloadItem.of`, `buildPlanEnvelope`,
  `parseEnvelope` → `sideOfRecipeId`), src/domain/photo-import.ts (`CATEGORY_WORDS`: `nagerecht:
  ['nagerecht', 'dessert', 'toetje', 'desserts', 'pudding']`, `gebak: ['gebak', 'baking', 'bakken',
  'cake', 'taart zoet', 'koek', 'koekjes', 'cookies', 'bake']` — let op: 'taart'/'pie'/'tart' blijven bij
  hartige-taart, `bijgerecht: ['bijgerecht', 'side dish', 'side', 'sides', 'bijgerechten', 'side dishes']`,
  `'ontbijt-lunch': ['ontbijt & lunch', 'ontbijt', 'lunch', 'breakfast & lunch', 'breakfast', 'brunch',
  'ontbijt en lunch', 'breakfast and lunch']`), tests/planner.test.ts, tests/share.test.ts,
  tests/token.test.ts + tests/fixtures/frozen-share-tokens.ts (`FROZEN_TOKEN_W_SIDE*`),
  tests/photo-import.test.ts, tests/apply-meta.test.ts.
  ⚠ Feitencheck: `'bake'` staat al in `CATEGORY_WORDS.oven`; `buildIndex` (photo-import.ts r. 100–109)
  houdt de eerste id per woord, dus `'bake'` blijft `oven` als `gebak` erna in de tabel komt. De
  importprompt toont de categorieën in de volgorde van `CATEGORY_WORDS` (`IMPORT_CATEGORY_IDS =
  Object.keys(CATEGORY_WORDS)`, r. 144), met `overig` nu als laatste sleutel.
- **Bouwer B (repo + Week-UI):** src/db/repo.ts (`addSideToPlan`, cascades in `removeFromPlan`,
  `setPlanServings`, `markPlanCooked`, wees-`sideOf` in `savePlan`), src/components/SideSheet.tsx (nieuw),
  src/screens/WeekScreen.tsx (hoofd/side-rijen, "+ bijgerecht", 🎲-cascade, samenvatting, pool met
  `mainOnly`), src/components/PickSheet.tsx (`PickFilter.all`, `applyPickFilter(..., { mainOnly })`,
  `PickChips` prop `mainOnlyToggle` + chip `pick.all`), src/components/TonightCard.tsx (dobbelsteenpool
  `mainOnly`) en src/components/WeekCard.tsx (weekregel alleen hoofdgerechten) — na Home A+ staat die
  logica daar, niet meer in HomeScreen.tsx —, src/i18n/week.ts (`pick.all`, `week.mainOnlyHint`,
  `week.addSide`, `week.sideTitle`, `week.sideSuggested`, `week.sideAll`, `week.sideAdded`,
  `week.sideNone`, `week.removeSide`, `week.sides`, `week.side`), src/styles/week.css (`.week-slot.side`;
  `.week-slot` staat daar op r. 96).
  Contract: `addSideToPlan(mainItemId: string, recipeId: string): Promise<PlanItem | undefined>` (undefined
  als de hoofd niet bestaat of dit bijgerecht er al onder staat); `applyPickFilter(recipes, f, dict, l,
  opts?: { mainOnly?: boolean })` — met `mainOnly` vallen recepten met een categorie uit
  `NON_MAIN_CATEGORIES` weg, behalve als `f.all === true` of `f.cats` zo'n categorie bevat.
- **Bouwer C (ontvangst van een weekplan):** het pad waar `PlanShare.items` PlanItems worden: dat is
  alleen `takePlan` in src/screens/InboxScreen.tsx (r. 455–495; 'replace' maakt items met
  `newPlanItem`, 'append' roept `addToPlan` aan en slaat recepten over die al in het plan staan).
  src/paste.ts draagt alleen het type `PlanShare` door (r. 19, 43); src/components/ImportPreview.tsx
  raakt geen weekplan. — `sideOfRecipeId` → `sideOf` van het nieuw gemaakte item voor dat recept,
  anders een gewoon gerecht; test in tests/share.test.ts of waar dat pad nu getest wordt.
  ⚠ Feitencheck: `takePlan` heeft nu geen unittest (het zit in een component); tests/share.test.ts
  test alleen `parseEnvelope`/`buildPlanEnvelope`.
- **Integrator:** `npm run build:next` eerst; DEVICE-TEST rijen 77–78; na Stijns test op beide telefoons
  naar main. STATUS.md.

### Blok 5 — Editor "Labels" + prompt ontbrekende ingrediënten
- **Bouwer A (domein):** src/domain/dictionary-prompt.ts (nieuw; §1f: `collectMissing`,
  `buildMissingPrompt`, `parseMissingAnswer`, `planMissingAnswer`), tests/dictionary-prompt.test.ts (nieuw).
  Contract: `collectMissing(own, recipes, dict, limit = 40): MissingItem[]` — eigen entries eerst (op
  naam), dan de niet-herkende regels gegroepeerd op `normalizeKey(line.name)`, namen ≤ 2 tekens en
  header-regels overgeslagen; `parseMissingAnswer` gebruikt `cleanPastedText` en leest `M1.`, `M1:`,
  `M1)`; `planMissingAnswer(items, rows, dict, newId)` geeft `{ updates, creates }` en raakt nooit een
  veld dat al ingevuld was.
- **Bouwer B (editor):** src/screens/EditScreen.tsx (de kaart `Labels` met h2 verhuist naar boven de
  knop Bewaar), src/i18n/edit.ts (`meta.title`, nieuwe tekst `meta.kindsHint`), src/styles/edit.css.
- **Bouwer C (woordenboek):** src/components/MissingSheet.tsx (nieuw; SheetPortal, kop met
  Annuleer/Zet in woordenboek), src/screens/DictionaryScreen.tsx (de kaart van §1f; schrijven via
  bestaande `saveUserIngredient`, `linkUserRecipeLine`, lezen via `userRecipes()`, daarna
  `reloadDictionary()`), src/i18n/edit.ts (alle `dict.missing*`-keys), src/styles/settings.css.
- **Integrator:** check/test/build, DEVICE-TEST rijen 79–80, STATUS.md.

### Gedeelde afspraken over alle blokken
- i18n-prefixen van deze spec: `filter.`, `tag.`, `meta.tag.` (lactosevrij), `variant.*.lactosevrij`,
  `dict.flag.*`, `dict.form.lactose*`, `filter.cuisine`, `recipe.cuisine`, `meta.cuisine`,
  `meta.cuisineNone`, `meta.title`, `pick.all`, `week.mainOnlyHint`, `week.*Side*`, `week.sides`,
  `week.side`, `dict.missing*`. Elke key in NL én EN, in het bestand dat hierboven genoemd is.
- Elke nieuwe sheet (SideSheet, MissingSheet) gebruikt `SheetPortal` + `.sheet-head.with-actions` /
  `.sheet-head-btn` (13J); een sheet die iets opslaat heeft Annuleer en de bewaarknop bovenaan, wegvegen
  bewaart niets; een kiezer (SideSheet) voert de keuze uit bij een tik op een rij.
- Geen nieuwe npm-dependency, nergens. Geen Dexie-versie in deze spec.

## 4. Stappenplan

Volgorde is vast; elk blok gaat apart online en is op zichzelf bruikbaar. Blokken 1–3 en 5 kunnen direct
naar `main` (ze veranderen geen deelformaat en breken niets voor een oudere app); blok 4 eerst op
`/next/` (het raakt het weekplan en `#w=`).

1. **Blok 1 — Lactose-data.** Klaar als: alle 1603 (of meer) entries in data/ingredients.json hebben
   `lactose`, `npm run validate:data` is groen met de drie nieuwe regels, tests/lactose.test.ts (de
   steekproef) en tests/apply-flag-slices.test.ts zijn groen, data/work/lactose/ bevat de tien slices
   als herkomst, data/README.md legt de strenge lezing uit. Geen UI, geen vlag: niemand merkt iets.
   Zwaarte: tien korte Haiku-agents + één Opus-bouwer + integrator.
2. **Blok 2 — Lactose-UI.** Klaar als: de vierde dieetchip werkt op Home, Recepten, Kies 7 en Week; de
   receptpagina toont "lactosevrij" en biedt "Maak lactosevrije versie" met de nieuwe swaps; het
   woordenboek toont en bewerkt de vlag; de importprompt noemt lactosevrij; de badge bestaat;
   recipes.json heeft `lactosevrij` op de klassiekers (DATA_VERSION 5) en docs/measure-diet.md toont
   hoeveel (verwacht: tientallen zeker, veel "unsure" door bouillon/worst; dat is eerlijk). Naar main.
3. **Blok 3 — Keukens.** Klaar als: data/cuisines.json + meta.json met 71 toewijzingen; de keukenrij
   staat op de vier plekken en de receptpagina toont de vlag; de editor heeft de rij Keuken; de
   importprompt vraagt om `Keuken:`; zoeken op "italiaans" werkt; DATA_VERSION 6; `cuisine` reist mee in
   een deellink (test). Naar main.
4. **Blok 4 — Categorieën + "+ bijgerecht".** Klaar als: de vier categorieën staan overal; de vijf
   bijgerechten staan in Bijgerecht (de polenta met goesWith → ratatouille); Kies 7 / Verras me / 🎲 /
   Home-dobbelsteen kiezen hoofdgerechten, met de schakelchip; "+ bijgerecht" werkt met SideSheet,
   cascades, boodschappenlijst en `#w=` (bevroren token W_SIDE); DATA_VERSION 7. **Eerst /next/**:
   Stijn (Android) en Gabi (iPhone) lopen DEVICE-TEST 77–78; daarna main. Geen aparte instelling of
   vlag in de code nodig: /next/ is de vlag.
5. **Blok 5 — Editor "Labels" + prompt ontbrekende ingrediënten.** Klaar als: de editor eindigt met
   de kaart Labels (categorie, keuken, dieet & labels) boven Bewaar; Woordenboek heeft de kaart
   "Ontbrekende gegevens aanvullen met AI" met prompt, plakvak, voorstelvenster en resultaat;
   tests/dictionary-prompt.test.ts groen. Naar main.

Daarna (buiten deze spec): de 20 bijgerechten via data/source/bijgerechten.json + tools/sides.ts + vier
keukens in meta.json (docs/specs/bijgerechten.md, `DATA_VERSION` 8), 13F (`DATA_VERSION` 9), en 13D
bouwt de tabs op `VARIANT_DIETS` (de lactosevrij-tab komt dan vanzelf mee).

Bij een afgebroken workflow (limiet): eerst de werkmap bekijken (`git status`), de tests draaien, dan
hervatten met `resumeFromRunId`; een half gemergde slice in blok 1 wordt door de validator tegengehouden,
dus `--check` is altijd de eerste stap na een onderbreking.

## 5. Regels en eerlijkheid

**Geraakte invarianten (CLAUDE.md) en hoe:**
- (1) ids veranderen nooit: de vijf bijgerechten wisselen van categorie, niet van id; `overig` krijgt
  een andere `order`, niet een andere id; een bijgerecht in de week is een PlanItem met een eigen
  `pi:`-id en `sideOf` wijst naar een item-id. Niets hernoemt een id.
- (2) raw-regels nooit weg: een lactosevrije versie herschrijft raw alleen in de NIEUWE kopie
  (bestaand gedrag van `makeVariant`); het voorstelvenster van 1f zet alleen `ing` via
  `linkUserRecipeLine` en laat raw staan; `applySlices` raakt alleen de vlaggen van een entry.
- (3) alles `{nl, en}`: cuisines.json en categories.json tweetalig; elke i18n-key in beide talen; een
  nieuw ingrediënt uit het AI-antwoord wordt alleen aangemaakt als nl én en er zijn (anders
  overgeslagen met `dict.missingRowSkipped`); een bestaand veld wordt nooit overschreven.
- (4) deelformaat als contract: `#w=` blijft `v: 2` met een optionele sleutel `of`; oude tokens blijven
  decoderen (de bestaande bevroren tokens blijven in de tests); het nieuwe bevroren token W_SIDE komt
  erbij en wordt daarna nooit aangepast; `cuisine` reist als gewone receptsleutel. Geen nieuwe
  fragmentsleutel, geen herinterpretatie.
- (5) iPhone eerlijk: de prompts hebben naast de kopieerknop een zichtbaar tekstvak; plakken is een
  gewone textarea; niets doet alsof een link de app opent. (6) landing.ts wordt niet aangeraakt.
- (8)/(9)/(11) ongewijzigd; het delen van een weekplan blijft `navigator.share({ text })` met één veld.
- (12) blok 4 draait eerst op /next/ met de eigen database `recepten-next`; een weekplan met `sideOf`
  op /next/ raakt de echte data niet.
- (13) deze spec belooft niets over achtergrondgedrag; (14) de AI blijft kopiëren/plakken buiten de
  app, geen server; (15) geen nieuwe dependency.

**Eerlijkheid in de teksten.** "Lactosevrij" betekent hier "zonder zuivelproduct, streng" (ghee en
oude kaas tellen mee). Dat staat in data/README.md en komt in de handleiding (blok Z, "achter de
schermen"); in de app zelf staat alleen de chip. "Waarschijnlijk lactosevrij" verschijnt zodra een
regel niet herkend is of een ingrediënt `lactoseUnsure` heeft; de filterchip toont zulke recepten niet.
Een keuken staat er alleen als het gerecht er echt vandaan komt; "wereld" blijft de losse verzamelnaam
en wordt niet automatisch omgezet. Een oudere app die een gedeeld weekplan met bijgerecht ontvangt, ziet
het bijgerecht als los gerecht; dat hoeft nergens gemeld te worden.

**iPhone vs Android.** Geen verschil in gedrag. Vlag-emoji's zijn op beide telefoons vlaggen (op de
Windows-pc letters: geen bug). De nieuwe sheets gebruiken SheetPortal (13J), dus de onderkant blijft op
de iPhone zichtbaar; DEVICE-TEST 78 controleert dat.

**Opus mag dit NIET zelf beslissen (zo doen als het hier staat, of vragen aan Stijn/Fable):**
1. De lactoseregels van §2a (ghee `true`, elke kaas `true`, margarine/halvarine `false, unsure`, H1
   vegan ⇒ false zonder unsure, non-food false). Een slice-agent die twijfelt kiest `false, unsure`,
   nooit `true` op een gok.
2. De steekproef van §2a is leidend: faalt tests/lactose.test.ts, dan is de slice fout, niet de test
   (behalve bij een id dat niet bestaat; dat wordt gemeld).
3. De 18 keukens met hun ids, namen, vlaggen en volgorde (§2c). Geen extra keuken (ook geen
   Zuid-Afrikaans, Russisch of Noors) en geen keuken-heuristiek in `suggestMeta` of in het plakken van
   websitetekst.
4. De 71 keukentoewijzingen van §2c: niets erbij, niets eraf; twijfel = null.
5. De vier categorie-ids, namen en volgorde (§2d) en de precies vijf hercategoriseringen (§2e).
   Boerenomelet, Roerei met courgette en de andere tien in Overig blijven staan (17 nu in Overig,
   min de vijf = 12).
6. "Hoofdgerecht" = categorie ∉ NON_MAIN_CATEGORIES (geen categorie telt als hoofdgerecht); de
   schakelchip `pick.all` staat NIET op het Recepten-scherm; een gekozen categoriechip van een
   niet-hoofdgerecht-categorie telt als "ja, die wil ik".
7. Het bijgerecht-model: een eigen PlanItem met `sideOf` (geen genest array), de cascades van §1d/§2d,
   `of` = recept-id in `#w=`, `v` blijft 2, één keer een bevroren token maken.
8. De editor blijft één formulier; "Labels" is de laatste kaart boven Bewaar, geen wizard en geen
   aparte route.
9. De prompt-formaten (de regel `Keuken:`/`Cuisine:` in de importprompt; `M1. nl: … | en: … | schap: …
   | vegan: … | gluten: … | lactose: …` in de ontbrekende-ingrediëntenprompt), de betekenis van `?` en
   `misschien`, en het maximum van 40 per prompt.
10. Eén badge (`zuivelvrije-ziel`, 🥥, tag lactosevrij, n 5, tier 1); verder geen badges (dat is 6D).
11. De UI-teksten van §1 letterlijk; past een tekst niet op 360 px, dan in beide talen inkorten en dat
    in het eindrapport melden, nooit een andere betekenis geven.
12. Geen Dexie-versie, geen nieuwe settings-key, geen nieuwe dependency, geen wijziging in
    src/landing.ts, src/sw.ts of src/domain/token.ts.
13. De swaps van §2b. Blijkt na blok 1 een `to` toch `lactose !== false` (de validator zegt het), dan
    de diet `lactosevrij` van díe swap halen en melden; geen andere `to` kiezen.
14. Het pad voor de 20 bijgerechten (data/source/bijgerechten.json + tools/sides.ts + meta.json voor de
    keukens, §2e en docs/specs/bijgerechten.md); geen ander mechanisme verzinnen en niets met de hand in
    recipes.json.

## 6. Testplan

### 6a. Unit tests (Vitest, tests/**/*.test.ts; bestand → gevallen)
- **tests/apply-flag-slices.test.ts** (nieuw, blok 1): `checkSlices` geeft een error voor (a) een id dat
  niet in ingredients.json staat, (b) een id in twee slices, (c) een id dat in geen slice staat (met
  het id in de tekst), (d) `lactose: true` + `lactoseUnsure: true`, (e) `vegan: true` + `lactose: true`,
  (f) `vegan: true` + `lactoseUnsure: true`; leeg voor een volledige, consistente set. `applySlices`:
  voegt `lactose` (en `lactoseUnsure`) toe direct na `gluten`/`glutenUnsure` in de sleutelvolgorde,
  laat alle andere velden ongemoeid, is idempotent (tweede keer = zelfde uitkomst).
- **tests/lactose.test.ts** (nieuw, blok 1): over het echte data/ingredients.json: elke entry heeft een
  boolean `lactose`; geen entry heeft `vegan: true` met `lactose: true` of met `lactoseUnsure`;
  `lactoseUnsure` alleen naast `lactose: false`; de steekproef van §2a (drie lijsten) klopt exact.
- **tests/validate-data.test.ts** (nieuw, blok 3; blok 1 mag er al mee beginnen): `validateDictionary`:
  half gevlagde set → error "lactose is set on N entries but missing on M"; vegan+lactose → error;
  lactoseUnsure zonder lactose → error; cuisines.json met dubbel id / zonder `flag` / zonder `en` →
  error. `validateSchema2`: `cuisine: 'italiaans'` ok, `cuisine: null` ok, `cuisine: 'mars'` → error;
  `category: 'bijgerecht'` ok. `validateSwaps`: een lactosevrij-swap met `to.lactose !== false` → error;
  `to` met `lactoseUnsure` → warning. `validateBadges`: rule `{ kind: 'tag', id: 'lactosevrij' }` ok.
  ⚠ Feitencheck: de bestaande `validateSwaps`-tests staan in tests/variants.test.ts (r. 350–405) en
  `validateSchema2` wordt al in tests/migrate.test.ts (r. 108) gedraaid; tests/validate-data.test.ts
  bestaat nog niet.
- **tests/diet.test.ts** (blok 2): de `FLAGGED`-fixture krijgt `lactose` (kaas/room true, ui/rijst/
  spaghetti/olijfolie/bouillonblokje false zonder unsure (bouillonblokje is `vegan: true`, H1), worst
  `false + lactoseUnsure`, mysterieuze-saus niets). Gevallen:
  '1 ui, 200 g rijst' → `lactosevrij: true`, niet unsure; '50 g kaas' → `false`; '100 g worst' →
  true + unsure; 'mysterieuze saus' → unsure; '200 ml plantaardige room' → true (qualifier); `applyDietTags`
  voegt `lactosevrij` toe bij zekere feiten en haalt het weg bij een contradictie; over de echte 196:
  'Ratatouille' lactosevrij true, 'Kaastaart' false, 'Tagliatelle Carbonara' false, aantal recepten met
  de tag ≥ 30.
  ⚠ Feitencheck: in de `FLAGGED`-fixture (tests/diet.test.ts r. 24) én in de echte data is
  `bouillonblokje` `vegan: true`; volgens H1 (§2a) hoort daar `lactose: false` zónder unsure. Het
  fixture-geval "bouillonblokje → unsure" botst dus met H1. In de fixture staan ook `worst`
  (`vegan: false`, r. 28) en `room` (r. 27). De bestaande verwachtingen in r. 44–103
  (`unsure`-lijsten, `applyDietTags`-uitkomsten) krijgen met een vierde dieet een extra element.
- **tests/variants.test.ts** (blok 2): `variantDietsFor` geeft `lactosevrij` voor een recept met kaas en
  niet voor een recept dat de tag al heeft; `planVariant(…, 'lactosevrij')`: 'boter' → 'vegan-boter'
  applies, 'feta' → unresolved; `makeVariant` naam "(lactosevrij)" / "(lactose-free)", tags krijgen
  `lactosevrij`, `lactosevrij-optie` valt weg; datatest: elke swap met diet lactosevrij heeft een `to`
  met `lactose: false` in het echte woordenboek.
- **tests/badges.test.ts** (blok 2): 44 badges; `zuivelvrije-ziel` telt kookbeurten van recepten met tag
  lactosevrij (2 van 5 bij twee kookbeurten).
- **tests/apply-meta.test.ts** (nieuw, blok 3/4): `checkMeta` errors voor onbekend recept-id, onbekende
  keuken, onbekende categorie, onbekend goesWith-id; `applyMeta` zet de velden en is idempotent; via
  `migrate()` met het echte meta.json: de vijf bijgerechten zijn `bijgerecht`, de polenta heeft
  `goesWith: ['b:ratatouille']`, precies 71 klassiekers hebben een `cuisine`, waaronder
  'b:spaghetti-bolognese' → italiaans en 'b:hutspot' → hollands; 'b:boeuf-stroganoff' heeft er geen.
- **tests/migrate.test.ts**: alleen r. 20 (`expect(DATA_VERSION).toBe(4)`) gaat mee met elke bump
  (5, 6, 7); verder ongewijzigd, moet groen blijven na elke `npm run migrate` (committed =
  gegenereerd).
- **tests/search.test.ts** (blok 3): 'italiaans' en 'italian' → groep `category` bevat Spaghetti
  Bolognese (de keukencheck gaat vóór de ingrediëntcheck, besluit §1b) en Spaghetti Bolognese staat NIET
  meer in de groep `ingredient`; een niet-Italiaans recept met peterselie staat bij 'italiaans' nog wél
  in `ingredient`; 'hollands' → Hutspot in `category`; 'pasta' geeft exact dezelfde groepen als vóór
  dit blok (vaste verwachting vastleggen vóór de wijziging).
- **tests/photo-import.test.ts** (blok 2–4): `tagIdsFromText('lactosevrij, snel')` → `['lactosevrij',
  'snel']`, 'dairy-free' → lactosevrij; `cuisineIdFromWord`: 'Italian' / 'italiaanse' / 'Italië' →
  italiaans, 'Dutch' → hollands, 'Zuid-Afrikaans' → undefined; `categoryIdFromWord`: 'side dish' →
  bijgerecht, 'Dessert' → nagerecht, 'Breakfast' → ontbijt-lunch, 'Baking' → gebak, 'Taart' blijft
  hartige-taart; `parseBilingualPlain` leest 'Keuken: italiaans' en 'Cuisine: Italian' naar `cuisine`;
  `buildImportPrompt('nl')` bevat 'Keuken: italiaans', 'bijgerecht' en 'lactosevrij'.
- **tests/planner.test.ts** (blok 4): `isMainDish` (geen categorie = true; bijgerecht = false);
  `excludeNonMain(recipes, { })` laat bijgerechten weg, `{ all: true }` of `{ cats: ['bijgerecht'] }`
  houdt ze; `sidesOf`/`mainItems`/`newSideItem` (servings = hoofd, `sideOf` = hoofd-id); `planHash`
  verandert als een bijgerecht erbij komt. (`excludeNonMain` is de pure helper in src/domain/planner.ts
  die `applyPickFilter` aanroept; zo blijft de test framework-vrij.)
- **tests/share.test.ts** (blok 3/4): `#r=`-roundtrip bewaart `cuisine: 'italiaans'` en tag
  `lactosevrij`; `buildPlanEnvelope` schrijft `of` op een bijgerecht en laat een bijgerecht van een
  gekookt hoofdgerecht weg; `parseEnvelope` leest `of` naar `sideOfRecipeId`; een item zonder `of` heeft
  geen `sideOfRecipeId`.
- **tests/token.test.ts** (blok 4): `FROZEN_TOKEN_W_SIDE` en `…_FFLATE` decoderen op beide engines
  naar `FROZEN_ENVELOPE_W_SIDE`; de bestaande bevroren tokens blijven ongewijzigd groen.
  (Het bestaande `FROZEN_TOKEN_W` wordt in tests/share.test.ts r. 322 getest, niet hier; zie §2d.)
- **tests/dictionary-prompt.test.ts** (nieuw, blok 5): `collectMissing`: eigen entry zonder `en` →
  `missing: ['en']`; aisle 'overig' → bevat 'aisle'; zonder `lactose` → bevat 'lactose'; een
  niet-herkende regel 'csipetke' in twee recepten → één item met twee posities; naam 'x' en
  header-regels overgeslagen; limit 40 (41 items → 40). `buildMissingPrompt`: bevat 'M1.', '?' voor wat
  ontbreekt, de ingevulde naam, de 17 schap-ids. `parseMissingAnswer`: gewone regel; 'M1:' en 'M1)';
  markdown-escapes en een codeblok eromheen; 'misschien' → 'unsure', 'yes'/'no'/'ja'/'nee'; rommel
  ertussen wordt genegeerd. `planMissingAnswer`: een update overschrijft geen ingevuld veld; een
  nieuwe entry vereist nl én en (anders overgeslagen); koppelt alle posities; onbekend schap-id →
  bestaand schap blijft; 'unsure' → `gluten: false, glutenUnsure: true` resp. lactose.
  ⚠ Feitencheck: een eigen entry "zonder `en`" komt via de formulieren niet voor: die zetten
  `en.one` = de Nederlandse naam (zie de ⚠ bij §1f).

### 6b. Fixtures
- tests/fixtures/frozen-share-tokens.ts: `FROZEN_TOKEN_W_SIDE`, `FROZEN_TOKEN_W_SIDE_FFLATE`,
  `FROZEN_ENVELOPE_W_SIDE` (§2d), één keer gemaakt met een klein node-script dat `encodeToken` op beide
  engines aanroept (zoals de eerdere tokens), daarna bevroren.
- tests/fixtures/test-dictionary.ts volgt de rule sheet: `boter` en `parmezaanse-kaas` `lactose: true`;
  `rookworst`, `braadworst` en `kippenbouillon` `lactose: false, lactoseUnsure: true`; alle andere entries
  `lactose: false` (de parser/render-tests veranderen daar niet door).
- data/work/lactose/slice-*.json zijn herkomst, geen fixtures; tests lezen data/ingredients.json.

### 6c. Acceptatiechecks in de dev-app (`npm run dev`, 375 px breed, licht én donker thema)
1. Recepten: de rij Dieet toont vier chips + "ook als optie"; Lactosevrij aan → Ratatouille erin,
   Kaastaart eruit; met "ook als optie" ook een recept met `lactosevrij-optie` (maak er één in de editor).
2. Receptpagina Tagliatelle Carbonara: knop "Maak lactosevrije versie" tussen glutenvrij en vegetarisch;
   de sheet toont boter → vegan boter, slagroom → sojaroom en kaas → vegan kaas (de regels van dit
   recept zijn `boter`, `slagroom` en "125 g geraspte kaas" = `kaas`; er staat geen room of Parmezaan
   in); Bewaar maakt "Tagliatelle Carbonara (lactosevrij)" met de tag.
3. Woordenboek: Parmezaan → "bevat lactose"; margarine → "misschien lactose"; sojamelk → "lactosevrij";
   een eigen ingrediënt bewerken toont de driewegkeuze Lactose.
4. Home: rij Keuken met vlaggen alleen voor aanwezige keukens; 🇮🇹 aan → de dobbelsteen geeft Italiaans.
5. Spaghetti Bolognese toont "🇮🇹 Italiaans" naast Pasta; Boeuf Stroganoff toont geen keuken.
6. Zoeken "italian" → groep met Italiaanse gerechten.
   ⚠ Feitencheck: nu komen er eerst 42 recepten onder het ingrediëntkopje (peterselie/Italiaanse
   kruiden), Spaghetti Bolognese daaronder; zie de ⚠ bij §1b.
7. Week leeg → Verras me: geen van de vijf bijgerechten; Kies 7 → chip Bijgerecht → precies vijf; ×
   → "ook bijgerechten & zoet" → Naanbrood komt terug.
8. Week met Kabeljauw met notencrumble → "+ bijgerecht" → SideSheet met "Past erbij" (drie) en "Alle
   bijgerechten"; tik Aardappelpuree → ingesprongen rij "↳"; personen 4→6 → lijst "Weekplan gewijzigd";
   Bijwerken → aardappelen met bron Aardappelpuree; × bij kabeljauw → beide weg.
9. Deel weekplan → Kopieer → plak in Meer → In & uit: het bijgerecht staat ingesprongen onder zijn
   hoofdgerecht; plak dezelfde link in de live app (oude versie) → los gerecht, geen fout.
10. Editor nieuw recept: laatste kaart "Labels" boven Bewaar met Categorie, Keuken (geen + 18), Dieet &
    labels; Met AI → prompt bevat Keuken:/lactosevrij/bijgerecht; geplakt antwoord met "Keuken:
    italiaans" zet de chip.
11. Woordenboek-kaart "Ontbrekende gegevens aanvullen met AI": telregel klopt; prompt in het vak;
    plak een met de hand geschreven antwoord (één M-regel) → voorstelvenster met Annuleer/Zet in
    woordenboek bovenaan → snack "1 aangevuld, 0 nieuw, 0 regels gekoppeld".
12. `npm run check`, `npm test`, `npm run build`, `npm run build:next`, `npm run validate:data` groen;
    `tests/migrate.test.ts` groen na elke migrate.

### 6d. DEVICE-TEST-rijen (definitief 75–80; NL en EN; de integrator zet elke regel om naar de tabelvorm van docs/DEVICE-TEST.md: nummer | stappen | goed)

- **75** **Lactosevrij (fase 6, 6B.1).** 1. Tik onderaan op **Recepten**. 2. Kijk naar de rij **Dieet** boven de lijst. 3. Tik op de chip **Lactosevrij**. 4. Tik op **×** links van de chips. 5. Typ in het zoekvak **carbonara** en open **Tagliatelle Carbonara**. 6. Kijk naar de knoppen boven het kopje **Ingrediënten**. 7. Tik op **Maak lactosevrije versie**. 8. Kijk bovenaan het venster en lees de regels. 9. Tik bovenaan op **Annuleer**. 10. Tik onderaan op **Meer**, dan op **Woordenboek**. Typ **parmezaan** en tik op de naam. **Goed:** 2. In de rij staan Vegetarisch, Vegan, Glutenvrij en **Lactosevrij** (de rij mag opzij schuiven). 3. De lijst wordt korter; **Ratatouille** staat erin, **Kaastaart** niet. 6. Onder het recept staat geen chipje "lactosevrij", wel de knop **Maak lactosevrije versie**. 8. Bovenaan staan **Annuleer** en **Bewaar**; in de lijst: boter wordt vegan boter, slagroom wordt sojaroom, kaas wordt vegan kaas. 10. Bij Parmezaanse kaas staat het kenmerk **bevat lactose**.
- **76** **Keukens met vlaggetjes (fase 6, 6B.2).** 1. Tik onderaan op **Home**. Kijk onder **Verras me** naar de chips. 2. Tik op **🇮🇹 Italiaans**. Tik op **🎲 Nog een**. 3. Tik op **×** bij de chips. 4. Tik onderaan op **Recepten**. Typ in het zoekvak **italiaans**. 5. Open **Spaghetti Bolognese** en kijk bij Categorie. 6. Open een eigen recept, tik op **Bewerk** en zoek de rij **Keuken**. Tik op **🇳🇱 Hollands**, tik nog een keer. **Goed:** 1. Onder Dieet staat een rij **Keuken** met vlaggetjes (Italiaans, Hollands, Spaans …). 2. Het voorstel is een Italiaans gerecht (pasta, risotto, ossobuco …). 4. De lijst toont de Italiaanse gerechten onder een kopje. 5. Naast **Pasta** staat **🇮🇹 Italiaans**. 6. De chip wordt groen; bij de tweede tik staat **geen** weer aan.
  ⚠ Feitencheck (76, stap 4): bij "italiaans" komen nu eerst 42 recepten onder het ingrediëntkopje
  (peterselie, Italiaanse kruiden), ook niet-Italiaanse; zie de ⚠ bij §1b. Op Home is er geen knop
  "Verras me": dat is het kopje boven de chips; de knop heet "🎲 Nog een" (`home.reroll`).
- **77** **Nieuwe categorieën; Kies 7 en Verras me kiezen hoofdgerechten (fase 6, 13E).** 1. Tik onderaan op **Week**. Staan er gerechten, tik dan rechtsboven op **Leeg** en bevestig. 2. Tik op **Verras me**. Lees de namen. 3. Tik op **🎲** bij een gerecht. 4. Tik onder de lijst op **+ Kies meer**. Tik op de chip **Bijgerecht**. 5. Tik op **×** bij de chips. Tik op de chip **ook bijgerechten & zoet**. Typ **naan**. 6. Sluit het venster. Tik onderaan op **Home** en kijk bij **Categorieën**. **Goed:** 2. Geen van de gerechten is Aardappelpuree, Rucola-spinazie pesto, Tomatensalsa, Naanbrood of Polenta. 3. Het nieuwe gerecht is ook geen bijgerecht. 4. De lijst toont precies deze vijf bijgerechten. 5. Naanbrood staat in de lijst. 6. Op de plank staat **Bijgerecht 5**; **Overig** staat als laatste.
- **78** **+ bijgerecht in de week en op de boodschappenlijst (fase 6, 13E).** 1. Zet **Kabeljauw met notencrumble** in de week (Recepten → het recept → **+ Deze week**). Tik onderaan op **Week**. 2. Tik onder dat gerecht op **+ bijgerecht**. 3. Kijk bovenaan en onderaan het venster. 4. Tik op **Aardappelpuree (bij kabeljauw met notencrumble)**. 5. Tik bij de kabeljauw twee keer op **+** bij het aantal personen. 6. Tik onderaan op **Boodschappen** en tik op **Bijwerken**. Zoek de aardappelen. 7. Terug in **Week**: tik op **Deel weekplan** en kijk naar het bericht. 8. Tik op **×** bij de kabeljauw. **Goed:** 2–3. Het venster heet **Bijgerecht bij Kabeljauw met notencrumble**; onder **Past erbij** staan Aardappelpuree, Rucola-spinazie pesto en Tomatensalsa, daaronder **Alle bijgerechten**; de onderkant van het venster is zichtbaar (ook op de iPhone). 4. Het venster sluit; onder de kabeljauw staat ingesprongen **↳ Aardappelpuree …** met alleen een ×; de samenvatting zegt "… · 1 bijgerecht". 5. Het bijgerecht heeft geen eigen aantal personen. 6. Er staat een balk "Weekplan gewijzigd"; na Bijwerken staan de aardappelen op de lijst met als bron het bijgerecht, anderhalf keer zoveel als bij 4 personen. 7. Eén link, delen werkt als altijd. 8. Het bijgerecht verdwijnt samen met de kabeljauw.
- **79** **De editor eindigt met Labels; de AI-prompt vult keuken en categorie (fase 6, 6B.3 + 6A.9).** 1. Tik op **Recepten**, rechtsboven op **+**, dan **Met AI**. 2. Tik op **Kopieer opdracht** en lees de tekst in het vak. 3. Plak de prompt in ChatGPT of Gemini met de tekst of foto van een Italiaans recept; tik op **Kopieer code** onder het antwoord. 4. Plak het in de app. 5. Scrol naar beneden tot boven **Bewaar**. **Goed:** 2. In de prompt staan de regels `Categorie:`, `Keuken:` en `Labels:`; de categorielijst noemt nagerecht, gebak, bijgerecht en ontbijt-lunch; bij de labels staat lactosevrij. 4. De melding "Categorie, keuken en labels overgenomen uit de tekst." verschijnt. 5. De laatste kaart heet **Labels**: Categorie is ingevuld, bij Keuken is **🇮🇹 Italiaans** groen, de dieetchips staan aan.
- **80** **Woordenboek: prompt voor ontbrekende ingrediënten (fase 6, 6B.4).** 1. Maak een eigen ingrediënt met alleen een Nederlandse naam (Meer → Woordenboek → **+ Nieuw ingrediënt**, bv. **csipetke**). 2. Scrol in het Woordenboek naar **Ontbrekende gegevens aanvullen met AI**. 3. Tik op **Kopieer prompt voor ontbrekende ingrediënten**. 4. Plak de prompt in je AI en kopieer het antwoord. 5. Tik op **Plak antwoord**, plak, tik op **Bekijk voorstel**. 6. Lees het venster. Tik bovenaan op **Zet in woordenboek**. 7. Typ **csipetke** in het zoekvak en tik op de naam. **Goed:** 2. De telregel zegt minstens "1 om aan te vullen". 3. "Gekopieerd ✓"; in het vak staat een regel die begint met **M1.** met vraagtekens voor wat ontbreekt. 6. Bovenaan staan **Annuleer** en **Zet in woordenboek**; er staat een regel "csipetke: Engels, schap, vegan, gluten, lactose aanvullen" met een vinkje. Daarna de melding "1 aangevuld, 0 nieuw, 0 regels gekoppeld". 7. De Engelse naam, het schap en de kenmerken staan ingevuld.
  ⚠ Feitencheck (80, stap 1): het formulier "+ Nieuw ingrediënt" bewaart de Nederlandse naam ook als
  Engelse naam (`en.one` = "csipetke"); zie de ⚠ bij §1f.

- **75** **Lactose-free (phase 6, 6B.1).** 1. Tap **Recipes** at the bottom. 2. Look at the **Diet** row above the list. 3. Tap the chip **Lactose-free**. 4. Tap **×** to the left of the chips. 5. Type **carbonara** in the search box and open **Tagliatelle carbonara**. 6. Look at the buttons above the heading **Ingredients**. 7. Tap **Make lactose-free version**. 8. Look at the top of the sheet and read the lines. 9. Tap **Cancel** at the top. 10. Tap **More** at the bottom, then **Dictionary**. Type **parmesan** and tap the name. **Goed:** 2. The row shows Vegetarian, Vegan, Gluten-free and **Lactose-free** (the row may scroll sideways). 3. The list gets shorter; **Ratatouille** is in it, **Cheese tart** is not. 6. There is no "lactose-free" chip under the recipe, but there is the button **Make lactose-free version**. 8. **Cancel** and **Save** are at the top; in the list butter becomes vegan butter, double cream becomes soya cream and cheese becomes vegan cheese. 10. Parmesan shows the property **contains lactose**.
- **76** **Cuisines with flags (phase 6, 6B.2).** 1. Tap **Home** at the bottom. Look at the chips under **Surprise me**. 2. Tap **🇮🇹 Italian**. Tap **🎲 Another**. 3. Tap **×** by the chips. 4. Tap **Recipes** at the bottom. Type **italian** in the search box. 5. Open **Spaghetti Bolognese** and look at Category. 6. Open one of your own recipes, tap **Edit** and find the row **Cuisine**. Tap **🇳🇱 Dutch**, then tap it again. **Goed:** 1. Under Diet there is a row **Cuisine** with flags (Italian, Dutch, Spanish …). 2. The suggestion is an Italian dish (pasta, risotto, ossobuco …). 4. The list shows the Italian dishes under a heading. 5. Next to **Pasta** it says **🇮🇹 Italian**. 6. The chip turns green; after the second tap **none** is on again.
- **77** **New categories; Pick 7 and Surprise me choose main dishes (phase 6, 13E).** 1. Tap **Week** at the bottom. If dishes are there, tap **Clear** at the top right and confirm. 2. Tap **Surprise me**. Read the names. 3. Tap **🎲** on one dish. 4. Under the list tap **+ Pick more**. Tap the chip **Side dish**. 5. Tap **×** by the chips. Tap the chip **sides & sweet too**. Type **naan**. 6. Close the sheet. Tap **Home** at the bottom and look at **Categories**. **Goed:** 2. None of the dishes is Mashed potato, Rocket and spinach pesto, Tomato salsa, Naan bread or Polenta. 3. The new dish is not a side dish either. 4. The list shows exactly those five side dishes. 5. Naan bread is in the list. 6. The shelf shows **Side dish 5**; **Other** comes last.
- **78** **+ side dish in the week and on the shopping list (phase 6, 13E).** 1. Put **Cod with nut crumble** in the week (Recipes → the recipe → **+ This week**). Tap **Week** at the bottom. 2. Under that dish tap **+ side dish**. 3. Look at the top and the bottom of the sheet. 4. Tap **Mashed potato (for cod with nut crumble)**. 5. On the cod, tap **+** by the servings twice. 6. Tap **Shopping** at the bottom and tap **Update**. Find the potatoes. 7. Back in **Week**: tap **Share week plan** and look at the message. 8. Tap **×** on the cod. **Goed:** 2–3. The sheet is called **Side dish for Cod with nut crumble**; under **Goes with it** are Mashed potato, Rocket and spinach pesto and Tomato salsa, under that **All side dishes**; the bottom of the sheet is visible (on the iPhone too). 4. The sheet closes; under the cod there is an indented **↳ Mashed potato …** with only an ×; the summary says "… · 1 side dish". 5. The side dish has no servings of its own. 6. A bar says "Week plan changed"; after Update the potatoes are on the list with the side dish as their source, one and a half times the amount for 4. 7. One link; sharing works as always. 8. The side dish disappears together with the cod.
- **79** **The editor ends with Labels; the AI prompt fills cuisine and category (phase 6, 6B.3 + 6A.9).** 1. Tap **Recipes**, **+** at the top right, then **With AI**. 2. Tap **Copy instruction** and read the text in the box. 3. Paste the prompt into ChatGPT or Gemini with the text or a photo of an Italian recipe; tap **Copy code** under the answer. 4. Paste it into the app. 5. Scroll down to just above **Save**. **Goed:** 2. The prompt has the lines `Category:`, `Cuisine:` and `Tags:`; the category list names nagerecht, gebak, bijgerecht and ontbijt-lunch; the tags include lactosevrij. 4. The message "Category, cuisine and labels taken from the text." appears. 5. The last card is called **Labels**: Category is filled in, **🇮🇹 Italian** is green under Cuisine, the diet chips are on.
- **80** **Dictionary: prompt for missing ingredients (phase 6, 6B.4).** 1. Make an own ingredient with only a Dutch name (More → Dictionary → **+ New ingredient**, e.g. **csipetke**). 2. In the Dictionary scroll to **Fill in missing details with AI**. 3. Tap **Copy prompt for missing ingredients**. 4. Paste the prompt into your AI and copy the answer. 5. Tap **Paste answer**, paste, tap **Review**. 6. Read the sheet. Tap **Add to dictionary** at the top. 7. Type **csipetke** in the search box and tap the name. **Goed:** 2. The count line says at least "1 to fill in". 3. "Copied ✓"; the box shows a line starting with **M1.** with question marks for what is missing. 6. **Cancel** and **Add to dictionary** are at the top; there is a line "csipetke: fill in English, aisle, vegan, gluten, lactose" with a tick. Then the message "1 filled in, 0 new, 0 lines linked". 7. The English name, the aisle and the properties are filled in.

## 7. Controlelijst voor Fable (eindcontrole)

1. data/ingredients.json: elke entry heeft een boolean `lactose`; `npm run validate:data` groen met de
   drie nieuwe regels; tests/lactose.test.ts bestaat en is groen; steekproef: ghee `true`,
   parmezaanse-kaas `true`, margarine `false + lactoseUnsure`, sojamelk `false`, pure-chocolade `false`
   zonder unsure (H1). data/work/lactose/ bevat tien slices; data/README.md legt de strenge lezing uit.
2. src/domain/diet.ts: `DIET_TAGS` heeft vier tags in de volgorde van §2b; qualifier `plantaardige` zet
   `lactose: false`; `npm run migrate` zette `lactosevrij` op de klassiekers (Ratatouille wel, Kaastaart
   niet); docs/measure-diet.md is hergenereerd en noemt lactosevrij.
3. Dieetrij: vier chips + "ook als optie" via `DietChips` op Home, Recepten, Kies 7 én Week (geen kopie
   per scherm); "ook als optie" dekt `lactosevrij-optie`; `OPTIE_TAG` compleet.
4. Varianten: `VARIANT_DIETS` = glutenvrij · lactosevrij · vegetarisch · vegan; elke swap met diet
   lactosevrij heeft `to.lactose === false` (validator én tests/variants.test.ts); de sheet gebruikt
   SheetPortal met Annuleer/Bewaar bovenaan; de nieuwe swaps ghee/roomkaas/kwark staan erin.
5. Woordenboek: drie lactose-kenmerken en de driewegkeuze in het bewerkformulier; data/badges.json heeft
   44 badges met `zuivelvrije-ziel` als enige nieuwe.
6. data/cuisines.json: precies de 18 van §2c (ids, namen, vlaggen, order); data/review/meta.json: precies
   de 71 toewijzingen van §2c, niets erbij; tools/apply-meta.ts gevalideerd en in `migrate` én
   `--apply all`; recipes.json telt 71 keukens; `cuisine` reist mee in `#r=` (test).
7. Keukenrij alleen met aanwezige keukens (verdwijnt bij lege lijst); receptpagina toont vlag + naam
   naast de categorie; zoeken op naam in beide talen; de rij Keuken in MetaRows (geen + 18, één
   tegelijk); de importprompt heeft `Keuken:`/`Cuisine:` + de regel "alleen als het echt …"; nergens een
   keuken-heuristiek.
8. data/categories.json: vier nieuwe, `overig` als laatste; precies vijf hercategorisaties + de
   goesWith van de polenta via meta.json; CategoryShelf-iconen; `CATEGORY_WORDS` kent de vier (en
   'taart' blijft hartige-taart).
9. Pool: Kies N, Verras me, 🎲, "Verras me" in het Kies-venster en de Home-dobbelsteen sluiten
   NON_MAIN uit; chip `pick.all` en een gekozen Bijgerecht-chip heffen dat op; het Recepten-scherm
   toont alles en heeft de schakelchip niet; `excludeNonMain` is pure code in planner.ts met tests.
10. Bijgerecht: PlanItem met `sideOf`; cascades personen/gekookt/verwijderen/🎲/Leeg kloppen (test in
    repo-gedrag via de dev-app, logica in planner.ts getest); SideSheet met "Past erbij" en "Alle
    bijgerechten"; samenvatting "… · N bijgerechten"; Home-weekkaart telt alleen hoofdgerechten;
    aggregate.ts is niet gewijzigd en de lijst telt het bijgerecht toch mee.
11. `#w=`: `of` wordt geschreven en gelezen; `FROZEN_TOKEN_W_SIDE` decodeert op beide engines; alle
    oudere bevroren tokens blijven groen; de ontvanger koppelt `sideOf`; `v` blijft 2, geen nieuwe
    fragmentsleutel; src/domain/token.ts onaangeraakt.
12. Editor: de kaart `Labels` is de laatste kaart boven Bewaar; `meta.kindsHint` heeft de nieuwe tekst;
    een AI-antwoord vult categorie, keuken en labels (metaManual) met de nieuwe `edit.importMeta`-tekst;
    CheckRecipesScreen compileert en toont de keukenrij.
13. Ontbrekende-ingrediëntenprompt: `collectMissing`/`buildMissingPrompt`/`parseMissingAnswer`/
    `planMissingAnswer` met de tests van §6a; MissingSheet met Annuleer/Zet in woordenboek bovenaan,
    wegvegen bewaart niets; nooit raw aangepast; nieuwe entry alleen met nl én en; limiet 40.
14. i18n: elke nieuwe key in NL én EN (grep per prefix uit §3 in src/i18n), geen hardgecodeerde
    UI-tekst in de nieuwe componenten; teksten gelijk aan §1 of ingekort mét melding in het rapport.
15. Hygiëne: src/db/db.ts nog op v7; package.json ongewijzigd; landing.ts/sw.ts onaangeraakt;
    `DATA_VERSION` 7 na blok 4 en `tests/migrate.test.ts` groen; `npm run check`, `npm test`, `npm run
    build`, `npm run build:next`, `npm run validate:data` groen; DEVICE-TEST 75–80 in NL én EN
    toegevoegd (hernummerd over alle specs); STATUS.md noemt de vijf blokken.

## 8. Open vragen voor Stijn

1. **Ghee.** Gekozen: ghee telt als lactosehoudend, consequent met "ook oude kaas telt" (streng =
   zonder zuivelproduct). Akkoord, of wil je ghee juist als lactosevrij (er zit vrijwel geen lactose
   meer in)? Eén woord in één slicebestand; verandert niets anders.
2. **De Nederlands-Italiaanse pasta's** (Macaroni met courgette, Pasta met tonijn, Lasagne met ham en
   spinazie, Kip met romige rodepestosaus …). Gekozen: geen keuken; alleen de echte Italianen (22) zijn
   🇮🇹. Of wil je "alles met pasta is Italiaans"? Dan groeit de lijst in meta.json; de code blijft gelijk.
3. **"lactosevrij-optie" op klassiekers** waar alleen wat kaas erover gaat (bv. Spaghetti al pomodoro
   e olive met Parmezaan): nu geen enkele. Wil je dat Fable bij de eindcontrole zo'n lijstje maakt, of
   laten we dat aan de gebruiker (de chip bestaat in de editor)?
