# Spec V3 — Avatar-ronde: meer ruimte in de lijst, haar-revamp, brillen, zeldzaamheid, Verras me per laag (Stijn, 8 nov 2026)

Status: in aanbouw (Fable, 8 nov 2026). Eén blok, vier bouwers + integrator (lichte modus). Bron: Stijns bericht van 8 nov (§0).
Leidend bij tegenspraak: docs/specs/README.md §2–§4, docs/specs/frames.md (lijsten, kleurregel), docs/specs/badges-avatar.md
(avatar-bibliotheek, zeldzaamheid), docs/specs/handbook.md §4. Fable keurt de tekeningen op het contactblad
(`node --experimental-strip-types tools/avatar-sheet.ts` → scratch/avatar-sheet.html) ná de bouw.

**Kritische lezer (Fable, vooraf).** (1) Het "rare dunne randje" is geen iPhone-fout maar de **niveauring** uit 6D-3: met een
lijst wordt de clipvorm 2 px dik getekend in de levelkleur (level 30–39 rood/oranje → Stijns oranje randje; level 10–19 groen →
Gabi's groene randje bij een paarse profielkleur). Langs een lijst leest dat als een foutje, niet als een ring. Besluit: de
niveauring blijft alleen op de kale ronde avatar (zonder lijst, zonder dekkende achtergrond), waar hij als 4 px ring leesbaar is.
(2) Onderdelen zijn getekend tot aan de randen van het 100×100-vak (hanenkam tot y≈0, slagroom y≈4, staartjes y≈5), terwijl
de clipvormen r 40–46 zijn: de toppen vallen weg achter de lijst en het haar lijkt "laag". Een lijst kan binnen het vak niet
groter dan r 50, dus de oplossing is andersom: het poppetje iets kleiner tekenen binnen een vaste schaal, verankerd op de
onderkant (het lijf blijft tot de rand lopen) — één transformatie in de renderer, geen 150 tekeningen aanpassen. Daarnaast de
dikke lijsten (bord, plank, pan, mand) dunner met een clip van minstens r 44. (3) "Vind Gewoon wat vol": de groep **Gewoon**
telt 77 onderdelen (level 3–20), Zeldzaam 33, Episch 33, Legendarisch 11. Fable leest Stijns zin als: de grenzen omlaag, zodat
Gewoon kleiner wordt en alles boven level 40 minstens Episch is. Dit is één datapas en één drempelregel; als Stijn iets anders
bedoelde, draait één script het terug. (4) "Verras me" bestaat al als knop boven de maker (alle lagen tegelijk); per laag komt er
een tegel bij die alleen die laag verrast. (5) Brillen: 7 nu (rond, zon, citroen, monocle, cat-eye, pizza, duikbril); erbij komen
zes na level 30, twee ervan ingrediënt-gebonden, en zes kook-/ingrediëntonderdelen verspreid over de andere lagen.

**Feitencheck (Fable, in de code).** `renderAvatarSvg` (src/domain/avatar.ts ±423): lagen in `LAYER_ORDER` (bg, body, pin, face,
facial, mouth, eyes, hair, glasses, hat, prop, frame), elke laag `<g data-layer="…">`, binnen `<g clip-path>` na een `<rect>` in
de profielkleur; `ROUND_CLIP` = cirkel r 46; `ringForLevel` (vanaf level 5, acht kleuren `RING_ORDER`/`RING_HEX`); met lijst wordt
de clip als 2 px lijn in de levelkleur getekend, zonder lijst een cirkel r 48 dikte 4, met dekkende achtergrond zonder lijst een
cirkel r 45 dikte 2 (plus de impliciete `frame-ring` in de profielkleur); `highlight` (V1b) tekent de clipvorm in currentColor.
Lijsten (data/avatar-parts.json, 11): clips `frame-ring`/`frame-dots` r 46, `frame-plate` r 40, `frame-board` r 42, `frame-pan`
r 43, `frame-basket` r 43, `frame-scallop`/`frame-laurel`/`frame-chefhat` r 44, `frame-hexagon` polygon (x 10–90, y 4–96),
`frame-gold` rect 8–92 rx 14. Haar (15): `hair-mohawk` pad tot y≈0,3, `hair-whipped-cream` y≈4,5, `hair-pigtails` y≈5,
`hair-spaghetti` y≈8, `hair-broccoli` y≈9; `hair-short`/`hair-curly`/`hair-braid` beginnen pas bij y≈40 (dicht op het hoofd).
Gezicht: cirkel (50,42) r 30, dus hoofdtop y≈12; lijf tot y 100. Zeldzaamheid: `rarityForLevel` (src/domain/rarity.ts): ≤ 20
common · ≤ 50 rare · ≤ 80 epic · anders legendary; elk onderdeel heeft een expliciete `rarity`; de maker groepeert per
zeldzaamheid met kop "Zeldzaam · 12" en een gekleurd stipje; validator eist alleen een geldige waarde. Maker
(src/components/AvatarSheet.tsx): per laag een paneel met een "geen"-tegel (OPTIONAL-lagen) en groepen; `randomAvatar(free, seed)`
achter de knop 🎲 Verras me (`avatar.random`); tegels renderen één onderdeel via `renderAvatarSvg` op `TILE_BG`. Tests:
tests/avatar.test.ts pint de structuur (`<defs><clipPath …>`, `<g clip-path><rect …/>`, `<g data-layer="eyes">`, ringregels).
Handboek 07: rijen `badges-xp.ring` ("met een lijst loopt de ring langs de binnenkant"), `avatar-zeldzaam`, `avatar-maken`,
`lijst-en-achtergrond`.

## 0. Wat Stijn vroeg (8 nov 2026, letterlijk)

"sommig haar mag een kleine revamp, sommige zijn wat laag volgens mij, de hanenkam ofzo. misschien wat andere die niet altijd
passen, misschien als je de frames wat groter maakt, dat de haren en kleding en accessoires wat zichtbaarder zijn: niet wegvallen
achter het frame, en meer ruimte hebben als je ze een beetje zou verplaatsen. verder is het nice dat de achtergrond de profielkleur
houdt. de frames passen niet helemaal, klein oranje randje bij mij, maar bij gabi een raar groen randje terwijl haar profielkleur
paars is. gek, misschien iphone ding, check of je kan vinden, is heel erg dun. kan je naast geen in de jouw avatar, per categorie
een verras me hebben. en kan je het brillen-assortiment uitbreiden met grappige brilletjes na level 30, misschien wel iets
ingrediënt-gebonden ertussen. dat ingrediënt-of-kook-gerelateerde mag misschien ook iets vaker. verder mag zeldzaam wel zijn alles
boven level 40, niet 60: vind gewoon wat vol meestal."

## 1. Gedrag

### 1a. Renderer: binnenschaal en de niveauring (bouwer A: `src/domain/avatar.ts`, `tests/avatar.test.ts`)

- **Binnenschaal.** Nieuwe constante `INNER_SCALE = 0.9`. In `renderAvatarSvg` blijven `<rect>` (profielkleur) en de laag `bg`
  ongeschaald; alle andere lagen (body … prop) komen samen in één groep direct erna:
  `<g class="av-inner" transform="translate(50 100) scale(0.9) translate(-50 -100)">…lagen…</g>`
  (verankerd op de onderkant: het lijf blijft tot de rand lopen, de bovenkant van het vak y 0 komt op y 10, de zijkanten x 0/100 op
  x 5/95). Zo valt niets meer achter een clip van r ≥ 44 of achter de zeshoek, ook niet de hanenkam of de slagroom. Tegels in de
  maker gebruiken dezelfde renderer en schalen dus mee (consistent).
- **Niveauring alleen op de kale cirkel.** `ringForLevel` blijft; de ring wordt alleen nog getekend als er **geen lijst** is én de
  achtergrond **niet dekkend** is: `<circle cx="50" cy="50" r="48" fill="none" stroke="<levelkleur>" stroke-width="4"/>` zoals nu.
  Met een lijst, of met een dekkende achtergrond (impliciete `frame-ring`), geen niveauring meer. De `highlight`-ring (V1b) en de
  impliciete `frame-ring` in de profielkleur blijven ongewijzigd.
- **Structuur (vervangt frames.md §2b):**
  `<svg …><defs><clipPath id="c-UID">CLIP</clipPath></defs><g clip-path="url(#c-UID)"><rect width="100" height="100" fill="COLOR"/>[<g data-layer="bg">…</g>]<g class="av-inner" transform="translate(50 100) scale(0.9) translate(-50 -100)">[<g data-layer="body">…</g>…]</g></g>RING FRAME HIGHLIGHT</svg>`
- Tests: structuur met en zonder bg-laag; de lagen staan binnen `av-inner`, bg erbuiten; ring alleen zonder lijst en zonder dekkende
  bg (vier combinaties); `highlight` ongewijzigd; de knipoog-laag `<g data-layer="eyes">` nog aanwezig.

### 1b. Data: lijsten dunner, haar-revamp, zes brillen, zes kook-onderdelen, zeldzaamheid (bouwer B: `data/avatar-parts.json`,
`tools/validate-data.ts` alleen als een regel moet meebewegen, `tools/avatar-sheet.ts` alleen als een sectie erbij moet, `tests/validate-badges.test.ts`/aantallen)

- **Lijsten:** `frame-plate` clip r 40 → r 44, `frame-board` 42 → 44, `frame-pan` 43 → 44, `frame-basket` 43 → 44; de tekening van
  elke lijst past zich aan (de rand ligt tussen r 44 en r 50; bij het bord een smallere rand met het decor in de rand zelf; de
  pan-steel en het mand-handvat mogen buiten r 50 vallen zoals nu). De overige lijsten ongewijzigd. Accentkleuren en `covers`
  blijven.
- **Haar-revamp (alle 15 op het contactblad nalopen):** `hair-mohawk` hoger en smaller (pieken tot y≈4 in het onderdeel-vak, dat
  na de schaal y≈13 wordt), `hair-flame` hoger (vlammen tot y≈6), `hair-curly` meer volume rondom (tot y≈12), `hair-short` een
  iets hogere haarlijn met wat textuur, `hair-braid` de vlecht zichtbaar over de schouder (tot y≈75) in plaats van alleen bij de
  haarlijn; de rest alleen waar iets wegvalt of raar uitlijnt. Kleuren via `fill:var(--hair)`, zoals de rest.
- **Zes brillen na level 30:** `glasses-star` (ster-glazen, level 31), `glasses-heart` (hartjes, 34), `glasses-3d` (rood/blauw,
  37), `glasses-carrot` (worteltjes als poten, ingrediënt, 41), `glasses-nerd` (dik zwart montuur met pleister, 45),
  `glasses-olive` (olijfringen als glazen, ingrediënt, 48). NL/EN-namen kort en grappig ("Sterrenbril"/"Star glasses", …).
- **Zes kook-/ingrediëntonderdelen:** `prop-whisk` (garde, 22), `pin-chili` (chilipeper-speld, 26), `facial-sauce` (saussnor, 29),
  `hat-colander` (vergiet als hoed, 36), `mouth-spaghetti` (sliert spaghetti uit de mond, 41), `eyes-sunny` (spiegeleitjes als ogen,
  43). Stijl en lijndikte zoals de bestaande onderdelen; alles binnen het 100×100-vak; `__u` voor eigen ids.
- **Zeldzaamheid (Fable's lezing van "vind Gewoon wat vol"):** nieuwe drempels voor level-onderdelen: level ≤ 10 → common ·
  11–40 → rare · 41–70 → epic · ≥ 71 → legendary; badge-onderdelen: minstens rare, bij een geheime badge of ladder-trede ≥ 3 epic
  (bestaande legendary blijft legendary). Pas dit toe op ALLE bestaande onderdelen (één script, in het rapport de nieuwe aantallen
  per groep; richtwaarde: Gewoon ±42, Zeldzaam ±60, Episch ±50, Legendarisch ±14). De nieuwe onderdelen volgen dezelfde regel.
  Valideren: `npm run validate:data`, daarna `node --experimental-strip-types tools/avatar-sheet.ts` (de console-tabel in het
  rapport).

### 1c. Regel, maker en tegel "Verras me" per laag (bouwer C: `src/domain/rarity.ts`, `tests/rarity.test.ts` of de bestaande
test die `rarityForLevel` dekt, `src/components/AvatarSheet.tsx`, `src/styles/avatar.css`, `src/i18n/avatar.ts`)

- `rarityForLevel(level)`: ≤ 10 common · ≤ 40 rare · ≤ 70 epic · anders legendary (dezelfde drempels als §1b; tests bijwerken,
  randen 10/11, 40/41, 70/71).
- **Tegel per laag:** in elk laagpaneel, vóór de "geen"-tegel (of vooraan als de laag niet optioneel is), een tegel
  `avatar-tile random` met het schud-icoon en het woord `avatar.random` ("Verras me"/"Surprise me"); tik → één willekeurig
  **vrijgespeeld** onderdeel van die laag dat niet het huidige is (bij maar één vrij onderdeel: dat onderdeel); de keuze gaat door
  `pickPart(layer, p)` zoals een gewone tik, dus opslaan en de "nieuw"-stip gedragen zich gelijk. De knop 🎲 Verras me boven de
  maker (alle lagen) blijft. Kleurlagen (huid, haar) krijgen de tegel ook (een willekeurige kleur uit het palet).
- CSS: de tegel ziet eruit als de "geen"-tegel (gestippelde rand), met het icoon gecentreerd.

### 1d. Handboek (bouwer D: `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`)

`badges-xp.ring`: de ring alleen zonder lijst (en zonder dekkende achtergrond); met een lijst is de lijst zelf de versiering.
`badges-xp.avatar-zeldzaam`: de nieuwe grenzen (t/m level 10 gewoon, tot 40 zeldzaam, tot 70 episch, daarboven legendarisch).
`badges-xp.avatar-maken`: de tegel Verras me per laag. `badges-xp.lijst-en-achtergrond`: het poppetje staat iets kleiner in de
lijst zodat haar, hoed en accessoires nooit achter de lijst vallen. Een rij over de brillen is niet nodig (ze staan in de maker).
Daarna `npm run validate:data` en `node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

`INNER_SCALE` 0,9 en de verankering op de onderkant · de niveauring alleen op de kale cirkel · de zeldzaamheidsgrenzen · de lijst
van twaalf nieuwe onderdelen en hun levels · de clipradius 44 · nieuwe lagen (nee) · nieuwe dependencies (nee) · bestaande
onderdeel-ids wijzigen (nooit: ze staan in avatars op beide telefoons en in deelcodes).

## 3. Bestandsverdeling

**A — Renderer:** `src/domain/avatar.ts`, `tests/avatar.test.ts`.
**B — Data:** `data/avatar-parts.json`, `tools/validate-data.ts` (alleen als nodig), `tools/avatar-sheet.ts` (alleen als nodig),
tests met aantallen (`tests/validate-badges.test.ts`, `tests/avatar.test.ts` alleen de telling als die daar staat — stem af via het
rapport, raak A's structuurtests niet aan).
**C — Regel en maker:** `src/domain/rarity.ts`, de test die `rarityForLevel` dekt, `src/components/AvatarSheet.tsx`,
`src/styles/avatar.css`, `src/i18n/avatar.ts`.
**D — Handboek:** `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; contactblad genereren en in de dev-app (375 px) op Mijn profiel en in
de maker nakijken: hanenkam en slagroom volledig zichtbaar in bord, pan en zeshoek; geen dunne ring langs een lijst, wel de 4 px
ring op de kale cirkel vanaf level 5; tegel Verras me in elk paneel kiest een vrij onderdeel; groepen Gewoon/Zeldzaam/Episch/
Legendarisch met de nieuwe aantallen; de zes brillen en zes kook-onderdelen op het contactblad. DEVICE-TEST: nieuwe rij 112
"Avatar-ronde (V3)" NL én EN na rij 111; rij 108 (lijsten) bijwerken waar hij de ring langs de lijst noemt. STATUS-alinea en de
regel "Gebouwd: …". Fable kijkt daarna zelf het contactblad na (haar, brillen, kook-onderdelen) en past docs/specs/frames.md §2b en
badges-avatar.md (zeldzaamheidsregel) aan.

## 4. Niet in dit blok

Een ander lid groot bekijken (idee 5-rest) · avatar-onderdelen als uitdagingsbeloning (idee 3-rest) · V4, V6, V7, V8, V9.
