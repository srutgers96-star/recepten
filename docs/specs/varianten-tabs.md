# Spec 13D — Varianten als tabs, "Tip van de maker", eigen versie vs bewerken

Status: compleet (Fable, 22 okt 2026)
**Besluiten Fable na blok 1 (30 okt; gelden voor blok 2–4):** (1) Een vervanging die je in de goedkeur-sheet UITVINKT betekent
"deze regel laat ik zo, dat regel ik zelf": de sheet zet die regelindex in `checked` (naast de afgevinkte "controleer zelf"-
regels), zodat `variantView` de goedkeuring als `approved` ziet en niet als `stale`; een dieet met alleen uitgevinkte
vervangingen blijft dus bestaan ({swaps: [], checked: [i]}). Domein ongewijzigd; blok 2 bouwer B doet dit in de sheet.
(2) Het alternatief van een vervangen regel ("farfalle (of een andere pastasoort)" → alt `pasta`) moet op de dieettab ook
groen: `applyStoredSwap`/`applySwap` zetten naast `swappedFrom` ook `swappedAlt` (het alt-id, als dat er was) en
`findStepIngredients` neemt ook die naamvormen mee (blok 2, extra bouwer D). (3) `tagsWithVariants`: een goedgekeurde
vegan-tab geeft óók `vega-optie` (vegan is vegetarisch; spiegel `DIET_TAGS_FOR`), zodat het filter "vegetarisch (ook als
optie)" het recept vindt; een stale goedkeuring telt mee tot ze wordt ingetrokken (blok 2 bouwer D). (4) Een platte string
als `tip` wordt `{nl: s}` zoals bij description/servingTip (§2e wint van de §6-testregel). (5) Bouwer C-interpretaties
akkoord: `setPlanRecipe` wist `variant`; `generateList` geeft een niet-goedgekeurd slot zonder `variant` door;
`addToPlan` laat een bestaand slot ongemoeid (de UI roept `setPlanVariant` aan). (6) Bundelgrootte: de gedeelde chunk van
de Safari-landing groeide 23,6 → 28,7 kB gzip omdat share.ts/recipe-io.ts `VARIANT_DIETS` uit variants.ts halen; blok 2
bouwer D zet `VariantDiet`/`VARIANT_DIETS`/`DIET_TAGS_FOR`/`OPTIE_TAGS_FOR` in een klein `src/domain/diets.ts`
(variants.ts re-exporteert) en share.ts/recipe-io.ts importeren dat; doel: terug naar ±24 kB. (7) `matchQuantityText`
blijft letterlijk de spec volgen (geen tekst als de stap al een hoeveelheid noemt). Blok 1 mag direct naar main (§4).
Gebouwd: 30 okt 2026 (13D blok 1, workflow wf_bbad638a-243)

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (besluiten over specs heen in
docs/specs/README.md §2; bij tegenspraak wint README.md). Voor deze spec:
- Bouwvolgorde: 6B+13E en 13F zijn gebouwd vóór 13D. Daardoor: `DietTag`/`DIET_TAGS` kennen
  `lactosevrij` al en `dietTags()` heeft de lactosevrij-dimensie (de compileer-⚠ in §2a vervalt);
  `VARIANT_DIETS` staat al op `['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']` (6B nam de tabvolgorde
  van deze spec over); `activeVariantDiets()` geeft dus vanaf blok 2 vier tabs. **Blok 5 vervalt**: 6B
  blok 2 zette `lactosevrij` al in `SWAP_DIETS`/`SWAP_RULES` en in data/swaps.json.
- 13F heeft `variantOf`/`origin.basedOn` omgezet en de glutenvrije uiensoep als eigen recept laten staan
  (inbouwen.md §2b/§2d); 13D's blok 2 vervangt de "Ook als:"-chips en past DEVICE-TEST-rij 85 van 13F aan.
- **Dexie**: geen versie (13F heeft v8; de eerstvolgende vrije is v9). Bevestigd.
- Het nieuwe veld op `ListSource` heet **`diet?: VariantDiet`** (niet `variant`: `ListItem.variant` betekent
  al een kwalificatievariant zoals "rode"). §3 blok 1 bouwer C en §6 zijn aangepast.
- `patch.variants`/`patch.tip` worden genormaliseerd: `readPatchPayload` (share.ts) haalt `patch.variants`
  door `readVariants` en `patch.tip` door `readOptionalText`; `importBundle` laat overrides ongemoeid, dus
  `variantView` behandelt een niet-object in `stored` als `undefined` (tolerant).
- Kookbalk (13K, gebouwd vóór 13D): `CookingSession` krijgt in **blok 3** `variant?: VariantDiet | null`,
  `touchCooking(recipe, page, servings, variant)` en `cookPath` zet `&v=<diet>`; blok 3 bouwer A bezit
  daarvoor ook src/domain/cooking.ts, src/cooking.ts en tests/cooking.test.ts (één geval: `cookPath` met
  variant → `'/cook/b:x?step=3&srv=6&v=glutenvrij'`).
- §1b "porties-kiezer werkt niet op vervangen regels" was onduidelijk: de porties-kiezer schaalt álle
  regels (ook de vervangen, hun `grams` zijn al herrekend); alleen "Koppel ingrediënt" (?-chip) en de lange
  druk zijn uit op vervangen regels. Tekst aangepast.
- §7 punt 6 ("test op `approveVariant` + `getRecipe`") is een dev-app-check, geen Node-test (repo draait
  niet in vitest); §6 acceptatiecheck 2 dekt hem (herladen → nog vol, `swappedFrom` nergens in de rij).
- De woordenboek-delta van een `#r=` dekt alleen `r.lines`; een `toId` van een swap komt altijd uit het
  ingebouwde woordenboek (data/swaps.json), dus dat is nu geen gat. Komt er ooit een eigen-woordenboek-swap,
  dan moet `buildRecipeEnvelope` ook `variants.*.swaps[].toId` meenemen (nu niet bouwen).
- §6 acceptatiecheck 5 ("Glutenvrijbuiter 1/5") gaat uit van een vers testprofiel zonder eerdere
  glutenvrije kookbeurten.
- DEVICE-TEST-rijen zijn definitief **86–88**. De drie open vragen voor Stijn blijven (kookbeurt op de
  uiensoep-kopie; "ik eet glutenvrij"-instelling later; naam "(versie van Dino)"); standaard = zoals hier.

Feitencheck Opus, 22 okt 2026: 24 correcties
- §1a: `.detail-ingredients` bestaat nog niet (de sectie is nu een kale `<section class="section">`).
- §1c: wegvegen (greepbalkje + pointer-drag) bestaat nu alleen in CookedSheet, niet in VariantSheet.
- §1d: "+ Deze week" opent nu `/week` als het gerecht al in de week staat (`inWeek`).
- §1h: een klassieker heeft nu géén Bewerk-knop op het recept; "zoals nu" klopt niet.
- §1h/§4/§7: `recipe.copy*` en `variant.save*` vangen ook keys die blijven; exacte keys gezet.
- §2a/§3: `VariantDiet` en `VARIANT_DIETS` bestaan al (`VariantDiet = DietTag`, drie diëten).
- §2a: met `'lactosevrij'` in `VariantDiet` compileert `dietTags(…)[diet]` niet vóór 6B.
- §2b: `RecipeOverride.updatedAt` is verplicht; toegevoegd aan het voorbeeld.
- §2e: `recipeFingerprint` = naam + raw-regels (géén stappen); "zelfde versie" = `contentFingerprint`.
- §2e/§5: bij `#p=` vergelijkt `planPatch` de hele patch, dus daar komt een goedkeuring wél binnen.
- §2e: er is geen Qty-lezer in recipe-io.ts (`readLine` spreidt de regel zonder qty te controleren).
- §3 A: `OPTIE_TAGS_FOR` en `DIET_TAGS_FOR` zijn niet geëxporteerd (badges.ts heeft dat nodig).
- §3 A: `hashPairs` gebruikt `normalizeServings(p.servings)`; expressie gecorrigeerd.
- §3 A/§6: het spraakformaat is "naam hoeveelheid eenheid" zonder dubbele punt.
- §3 B/§6: `buildReadableRecipe` wordt getest in tests/message.test.ts; met url eindigt hij op de link.
- §3 C: het slotveld heet `locked`, niet `lock`.
- §3 blok 3 A: de tag-telling zit in de interne `derive()` van badges.ts.
- §3 blok 3 C: `hasTag`/`tagIdsIn`/`applyPickFilter` staan in PickSheet.tsx; RecipesScreen filtert niet zelf.
- §3 blok 4 A: `buildOverridePatch` en het eigen-recept-draft spreiden al; `tipNl/tipEn` = serveertip.
- §3 blok 4 B: de leesbare tekst komt uit `loaded.effective`, niet uit de envelop: niet automatisch.
- §3 blok 5: `validateSwaps` controleert al per dieet via `SWAP_RULES`; `SWAP_DIETS` kent 3 diëten.
- §6 unit: SCHOTEL-vegan heeft unresolved [3, 5] (gehakt én eieren); "approved" vraagt checked [3, 5].
- §6 acceptatie 1: Aardappel-broccoli gratin is niet vegan → heeft wél een tabrij; nu Ratatouille.
- §6/rij 86/87: de klassieker heeft geen eieren (vegan: gehakt = controleer zelf); stap 1 = "Spaghetti
  koken."; EN-knop heet "Make the shopping list".

Bron: docs/phase-6-spec.md 13D (punten 1–5, richting Fable, antwoord Stijn 13 okt: tabs akkoord,
"niet te druk, elegant en functioneel", varianten ook in de weekplanner kiesbaar, kleuren glutenvrij
geel · vegan groen · vegetarisch lichtbruin · lactosevrij wit, stippellijn = nog niet bevestigd, vol =
bevestigd, van nature al glutenvrij = meteen vol, persoonlijke versies als extra tab, links/rechts
swipen) en 13J (sheets met Annuleer/Bewaar bovenaan). Code gecontroleerd op 22 okt 2026.
Alles wat een keuze is, staat hier gekozen; bij twijfel §5.

## 1. Doel en gebruikersgedrag

**In één zin:** op het recept staat boven de ingrediënten een rustige rij tabs — Origineel ·
Glutenvrij · Vegetarisch · Vegan · (Lactosevrij) · persoonlijke versies. Een dieettab met stippellijn
is een voorstel; één keer "Controleer en keur goed" maakt hem vol, en daarna wissel je met een tik of
een veeg. Kookstand, groene stapingrediënten, boodschappenlijst en weekplanner volgen de gekozen tab.
Er wordt **geen nieuw recept** meer aangemaakt voor een dieetversie. Alle nieuwe teksten staan in
`src/i18n/variants.ts` (nieuw owner-bestand, prefixen `vt.`, `tip.`, `version.`, `week.variant`).

### 1a. De tabrij op het recept (RecipeScreen, boven de kop "Ingrediënten")

Zichtbaar **alleen als er iets te kiezen valt**: minstens één dieettab met status proposed/approved/
stale, óf minstens één persoonlijke versie (`variantsOf(id)`). Een recept dat van nature vegan en
glutenvrij is zonder persoonlijke versies toont géén rij (de dieetchips onder de titel zeggen het al).
Wordt de rij getoond, dan staan er, in deze volgorde, als 44 px hoge pillen in één horizontaal
scrollende regel (`.vtabs`, geen wrap, 8 px tussenruimte, 16 px zijmarge):
1. **Origineel** — `vt.tab.original` NL "Origineel" · EN "Original". Neutraal (kaartkleur, `--line`-rand).
2. Per actief dieet (§5 lactosevrij) een tab met de dieetkleur (§1f):
   `vt.tab.glutenvrij` "Glutenvrij" · "Gluten-free"; `vt.tab.vegetarisch` "Vegetarisch" · "Vegetarian";
   `vt.tab.vegan` "Vegan" · "Vegan"; `vt.tab.lactosevrij` "Lactosevrij" · "Lactose-free".
   - `natural` → **vol** met "✓ " ervoor, niet kiesbaar (`aria-disabled`, veeg slaat hem over),
     aria-label `vt.naturalAria` "Van nature {diet}" · "Naturally {diet}" ({diet} = het tablabel
     in kleine letters). Tik = korte snack `vt.naturalSnack` "Dit recept is al {diet}." ·
     "This recipe is already {diet}."
   - `proposed` en `stale` → **stippellijn** (2 px dashed in de dieet-inktkleur, transparante vulling).
   - `approved` → **vol** (dieetachtergrond, dieetinkt).
3. Per persoonlijke versie (oudste eerst) een tab in de persoonlijke kleur (`--diet-personal-*`), vol,
   label = de voornaam van de maker: `origin.author` (eigen) of `origin.receivedFrom` (ontvangen), eerste
   woord, anders `vt.tab.version` "Versie" · "Version". Twee versies van dezelfde maker krijgen
   "Dino 2" (volgnummer).

De gekozen tab krijgt een 2 px `--ink`-rand (`.vtab.on`) en `aria-selected`; de rij is `role="tablist"`,
aria-label `vt.rowAria` "Versies van dit recept" · "Versions of this recipe". Keuze-bron, in deze
volgorde: query `?v=<diet|recipeId>` → onthouden keuze per recept op dit toestel (localStorage
`recepten.vtab`, map id → waarde, patroon src/recent.ts, nooit in de back-up) → Origineel. Een tab die
niet (meer) bestaat valt terug op Origineel. Een tik of veeg zet `?v=` (replace) én de onthouden keuze.
**Vegen**: op de hele ingrediëntensectie (`.detail-ingredients` — nieuwe klasse: nu is het een kale
`<section class="section">` met kop `recipe.ingredients` in RecipeScreen.tsx; `touch-action: pan-y`) met dezelfde
pointer-logica als de kookstand: horizontale verplaatsing ≥ 60 px en groter dan de verticale = naar
links volgende tab, naar rechts vorige; drempel 12 px voordat het als veeg telt; `natural`-tabs worden
overgeslagen; een veeg die op een knop begon telt niet als tik (`onClickCapture`, zoals CookScreen).

De bestaande blok-F-elementen verdwijnen van het recept: de knoppen "Maak glutenvrije/vegetarische/
vegan versie" (`.detail-variant-make`), de "Ook als: …"-chips (`.detail-variants`) en hun i18n-keys
(§3). De link **"Versie van <origineel>"** op een persoonlijke versie blijft (`recipe.variantOf`).

### 1b. Wat een gekozen tab laat zien

- **Origineel**: de pagina zoals nu.
- **Dieettab** (proposed/stale/approved): boven de ingrediëntenlijst een smalle statusregel
  (`.vtab-status`, dieetkleur links als 4 px balk):
  - proposed: `vt.status.proposed` "Nog niet bevestigd. Controleer de vervangingen en keur ze goed." ·
    "Not confirmed yet. Check the swaps and approve them." + knop `vt.approve` "Controleer en keur
    goed" · "Check and approve" (opent de goedkeur-sheet, §1c).
  - stale: `vt.status.stale` "Het recept is veranderd sinds de goedkeuring. Controleer deze versie
    opnieuw." · "The recipe changed since it was approved. Check this version again." + knop
    `vt.recheck` "Opnieuw controleren" · "Check again" (zelfde sheet, vooringevuld met wat nog past).
  - approved: `vt.status.approved` "Goedgekeurd door {name} op {date}" · "Approved by {name} on
    {date}" (zonder naam: `vt.status.approvedAnon` "Goedgekeurd op {date}" · "Approved on {date}";
    datum via `formatShortDate`) en rechts een kleine tekstknop `vt.revoke` "Intrekken" · "Withdraw"
    → `confirm(t('vt.revokeConfirm'))` "Goedkeuring intrekken? De tab wordt weer een voorstel." ·
    "Withdraw the approval? The tab becomes a proposal again." → `revokeVariant`.
  Daaronder de **ingrediëntenlijst met de regels van deze versie** (`view.lines`), met markeringen
  (§1f): een vervangen regel krijgt een 3 px balk links in de dieetkleur; een "controleer zelf"-regel
  een oranje stip (`--orange`) vóór de tekst met aria-label `variant.check` (bestaat: "controleer
  zelf" · "check yourself") en — alleen bij approved — klein "✓" erachter als hij afgevinkt was.
  Onder de lijst één grijze regel `vt.legend` "Gekleurde regels zijn vervangen; een oranje stip
  betekent: controleer zelf." · "Coloured lines are swapped; an orange dot means: check yourself."
  (alleen als er minstens één markering is). De porties-kiezer schaalt gewoon álle regels (ook de
  vervangen: hun `grams` zijn al herrekend). "Koppel ingrediënt" (?-chip) en de lange druk werken op een
  dieettab NIET op vervangen regels (die zijn afgeleid; `lockedIndexes`): `linkable` blijft aan voor de
  overige regels. De stappen eronder tonen de groene ingrediënten van déze regels (§1d).
- **Persoonlijke versie**: statusregel `vt.personal.by` "Versie van {name}" · "{name}'s version"
  (+ de volledige naam van de versie als die anders is) met knop `vt.personal.open` "Open als recept" ·
  "Open as a recipe" (→ `/recipe/<versie-id>`), daaronder de ingrediënten en stappen van de versie
  (gewone lijst, geen markeringen; de versie heeft eigen regels). Koken/Gekookt/Deel/+ Deze week op
  deze tab werken op de **versie** (zijn id), zie §1d.

De dieetchips onder de titel, de naam, meta en foto's blijven die van het origineel. Nieuw bij de
dieetchips: een goedgekeurde variant telt als "-optie" (`glutenvrij-optie` enz.) — zie §1g.

### 1c. Goedkeuren: de sheet (VariantSheet.tsx, herbouwd; SheetPortal + Annuleer/Goedkeuren bovenaan)

Kop: links `common.cancel`, midden `vt.sheet.title.<diet>` — "Glutenvrije versie goedkeuren" ·
"Approve the gluten-free version" / "Vegetarische versie goedkeuren" · "Approve the vegetarian
version" / "Vegan versie goedkeuren" · "Approve the vegan version" / "Lactosevrije versie
goedkeuren" · "Approve the lactose-free version" — rechts `vt.sheet.approve` "Goedkeuren" · "Approve"
(`.sheet-head-btn.save`). Wegvegen, ernaast tikken, Annuleer en Escape bewaren niets (13J).
⚠ Feitencheck: wegvegen bestaat nu alleen in src/components/CookedSheet.tsx (greepbalkje + pointer-drag,
`drag`-ref); de huidige VariantSheet en SheetPortal kunnen dat niet (ernaast tikken, Annuleer en Escape
wél). De herbouwde sheet moet het CookedSheet-patroon overnemen, anders klopt rij 86 stap 3 niet.
Intro `vt.sheet.intro`: "Vink uit wat je niet wilt vervangen. Regels met ! kan de app niet zelf
vervangen: vink ze af zodra je ze zelf hebt bekeken." · "Untick what you do not want swapped. Lines
marked ! cannot be swapped by the app: tick them once you have looked at them yourself."
Rijen (volgorde als nu: eerst vervangingen, dan controleer-zelf, elke groep op regelvolgorde):
- vervanging: checkbox (aan), oude regel doorgestreept, nieuwe regel vet, kooknotitie eronder (bestaand).
- controleer zelf: `!`-markering, de regel, `variant.check`, de hint (`variant.checkSwap` /
  `variant.checkHint`, bestaan) en een checkbox met label `vt.sheet.checked` "Gecontroleerd" ·
  "Checked" (uit).
Voet: `vt.sheet.foot` "Dit maakt geen nieuw recept: de versie wordt een tabblad op dit recept.
Intrekken kan altijd." · "This does not make a new recipe: the version becomes a tab on this recipe.
You can withdraw it any time." **Goedkeuren is pas actief** als elke controleer-zelf-rij is afgevinkt
en er een profiel is; anders staat eronder `vt.sheet.needChecks` "Vink eerst elke ‘controleer
zelf’-regel af." · "Tick every ‘check yourself’ line first." (`variant.noProfile` zonder profiel).
Goedkeuren → `approveVariant(recipeId, diet, { swaps, checked }, by)` → sheet dicht, tab vol, snack
`vt.approvedSnack` "{diet} versie goedgekeurd" · "{diet} version approved" ({diet} = tablabel).
Bij `stale`: de checkboxes van swaps die nog passen staan aan, de rest is weg; eerder afgevinkte
indexen staan weer aan als die regel nog hetzelfde `ing` heeft. Zonder enige vervanging en zonder
controleer-zelf-regel bestaat de tab niet (dan is hij `natural`), dus de sheet is nooit leeg.

### 1d. Koken, Gekookt, delen, week vanaf een tab

- **Koken** op een dieettab → `/cook/<id>?srv=N&v=<diet>`. De kookstand toont in de kicker
  `vt.version.<diet>` ("Glutenvrije versie" · "Gluten-free version", "Vegetarische versie" ·
  "Vegetarian version", "Vegan versie" · "Vegan version", "Lactosevrije versie" · "Lactose-free
  version") boven "Klaarzetten"/"stap 3 van 7", gebruikt `view.lines` voor Klaarzetten, de groene
  stapingrediënten, "Toon hoeveelheden" en "hoeveel?" (§3 stepingredients), en logt bij Gekookt!
  `variant: diet`. Een `?v=` die niet (meer) approved is valt stil terug op het origineel (geen kicker).
  Op een persoonlijke-versie-tab opent Koken de versie zelf (`/cook/<versie-id>`).
- **✓ Gekookt** (CookedSheet) krijgt `variant` mee en logt het; **Beoordeel** ongewijzigd.
- **Deel** op een dieettab → `/share/<id>` (het recept reist met ál zijn goedgekeurde varianten;
  de ontvanger kiest zelf). Op een persoonlijke-versie-tab → `/share/<versie-id>`.
- **+ Deze week** op een dieettab → `addToPlan(id, undefined, diet)`; staat het gerecht er al, dan
  wordt de versie van dat slot gezet (`setPlanVariant`). Op een persoonlijke-versie-tab → de versie.
  ⚠ Feitencheck: nu toont de knop bij een gerecht dat al in de week staat "✓ Staat in je week"
  (`recipe.inWeek`) en navigeert hij naar `/week` (`onAddToWeek`, `inWeek`) zonder `addToPlan`;
  `addToPlan` zelf geeft bij een bestaand gerecht het bestaande slot ongewijzigd terug.
- **Print / Kopieer als tekst** volgen de getoonde regels (ze lezen `lines`), de naam krijgt bij een
  dieettab het achtervoegsel uit `vt.version.<diet>` tussen haakjes: "Spaghettischotel (glutenvrije
  versie)" — alleen in de tekst/print, nooit in de opgeslagen naam.

### 1e. Weekplanner en boodschappenlijst

- Onder de naam van een slot (WeekScreen, `.week-slot`) staat, **alleen** als het recept ≥ 1
  goedgekeurde dieettab of ≥ 1 persoonlijke versie heeft, een kleine chip met de huidige keuze
  (`vt.tab.original` als niets gekozen; anders het tablabel in de dieetkleur, vol). Tik → een rij
  keuzechips eronder (`role="radiogroup"`, aria-label `week.variantAria` "Versie voor dit gerecht" ·
  "Version for this dish"): Origineel · goedgekeurde diëten · persoonlijke versies (label = voornaam).
  Een dieet → `setPlanVariant(slotId, diet)`; een persoonlijke versie → het slot krijgt het id van die
  versie (`setPlanRecipe(slotId, versionId)`, servings blijven); Origineel vanuit een versie → terug
  naar `variantOf`. Grijze hint onder de rij: `week.variantHint` "Alleen goedgekeurde versies; keur ze
  goed op het recept." · "Only approved versions; approve them on the recipe." Nog een tik op de chip
  klapt de rij dicht. Niet-goedgekeurde diëten worden niet aangeboden (eerlijk: eerst controleren).
- Tik op de naam van een slot met een versie → `/recipe/<id>?v=<diet>` (de tab staat meteen goed).
- **Boodschappenlijst**: `generateList` geeft `aggregate` per slot de regels van de gekozen versie
  (§3). "Waarvoor is dit?" toont de vervangen regel ("400 g glutenvrije pasta"). Een versie wisselen
  verandert `planHash` → de bestaande banner "Weekplan gewijzigd — Bijwerken" doet de rest.
- **Weekplan delen** (`#w=`) stuurt `vr` mee; de ontvanger neemt de versie over als zijn recept die
  tab goedgekeurd heeft, anders Origineel (stil). Bij "Overnemen"/"Toevoegen" in In & uit krijgt het
  nieuwe slot `variant` mee.
- Home "Vanavond" (Home A+-spec) mag het tablabel achter de naam zetten; dat regelt die spec.

### 1f. Kleuren en vorm (tokens in base.css, in de drie themablokken)

Licht:
`--diet-glutenvrij-bg: #f7e9a8; --diet-glutenvrij-ink: #5c4a05;`
`--diet-vegetarisch-bg: #e6cfb3; --diet-vegetarisch-ink: #5a3b1a;`
`--diet-vegan-bg: #cdeac6; --diet-vegan-ink: #1e4f1d;`
`--diet-lactosevrij-bg: #ffffff; --diet-lactosevrij-ink: #3b4a5a;` (wit: altijd met `--line`-rand)
`--diet-personal-bg: #dbe4fa; --diet-personal-ink: #233f86;`
Donker (beide donkerblokken identiek, zoals de bestaande tokens):
`--diet-glutenvrij-bg: #5a4a10; --diet-glutenvrij-ink: #f7e9a8;`
`--diet-vegetarisch-bg: #5c4028; --diet-vegetarisch-ink: #eed5bb;`
`--diet-vegan-bg: #244d22; --diet-vegan-ink: #cdeac6;`
`--diet-lactosevrij-bg: #1f2d44; --diet-lactosevrij-ink: #e8eef6;`
`--diet-personal-bg: #22365e; --diet-personal-ink: #dbe4fa;`
Klassen: `.vtab` (pil, 44 px, 14 px/600, `touch-action: manipulation`), `.vtab.diet-<diet>`,
`.vtab.personal`, `.vtab.dotted` (dashed inktkleur, transparant), `.vtab.full` (bg + inkt),
`.vtab.natural` (full + ✓, cursor default), `.vtab.on` (2 px `--ink`-rand). Ingrediëntregels:
`.ing-item.swapped.diet-<diet>` (3 px linkerbalk in `--diet-<diet>-ink`), `.ing-item.check-self`
(oranje stip 8 px). Alles rustig: geen achtergrondkleur over de hele pagina, alleen de tabs, de
statusbalk en de regelmarkeringen dragen kleur.

### 1g. "Tip van de maker", privénotitie en delen

- Op het recept, onder de stappen en vóór "Bij dit gerecht": als `recipe.tip` tekst heeft in een taal,
  een kaartje `.detail-tip` met 💡 en kop `tip.title` "Tip van {name}" · "Tip from {name}" ({name} =
  `origin.author` voor eigen, `origin.receivedFrom` voor ontvangen, `override.by` voor een klassieker
  met tip in de patch; zonder naam `tip.titleAnon` "Tip van de maker" · "Maker's tip") en de tekst
  (`pickText(recipe.tip, l)`). Geen tip = geen kaartje.
- **Bewerken**: in de editor (EditScreen) een veld onder "Serveertip": label `edit.tip.label` "Tip van
  de maker" · "Maker's tip", twee tekstvakken NL/EN zoals servingTip, hint `edit.tip.hint` "Reist mee
  als je het recept deelt. Je privénotitie reist nooit mee." · "Travels with the recipe when you share
  it. Your private note never does.", placeholder `edit.tip.placeholder` "Bv. Nog lekkerder na een
  dag in de koelkast." · "E.g. Even better after a day in the fridge.". Werkt ook in override-stand
  (klassieker): dan in de patch (`buildOverridePatch` zet `tip` als hij afwijkt van het origineel).
- **Privénotitie blijft privé.** Onder het notitievak komt bij een bewerkbaar recept een tweede grijze
  zin `recipe.notesTipHint` "Iets meegeven aan wie dit recept krijgt? Zet het in ‘Tip van de maker’
  (Bewerk)." · "Want to pass something on to whoever gets this recipe? Put it in ‘Maker's tip’ (Edit)."
- **Delen** (ShareScreen): heeft het actieve profiel een notitie bij dit recept, dan staat boven het
  voorbeeld een schakelrij (checkbox, 44 px): `share.noteAsTip` "Mijn notitie meesturen als tip van
  de maker" · "Send my note along as the maker's tip", eronder `share.noteAsTipHint` "Je notitie blijft
  privé op deze telefoon; alleen deze link krijgt hem als tip." · "Your note stays private on this
  phone; only this link carries it as a tip." Aan → de envelop krijgt `tip: { [uiTaal]: notitie }`
  (bij een bestaande tip: eraan geplakt met een lege regel ertussen); het opgeslagen recept verandert
  niet. Standaard uit. Bij een klassieker als `#p=`: `patch.tip`. De leesbare tekst ("Deel als tekst")
  krijgt onderaan `💡 ` + de tip (readableBlock), na de serveertip.
- **In & uit** (ImportPreview): onder de samenvattingsregel van een recept klein `inbox.withTip` "met
  een tip van de maker" · "with a tip from the maker" en/of `inbox.withVariants` "met {n} goedgekeurde
  versie(s)" → twee keys: `inbox.withVariant1` "met een goedgekeurde versie" · "with one approved
  version", `inbox.withVariants` "met {n} goedgekeurde versies" · "with {n} approved versions".

### 1h. "Recept bewerken" vs "Eigen versie maken"

Onderaan het recept (`.detail-manage`):
- Eigen/ontvangen recept: **Recept bewerken** (`recipe.edit` "Recept bewerken" · "Edit this recipe";
  vervangt `common.edit` op deze plek) · **Eigen versie maken** (`version.make` "Eigen versie maken" ·
  "Make my own version") · Verwijder. Grijze hint `version.hint` "Bewerken verandert dit recept. Een
  eigen versie laat het origineel staan, hangt eraan als tabblad en is apart te delen." · "Editing
  changes this recipe. Your own version leaves the original alone, hangs on it as a tab and can be
  shared on its own."
- Klassieker: **Recept bewerken** opent zoals nu de override-stand (de bestaande knoppen in de editor);
  ⚠ Feitencheck: op het recept van een klassieker staat nu géén Bewerk-knop (`.detail-manage` toont
  alleen "Maak eigen kopie"); de override-stand van EditScreen (`/edit/<b:id>`, `overrideMode`) bestaat
  wel, maar is nu alleen via de EN-badge "Machine translation" (`.translation-badge`) bereikbaar. De
  knop "Recept bewerken" is op een klassieker dus nieuw.
  **Eigen versie maken** vervangt "Maak eigen kopie" (keys `recipe.copy`, `recipe.copyHint`,
  `recipe.copyNoProfile` weg; `recipe.copyAsText` en `recipe.copyFailed` blijven); hint als hierboven;
  zonder profiel `version.noProfile` "Kies eerst een profiel (Meer) om een eigen versie te maken." ·
  "Choose a profile first (More) to make your own version."
- Eigen versie maken → `makeOwnVersion(recipe, profile)` (§3): kopie met `variantOf: recipe.id`,
  `origin.basedOn: recipe.id`, naam "Goulash (versie van Dino)" · "Goulash (Dino's version)" per
  aanwezige taal (domein `versionName(name, author)`), zonder `variants`/`tip` van het origineel →
  editor open (`/edit/<nieuw id>`). Op het origineel verschijnt de tab "Dino". Delen van de versie =
  gewoon `#r=`; de ontvanger ziet hem als tab op zijn origineel als dat bestaat (zelfde id), anders als
  los recept met "Versie van …" zonder link — zoals blok F al deed.

### 1i. Lege staten en fouten
- Geen rij als er niets te kiezen valt (1a). Geen profiel: Goedkeuren uit met `variant.noProfile`.
- `approveVariant`/`revokeVariant` mislukt → `variant.saveFailed` (bestaat) in de sheet / als snack.
- iPhone vs Android: geen verschil in dit blok, behalve dat "Deel" op iPhone zoals altijd via kopiëren →
  app → plakken aankomt (invariant 5); de tabs reizen in dezelfde link.

## 2. Datamodel en migraties

**Kernbesluit.** Een dieetvariant is **geen kopie** meer maar een **goedgekeurde set vervangingen
bovenop het origineel**, opgeslagen bij het recept zelf: op een eigen/ontvangen recept als veld
`Recipe.variants`, op een klassieker in de **override-laag** (`RecipeOverride.patch.variants`, zoals
elke andere aanpassing van een klassieker). Zo reist een goedgekeurde variant vanzelf mee in `#r=`
(het recept) en `#p=` (de patch), komt hij vanzelf in de back-up (`userRecipes` / `overrides`) en
is er **geen nieuwe Dexie-versie en geen tabel** nodig. Dexie blijft op de versie die 13F achterlaat
(v8); de voorlopige "v9" vervalt. Persoonlijke versies blijven echte recepten (`variantOf`).

### 2a. Types (src/domain/model.ts en src/domain/variants.ts)

```ts
// src/domain/variants.ts
/** De dieettabs, in de volgorde van de tabrij. 'lactosevrij' pas actief als DIET_TAGS hem kent (§5). */
export type VariantDiet = 'glutenvrij' | 'vegetarisch' | 'vegan' | 'lactosevrij';
export const VARIANT_DIETS: readonly VariantDiet[] = ['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij'];
/** De tabs die deze build echt aanbiedt: VARIANT_DIETS gefilterd op DIET_TAGS (diet.ts). */
export function activeVariantDiets(): VariantDiet[];

/** Eén goedgekeurde vervanging; alles wat de weergave nodig heeft staat erin (swaps.json mag veranderen). */
export interface StoredSwap {
  /** Index in de effectieve regels van het recept op het moment van goedkeuren. */
  index: number;
  /** ingredients.json-id dat er stond; klopt `lines[index].ing` niet meer, dan is de swap 'stale'. */
  fromId: string;
  toId: string;
  /** De nieuwe raw-tekst per taal (alleen de talen die de regel had). */
  raw: Text;
  name?: string;
  /** Gezet als "4 kipfilets" → "800 g tofu" (zie VariantSwap.grams). */
  grams?: Qty;
  [k: string]: unknown;
}

export interface RecipeVariant {
  approved: boolean;
  approvedAt?: string;
  /** Profielnaam van wie goedkeurde, of null. */
  by?: string | null;
  swaps: StoredSwap[];
  /** Regelindexen die het dieet breken zonder vervanging en die bij goedkeuren zijn afgevinkt. */
  checked: number[];
  [k: string]: unknown;
}

export type RecipeVariants = Partial<Record<VariantDiet, RecipeVariant>> & { [k: string]: unknown };
```
⚠ Feitencheck: `VariantDiet` en `VARIANT_DIETS` bestaan al in src/domain/variants.ts, als
`export type VariantDiet = DietTag;` en `VARIANT_DIETS = ['glutenvrij', 'vegetarisch', 'vegan']` (blok F);
13D vervangt die definities. `DietTags` (diet.ts) heeft geen `lactosevrij`-veld, dus met `'lactosevrij'`
in `VariantDiet` compileren `dietTags(…)[diet]` in `lineBreaksDiet`/`variantDietsFor` en regel 1 van
`variantView` niet onder strict TS tot 6B die dimensie toevoegt (of de bouwer moet daar op `DietTag` vernauwen).
**Besluit (kritische lezer):** 6B is vóór 13D gebouwd; `DietTag` kent `lactosevrij` en `VARIANT_DIETS`
staat al in deze volgorde. De bouwer verandert `VariantDiet`/`VARIANT_DIETS` dus niet meer, alleen de
nieuwe types eronder.

```ts
// src/domain/model.ts — Recipe krijgt twee optionele velden (beide reizen mee als gewone recipe-keys)
  /** 13D: goedgekeurde dieetversies als vervangingen op dit recept; absent/null = geen. */
  variants?: RecipeVariants | null;
  /** 13D: "Tip van de maker" — reist mee bij delen; de privénotitie (tabel notes) nooit. */
  tip?: Text | null;
```

```ts
// src/domain/planner.ts
export interface PlanItem {  /* bestaand + */
  /** 13D: de goedgekeurde dieetversie die voor dit gerecht gekozen is; absent = origineel. */
  variant?: VariantDiet | null;
}
// src/domain/model.ts
export interface CookLogEntry { /* bestaand + */ variant?: VariantDiet | null; }
// src/domain/overrides.ts
export type RecipePatchKey = 'name' | 'description' | 'steps' | 'lines' | 'category' | 'tags' | 'servingTip' | 'variants' | 'tip';
```

`applyOverride` hoeft niet te veranderen: de default-tak `out[k] = v` zet `variants` en `tip` als
geheel op het recept (vervang-semantiek, geen merge per dieet). `RECIPE_PATCH_KEYS` krijgt de twee
keys erbij. Een persoonlijke versie gebruikt `variantOf` (bestaat) én `origin.basedOn` (bestaat).

### 2b. Voorbeelddata

Eigen recept "Spaghettischotel uit de oven" (u:7f3k2q9a) met goedgekeurde glutenvrije tab:
```json
"variants": {
  "glutenvrij": {
    "approved": true, "approvedAt": "2026-10-22T18:40:00.000Z", "by": "Stijn",
    "swaps": [
      { "index": 0, "fromId": "spaghetti", "toId": "glutenvrije-pasta",
        "raw": { "nl": "400 g glutenvrije pasta" }, "name": "glutenvrije pasta" }
    ],
    "checked": []
  }
},
"tip": { "nl": "Een dag in de koelkast maakt hem nog lekkerder.", "en": "Even better after a day in the fridge." }
```
Dezelfde goedkeuring op de klassieker b:spaghettischotel-uit-de-oven staat in de override:
`{ baseId: 'b:spaghettischotel-uit-de-oven', rev: 1, patch: { variants: { glutenvrij: {…} } },
updatedAt: '2026-10-22T18:40:00.000Z', by: 'Stijn' }` (`updatedAt` is verplicht in `RecipeOverride`).
Weekplan-slot: `{ id: 'pi:a1b2c3d4', recipeId: 'b:spaghettischotel-uit-de-oven', servings: 4, variant: 'glutenvrij' }`.

### 2c. Weergave per tab (domein, framework-vrij)

```ts
export type VariantStatus = 'natural' | 'proposed' | 'approved' | 'stale';
export interface VariantView {
  diet: VariantDiet;
  status: VariantStatus;
  /** De regels zoals het tabblad ze toont (bij 'natural' het origineel). */
  lines: Line[];
  /** Indexen van vervangen regels (gekleurde markering). */
  swapped: number[];
  /** Indexen die het dieet breken zonder geldige vervanging ("controleer zelf", oranje stip). */
  unresolved: number[];
  /** Deel van `unresolved` dat bij goedkeuring afgevinkt is. */
  checked: number[];
  /** Het voorstel achter een 'proposed'/'stale'-tab (voor de goedkeur-sheet). */
  plan?: VariantPlan;
}
export function variantView(diet: VariantDiet, lines: readonly Line[], stored: RecipeVariant | undefined,
  swaps: readonly Swap[], dict: Dictionary): VariantView;
```
Regels van `variantView`, in deze volgorde:
1. `dietTags(lines, dict)[diet] !== false` → `natural` (geen regel breekt het dieet; "waarschijnlijk" telt
   als natural, de dieetchip onder de titel zegt al "waarschijnlijk"). `lines` = origineel, rest leeg.
2. `stored?.approved`: pas elke StoredSwap toe waarvan `lines[s.index]?.ing === s.fromId` (via
   `applyStoredSwap`, zie §3); een swap die niet meer past telt niet. Daarna `unresolved` = indexen die
   nog `lineBreaksDiet` zijn. Zijn alle swaps toegepast én `unresolved ⊆ stored.checked` → `approved`,
   anders `stale` (tab weer stippellijn, met de melding uit §1c). Bij `stale` wordt óók `plan` gevuld
   (`planVariant` over de huidige regels) zodat "Opnieuw controleren" meteen kan.
3. Anders `proposed`: `plan = planVariant({ lines }, diet, swaps, dict)`; `lines` = de regels met de
   swaps met `applies: true` toegepast (voorbeeld-weergave), `swapped` = die indexen, `unresolved` =
   `plan.unresolved` + swaps met `applies: false`, `checked = []`.

`applyStoredSwap(line, s)` = `applySwap(line, { ...s, applies: true })` plus `swappedFrom: s.fromId`
op de regel (display-only; wordt nooit opgeslagen). `stepingredients.ts` leest `swappedFrom` (§3).

### 2d. Deelformaat (invariant 4) — `v` blijft 2, geen nieuwe fragmentsleutel

Nieuwe **optionele** velden, allemaal genegeerd door een oudere app (unknown keys blijven bewaard):
- `#r=`: `r.variants`, `r.tip` (gewone recipe-keys; `travelRecipe` spreidt het recept, `readRecipe` →
  `normalizeRecipe` normaliseert ze, zie 2e).
- `#p=`: `p.patch.variants`, `p.patch.tip` (patch-keys; `readPatchPayload` laat `patch` heel).
- `#b=`: via de recipes/patches erin; niets extra.
- `#w=`: `w.items[].vr?: string` (de gekozen dieetversie). `PlanPayloadItem.vr?`, `PlanShare.items[].variant?`.
  `buildPlanEnvelope` zet `vr` alleen als `p.variant` gezet is; `parseEnvelope` neemt `vr` over als het
  een string uit `VARIANT_DIETS` is, anders weg.
- `#f=`: ongewijzigd.

Een oudere app toont een recept met `variants` als gewoon recept (de tabs ontbreken daar) en een
weekplan zonder de versie — eerlijk genoeg; beide telefoons werken bij.

**Bevroren tokens** (tests/fixtures/frozen-share-tokens.ts, één keer gemaakt met `encodeToken` op
beide engines, daarna nooit meer veranderen): `FROZEN_TOKEN_R_VARIANTS` (+`_FFLATE`),
`FROZEN_TOKEN_P_VARIANTS` (+`_FFLATE`), `FROZEN_TOKEN_W_VARIANT` (+`_FFLATE`) met deze envelopes:
```ts
export const FROZEN_ENVELOPE_R_VARIANTS: Envelope = {
  v: 2, t: 'r', by: 'Stijn', at: '2026-10-22T18:00:00.000Z',
  r: { schema: 2, id: 'u:7f3k2q9a', rev: 2, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-22T17:00:00.000Z',
       origin: { kind: 'user', author: 'Stijn' }, name: { nl: 'Spaghettischotel uit de oven', en: 'Spaghetti bake' },
       tags: ['oven', 'kids'], servings: 4,
       lines: [{ raw: { nl: '400 g spaghetti' }, qty: { min: 400 }, unit: 'g', ing: 'spaghetti', name: 'spaghetti' },
               { raw: { nl: '400 g gehakt' }, qty: { min: 400 }, unit: 'g', ing: 'gehakt', name: 'gehakt' }],
       steps: [{ text: { nl: 'Kook de spaghetti.', en: 'Boil the spaghetti.' } }], goesWith: [], aliases: [],
       variants: { glutenvrij: { approved: true, approvedAt: '2026-10-22T16:00:00.000Z', by: 'Stijn',
                   swaps: [{ index: 0, fromId: 'spaghetti', toId: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta' }, name: 'glutenvrije pasta' }],
                   checked: [] } },
       tip: { nl: 'Een dag in de koelkast maakt hem nog lekkerder.', en: 'Even better after a day in the fridge.' } },
  future: { keep: true },
};
export const FROZEN_ENVELOPE_P_VARIANTS: Envelope = {
  v: 2, t: 'p', by: 'Gabi', at: '2026-10-22T18:05:00.000Z',
  p: { baseId: 'b:uiensoep', rev: 1, name: { nl: 'Uiensoep', en: 'French onion soup' }, updatedAt: '2026-10-22T18:00:00.000Z',
       patch: { variants: { glutenvrij: { approved: true, approvedAt: '2026-10-22T18:00:00.000Z', by: 'Gabi',
                swaps: [{ index: 4, fromId: 'brood', toId: 'glutenvrij-brood', raw: { nl: '4 sneetjes glutenvrij brood', en: '4 slices of gluten-free bread' }, name: 'glutenvrij brood' }],
                checked: [2] } },
                tip: { en: 'Grate the cheese yourself; it melts better.' } } },
  future: { keep: true },
};
export const FROZEN_ENVELOPE_W_VARIANT: Envelope = {
  v: 2, t: 'w', by: 'Stijn', at: '2026-10-22T18:10:00.000Z',
  w: { items: [{ rid: 'b:uiensoep', srv: 4, vr: 'glutenvrij' }, { rid: 'b:dahl', srv: 2 }], recipes: [], note: 'Oma eet glutenvrij' },
  future: { keep: true },
};
```
Testregel (als bij `#f=`): decoderen op beide engines geeft precies de envelop, en `encodeToken` van de
envelop geeft byte-voor-byte het bevroren token van die engine. De bestaande bevroren tokens worden
niet aangeraakt.

### 2e. Normalisatie (src/domain/recipe-io.ts, in `normalizeRecipe` schape 1)

- `tip`: als `description`/`servingTip` (`readOptionalText`; undefined → key weg).
- `variants`: `readVariants(v)`: geen object → key weg; `null` → `null`. Per sleutel: hoort hij bij
  `VARIANT_DIETS` → `readVariant`, anders ongewijzigd laten staan (toekomstig dieet, unknown key).
  `readVariant`: object met `swaps` array, anders weg; `approved` boolean (default `true`); `swaps`
  per item: `index` geheel ≥ 0, `fromId`/`toId` niet-lege strings, `raw` een Text met ≥ 1 taal,
  `name` string, `grams` via dezelfde Qty-lezer als regels — fout item valt weg; `checked`: gehele
  getallen ≥ 0, gededupliceerd; `approvedAt` via `readIso`; `by` string of null. Lege `swaps` én
  lege `checked` → de variant valt weg (er is niets goedgekeurd).
  ⚠ Feitencheck: recipe-io.ts heeft geen Qty-lezer: `readLine` spreidt het regelobject en controleert
  `qty` niet. Voor `grams` (type `Qty` = `{ min, max?, approx? }`) is er dus niets om te hergebruiken;
  de bouwer schrijft een kleine lezer `readQty(v): Qty | undefined` (min eindig > 0; max/approx optioneel).
- **Patches** (besluit kritische lezer): `readPatchPayload` (share.ts) haalt `patch.variants` door
  `readVariants` en `patch.tip` door `readOptionalText`, zodat een `#p=` nooit rommel in de override zet;
  `importBundle` laat overrides zoals ze zijn, dus `variantView` behandelt een `stored` dat geen object is
  of geen `swaps`-array heeft als `undefined`.
- `Recipe.variants` verandert de **vingerafdruk niet** (`recipeFingerprint` in src/domain/recipe-io.ts =
  naam + gesorteerde raw-regels, géén stappen; de "zelfde versie"-sleutel bij import is
  `contentFingerprint` in src/domain/merge.ts = `recipeFingerprint` + de stappen; geen van beide kijkt
  naar `variants`/`tip`): een goedkeuring op een ontvangen recept is "hetzelfde recept". Gevolg bij import
  (merge.ts `planRecipe`): een binnenkomend recept met dezelfde `contentFingerprint` als het lokale is
  "present" en de variants van de ander komen dan NIET binnen. Dat is bewust (§5): varianten reizen mee
  met een nieuwe versie van het recept, niet als losse berichten.
  ⚠ Feitencheck: dit geldt voor `#r=`. Bij `#p=` (klassieker) vergelijkt `planPatch` de héle patch
  (`patchKey`, alle keys): een patch met nieuwe `variants`/`tip` is dus `new`, `update` of `conflict`
  (veld `meta` via `patchFields`) en komt wél binnen.

### 2f. Back-up, herstel, verwijderen, migratie

- `exportBundle`/`importBundle` (src/db/repo.ts): niets te doen; `variants`/`tip` zitten in de rijen van
  `userRecipes` en `overrides` die al meereizen. `normalizeRecipe` bij herstel normaliseert ze.
- `deleteUserRecipe`: ongewijzigd. Verdwijnt een origineel, dan toont een persoonlijke versie zoals nu
  geen "Versie van …"-link meer (origineel onbekend).
- **Bestaande kopie-varianten (blok F, `variantOf` + dieettag) blijven staan als persoonlijke versie.**
  Geen datamigratie, geen v9: ids veranderen nooit (invariant 1), kooklog/favorieten/foto's van de
  kopie blijven kloppen, en het zijn er maar een paar (Stijns "Franse uiensoep met Gruyère (glutenvrij)").
  Op het origineel verschijnen ze als tab met de naam van de maker (§1b). Afstemming met de
  inbouwen-spec (13F, gebouwd vóór 13D): (1) de id-migratie van 13F moet `variantOf` en
  `origin.basedOn` van ALLE eigen recepten mee herschrijven van het oude `u:`-id naar het nieuwe
  `b:`-id, anders wijst Stijns glutenvrije kopie nergens meer heen; (2) 13F bouwt de glutenvrije kopie
  **niet** als aparte klassieker in (een ingebouwde "versie van Stijn" is voor niemand anders een
  persoonlijke versie); Stijn houdt hem als eigen recept en kan na 13D met twee tikken de glutenvrije
  tab op het origineel goedkeuren en de kopie weggooien (zijn 1 kookbeurt op de kopie blijft in de log).

## 3. Bestandsverdeling en contracten

Per bouwblok (§4) drie bouwers (A, B, C) en een integrator. Een bouwer raakt alleen zijn bestanden.

### Blok 1 — model, domein, repo, deelformaat (onzichtbaar)

**Bouwer A — domein** (`src/domain/variants.ts`, `src/domain/model.ts`, `src/domain/planner.ts`,
`src/domain/stepingredients.ts`, `tests/variants.test.ts`, `tests/planner.test.ts`,
`tests/stepingredients.test.ts`):
```ts
// variants.ts — bestaand blijft (planVariant, applySwap, makeVariant, lineBreaksDiet, …); nieuw:
export type VariantDiet; export const VARIANT_DIETS; export function activeVariantDiets(): VariantDiet[];
export interface StoredSwap; export interface RecipeVariant; export type RecipeVariants;
export type VariantStatus; export interface VariantView;
export function variantView(diet, lines, stored, swaps, dict): VariantView;                 // §2c
export function applyStoredSwap(line: Line, s: StoredSwap): Line;                           // + swappedFrom
/** Van de sheet naar opslag: de swaps met applies true die niet uitgevinkt zijn. */
export function storedSwapsFrom(plan: VariantPlan, off: ReadonlySet<number>): StoredSwap[];
/** Per actief dieet de status, plus of de tabrij getoond moet worden. */
export function variantTabs(lines: readonly Line[], variants: RecipeVariants | null | undefined,
  swaps: readonly Swap[], dict: Dictionary, personalCount: number): { show: boolean; diets: Array<{ diet: VariantDiet; status: VariantStatus }> };
/** recipe.tags plus '<diet>-optie' voor elk goedgekeurd dieet (filters, dieetchips). */
export function tagsWithVariants(r: Pick<Recipe, 'tags' | 'variants'>): string[];
export const OPTIE_TAG_FOR: Readonly<Record<VariantDiet, string>>; // glutenvrij-optie, vega-optie, vegan-optie, lactosevrij-optie
/** "Goulash (versie van Dino)" / "Goulash (Dino's version)" per aanwezige taal (invariant 3). */
export function versionName(name: Text, author: string): Text;
/** Voornaam van de maker van een persoonlijke versie, of null. */
export function versionAuthor(r: Pick<Recipe, 'origin'>): string | null;
/** Het tablabel van een kookstand/plan-keuze: de waarde van ?v= gelezen; null als ongeldig. */
export function parseVariantParam(v: string | null, approved: readonly VariantDiet[]): VariantDiet | null;
```
⚠ Feitencheck: `VariantDiet` en `VARIANT_DIETS` zijn niet nieuw: ze bestaan al in variants.ts
(`VariantDiet = DietTag`, drie diëten) en worden hier gewijzigd (§2a). Nieuw zijn de overige regels.
`DIET_SUFFIX`, `OPTIE_TAGS_FOR`, `DIET_TAGS_FOR` krijgen `lactosevrij` erbij (`lactosevrij` /
`lactose-free`, `lactosevrij-optie`). `makeVariant` blijft bestaan voor tests en voor de oude kopieën,
maar wordt door geen UI meer aangeroepen (niet verwijderen in dit blok).
⚠ Feitencheck: alleen `DIET_SUFFIX` is geëxporteerd; `OPTIE_TAGS_FOR` en `DIET_TAGS_FOR` zijn nu
module-privé (`const`). Blok 3 (badges.ts gebruikt `DIET_TAGS_FOR[variant]`) heeft een export nodig.
`planner.ts`: `PlanItem.variant?`; `hashPairs` →
`` `${p.recipeId}@${normalizeServings(p.servings)}${p.variant ? '#' + p.variant : ''}` ``
(zonder variant blijft de hash byte-gelijk aan nu — test). `newPlanItem(recipeId, servings, variant?)`.
`stepingredients.ts`: `findStepIngredients` neemt voor een regel met `swappedFrom` óók de naamvormen
van dat ingrediënt mee en zet `viaSwap: true` op de match; `matchQuantityText` geeft dan
`"<hoeveelheid> <nieuwe naam>"` ("800 g tofu") zodat de tik op "kip" eerlijk zegt wat het werd;
`spokenStepQuantities` idem ("kip: 800 gram tofu").
⚠ Feitencheck: `matchQuantityText` geeft nu alleen de hoeveelheid ("400 g"). `spokenStepQuantities`
spreekt nu "naam hoeveelheid eenheid" zonder dubbele punt ("boter 1 eetlepel", rij 68), met de naam
uit de regel zelf: een vervangen regel zegt dus zonder extra code al "tofu 800 gram".
`model.ts`: `Recipe.variants`, `Recipe.tip`, `CookLogEntry.variant` (§2a).

**Bouwer B — deelformaat en normalisatie** (`src/domain/recipe-io.ts`, `src/domain/share.ts`,
`src/domain/overrides.ts`, `src/domain/message.ts`, `tests/fixtures/frozen-share-tokens.ts`,
`tests/token.test.ts`, `tests/share.test.ts`, `tests/recipe-io.test.ts`, `tests/overrides.test.ts`):
- recipe-io: `readVariants`/`readVariant` (§2e), `tip` via `readOptionalText`.
- share.ts: `PlanPayloadItem.vr?: string`, `PlanShare.items[].variant?: VariantDiet`,
  `buildPlanEnvelope` schrijft `vr`, `parseEnvelope` leest hem (alleen waarden uit `VARIANT_DIETS`).
- overrides.ts: `RecipePatchKey` + `RECIPE_PATCH_KEYS` met `'variants' | 'tip'`.
- message.ts: `readableBlock` zet na de serveertip `💡 <tip>` (`L.makerTip`: NL "Tip van de maker:" ·
  EN "Maker's tip:"), alleen als `r.tip` tekst heeft in die taal.
  ⚠ Feitencheck: de bestaande tests van `buildReadableRecipe` staan in tests/message.test.ts (niet in
  tests/share.test.ts); dat bestand staat niet in de lijst van bouwer B. `L` is `LABELS[lang]` in message.ts.
- De drie bevroren envelopes uit §2d als constanten, tokens één keer gemaakt en vastgelegd; tests
  zoals bij `#f=` (decode op beide engines + encode byte-gelijk).

**Bouwer C — repo** (`src/db/repo.ts`, `src/db/model.ts`, `src/domain/aggregate.ts`,
`tests/aggregate.test.ts`):
```ts
// repo.ts — nieuw blok "// --- Variant tabs (docs/specs/varianten-tabs.md)"
export type VariantApproval = Pick<RecipeVariant, 'swaps' | 'checked'>;
/** Schrijft variants[diet] = { approved: true, approvedAt: now, by, ...a }. Eigen/ontvangen recept:
 *  saveUserRecipe met de rest van het recept ongemoeid (rev +1). Klassieker: saveOverride met
 *  { ...bestaande patch, variants: { ...bestaande, [diet]: … } }. Throws Error('not-found'). */
export async function approveVariant(id: string, diet: VariantDiet, a: VariantApproval, by: string | null): Promise<void>;
/** Haalt variants[diet] weg; lege variants → key weg (eigen) / uit de patch (klassieker; lege patch
 *  verwijdert de override zoals saveOverride al doet). */
export async function revokeVariant(id: string, diet: VariantDiet): Promise<void>;
/** Zet of wist de tip (eigen: op het recept; klassieker: patch.tip, null = uit de patch). */
export async function setTip(id: string, tip: Text | null, by: string | null): Promise<void>;
/** "Eigen versie maken": duplicateAsOwn + variantOf + versionName; variants/tip van het origineel vallen weg. */
export async function makeOwnVersion(r: Recipe, profile: Profile): Promise<Recipe>;
/** Weekplan: de versie van een slot (null = origineel). No-op als het slot niet bestaat. */
export async function setPlanVariant(itemId: string, variant: VariantDiet | null): Promise<void>;
/** Weekplan: een slot een ander recept geven (persoonlijke versie ↔ origineel); servings/locked blijven. */
export async function setPlanRecipe(itemId: string, recipeId: string): Promise<void>;
// gewijzigd:
export async function addToPlan(recipeId: string, servings?: number, variant?: VariantDiet | null): Promise<PlanItem>;
```
`generateList`: `aggregate` krijgt `lines: (recipeId, item) => Line[]` die per slot
`variantView(item.variant, effectieveRegels, recipe.variants?.[item.variant], swapsData, dict).lines`
geeft als `item.variant` gezet is én de status `approved` is, anders de effectieve regels. De swaps
komen uit een nieuw klein app-bestand `src/swaps.ts` (bouwer C maakt het: `export const swapsData:
Swap[] = swapsJson as Swap[]`); repo.ts importeert het daar. VariantSheet.tsx houdt in blok 1 zijn
eigen `swapsData`-export (blok 2 haalt die weg en importeert `src/swaps.ts`). Het domein
(`src/domain/*`) importeert nooit `data/swaps.json` zelf. `aggregate.ts`: `AggregateInput.lines`
wordt `(recipeId: string, item: PlanItem) => Line[]` (additief: bestaande tests geven een functie
met één parameter door en blijven groen); `ListSource.diet?: VariantDiet` (niet `variant`: dat woord
betekent in aggregate.ts al een kwalificatievariant zoals "rode") zodat "Waarvoor is dit?"
"(glutenvrije versie)" kan tonen (UI in blok 3). `logCooked` accepteert `variant`.
`db/model.ts`: `export type { VariantDiet, RecipeVariant, RecipeVariants, StoredSwap } from '@/domain/variants'`.

**Integrator blok 1**: `npm run check`, `npm test`, `npm run build`, `npm run build:next`,
`npm run validate:data`; controleert dat geen UI-bestand is aangeraakt en dat de oude bevroren tokens
onveranderd zijn; STATUS.md één alinea.

### Blok 2 — tabrij, goedkeuren, markeringen

**Bouwer A — VariantTabs** (`src/components/VariantTabs.tsx` nieuw, `src/swipe.ts` nieuw,
`src/vtab-memory.ts` nieuw):
```ts
// VariantTabs.tsx
export type TabChoice = { kind: 'original' } | { kind: 'diet'; diet: VariantDiet } | { kind: 'version'; recipeId: string };
export interface VariantTabsProps {
  tabs: Array<{ diet: VariantDiet; status: VariantStatus }>;
  versions: Recipe[];                 // variantsOf(id), oudste eerst
  choice: TabChoice;
  onChoose: (c: TabChoice) => void;
}
export function VariantTabs(props: VariantTabsProps): JSX.Element;
export function tabChoiceFromParam(v: string | null, tabs, versions): TabChoice;   // ?v= → keuze (ongeldig = original)
export function tabChoiceToParam(c: TabChoice): string | null;
export function nextTabChoice(c: TabChoice, dir: 1 | -1, tabs, versions): TabChoice; // veegt; slaat natural over
// swipe.ts — dezelfde constanten en logica als CookScreen (SWIPE_PX 60, drag 12 px, horizontaal > verticaal)
export function useHorizontalSwipe(h: { onLeft(): void; onRight(): void }): { onPointerDown; onPointerMove; onPointerUp; onPointerCancel; onClickCapture };
// vtab-memory.ts — localStorage 'recepten.vtab' = { [recipeId]: string }, max 200, try/catch, pure helpers getest
export function rememberedTab(recipeId: string): string | null;
export function rememberTab(recipeId: string, param: string | null): void;
```
**Bouwer B — VariantSheet herbouw + LineView-markeringen** (`src/components/VariantSheet.tsx`,
`src/components/LineView.tsx`):
```ts
export interface VariantSheetProps {
  recipe: Recipe;
  view: VariantView;                   // status 'proposed' | 'stale' (plan gevuld)
  onClose: () => void;
  onApproved: () => void;              // na approveVariant
}
// LineView / IngredientList: nieuw
export type LineMark = { kind: 'swapped'; diet: VariantDiet } | { kind: 'check'; done: boolean };
IngredientListProps.marks?: ReadonlyMap<number, LineMark>;   // index → markering
IngredientListProps.lockedIndexes?: ReadonlySet<number>;     // geen ?-chip / lange druk (vervangen regels)
```
De sheet roept zelf `approveVariant` aan (profielnaam uit `activeProfile`), toont `variant.saveFailed`
bij een fout, en gebruikt `storedSwapsFrom(view.plan, off)` + de afgevinkte indexen.

**Bouwer C — RecipeScreen, CSS, i18n** (`src/screens/RecipeScreen.tsx`, `src/styles/base.css`
tokens, `src/styles/browse.css`, `src/i18n/variants.ts` nieuw, `src/i18n/index.ts`,
`src/i18n/browse.ts` opruimen): RecipeScreen leest `?v=`/geheugen → `choice`; `shownLines` =
`view.lines` (dieet) of de regels van de versie; `IngredientList lines={shownLines} marks=…`;
`StepView lines={shownLines}`; Koken/Gekookt/Deel/+ Deze week per §1d; de oude blok-F-knoppen en chips
weg. i18n: alle `vt.*`-keys uit §1; weg uit browse.ts: `variant.make.*`, `variant.title.*`,
`variant.foot`, `variant.save`, `variant.saving`, `recipe.alsoAs`. Blijven: `variant.intro` wordt
vervangen door `vt.sheet.intro` (oude key weg), `variant.check`, `variant.checkHint`,
`variant.checkSwap`, `variant.onlyCheck`, `variant.swapLabel`, `variant.noProfile`, `variant.saveFailed`,
`recipe.variantOf`, `recipe.variants`. `index.ts`: `...variants` ná `badges`.
**Integrator blok 2**: smoke in de dev-app (§6), build:next, DEVICE-TEST rij 86, STATUS.

### Blok 3 — kookstand, lijst, week, filters volgen de tab

**Bouwer A — CookScreen + CookedSheet + cooklog + badges + kookbalk** (`src/screens/CookScreen.tsx`,
`src/components/CookedSheet.tsx` prop `variant?: VariantDiet | null`, `src/cooklog.ts`
`RecordCookedInput.variant?`, `src/domain/badges.ts`, `tests/badges.test.ts`, en voor 13K:
`src/domain/cooking.ts` (`CookingSession.variant?: VariantDiet | null`; `cookPath` zet `&v=<diet>`),
`src/cooking.ts` (`touchCooking(recipe, page, servings, variant)`), `tests/cooking.test.ts` (één geval:
`cookPath({ recipeId:'b:x', page:3, servings:6, variant:'glutenvrij' })` → `'/cook/b:x?step=3&srv=6&v=glutenvrij'`)): `?v=` lezen
(`parseVariantParam` met de goedgekeurde diëten van het recept), `shownLines`, kicker, `logCooked`
met `variant`. Badges (`evaluateBadges`): bij het tellen per tag krijgt een logregel met
`entry.variant` de tags van dat dieet erbij (`DIET_TAGS_FOR[variant]`, dus `vegan` telt ook voor
`vegetarisch`) — zo telt een gekookte glutenvrije tab voor Glutenvrijbuiter. Een goedgekeurde maar
niet gekookte tab telt nooit; `recipe.tags` zelf verandert niet.
⚠ Feitencheck: de telling per tag zit in de interne functie `derive()` van src/domain/badges.ts
(`for (const tag of new Set(recipe.tags ?? [])) bump(tagCounts, tag)`), die `evaluateBadges` aanroept.
CookScreen roept `logCooked` rechtstreeks aan (eigen kopie van de `recordCooked`-volgorde).
**Bouwer B — WeekScreen + InboxScreen** (`src/screens/WeekScreen.tsx`, `src/screens/InboxScreen.tsx`,
`src/styles/week.css`, en in `src/i18n/variants.ts` de keys `week.variant*`; dat bestand is in blok 3
van B): de chip en keuzerij van §1e; `vr` bij Overnemen/Toevoegen. De "met … versie(s)"-regels in
ImportPreview zijn van blok 4 (bouwer C daar).
**Bouwer C — filters en dieetchips** (`src/components/FilterChips.tsx`, `src/components/PickSheet.tsx`,
`src/screens/RecipesScreen.tsx` waar `r.tags` gelezen wordt, `src/screens/RecipeScreen.tsx` alleen de
functie `dietChipsFor`, `src/screens/ShoppingScreen.tsx` voor "Waarvoor is dit?" met
`source.variant` → achter de bronregel "(glutenvrije versie)" via `vt.version.<diet>`): overal waar
een recept op dieettags gefilterd of getoond wordt `tagsWithVariants(r)` gebruiken i.p.v. `r.tags`
(`hasTag`, `tagIdsIn`, `applyPickFilter`, `dietChipsFor`). `OPTIE_TAG` in FilterChips krijgt
`lactosevrij: 'lactosevrij-optie'` zodra `DietTag` hem kent (anders laten).
⚠ Feitencheck: `hasTag` (privé), `tagIdsIn` en `applyPickFilter` staan in src/components/PickSheet.tsx;
RecipesScreen.tsx leest `r.tags` alleen bij het bulk-bewerken van labels (`change.tags`), niet bij
filteren. `OPTIE_TAG` is `Record<DietTag, string>`: zodra 6B `lactosevrij` aan `DietTag` toevoegt,
dwingt tsc die key al af.
**Integrator blok 3**: smoke §6, DEVICE-TEST rij 87, STATUS.

### Blok 4 — Tip van de maker, eigen versie, delen

**Bouwer A — editor + detail** (`src/screens/EditScreen.tsx` tip-veld NL/EN + `buildOverridePatch`
zet `tip` bij afwijking en laat `prev.variants` staan + eigen recept bewaart `variants` en `tip` mee
in het opgeslagen object; `src/screens/RecipeScreen.tsx` `.detail-tip`, `recipe.notesTipHint`,
knoppenrij §1h; `src/styles/edit.css`, `src/styles/browse.css`).
⚠ Feitencheck: `buildOverridePatch` begint al met `{ ...(prev ?? {}) }` (dus `prev.variants` blijft
vanzelf staan) en het draft van een eigen recept in `build()` spreidt al `...existing` (dus `variants`
en `tip` gaan vanzelf mee); de `put`-helper kent nog geen `'tip'`. Let op de naam: in EditScreen heten
de serveertip-velden al `tipNl`/`tipEn`/`setTipNl`/`setTipEn` — het nieuwe veld heeft andere namen nodig.
**Bouwer B — ShareScreen** (`src/screens/ShareScreen.tsx`): `getNote(id, pid)` laden; schakelrij;
envelop bouwen met `tip` op een kopie van het recept (`{ ...loaded.base, tip }`) resp. `patch.tip`;
de leesbare tekst volgt automatisch via message.ts.
⚠ Feitencheck: niet automatisch. `readable` wordt gebouwd met `buildReadableRecipe(recipe, …)` waarbij
`recipe = loaded?.effective` (ShareScreen.tsx), los van de envelop (die uit `loaded.base` komt). Om de
notitie-als-tip in de leesbare tekst te krijgen moet dezelfde tip ook op een kopie van `loaded.effective`.
**Bouwer C — i18n, In & uit, opruimen** (`src/i18n/variants.ts` keys `version.*`, `recipe.edit`,
`tip.*`, `edit.tip.*`, `share.noteAsTip*`, `inbox.with*`; `src/i18n/browse.ts` verwijdert
`recipe.copy`, `recipe.copyHint`, `recipe.copyNoProfile`; `src/components/ImportPreview.tsx` de
"met …"-regels van §1g; `docs/DEVICE-TEST.md` rij 88 in beide talen). De knop "Eigen versie maken"
zelf (RecipeScreen: `onCopy` wordt `makeOwnVersion` + navigate naar de editor) hoort bij bouwer A,
die RecipeScreen in dit blok bezit.
**Integrator blok 4**: smoke §6, DEVICE-TEST rij 88, STATUS; controleert dat de tabel `notes` nergens
in een envelop terechtkomt behalve via de schakelaar.

### Blok 5 — vervallen (kritische lezer)

6B blok 2 (labels-categorieen.md §2b) zet `lactosevrij` al in `SWAP_DIETS`/`SWAP_RULES` en in de
`diets` van de zuivel-swaps in data/swaps.json (zonder margarine), mét de lactose-vlag op alle entries
(6B blok 1). `activeVariantDiets()` geeft daardoor vanaf blok 2 vier tabs; er is in 13D niets meer te doen.

## 4. Stappenplan

Vier bouwblokken (blok 5 is vervallen, zie §3), elk één Opus-workflow (3 bouwers + integrator, §3), elk
apart online. Geen codevlag: blok 1 is onzichtbaar, blok 2 t/m 4 gaan eerst naar `/next/` (één
kijkronde van Stijn en Gabi met de DEVICE-TEST-rij van dat blok) en daarna naar `main`.

**Blok 1 — model, domein, repo, deelformaat.** Af als: de types uit §2a bestaan; `variantView`,
`applyStoredSwap`, `storedSwapsFrom`, `variantTabs`, `tagsWithVariants`, `versionName` met tests;
`normalizeRecipe` normaliseert `variants`/`tip`; de drie bevroren tokens staan vast en decoderen op
beide engines; `#w=` draagt `vr`; `planHash` kent `variant` (en is zonder variant byte-gelijk aan
nu); `aggregate` neemt `lines(recipeId, item)`; repo heeft `approveVariant`, `revokeVariant`,
`setTip`, `makeOwnVersion`, `setPlanVariant`, `setPlanRecipe`, `addToPlan(…, variant)`, `logCooked`
met `variant`; `src/swaps.ts` bestaat (VariantSheet nog ongemoeid). Zichtbaar voor Stijn:
niets. Mag direct naar `main`.

**Blok 2 — tabrij en goedkeuren.** Af als: op een recept met iets te kiezen staat de tabrij (§1a);
een stippellijn-tab toont het voorstel met markeringen en de statusregel; "Controleer en keur goed"
opent de herbouwde sheet (Annuleer/Goedkeuren bovenaan); na Goedkeuren is de tab vol en blijft dat na
herladen; Intrekken werkt; vegen wisselt tabs; `?v=` en het geheugen werken; persoonlijke versies
staan als tab met "Open als recept"; de oude knoppen/chips zijn weg; de twee kleurblokken (licht en
donker) zijn gedefinieerd; DEVICE-TEST rij 86. Eerst `/next/`.

**Blok 3 — kookstand, lijst, week, filters volgen de tab.** Af als: Koken vanaf een dieettab opent de
kookstand met de kicker en de versieregels; de groene woorden en "hoeveel?" gebruiken ze (inclusief
`swappedFrom`); Gekookt!/✓ Gekookt loggen `variant` en de Glutenvrijbuiter-badge telt het; de week-
chip kiest de versie en de boodschappenlijst volgt (met "Waarvoor is dit?" op de vervangen regel);
`#w=` reist met `vr`; de glutenvrij-filterchip vindt recepten met een goedgekeurde glutenvrije tab
(als -optie); DEVICE-TEST rij 87. Eerst `/next/`.

**Blok 4 — Tip van de maker, eigen versie, delen.** Af als: tip bewerkbaar (eigen + override), kaartje
op het recept, in de leesbare deeltekst, reist in `#r=`/`#p=`; de notitie-schakelaar op het deelscherm
werkt en laat `notes` ongemoeid; "Recept bewerken" / "Eigen versie maken" per §1h; een eigen versie
verschijnt als tab op het origineel, ook bij de ontvanger; In & uit zegt "met een tip van de maker" /
"met n goedgekeurde versies"; keys `recipe.copy`, `recipe.copyHint`, `recipe.copyNoProfile` weg
(`recipe.copyAsText`/`recipe.copyFailed` blijven); DEVICE-TEST rij 88. Eerst `/next/`.

**Blok 5 — vervallen** (6B blok 2 deed de swaps-data en de validator-regel; de lactosevrij-tab verschijnt
vanaf blok 2 vanzelf).

Volgorde vast: 1 → 2 → 3 → 4. 13F is al online vóór 13D begint (de id-migratie van 13F heeft
`variantOf`/`basedOn` omgezet, §2f). Blok 3 en 4 zijn onafhankelijk van elkaar; bij tijdnood eerst 3.

## 5. Regels en eerlijkheid

**Invarianten die dit blok raakt**
- **1 (ids):** geen recept krijgt een ander id; oude kopie-varianten blijven bestaan; een eigen versie
  krijgt een vers `u:`-id; de weekplanner wisselt bij een persoonlijke versie het `recipeId` van het
  slot (dat is een keuze van de gebruiker, geen id-wijziging van een recept).
- **2 (raw nooit weg):** een StoredSwap bewaart de nieuwe raw-tekst naast de oude regel; de oude regel
  (met zijn raw) blijft in het recept staan; `variantView` is afgeleid, nooit teruggeschreven.
- **3 ({nl,en}):** `tip`, `StoredSwap.raw`, `versionName` vullen alleen talen die er al zijn.
- **4 (deelformaat):** `v` blijft 2, geen nieuwe fragmentsleutel; drie nieuwe bevroren tokens;
  bestaande bevroren tokens onaangeraakt; onbekende dieet-keys in `variants` blijven bewaard.
- **5/6 (iPhone):** niets nieuws; de landingspagina (landing.ts) toont een recept met `variants` als
  gewoon recept (hij hoeft de tabs niet te kennen; `tip` mag hij later tonen, niet in dit blok).
- **9 (één veld bij share):** ongewijzigd; de tip zit in de envelop, niet in een tweede veld.
- **12/14/15:** geen database-naamwijziging, geen backend, geen dependency.
- **Dexie:** geen nieuwe versie door dit blok.

**Eerlijk**
- Een variant is pas "vol" als iemand hem heeft goedgekeurd; de app noemt een voorstel altijd
  "nog niet bevestigd". Niet-vervangbare regels staan op het recept gemarkeerd (oranje stip).
- Een recept dat na goedkeuring verandert, valt terug op stippellijn ("Controleer opnieuw"); de app
  doet nooit alsof de oude goedkeuring nog geldt.
- Stapteksten worden **niet** herschreven: in de glutenvrije versie staat in stap 2 nog "kook de
  spaghetti". De groene markering vangt dat op: het woord wordt gematcht via `swappedFrom` en de tik
  zegt "400 g glutenvrije pasta". De handleiding (blok Z) legt dit uit; de UI belooft niets anders.
- De weekplanner biedt alleen goedgekeurde versies aan; een ontvangen `vr` voor een tab die hier niet
  goedgekeurd is wordt stil Origineel (en niet een halve versie).
- Varianten reizen met het recept, niet los: wie alleen een goedkeuring wil sturen, deelt het recept
  opnieuw (bij een klassieker een `#p=`). Bij een ongewijzigd recept aan de andere kant komt zo'n
  goedkeuring niet binnen ("Heb je al") — dat staat in §2e en in de handleiding; niet "oplossen" door
  de vingerafdruk te veranderen.
  ⚠ Feitencheck: dat "Heb je al" geldt alleen voor `#r=` (`contentFingerprint`). Een `#p=` met een
  gewijzigde patch (ook alleen `variants`/`tip`) is voor `planPatch` géén "present" (zie §2e).
- De privénotitie reist alleen als tip als de gebruiker het bij dít delen aanzet; het bewaarde recept
  en de notitie veranderen daar niet door.
- iPhone: de deel-link komt via kopiëren → app → plakken aan (invariant 5); verder geen verschil.
  Android: geen verschil.

**Lactosevrij.** 6B (gebouwd vóór 13D) heeft `'lactosevrij'` aan `DietTag`/`DIET_TAGS` toegevoegd, de
`lactosevrij`-dimensie in `dietTags()`, de vlag op alle woordenboek-entries en de swaps.
`activeVariantDiets()` = `VARIANT_DIETS.filter((d) => (DIET_TAGS as readonly string[]).includes(d))` blijft
als vangnet staan (vier tabs zodra 6B er is, drie zonder), zonder codewijziging in 13D. De tokens, types
en token-tests gebruiken `'lactosevrij'` als geldige waarde (een oudere app laat de key staan).

**Opus mag dit NIET zelf beslissen (zo doen als hier staat, anders vragen aan Stijn/Fable)**
1. Opslag van varianten: op het recept (eigen/ontvangen) en in de override-patch (klassieker). Geen
   nieuwe tabel, geen nieuwe Dexie-versie, geen setting.
2. De vier dieetwaarden en hun volgorde, de tabvolgorde (Origineel · diëten · persoonlijke versies),
   de kleurtokens en het stippellijn/vol-onderscheid uit §1f.
3. Kopie-varianten blijven staan als persoonlijke versie; geen migratie, geen automatische omzetting.
4. Goedkeuren vereist dat elke "controleer zelf"-regel is afgevinkt; approving zonder profiel kan niet.
5. `variantView`-regels en de statusvolgorde natural → approved/stale → proposed (§2c).
6. `recipeFingerprint` verandert niet door `variants` of `tip`.
7. De nieuwe envelopvelden heten precies `variants`, `tip`, `vr`; `v` blijft 2; de drie bevroren
   envelopes van §2d letterlijk, één keer gemaakt, nooit meer aangepast.
8. `planHash` zonder variant is byte-gelijk aan nu (test); met variant `#<diet>` erachter.
9. Stapteksten worden niet herschreven; `swappedFrom` is display-only en wordt nooit opgeslagen.
10. De weekplanner biedt alleen goedgekeurde diëten en persoonlijke versies aan.
11. De privénotitie reist nooit zonder de schakelaar; de tabel `notes` wordt nooit in een envelop
    gezet; standaard staat de schakelaar uit.
12. "Eigen versie maken" zet `variantOf` én `origin.basedOn`; de naam krijgt `versionName`; de
    `variants`/`tip` van het origineel gaan niet mee.
13. Elke nieuwe sheet gebruikt SheetPortal met Annuleer/actie bovenaan; wegvegen bewaart niets.
14. Alle teksten letterlijk uit §1 (NL en Brits-Engels), keys in `src/i18n/variants.ts`.
15. Geen Home-wijzigingen (Home A+), geen XP/badge-catalogus (6D), geen "Nu aan het koken"-balk (13K),
    niets aan `data/recipes.json` behalve wat 13F al deed.

## 6. Testplan

**Unit tests** (Vitest, node; echte dictionary via `defaultDictionary()` en `data/swaps.json` zoals
tests/variants.test.ts nu doet; de SCHOTEL-regels daar blijven de hoofdfixture):
- `tests/variants.test.ts` (uitbreiden): `activeVariantDiets` = de diëten die DIET_TAGS kent (drie
  zonder 6B); `variantView` natural (schotel zonder gehakt voor vegetarisch → status natural, lines ===
  origineel, swapped leeg); proposed (SCHOTEL glutenvrij → swapped [0], lines[0].raw.nl
  '400 g glutenvrije pasta', lines[0].swappedFrom 'spaghetti', unresolved []); vegan proposed → kaas,
  gehakt en eieren: kaas (4) in swapped, gehakt (3) en eieren (5) in unresolved — de gehakt-swap in
  data/swaps.json geldt alleen voor vegetarisch en vegagehakt is niet vegan (gecontroleerd met
  `planVariant`: swaps [4], unresolved [3, 5]); approved (stored met swap index 0 →
  approved, checked leeg); stale door gewijzigde regel (lines[0].ing 'penne' terwijl stored.fromId
  'spaghetti' → stale, plan gevuld); stale door niet-afgevinkte unresolved (vegan stored checked []
  terwijl gehakt en eieren breken → stale); approved met checked [3, 5] → approved (met alleen [5]: stale);
  `applyStoredSwap` zet
  swappedFrom en laat raw van de bronregel ongemoeid; `storedSwapsFrom` laat uitgevinkte en
  applies-false swaps weg en bewaart fromId/toId/raw/name/grams; `variantTabs` show false bij alles
  natural zonder versies, true met personalCount 1; `tagsWithVariants` voegt 'glutenvrij-optie' toe en
  dedupliceert; `versionName({nl:'Goulash', en:'Goulash'}, 'Dino')` → `{nl:'Goulash (versie van Dino)',
  en:"Goulash (Dino's version)"}` en met alleen nl alleen nl; `versionAuthor` eigen/ontvangen/null;
  `parseVariantParam('glutenvrij', ['glutenvrij'])` → 'glutenvrij', `('vegan', ['glutenvrij'])` → null,
  `('x', …)` → null; `makeVariant` blijft groen (oude kopieën).
- `tests/planner.test.ts`: `planHash` zonder variant gelijk aan de huidige vaste waarde voor
  `[{b:dahl@4},{b:uiensoep@2}]` (waarde één keer vastleggen); met `variant:'glutenvrij'` anders;
  volgorde-onafhankelijk blijft; `newPlanItem(id, 4, 'vegan').variant === 'vegan'` en zonder → key weg.
- `tests/stepingredients.test.ts`: stap "Kook de spaghetti." met regel {ing:'glutenvrije-pasta',
  swappedFrom:'spaghetti', qty 400 g} → match op "spaghetti" met viaSwap true;
  `matchQuantityText` → '400 g glutenvrije pasta'; `spokenStepQuantities` → 'spaghetti: 400 gram
  glutenvrije pasta' (of het bestaande spraakformaat met de nieuwe naam erachter); zonder swappedFrom
  ongewijzigd (bestaande tests groen).
  ⚠ Feitencheck: het bestaande spraakformaat is "naam hoeveelheid eenheid" uit de regel zelf; voor deze
  regel geeft het nu al 'glutenvrije pasta 400 gram' zodra de match er is (geen dubbele punt in de code).
- `tests/recipe-io.test.ts`: `normalizeRecipe` met geldige variants → gelijk; swap zonder raw valt
  weg; variant met lege swaps én lege checked valt weg; onbekende dieet-key 'notenvrij' blijft staan;
  `variants: 'x'` → key weg; `tip` string i.p.v. Text → key weg; `tip: null` blijft null.
- `tests/overrides.test.ts`: `applyOverride` met `patch.variants`/`patch.tip` zet ze op het recept
  (vervang-semantiek); `RECIPE_PATCH_KEYS` bevat beide.
- `tests/token.test.ts` + fixtures: de drie bevroren tokens (§2d) op beide engines decoderen en
  encoderen byte-gelijk; de oude tokens ongewijzigd (bestaande tests).
- `tests/share.test.ts`: `buildRecipeEnvelope` laat `variants`/`tip` meereizen en `parseEnvelope`
  geeft ze genormaliseerd terug; `buildPlanEnvelope` zet `vr` alleen bij `variant`; `parseEnvelope`
  leest `vr:'glutenvrij'` → `variant`, `vr:'x'` → weg; `buildPatchEnvelope` met `patch.variants`;
  `buildReadableRecipe` eindigt met '💡 Tip van de maker: …' als tip er is, EN-blok "Maker's tip:".
  ⚠ Feitencheck: `buildReadableRecipe` (message.ts) wordt nu getest in tests/message.test.ts, niet hier;
  met een `url` is de laatste regel de link, dus de tip staat aan het eind van het taalblok, niet van de tekst.
- `tests/aggregate.test.ts`: `lines(recipeId, item)` krijgt het slot mee; slot met
  variant 'glutenvrij' en regels [glutenvrije pasta] → item met ing 'glutenvrije-pasta' en
  `sources[0].diet === 'glutenvrij'`; bestaande tests met één-parameter-functie groen.
- `tests/cooking.test.ts` (13K): `cookPath` met `variant: 'glutenvrij'` eindigt op `&v=glutenvrij`;
  zonder variant byte-gelijk aan nu.
- `tests/badges.test.ts`: twee logregels met `variant:'glutenvrij'` op een recept zonder die tag tellen
  voor de regel `{kind:'tag', id:'glutenvrij', n:2}`; `variant:'vegan'` telt ook voor 'vegetarisch'.
- `tests/vtab-memory.test.ts` (nieuw, pure helpers): `rememberTab`/`rememberedTab` round-trip op een
  in-memory storage-stub, max 200, ongeldige JSON → null.
- Repo-functies worden niet in node getest (Dexie); acceptatiechecks hieronder dekken ze.

**Acceptatiechecks in de dev-app** (`npm run dev`, Chrome, 375 px; recept "Spaghettischotel uit de
oven" of een eigen kopie ervan):
1. Open het recept: boven "Ingrediënten" staat Origineel · Glutenvrij (stippel) · Vegetarisch (stippel)
   · Vegan (stippel). Open "Ratatouille": geen tabrij (van nature vegetarisch, vegan en glutenvrij, geen
   versies).
   ⚠ Feitencheck: eerst stond hier "Aardappel-broccoli gratin", maar die is niet vegan (eieren, zure room,
   kaas) en krijgt dus wél een tabrij met Vegan (stippel). Klassiekers zonder tabrij (alle drie diëten
   niet `false` in `dietTags`): Ratatouille, Spaanse groenten, Avocadosalade met pecannoten, Tomatensalsa
   (bij kabeljauw met notencrumble), Dahl van rode linzen & boerenkool (glutenvrij "waarschijnlijk").
2. Tik Glutenvrij: statusregel "Nog niet bevestigd …", regel 1 "400 g glutenvrije pasta" met gele balk.
   Tik "Controleer en keur goed" → sheet met Annuleer/Goedkeuren bovenaan; veeg weg → niets bewaard
   (tab nog stippel). Opnieuw → Goedkeuren → tab vol, snack "Glutenvrij versie goedgekeurd"; herlaad:
   nog vol en Glutenvrij nog gekozen (`?v=glutenvrij` in de URL).
3. Tik Vegan: sheet toont kaas als vervanging ("125 g geraspte vegan kaas") en gehakt als "controleer
   zelf" met checkbox (de klassieker heeft geen eieren; de gehakt-swap geldt alleen voor vegetarisch);
   Goedkeuren is grijs met "Vink eerst elke ‘controleer zelf’-regel af."; vink af → Goedkeuren actief.
4. Veeg op de ingrediëntenlijst naar links/rechts: tabs wisselen; verticaal scrollen werkt nog.
5. Koken vanaf Glutenvrij: kicker "Glutenvrije versie"; Klaarzetten toont glutenvrije pasta; stap 1
   "Spaghetti koken. …" (EN "Cook the spaghetti. …"): "Spaghetti" is groen, tik → "(400 g glutenvrije
   pasta)". Gekookt! → in
   Meer → Badges telt Glutenvrijbuiter 1/5 (op een vers testprofiel zonder eerdere glutenvrije kookbeurten).
6. "+ Deze week" vanaf Glutenvrij → Week toont onder de naam de chip "Glutenvrij"; tik → keuzerij
   Origineel · Glutenvrij; Boodschappenlijst maken → "400 g glutenvrije pasta", geen spaghetti;
   kies Origineel → banner "Weekplan gewijzigd".
7. Bewerk het eigen recept: verander regel 1 in "400 g penne" → tab Glutenvrij is stippel met "Het recept
   is veranderd …"; "Opnieuw controleren" → Goedkeuren → vol.
8. "Eigen versie maken" op het origineel → editor met naam "… (versie van Test)"; bewaar → op het
   origineel staat tab "Test" met "Open als recept"; Deel die versie → plak de link in In & uit op een
   tweede profiel/kanaal → komt als tab op het origineel.
9. Tip: bewerk → vul "Tip van de maker" → kaartje "Tip van Test" op het recept; Deel → de leesbare
   tekst eindigt met 💡; typ een notitie → op Deel verschijnt de schakelaar; aan → `tip` in de link
   (controleer in In & uit op het andere profiel: "met een tip van de maker"); het recept zelf heeft
   nog alleen de bewerkte tip.
10. Donker thema: de vijf tabkleuren leesbaar; `npm run check`, `npm test`, `npm run build`,
    `npm run build:next`, `npm run validate:data` groen.

**DEVICE-TEST-rijen** (in beide taalsecties; definitief 86–88, na de rijen van 13F):

Rij 86 — NL: **Varianten als tabs: kiezen en goedkeuren (fase 6, 13D).** 1. Open het recept
**Spaghettischotel uit de oven**. Kijk boven het kopje Ingrediënten. 2. Tik op **Glutenvrij**.
3. Tik op **Controleer en keur goed**. Veeg het venster naar beneden. 4. Tik opnieuw op **Controleer en
keur goed** en dan bovenaan op **Goedkeuren**. 5. Veeg met je vinger over de ingrediëntenlijst van
rechts naar links. 6. Tik op **Vegan** en op **Controleer en keur goed**. Kijk naar de knop
Goedkeuren. 7. Tik op **Annuleer**. | Goed als: 1. Je ziet een rij knopjes: Origineel, Glutenvrij,
Vegetarisch, Vegan; de laatste drie hebben een stippellijn. 2. Boven de lijst staat "Nog niet
bevestigd …"; de eerste regel zegt "400 g glutenvrije pasta" met een geel streepje links. 3. Het
venster gaat dicht; Glutenvrij heeft nog een stippellijn. 4. Glutenvrij is nu gevuld geel en er
verschijnt kort "Glutenvrij versie goedgekeurd". 5. Je komt op het volgende knopje; de pagina scrolt
niet opzij. 6. De regel met gehakt heeft een ! en een vakje "Gecontroleerd"; Goedkeuren is grijs met
de tekst "Vink eerst elke ‘controleer zelf’-regel af.". 7. Het venster gaat dicht; Vegan heeft nog een
stippellijn.
Rij 86 — EN: **Versions as tabs: choosing and approving (phase 6, 13D).** 1. Open the recipe
**Spaghetti bake**. Look above the heading Ingredients. 2. Tap **Gluten-free**. 3. Tap **Check and
approve**. Swipe the sheet down. 4. Tap **Check and approve** again, then **Approve** at the top.
5. Swipe your finger across the ingredient list from right to left. 6. Tap **Vegan** and **Check and
approve**. Look at the Approve button. 7. Tap **Cancel**. | Good when: 1. You see a row of pills:
Original, Gluten-free, Vegetarian, Vegan; the last three have a dashed outline. 2. Above the list it
says "Not confirmed yet …"; the first line says "400 g gluten-free pasta" with a yellow bar on the
left. 3. The sheet closes; Gluten-free is still dashed. 4. Gluten-free is now solid yellow and
"Gluten-free version approved" shows briefly. 5. You land on the next pill; the page does not scroll
sideways. 6. The mince line has a ! and a box "Checked"; Approve is grey with "Tick every ‘check
yourself’ line first.". 7. The sheet closes; Vegan is still dashed.
⚠ Feitencheck (rij 86, stap 6): eerst stond hier "eieren"/"egg", maar Spaghettischotel uit de oven heeft
geen eieren; vegan geeft daar kaas → vegan kaas (vervanging) en gehakt (regel 8) als "controleer zelf".
Stap 3 ("veeg het venster naar beneden") vraagt een wegveeg die VariantSheet nu niet heeft (zie §1c).

Rij 87 — NL: **De gekozen versie volgt je naar de kookstand, de week en de lijst (fase 6, 13D).**
1. Open **Spaghettischotel uit de oven** met de gele tab **Glutenvrij** gekozen (zie rij 86). Tik op
**Koken** en op **Begin**. 2. Tik in stap 1 op het groene woord **Spaghetti**. 3. Ga terug naar het
recept. Tik op **+ Deze week**. Tik onderaan op **Week**. 4. Tik onder de naam van het gerecht op het
knopje **Glutenvrij**. 5. Tik op **Boodschappenlijst maken**. 6. Ga terug naar Week en kies in de
rij **Origineel**. Tik onderaan op **Boodschappen**. | Goed als: 1. Boven de stap staat "Glutenvrije
versie"; op Klaarzetten staat "400 g glutenvrije pasta". 2. Achter het woord verschijnt "(400 g
glutenvrije pasta)". 3. Onder de naam van het gerecht staat een geel knopje "Glutenvrij". 4. Er
klapt een rij open: Origineel · Glutenvrij, met de uitleg "Alleen goedgekeurde versies …". 5. In de
lijst staat "400 g glutenvrije pasta" en geen spaghetti. 6. Bovenaan staat "Weekplan gewijzigd" met
een knop Bijwerken.
Rij 87 — EN: **The chosen version follows you into cook mode, the week and the list (phase 6, 13D).**
1. Open **Spaghetti bake** with the yellow tab **Gluten-free** chosen (see row 86). Tap **Cook** and
**Start**. 2. In step 1 tap the green word **spaghetti**. 3. Go back to the recipe. Tap **+ This
week**. Tap **Week** at the bottom. 4. Under the dish name tap the pill **Gluten-free**. 5. Tap **Make
the shopping list**. 6. Go back to Week and choose **Original** in the row. Tap **Shopping** at the
bottom. | Good when: 1. Above the step it says "Gluten-free version"; the Get ready page says "400 g
gluten-free pasta". 2. "(400 g gluten-free pasta)" appears after the word. 3. Under the dish name
there is a yellow pill "Gluten-free". 4. A row opens: Original · Gluten-free, with the note "Only
approved versions …". 5. The list says "400 g gluten-free pasta" and no spaghetti. 6. At the top it
says "Week plan changed" with an Update button.

Rij 88 — NL: **Tip van de maker en een eigen versie delen (fase 6, 13D).** 1. Open een eigen recept.
Tik onderaan op **Eigen versie maken**. 2. Verander één ingrediënt en tik op **Bewaar**. 3. Tik op
**Versie van …** om terug te gaan naar het origineel. Kijk naar de tabrij. 4. Open de versie weer via
het knopje met jouw naam → **Open als recept**. Tik op **Recept bewerken**, vul bij **Tip van de
maker** "Proef eerst" in en bewaar. 5. Typ onderaan bij Notities "alleen voor mij" en wacht tot
"Bewaard" verschijnt. Tik op **Deel**. 6. Zet **Mijn notitie meesturen als tip van de maker** aan.
Deel de link met de ander (iPhone: kopieer → app → In & uit → plak). | Goed als: 1. De editor opent
met de naam "… (versie van <jouw naam>)". 2. Het recept toont "Versie van <origineel>". 3. Op het
origineel staat een blauw knopje met jouw naam. 4. Onder de stappen staat een kaartje "💡 Tip van
<jouw naam>: Proef eerst". 5. Onder het voorbeeld staat een schakelaar over je notitie. 6. Bij de
ander staat in In & uit "met een tip van de maker"; na opslaan staat op zijn origineel het knopje met
jouw naam, en in de tip staan "Proef eerst" én "alleen voor mij"; op jouw telefoon staat in de tip
alleen "Proef eerst".
Rij 88 — EN: **Maker's tip and sharing your own version (phase 6, 13D).** 1. Open one of your own
recipes. Tap **Make my own version** at the bottom. 2. Change one ingredient and tap **Save**. 3. Tap
**Version of …** to go back to the original. Look at the tab row. 4. Open the version again via the
pill with your name → **Open as a recipe**. Tap **Edit this recipe**, fill in "Taste first" under
**Maker's tip** and save. 5. Type "just for me" under Notes at the bottom and wait for "Saved". Tap
**Share**. 6. Switch on **Send my note along as the maker's tip**. Share the link with the other
person (iPhone: copy → app → In & out → paste). | Good when: 1. The editor opens with the name
"… (<your name>'s version)". 2. The recipe shows "Version of <original>". 3. The original has a blue
pill with your name. 4. Under the steps there is a card "💡 Tip from <your name>: Taste first".
5. Under the preview there is a switch about your note. 6. On the other phone In & out says "with a
tip from the maker"; after saving, their original shows the pill with your name, and the tip holds
both "Taste first" and "just for me"; on your own phone the tip only says "Taste first".

## 7. Controlelijst voor Fable (eindcontrole)

1. `src/db/db.ts` ongewijzigd door 13D (geen `version(…)` erbij); geen nieuwe setting-key.
2. `Recipe.variants`/`tip` alleen gezet via `approveVariant`/`revokeVariant`/`setTip`/de editor;
   grep op `variants:` buiten die plekken levert niets op in `src/screens`/`src/components`.
3. `tests/fixtures/frozen-share-tokens.ts`: de oude constanten byte-gelijk aan vóór 13D (git diff
   toont alleen toevoegingen); de drie nieuwe tokens decoderen op beide engines en `encodeToken`
   reproduceert ze; `TOKEN_KEYS` en `TOKEN_RE` ongewijzigd.
4. `recipeFingerprint`/`contentFingerprint` ongewijzigd (tests/merge.test.ts groen zonder aanpassing).
5. `planHash` van een plan zonder `variant` is gelijk aan de waarde van vóór 13D (vaste testwaarde).
6. `variantView`: een regel met gewijzigd `ing` maakt een goedgekeurde tab `stale`; een natural
   dieet toont geen inhoud; `swappedFrom` komt nergens in `db.userRecipes` terecht (dev-app-check: na
   acceptatiecheck 2 de rij in devtools → IndexedDB → userRecipes bekijken; geen Node-test, repo draait
   niet in vitest).
7. Goedkeuren is uitgeschakeld zolang een "controleer zelf"-rij niet is afgevinkt; de sheet heeft
   Annuleer/Goedkeuren bovenaan via SheetPortal; wegvegen bewaart niets.
8. De tabrij ontbreekt op een recept zonder iets te kiezen (b.v. een van nature vegan en glutenvrije
   salade zonder persoonlijke versies) en staat er wél zodra er een persoonlijke versie is.
9. Vegen op de ingrediëntensectie wisselt tabs en scrolt nog gewoon verticaal (`touch-action: pan-y`);
   een veeg die op de porties-kiezer begint telt niet als tik.
10. Kookstand met `?v=`: Klaarzetten, groene woorden, "hoeveel?" en Gekookt! gebruiken dezelfde
    versieregels; de cooklog-rij heeft `variant`; Glutenvrijbuiter telt hem.
11. Boodschappenlijst: slot met `variant: 'glutenvrij'` levert "glutenvrije pasta" en géén
    "spaghetti"; wisselen naar Origineel maakt de lijst stale.
12. `#w=` met `vr`: Overnemen zet `variant` op het slot als die tab hier goedgekeurd is, anders niet.
13. ShareScreen: zonder schakelaar bevat de envelop geen `tip` uit de notitie; met schakelaar wel;
    `db.notes` en `userRecipes` onveranderd na delen (test via repo-mock of handmatig).
14. `recipe.copy`, `recipe.copyHint`, `recipe.copyNoProfile`, `variant.make.*`, `variant.title.*`,
    `variant.save`, `variant.saving`, `variant.foot`, `variant.intro`, `recipe.alsoAs` bestaan niet
    meer in `src/i18n` (`recipe.copyAsText`, `recipe.copyFailed` en `variant.saveFailed` blijven); alle `vt.`/`tip.`/`version.`/
    `week.variant`/`inbox.with*`-keys bestaan in NL én EN; geen key in de UI die alleen in één taal is.
15. Donker thema: alle vijf kleurparen staan in beide donkerblokken van base.css en zijn identiek;
    contrast inkt-op-achtergrond ≥ 4,5:1 (handmatig met een contrastchecker voor de 10 paren).
16. 360 px: de tabrij scrolt horizontaal zonder de pagina te verbreden; sheet-knoppen 44 px;
    tekstvakken 16 px.
17. STATUS.md noemt 13D als afgerond met de blokken; DEVICE-TEST rijen 86–88 in beide talen;
    `npm run check`, `npm test`, `npm run build`, `npm run build:next`, `npm run validate:data` groen.

## 8. Open vragen voor Stijn

1. **Jouw glutenvrije uiensoep-kopie.** Voorstel: hij blijft als eigen recept staan en verschijnt op
   het origineel als tab "Stijn"; na 13D keur je met twee tikken de glutenvrije tab op het origineel
   goed en gooi je de kopie weg (je ene kookbeurt op de kopie blijft in de log staan, maar telt dan
   niet meer mee bij het origineel). Akkoord, of wil je dat de app die kookbeurt óók naar het
   origineel overzet (dan moet 13F's id-migratie dat doen)?
2. **Onthouden welke tab je het laatst koos** gebeurt nu per recept op deze telefoon. Wil je later
   één instelling "ik eet glutenvrij" die op elk recept meteen die tab kiest? Dan hoort dat bij 6D
   (profiel) of bij een later blok; nu niet gebouwd.
3. **Naam van een eigen versie:** "Goulash (versie van Dino)" / "Goulash (Dino's version)". Goed zo,
   of liever "Dino's goulash"?
