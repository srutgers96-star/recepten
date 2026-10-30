# Spec 13F — Stijns recepten inbouwen met id-migratie

Status: compleet (Fable, 22 okt 2026) — **VERVALLEN (Stijn, 30 okt 2026):** "skip het 22 recepten van Stijn's export
toevoegen … dat skipt weer een hoop en is niet nodig". De 22 recepten worden niet ingebouwd, geen id-migratie, geen
Dexie v8, DATA_VERSION blijft 9, klassiekers blijven 216. Alleen de 8 woordenboek-entries uit §2b (nduja, panko, truffel,
haas, foie-gras, keelspek, noilly-prat, mokkaboontje) gaan naar docs/IDEAS.md idee 8 (ingrediënten-upgrade).

**Let op (Fable, 24 okt 2026):** DATA_VERSION 9 is op 24 okt al gebruikt (drie keukens toegewezen); 13F bumpt daarom naar **10** (hieronder aangepast). tests/migrate.test.ts pint nu 9.

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (besluiten over specs heen in
docs/specs/README.md §2; bij tegenspraak wint README.md). Voor deze spec:
- Bouwvolgorde: Home A+ → 13K → 6B+13E → bijgerechten → **13F (deze spec)** → 13D → 6C → 6D. Gevolgen,
  overal in de tekst verwerkt: `DATA_VERSION` **9 → 10** (niet 4 → 5); de bundel telt daarna **236**
  klassiekers (196 + 20 bijgerechten + 20 van 13F; `takenIds` = de 216 vóór 13F); `data/cuisines.json`
  (met `hongaars`) en de categorieën `gebak`, `nagerecht`, `bijgerecht` bestaan (6B); de `lactose`-vlag is
  verplicht op de 8 nieuwe woordenboek-entries (6B blok 1). Volgorde in `migrate()`: bron → batches →
  `applyReview` → sides → **extras (13F)** → `applyMeta` → `applyDerivedTags` → sorteren.
- **Dexie v8 is van deze spec** (upgrade zonder schemawijziging). 13D, 6C en 6D voegen géén versie toe;
  de eerstvolgende vrije versie is v9.
- Node-tools kunnen src/domain/merge.ts niet laden (data.ts-import). Daarom komen `fieldFingerprints`
  **en** `contentFingerprint` in een nieuw `src/domain/fingerprints.ts` (importeert alleen
  `./recipe-io.ts`/`./model.ts`); merge.ts re-exporteert `contentFingerprint` vandaar, zodat bestaande
  imports blijven werken. tools/import-stijnchat.ts en validate-data.ts importeren fingerprints.ts.
  `checkMeta` wordt geëxporteerd (validate-data.ts gebruikt hem).
- `mapShareIds(share, aliases, lookup: (id: string) => Recipe | undefined)`; `planImport` geeft
  `(id) => bases.get(id) ?? byId.get(id)` mee (de terugval op `local.recipes` uit §2e).
- Een ontvangen `#w=` loopt niet door `planImport`: `takePlan` (InboxScreen.tsx) mapt elk `it.recipeId`
  eerst door `mapId(id, BUNDLED_ALIASES)` (één regel; blok 3 bouwer C bezit daarvoor ook InboxScreen.tsx).
- `applyAliases` herrekent bij een omgezet plan ook `List.generatedFrom`/`generatedFromAll` met
  `planHash`/`planHashAll` over de omgezette items, zodat Boodschappen na de migratie niet onterecht
  "Weekplan gewijzigd" zegt.
- `ensureBuiltins` verwijdert bij een versiewissel ook elke `userRecipes`-rij met een ingebouwd id waarvan
  `contentFingerprint` gelijk is aan de ingebouwde (identieke ontvangen kopieën van een `b:`-id, zie
  bijgerechten.md §1 Delen); een afwijkende kopie blijft staan. Blok 3 bouwer B.
- §6a test 4: de dekkingsgrens over de 20 is **≥ 0,78** (de 78 Fat-Duck-regels blijven `ing: null`); over
  de 19 blijft ≥ 0,95.
- Typen voor src/domain/id-aliases.ts die alleen in src/db/model.ts staan (Photo, List, ShareEvent,
  ImportSnapshot, BackupBundle): `import type { … } from '../db/model.ts'` is toegestaan (type-only,
  verdwijnt bij compileren; eerste en enige uitzondering op "domein importeert geen db").
- 13D (later): de id-migratie zet `variantOf`/`origin.basedOn` om (regel 6 van §2d) en de glutenvrije
  uiensoep blijft 'personal' — beide staan er al. Rij 85 ("Ook als: glutenvrij") klopt tot 13D blok 2 de
  chips door tabs vervangt; 13D's rijen 86–88 nemen het dan over.
- 6D-1 (later) leidt XP af uit de kooklog zoals die er na de migratie staat; de seed `cook:<recipeId>|<at>`
  verandert dus mee bij een toekomstige aliasronde (kleine, eerlijke herberekening; gedocumenteerd).
- DEVICE-TEST-rijen zijn definitief **82–85**. De drie open vragen voor Stijn blijven (naam Griekse
  salade; de twee kookboekrecepten; voornamen op de site); standaard = zoals hier gekozen.

Feitencheck Opus, 22 okt 2026: 29 correcties (11 als ⚠-regel onder de tekst; de keuzes zelf zijn
niet veranderd). Nagegaan tegen de code en tegen Stijns back-up van 13 okt: de recepttabel in §2a
(ids, regels/stappen, personen, origin, `receivedFingerprint` van u:1s41pool), de 20 b:-ids
(`builtinId` nagerekend, geen botsing), Dexie v7, DATA_VERSION 4, 196 klassiekers, 1603 ingrediënten,
gangpaden, eenheden en de 8 nieuwe ingrediënt-ids (bestaan nog niet) kloppen.
1. §1a.3: "eenmaal verdiend blijft verdiend" bestaat al in src/badges.ts `badgeStatuses`.
2. §1a.4 (⚠): de receptpagina toont geen "aangepast" en geen Herstel origineel (die staan in de
   editor); een klassieker heeft op de receptpagina geen Bewerk-knop.
3. §1a.5 (⚠): het tabblad Ontvangen heeft geen rijen "Ontvangen van Gabi · 7 recepten".
4. §1a.6: een klassieker zónder aanpassing reist als `#r=` (src/screens/ShareScreen.tsx).
5. §1e: de echte teksten zijn "Heb je al" en "Aanpassing van klassieker" + naam + "aangepast door {name}".
6. §2b (⚠): `data/cuisines.json` en de categorieën `gebak`/`nagerecht`/`bijgerecht` bestaan nog niet;
   docs/specs/labels-categorieen.md noemt ze wel (ook `hongaars`) en maakt `lactose` verplicht.
7. §2c: "klassiekers reizen nooit als recept" klopt niet (ShareScreen en de meerkeuze-deel).
8. §2d regel 5 (⚠): de lijst-hash `generatedFrom` bevat recipeIds.
9. §2e (⚠): plan-items van een `#w=` lopen niet door `planImport`.
10. §3 blok 1 (⚠): src/domain/merge.ts laadt niet onder `node --experimental-strip-types`.
11. §3 blok 2: de Map in `planImport` heet `bases`, niet `basesMap`.
12. §3 blok 3 Bouwer C (⚠): de badges-regel bestaat al.
13. §3 blok 4: `originLine(r, l, all)` gebruikt `r`, niet `recipe`.
14. §4 blok 3: badges "eenmaal verdiend" bestaat al.
15. §5: de vertaalbadge staat alleen in de Engelse UI ("Machine translation — tap to improve").
16. §5: bij een geregistreerde badge toont de voortgang het doel (`current = target`), niet het lagere aantal.
17. §6a test 4 (⚠): de dekkingsgrens 0,80 over de 20 is met de bron niet te halen.
18. §6c 2: de receptenlijst toont geen "1× gekookt" (dat staat op de receptpagina).
19. §6c 2 (⚠): "aangepast" en Herstel origineel staan in de editor, niet op de receptpagina.
20. §6c 5: "al aanwezig" → "Heb je al"; de echte tekst van het patch-item.
21. Rij 82 (⚠): een klassieker heeft geen **Bewerk**; Herstel origineel alleen bij een bestaande aanpassing.
22. Rij 82 EN: "Refresh" → **Reload** (`update.reload`).
23. Rij 83 EN: "Refresh" → **Reload**.
24. Rij 83 (⚠): geen "adjusted" op de receptpagina; geen blijvende rijen "Received from Stijn".
25. Rij 84 NL: de echte voorvertoningsteksten.
26. Rij 84 EN: "Already have it" / "Tweak of a classic" / "tweaked by Gabi".
27. Rij 85 NL: "Ook als:" staat onder de titel, niet onder de ingrediënten.
28. Rij 85 EN: idem ("Look under the title").
29. §7 punt 11: de badges-regel bestond al; alleen nagaan.

Bron: docs/phase-6-spec.md 13F + "Open vragen ronde 13 okt" punt 8 (Stijn, 13 okt: alles inbouwen, de twee
nduja-ragù's zijn dubbel, geen dubbelen bij Stijn en Gabi, "uit de Stijnchat", gewoon overnemen/licht
versimpelen, bereiding in eigen woorden waar het van een kookboek of website komt, openbaar is akkoord),
13D (varianten worden tabs) en 6B/13E (nieuwe categorieën en keukens). Bronbestand: Stijns back-up van
13 okt 2026 (`recepten-2026-10-13.json`: 22 eigen/ontvangen recepten, 12 eigen ingrediënten, 1 aanpassing).
Code gecontroleerd op 22 okt 2026 (Dexie v7, DATA_VERSION 4, 196 klassiekers, 1603 ingrediënten).
Alles wat een keuze is, staat hier gekozen; bij twijfel §5.

## 1. Doel en gebruikersgedrag

**In één zin:** de 22 recepten die Stijn sinds september toevoegde of van Gabi kreeg, worden 20
klassiekers in het boek (voor iedereen, ook op de openbare site), en op de telefoons van Stijn en Gabi
verhuist alles wat aan hun eigen exemplaar hing (favoriet, kookbeurten, foto's, notities, weekplan,
boodschappenlijst, In & uit-geschiedenis) geruisloos mee naar de klassieker. Niemand hoeft iets te doen;
er ontstaat geen dubbel; niets gaat verloren.

### 1a. Na de update (Stijn, Android; Gabi, iPhone): wat je ziet
1. De app werkt bij zoals altijd ("Nieuwe versie — vernieuwen"). Bij het openen gebeurt de migratie
   (§2d), onzichtbaar en in één keer. Daarna staat bovenaan het scherm één keer de **migratiemelding**
   (§1c), weg te tikken.
2. **Recepten**: de lijst telt 236 klassiekers. Onder **Eigen** staan de eigen exemplaren niet meer (bij
   Stijn blijft alleen "Franse uiensoep met Gruyère (glutenvrij)"); de recepten zelf staan er gewoon, nu
   zonder "eigen recept van Stijn" maar met hun credit (§1b). Zoeken en chips werken ongewijzigd.
3. **Favorieten** (Dino's Gulyás bij Stijn), **kookbeurten**, **foto's**, **notities**, **badges** (ook
   "Receptenschrijver"/"Kookboekauteur" blijven verdiend: dat doet src/badges.ts `badgeStatuses` al voor
   ids in `badges.earned`; Stijns back-up heeft ze onder `all`), **weekplan** en **boodschappenlijst**
   wijzen naar de klassieker: op de receptpagina staat nog steeds "3× gekookt · laatst 12 okt" en de foto
   bovenaan.
4. **Eigen wijzigingen**: heeft iemand zijn exemplaar na 13 okt nog bewerkt (of heeft Gabi haar origineel
   anders dan wat ze Stijn stuurde), dan staan die wijzigingen als **aanpassing van de klassieker**
   (bestaande override-mechaniek): de receptpagina toont "aangepast" met **Herstel origineel**, en
   bewerken gaat via de normale editor-aanpassing. Niets hiervan wordt weggegooid.
   ⚠ Feitencheck: src/screens/RecipeScreen.tsx toont bij een aangepaste klassieker GEEN "aangepast" en
   GEEN Herstel origineel. Die staan in de editor (src/screens/EditScreen.tsx): badge `edit.overrideActive`
   "Aangepast op {date}" / "Tweaked on {date}" + knop `edit.restoreOriginal`, alleen als er een override
   is. "aangepast"/"adjusted" (`delta.adjusted`) staat alleen op ShareScreen/DeltaShareScreen. Een
   klassieker heeft op de receptpagina ook geen **Bewerk** (alleen "Maak eigen kopie"); de editor van
   een klassieker opent alleen via de vertaalbadge in de Engelse UI of via `#/edit/<id>`.
5. **In & uit**: het tabblad Ontvangen toont de 7 recepten van Gabi niet meer als "ontvangen recept"
   (het zijn klassiekers); de rijen "Ontvangen van Gabi · 7 recepten" blijven staan en openen de klassieker.
   ⚠ Feitencheck: zulke rijen bestaan niet. Ontvangen (src/screens/InboxScreen.tsx) toont "Ontvangen
   recepten" (`receivedRows`: userRecipes met origin 'received' + ontvangen patches) en de inklapbare
   "Importgeschiedenis" (`listImports(10)`: datum · "van Gabi" · "{added} nieuw · …"; die rijen openen
   geen recept). De 'in'-rijen van de events-tabel worden nergens getoond (alleen 'out' onder Gedeeld).
6. **Delen**: een aangepaste klassieker reist als `#p=`, een klassieker zonder aanpassing als `#r=`
   (src/screens/ShareScreen.tsx); "Maak eigen kopie" blijft.

### 1b. Receptpagina en credit
Op de meta-regel (nu "klassieker uit het boek") staat voor een nieuwe klassieker de credit uit de data,
letterlijk: **"Uit de Stijnchat"** / **"From the Stijn chat"**, **"Van Gabi"** / **"From Gabi"**,
**"Toegevoegd door Stijn"** / **"Added by Stijn"**, **"Van Dino, via Stijn"** / **"From Dino, via Stijn"**,
en voor de twee kookboekrecepten de langere zin uit §2b. Geen i18n-key: `credit` is receptdata ({nl, en}).
De 196 houden `recipe.classic` ("klassieker uit het boek" / "classic from the book").

### 1c. Migratiemelding (eenmalig, `src/components/AliasNotice.tsx`, in de app-schil boven de inhoud)
Alleen als de migratie iets verplaatste (setting `aliases.notice`, §2d). Opmaak als de UpdateBar.
- `aliases.notice.title` — NL **Nieuw in het boek: {n} recepten van Stijn en Gabi** · EN **New in the book:
  {n} recipes from Stijn and Gabi** ({n} = aantal verschillende `to`-waarden in BUNDLED_ALIASES = 20)
- `aliases.notice.body` — NL **Je eigen exemplaren zijn erin opgegaan; favorieten, kookbeurten, foto's en
  notities zijn meegegaan.** · EN **Your own copies have merged into them; favourites, cooks, photos and
  notes came along.**
- `aliases.notice.bodyOverrides` (erachter, alleen als `overrides > 0`) — NL **{k} eigen wijziging(en)
  staan als aanpassing bij de klassieker.** · EN **{k} of your edits are kept as adjustments to the classic.**
- knop `aliases.notice.story` — NL **Bekijk in Het verhaal** · EN **See in The story** (→ `#/story`, sluit)
- knop `aliases.notice.close` — NL **Sluit** · EN **Close** (wist de setting; komt nooit terug)

### 1d. Het verhaal: "Nieuw sinds de eerste druk"
Onder de teller "Samen al N van de 236 gekookt" (die telt vanzelf mee: `bundled.recipes.length`) komt een
kaart met de nieuwe klassiekers, gegroepeerd op credit-tekst, groepen op aantal (aflopend) en dan alfabet,
recepten per groep op naam in de app-taal; elk recept is een knop naar `#/recipe/<id>`.
- `story.added.title` — NL **Nieuw sinds de eerste druk** · EN **New since the first edition**
- `story.added.intro` — NL **{n} recepten die er na het boek bij kwamen.** · EN **{n} recipes added after
  the book.**
- groepskop = de credit zelf (`pickText(credit, lang)`), bv. "Uit de Stijnchat" met daaronder
  "Stijn's Bananenbrood (baksteen) · Stijn's Clafoutis · Stijn's Hete Blixem · Stijn's Koelkastaugurken".
Lege staat: geen klassieker met `credit` → de kaart ontbreekt (nooit een lege kop).

### 1e. Ontvangen van een oude link of back-up (na de migratie)
- Gabi (of iemand anders) stuurt een oude `#r=`/`#b=`/`#w=` met een u:-id van een ingebouwd recept: de
  importvoorvertoning toont **"Heb je al"** (`inbox.status.present`) als de inhoud gelijk is aan de
  klassieker, en anders een patch-item **"Aanpassing van klassieker"** (`inbox.patch`) met de naam en
  **"aangepast door Gabi"** (`inbox.patchBy`), met de bestaande keuzes (overnemen / mijn versie / beide) —
  nooit een nieuw eigen recept. Geen nieuwe teksten nodig: de patch-weergave van ImportPreview bestaat.
- Herstel van een back-up van vóór de migratie (Meer → Opslag → Herstel): de u:-recepten erin komen niet
  terug als eigen recept; hun favorieten, kookbeurten en foto's landen bij de klassieker; afwijkende inhoud
  wordt een aanpassing. De resultaatregel van Herstel verandert niet.
- Fouten: de migratie kan alleen falen als IndexedDB faalt; dan toont de app de bestaande bootfout en
  probeert het bij de volgende start opnieuw (idempotent). Er is geen "half gemigreerd": de v8-upgrade is
  één transactie.

### 1f. iPhone vs Android
Geen verschil in gedrag: de migratie is lokaal en gelijk op beide. Alleen de aanleiding verschilt: op Gabi's
iPhone draait hij zodra zij de app opent na de update (Safari-webapp werkt de service worker op de
achtergrond bij; de melding "Nieuwe versie" verschijnt zoals altijd). Het ontvangen van oude links blijft
op de iPhone kopiëren → app → plakken (invariant 5), met hetzelfde resultaat als op Android.

## 2. Datamodel en migraties

### 2a. Wat er in de bundel komt (bouwblok 1)

**`data/source/stijnchat-2026-10-13.json`** (nieuw, read-only, nooit met de hand bewerken). Géén kopie
van de hele back-up: de repo is openbaar, en de back-up bevat profiel-, toestel- en huishoud-ids. Eén keer
aanmaken met node (daarna nooit meer aanraken):
```
node -e "const b=require('C:/Users/srutg/Downloads/recepten-2026-10-13.json');
require('fs').writeFileSync('data/source/stijnchat-2026-10-13.json',
JSON.stringify({at:b.at,userRecipes:b.userRecipes,userIngredients:b.userIngredients},null,2)+'\n')"
```
Inhoud: `{ at, userRecipes: Recipe[22], userIngredients: Ingredient[12] }`. NIET overnemen: profiles,
favorites, settings, plans, lists, overrides, cookLog, pantry. De 22 recepten (id → naam NL / origin):
```
u:1s41pool Marokkaanse Gehaktbal Stoof            received Gabi  vlees   28 regels 13 stappen rev 8 (ontv. rev 4)
u:4oudiiqy Honing-mosterdkip                       user Stijn     —       9/4
u:5zxl52cq Pittige Ndujaworst met Aubergine Ragout received Gabi  vlees   20/11 (NL+EN regels)   ┐ dubbel
u:zws63nhy Pittige worst, aubergine en nduja ragù  received Gabi  vlees   19/11 (alleen EN regels)┘
u:7vhqwgnh Beste Varkenshaas met Dijon-roomsaus    user Stijn     vlees   23/6, 8 personen
u:7yqcb09v Franse uiensoep met Gruyère             user Stijn     soep    13/11
u:uvrzu65p Franse uiensoep met Gruyère (glutenvrij) user Stijn    soep    variantOf u:7yqcb09v (blok F-kopie)
u:9mj2gix5 Stijn's Bananenbrood (baksteen)         user Stijn     oven    12/11, 2 personen
u:ajbwowgt Stijn's Clafoutis                       user Stijn     oven    7/7
u:bmlzqeoc Gemarineerde Varkenshaas                received Gabi  vlees   16/6
u:k4is5jb1 Stijn's Koelkastaugurken                user Stijn     overig  10/4, 2 personen
u:kaxbz7i4 Romige Toscaanse kip met spinazie, …    received Gabi  vlees   15/7 (alleen EN regels)
u:n0m6lf0q Stijn's Hete Blixem                     user Stijn     stamppot 8/4, 6 personen
u:o71b7bik Pompoensoep met linzen en kokosmelk     user Stijn     soep    11/6
u:ojv1fayv Kip in wittewijnsaus uit de oven        received Gabi  vlees   12/5
u:q5fs1r3w Klassieke Fettuccine Alfredo            user Stijn     pasta   7/4, 2 personen
u:rzpfetmr Dino's Gulyás                           user Stijn     vlees   18/4 (favoriet van Stijn)
u:sdzuiy6i Griekse salade                          user Stijn     salade  10/7  (id botst met b:griekse-salade!)
u:sjzpykqe Penne met romige spinazie en zalm       user Stijn     pasta   9/6
u:upgcww8h Botrytis Cinerea-dessert (The Fat Duck) user Stijn     overig  143/52 (78 regels onherkend)
u:w9mcohnb Lièvre à la royale met groentecocotte … user Stijn     vlees   32/16, 6 personen
u:yyhwr2h5 Malse gebakken varkensribbetjes …       received Gabi  vlees   11/7
```
Alle recepten hebben Engelse stappen (AI-vertaling via de plakprompt; bij Gabi's recepten is het Engels het
origineel). Geen enkel recept heeft `description`, `time` of `servingTip`.

**`data/stijnchat-meta.json`** (nieuw, met de hand; Opus vult hem volgens de tabel in §2b). Per bronrecept
één regel; het bestand is de plek voor ELKE redactionele keuze, de tool bevat geen receptkennis:
```ts
// tools/import-stijnchat.ts
export interface StijnchatMeta {
  /** Eigen-ingrediënt-id uit de back-up -> ingebouwd id, of null = regel blijft onherkend (ing: null). */
  ingredients: Record<string, string | null>;
  recipes: StijnchatMetaEntry[];
}
export interface StijnchatMetaEntry {
  from: string;                 // 'u:…' uit de bron
  /** 'classic' = inbouwen; 'merge' = dubbel van `into`; 'personal' = NIET inbouwen, geen alias. */
  action: 'classic' | 'merge' | 'personal';
  into?: string;                // bij 'merge': de `from` van de bewaarde versie
  name?: Text;                  // nieuwe naam (beide talen); weggelaten = bronnaam
  credit?: Text;                // verplicht bij 'classic'
  source?: 'own' | 'chat' | 'web' | 'book';   // verplicht bij 'classic'; web/book => `steps` verplicht
  category?: string | null;     // verplicht bij 'classic'; id uit data/categories.json
  cuisine?: string | null;      // id uit data/cuisines.json (6B) of null
  tags?: string[];              // vervangt de brontags (zonder dieettags); weggelaten = brontags
  servings?: number;            // weggelaten = bron
  steps?: Text[];               // herschreven bereiding; aantal = aantal bronstappen
  lines?: Record<string, { raw: Text }>;  // raw-tekst van regel i vervangen (index in de bron)
}
```

**Uitvoer van `npm run migrate`** (de bestaande `migrate()` krijgt de bron + meta als extra input, §3):
- `data/recipes.json`: 216 + 20 = **236** klassiekers (196 originelen + 20 bijgerechten + 20 van 13F), `dataVersion` **10** (`DATA_VERSION` in
  tools/migrate-from-recepten2.ts 8 → 9; 6B nam 5/6/7, de bijgerechten 8), gesorteerd op naam zoals nu.
- **`data/id-aliases.json`** (gegenereerd, alleen groeiend):
```json
{
  "u:1s41pool": { "to": "b:marokkaanse-gehaktbalstoof",
    "fp": { "name": "3f1c…", "lines": "9a02…", "steps": "c7d1…", "meta": "0e44…" },
    "content": ["28c66c29f128ff9a", "…"] },
  "u:5zxl52cq": { "to": "b:pittige-worst-met-aubergine-en-nduja-ragu", "fp": { … }, "content": ["…"] },
  "u:zws63nhy": { "to": "b:pittige-worst-met-aubergine-en-nduja-ragu", "fp": { … }, "content": ["…"] }
}
```
  `fp` = `fieldFingerprints(bronrecept)` (nieuwe export in src/domain/merge.ts: fnv1a over dezelfde
  `textKey(name)` / `linesKey(lines)` / `stepsKey(steps)` / `metaKey(r)` die `differingFields` gebruikt);
  `content` = `[contentFingerprint(bron), bron.sync?.receivedFingerprint]` (dubbelen en lege waarden weg).
  Zo kan een telefoon zónder de bron beslissen of een eigen exemplaar nog gelijk is aan de versie van 13 okt
  (of aan de versie zoals Gabi hem stuurde) en wélk veld afwijkt. 21 sleutels (de glutenvrije uiensoep krijgt
  geen alias), 20 verschillende doelen. Het bestand wordt gebundeld via
  `import aliasesJson from '../../data/id-aliases.json'` in src/domain/id-aliases.ts (patroon src/domain/data.ts).

### 2b. De 20 nieuwe klassiekers (beslissingen; Opus zet dit letterlijk in data/stijnchat-meta.json)

Id = `builtinId(name.nl)` van de NIEUWE naam. Botsingsregel in de tool (algemeen, met test): bestaat het id al
(216: de 196 originelen + 20 bijgerechten, + eerder toegevoegde), dan `-2`, `-3`, …; door de hernoeming hieronder komt dat nu nergens voor.
Credit-teksten (letterlijk, `credit: {nl, en}`):
- CHAT = "Uit de Stijnchat" / "From the Stijn chat"
- GABI = "Van Gabi" / "From Gabi"
- STIJN = "Toegevoegd door Stijn" / "Added by Stijn"
- DINO = "Van Dino, via Stijn" / "From Dino, via Stijn"

Per bronrecept: `from → b:-id` · naam NL / EN (— = bronnaam blijft) · credit · source · categorie · keuken.
```
u:1s41pool → b:marokkaanse-gehaktbalstoof
   Marokkaanse gehaktbalstoof / Moroccan meatball stew · GABI · web · vlees · marokkaans
u:4oudiiqy → b:honing-mosterdkip
   — / Honey-mustard chicken · STIJN · web · vlees · null
u:5zxl52cq → b:pittige-worst-met-aubergine-en-nduja-ragu   (+ u:zws63nhy: action 'merge', into u:5zxl52cq)
   Pittige worst met aubergine en nduja-ragù / Spicy sausage with aubergine and nduja ragù
   · GABI · web · vlees · italiaans
u:7vhqwgnh → b:varkenshaas-met-dijon-roomsaus
   Varkenshaas met dijon-roomsaus / Pork tenderloin with Dijon cream sauce · STIJN · web · vlees · null
u:7yqcb09v → b:franse-uiensoep-met-gruyere
   — / — · STIJN · own · soep · frans
u:9mj2gix5 → b:stijn-s-bananenbrood-baksteen
   — / — · CHAT · chat · gebak · null
u:ajbwowgt → b:stijn-s-clafoutis
   — / — · CHAT · chat · nagerecht · frans
u:bmlzqeoc → b:gemarineerde-varkenshaas
   Gemarineerde varkenshaas / Marinated pork tenderloin · GABI · web · vlees · null
u:k4is5jb1 → b:stijn-s-koelkastaugurken
   — / — · CHAT · chat · bijgerecht · null
u:kaxbz7i4 → b:romige-toscaanse-kip
   Romige Toscaanse kip / Creamy Tuscan chicken · GABI · web · vlees · null
u:n0m6lf0q → b:stijn-s-hete-blixem
   — / — · CHAT · chat · stamppot · hollands
u:o71b7bik → b:pompoensoep-met-linzen-en-kokosmelk
   — / — · STIJN · own · soep · null
u:ojv1fayv → b:kip-in-wittewijnsaus-uit-de-oven
   — / — · GABI · web · vlees · null
u:q5fs1r3w → b:fettuccine-alfredo
   Fettuccine Alfredo / Fettuccine Alfredo · STIJN · web · pasta · italiaans
u:rzpfetmr → b:dino-s-gulyas
   — / — · DINO · own · vlees · hongaars · tags: ['winter']
u:sdzuiy6i → b:griekse-salade-van-stijn   (zie §8 vraag 1)
   Griekse salade van Stijn / Stijn's Greek salad · STIJN · own · salade · grieks
u:sjzpykqe → b:penne-met-romige-spinazie-en-zalm
   — / — · STIJN · own · pasta · null
u:upgcww8h → b:botrytis-cinerea-dessert
   Botrytis cinerea-dessert / Botrytis cinerea dessert · credit (a) · book · nagerecht · brits
u:uvrzu65p   action 'personal': blijft Stijns eigen recept; variantOf wordt b:franse-uiensoep-met-gruyere
u:w9mcohnb → b:lievre-a-la-royale
   Lièvre à la royale / Lièvre à la royale · credit (b) · book · vlees · frans
u:yyhwr2h5 → b:ouderwetse-varkensribbetjes-uit-de-oven
   Ouderwetse varkensribbetjes uit de oven / Old-fashioned oven-baked pork ribs · GABI · web · vlees
   · amerikaans
```
Telling: GABI 6, STIJN 7, CHAT 4, DINO 1, (a) 1, (b) 1 = 20 klassiekers; 21 aliassen; 1 persoonlijk.
(a) credit {nl: "Naar The Fat Duck (Heston Blumenthal), toegevoegd door Stijn", en: "After The Fat Duck
(Heston Blumenthal), added by Stijn"}. (b) credit {nl: "Frans klassiek gerecht, toegevoegd door Stijn",
en: "French classic, added by Stijn"}. Keuken-ids moeten in data/cuisines.json (spec 6B+13E) bestaan;
bestaat `hongaars` daar niet, dan `null` (nooit zelf een keuken toevoegen). Categorie-ids `gebak`,
`nagerecht`, `bijgerecht` komen uit 6B+13E, dat vóór 13F gebouwd wordt (volgorde STATUS.md); ontbreekt een
id, dan faalt `npm run validate:data` en wordt het meta-bestand aangepast, niet de validator.
⚠ Feitencheck: in de repo van nu bestaan `data/cuisines.json` en de categorieën `gebak`, `nagerecht`,
`bijgerecht` nog niet (data/categories.json: hartige-taart, oven, overig, pasta, rijst, salade, soep,
stamppot, vis, vlees, wok-noedels). docs/specs/labels-categorieen.md §2c noemt wel alle acht gebruikte
keuken-ids (ook `hongaars`) en de drie categorieën, en maakt `lactose` "alles of niets"
(`INGREDIENT_DIET_FLAGS = ['vegan', 'gluten', 'lactose']`), dus de 8 nieuwe entries hebben hem nodig.
**Besluit (kritische lezer):** 6B wordt vóór 13F gebouwd, dus bij de start van blok 1 bestaan ze; de 8
entries dragen `lactose` verplicht: nduja, haas, foie-gras, keelspek, panko, truffel en noilly-prat
`lactose: false`; mokkaboontje (chocolade, soms melk) volgens H3 van de rule sheet `lactose: false,
lactoseUnsure: true`.

**Glutenvrije uiensoep (u:uvrzu65p): 'personal', motivering.** 13D maakt van een dieetvariant een
goedgekeurde set vervangingen (tab) bovenop het origineel en zet de kopie-varianten uit blok F bij de
overstap om in een tab. Een tweede klassieker "… (glutenvrij)" zou die tab in de weg zitten en op de
openbare site een dubbel zijn. De kopie blijft dus op Stijns telefoon staan als eigen recept (geen verlies),
met `variantOf` omgezet naar het nieuwe b:-id; de klassieker toont hem als "Ook als: glutenvrij" (dat werkt
vandaag al voor klassiekers, repo.variantsOf), en 13D vouwt hem later in de tab (de swap `bloem →
glutenvrije-bloem` staat al in data/swaps.json).

**Nduja-dubbel.** Basis = u:5zxl52cq (tweetalige regels); u:zws63nhy levert alleen zijn id (alias) en zijn
tags (`oven`). Regel 14 "Salade van geschaafde venkel" wordt via `lines` de kop
`{nl: "Venkelsalade:", en: "Fennel salad:"}` (parseLine maakt er `kind: 'header'` van).

**Overige regels voor de omzetting** (tool, deterministisch):
- `schema 2`, `rev 1`, `origin {kind:'builtin'}`, `createdAt = updatedAt = SECOND_EDITION_TIMESTAMP =
  '2026-10-13T00:00:00.000Z'`, `goesWith []`, `aliases []`, `text {en:'llm'}` (alle Engelse stappen zijn
  machinaal of door Opus herschreven; eerlijk is 'llm'), `credit` uit de meta, `servings` uit de bron (6, 8
  en 2 blijven; de schaalfunctie rekent om), `category`/`cuisine`/`tags` uit de meta. `sync`, `metaManual`,
  `override` en `variantOf` worden NIET overgenomen.
- Regels: elke bronregel wordt opnieuw geparseerd uit zijn raw (invariant 2): `parseLine(raw.nl, dict, 'nl')`
  als er NL is, anders `parseLine(raw.en, dict, 'en')`; daarna `raw` = de volledige bron-raw (beide talen).
  Geeft de parser `ing: null` en had de bronregel een `ing` die (na `meta.ingredients`) in het woordenboek
  bestaat, dan die `ing` met `confidence 0.8` (zelfde "orde van waarheid" als de batches). `lines`-fixes uit
  de meta vervangen de raw vóór het parsen; toegestaan ALLEEN voor: Amerikaanse maten omrekenen (1 cup =
  240 ml, 1 pound = 450 g, 84.75 g → 85 g), de nduja-kop, en overduidelijke typefouten. Nooit een regel
  weglaten of toevoegen.
- Stappen: `source` own/chat → bronstappen letterlijk (NL + EN); web/book → `meta.steps` (zelfde aantal,
  zelfde volgorde, NL én EN, eigen woorden, kort en duidelijk zoals de 196, elke tijd/temperatuur/hoeveelheid
  uit de bron blijft staan, temperaturen in °C — 300 °F wordt 150 °C). `timers = findTimers(text.nl)`.
- Woordenboek: de 8 echte producten uit Stijns eigen ingrediënten gaan met EXACT hetzelfde id naar
  data/ingredients.json (zodat bestaande regels op beide telefoons blijven resolven): `nduja` (vlees-vis,
  g), `panko` (droog, g, gluten true), `truffel` (groente-fruit, g), `haas` (vlees-vis, g), `foie-gras`
  (vlees-vis, g), `keelspek` (vlees-vis, g), `noilly-prat` (dranken, ml, alias "droge vermout"),
  `mokkaboontje` (snacks-zoet, stuk). Volledige entries met NL/EN one/many, aisle, defaultUnit, staple,
  veg/vegan/gluten (en `lactose` als 6B die vlag al op alle entries zet: dan verplicht). `meta.ingredients`:
  `{ "paprika-2": "paprika", "crushed-tomatoes": "tomatenblokjes", "pork-baby-back-ribs": "spareribs",
  "cooked-grain-pasta": null }`. De 78 onherkende Fat-Duck-regels blijven `ing: null` (toegestaan).
- `applyDerivedTags` loopt als laatste ook over de nieuwe recepten (dieettags uit het woordenboek, nooit uit
  de meta).

### 2c. Nieuw veld op Recipe
```ts
// src/domain/model.ts, na `variantOf`
  /**
   * Who or where a classic came from when it is not from the first edition ("Uit de Stijnchat",
   * "Van Gabi"); shown instead of "klassieker uit het boek" and listed in Het verhaal. Human text
   * ({nl, en}, invariant 3). Absent on the 196 and on own/received recipes. Not a patch key.
   */
  credit?: Text | null;
```
`normalizeRecipe` (src/domain/recipe-io.ts) behandelt `credit` zoals `description`
(`readOptionalText`); tools/validate-data.ts: `credit` moet ontbreken, null of `{nl?, en?}` zijn.
`RECIPE_PATCH_KEYS` blijft gelijk (credit is niet te overschrijven in de editor). Reist mee in tokens via de
spread (`travelRecipe` in src/domain/share.ts / `normalizeRecipe`), zoals `variantOf`. Een klassieker
zónder aanpassing reist via src/screens/ShareScreen.tsx wél als `#r=` (`buildRecipeEnvelope`), dus dan
reist `credit` mee (ook de meerkeuze-deel in src/screens/RecipesScreen.tsx stuurt een onaangepaste
klassieker als recept mee); een aangepaste klassieker reist als `#p=` (zonder credit); alleen een
weekplan (`buildPlanEnvelope`) laat klassiekers weg.

### 2d. Dexie v8 en de alias-migratie (bouwblok 3)
Geen nieuwe tabel, geen index. `db.version(8).upgrade(tx => runAliasMigration(tx))` in src/db/db.ts (de
eenmalige, atomische doorloop bij het openen; schema-historie-commentaar aanvullen). Dezelfde runner draait
daarna idempotent: (1) in `ensureBuiltins()` na elke DATA_VERSION-wissel (toekomstige aliassen hebben dan
geen v9 nodig), (2) aan het eind van `importBundle()` (een oude back-up brengt u:-rijen terug), en (3) de
deelimport zet ids om in `planImport` (§2e). De pure kern staat in **src/domain/id-aliases.ts**:
```ts
export interface AliasEntry { to: string; fp: FieldFingerprints; content: string[] }
export type AliasMap = Readonly<Record<string, AliasEntry>>;
export const BUNDLED_ALIASES: AliasMap;            // data/id-aliases.json
export function mapId(id: string, aliases: AliasMap): string;           // alias -> to, anders id
export interface AliasSnapshot {                                         // alleen rijen die een alias-id noemen
  userRecipes: Recipe[];           // de eigen exemplaren ÉN elk eigen recept met variantOf/basedOn op een alias
  overrides: RecipeOverride[];     // bestaande overrides op de doel-ids (botsingscheck)
  favorites: Favorite[]; notes: Note[]; cookLog: CookLogEntry[];
  photos: Array<Pick<Photo, 'id' | 'recipeId'>>;    // nooit de blob
  timers: RunningTimer[]; plans: Plan[]; lists: List[]; events: ShareEvent[];
  lineOverrides: LineOverride[]; imports: ImportSnapshot[];
  seenIds: string[];               // setting inbox.seenIds
}
export interface AliasMutations {
  deleteUserRecipes: string[]; putUserRecipes: Recipe[]; putOverrides: RecipeOverride[];
  deleteFavorites: Array<[string, string]>; putFavorites: Favorite[];
  deleteNotes: Array<[string, string]>; putNotes: Note[];
  cookLog: Array<{ id: number; recipeId: string }>; photos: Array<{ id: number; recipeId: string }>;
  timers: RunningTimer[]; putPlans: Plan[]; putLists: List[]; putEvents: ShareEvent[];
  putImports: ImportSnapshot[]; deleteLineOverrides: Array<[string, number]>;
  seenIds: string[] | null;        // null = ongewijzigd
  report: { moved: number; deleted: number; overrides: number };
}
export function applyAliases(s: AliasSnapshot, aliases: AliasMap): AliasMutations;
/** Eigen wijzigingen t.o.v. de bronversie als override op de klassieker; null = onaangeroerd. */
export function overrideForAlias(local: Recipe, entry: AliasEntry): RecipeOverride | null;
/** Back-upbestand met alle ids omgezet; aliased eigen recepten worden override (of vervallen). */
export function mapBundleIds(b: BackupBundle, aliases: AliasMap): BackupBundle;
```
Regels van `applyAliases` (per alias `from → to`, in gesorteerde volgorde van `from`):
1. **Eigen exemplaar** `userRecipes[from]`: `overrideForAlias` → als niet null én er is nog geen override op
   `to` (bestaand of eerder in deze run) → `putOverrides`; anders niets (eerste wint, console.info). Daarna
   `deleteUserRecipes.push(from)`. NOOIT via `deleteUserRecipe()` (die wist foto's, favorieten en notities).
2. **overrideForAlias, veld voor veld**: `contentFingerprint(local) ∈ entry.content` → null (onaangeroerd,
   ook als Gabi's eigen versie gelijk is aan wat Stijn ontving). Anders `f = fieldFingerprints(local)`:
   `f.name ≠ fp.name` → `patch.name = local.name`; `f.lines ≠ fp.lines` → `patch.lines = local.lines`
   (raw blijft; applyOverride/mergeLines voegt per index samen, dus Gabi's Engels komt náást het Nederlands
   van de klassieker); `f.steps ≠ fp.steps` → `patch.steps = local.steps`; `f.meta ≠ fp.meta` →
   `patch.category`, `patch.tags`, `patch.time` (als aanwezig) en `description`/`servingTip` alleen als
   local er tekst in heeft. Lege patch → null. Rij: `{ baseId: to, rev: 1, patch, updatedAt: local.updatedAt,
   by: local.origin.author ?? local.origin.receivedFrom ?? null }`, geen `sync`. Een gewijzigd
   `servings` gaat verloren (beschermde sleutel in saveOverride; gedocumenteerd, geen fix hier).
3. **favorites/notes** (sleutel `[recipeId+profileId]`): delete + put op `to`; bestaat de doelrij al:
   favoriet → oudste `at` blijft; notitie → doeltekst + `"\n\n"` + verhuisde tekst (geen verlies).
4. **cookLog, photos, timers**: alleen `recipeId` omzetten (rij-id blijft; de fotoblob wordt niet herschreven
   buiten `table.update(id, {recipeId})`).
5. **plans**: `items[].recipeId`; **lists**: `items[]`/`extras[]`: `sources[].recipeId` en key
   `'raw|<from>|<i>'` → `'raw|<to>|<i>'`; **events**: `recipeIds` omzetten en ontdubbelen; alleen gewijzigde
   rijen in `put…`.
   `List.generatedFrom` / `generatedFromAll` (src/db/model.ts) zijn `planHash` / `planHashAll`
   (src/domain/planner.ts) over `recipeId@servings`. **Besluit:** is een plan-item omgezet, dan herrekent
   `applyAliases` beide hashes over het omgezette plan en zet ze op de lijst in `putLists` (anders zegt
   Boodschappen na de migratie onterecht "Weekplan gewijzigd").
6. **userRecipes met `variantOf` of `origin.basedOn` op een alias**: veld omzetten, rij `putUserRecipes`
   (rev/updatedAt ongewijzigd: geen "wijziging sinds back-up").
7. **imports** (undo-snapshots): `added/updated/skipped/copies/wrote.recipes` omzetten; aliased recepten uit
   `before.recipes` en `previous` HALEN, zodat "Maak ongedaan" nooit een u:-exemplaar terugzet.
8. **lineOverrides** op een alias-id: verwijderen (bestaan per ontwerp niet voor eigen recepten; indexen
   zouden toch niet kloppen).
9. **seenIds**: omzetten + ontdubbelen; `null` als niets veranderde.
10. Idempotent: een tweede run op het resultaat geeft lege mutaties (`report` alle nullen).

`src/db/aliases.ts` (nieuw): `runAliasMigration(tables: { table(name: string): Table<any, any> },
aliases = BUNDLED_ALIASES): Promise<AliasReport>` leest alleen rijen die een alias-id noemen
(`where('recipeId').anyOf(keys)`, plans/lists/events/imports/timers volledig want klein, userRecipes
`anyOf(keys)` + `filter(r => alias(r.variantOf) || alias(r.origin.basedOn))`), roept `applyAliases` aan en
schrijft de mutaties. Werkt met een Dexie `Transaction` (upgrade) én met `db` binnen `db.transaction`
(importBundle, ensureBuiltins). Bij `report.moved + report.deleted > 0` schrijft hij de setting
**`aliases.notice`** = `{ at, deleted, moved, overrides }` (§1c leest hem; `aliases.notice` is
toestel-lokaal: toevoegen aan `DEVICE_LOCAL_SETTINGS` in repo.ts, zodat een herstel hem niet meeneemt).

**ensureBuiltins** (repo.ts): na een dataVersion-wissel ook (a) `runAliasMigration(db)` en (b) eigen
woordenboek-entries verwijderen waarvan het id nu ingebouwd is (`ingredientsData`-ids; `nduja` enz. — de
ingebouwde wint toch al in `withUserEntries`, dit ruimt alleen op). Beide alleen bij een wissel, nooit bij
elke start.

**Back-up/herstel**: `exportBundle` ongewijzigd (de setting `aliases.notice` wordt eruit gefilterd zoals
`dataVersion`). `importBundle(b)` begint met `b = mapBundleIds(b, BUNDLED_ALIASES)`: userRecipes met een
alias-id worden `overrideForAlias`-rijen (alleen toegevoegd als `b.overrides` er geen heeft voor dat
baseId) en vallen als recept weg; favorites/notes/cookLog/photos/plans/lists/events krijgen `mapId`
(cookLog-dedupe `recipeId|profileId|at` werkt dan tegen de al gemigreerde rijen); userIngredients met een
ingebouwd id vallen weg. Daarna de bestaande logica; aan het eind van de transactie `runAliasMigration(db)`
als vangnet. De tabellen `imports` en `timers` komen bij de transactie. `RestoreResult` ongewijzigd.

### 2e. Deelformaat (bouwblok 2)
Geen nieuwe fragmentsleutel, geen codec-wijziging: `#r=`, `#p=`, `#w=`, `#b=`, `#f=` behouden hun betekenis
(invariant 4). Wat verandert is de UITLEG van een binnenkomend id door de ontvanger: in `planImport`
(src/domain/merge.ts) wordt de ParsedShare eerst door `mapShareIds(share, aliases, bases)` gehaald
(src/domain/id-aliases.ts; `LocalState.aliases?: AliasMap`, standaard `BUNDLED_ALIASES`):
- recept met `aliases[r.id]` en de klassieker `to` in `bases` (anders `local.recipes`): verschilt geen enkel
  RECIPE_PATCH_KEYS-veld (`fieldFingerprints` + description/servingTip/category/tags) → id wordt `to` (de
  bestaande regel "klassieker als geheel recept → present" doet de rest: "al aanwezig"); verschilt er wel
  iets → het recept wordt een **PatchPayload** `{ baseId: to, rev: r.rev, patch: <alleen de afwijkende
  velden>, name: r.name, updatedAt: r.updatedAt }` in `share.patches` (eerste per baseId wint) en verdwijnt
  uit `share.recipes`. Zo loopt Gabi's oude `#r=`-link door de bestaande patch-tabel (new/update/conflict op
  de override), nooit als nieuw u:-recept.
- `to` niet gevonden (oudere app zonder die klassieker): recept ongemoeid (val terug op het oude gedrag).
- `r.variantOf` / `r.origin.basedOn` op een alias → `mapId`. Plan-items `rid` → `mapId`. Patches met een
  aliased `baseId` → `mapId` (komt nu niet voor).
  ⚠ Feitencheck: in een `ParsedShare` heten de plan-items al `plan.items[].recipeId` (share.ts zet
  `rid` om bij het lezen). En het weekplan loopt niet door `planImport`: src/paste.ts `collectPaste`
  bewaart `Collected.plan` (`ReceivedPlan.share: PlanShare`) apart, en `takePlan` in
  src/screens/InboxScreen.tsx leest `received.share.items` en houdt alleen ids over waarvoor
  `getRecipe(it.recipeId)` iets vindt. Een omzetting alleen in `planImport` bereikt het weekplan dus niet;
  `rid: 'u:rzpfetmr'` telt daar dan als "onbekend gerecht". Test 14 (`plan.items[0].recipeId`) gaat over
  de uitvoer van `mapShareIds` (`ImportPlan` heeft geen plan). **Besluit:** `takePlan` mapt elk
  `it.recipeId` eerst met `mapId(it.recipeId, BUNDLED_ALIASES)` (blok 3 bouwer C, één regel in
  InboxScreen.tsx), zodat een oud `#w=` met u:-ids het weekplan wél vult.
Waarom dit invariant 1 respecteert: het u:-id wordt nooit hergebruikt of van betekenis veranderd; het blijft
voor altijd een geldige naam van hetzelfde recept, naast het b:-id. Oude deellinks, oude back-ups en de
kooklog van de ander wijzen nog steeds naar dat ene recept. `data/id-aliases.json` is alleen-groeiend: een
alias wordt nooit verwijderd of omgezet (tests/id-aliases.test.ts bevriest de 21 regels).
Bevroren token: `FROZEN_TOKEN_R_ALIAS` (+ `_FFLATE`) in tests/fixtures/frozen-share-tokens.ts, een `#r=`
met `r.id = 'u:1s41pool'` (ingekorte inhoud, 3 regels, 2 stappen); §6.

## 3. Bestandsverdeling en contracten

Vier bouwblokken (§4); elk past in één Opus-workflow (bouwers A/B/C + integrator). Een bouwer raakt alleen
zijn eigen bestanden; de integrator draait `npm run migrate`, `npm run validate:data`, `npm run check`,
`npm test`, `npm run build`, `npm run build:next`.

### Blok 1 — tool en data
**Bouwer A — `tools/import-stijnchat.ts` (nieuw) + `tools/migrate-from-recepten2.ts` (bestaand)**
```ts
// tools/import-stijnchat.ts (Node 22 type-stripping: alleen type-syntax, plain ESM)
export const SECOND_EDITION_TIMESTAMP = '2026-10-13T00:00:00.000Z';
export interface StijnchatSource { at: string; userRecipes: unknown[]; userIngredients: unknown[] }
export interface ConvertResult { recipes: Recipe[]; aliases: Record<string, AliasEntry>; problems: string[] }
/** Pure en deterministisch. Gooit Error met alle problemen als `problems` niet leeg is (nooit half). */
export function convertStijnchat(source: unknown, meta: StijnchatMeta, dict: Dictionary,
  takenIds: ReadonlySet<string>): ConvertResult;
/** builtinId(nameNl), bij botsing '-2', '-3', … tot het id vrij is. */
export function freeBuiltinId(nameNl: string, taken: ReadonlySet<string>): string;
export function readStijnchatInputs(root: string): { source: StijnchatSource; meta: StijnchatMeta } | null;
```
`checkMeta(meta, source, dict)` (geëxporteerd; validate-data.ts gebruikt hem) weigert: onbekende `from`; `action: 'merge'` zonder bestaande
`into`; 'classic' zonder credit/source/category; web/book zonder `steps` of met een ander aantal dan de
bron; `lines`-index buiten bereik; onbekende categorie/keuken; een credit met een lege kant.
In migrate-from-recepten2.ts: `MigrationInputs.extras?: { source: StijnchatSource; meta: StijnchatMeta }`
(gevuld door `loadMigrationInputs` via `readStijnchatInputs`), `DATA_VERSION = 10`, en in `migrate()` ná
review én ná de sides van bijgerechten.md, vóór `applyMeta`/`applyDerivedTags`/sorteren: `convertStijnchat(...)` met `takenIds` = de 216 ids (originelen + bijgerechten); de
recepten komen erbij, `RecipesFile` krijgt géén nieuw veld. `main()` schrijft ook `data/id-aliases.json`
(sleutels gesorteerd, 2 spaties inspringen, newline aan het eind) en print "20 extra recipes, 21 aliases".
Bouwer A maakt ook `data/source/stijnchat-2026-10-13.json` met het node-commando uit §2a.

**Bouwer B — `data/stijnchat-meta.json` (nieuw) + `data/ingredients.json` (bestaand, alleen toevoegen)**
Vult de meta precies volgens §2b, schrijft de herschreven stappen (NL + EN) voor de 11 web/book-recepten
(Marokkaanse gehaktbalstoof, Honing-mosterdkip, nduja-ragù, Varkenshaas dijon, Gemarineerde varkenshaas,
Toscaanse kip, Kip wittewijnsaus, Fettuccine Alfredo, Botrytis-dessert, Lièvre, Ribbetjes) en de 8
woordenboek-entries. Regels voor stappen staan in §2b; Fable leest ze allemaal na in de eindcontrole.

**Bouwer C — `src/domain/model.ts`, `src/domain/recipe-io.ts`, `src/domain/fingerprints.ts` (nieuw),
`src/domain/merge.ts`, `tools/validate-data.ts`, `tests/migrate.test.ts`, `tests/import-stijnchat.test.ts`
(nieuw), `tests/merge.test.ts` (alleen de import van `contentFingerprint`), `data/README.md`**
- model.ts: `credit?: Text | null` (§2c). recipe-io.ts: `credit` in de `readOptionalText`-lus.
- **fingerprints.ts (nieuw, besluit kritische lezer):** importeert alleen `./recipe-io.ts` en `./model.ts`
  (dus laadbaar onder `node --experimental-strip-types`) en exporteert
  `export interface FieldFingerprints { name: string; lines: string; steps: string; meta: string }`,
  `export function fieldFingerprints(r: Recipe): FieldFingerprints` (fnv1a van textKey/linesKey/stepsKey/
  metaKey, verhuisd uit merge.ts samen met de helpers die ze gebruiken) en `export function
  contentFingerprint(r: Recipe): string` (verhuisd uit merge.ts). merge.ts importeert ze vandaar en
  re-exporteert `contentFingerprint` (`export { contentFingerprint } from './fingerprints.ts'`), zodat
  bestaande imports en tests ongewijzigd blijven. Reden: merge.ts importeert `ingredientsData` uit
  data.ts (JSON zonder import-attribuut → ERR_IMPORT_ATTRIBUTE_MISSING in Node 22.19); tools mogen
  merge.ts dus niet importeren. tools/import-stijnchat.ts en validate-data.ts importeren
  `../src/domain/fingerprints.ts`.
- validate-data.ts: `credit` als Text-veld van recipes.json; nieuwe functie `validateAliases(aliases,
  recipeIds)`: sleutel `^u:[a-z0-9]{8}$`, `to` bestaat en begint met `b:`, `to` is nooit zelf een sleutel,
  `fp.*` 8 hex, `content` niet leeg en 16 hex; `validateStijnchatMeta` = `checkMeta` hergebruiken via import.
  Samenvatting-regel: "236 recipes … 21 aliases".
- data/README.md: rijen voor `source/stijnchat-2026-10-13.json`, `stijnchat-meta.json`, `id-aliases.json`,
  en in "How npm run migrate composes" stap 5 "extras" (ná stap 4½ sides); `dataVersion` 9 toelichten.

### Blok 2 — alias-domein en ontvangst
**Bouwer A — `src/domain/id-aliases.ts` (nieuw): `BUNDLED_ALIASES`, `mapId`, `applyAliases`,
`overrideForAlias`, `mapBundleIds` (§2d) + `tests/id-aliases.test.ts` (nieuw).**
Het hoeft geen Dexie te kennen: alleen typen uit src/db/model.ts via `import type { … } from
'../db/model.ts'` (type-only; toegestane uitzondering, kritische lezer) — Favorite/Note/CookLogEntry/
RunningTimer komen uit `./model.ts`, RecipeOverride/LineOverride uit `./overrides.ts`, Plan uit `./planner.ts`.
**Bouwer B — `src/domain/id-aliases.ts` deel 2 (`mapShareIds`) en `src/domain/merge.ts` (hook)**
```ts
/** `lookup` vindt de klassieker `to` (eerst bases, dan de lokale recepten); undefined = ongemoeid laten. */
export function mapShareIds(share: ParsedShare, aliases: AliasMap, lookup: (id: string) => Recipe | undefined): ParsedShare;
```
In `planImport`: `const mapped = mapShareIds(incoming, local.aliases ?? BUNDLED_ALIASES, (id) =>
bases.get(id) ?? byId.get(id))` en verder met `mapped`; `LocalState.aliases?: AliasMap`. (De Map heet in
`planImport` `bases` (`Map<string, Recipe>`, gevuld uit `local.bases ?? []`) en de lokale recepten staan in
`byId`; er is geen `basesMap`.) Bouwer B bezit tests/merge.test.ts (nieuwe describe) en tests/share.test.ts
niet (ongewijzigd).
**Bouwer C — `tests/fixtures/frozen-share-tokens.ts` (+ `FROZEN_TOKEN_R_ALIAS`, `_FFLATE`,
`FROZEN_ENVELOPE_R_ALIAS`), `tests/token.test.ts` (decode-test), `tests/id-aliases.test.ts` deel "ontvangst".**
Tokens één keer maken met een klein node-script (`encodeToken(env, {engine})` voor beide engines) en
letterlijk vastzetten; nooit opnieuw genereren.
(Bouwer A en B delen één bestand; B voegt alleen `mapShareIds` onderaan toe nadat A klaar is — in de
workflow: A eerst, dan B en C parallel.)

### Blok 3 — database en app
**Bouwer A — `src/db/db.ts`, `src/db/aliases.ts` (nieuw)**: `db.version(8).upgrade(...)`, `runAliasMigration`
(§2d), schema-commentaar.
**Bouwer B — `src/db/repo.ts`, `src/db/model.ts`**: `ensureBuiltins` (alias-run + woordenboek-opruiming bij
een wissel, én (c) verwijderen van elke `userRecipes`-rij met een ingebouwd id waarvan
`contentFingerprint` gelijk is aan de ingebouwde — identieke ontvangen kopieën van een `b:`-id; een
afwijkende kopie blijft staan), `importBundle` (`mapBundleIds` vooraf, `imports`/`timers` in de transactie, run achteraf),
`exportBundle` filtert `aliases.notice`, `DEVICE_LOCAL_SETTINGS` + `ALIAS_NOTICE_KEY = 'aliases.notice'`,
`getAliasNotice(): Promise<AliasNotice | null>`, `clearAliasNotice()`.
**Bouwer C — `src/recent.ts`, `src/app.tsx`, `src/screens/InboxScreen.tsx` (alleen `takePlan`)**:
`remapRecent(aliases: AliasMap)` in recent.ts (localStorage-lijst omzetten, ontdubbelen; try/catch)
aangeroepen in app.tsx direct na `ensureBuiltins()`; in `takePlan` elk `it.recipeId` eerst door
`mapId(it.recipeId, BUNDLED_ALIASES)` halen (één regel, zie §2e). src/badges.ts hoeft niets: een badge-id
dat in `badges.earned` staat blijft `earned: true` ook als `current < target` (bestaat al, zie hieronder).
⚠ Feitencheck: dit bestaat al. src/badges.ts `badgeStatuses(memberId)` leest `badges.earned`
(`BADGES_EARNED_SETTING`) en geeft elke daar geregistreerde badge `{ earned: true, current: target }`
(commentaar: "stays earned even when its live count later drops"). `ownRecipes` is een
huishoud-regel (`HOUSEHOLD_KINDS`), dus alleen op 'all'; Stijns back-up van 13 okt heeft onder `all`
al `eigen-inbreng`, `receptenschrijver`, `kookboekauteur`. Voor Bouwer C blijft hier niets te bouwen.
Integrator: dev-app-checks §6c (er is geen IndexedDB in vitest en geen nieuwe dependency).

### Blok 4 — credit en Het verhaal
**Bouwer A — `src/screens/RecipeScreen.tsx`**: `originLine(r, l, all)`: `r.origin.kind === 'builtin' &&
r.credit` → `pickText(r.credit, l)` i.p.v. `t('recipe.classic')`.
**Bouwer B — `src/screens/StoryScreen.tsx`, `src/styles/settings.css`**: sectie "Nieuw sinds de eerste druk"
(§1d); `src/i18n/settings.ts`: keys `story.added.*`.
**Bouwer C — `src/components/AliasNotice.tsx` (nieuw), `src/app.tsx` (één regel naast `<BrowserNotice/>`),
`src/i18n/common.ts`: keys `aliases.notice.*`, `src/styles/base.css` (`.alias-notice`, hergebruik van de
UpdateBar-opmaak).**
Integrator: docs/DEVICE-TEST.md rijen 82–85 (§6d), docs/STATUS.md.

## 4. Stappenplan

Volgorde is dwingend; blok 1 t/m 3 gaan alléén naar `/next/` tot blok 3 af is, want blok 1 alleen zou op
Stijns telefoon de 20 klassiekers NAAST zijn eigen exemplaren zetten (dubbelen). `main` krijgt 1+2+3 in één
deploy; blok 4 mag apart.

1. **Blok 1 — tool en data** (`/next/` alleen). Af als: `data/source/stijnchat-2026-10-13.json`,
   `data/stijnchat-meta.json`, `tools/import-stijnchat.ts`, 8 woordenboek-entries, herschreven stappen voor
   11 recepten, `DATA_VERSION 10`, `data/recipes.json` met 236, `data/id-aliases.json` met 21, `credit` in
   model/recipe-io/validator, `fieldFingerprints` in merge.ts, tests §6a (import-stijnchat, migrate) groen,
   `npm run validate:data` groen, data/README.md bijgewerkt. Op `/next/` zichtbaar: 236 recepten met credit
   op de pagina nog als "klassieker uit het boek" (blok 4 verandert dat).
2. **Blok 2 — alias-domein en ontvangst** (`/next/`). Af als: `src/domain/id-aliases.ts` compleet
   (`applyAliases`, `overrideForAlias`, `mapBundleIds`, `mapShareIds`, `mapId`, `BUNDLED_ALIASES`), hook in
   `planImport`, bevroren `#r=`-token, tests/id-aliases.test.ts (15 gevallen) en token-test groen. Nog
   niets zichtbaar in de app behalve dat een oude link "al aanwezig"/"Aanpassing van …" zegt.
3. **Blok 3 — database en app** (daarna `main`). Af als: Dexie v8 met upgrade, `src/db/aliases.ts`,
   `ensureBuiltins`/`importBundle`/`exportBundle` aangepast, `aliases.notice`-setting, recent.ts-remap,
   badges "eenmaal verdiend" (bestaat al in src/badges.ts `badgeStatuses`; alleen nagaan),
   dev-app-checks §6c 1–8 doorlopen en genoteerd in STATUS.md. Deploy naar
   `main` = Stijns telefoon migreert bij de eerstvolgende start; Stijn maakt VOORAF een back-up (Opslag →
   Back-up voor mezelf) — dat is de enige voorzorg, geen reset.
4. **Blok 4 — credit, Het verhaal, melding** (`main`). Af als: credit op de receptpagina, kaart "Nieuw sinds
   de eerste druk", `AliasNotice` met i18n (NL+EN), DEVICE-TEST rijen 82–85, STATUS.md. Geen vlag nodig.

Geen van de blokken heeft een instelling om hem uit te zetten: de migratie is data-hygiëne, geen functie.
Hervatten na een afgebroken workflow: eerst `git status` en `npm test`; blok 1 is pas "af" als
`npm run migrate` tweemaal hetzelfde bestand oplevert.

## 5. Regels en eerlijkheid

**Invarianten die dit blok raakt**
- **1 (ids nooit wijzigen):** een u:-id wordt niet gewijzigd of hergebruikt maar blijft als alias een geldige
  naam van hetzelfde recept; `data/id-aliases.json` is alleen-groeiend en bevroren in een test. Het b:-id is
  voor altijd `builtinId(nieuwe naam)` (bij botsing `-2`); een latere naamswijziging van een klassieker
  verandert het id nooit.
- **2 (raw nooit weg):** de tool parseert opnieuw uit raw en bewaart de volledige bron-raw; `lines`-fixes
  vervangen tekst, nooit een regel; `patch.lines` van een override houdt raw.
- **3 ({nl,en}):** `credit`, nieuwe namen en herschreven stappen hebben altijd beide talen; een override uit
  Gabi's Engels raakt alleen `en` (mergeText per taal).
- **4 (deelformaat):** geen nieuwe sleutel, geen herinterpretatie van bytes; alleen de ontvanger beeldt een
  alias-id af. Nieuwe bevroren tokens komen erbij, oude blijven decoderen.
- **5/7 (iPhone eerlijk):** niets verandert aan ontvangen via plakken; de landingsbundel (`src/landing.ts`)
  blijft onaangeraakt en kent geen aliassen (hij toont alleen; hij schrijft niets, invariant 6).
- **12 (database per base-path):** v8 en de alias-run draaien per database (`recepten`, `recepten-next`).
- **14/15:** geen backend, geen nieuwe dependency; db-integratie wordt in de dev-app gecontroleerd (§6c),
  niet met fake-indexeddb.

**Eerlijkheid**
- De receptpagina zegt bij de nieuwe klassiekers wie ze aanleverde (credit) en toont in de Engelse UI de
  vertaalbadge (`recipe.machineTranslation` "Machine translation — tap to improve"; alleen als
  `l === 'en' && text.en === 'llm'`, in de Nederlandse UI nooit) — ook voor Gabi's recepten, waar het
  Nederlands de vertaling is; het model kent geen `text.nl`, dat is een bekende beperking (geen fix hier).
- Een gewijzigd `servings` in een eigen exemplaar komt niet in de override (beschermde sleutel); staat in
  §2d en in de STATUS-regel bij livegang.
- `ownRecipes` in de badge-feiten daalt (15 → 1 bij Stijn, 7 → 0 bij Gabi); "eenmaal verdiend blijft
  verdiend" houdt de badges (bestaand gedrag van `badgeStatuses`), en die zet bij een geregistreerde
  badge `current` op `target`: de voortgang toont dus het doel, niet het lagere aantal. 6D (XP) mag XP voor "eigen
  recept toegevoegd" dus niet uit het huidige aantal eigen recepten afleiden (zie notesForReviewer).
- Gabi's en Dino's voornaam komen op de openbare site (credit). Zie §8.

**Opus mag dit NIET zelf beslissen (zo doen als hier staat, anders vragen aan Stijn/Fable)**
1. Welke recepten ingebouwd, samengevoegd of persoonlijk blijven, hun ids, namen, credits, categorieën,
   keukens en `source`-klasse: precies de tabel in §2b. Geen extra recept, geen ander id.
2. Herschreven stappen: alleen voor web/book; zelfde aantal en volgorde; alle tijden, temperaturen en
   hoeveelheden uit de bron; °C. Geen stappen samenvoegen of weglaten, geen ingrediënt toevoegen.
3. `lines`-fixes alleen voor de drie toegestane soorten (§2b). Nooit een regel schrappen ("raw nooit weg"),
   ook niet de 78 onherkende Fat-Duck-regels.
4. Woordenboek: de 8 entries met exact de ids uit §2b; geen andere nieuwe entries (onherkend mag).
5. Dexie: v8 zonder tabel of index; de alias-run zit in `upgrade`, `ensureBuiltins` (bij wissel) en
   `importBundle`; nergens anders, en nooit bij elke start.
6. Vergelijking "eigen wijziging": uitsluitend via `fieldFingerprints`/`contentFingerprint` tegen
   `id-aliases.json`, veld voor veld zoals §2d regel 2. Niet "altijd override", niet "nooit override".
7. Deelformaat: geen nieuwe fragmentsleutel, geen veld in de envelop; de afbeelding zit in `planImport`.
   Bevroren tokens één keer maken en nooit hergenereren.
8. Geen reset, geen `deleteUserRecipe()`, geen `db.photos.toArray()` (blobs) in de migratie.
9. De migratiemelding is de enige nieuwe UI naast credit en de verhaal-kaart; geen instelling, geen
   onboarding-stap, geen "ongedaan maken"-knop.
10. Tests die op 196 of op `DATA_VERSION 4` rekenen worden aangepast naar de constante uit de tool, niet
    naar een hardgecodeerde 236 buiten de bevroren id-lijst.
11. Ontbreekt een categorie- of keuken-id (6B+13E nog niet gebouwd): niet zelf categorieën of keukens
    toevoegen; `cuisine: null` resp. de bouw stoppen en melden.

## 6. Testplan

### 6a. Unit tests (vitest, node)
**tests/import-stijnchat.test.ts** (blok 1) — over de echte bron, meta en het echte woordenboek:
1. `convertStijnchat` levert precies 20 recepten; ids = de 20 uit §2b (bevroren lijst in de test); alle
   ids uniek en niet in de 216 (originelen + bijgerechten).
2. Aliases: 21 sleutels; `u:5zxl52cq` en `u:zws63nhy` hebben hetzelfde `to`; `u:uvrzu65p` ontbreekt; elke
   `fp` = `fieldFingerprints(bronrecept)`; `content[0]` = `contentFingerprint(bron)`; voor `u:1s41pool` staat
   `"28c66c29f128ff9a"` (zijn `sync.receivedFingerprint`) in `content`.
3. Elk recept: `origin {kind:'builtin'}`, `rev 1`, timestamps = SECOND_EDITION_TIMESTAMP, `credit` met
   beide talen, `text {en:'llm'}`, geen `sync`/`metaManual`/`variantOf`/`override`, categorie bestaat,
   `servings` = bron (6 voor gehaktbalstoof, 8 varkenshaas dijon, 2 bananenbrood).
4. Regels: aantal = bron; elke regel heeft `raw` met de volledige bron-raw (Marokkaanse regel 0 heeft nl én
   en); nduja regel 14 is `kind:'header'` met raw "Venkelsalade:"; parse-dekking over de 20 ≥ 0,78 (besluit
   kritische lezer: 0,80 is met de 78 bewust onherkende Fat-Duck-regels niet haalbaar, zie de ⚠) en over
   de 19 zonder het Botrytis-dessert ≥ 0,95; `ing`-ids bestaan in het woordenboek; `paprika-2` komt nergens
   voor; `nduja` resolvet (ingebouwd).
   ⚠ Feitencheck (bron van 13 okt nagerekend, 22 okt): de 20 hebben 386 niet-kopregels, waarvan 120 van
   het Botrytis-dessert. In de bron hebben 302/386 = 0,782 een `ing`. Opnieuw geparseerd met het
   woordenboek van nu (1603) + de 8 nieuwe ids + `meta.ingredients` volgens §2b: ongeveer 304/386 = 0,788
   (Botrytis 45/120; de 19 zonder Botrytis 259/266 = 0,974). Blijven de 78 Fat-Duck-regels `ing: null`,
   dan is 0,80 over de 20 niet te halen (hooguit 308/386 = 0,798). De grens 0,95 over de 19 is wel haalbaar.
5. Stappen: aantal = bron; web/book-recepten hebben NIET dezelfde NL-steptekst als de bron (herschreven) en
   wél elke timer-minutenwaarde die de bron had (set van `findTimers(bron)` ⊆ set van `findTimers(nieuw)`);
   ribbetjes-stappen bevatten geen "°F"; own/chat-stappen zijn letterlijk gelijk.
6. Determinisme: twee keer draaien → `JSON.stringify` gelijk.
7. `freeBuiltinId('Griekse salade', {b:griekse-salade})` → `b:griekse-salade-2`; nog een keer met `-2`
   bezet → `-3`.
8. `checkMeta` weigert: onbekende `from`, web zonder `steps`, verkeerd aantal stappen, `lines`-index 999,
   lege credit-kant, 'merge' naar een niet-bestaande `into`.
**tests/migrate.test.ts** (blok 1, aanpassen): `DATA_VERSION` 10; 236 recepten; 216 + extras unieke ids;
dekkingsgrens 0,95 alleen over de 196 (filter op ids uit de bron-export); byte-vergelijking met het
gecommitte bestand blijft; `data/id-aliases.json` = `aliases` uit dezelfde run.
**tests/token.test.ts** (blok 2): decodeert `FROZEN_TOKEN_R_ALIAS` en `_FFLATE` op beide engines tot
`FROZEN_ENVELOPE_R_ALIAS`.
**tests/id-aliases.test.ts** (blok 2) — fixtures in de test (fake aliasmap `{ 'u:aaaaaaaa': { to: 'b:x',
fp, content } }` naast de echte `BUNDLED_ALIASES`):
1. onaangeroerd exemplaar (content match) → `deleteUserRecipes ['u:aaaaaaaa']`, geen override;
   favoriet/notitie/kooklog/foto/timer/plan/lijst/event/seenIds omgezet; `report {moved: 8, deleted: 1,
   overrides: 0}`.
2. naam gewijzigd → één override met alleen `patch.name`; `lines`/`steps` niet in de patch.
3. Gabi-geval: `contentFingerprint(local)` = `content[1]` → geen override.
4. twee aliassen naar één doel: twee favorieten van hetzelfde profiel → één rij met de oudste `at`; twee
   kookbeurten → beide op `to`; tweede override wordt niet geschreven (eerste wint).
5. bestaande override op `to` → geen nieuwe override, exemplaar wel weg.
6. notitie-botsing → doeltekst + "\n\n" + verhuisde tekst.
7. `variantOf` en `origin.basedOn` op een alias → rij in `putUserRecipes` met het nieuwe id, rev gelijk.
8. imports: `wrote.recipes` omgezet, aliased recept uit `before.recipes` en `previous` verdwenen.
9. lijst: key `raw|u:aaaaaaaa|3` → `raw|b:x|3`, `sources[].recipeId` omgezet, extras ongewijzigd, `pinned`
   ongewijzigd.
10. lineOverrides op een alias → in `deleteLineOverrides`.
11. idempotent: mutaties toepassen op de snapshot (test-helper) en opnieuw draaien → alle lijsten leeg,
    `seenIds null`.
12. lege snapshot en onbekende ids → lege mutaties.
13. `mapBundleIds`: back-up met u:-recept (gewijzigd) → `overrides` krijgt de patch, `userRecipes` zonder dat
    recept; cookLog/favorites/photos/events omgezet; bestaande override in het bestand wint.
14. `mapShareIds` + `planImport` met `bases` = de 236: envelop met `u:1s41pool` en afwijkende inhoud → één
    patch-item `p:b:marokkaanse-gehaktbalstoof`, status `new`, patch bevat alleen de afwijkende velden,
    geen recipe-item; gelijk aan de klassieker (id omgezet in de test) → recipe-item status `present`;
    `w`-envelop met `rid: 'u:rzpfetmr'` → `plan.items[0].recipeId === 'b:dino-s-gulyas'`; `to` niet in
    `bases` → ongemoeid.
15. bevroren aliaslijst: de 21 sleutels en hun `to` uit `data/id-aliases.json` zijn letterlijk gelijk aan de
    lijst in de test (alleen-groeiend: een nieuwe regel mag, een wijziging niet).

### 6b. Fixtures
- `tests/fixtures/frozen-share-tokens.ts`: `FROZEN_ENVELOPE_R_ALIAS = { v: 2, t: 'r', by: 'Gabi', at:
  '2026-10-01T11:07:43.915Z', r: { schema: 2, id: 'u:1s41pool', rev: 4, name: { nl: 'Marokkaanse Gehaktbal
  Stoof', en: 'Moroccan Meatball Stew' }, servings: 6, origin: { kind: 'user', author: 'Gabi' }, lines:
  [{ raw: { nl: '1 middelgrote aubergine', en: '1 medium aubergine' } }, { raw: { nl: '2 tl zout', en: '2 tsp
  salt' } }, { raw: { nl: '500 g rundergehakt', en: '500 g minced beef' } }], steps: [{ text: { nl: 'Zout de
  aubergine en laat 30 minuten uitlekken.', en: 'Salt the aubergine and drain for 30 minutes.' } }, { text: {
  nl: 'Stoof alles 45 minuten.', en: 'Stew everything for 45 minutes.' } }], tags: [], goesWith: [], aliases: []
  } }` + de twee tokens (native, fflate), één keer gemaakt.
- Geen nieuwe paste-fixtures.

### 6c. Acceptatiechecks in de dev-app (`npm run dev`, 375 px, Chrome; database `recepten` op localhost)
1. **Voorbereiding**: Meer → Opslag → Herstel met `C:\Users\srutg\Downloads\recepten-2026-10-13.json` op
   een build van VÓÓR blok 3 (git stash of een `main`-build) → 22 eigen/ontvangen recepten, favoriet Dino's
   Gulyás. Voeg toe: één kookbeurt op "Dino's Gulyás", één foto op "Stijn's Clafoutis", een notitie op
   "Franse uiensoep met Gruyère", zet "Honing-mosterdkip" in het weekplan, maak de boodschappenlijst, wijzig
   de naam van "Griekse salade" naar "Griekse salade (test)".
2. **Blok 3 starten** (zelfde database): console toont `aliases: moved … deleted 21 overrides 1`
   (console.info in runAliasMigration); bovenaan de migratiemelding "Nieuw in het boek: 20 recepten …";
   Recepten → Eigen toont alleen de glutenvrije uiensoep; Recepten → A–Z toont "Dino's Gulyás" met ★
   (de lijstrij toont geen kookbeurten; "1× gekookt" staat op de receptpagina); Clafoutis heeft de foto;
   uiensoep heeft de notitie; Week toont Honing-mosterdkip; de lijst heeft dezelfde regels; "Griekse
   salade van Stijn" toont "aangepast" en de naam "Griekse salade (test)", Herstel origineel geeft
   "Griekse salade van Stijn".
   ⚠ Feitencheck: de receptpagina toont geen "aangepast" en heeft geen Herstel origineel (zie §1a.4).
   In de editor (`#/edit/b:griekse-salade-van-stijn`, of in de Engelse UI via de vertaalbadge) staan
   "Aangepast op {date}" en de knop **Herstel origineel**.
3. **Idempotent**: herladen → geen tweede melding, console `moved 0 deleted 0`.
4. **Oude back-up terugzetten** (dezelfde file) → Herstel-resultaat zonder fouten; Eigen blijft 1; geen
   dubbele kookbeurt op Gulyás (nog "1× gekookt"); geen tweede foto op de Clafoutis.
5. **Oude link**: In & uit → plak een `#r=`-link met `u:rzpfetmr` (maak hem op de oude build via Deel) →
   voorvertoning "Heb je al"; bewerk op de oude build één stap, deel opnieuw → patch-item "Aanpassing van
   klassieker", naam "Dino's Gulyás", "aangepast door Stijn", badge "Nieuw".
6. **Het verhaal**: "Samen al N van de 236 gekookt"; kaart "Nieuw sinds de eerste druk" met 6 groepen in
   deze volgorde: Toegevoegd door Stijn (7), Van Gabi (6), Uit de Stijnchat (4), dan de drie met één recept
   op alfabet (Frans klassiek gerecht …, Naar The Fat Duck …, Van Dino, via Stijn); tik op "Dino's Gulyás"
   → receptpagina met "Van Dino, via Stijn".
7. **/next/**: `npm run build:next` en preview → eigen database `recepten-next`, migratie draait daar los.
8. `npm run check`, `npm test`, `npm run build`, `npm run validate:data` groen; `npm run migrate` tweemaal
   → `git diff` leeg behalve `generatedAt`.

### 6d. DEVICE-TEST-rijen (definitief 82–85; NL en EN; de kritische lezer hernummert)
Rij 82 — NL: **Inbouwen: alles gaat mee, niets dubbel (fase 6, 13F; Stijn).** 1. Open de app na de update.
Tik op **Vernieuwen** als dat gevraagd wordt. 2. Lees de melding bovenaan. Tik op **Sluit**. 3. Tik onderaan
op **Recepten**. Tik bovenaan op **Eigen**. 4. Tik op **A–Z**. Zoek **Gulyás** en open **Dino's Gulyás**.
5. Scrol naar de bereiding en tik op **Bewerk**. 6. Tik onderaan op **Meer → Het verhaal**. | Goed als:
2. Er staat "Nieuw in het boek: 20 recepten van Stijn en Gabi" met de zin over favorieten, kookbeurten,
foto's en notities. 3. Alleen "Franse uiensoep met Gruyère (glutenvrij)" staat onder Eigen. 4. De ster is
nog aan; onder de titel staat "Van Dino, via Stijn" en je kookbeurten van vroeger staan er nog
("2× gekookt · laatst …"). 5. De editor opent als aanpassing van een klassieker (met "Herstel origineel"
later op de pagina). 6. "Samen al … van de 236 gekookt" en een kaart **Nieuw sinds de eerste druk** met
"Uit de Stijnchat", "Van Gabi" en "Toegevoegd door Stijn".
⚠ Feitencheck (rij 82, stap 5 en goed 5, NL en EN): een klassieker heeft op de receptpagina geen
**Bewerk**/**Edit** (src/screens/RecipeScreen.tsx: alleen "Maak eigen kopie" / "Make my own copy"; de
editor opent alleen via de vertaalbadge in de Engelse UI). En **Herstel origineel** staat in de editor
alleen als er al een aanpassing is; bij een onaangeroerde Dino's Gulyás dus niet.
Rij 82 — EN: **Built in: everything moves along, nothing doubles (phase 6, 13F; Stijn).** 1. Open the app
after the update. Tap **Reload** if asked. 2. Read the notice at the top. Tap **Close**. 3. Tap **Recipes**
at the bottom. Tap **Own** at the top. 4. Tap **A–Z**. Search **Gulyás** and open **Dino's Gulyás**. 5. Scroll
to the method and tap **Edit**. 6. Tap **More → The story** at the bottom. | Good when: 2. It says "New in
the book: 20 recipes from Stijn and Gabi" with the line about favourites, cooks, photos and notes. 3. Only
"French Onion Soup with Gruyère (gluten-free)" is under Own. 4. The star is still on; under the title it
says "From Dino, via Stijn" and your earlier cooks are still there ("cooked 2× · last …"). 5. The editor
opens as an adjustment of a classic (with "Restore original" further down the page). 6. "Together we have
cooked … of the 236" and a card **New since the first edition** with "From the Stijn chat", "From Gabi" and
"Added by Stijn".

Rij 83 — NL: **Inbouwen op Gabi's telefoon (13F; Gabi, iPhone).** 1. Open de app na de update en tik op
**Vernieuwen**. 2. Tik onderaan op **Recepten**, zoek **Moroccan** en open **Moroccan meatball stew**. 3. Kijk
onder de titel en bovenaan bij de foto's. 4. Tik op **Meer → In & uit** en op **Ontvangen**. 5. Tik op
**Meer → Badges**. | Goed als: 2. Het recept staat er één keer, niet twee keer. 3. Er staat "From Gabi"; staat
er ook "adjusted", dan is dat jouw eigen versie van de tekst (tik op "Restore original" alleen als je dat
wilt); je kookbeurten en foto's staan er nog. 4. De oude rijen "Received from Stijn" staan er nog en openen
het recept. 5. Een badge die je al had is nog steeds verdiend.
Rij 83 — EN: **Built in on Gabi's phone (13F; Gabi, iPhone).** 1. Open the app after the update and tap
**Reload**. 2. Tap **Recipes** at the bottom, search **Moroccan** and open **Moroccan meatball stew**. 3. Look
under the title and at the photos at the top. 4. Tap **More → In & out** and **Received**. 5. Tap **More →
Badges**. | Good when: 2. The recipe is there once, not twice. 3. It says "From Gabi"; if it also says
"adjusted", that is your own wording (tap "Restore original" only if you want that); your cooks and photos
are still there. 4. The old rows "Received from Stijn" are still there and open the recipe. 5. A badge you
already had is still earned.
⚠ Feitencheck (rij 83, goed 3 en 4, NL en EN): de receptpagina toont geen "adjusted"/"aangepast" en
geen "Restore original" (die zitten in de editor, §1a.4). Onder Ontvangen/Received staan geen rijen
"Received from Stijn" die blijven: de lijst "Received recipes" toont alleen ontvangen eigen recepten (die
verdwijnen bij het inbouwen), en de "Import history"-rijen ("from Stijn") blijven wel maar openen geen
recept (§1a.5).

Rij 84 — NL: **Oude link en oude back-up na het inbouwen (13F; Stijn).** 1. Zoek in WhatsApp een oude link
van Gabi naar een recept dat nu in het boek staat (bv. de gehaktbalstoof). Open hem (Android) of kopieer
hem en plak hem bij **Meer → In & uit** (iPhone). 2. Lees de voorvertoning. 3. Tik op **Meer → Opslag &
back-up → Herstel** en kies een back-up van vóór vandaag. 4. Open **Dino's Gulyás**. | Goed als: 2. Er staat
"Heb je al", of "Aanpassing van klassieker" met de naam en "aangepast door Gabi"; nooit een nieuw eigen
recept. 3. Herstel lukt; onder
**Eigen** komt niets dubbel bij. 4. Het aantal kookbeurten is niet verdubbeld.
Rij 84 — EN: **Old link and old backup after building in (13F; Stijn).** 1. In WhatsApp find an old link
from Gabi to a recipe that is now in the book (e.g. the meatball stew). Open it (Android) or copy it and
paste it in **More → In & out** (iPhone). 2. Read the preview. 3. Tap **More → Storage & backup → Restore**
and pick a backup from before today. 4. Open **Dino's Gulyás**. | Good when: 2. It says "Already have it",
or "Tweak of a classic" with the name and "tweaked by Gabi"; never a new own recipe. 3. Restore succeeds; nothing doubles under **Own**.
4. The number of cooks has not doubled.

Rij 85 — NL: **Glutenvrije uiensoep blijft een eigen versie (13F; Stijn).** 1. Open **Franse uiensoep met
Gruyère** (de klassieker). 2. Kijk onder de titel. 3. Tik op **glutenvrij**. | Goed als: 2. Er staat
"Ook als: glutenvrij". 3. Je eigen glutenvrije versie opent, met "Versie van Franse uiensoep met Gruyère".
Rij 85 — EN: **Gluten-free onion soup stays your own version (13F; Stijn).** 1. Open **French Onion Soup
with Gruyère** (the classic). 2. Look under the title. 3. Tap **gluten-free**. | Good when: 2. It says
"Also as: gluten-free". 3. Your own gluten-free version opens, with "Version of French Onion Soup with
Gruyère".
(Rij 85 geldt tot 13D blok 2: dan verdwijnen de "Ook als:"-chips en wordt de kopie een tab "Stijn" op het
origineel; 13D's rijen 86–88 nemen het over en de integrator van 13D blok 2 past rij 85 aan.)

## 7. Controlelijst voor Fable (eindcontrole)

1. `data/id-aliases.json`: 21 sleutels, 20 doelen, exact de tabel van §2b; `u:uvrzu65p` ontbreekt;
   `fp`/`content` kloppen met `fieldFingerprints`/`contentFingerprint` van de bron (test 2 van §6a).
2. `data/source/stijnchat-2026-10-13.json` bevat alleen `at`, `userRecipes`, `userIngredients` — geen
   profielen, settings, device-ids, favorieten.
3. Alle 11 herschreven bereidingen gelezen (NL én EN): eigen woorden, niets uit de bron letterlijk
   overgenomen behalve hoeveelheden/tijden; Fat Duck en Lièvre extra kritisch; °C overal.
4. De 8 woordenboek-entries: juiste gangpaden, flags (panko gluten true; nduja/haas/foie-gras/keelspek
   veg false), `many`-vormen, en `lactose` als 6B die vlag verplicht maakte.
5. `npm run migrate` tweemaal → identiek behalve `generatedAt`; `tests/migrate.test.ts` vergelijkt met het
   gecommitte bestand; `validate:data` controleert aliases en meta.
6. `applyAliases` is puur en idempotent (test 11), gebruikt nergens `Date.now()`; de db-runner leest geen
   blobs en gebruikt `update(id, {recipeId})` voor foto's.
7. `db.version(8)` zonder stores-wijziging; upgrade roept alleen `runAliasMigration(tx)` aan; het
   schema-commentaar in db.ts is aangevuld; `ensureBuiltins` draait de run alleen bij een versiewissel.
8. `importBundle`: `mapBundleIds` vóór de dedupe; `imports` en `timers` in de transactielijst; een tweede
   herstel van dezelfde oude back-up voegt niets toe (§6c 4).
9. `planImport`: oude `#r=` met alias-id → present of patch, nooit `new`; `bases`-fallback; frozen token
   decodeert op beide engines; bestaande merge-tests ongewijzigd groen.
10. UI: credit vervangt "klassieker uit het boek" alleen bij `origin.kind === 'builtin' && credit`; de
    verhaal-kaart ontbreekt zonder credits; AliasNotice verschijnt één keer en nooit na Sluit; alle nieuwe
    i18n-keys in NL én EN (`aliases.notice.*`, `story.added.*`).
11. Badges: een id in `badges.earned` blijft verdiend (bestond al in src/badges.ts `badgeStatuses`;
    nagaan dat het onveranderd is); geen andere badge-logica aangeraakt.
12. `src/landing.ts` en de share-chunk niet gegroeid door de aliasimport (id-aliases.json alleen in de app-
    bundel; controleer `npm run build`-output).
13. STATUS.md noemt: Dexie v8, DATA_VERSION 10, 236 klassiekers, de servings-beperking, de volgorde "eerst
    back-up, dan updaten" voor Stijn, DEVICE-TEST 82–85.
14. Geen nieuwe dependency; `npm run check`, `npm test`, `npm run build`, `npm run build:next`,
    `npm run validate:data` groen.

## 8. Open vragen voor Stijn

**Beantwoord door Stijn, 23 okt 2026:** vraag 3 → **ja, de voornamen mogen genoemd worden** ("Van Gabi",
"Van Dino, via Stijn"; de vervangende teksten vervallen). Vragen 1 en 2 kregen geen ander antwoord: de
standaard geldt ("Griekse salade van Stijn" / "Stijn's Greek salad"; de twee kookboekrecepten inbouwen met
volledig herschreven bereiding). Blok 1 is hiermee vrij om te bouwen.

1. **Naam van jouw Griekse salade.** De naam botst met de klassieker "Griekse salade" uit het boek (ander
   recept: lollo rosso, radijs, 60 g feta). Standaard hier: **"Griekse salade van Stijn"** /
   **"Stijn's Greek salad"** (id `b:griekse-salade-van-stijn`). Liever iets anders (bv. "Griekse salade van de
   Kanaalstraat")? Dan die naam in de meta; het id volgt de naam.
2. **De twee kookboekrecepten** (Botrytis cinerea-dessert, 143 regels/52 stappen; Lièvre à la royale).
   Standaard hier: inbouwen mét volledig herschreven bereiding (Opus schrijft, Fable leest na). Alternatief
   met minder werk en nul auteursrechtrisico: als eigen recept laten staan (dan `action: 'personal'`, geen
   alias, 18 klassiekers). Zeg "inbouwen" of "laten staan".
3. **Voornamen op de openbare site.** De credits "Van Gabi" en "Van Dino, via Stijn" zetten hun voornaam op
   https://srutgers96-star.github.io/recepten/. Even vragen aan Gabi (en Dino)? Zo niet: "Van een huisgenoot"
   / "From a housemate" en "Van een vriend" / "From a friend" als vervangende teksten.
