# Spec V6 — Gabi's lijstje plakken met voorstellen, en de woordenlijst-ronde (Stijn, 30 okt + 8 nov 2026)

Status: compleet (Fable, 9 nov 2026). Eén blok, vier bouwers + integrator (lichte modus). Bron: docs/IDEAS.md idee 7 (Stijn 30 okt:
Gabi's WhatsApp-lijstje "Coco acqua · Beetroot · Check ketchup · Pickles · Bread for breakfast" plakken en "dat de app gewoon de
goede dingen voorstelt en dan aan kan nemen") en idee 8 (woordenlijst uitbreiden); 8 nov: "is goed, als je dat kan maken klinkt het
geweldig"; leren van de keuzes = ja. Leidend bij tegenspraak: docs/specs/README.md §2–§4, CLAUDE.md invariant 2 (een rauwe regel
wordt nooit weggegooid), docs/specs/handbook.md §4.
Gebouwd: 9 nov 2026 (V6, lichte workflow wf_323231d0-63a; lens: vijf bevindingen — twee direct hersteld (een nieuw ingrediënt via Zoek… wiste de keuzes; getypte tekst verdween bij een plak), drie besluiten Fable: (1) een herkende regel krijgt een veld `note` dat de lijst tussen haakjes achter de naam toont, geen apart `raw`-veld; (2) de omlijnde twijfel-chip wordt met de eerste tik bevestigd, pas een tweede tik geeft Als tekst; (3) de score: exacte naam of alias 1,0, een woord dat met de tekst begint 0,9, anders de lengteverhouding tot 0,8, één enkele treffer is twijfel vanaf 0,5; woordenlijst 1603 → zie STATUS; de handboekwaarschuwing over "Zet 5 regels op de lijst" komt doordat de validator {n} niet invult)

**Kritische lezer (Fable, vooraf).** (1) Het plakvak doet nu alles in één keer: herkennen en plaatsen. De controlestap komt er
alleen bij een lijstje van drie of meer regels, zodat "melk" of "2 eieren" even snel blijft als nu. (2) Gabi schrijft Engels op
Stijns Nederlandse lijst: de herkenner zoekt dus in beide talen en kiest de beste treffer. (3) Leren mag het woordenboek zelf
niet vervuilen: een geleerde koppeling ("coco acqua" → kokoswater) is een toestel-instelling die de herkenner als eerste
raadpleegt, zichtbaar en te vergeten onder Woordenboek. (4) De rauwe regel blijft altijd bewaard: als tekst op de lijst, of als
bron van een herkende regel. (5) De woordenlijst-ronde is data: de acht ids uit 13F letterlijk, plus wat Gabi's keuken en de
Aziatische basis missen, met dezelfde validator en de golden-test van de parser.

**Feitencheck (Fable, in de code).** `src/components/ExtraField.tsx` is het veld "+ wc-papier, melk …": `parseShopInput(text, dict,
lang)` per deel (regel ±50 en ±100), `splitShopList`/`isShopList` (±94, ±120), zoeksuggesties zolang het geen lijstje is (±129);
plaatsen via `addExtra(item)` (src/db/repo.ts ±2146; `key`, `ing`, `qty`, `unit`, `label`). `src/domain/shopinput.ts`:
`ShopInput { qty, unit, name }`, `splitShopList`, `isShopList`, `parseShopInput`; tests/shopinput.test.ts (17 tests). Woordenboek
(`src/domain/dictionary.ts`): `ingredientByName(text, lang)`, `findExisting(name, lang)`, `search(query, lang)`, `searchRanked(query,
lang): IngredientMatch[]` (gerangschikt), `withUserEntries`; `src/dictionary.ts`: signals `dictionary`, `userIngredients`,
`baseDictionary()`. IngredientPicker (`src/components/IngredientPicker.tsx`, props zoeken/nieuw). SheetPortal voor vensters.
Handboek 04: rij `week-en-boodschappen.zelf-toevoegen`. data/ingredients.json: 1603 producten met `aliases.nl/en`; ontbreken
o.a. nduja, panko, truffel, haas, foie-gras, keelspek, noilly-prat, mokkaboontje, miso, tempeh, za-atar, pickles (alias), en een
bietennaam (controleer `biet`/`rode-biet`/`bieten`); aanwezig: kokoswater, zuurkool, gochujang, kimchi, paneer, garam-masala,
ras-el-hanout, sumak, edamame, nori, wasabi, mirin, hoisinsaus, kefir, boekweit, dille, kwark, roggebrood. `tools/gen-golden.ts`
hergenereert tests/parser.golden.json als de woordenlijst groeit (data/README.md).

## 1. Gedrag

### 1a. Herkenner met voorstellen (bouwer A: `src/domain/shopinput.ts`, `tests/shopinput.test.ts`)

- `export type ShopSuggestionStatus = 'sure' | 'maybe' | 'unknown'`.
- `export interface ShopSuggestion { raw: string; qty: number | null; unit: string | null; name: string; note: string | null;
  match: string | null; alternatives: string[]; status: ShopSuggestionStatus }` (`match`/`alternatives` = ingrediënt-ids).
- `export function suggestShopLines(text: string, dict: Dictionary, lang: Lang, learned: Readonly<Record<string, string>> = {}):
  ShopSuggestion[]`: splitst met `splitShopList` (ook op regeleinden en " · "), per regel `parseShopInput` in de taal `lang`; mislukt
  de hoeveelheid in `lang`, probeer de andere taal. **Notitie-woorden** vooraan of achteraan worden `note` en verdwijnen uit `name`:
  NL "check", "controleer", "kijken of", "misschien", "evt.", "eventueel", "als het kan"; EN "check", "maybe", "if possible",
  "optional", "see if", "for breakfast/lunch/dinner" (de drie maaltijdwoorden als notitie). **Koppeling:** (1) `learned[normalizeKey(name)]`
  → sure; (2) `ingredientByName(name, lang)` of in de andere taal → sure; (3) `searchRanked(name, lang)` én in de andere taal,
  samengevoegd en gesorteerd op score: is de beste duidelijk beter (score ≥ 0,85 of ≥ 1,5× de tweede) → `maybe` met die als `match` en
  hooguit twee alternatieven; anders `unknown` met hooguit drie alternatieven en `match: null`. Een woord van één of twee letters blijft
  unknown. De `raw` regel blijft altijd bewaard.
- Tests (toevoegen): Gabi's lijst letterlijk `"Coco acqua\nBeetroot\nCheck ketchup\nPickles\nBread for breakfast"` met `lang: 'nl'`:
  ketchup → sure met note "check"; beetroot → sure of maybe op de bietennaam zodra die bestaat (bouwer C; schrijf de test tegen het
  id dat C toevoegt: `biet`), bread → maybe/sure op `brood` met note "for breakfast"; "Coco acqua" → unknown, of sure via `learned`
  `{ 'coco acqua': 'kokoswater' }`; notitiewoorden NL; één- en tweeletterwoorden unknown; `splitShopList` op regeleinden en " · ".

### 1b. Controlestap in de app (bouwer B: `src/components/ShopPasteSheet.tsx` [nieuw], `src/components/ExtraField.tsx`,
`src/screens/DictionaryScreen.tsx` (alleen het blok Geleerd), `src/db/repo.ts` (alleen de setting hieronder), `src/i18n/edit.ts` of waar `shop.*`
staat, `src/styles/shopping.css`)

- **Wanneer:** als de tekst in het plakvak na `splitShopList` **drie of meer** delen heeft (plakken of typen), opent in plaats van direct
  plaatsen het venster **Zet op de lijst?** (`shop.paste.title` NL "Zet op de lijst?" · EN "Put on the list?"), een SheetPortal met
  Sluit rechts. Eén of twee delen: gedrag als nu.
- **Per regel** (in de volgorde van de tekst): links de rauwe tekst (muted, met de hoeveelheid), rechts het voorstel: `sure` →
  één gevulde chip met de naam van het ingrediënt in de app-taal; `maybe` → een omlijnde chip met de beste plus hooguit twee
  alternatieve chips; `unknown` → de chip **Als tekst** (`shop.paste.asText` NL "Als tekst" · EN "As text") gekozen, met de alternatieven
  ernaast als die er zijn; altijd een kleine knop **Zoek…** (`shop.paste.search` NL "Zoek…" · EN "Search…") die de IngredientPicker
  opent (zoeken of nieuw aanmaken) en de keuze in de regel zet. Een tik op een chip kiest die; nog een tik op de gekozen chip →
  Als tekst. De `note` staat cursief onder de regel (`shop.paste.note` NL "Notitie: {note}" · EN "Note: {note}").
- **Knop onderaan** `shop.paste.add` NL "Zet {n} regels op de lijst" · EN "Put {n} lines on the list" (zuster `shop.paste.addOne` NL "Zet 1
  regel op de lijst" · EN "Put 1 line on the list"): per regel `addExtra` zoals ExtraField het voor een herkend ingrediënt doet (met
  `ing`, `qty`, `unit`; de notitie in `label` tussen haakjes achter de naam) of als tekstregel (`label` = raw). Daarna sluit het venster en
  staat er de bestaande bevestiging.
- **Leren:** kiest de gebruiker iets anders dan het eerste voorstel (een alternatief, of via Zoek…), dan komt `normalizeKey(name) →
  ingredient-id` in de setting `shop.learned` (`Record<string,string>`, in de back-up; repo: `getLearnedShopWords()`, `learnShopWord(key, id)`,
  `forgetShopWord(key)`); `suggestShopLines` krijgt die mee. Onder **Woordenboek** (DictionaryScreen) een blok **Geleerd van lijstjes**
  (`dict.learnedTitle` NL "Geleerd van lijstjes" · EN "Learned from lists") met per regel "coco acqua → kokoswater" en een ✕
  (`common.remove` of bestaande sleutel); leeg → het blok ontbreekt.
- Toegankelijk: chips als `role="radio"` in een `radiogroup` per regel; 44 px tikvlakken; 16 px tekst.

### 1c. Woordenlijst-ronde (bouwer C: `data/ingredients.json`, `tests/parser.golden.json` via `tools/gen-golden.ts`, aantallen in tests)

- **Letterlijk uit 13F (inbouwen.md §2b):** `nduja` (vlees-vis, g), `panko` (droog, g, gluten), `truffel` (groente-fruit, g), `haas`
  (vlees-vis, g), `foie-gras` (vlees-vis, g), `keelspek` (vlees-vis, g), `noilly-prat` (dranken, ml, alias NL "droge vermout", EN "dry
  vermouth"), `mokkaboontje` (snacks-zoet, stuk). Volledige entries zoals de bestaande: `nl/en one/many`, `aliases`, `aisle`,
  `defaultUnit`, `buyUnit` waar zinvol, `staple`, `veg/vegan/gluten/lactose` (+ `glutenUnsure` waar van toepassing).
- **Gabi's keuken en de Aziatische basis:** controleer deze kandidaten op aanwezigheid (id, namen én aliassen) en voeg toe wat
  ontbreekt: miso, tempeh, za'atar (`za-atar`), bietjes (één product `biet`, NL "biet/bieten", EN "beetroot/beetroots", aliassen
  "rode biet", "bietjes", "beet"), pickles → alias EN "pickles" op augurk, "coco acqua"/"coconut water" → aliassen op kokoswater,
  halloumi, labneh, bulgur, udon, soba, rijstpapier, kokosolie, sojamelk, havermelk, kvas (`kvas`, dranken), varskė → kwark-alias
  "varske", grietinė → zure-room-alias "grietine", burokėliai → biet-alias "burokeliai", šaltibarščiai hoort niet (gerecht), lijnzaad,
  chiazaad, pompoenpitten, tahini-alias op tahin, sriracha, sambal (controleer), vissaus (aanwezig), oestersaus, rijstnoedels, glasnoedels,
  kokosroom. Engelse namen Brits. Nieuwe ids kebab-case; bestaande ids nooit wijzigen.
- Daarna `npm run validate:data`, `node --experimental-strip-types tools/gen-golden.ts` (als de golden-test dat vraagt), `npm test`;
  aantallen in tests die 1603 pinnen bijwerken; noem het nieuwe totaal in je rapport.

### 1d. Handboek (bouwer D: `data/handbook/04-week-en-boodschappen.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`)

Rij `zelf-toevoegen` (één of twee dingen typen gaat direct; bij drie of meer komt eerst het venster), nieuwe rij
`week-en-boodschappen.lijstje-plakken` "Een lijstje van iemand anders plakken" (plak uit WhatsApp → per regel een voorstel, groen
is zeker, omlijnd is twijfel met keuzes, Als tekst houdt de woorden, Zoek… voor iets anders, de knop Zet n regels op de lijst; wat je
kiest onthoudt de app voor de volgende keer, te zien onder Woordenboek → Geleerd van lijstjes). Daarna `npm run validate:data` en
`node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

De drempel van drie regels · de drie statussen en hun grenzen (0,85 / 1,5×) · leren als toestel-instelling (niet in het woordenboek)
· notitiewoorden-lijst · de kandidatenlijst van §1c (toevoegen wat ontbreekt, niets hernoemen) · nieuwe dependencies (nee).

## 3. Bestandsverdeling

**A — Herkenner:** `src/domain/shopinput.ts`, `tests/shopinput.test.ts`.
**B — Venster en leren:** `src/components/ShopPasteSheet.tsx` [nieuw], `src/components/ExtraField.tsx`, `src/screens/DictionaryScreen.tsx`
(alleen het blok Geleerd), `src/db/repo.ts` (alleen `shop.learned` + drie functies), `src/i18n/edit.ts` (shop.paste.*, dict.learnedTitle;
staat `shop.*` elders, dan daar), `src/styles/shopping.css`. Schrijf tegen `suggestShopLines` van A (bestaat het nog niet bij jouw check:
meld als open).
**C — Woordenlijst:** `data/ingredients.json`, `tests/parser.golden.json` (alleen via gen-golden), tests die het aantal producten pinnen.
**D — Handboek:** `data/handbook/04-week-en-boodschappen.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; dev-app (375 px, NL én EN): plak Gabi's lijstje in het plakvak → venster met
vijf regels, ketchup zeker met notitie, bietjes herkend, "Coco acqua" als tekst of met Zoek… naar kokoswater → daarna staat het onder
Woordenboek → Geleerd van lijstjes en is het de volgende keer zeker; "melk, 2 eieren" gaat direct zoals voorheen; Zet 5 regels op de
lijst → de regels staan op de lijst met hoeveelheid, de tekstregel onder Overig. DEVICE-TEST: nieuwe rij 115 "Lijstje plakken met
voorstellen (V6)" NL én EN na rij 114 (met Gabi's lijst letterlijk), en de rij over het plakvak (zoek "wc-papier") bijwerken. STATUS-alinea
en de regel "Gebouwd: …".

## 4. Niet in dit blok

Spraakinvoer op Boodschappen bestaat niet; V7, V8, V9 (docs/IDEAS.md).
