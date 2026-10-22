# Spec 6C — Vaste boodschappenlijst ("Vaste lijst" / "Every week")

Status: compleet (Fable 15 okt; feitencheck Opus 22 okt 2026)

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (besluiten over specs heen in
docs/specs/README.md §2; bij tegenspraak wint README.md). Voor deze spec:
- Bouwvolgorde: 6C komt ná Home A+, 13K, 6B+13E, bijgerechten, 13F en 13D; vóór 6D. DEVICE-TEST-rijen
  zijn definitief **89–91**; rij 28 (NL+EN) past de integrator van blok 2 aan.
- De open punten A–D van de feitencheck zijn **beslist** (hieronder bij elk punt "Besluit"): A eigen
  stapgrootte `STANDING_STEP` (l 1 · kg 0,5 · g 50 · ml 100 · anders 1); B woordenboekkeuze zonder getal
  → aantal 1, vrije tekst zonder getal → zonder aantal; C een eenheid buiten `STANDING_UNITS` blijft staan
  zoals getypt/overgenomen (in het venster is dan geen pil gekozen; kiezen van een pil vervangt hem);
  D blok 2 bouwer C zet in `src/components/WeekCard.tsx` (Home A+) de lege-staat-link
  `home.weekEmptyStanding` — NL **Alleen de vaste lijst ›** · EN **Just the every-week list ›** →
  `navigateTab('/shopping?tab=standing')` (key in src/i18n/browse.ts). Verder geen Home-wijzigingen.
- 13K (gebouwd vóór 6C) zet `<TimerBar />` direct onder de Header van ShoppingScreen; de tabbladen van
  6C komen daaronder. Beide specs raken ShoppingScreen.tsx; 6C voegt in.
- 6D-2 haakt `recordFeature('standingList')` aan het `addStandingItem`-pad (StandingTab.onAdd en "Zet op
  de vaste lijst"); 6C bouwt daar niets voor.
- `normalizeStandingList` controleert `unit` alleen op `string | null` (geen woordenboek bij de hand);
  `renderStandingItem` valt voor een onbekende eenheid-id terug op de id-tekst.
- De twee open vragen voor Stijn blijven (twee regels voor hetzelfde ingrediënt; "Heb ik al" tot Klaar);
  standaard = zoals hier gebouwd.

Bouwspec door Fable (15 okt 2026) voor Opus 5.5. Bron: docs/phase-6-spec.md blok 6C + Stijns antwoorden
(één vaste lijst per huishouden = per telefoon; voorbeeld: elke week 1 pot mayonaise, 1 pot pindakaas en
x liter melk; "heb ik al" per week; hoeveelheid alleen deze week aanpassen; "ook voortaan"; werkt ook
zonder recepten). Alles wat een keuze is, staat hier gekozen; bij twijfel §5 ("Opus mag dit NIET zelf
beslissen"), anders vragen aan Stijn/Fable. Bestaande code die hier genoemd wordt is gecontroleerd op
15 okt 2026 en opnieuw op 22 okt 2026 (bestandsnamen, signaturen, i18n-keys, data-ids, Dexie-versie).

**Bijgewerkt 22 okt (feitencheck Opus; ontwerp en keuzes ongewijzigd):**
- `ExtraField` leest getal + eenheid + naam nu via `parseShopInput` (src/domain/shopinput.ts, sinds
  17 okt): "3 melk" én "200 gram boter" werken; de getypte eenheid komt mee in `unit` (§1b, §3).
  `splitLeadingQty` bestaat niet meer. Vrije tekst krijgt het gangpad van een bijna-treffer mee
  ("doos eieren" → zuivel-eieren), anders 'overig' (§2 type-comment `aisle`).
- `shop.noPlan` bestaat al (tekst over "wat elke week meegaat"): de spec vervangt alleen de tekst (§1d).
- "wc-papier" staat nu in het woordenboek (id `wc-papier`, gangpad Huishoudelijk, EN "toilet roll"):
  het voorbeeld van vrije tekst is nu **postzegels** / **stamps** (door de feitencheck gecontroleerd: niet in
  het woordenboek) in §1b, §2 en §6.
- NL-meervoud: `renderListItem` maakt "2 potten mayonaise" (EN "2 jars mayonnaise"), niet "2 pot
  mayonaise" (§6 check 5, rij 90).
- Dexie staat nog op **v7**; deze spec heeft geen eigen versie nodig en claimt er geen.
- Nieuwe sheet-regel (13J): `StandingSheet` gaat via `SheetPortal` met de knoppen in de kop
  (`.sheet-head.with-actions`); geen Bewaar-knop, want alles slaat direct op (§1c, §3).
- `Segmented` is `V extends string`: de eenheid "stuks" (`null`) krijgt de waarde `'-'` (§1c, §3).
  `ProtoRow` rendert zijn eigen `<li class="pr">`: de knopregel van `StandingProtoRow` is een tweede
  `<li>` erna (§3).
- DEVICE-TEST: deze spec heeft de definitieve rijen **89–91** (hernummerd door de kritische lezer). Rij 28
  (NL + EN) noemt "Elke week" in het menu: die tekst past de integrator van blok 2 aan.
- Rij 90/91 en §6: **Klaar** is grijs tot er iets is afgevinkt (`done === 0`), en na het weghalen van
  alle gerechten staat er eerst "Weekplan gewijzigd — Bijwerken": de stappen zeggen dat nu.

**Open punten van de feitencheck — beslist door de kritische lezer (22 okt); Opus bouwt het besluit:**
- **A. Stapgrootte in het bewerkvenster.** `adjustStep(unit, qty)` geeft bij liters 0,1 l, vanaf
  "zonder aantal" 0,01 l, bij kg 0,05: te fijn voor een weeklijst. **Besluit:** eigen tabel in
  standing.ts, `STANDING_STEP: Readonly<Record<string, number>> = { l: 1, kg: 0.5, g: 50, ml: 100 }` en
  `standingStep(unit: string | null): number` (= `STANDING_STEP[unit ?? ''] ?? 1`). "2 l melk" + één tik
  = "3 l melk"; onder één stap wordt het aantal `null` ("zonder aantal"); + vanuit null geeft één stap.
- **B. Aantal bij een woordenboekkeuze zonder getal.** **Besluit:** woordenboekitem zonder getal → `qty: 1`
  ("mayonaise" → "1 pot mayonaise" na de standaardeenheid); vrije tekst zonder getal → `qty: null`
  ("postzegels"). Zo staat het in §1b en §3 (StandingTab.onAdd).
- **C. Een eenheid die niet in `STANDING_UNITS` staat** ("3 el mayonaise", "2 dl room", "1 bos peterselie"
  via "Zet op de vaste lijst"). **Besluit:** bewaren zoals hij is; in het venster is dan geen pil gekozen en
  een tik op een pil vervangt hem. `normalizeStandingList` eist alleen `string | null`;
  `renderStandingItem` toont een onbekende id als tekst.
- **D. Home.** **Besluit:** blok 2 bouwer C zet in `src/components/WeekCard.tsx` (Home A+) in de lege
  weekkaart de tekstlink `home.weekEmptyStanding` (NL "Alleen de vaste lijst ›" · EN "Just the every-week
  list ›", → `navigateTab('/shopping?tab=standing')`; key in src/i18n/browse.ts). §5 punt 10 is daarop
  aangepast; verder geen Home-wijzigingen.

## 1. Doel en gebruikersgedrag

**Idee in één zin:** de vaste lijst is wat je elke week toch koopt. Hij staat los van recepten en komt bij
elke boodschappenlijst erbij; per lijst zeg je "heb ik al" of past het aantal aan; "ook voortaan" maakt
dat aantal de nieuwe standaard. De bestaande "Elke week"-pin (shop.menu.pin) verdwijnt en gaat hierin op.

### 1a. Boodschappen-scherm: twee tabbladen
Boven in `#/shopping` komt een `Segmented` (bestaand component, src/components/Segmented.tsx; bij een
tik op de keuze die al aan staat geeft `onChange` `[]`: dan niets doen) met twee keuzes:
- `shop.tab.week` — NL **Deze week** · EN **This week** (= de huidige lijst/proto-flow, ongewijzigd)
- `shop.tab.standing` — NL **Vaste lijst** · EN **Every week**
De keuze staat NIET in storage; `#/shopping?tab=standing` opent het tweede tabblad (de proto-stap
`?proto=1` toont geen tabbladen: dat is een tussenstap). Het Week-scherm (`navigate('/shopping?proto=1')`
in WeekScreen.tsx) en Home (`navigateTab('/shopping')` in HomeScreen.tsx) blijven zo wijzen (niets
veranderen daar).

### 1b. Tabblad Vaste lijst (beheren)
Van boven naar beneden:
1. Grijze introzin `shop.standing.intro` — NL "Wat je elke week koopt, ook zonder weekplan. Dit komt bij
   elke boodschappenlijst erbij." · EN "What you buy every week, with or without a week plan. It goes on
   every shopping list."
2. Het bestaande `ExtraField` (src/components/ExtraField.tsx: woordenboek-autocomplete, komma's =
   meerdere) met placeholder `shop.standing.addPlaceholder` — NL "+ 1 pot mayonaise, 2 l melk …" · EN
   "+ 1 jar mayonnaise, 2 l milk …" en `previous={[]}`. ExtraField leest het getypte aantal én de
   eenheid via `parseShopInput` (src/domain/shopinput.ts): "3 melk" → aantal 3 zonder eenheid,
   "200 gram boter" → 200 g, "2 l melk" → 2 l, "1 pot mayonaise" → 1 pot, "2 pakken melk" → 2 pak;
   `onAdd` krijgt `{ ing, aisle, qty, unit }` (vrije tekst: `ing: null` + `label`). Is er geen eenheid
   getypt (`unit: null`), dan krijgt een woordenboekitem de standaardeenheid van §2
   `defaultStandingUnit` (pindakaas → pot, melk → l, ei → stuks; "2 melk" → "2 l melk"); een getypte
   eenheid blijft staan ("200 gram boter" → "200 g boter"; ook een eenheid buiten `STANDING_UNITS` blijft
   staan, besluit C). Een woordenboekkeuze zonder getal ("mayonaise") krijgt aantal 1 (besluit B). Vrije
   tekst ("postzegels": het woordenboek kent het niet) mag, net als bij de extra's, en blijft zonder aantal
   als er geen getal is getypt. Snack
   `shop.standing.addedSnack` — NL "Op de vaste lijst gezet: {name}" · EN "Put on Every week: {name}",
   met Ongedaan.
3. De regels, gegroepeerd per gangpad in data-volgorde (zelfde koppen als de lijst: `groupByAisle`),
   tekst via `renderStandingItem` ("1 l melk" / "1 l milk", "1 pot mayonaise" / "1 jar mayonnaise",
   "2 potten mayonaise" / "2 jars mayonnaise", "melk" zonder aantal, "postzegels"). Een uitgezette
   regel staat grijs met de toevoeging `shop.standing.paused` — NL "(staat uit)" · EN "(paused)". Tik
   op een regel → het bewerkvenster (1c).
   Grijze regel onder de lijst `shop.standing.tapHint` — NL "Tik op een regel om het aantal of de
   eenheid te veranderen." · EN "Tap a line to change the amount or the unit."
4. Leeg: `shop.standing.empty` — NL "Nog niets. Typ hierboven wat je elke week koopt, bijvoorbeeld
   2 l melk." · EN "Nothing yet. Type above what you buy every week, for example 2 l milk."

### 1c. Bewerkvenster van één vaste regel (`StandingSheet`, via `SheetPortal`, bestaande `.sheet`-opmaak)
Zoals elke nieuwe sheet sinds 13J staat het venster in `<SheetPortal>` (src/components/SheetPortal.tsx)
en staan de knoppen in de kop (`.sheet-head.with-actions`, `.sheet-head-btn` uit base.css), zodat op de
iPhone niets onder de rand valt. **Kop:** links een lege plek (`<span class="sheet-head-btn"
aria-hidden="true" />`, houdt de titel in het midden), in het midden `<h2>` = de naam (`itemName`),
rechts de knop `common.close` (bestaat: NL "Sluit" · EN "Close") als `.sheet-head-btn save` (vet).
**Geen Annuleer en geen Bewaar:** elke tik in dit venster (stepper, eenheid, Even niet meenemen) slaat
meteen op via `onPatch`; er is dus niets om te bewaren of terug te draaien. Sluit, Escape en ernaast
tikken sluiten alleen het venster (de wijzigingen staan er al). Bij openen krijgt de Sluit-knop de focus,
bij sluiten gaat die terug naar wat het venster opende (zelfde aanpak als VariantSheet). Inhoud (`.sheet-body`):
- `shop.standing.edit.amount` — NL "Standaardaantal" · EN "Usual amount": een stepper `[−] 1 l [+]`
  met de stap `standingStep(unit)` (besluit A: l → 1, kg → 0,5, g → 50, ml → 100, alles anders → 1; niet
  `adjustStep`); onder 1 stap wordt het aantal `null` en staat er `shop.standing.edit.noAmount` — NL
  "zonder aantal" · EN "no amount"; + vanuit null geeft 1 stap. Staat de eenheid buiten `STANDING_UNITS`
  (besluit C), dan is in de rij Eenheid geen pil gekozen; een tik op een pil vervangt de eenheid.
- `shop.standing.edit.unit` — NL "Eenheid" · EN "Unit": `Segmented` (src/components/Segmented.tsx) met
  de tien keuzes uit `STANDING_UNITS` (§2); label = `dict.unit(id)[lang].one`, voor `null` de tekst
  `shop.standing.edit.unitNone` — NL "stuks" · EN "pieces". `Segmented` neemt alleen strings: de
  waarde van "stuks" is `'-'` (omzetten naar `null` bij `onPatch`). Tikken op de pil die al aan staat
  geeft `[]`: dan niets doen (er is altijd precies één eenheid gekozen).
- Knop `shop.standing.edit.pause` — NL "Even niet meenemen" · EN "Skip for now" (als enabled) /
  `shop.standing.edit.resume` — NL "Weer meenemen" · EN "Include again" (als uit), met kleine uitleg
  `shop.standing.edit.pauseHint` — NL "Blijft op de vaste lijst, maar komt niet op de
  boodschappenlijst tot je het weer aanzet." · EN "Stays on Every week, but is left off the shopping
  list until you switch it back on."
- Rode knop `shop.standing.edit.remove` — NL "Verwijder van de vaste lijst" · EN "Remove from Every
  week" → sluit, snack `shop.standing.removedSnack` — NL "Van de vaste lijst gehaald: {name}" · EN
  "Taken off Every week: {name}", met Ongedaan (`restoreStandingItem`).
- Onderaan géén Sluit- of Bewaar-knop meer: Sluit staat in de kop (zie boven).

### 1d. De weeklijst: de vaste regels komen erbij
- **Proto-stap ("Controleer de lijst")**: ná de gangpadsecties en vóór "Voorraad" een blok
  `shop.standing.protoTitle` — NL "Vaste lijst" · EN "Every week" met hint `shop.standing.protoHint` —
  NL "Komt elke week erbij. Heb je het al in huis? Tik op Heb ik al: dat geldt alleen voor deze lijst,
  tot je op Klaar tikt. Een ander aantal geldt ook alleen nu; met Ook voortaan wordt het de nieuwe
  standaard." · EN "Added every week. Already got it? Tap Already have it: that counts for this list
  only, until you tap Done. A different amount is for now only too; Also from now on makes it the new
  usual amount." Per regel een `StandingProtoRow`: de gewone `ProtoRow` (−/+ past `adjusted` aan, dus
  alleen deze lijst) met daaronder een knopregel: **Heb ik al** (`shop.menu.inHouse`, bestaat) en, alleen
  als `adjusted` gezet is, **Ook voortaan** (`shop.standing.keep` — NL "Ook voortaan" · EN "Also from
  now on"). Ook voortaan → `adoptStandingAdjustment(key)` + snack `shop.standing.keptSnack` — NL "Nieuw
  standaardaantal: {text}" · EN "New usual amount: {text}" ({text} = `renderListItem` van de regel).
  Onder het blok een link `shop.standing.manage` — NL "Beheer de vaste lijst ›" · EN "Manage Every
  week ›" → `navigate('/shopping?tab=standing')`. Een vaste regel die "in huis" is staat, zoals nu, in
  het blok "In huis" (tik = Toch nodig).
- **De lijst zelf (afvinken)**: vaste regels staan gewoon in hun gangpad tussen de rest, afvinken zoals
  de rest, met het bestaande 📌-icoontje (`lr-pin` in src/components/ListRow.tsx, nu nog op
  `item.pinned` met title/aria-label `shop.pinned`) en aria-label `shop.standing.badge` — NL "vaste
  lijst" · EN "every week". Houd vast → het bestaande menu (de `.sheet.shop-sheet` in ShoppingScreen,
  views `'menu' | 'adjust' | 'sources'`; dat venster blijft zoals het is, het is geen nieuwe sheet) met:
  **Heb ik al / Toch nodig** (bestaande teksten `shop.menu.inHouse` / `shop.menu.needed`; voor een
  vaste regel staat er klein `shop.standing.haveHint` — NL "Alleen deze lijst; niet onthouden." · EN
  "This list only; not remembered." in plaats van de 3-weken-hint `shop.menu.inHouseHint`), **Aantal
  aanpassen** (staat er, zoals nu, alleen als `typeof qty === 'number'`; in die stand komt er een knop
  **Ook voortaan** bij, grijs zolang `adjusted` leeg is), **Haal van de vaste lijst**
  (`shop.menu.fromStanding` — NL "Haal van de vaste lijst" · EN "Take off Every week"; verwijdert het
  vaste item én de regel, snack met Ongedaan). Géén "Waarvoor is dit?" (in plaats daarvan de subregel
  `shop.standing.onList` — NL "Staat op je vaste lijst" · EN "On your every-week list") en géén
  "Verwijder" (dat is Heb ik al voor deze week, of Haal van de vaste lijst).
- **Elke andere regel** (receptregel of extra): de menuknop "Elke week" wordt `shop.menu.toStanding` —
  NL "Zet op de vaste lijst" · EN "Put on Every week" met kleine uitleg `shop.menu.toStandingHint` —
  NL "Komt voortaan elke week op de lijst." · EN "Goes on the list every week from now on." →
  `addLineToStanding(key)`; snack `shop.standing.addedSnack` met Ongedaan.
- **Klaar** (`clearChecks`) wist bij vaste regels óók `inHouse` en `adjusted`: de volgende lijst begint
  met de standaardaantallen. De undo-snack van Klaar zet vinkjes én die twee velden terug. (Feit: de
  knop Klaar is in de huidige code grijs zolang niets is afgevinkt, `disabled={busy || done === 0}`;
  deze spec verandert dat niet.)
- **Zonder weekplan**: de lijst toont extra's + vaste regels (geen Maak-de-lijst-stap nodig: een vaste
  regel komt bij toevoegen meteen in de lijst, zie §3 repo). De key `shop.noPlan` bestaat al (nu: NL
  "… wat je toevoegt en wat elke week meegaat." · EN "… what you add and what goes every week.") en
  krijgt deze nieuwe tekst — NL "Geen weekplan. Dit is je losse boodschappenlijst: wat je toevoegt en
  je vaste lijst." · EN "No week plan. This is your plain shopping list: what you add plus your
  every-week list." Geen nieuwe key.
- **Deel lijst / Kopieer als tekst / Print**: ongewijzigd; vaste regels gaan vanzelf mee (ze staan in
  `items`), "in huis" en aantal 0 blijven weg zoals nu. Een lijst met alleen vaste regels heeft geen
  "— gerechten"-regel.
- **Eerste keer na de update**: `migratePinsToStanding()` zet bestaande pins om; als er iets verhuisde
  één snack `shop.standing.migratedSnack` — NL "{n} ‘Elke week’-regels staan nu op de vaste lijst" ·
  EN "{n} ‘Every week’ lines are now on the Every week list" (n = 1: NL "1 ‘Elke week’-regel staat nu
  op de vaste lijst" · EN "1 ‘Every week’ line is now on the Every week list", key
  `shop.standing.migratedSnackOne`).
- **Opslag & back-up → Inhoud**: nieuwe telregel `storage.standing` — NL "Vaste lijst (regels)" · EN
  "Every week (lines)".
- Te verwijderen i18n-keys (beide talen; alle vijf bestaan nu in src/i18n/shopping.ts): `shop.menu.pin`,
  `shop.menu.unpin`, `shop.pinnedSnack`, `shop.unpinnedSnack`, `shop.pinned` (die laatste gebruikt
  ListRow nu nog). Alle nieuwe keys komen in `src/i18n/shopping.ts` (ook `storage.standing`, naast de
  bestaande `storage.list`/`storage.pantry` daar). Gecontroleerd 22 okt: geen enkele `shop.standing.*`-,
  `shop.tab.*`-, `shop.menu.toStanding*`- of `shop.menu.fromStanding`-key bestaat al; `common.close`
  en `shop.menu.inHouse` / `shop.menu.needed` / `shop.menu.adjust` bestaan.

## 2. Datamodel en migraties

**Opslag: één setting, geen nieuwe Dexie-versie.** Dexie blijft **v7** (src/db/db.ts: de laatste is nog
`db.version(7)` met de tabel `events`; gecontroleerd 22 okt); er komt géén eigen `db.version(...)` en geen
tabel, dus deze spec botst niet met de voorlopige v8 (inbouwen) / v9 (varianten-tabs) van andere specs.
De vaste lijst is de setting `'standing.list'` (constante `STANDING_LIST_KEY` in repo.ts), net als
`household` één per telefoon = "per huishouden" in Stijns zin. Klein (tientallen regels),
`useLive(getStandingList, [])` (src/db/live.ts) werkt omdat `getSetting` (src/db/db.ts) via `db.settings`
leest, en de setting reist vanzelf mee in de back-up (`exportBundle` neemt alle settings behalve
`dataVersion` mee in `BackupBundle.settings`) en per kanaal (invariant 12: de database is al per base-path).

```ts
// src/domain/standing.ts (nieuw, framework-vrij; imports met .ts-extensie zoals de rest van src/domain:)
import type { Dictionary, Ingredient } from './dictionary.ts';
import { effectiveQty, renderListItem, type ListItem } from './aggregate.ts';
import { pickText, randomId, type Lang, type Text } from './model.ts';
export interface StandingItem {
  /** 's:' + 8 tekens [a-z0-9] (randomId('s:')). Nooit wijzigen. */
  id: string;
  /** Woordenboek-id, of null voor vrije tekst. */
  ing: string | null;
  /** Vrije tekst als ing null is; {nl,en}, één kant mag leeg zijn (invariant 3). */
  label?: Text;
  /** Standaardaantal in weergave-eenheden; null = geen getal ("melk"). Nooit 0. */
  qty: number | null;
  /** Eenheid-id, meestal uit STANDING_UNITS; null = stuks. Een getypte of overgenomen eenheid daarbuiten
   *  ('el', 'dl', 'bos') blijft staan (besluit C); normalizeStandingList eist alleen string | null. */
  unit: string | null;
  /** Gangpad-id, vastgelegd bij toevoegen: van het woordenboekitem, of (vrije tekst) wat ExtraField
   *  meegeeft ('overig', of het gangpad van een bijna-treffer: "doos eieren" → 'zuivel-eieren'). */
  aisle: string;
  /** false = "Even niet meenemen": blijft bewaard, komt niet op de lijst. */
  enabled: boolean;
  addedAt: string;
}
export interface StandingList { v: 1; items: StandingItem[]; updatedAt: string }
/** Eenheden van het bewerkvenster, in deze volgorde; ids bestaan allemaal in data/units.json. */
export const STANDING_UNITS: readonly (string | null)[] = [null, 'pot', 'pak', 'fles', 'zak', 'blik', 'g', 'kg', 'ml', 'l'];
/** Stap van de stepper in het bewerkvenster (besluit A); alles wat hier niet staat → 1. */
export const STANDING_STEP: Readonly<Record<string, number>> = { l: 1, kg: 0.5, g: 50, ml: 100 };
export function standingStep(unit: string | null): number; // STANDING_STEP[unit ?? ''] ?? 1
```

**Lijstregel van een vast item** (in `List.items`, naast de bestaande regels): key `'s|' + id.slice(2)`
(zoals `addExtra` doet met `'x|' + newUserId().slice(2)`), `ing`/`label`/`qty`/`unit`/`aisle` uit het
item, `section: 'main'`,
`sources: []`, en het nieuwe veld op `ListItem` (src/domain/aggregate.ts):
```ts
  /** True for a line that comes from the standing list ("Vaste lijst"): key 's|…', never summed with recipe lines, "Heb ik al" is its own flag (never the pantry). */
  standing?: boolean;
```
Per-lijst-toestand van een vaste regel = de bestaande velden `checked`, `inHouse`, `adjusted` op die
regel. `pinned` blijft als veld bestaan (op `ListItem` en als `List.pinned: string[]` in src/db/model.ts,
dat `saveList` uit de items afleidt; oude back-ups bevatten het) maar wordt nergens meer gezet.

**Standaardeenheid** `defaultStandingUnit(ing: Ingredient | undefined): string | null`: (1) `ing.buyUnit`
als die in STANDING_UNITS staat (pindakaas → 'pot'); anders (2) de eerste sleutel van `ing.gramsPer`
waarvan `dict.unit(id)?.group === 'package'` en die in STANDING_UNITS staat (boter → 'pak') — hiervoor
krijgt de functie `dict: Dictionary` mee; anders (3) via `defaultUnit`: 'ml' → 'l', 'g' → 'g', 'kg' →
'kg', 'l' → 'l', alles anders (stuk, snee, el, tl, teen, null, onbekend ing) → null (stuks).
Data gecontroleerd 22 okt (data/ingredients.json, data/units.json): pindakaas `buyUnit: 'pot'` → 'pot';
boter `gramsPer: { el, klont, pak }` → 'pak' (el = volume, klont = pinch, pak = package); melk
`defaultUnit: 'ml'` → 'l'; ei `defaultUnit: 'stuk'` → null; kaas `buyUnit: 'stuk'` (count) en
`defaultUnit: 'g'` → 'g'; mayonaise heeft geen buyUnit en `defaultUnit: 'el'` → null; wc-papier
`defaultUnit: 'pak'` → null (regel 3 kent pak niet). Alle tien ids van `STANDING_UNITS` bestaan; pot/pak/
fles/zak/blik zijn group `package` (EN jar/pack/bottle/bag/tin).

**Migratie van de "Elke week"-pins** = pure functie `absorbPins(standing, list, now)` (§3) en de
repo-wrapper `migratePinsToStanding()`. Regels: per `ListItem` met `pinned: true` in `list.items` of
`list.extras`: (a) maak een StandingItem via `standingFromListItem` (ing of label; qty =
`effectiveQty(it)` als > 0 anders null; unit = `it.unit ?? null`; aisle = it.aisle; enabled true);
sla over als er al een vast item met dezelfde `ing` (of, bij vrije tekst, dezelfde genormaliseerde
label-tekst) bestaat; (b) zet de nieuwe regel `s|…` in `items` met `checked`/`inHouse`/`adjusted` van de
oude regel; (c) een **manual** gepinde regel (extra) verdwijnt uit `items` én `extras` (de vaste regel
vervangt hem); een gegenereerde gepinde regel blijft staan maar verliest `pinned` (het recept heeft hem
nog nodig; na de volgende regeneratie verdwijnt hij vanzelf als het recept weg is). **Idempotent**: een
tweede run verhuist 0. Wordt aangeroepen bij mount van ShoppingScreen en aan het begin van
`generateList`, dus ook een oude back-up met pins wordt netjes opgevangen. Stil, behalve de snack van §1d.

**Back-up / herstel**: exporteren gebeurt vanzelf (settings). In `importBundle` krijgt `'standing.list'`
een eigen regel zoals `inbox.seenIds` (de constante `INBOX_SEEN_SETTING` in de settings-lus aan het eind
van de transactie, src/db/repo.ts; die lus doet nu een blanco `db.settings.put` voor alle andere keys):
`mergeStandingLists(normalizeStandingList(lokaal), normalizeStandingList(inkomend))` — vereniging op `id`,
bij gelijke id wint lokaal; een inkomend item met dezelfde `ing` (of dezelfde genormaliseerde
label-tekst) als een lokaal item wordt overgeslagen; `updatedAt` = de nieuwste. Zo wist het terugzetten
van de back-up van de ander jouw vaste lijst niet. `RestoreResult` verandert niet. `weekCounts()` (nu
`Promise<{ plan: number; list: number; pantry: number }>`) krijgt `standing: number` (alle items, ook
uitgezette) voor de telregel. `resetEverything` wist alle tabellen, dus ook deze setting: goed zo.

**Deelformaat**: niet geraakt. De lijst wordt alleen als tekst gedeeld (`listAsText` + `shareText` uit
src/share-actions.ts); `#r/#p/#w/#b/#f` veranderen niet, dus geen nieuwe bevroren tokens in
tests/token.test.ts (invariant 4 blijft zoals hij is; dat moet in de review gecontroleerd, niet "voor de
zekerheid" uitgebreid).

**Voorbeelddata** (echte ids uit data/ingredients.json en data/units.json):
```json
{ "v": 1, "updatedAt": "2026-10-15T18:00:00.000Z", "items": [
  { "id": "s:k3m9x2ab", "ing": "melk", "label": undefined, "qty": 3, "unit": "l", "aisle": "zuivel-eieren", "enabled": true, "addedAt": "2026-10-15T18:00:00.000Z" },
  { "id": "s:q7p1zz0c", "ing": "mayonaise", "qty": 1, "unit": "pot", "aisle": "sauzen-olie-azijn", "enabled": true, "addedAt": "…" },
  { "id": "s:a8b2c3d4", "ing": "pindakaas", "qty": 1, "unit": "pot", "aisle": "brood-ontbijt", "enabled": true, "addedAt": "…" },
  { "id": "s:e5f6g7h8", "ing": null, "label": { "nl": "postzegels", "en": "" }, "qty": null, "unit": null, "aisle": "overig", "enabled": false, "addedAt": "…" }
] }
```
(`label: undefined` betekent: veld weglaten.) Lijstregels daarvan: key `s|k3m9x2ab` → "3 l melk" /
"3 l milk"; `s|q7p1zz0c` → "1 pot mayonaise" / "1 jar mayonnaise"; `s|a8b2c3d4` → "1 pot pindakaas" /
"1 jar peanut butter"; de uitgezette postzegels-regel komt niet in de lijst. (Gangpaden gecontroleerd
22 okt: melk zuivel-eieren, mayonaise sauzen-olie-azijn, pindakaas brood-ontbijt. Gangpadvolgorde in
`dict.aisles` (op `order`): groente-fruit, brood-ontbijt, vlees-vis, zuivel-eieren, kaas, droog,
blik-pot, kruiden-specerijen, sauzen-olie-azijn, wereld, bakken, diepvries, dranken, snacks-zoet,
huishoudelijk, drogisterij, overig.)

## 3. Bestandsverdeling en contracten

### Domein — `src/domain/standing.ts` (nieuw; bouwer A, blok 1)
```ts
export function emptyStandingList(): StandingList;
/** Alles wat in de setting kan staan → geldige StandingList; ongeldige items vallen weg (id/ing/qty/unit/aisle gecontroleerd, qty <= 0 → null, enabled default true). */
export function normalizeStandingList(v: unknown): StandingList;
export function newStandingId(): string;                       // randomId('s:')
export function standingKey(id: string): string;              // 's|' + id.slice(2)
export function isStandingKey(key: string): boolean;          // /^s\|/
export function defaultStandingUnit(ing: Ingredient | undefined, dict: Dictionary): string | null;
/** De lijstregel van een vast item (section 'main', sources [], standing true, aisle 'overig' als leeg). */
export function standingToListItem(s: StandingItem): ListItem;
/** Vast item uit een lijstregel ("Zet op de vaste lijst" en de pin-migratie); null voor section 'check'. Variant-kwalificaties ("rode") vallen weg: het item is het ingrediënt. */
export function standingFromListItem(it: ListItem, now: string): StandingItem | null;
/** Zelfde ingrediënt of (vrije tekst) zelfde genormaliseerde label-tekst in een van beide talen. */
export function findSameStanding(items: readonly StandingItem[], probe: Pick<StandingItem, 'ing' | 'label'>): StandingItem | undefined;
/** Lokaal type (geen import uit src/db): de twee velden van List die absorbPins leest. */
export type ListLike = { items: ListItem[]; extras: ListItem[] };
export function absorbPins(standing: StandingList, list: ListLike, now: string): { standing: StandingList; items: ListItem[]; extras: ListItem[]; moved: number };
export function mergeStandingLists(local: StandingList, incoming: StandingList): StandingList;
export function renderStandingItem(s: StandingItem, dict: Dictionary, lang: Lang): string; // renderListItem(standingToListItem(s))
/** Gangpad-volgorde (dict.aisles) en dan naam (Intl.Collator per taal); uitgezette items achteraan binnen hun gangpad. */
export function sortStandingItems(items: readonly StandingItem[], dict: Dictionary, lang: Lang): StandingItem[];
```
`List` type-import uit `../db/model` is NIET toegestaan in het domein (framework-vrij): daarom het lokale
`ListLike` hierboven (de repo geeft gewoon de `List` mee; die past erop). Normalisatie van label-tekst:
dezelfde `normalize` als ExtraField (de functie `normalize` in src/components/ExtraField.tsx: NFKD,
accenten weg, lowercase, trim) — kopieer die regels, niet importeren uit een component. (Feit 22 okt: de
domeinfunctie `normalizeKey` uit src/domain/dictionary.ts doet méér, o.a. witruimte samenvoegen en een
punt aan het eind weghalen; de spec kiest de ExtraField-versie, dus niet `normalizeKey` gebruiken.)

### Domein — `src/domain/aggregate.ts` (bestaand; bouwer B, blok 1)
Gecontroleerd 22 okt: sinds 15 okt is hier alleen `amountText` veranderd (Engelse weergave van "2 dl"
rekent om); `ListItem`, `AggregateInput`, `aggregate`, `carry`, `stillInHouse`, `effectiveQty`,
`adjustStep(unit: string | null, qty: number): number`, `renderListItem(it, dict, lang)`,
`groupByAisle(items, dict, lang)` en `listAsText(items, dict, lang, { title, hideChecked?, hideInHouse? })`
zijn zoals deze spec ze noemt.
- `ListItem.standing?: boolean` (zie §2) en `AggregateInput.standing?: ListItem[]` met doc
  "Standing-list lines (`standingToListItem`), enabled only; included like extras, never summed".
  Werk ook de doc van `ListItem.key` bij ("'s|<id>' for standing-list lines").
- Nieuwe lus ná de extras-lus (`for (const x of i.extras)`) en vóór "Vanished keys drop unless manual or
  pinned": per `s` uit `i.standing ?? []`: sla over als
  `seen.has(s.key)`; `it = { ...s, standing: true, section: 'main', sources: [] }`; `carry(it, prev)`;
  `if (prev?.inHouse) { it.inHouse = true; it.section = 'inHouse'; }` (eigen vlag, nooit `i.pantry`);
  `if (hadPrevious && !prev) it.fresh = true`; `seen.add`; `route(it)`. Een vorige `s|`-regel die niet
  meer in `standing` staat valt weg via de bestaande "vanished"-regel (niet manual, niet pinned).
- `renderListItem`: de regel ``if (!it.manual) parts.push(`(${PM[lang]})`)`` (tak `eff === null`) wordt
  `if (!it.manual && !it.standing)`. (Nagespeeld 22 okt: een regel melk zonder aantal en zonder
  `manual` geeft nu "melk (pm)"; met de wijziging "melk".)
- `listAsText` en `groupByAisle`: ongewijzigd (werken al op `items`).

### Database — `src/db/repo.ts` en `src/db/model.ts` (bestaand; bouwer C, blok 1)
model.ts (alleen types, geen runtime-imports, want landing.ts gebruikt het ook): `export type {
StandingItem, StandingList } from '@/domain/standing';`. repo.ts, nieuw blok
`// --- Standing list ("Vaste lijst", docs/specs/vaste-lijst.md)` na `// --- Pantry ("Heb ik al")` (dus
na `clearPantry` en vóór `weekCounts`). Bestaande bouwstenen die je gebruikt (gecontroleerd 22 okt):
`getSetting`/`setSetting` (uit ./db, door repo.ts al her-geëxporteerd), `getList()`, `saveList(list)`, de
private `updateList(fn)` (eigen `db.transaction('rw', db.lists, …)`; maakt met `newList()` een lijstrij
als die er niet is), `setListItem(key, patch)`, `removeExtra(key)`, `restoreListItem(item)`, `generateList(dict)`,
`clearChecks()`, `weekCounts()`, `importBundle(b)`:
```ts
export const STANDING_LIST_KEY = 'standing.list';
export async function getStandingList(): Promise<StandingList>;                 // normalizeStandingList(await getSetting(KEY, null)); gooit nooit
export type NewStandingItem = Pick<StandingItem, 'ing' | 'qty' | 'unit' | 'aisle'> & Partial<Pick<StandingItem, 'label' | 'enabled'>>;
/** Voegt toe (id/addedAt hier). Bestaat hetzelfde ingrediënt / dezelfde tekst al (findSameStanding): geef dat item terug, verander niets. Zet meteen de regel 's|…' in de huidige lijst (updateList; maakt de lijstrij aan als die er niet is) tenzij enabled false. */
export async function addStandingItem(input: NewStandingItem): Promise<StandingItem>;
export type StandingPatch = Partial<Pick<StandingItem, 'qty' | 'unit' | 'enabled'>>;
/** qty/unit ook op de lijstregel zetten en daar `adjusted` wissen; enabled false → regel uit items; enabled true → regel erin als hij ontbreekt. */
export async function updateStandingItem(id: string, patch: StandingPatch): Promise<void>;
/** Haalt het item én zijn regel weg; geeft het item terug voor Ongedaan. */
export async function removeStandingItem(id: string): Promise<StandingItem | undefined>;
export async function restoreStandingItem(item: StandingItem): Promise<void>;    // item terug + regel terug (als enabled)
/** "Zet op de vaste lijst" vanaf een lijstregel: standingFromListItem → addStandingItem; een manual extra verdwijnt uit items én extras (de nieuwe regel neemt checked/inHouse/adjusted over); een gegenereerde regel blijft. undefined voor een 'check'-regel of een regel die al standing is. */
export async function addLineToStanding(key: string): Promise<StandingItem | undefined>;
/** "Ook voortaan": qty van het vaste item := effectiveQty(regel) (null als 0), regel.qty idem, regel.adjusted weg. No-op als de regel niet standing is. */
export async function adoptStandingAdjustment(key: string): Promise<void>;
/** absorbPins over getStandingList() + getList(); schrijft beide alleen als moved > 0; geeft moved terug. */
export async function migratePinsToStanding(): Promise<number>;
```
Alle schrijfacties in één `db.transaction('rw', db.settings, db.lists, …)`. Wijzigingen aan bestaande
functies: `generateList` roept eerst `migratePinsToStanding()` aan en geeft
`standing: (await getStandingList()).items.filter((s) => s.enabled).map(standingToListItem)` mee aan
`aggregate`; `clearChecks` wist bij `it.standing` ook `inHouse` en `adjusted` (doc-comment bijwerken);
`weekCounts` geeft `standing` terug; `importBundle` krijgt de merge-regel uit §2; `togglePinned` wordt
verwijderd (geen aanroepers meer na blok 2 — in blok 1 blijft hij bestaan, blok 2 haalt hem weg).

### UI — blok 2 en 3
- `src/components/StandingSheet.tsx` (nieuw; blok 2, bouwer A): props
  `{ item: StandingItem | null; dict: Dictionary; lang: Lang; onPatch(id, patch: StandingPatch); onRemove(item); onClose() }`.
  `item === null` → rendert niets. Opbouw (§1c): `<SheetPortal>` → `.sheet-backdrop no-print`
  (onClick = `onClose`) → `.sheet.standing-sheet` (`role="dialog"`, `aria-modal="true"`, `aria-label` =
  naam, onClick `stopPropagation`) → `.sheet-head.with-actions` (lege `span.sheet-head-btn` links, `<h2>`,
  rechts `button.sheet-head-btn.save` = `common.close` met `ref` voor de focus) → `.sheet-body`. Escape =
  `onClose` (keydown-listener zoals VariantSheet). Geen `sheet-grab`/veeggebaar nodig.
- `src/components/StandingTab.tsx` (nieuw; blok 2, bouwer B): het tabblad van §1b, leest
  `useLive(getStandingList, [])`, bezit het ExtraField-gebruik en de sheet-staat, krijgt `showSnack` als
  prop `{ onSnack(text, undo?) }` van ShoppingScreen (zelfde vorm als de bestaande
  `showSnack(text: string, undo?: () => void | Promise<void>)` daar). `ExtraField` (bestaande props
  `previous: readonly ListItem[]` en `onAdd(item: Partial<ListItem>)`) krijgt één optionele prop
  `placeholder?: string` (standaard de huidige `t('shop.addPlaceholder')`). StandingTab zet in `onAdd`
  het ExtraField-item om naar `NewStandingItem`: `ing: item.ing ?? null`, `label` (alleen bij vrije
  tekst), `aisle: item.aisle || 'overig'`, `unit: item.unit ?? (item.ing ? defaultStandingUnit(dict.get(item.ing), dict) : null)`,
  `qty: item.qty ?? (item.ing ? 1 : null)` (besluit B); een eenheid buiten `STANDING_UNITS` blijft staan
  (besluit C), en roept `addStandingItem` aan.
- `src/screens/ShoppingScreen.tsx` (bestaand; blok 2 bouwer C + blok 3 bouwer B): `Mode` (nu
  `'list' | 'proto'`) wordt `'list' | 'proto' | 'standing'`; tabbladen; `?tab=standing` (lees
  `route.value.query.get('tab')`, zoals `proto` nu); menu-items van §1d; `setHave` (roept nu
  `setInHouse` aan als `it.ing`) roept `setInHouse` alleen aan als `it.ing && !it.standing` (ook in de
  undo); `pin()` (nu `togglePinned` + `shop.pinnedSnack`) → `toStanding()` / `fromStanding()`; mount-effect
  `void migratePinsToStanding().then(n => n > 0 && showSnack(...))`. Werk ook de kopcommentaar van het
  bestand bij (noemt nu "Elke week"-pins). Let op: ook de kookbalk-spec (docs/specs/kookbalk.md, 13K)
  raakt dit bestand (een regel direct onder `<Header>`); wie later bouwt, voegt in.
- `src/components/StandingProtoRow.tsx` (nieuw; blok 3, bouwer A): props
  `{ item: ListItem; dict; lang; onAdjust(item, adjusted: number | undefined); onHave(item); onKeep(item) }`;
  rendert `ProtoRow` + knopregel (Heb ik al · Ook voortaan alleen als `typeof item.adjusted === 'number' && item.adjusted !== 0`).
  Feit 22 okt: `ProtoRow` (src/components/ProtoRow.tsx, props `{ item, dict, lang, onAdjust, sourcesOpen?, onTap? }`)
  rendert zelf een `<li class="pr">`. StandingProtoRow geeft daarom een fragment terug:
  `<><ProtoRow …/><li class="spr-actions">…knoppen…</li></>`, binnen dezelfde `<ul class="list">`.
  ProtoRow zelf verandert niet.
- `src/components/ListRow.tsx` (blok 3): het 📌 (`span.lr-pin`, nu `{item.pinned && …}` met title en
  aria-label `t('shop.pinned')`) toont bij `item.standing` (i.p.v. `item.pinned`) met
  `shop.standing.badge`; werk de kopcommentaar bij (noemt nu "Elke week" in het menu).
- `src/i18n/shopping.ts`, `src/styles/shopping.css` (klassen `.standing-*`, `.spr-actions`),
  `src/screens/StorageScreen.tsx` (telregel: in de `<dl>` onder **Inhoud** (`storage.counts`), na
  `storage.pantry`: `<dt>{t('storage.standing')}</dt><dd>{show(week?.standing)}</dd>`, `week` =
  `useLive(weekCounts, [])` bestaat al), `src/components/WeekCard.tsx` + `src/i18n/browse.ts` (alleen de
  lege-staat-link `home.weekEmptyStanding`, besluit D): blok 2 bouwer C; `docs/DEVICE-TEST.md`,
  `docs/STATUS.md`: de integrator van elk blok.
- Integrator per blok: `npm run check`, `npm test`, `npm run build`, `npm run build:next`; smoke in de
  dev-app (§6 acceptatiechecks); geen andere bestanden aanraken dan hierboven.

## 4. Stappenplan (elk blok apart online)

**Blok 1 — model, aggregate, repo, pin-migratie** (3 bouwers A/B/C uit §3 + integrator). Af als:
`standing.ts` met tests groen; aggregate neemt `standing` mee met tests; repo-API compleet;
ShoppingScreen roept bij mount `migratePinsToStanding()` aan (één regel, met snack); een gepinde regel
verschijnt na de update als `s|`-regel met 📌-icoon (ListRow mag in dit blok `item.pinned || item.standing`
tonen); "Elke week" in het menu bestaat nog (maakt een pin die bij de volgende mount verhuist). Zichtbaar
gedrag voor Stijn: niets breekt, pins blijven elke week komen.

**Blok 2 — beheer-UI** (A StandingSheet, B StandingTab, C ShoppingScreen-tabbladen + i18n + CSS +
Storage-telregel + ExtraField-placeholder; integrator). Af als: tabblad Vaste lijst werkt (toevoegen,
aantal/eenheid, even niet, verwijderen met Ongedaan); menu "Zet op de vaste lijst" / "Haal van de vaste
lijst" vervangt de pin; `togglePinned` en de vijf oude keys zijn weg; `?tab=standing` opent het tabblad;
DEVICE-TEST rij 89 en rij 28 (NL + EN) bijgewerkt: in de menuopsomming wordt
"Elke week" → "Zet op de vaste lijst" / "Every week" → "Put on Every week"; de lege weekkaart op Home
heeft de link "Alleen de vaste lijst ›" (besluit D). De open punten A–D zijn beslist (bovenaan).

**Blok 3 — samenvoegen in de weeklijst** (A StandingProtoRow, B ShoppingScreen proto-blok + Ook
voortaan in de aanpassen-stand + Klaar-undo + ListRow, C tests voor listAsText/clearChecks-gedrag via
aggregate + DEVICE-TEST rijen 90–91; integrator). Af als: het proto-blok staat er
met Heb ik al / Ook voortaan; Klaar reset vaste regels; delen als tekst klopt zonder weekplan; STATUS
bijgewerkt.

Geen van de drie blokken hoeft achter een vlag: blok 1 verandert niets zichtbaars behalve de
pin-verhuizing, blok 2 en 3 zijn elk af als ze online gaan (`main` blijft bruikbaar op beide telefoons).

## 5. Regels en eerlijkheid

- **Invariant 3**: `label` is `{nl, en}`; ExtraField vult alleen de taal van de UI, de andere kant blijft
  leeg — zo laten. **Invariant 4**: geen tokenwijziging; `tests/token.test.ts` blijft onaangeraakt.
  **Invariant 5/9**: niets nieuws op iPhone; delen blijft `shareText` met één veld. **Invariant 12**:
  setting in de Dexie-database → automatisch per kanaal. **Invariant 14/15**: geen backend, geen
  dependency. **Invariant 1** (ids): `s:`-ids en lijst-keys veranderen nooit; "ook voortaan" verandert
  alleen qty.
- **Eerlijk**: de vaste lijst is per telefoon; twee telefoons van één huishouden delen hem alleen via
  back-up/herstel (vereniging). De UI zegt dat nergens als belofte; de handleiding (blok Z) legt het
  uit. "Heb ik al" op een vaste regel wordt bewust NIET onthouden (geen voorraadkast van 3 weken): de
  hint zegt "Alleen deze lijst; niet onthouden."
- **iPhone/Android**: geen verschil in gedrag. Het nieuwe bewerkvenster gaat via `SheetPortal` met de
  knoppen in de kop (13J), omdat op de iPhone de onderkant van een sheet buiten beeld kon vallen; dat
  geldt voor beide telefoons hetzelfde.
- **Afwijking van de Gekookt-regel, bewust**: bij CookedSheet bewaart alleen Bewaar (Stijn 16 okt). Het
  bewerkvenster van de vaste lijst heeft geen Bewaar, omdat elke tik meteen opslaat en er dus nooit iets
  "half" in het venster zit; Sluit/ernaast tikken/Escape sluiten alleen.

**Opus mag dit NIET zelf beslissen (zo doen als hier staat, anders vragen):**
1. Opslag als setting `'standing.list'`; geen Dexie v8, geen tabel.
2. Id-vorm `s:xxxxxxxx`, key `s|xxxxxxxx`, `STANDING_UNITS` en hun volgorde, `defaultStandingUnit`.
3. Vaste regels zijn **aparte regels**, nooit opgeteld bij receptregels of extra's (zoals extra's nu).
4. Vaste regels negeren de voorraadkast in beide richtingen (geen `setInHouse`, geen `pantry.has`).
5. "Klaar" reset `inHouse` + `adjusted` van vaste regels; nergens anders een "nieuwe week"-moment.
6. Het veld `pinned` blijft in de types en in de aggregate-regel; alleen het zetten ervan verdwijnt.
7. Migratie idempotent, bij mount én in `generateList`, stil behalve de ene snack.
8. Geen dubbele items op de vaste lijst (`findSameStanding`), ook niet via herstel (`mergeStandingLists`).
9. Alle teksten letterlijk uit §1 (NL en Brits-Engels; "Every week" is de Engelse naam van het tabblad).
10. Eén Home-wijziging, niet meer: de lege-staat-link `home.weekEmptyStanding` in WeekCard.tsx (besluit D);
    geen badges (6D), geen nieuwe route.
11. Proto-blok ná de gangpadsecties, vóór Voorraad; in de lijst zelf in het gangpad.
12. ExtraField hergebruiken (met `placeholder`-prop), geen tweede invoercomponent.
13. De open punten A–D zijn door de kritische lezer beslist (bovenaan); zo bouwen, niet heroverwegen.
14. `StandingSheet` volgt het 13J-patroon (`SheetPortal`, knoppen in de kop); geen eigen Bewaar-knop en
    geen Bewaar onderaan erbij verzinnen.

## 6. Testplan

**tests/standing.test.ts** (nieuw; echte dictionary via `defaultDictionary()` zoals aggregate.test.ts):
- normalizeStandingList: `null`/`{}`/`[]` → leeg; item zonder id of met qty 0 → qty null; `enabled`
  ontbreekt → true; onbekende velden vallen weg; `v` altijd 1.
- defaultStandingUnit: pindakaas → 'pot'; boter → 'pak'; melk → 'l'; ei → null; kaas (buyUnit 'stuk',
  niet in de lijst; defaultUnit 'g') → 'g'; undefined → null.
- standingStep: 'l' → 1; 'kg' → 0,5; 'g' → 50; 'ml' → 100; 'pot' → 1; null → 1; 'el' → 1.
- normalizeStandingList laat `unit: 'el'` staan (besluit C) en maakt `unit: 7` → null.
- standingToListItem: key `s|…`, section 'main', standing true, sources [], aisle 'overig' bij ''.
- standingFromListItem: receptregel "4 uien" met adjusted +2 → qty 6, unit null; extra zonder
  woordenboek-id (`ing: null`, label "postzegels") → label behouden; extra "wc-papier" (staat sinds kort
  in het woordenboek: `ing: 'wc-papier'`) → `ing` behouden, geen label; voorraadregel op 0 → qty null;
  'check'-regel → null; variant 'rode' valt weg.
- findSameStanding: zelfde ing; label "Postzegels" vs "postzegels" (en ook via de andere taal).
- absorbPins: gepinde extra → uit items+extras, `s|`-regel met checked/inHouse/adjusted; gepinde
  receptregel → blijft, pinned weg; tweede run moved 0; zonder pins identiek resultaat.
- mergeStandingLists: vereniging op id, lokaal wint, inkomend zelfde ing overgeslagen, updatedAt max.
- renderStandingItem: "3 l melk" / "3 l milk"; "1 pot mayonaise" / "1 jar mayonnaise"; "2 potten
  mayonaise" / "2 jars mayonnaise"; "200 g boter" / "200 g butter"; "melk" (geen "(pm)"); "postzegels".
- sortStandingItems: zuivel vóór overig; uitgezet achteraan binnen het gangpad.

**tests/aggregate.test.ts** (uitbreiden, describe 'standing lines'): vaste regel komt in main met
`standing: true` en in gangpadvolgorde; recept "250 ml melk" + vaste "3 l melk" = twee regels; carry van
checked/adjusted/inHouse op `s|`-key; `pantry` met 'mayonaise' maakt de vaste regel NIET in huis;
verdwenen vaste regel valt weg; `renderListItem` vaste regel zonder aantal → geen "(pm)"; `listAsText`
neemt vaste regels mee, laat in-huis weg met `hideInHouse`, en heeft geen "— …"-regel bij alleen vaste
regels.

**Acceptatiechecks in de dev-app** (`npm run dev`, Chrome, Android-breedte 360 px; ook 375 px):
1. Boodschappen → Vaste lijst → typ "2 melk" → Enter → regel "2 l melk" onder Zuivel & eieren. Typ
   "200 gram boter" → Enter → "200 g boter" onder Zuivel & eieren (getypte eenheid blijft; §1b).
2. Tik op "2 l melk" → het venster heeft bovenaan rechts **Sluit** en geen Bewaar; eenheid staat op l;
   één tik op + → de regel zegt "3 l melk" (stap 1 l, besluit A). Tik − tot "zonder aantal". Ernaast
   tikken sluit; de wijziging is bewaard.
3. Typ "mayonaise" → kies het woordenboekitem → "1 mayonaise" (besluit B: woordenboekkeuze zonder getal =
   1; mayonaise heeft geen standaardeenheid in de lijst); open, kies eenheid pot → "1 pot mayonaise".
4. Deze week zonder weekplan: beide regels staan in de lijst; afvinken werkt; Deel lijst toont ze zonder
   "— gerechten"-regel.
5. Week → 2 gerechten → Boodschappenlijst maken: proto toont blok Vaste lijst onder de gangpaden;
   Heb ik al op melk → melk staat bij In huis; + op mayonaise → Ook voortaan verschijnt; tik → snack
   "Nieuw standaardaantal: 2 potten mayonaise" en in het tabblad Vaste lijst staat "2 potten mayonaise".
6. Bevestig lijst → vink één regel af (Klaar is grijs zolang niets is afgevinkt) → Klaar → de lijst
   toont melk weer gewoon (niet in huis) met standaardaantal.
7. Houd een receptregel vast → Zet op de vaste lijst → staat in het tabblad; Haal van de vaste lijst
   via de vaste regel → weg, Ongedaan brengt hem terug.
8. Opslag: maak back-up, verwijder een vast item, Herstel → het item is terug, geen dubbelen.
9. `npm run check`, `npm test`, `npm run build`, `npm run build:next` groen; in de /next/-build een eigen
   database (geen vaste lijst van main te zien).

**DEVICE-TEST-rijen** (toevoegen onder rij 69, in beide taalsecties; als één tabelrij per nummer, met de
kolommen nummer · wat je doet · goed als; de nummers 89–91 zijn definitief).

Rij 89 — NL: **Vaste lijst beheren (fase 6, blok 6C).** 1. Tik onderaan op **Boodschappen**. Tik bovenaan
op **Vaste lijst**. 2. Typ in het vak *2 melk* en tik op **+**. 3. Tik op de regel *2 l melk*. Tik één
keer op **+**. Tik bovenaan rechts op **Sluit**. 4. Typ *mayonaise* en kies het woord uit het lijstje.
Tik op de regel en kies bij **Eenheid** *pot*. Tik op **Sluit**. 5. Tik op de regel *1 pot mayonaise* en
tik op **Even niet meenemen**. Tik naast het venster. 6. Tik op **Deze week**. | Goed als: 1. Je ziet een
grijze uitlegzin, een vak "+ 1 pot mayonaise, 2 l melk …" en de tekst "Nog niets. Typ hierboven …".
2. Onder het kopje **Zuivel & eieren** staat *2 l melk*. 3. Het venster heeft bovenaan de naam *melk*
en rechts **Sluit** (geen Bewaar). Het toont **Standaardaantal** met − en +, en **Eenheid** met knopjes
(stuks, pot, pak …); na Sluit staat er *3 l melk*.
4. Na het kiezen staat er *1 mayonaise*, na *pot* staat er *1 pot mayonaise* onder **Sauzen,
olie & azijn**. 5. Het venster gaat dicht; de regel is grijs met "(staat uit)". 6. In de lijst staat de
melkregel met een 📌 erachter; mayonaise staat er niet.
Rij 89 — EN: **Manage Every week (phase 6, block 6C).** 1. Tap **Shopping** at the bottom. Tap **Every
week** at the top. 2. Type *2 milk* in the box and tap **+**. 3. Tap the line *2 l milk*. Tap **+** once.
Tap **Close** at the top right. 4. Type *mayonnaise* and pick the word from the list. Tap the line and
under **Unit** choose *jar*. Tap **Close**. 5. Tap the line *1 jar mayonnaise* and tap **Skip for now**.
Tap next to the panel. 6. Tap **This week**. | Good when: 1. You see a grey explanation, a box "+ 1 jar
mayonnaise, 2 l milk …" and the text "Nothing yet. Type above …". 2. Under the heading **Dairy & eggs**
it says *2 l milk*. 3. The panel has the name *milk* at the top and **Close** on the right (no Save). It
shows **Usual amount** with − and +, and **Unit** with pills (pieces, jar, pack …); after Close the line
says *3 l milk*. 4. After picking it says *1 mayonnaise*; after *jar* it says *1 jar mayonnaise* under
**Sauces, oil & vinegar**.
5. The panel closes; the line is grey with "(paused)". 6. The list shows the milk line with a 📌 after
it; mayonnaise is not there.

Rij 90 — NL: **Vaste lijst in de weeklijst: Heb ik al en Ook voortaan (fase 6, blok 6C).** 1. Zet in
**Vaste lijst** mayonaise weer aan (tik op de regel → **Weer meenemen** → **Sluit**). 2. Tik onderaan op
**Week**, kies twee gerechten en tik op **Boodschappenlijst maken**. 3. Scrol naar het blok **Vaste
lijst**. Tik bij de melkregel op **Heb ik al**. 4. Tik bij *1 pot mayonaise* op **+** en dan op **Ook
voortaan**. 5. Tik op **Bevestig lijst**. Staat melk bij **In huis**? Tik dan eerst op die regel. Houd
daarna de melkregel vast. Tik naast het menu. 6. Tik op een andere regel om hem af te vinken (**Klaar**
werkt pas als er iets is afgevinkt). Tik op **Klaar**. | Goed als: 3. Melk verhuist naar het blok **In
huis**; de uitleg zegt dat dit alleen voor deze lijst geldt. 4. Er komt een melding "Nieuw
standaardaantal: 2 potten mayonaise"; in het tabblad **Vaste lijst** staat nu *2 potten mayonaise*.
5. Het menu toont **Heb ik al** / **Toch nodig** met "Alleen deze lijst; niet onthouden.", **Aantal
aanpassen** en **Haal van de vaste lijst**; er is geen **Verwijder** en geen **Waarvoor is dit?**.
6. Melk staat weer gewoon in de lijst (niet bij In huis) met hetzelfde aantal als in het tabblad **Vaste
lijst**.
Rij 90 — EN: **Every week inside the weekly list: Already have it and Also from now on (phase 6,
block 6C).** 1. In **Every week** switch mayonnaise back on (tap the line → **Include again** →
**Close**). 2. Tap **Week** at the bottom, pick two dishes and tap **Make the shopping list**. 3. Scroll to
the block **Every week**. At the milk line tap **Already have it**. 4. At *1 jar mayonnaise* tap **+**
and then **Also from now on**. 5. Tap **Confirm list**. Is milk under **In stock**? Then tap that line
first. Then hold the milk line. Tap next to the menu. 6. Tap another line to tick it (**Done** only works
once something is ticked). Tap **Done**. | Good when: 3. Milk moves to the block **In stock**; the
explanation says this counts for this list only. 4. A message says "New usual amount: 2 jars
mayonnaise"; the **Every week** tab now says *2 jars mayonnaise*. 5. The menu shows **Already have it** /
**Need it after all** with "This list only; not remembered.", **Adjust amount** and **Take off Every
week**; there is no **Remove** and no **What is this for?**. 6. Milk is back in the list (not under In
stock) with the same amount as in the **Every week** tab.

Rij 91 — NL: **Vaste lijst zonder weekplan, delen en back-up (fase 6, blok 6C).** 1. Tik op **Week** en
haal alle gerechten weg. Tik op **Boodschappen**. Staat er **Weekplan gewijzigd**? Tik dan op
**Bijwerken**. 2. Tik op **Deel lijst** en lees de voorbeeldtekst. 3. Typ *wc-papier* in het vak en tik
op **+**. Houd de regel *wc-papier* vast en tik op **Zet op de vaste lijst**. 4. Ga naar **Meer →
Opslag & back-up** en lees onder **Inhoud** de regel **Vaste lijst
(regels)**. 5. Maak een back-up (**Bewaar of deel → Download**). Verwijder in **Vaste lijst** één regel.
Tik op **Herstel** en kies de back-up. | Goed als: 1. Boven de lijst staat "Geen weekplan. Dit is je
losse boodschappenlijst: wat je toevoegt en je vaste lijst." en de vaste regels staan er met 📌.
2. De tekst begint met "🛒 Boodschappen wk …", noemt de vaste regels per gangpad en heeft geen regel
die met "—" begint. 3. De regel krijgt een 📌 en staat in het tabblad **Vaste lijst**. 4. Het getal klopt
met het aantal regels in het tabblad. 5. De verwijderde regel is terug en niets staat dubbel.
Rij 91 — EN: **Every week without a week plan, sharing and backup (phase 6, block 6C).** 1. Tap **Week**
and remove all dishes. Tap **Shopping**. Does it say **Week plan changed**? Then tap **Update**. 2. Tap
**Share list** and read the preview text. 3. Type *toilet roll* in the box and tap **+**. Hold the line
*toilet roll* and tap **Put on Every week**. 4. Go to **More →
Storage & backup** and under **Contents** read the line **Every week (lines)**. 5. Make a backup
(**Save or share → Download**). In **Every week** remove one line. Tap **Restore** and pick the backup.
| Good when: 1. Above the list it says "No week plan. This is your plain shopping list: what you add
plus your every-week list." and the every-week lines are there with 📌. 2. The text starts with
"🛒 Shopping wk …", lists the every-week lines per aisle and has no line starting with "—". 3. The line
gets a 📌 and appears in the **Every week** tab. 4. The number matches the lines in that tab. 5. The
removed line is back and nothing is doubled.

## 7. Controlelijst voor Fable (eindcontrole)

1. `db.ts` ongewijzigd (nog v7); `standing.list` alleen via `getSetting`/`setSetting` in repo.ts.
2. `standing.ts` importeert niets uit preact/dexie/db; `aggregate.ts` importeert niets uit standing.ts.
3. Geen enkele aanroep van `setInHouse` of `pantry.has` voor `it.standing` (grep).
4. `clearChecks` wist bij standing-regels `inHouse` + `adjusted`; de undo van Klaar zet ze terug.
5. `absorbPins` idempotent (test) en aangeroepen bij mount én in `generateList`; oude `pinned`-regels
   uit een teruggezette back-up leveren geen dubbele regels op.
6. `importBundle`: `standing.list` via `mergeStandingLists`, niet via de blanco `settings.put`.
7. `renderListItem`: vaste regel zonder aantal toont geen "(pm)"; "1 pot mayonaise" / "1 jar mayonnaise"
   en "2 potten mayonaise" / "2 jars mayonnaise" kloppen via `unitLabel` (meervoud).
8. Vaste regels en receptregels van hetzelfde ingrediënt staan als twee regels; delen-als-tekst toont
   beide; `hideInHouse` laat een vaste "in huis"-regel weg.
9. Alle keys uit §1 bestaan in NL én EN; de vijf pin-keys zijn weg; `togglePinned` is weg; geen
   verwijzing naar `shop.menu.pin` meer (grep in src); in docs/DEVICE-TEST.md noemt rij 28 (NL + EN)
   niet meer "Elke week" / "Every week" als menuknop maar "Zet op de vaste lijst" / "Put on Every week".
10. `?tab=standing` werkt vanuit het proto-blok; `?proto=1` toont geen tabbladen; Week/Home-links
    ongewijzigd.
11. ExtraField heeft alleen de `placeholder`-prop erbij; het gewone gebruik in de lijst is ongewijzigd.
12. Tests: standing.test.ts + aggregate-uitbreiding aanwezig; `tests/token.test.ts` en de bevroren
    tokens onaangeraakt; check/test/build/build:next groen.
13. `StandingSheet` staat in `<SheetPortal>` met `.sheet-head.with-actions` (Sluit rechts in de kop,
    geen Bewaar, geen knoppen onderaan nodig); 360 px: tabbladen, sheet-stepper en eenheid-pills passen
    zonder horizontaal scrollen; invoer 16 px; knoppen 44 px.
14. DEVICE-TEST rijen 89–91 in beide talen; STATUS.md noemt blok 6C als afgerond met de drie blokken;
    de besluiten A–D (bovenaan) zijn precies zo gebouwd.
15. Teksten: "Every week" consequent als Engelse naam; nergens "standing list" in de UI.

## 8. Open vragen voor Stijn

1. Als een recept hetzelfde ingrediënt nodig heeft als een vaste regel (recept 250 ml melk + vast 3 l
   melk), staan er twee regels (zoals nu bij extra's). Akkoord, of wil je één regel "3,25 l melk"?
   Standaard gebouwd: twee regels.
2. "Heb ik al" op een vaste regel geldt tot je op **Klaar** tikt. Is dat jouw "deze week", of wil je dat
   het óók vervalt bij "Maak de lijst" voor een nieuw weekplan? Standaard gebouwd: alleen Klaar.
