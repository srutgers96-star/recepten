# Spec V7 — Boodschappen-badges over de ingrediënten, met avatar-beloningen (Stijn, 29 okt + 8 nov 2026)

Status: in aanbouw (Fable, 9 nov 2026). Eén blok, vier bouwers + integrator (lichte modus). Bron: docs/IDEAS.md idee 4 (Stijn 29 okt:
"daar kan nog best wat creativiteit in, met 1600 verschillende ingrediënten"; 8 nov: "Heb ik al" telt niet mee, voorzichtig met
badges over die producten, "de nieuwe boodschappen-badges misschien een paar leuke nieuwe items, of linken met bestaande items, in
ieder geval een bril"). Leidend bij tegenspraak: docs/specs/README.md §2–§4, docs/specs/badges-avatar.md (badgeregels, ladders van
precies acht treden, zeldzaamheid, XP per badge: ladder 50 × trede, geheim 250), docs/specs/xp-levels.md, docs/specs/handbook.md §4.

**Kritische lezer (Fable, vooraf).** (1) De feiten bestaan al: `shop.bought.ings` telt per ingrediënt de vinkjes, huishoud-breed en
per lid; "Heb ik al" (in huis) komt er niet in, dus Stijns regel geldt vanzelf. (2) Wat ontbreekt is het moment van een vinkje per
ingrediënt (voor seizoensbadges): één veld erbij, oude data blijft geldig. (3) Voorzichtig met voorraadproducten: geen badge die
bloem, suiker of zout als doel heeft; de ladder Verzamelaar telt alleen ingrediënten die geen `staple` zijn. (4) Een nieuwe
badgegroep "boodschappen" is een tabblad op Badges en een groepsnaam in twee talen; de validator kent de groepenlijst. (5)
Avatar-beloningen hangen aan een badge via `unlock: { part, tier }` op de badge én `unlock: { badge }` op het onderdeel (zo werkt
huiskok → hat-pan al); `hat-cheese` bestaat al (badge kaaskop), dus Kaasmeester krijgt een kaasschaaf. (6) Curve: de twaalf
badges geven over een kookleven hooguit ±5.000 XP (ladder 50 × trede, geheim 250) op een level-100-curve van 1.074.000 XP (< 0,5 %):
geen curve-aanpassing nodig; de integrator noemt het XP-totaal van de nieuwe set in STATUS.

**Feitencheck (Fable, in de code).** `src/domain/shopbought.ts`: `ShopBought { recipes: Record<id, iso>; ings: Record<id, { n, by:
Record<memberId, n> }> }`, `recordBought(state, item, memberId, iso)`, `normalizeShopBought`; repo `SHOP_BOUGHT_SETTING = 'shop.bought'`,
`setListItem` roept `recordBought` aan bij niet-gevinkt → gevinkt. `src/domain/badges.ts`: `BadgeRule` (soorten cookCount, ingredient,
cuisine, category, tag, seasonCooks, weekdayCooks, cookHour, calendar, feature, fullCycle, challenges, letters, …), `Badge { id, nl, en,
icon, rule, group: BadgeGroup, tiers?, hidden?, season?, unlock?, xp? }`, `BadgeFacts` met o.a. `boughtRecipeIds`, `challengesDone`;
`buildFacts(memberId | 'all', withXp)` in src/badges.ts leest de settings. data/badges.json: 152 badges, groepen koken 39 ·
ontdekken 33 · geheim 27 · keukens 18 · seizoenen 13 · samen 11 · reeksen 7 · foto 4; ladder = `tiers` van acht; `unlock: { part,
tier }`. data/aisles.json: bakken, blik-pot, brood-ontbijt, diepvries, dranken, drogisterij, droog, groente-fruit, huishoudelijk,
kaas, kruiden-specerijen, overig, sauzen-olie-azijn, snacks-zoet, vlees-vis, wereld, zuivel-eieren; ingredients.json heeft per
product `aisle` en `staple`. Avatar-onderdelen met `unlock: { badge }` bestaan (eyes-star ← sterrenregen).

## 1. Gedrag

### 1a. Feiten en regels (bouwer A: `src/domain/shopbought.ts`, `src/domain/badges.ts`, `src/badges.ts` (alleen `buildFacts`), `tests/shopbought.test.ts`, `tests/badges.test.ts`)

- `BoughtIngredient` krijgt `first?: Record<memberId, string>` (ISO van het eerste vinkje per lid; `recordBought` zet het alleen als het
  er nog niet staat; `normalizeShopBought` laat het weg als het ongeldig is). Niets anders verandert aan de opslag.
- `BadgeFacts.bought?: { ings: ReadonlyMap<string, { n: number; first: string | null }>; }` — **per lid**: alleen ingrediënten met
  `by[memberId] > 0`, `n` = dat aantal, `first` = `first[memberId]`; voor `'all'`: `n` = het totaal, `first` = de vroegste. `buildFacts`
  vult het uit de setting plus de woordenlijst (`dict`): het aantal recepten waarin een ingrediënt voorkomt (voor `boughtRare`) komt uit
  `facts.recipes` (tel per ingrediënt-id over alle `lines`). Voorraadproducten (`staple: true` in de woordenlijst) tellen niet mee in
  `boughtDistinct`, `boughtGroup`, `boughtRare` en `boughtLetters` (Stijn 8 nov); `boughtInMonth` noemt een ingrediënt bij naam en
  leest het wél, ook als het een voorraadproduct is (speculaaskruiden). Bewaar daarom in `facts.bought` alle ingrediënten met een
  vlag `staple`, en laat de vier eerste regelsoorten de staples overslaan.
- Nieuwe regelsoorten in `BadgeRule`:
  `{ kind: 'boughtDistinct'; aisle?: string; n?: number }` (aantal verschillende ingrediënten, optioneel binnen één gangpad),
  `{ kind: 'boughtGroup'; ids: string[]; n?: number }` (hoeveel van een vaste lijst gekocht),
  `{ kind: 'boughtRare'; n?: number }` (een gekocht ingrediënt dat in precies één recept voorkomt),
  `{ kind: 'boughtLetters'; n?: number }` (verschillende beginletters van de NL-naam),
  `{ kind: 'boughtInMonth'; id: string; months: number[] }` (dat ingrediënt met `first` in een van de maanden 1–12).
  Elk met een ladder-variant (geen `n` → `tiers`). Tests: elke soort met en zonder ladder, per lid vs 'all', voorraadproduct telt niet,
  `first` alleen de eerste keer.

### 1b. De badges en de beloningen (bouwer B: `data/badges.json`, `data/avatar-parts.json` (alleen de vier onderdelen), `tools/validate-data.ts`,
`tools/avatar-sheet.ts` alleen als nodig, `tests/validate-badges.test.ts`)

Nieuwe groep `boodschappen` (groepenlijst in de validator; `BadgeGroup` in badges.ts krijgt de waarde — bouwer A) met twaalf badges:

| id | naam NL · EN | regel | treden / n | icoon | beloning |
|---|---|---|---|---|---|
| verzamelaar | Verzamelaar · Collector | boughtDistinct | 10 · 25 · 50 · 100 · 175 · 250 · 350 · 500 | 🧺 | trede 3 → `glasses-shopping` |
| groenteboer | Groenteboer · Greengrocer | boughtDistinct aisle groente-fruit | 10 · 20 · 35 · 50 · 70 · 90 · 120 · 150 | 🥦 | trede 2 → `pin-carrot` |
| kaasmeester | Kaasmeester · Cheesemonger | boughtDistinct aisle kaas | 3 · 5 · 8 · 12 · 16 · 20 · 28 · 36 | 🧀 | trede 2 → `prop-cheese-slicer` |
| slager | Slager · Butcher | boughtGroup (vleesproducten uit vlees-vis: builder B kiest de ids, geen vis) | 5 · 10 · 15 · 20 · 30 · 40 · 55 · 70 | 🥩 | — |
| vismarkt | Vismarkt · Fishmonger | boughtGroup (vis en schaaldieren) | 3 · 5 · 8 · 12 · 16 · 20 · 25 · 30 | 🐟 | — |
| kruidenkast | Kruidenkast · Spice rack | boughtDistinct aisle kruiden-specerijen | 5 · 10 · 15 · 20 · 30 · 40 · 55 · 70 | 🌿 | — |
| wereldwinkel | Wereldwinkel · World shelf | boughtDistinct aisle wereld | 5 · 10 · 15 · 20 · 30 · 40 · 55 · 70 | 🌍 | — |
| bakkersmand | Bakkersmand · Baker's basket | boughtDistinct aisle bakken | 5 · 8 · 12 · 16 · 20 · 25 · 30 · 40 | 🥐 | — |
| zeldzaam | Zeldzaam · One-of-a-kind | boughtRare n 1 (één keer) | — | 💎 | — (geheim: `hidden: true`) |
| alfabet | Alfabet · Alphabet | boughtLetters n 26 | — | 🔤 | geheim → `glasses-letters` |
| speculaastijd | Speculaastijd · Spice season | boughtInMonth id speculaaskruiden months [11, 12] | — | 🍪 | — (als `speculaaskruiden` niet bestaat: `koekkruiden`; anders laat deze badge weg en meld het) |
| zomerkoninkjes | Zomerkoninkjes · Summer berries | boughtInMonth id aardbei months [6, 7, 8] | — | 🍓 | — |

Zeldzaamheid: ladders volgen de bestaande regel per trede; `zeldzaam` en `alfabet` zijn geheim (groep blijft `boodschappen`,
`hidden: true`), XP geheim 250. Beschrijvingen met `{n}` bij ladders, NL én EN. De vier onderdelen in data/avatar-parts.json:
`glasses-shopping` (bril met een prijskaartje aan de poot, laag glasses, `unlock: { badge: 'verzamelaar' }`, rare), `pin-carrot`
(wortelspeld, laag pin, badge groenteboer, rare), `prop-cheese-slicer` (kaasschaaf, laag prop, badge kaasmeester, rare),
`glasses-letters` (glazen als een A en een Z, laag glasses, badge alfabet, epic). Tekenstijl en lijndikte zoals de bestaande; `__u`
voor eigen ids; validator en `npm run validate:data` groen; aantallen in tests bijwerken (badges 152 → 164, onderdelen 165 → 169).

### 1c. Badges-scherm (bouwer C: `src/screens/BadgesScreen.tsx`, `src/i18n/badges.ts` of waar `badges.group.*` staat, `src/styles/badges.css` alleen als nodig)

Het tabblad **Boodschappen** (`badges.group.boodschappen` NL "Boodschappen" · EN "Groceries") tussen Koken en Ontdekken; de bestaande
voortgangsregel per ladder toont "12 van 25 verschillende ingrediënten" via de bestaande `{n}`-mechaniek. Geheime badges blijven
verborgen tot ze gehaald zijn, zoals nu.

### 1d. Handboek (bouwer D: `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`)

Rij over de badgegroepen (het tabblad Boodschappen erbij, wat telt: wat je afvinkt op de lijst; "Heb ik al" en voorraadproducten
tellen niet), de rij over avatar-onderdelen via badges (vier erbij, zonder de geheime te verraden), eventueel een rij "Badges voor
boodschappen". Daarna `npm run validate:data` en `node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

De tabel van §1b (ids, treden, iconen, beloningen) · voorraadproducten tellen nooit · "Heb ik al" telt nooit · geen curve-aanpassing ·
de twee geheime badges · nieuwe dependencies (nee) · bestaande badge- of onderdeel-ids wijzigen (nooit).

## 3. Bestandsverdeling

**A — Feiten en regels:** `src/domain/shopbought.ts`, `src/domain/badges.ts`, `src/badges.ts` (alleen `buildFacts`), `tests/shopbought.test.ts`,
`tests/badges.test.ts` (alleen toevoegen).
**B — Data:** `data/badges.json`, `data/avatar-parts.json` (vier onderdelen), `tools/validate-data.ts` (groep, regelsoorten), `tests/validate-badges.test.ts`.
**C — Scherm:** `src/screens/BadgesScreen.tsx`, het i18n-bestand met `badges.group.*`, `src/styles/badges.css` (alleen als nodig).
**D — Handboek:** `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; dev-app (375 px, NL én EN): vink op Boodschappen tien verschillende
ingrediënten af → Verzamelaar trede 1 met toast en XP; een voorraadproduct (bloem) afvinken telt niet; het tabblad Boodschappen op
Badges; de vier onderdelen op het contactblad (sectie per laag) en met een slotje in de maker. Noem in STATUS het XP-totaal van de
nieuwe set (som van 50 × trede over alle ladders + 250 × 2 geheim). DEVICE-TEST: nieuwe rij 116 "Boodschappen-badges (V7)" NL én EN na
rij 115. STATUS-alinea en de regel "Gebouwd: …".

## 4. Niet in dit blok

V8 (swipen), V9 (voedingswaarden). Hoeveelheden op het boodschappenspoor ("1 kg boter") worden niet bewaard: geen badge daarover.
