# Spec V3b — Hoeden bedekken het haar (Stijn, 8 nov 2026, na V3)

Status: in aanbouw (Fable, 8 nov 2026). Eén klein blok, twee bouwers + integrator (lichte modus). Bron: Stijn, 8 nov: "rode
hoofddoek is niet groot genoeg voor het kapsel dat ik heb, dus het kapsel komt erboven uit bij m'n avatar." Leidend bij
tegenspraak: docs/specs/README.md §2–§4, docs/specs/verbeterronde-3.md (binnenschaal, structuur van de SVG), docs/specs/frames.md.

**Kritische lezer (Fable, vooraf).** (1) Het is een laagprobleem, geen tekenfout van één hoed: de laag `hat` ligt bóven `hair`,
maar een hoed bedekt alleen het basis-hoofd (top ±y 6–12). Sinds V3 zijn krullen (top y≈2,5), hanenkam (y≈4), knot (y≈7) en afro
(y≈7, breedte 9–91) hoger of breder, dus ze steken boven de bandana (top y≈6) uit. (2) De nette oplossing is één regel in de
renderer: een hoed die de kruin omsluit krijgt in de data een **randlijn** `brim` (de y-waarde van zijn onderrand in het midden);
het haar wordt dan alleen onder die lijn getekend (clip op de haarlaag). Haar dat opzij onder de hoed uitpuilt blijft zichtbaar,
zoals bij een echte hoofddoek. (3) Hoeden die niet omsluiten (kroontje, bloemenkrans, feesthoedje) krijgen geen `brim`: daar mag
het haar erdoorheen en eromheen. (4) Geen onderdeel-id verandert; een avatar op beide telefoons ziet er alleen netter uit.

**Feitencheck (Fable, in de code).** `renderAvatarSvg` (src/domain/avatar.ts, V3): `<defs><clipPath id="c-UID">CLIP</clipPath></defs>`,
dan de clipgroep met `<rect>`, de bg-laag en `<g class="av-inner" transform="translate(50 100) scale(0.9) translate(-50 -100)">` met
per laag `<g data-layer="…">` (`wrapLayer`), daarna ring/lijst/highlight. Hoeden (20): dino, bandana (level 5, rood), beanie, toque,
cheese, party, santa, strawhat, pan, crown, baseball, beret, watermelon, pancake, hairnet, mushroom, sombrero, flower-crown,
pumpkin, colander. Validator `AVATAR_PART_KEYS` = id, layer, nl, en, unlock, rarity, svg, clip, accent, covers (tools/validate-data.ts
±1042); `clip`/`accent`/`covers` alleen bij lijsten. Tests: tests/avatar.test.ts pint de structuur (V3-blok "§1a").

## 1. Gedrag

### 1a. Renderer (bouwer A: `src/domain/avatar.ts`, `tests/avatar.test.ts`)

- `AvatarPart` krijgt optioneel `brim?: number` (alleen zinvol bij `layer === 'hat'`; `normalizeAvatarPart`/de lezer neemt een eindig
  getal 0–100 over, anders weglaten).
- In `renderAvatarSvg`: draagt de avatar een hoed met `brim`, dan wordt de haarlaag `<g data-layer="hair" clip-path="url(#h-UID)">…</g>`
  en komt in `<defs>` ná de bestaande clipPath een tweede: `<clipPath id="h-UID"><rect x="-10" y="BRIM" width="120" height="120"/></clipPath>`
  (coördinaten in de ruimte van het onderdeel, dus binnen `av-inner`; `BRIM` met hooguit één decimaal). Zonder hoed, of met een
  hoed zonder `brim`, verandert er niets aan de uitvoer (de bestaande structuurtests blijven byte-gelijk).
- Tests: met een hoed mét `brim` 30 bevat de uitvoer de tweede clipPath en de haarlaag met `clip-path="url(#h-UID)"`; zonder `brim`
  niet; `brim` buiten 0–100 of geen getal wordt genegeerd; de volgorde `<defs>` → clipgroep → ring/lijst blijft.

### 1b. Data en validator (bouwer B: `data/avatar-parts.json`, `tools/validate-data.ts`, `tools/avatar-sheet.ts`, tests met aantallen)

- Elke hoed die de kruin omsluit krijgt `brim`: de y-waarde van zijn onderrand in het midden (x≈50) **min 1** (zodat de rand van
  de hoed de haarlijn nét overlapt), afgelezen uit zijn eigen `svg`. Richtwaarden (bouwer B controleert ze op de tekening):
  bandana ≈ 29 · beanie ≈ 27 · toque ≈ 25 · baseball ≈ 29 · beret ≈ 23 · santa ≈ 29 · strawhat ≈ 33 · hairnet ≈ 25 · colander ≈ 29 ·
  pan ≈ 29 · dino ≈ 35 · cheese ≈ 36 · watermelon ≈ 31 · pancake ≈ 27 · mushroom ≈ 29 · sombrero ≈ 33 · pumpkin ≈ 33. **Geen `brim`:**
  crown, flower-crown, party (ze omsluiten de kruin niet).
- Validator: `brim` toegestaan in `AVATAR_PART_KEYS`, alleen bij `layer === 'hat'`, een getal 0–100; elders een fout.
- Contactblad: `tools/avatar-sheet.ts` krijgt een sectie **Hoeden × hoog haar**: elke hoed mét `brim` op de basis-avatar met
  achtereenvolgens krullen, afro, hanenkam, knot, slagroom en staartjes (6 tegels per hoed, 40 px), zodat Fable en Stijn het in één
  oogopslag zien. Daarna `npm run validate:data` en `node --experimental-strip-types tools/avatar-sheet.ts`.
- Geen nieuwe onderdelen, geen id-wijzigingen, geen zeldzaamheid-wijzigingen.

## 2. Opus mag dit NIET zelf beslissen

De regel "brim = onderrand in het midden min 1" · welke drie hoeden geen `brim` krijgen · geen hertekening van kapsels (het haar
blijft zoals in V3) · nieuwe dependencies (nee).

## 3. Bestandsverdeling

**A — Renderer:** `src/domain/avatar.ts`, `tests/avatar.test.ts` (alleen toevoegen).
**B — Data:** `data/avatar-parts.json` (alleen het veld `brim` op hoeden), `tools/validate-data.ts`, `tools/avatar-sheet.ts`,
`tests/validate-badges.test.ts` (één test: elke hoed behalve crown/flower-crown/party heeft een `brim` tussen 20 en 40).
**Integrator:** check/test/build/build:next/validate groen; contactblad genereren en de nieuwe sectie nakijken (geen haar boven een
hoedrand); dev-app (375 px): een profiel met krullen en de bandana → het haar steekt er niet meer bovenuit, opzij wel zichtbaar;
met de kroon steekt het haar er wél doorheen. DEVICE-TEST: rij 112 (V3) krijgt één extra stap NL én EN ("bandana op krullen: geen
haar boven de hoofddoek; kroon op afro: haar eromheen"). STATUS-alinea en de regel "Gebouwd: …".

## 4. Niet in dit blok

V4 (loopt), V6–V9.
