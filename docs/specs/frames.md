# Spec 6D-F — Avatar ronde 3: lijsten (frames) en vrijere achtergronden

Status: compleet (Fable, 8 nov 2026). Eén blok, drie bouwers + integrator (lichte modus). Bron: Stijn (30 okt 2026): "het frame
van je avatar, de rand eromheen, als iets om te verzamelen; en de achtergrond kan flink aangepast worden. Ergens — achtergrond of
frame — moet de originele profielkleur altijd terug te vinden zijn. Spelen met frames lijkt me heel nice: andere vormen, of juist
dat het poppetje eruit springt." Het plan stond in badges-avatar.md "Blok 6D-F"; deze spec vervangt het. Leidend bij tegenspraak:
docs/specs/README.md §2, badges-avatar.md (lagen, tekenregels, zeldzaamheid 6D-R), CLAUDE.md invariant 4 (`#f=`/`#x=` dragen
`AvatarSpec.parts` ongewijzigd). Geen nieuwe setting, geen nieuwe tokensleutel, geen dependency, geen Dexie-versie.

**Kritische lezer.** (1) Een twaalfde laag die buiten de clip tekent breekt de vaste SVG-structuur van `renderAvatarSvg`; de
tests die die structuur vastpinnen worden bewust aangepast, niet omzeild (§6). (2) De kleurregel is hard: na dit blok bestaat er
geen combinatie van achtergrond en lijst waarbij de profielkleur onzichtbaar is (§2c; test §6.3). (3) Een oude app kent de laag
`frame` niet: `normalizeAvatarSpec` laat een id zonder bekende laag vallen, dus de ontvanger van een kaartje ziet de standaardrand.
Dat is het bestaande gedrag voor onbekende lagen en aanvaard; bevroren tokens veranderen niet. (4) De tekenbudgetten per
zeldzaamheid (tests/avatar.test.ts: common/rare ≤ 14 elementen en 1,5 kB, epic ≤ 20 en 2 kB, legendary ≤ 26 en 2,5 kB) gelden
ook voor lijsten en tafereeltjes: eenvoudig tekenen, geen gradients, geen tekst. (5) Twee badges krijgen `unlock.part`; de
validator eist dat badge en onderdeel naar elkaar wijzen.

**Feitencheck (8 nov).** `LAYER_ORDER` = bg … prop (11 lagen); `renderAvatarSvg` tekent `<circle r=46 fill=profielkleur>`, de
lagen in `<g clip-path>` (cirkel r 46) en vanaf level 5 een ring r 48, dikte 4, in de niveaukleur. `layerOfId` kent alleen
`LAYER_ORDER`. De maker (`AvatarSheet.tsx`) heeft `ROWS` = face, tone, hair, hairColor, eyes, mouth, facial, glasses, hat, body,
prop, pin, bg en `OPTIONAL` voor lagen met een "geen"-tegel; tegels renderen één onderdeel op `TILE_BG` zonder ring. De bibliotheek
telt 126 onderdelen, waarvan 13 achtergronden (11 doorschijnend óver de profielkleur, `bg-gold` en `bg-sunset` dekkend — correctie van de lens, 8 nov; `bg-color` tekent niets); 7 legendarische.
Badges `uitdager` (6E, ladder 1/3/5/10/20/35/50/75) en `vaste-klant` (6C, ladder 1/3/5/10/15/20/30/50) hebben nog geen
`unlock.part`. `tools/avatar-sheet.ts` maakt het contactblad met `renderAvatarSvg`. `tests/avatar.test.ts` eist o.a. dat nieuwe
onderdelen van ronde 2 op level 3–60 vrijkomen en dat legendarisch ≤ 10 % van de bibliotheek is.

## 1. Doel en gebruikersgedrag

- In de avatar-maker staat na **Achtergrond** een tab **Lijst** (EN **Frame**) met een "geen"-tegel en de lijsten per
  zeldzaamheid, zoals elke andere tab. Kies je een lijst, dan vervangt die de ronde rand: een zeshoek, schulprand, houten plank,
  koekenpan, lauwerkrans, koksmuts, gouden lijst … De figuur wordt afgesneden op de vorm van de lijst.
- De dunne **niveauring** blijft: zonder lijst zoals nu (rand van de cirkel), met lijst als lijn in de niveaukleur langs de vorm van
  de lijst, aan de binnenkant van de lijst.
- **Je profielkleur blijft altijd zichtbaar.** Met een doorschijnende achtergrond (alle achtergronden van nu) is zij de ondergrond
  en heeft de lijst zijn eigen kleur (hout bruin, lauwer groen). Kies je een **dekkende** achtergrond (nieuw: keukentegels,
  sterrennacht, seizoenen …), dan neemt de lijst je profielkleur over als hoofdkleur; heb je dan geen lijst gekozen, dan tekent de
  app vanzelf de simpele ring in je profielkleur. Zo blijft elk lid aan zijn kleur herkenbaar, ook op het kaartje en in de
  kalender.
- De tab **Achtergrond** groeit van 13 naar 30 tegels; 17 nieuwe, waarvan 12 dekkend.
- 🎲 Verras me kan een lijst kiezen (optionele laag, 50 %). Het kaartje `#f=` en de voortgang `#x=` dragen de lijst mee als gewoon
  onderdeel-id; niets anders aan het formaat.
- Niets verandert aan XP, levels, badges (behalve `unlock.part` op twee badges), instellingen of registers.

## 2. Datamodel en renderer (bouwer A)

### 2a. Laag en velden (`src/domain/avatar.ts`)
- `AvatarLayer` krijgt `'frame'`; `LAYER_ORDER` eindigt op `'frame'` (na `prop`). `REQUIRED_LAYERS` ongewijzigd. `layerOfId`
  herkent dus `frame-*`.
- `AvatarPart` krijgt drie optionele velden:
  - `clip?: string` — alleen bij `layer === 'frame'`, verplicht daar: precies één SVG-vormelement als string (`<circle …/>`,
    `<ellipse …/>`, `<rect …/>`, `<polygon …/>` of `<path d="…"/>`) met alleen geometrie-attributen (cx cy r rx ry x y width
    height points d), zonder fill/stroke/style/id. Het is de clipvorm van de avatar én de lijn van de niveauring.
  - `accent?: string` — alleen bij frames, verplicht daar: een hex-kleur (`#rrggbb`), de eigen hoofdkleur van de lijst.
  - `covers?: boolean` — alleen bij `layer === 'bg'`: `true` = de achtergrond bedekt de profielkleur volledig.
  `normalizeAvatarParts` leest ze tolerant (een frame zonder geldige `clip`/`accent` wordt overgeslagen; `covers` alleen als het
  letterlijk `true` is; op andere lagen genegeerd). Frame-svg mag `var(--accent)` gebruiken als **attribuut** (`fill="var(--accent)"`,
  `stroke="var(--accent)"`), niet in `style=` (de twee toegestane styles blijven de enige).

### 2b. `renderAvatarSvg` — nieuwe vaste structuur
```
<svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:T;--hair:H;--accent:A" aria-hidden="true">
  <defs><clipPath id="c-UID">CLIP</clipPath></defs>
  <g clip-path="url(#c-UID)"><rect width="100" height="100" fill="COLOR"/>LAGEN bg … prop</g>
  RING
  FRAME
</svg>
```
- `CLIP` = de `clip` van de gekozen lijst, anders `<circle cx="50" cy="50" r="46"/>` (zelfde beeld als nu: de kleurcirkel is nu een
  rect binnen de clip).
- `RING` (alleen vanaf level 5, `ringForLevel`): **zonder lijst** exact als nu (`<circle r="48" … stroke-width="4"/>`); **met lijst**
  de clipvorm zelf, gestrookt: `clip` met toegevoegd `fill="none" stroke="RINGHEX" stroke-width="2"`.
- `FRAME` = de `svg` van de gekozen lijst (ongeclipt, `__u` vervangen), ná de ring.
- `--accent` (kleurregel §2c): de profielkleur als de gekozen achtergrond `covers` is, anders de `accent` van de lijst; zonder lijst
  leeg (`--accent:` weggelaten mag ook, kies één vorm en pin die in de test).
- **Impliciete ring:** is de achtergrond `covers` en is er geen lijst gekozen (of de gekozen id is onbekend), dan tekent de renderer
  alsof `frame-ring` gekozen is (clip cirkel r 46, ring-svg van `frame-ring`, accent = profielkleur). Bestaat `frame-ring` niet in de
  bibliotheek (defensief), dan `<circle cx="50" cy="50" r="48" fill="none" stroke="COLOR" stroke-width="4"/>` ná de niveauring, die
  dan r 45 dikte 2 wordt.
- Onbekende ids worden overgeslagen zoals nu; `SAFE_COLOR`/`fromPalette`/uid-regels ongewijzigd.

### 2c. Kleurregel, als één zin voor de tests
"Voor elke achtergrond b en elke lijst f (inclusief geen) geldt: b is niet `covers` (de rect in de profielkleur schijnt door), óf
de gerenderde string bevat de profielkleur als `stroke`/`fill` buiten de clip-groep (via `--accent` op de root of via de
impliciete ring)."

### 2d. Validator (`tools/validate-data.ts`, `validateAvatarParts`/`checkAvatarSvg`)
- `AVATAR_LAYERS` krijgt `frame`; `AVATAR_PART_KEYS` krijgt `clip`, `accent`, `covers`.
- Frame: `clip` verplicht en precies één toegestaan vormelement met alleen geometrie-attributen (regex, geen parser); `accent`
  verplicht `#rrggbb`; `svg` bevat minstens één `var(--accent)`; de svg-tekenregels van `checkAvatarSvg` gelden ook.
- Niet-frame met `clip` of `accent` → fout; `covers` op een andere laag dan `bg` → fout; `covers` niet-boolean → fout.
- Bestaande regels (ids, talen, unlock, rarity, badge-kruiscontrole, level-3-verplichting) ongewijzigd. Minimaal één frame op level
  3 is **niet** vereist (optionele laag), maar `frame-ring` staat wel op level 3 (§3).
- `tools/avatar-sheet.ts`: een sectie **Lijsten** (elke lijst op de basisavatar in 96 px, twee keer: met doorschijnende
  achtergrond in eigen accent en met een dekkende achtergrond in de profielkleur) en de nieuwe achtergronden in de bestaande
  bg-sectie, met een markering "dekkend". De balans-tabel telt frames gewoon mee.

## 3. De lijsten (bouwer B tekent ze; Fable besliste id, naam, zeldzaamheid, unlock, accent, clipvorm en beeld)

| id | NL / EN | zeldz. | unlock | accent | clip | beeld (eenvoudig; binnen het tekenbudget) |
|---|---|---|---|---|---|---|
| frame-ring | Rand / Plain ring | common | level 3 | #f4ede4 | cirkel r 46 | ring r 48, dikte 4, `var(--accent)` |
| frame-dots | Stippelrand / Dotted ring | common | level 9 | #ffffff | cirkel r 46 | 16 stippen (r 2) op r 48 in `var(--accent)` + dunne ring r 47 dikte 1 |
| frame-plate | Bord / Plate | rare | level 18 | #ffffff | cirkel r 40 | rand r 40–50 (ring dikte 10) in `var(--accent)` met een vaste lijn r 45 dikte 1,5 in Delfts blauw #2b6fd6 (besluit Fable na de lens: het grootste vlak draagt het accent) |
| frame-hexagon | Zeshoek / Hexagon | rare | level 24 | #6b7a90 | regelmatige zeshoek, punt boven, straal 46 | dezelfde zeshoek op straal 48,5 gestrookt dikte 3 in `var(--accent)`, plus een binnenlijn straal 44 dikte 1 wit 40 % |
| frame-scallop | Schulprand / Scalloped | rare | level 33 | #e07a5f | cirkel r 44 | 12 halve cirkels (r 7) op r 46 in `var(--accent)` als schulpen, daarbinnen ring r 44 dikte 1,5 wit |
| frame-board | Houten plank / Wooden board | epic | level 42 | #a9743f | cirkel r 42 | brede rand r 42–50 in `var(--accent)`, 3 nerflijnen (bogen, donkerder #7a4f28 opacity .5) en 4 spijkerkopjes (r 1,5, #d9c7a6) |
| frame-pan | Koekenpan / Frying pan | epic | level 55 | #3b3f45 | cirkel r 43 | rand r 43–50 in `var(--accent)`, dunne binnenring #8a8f96, korte steel als afgeronde rect van (80,80) naar (97,97) gedraaid 45°, met gaatje |
| frame-laurel | Lauwerkrans / Laurel wreath | epic | badge `uitdager`, tier 3 | #4f8a3c | cirkel r 44 | twee takken (links en rechts, van onder naar boven) van elk 7 blaadjes (ellipsen) in `var(--accent)` met een lichte middennerf, onderaan een klein strikje #c9a227 |
| frame-basket | Mandrand / Wicker rim | epic | badge `vaste-klant`, tier 5 | #b98a4a | cirkel r 43 | rand r 43–50 in `var(--accent)` met een vlechtpatroon van 12 korte diagonale lijnen (#7a5a2b opacity .6) |
| frame-chefhat | Koksmuts / Chef's hat | legendary | level 70 | #ffffff | cirkel r 44 | drie bolle "plofjes" (cirkels r 11–13) boven op de rand tussen y 2 en 22, band onderaan (rect y 86–94, rx 4), alles `var(--accent)`, randlijn #d9d4cc dikte 1 |
| frame-gold | Gouden lijst / Gilded frame | legendary | level 85 | #c9a227 | rect x 8 y 8 b 84 h 84 rx 14 | dubbele rand (rx 16 dikte 4 en rx 12 dikte 1,5) in `var(--accent)`, vier hoekknoppen (cirkels r 3,5, #e4c45a), geen gradient |

Regels bij het tekenen: viewBox 0 0 100 100; niets buiten 0–100; met de accentkleur als **hoofdkleur** van de lijst (de
profielkleur moet in de dekkende stand duidelijk zijn, dus `var(--accent)` op het grootste vlak of de dikste lijn); geen
`style=` behalve de twee bestaande; ids eindigen op `__u`; geen `<text>`, geen gradients; budget per zeldzaamheid. De naam in de
data (`nl`/`en`) is de tegelnaam. Badge-lijsten: in data/badges.json krijgt `uitdager` `"unlock": { "part": "frame-laurel", "tier": 3 }`
en `vaste-klant` `"unlock": { "part": "frame-basket", "tier": 5 }` (de validator eist het wederzijds).

## 4. De achtergronden (bouwer B; 17 nieuw → 30)

| id | NL / EN | zeldz. | level | dekkend | beeld |
|---|---|---|---|---|---|
| bg-stripes | Strepen / Stripes | common | 5 | nee | 5 schuine banen wit opacity .14 |
| bg-chevron | Zigzag / Chevron | common | 7 | nee | 3 zigzaglijnen wit opacity .16, dikte 6 |
| bg-waves | Golfjes / Waves | common | 10 | nee | 4 golvende paden wit opacity .14 |
| bg-grid | Ruitjes / Grid paper | common | 16 | nee | 4 + 4 lijnen wit opacity .14, dikte 1 |
| bg-checker | Dambord / Checkerboard | common | 19 | nee | 8 vierkanten (25×25) wit opacity .12 in dambordpatroon |
| bg-kitchen | Keukentegels / Kitchen wall | rare | 21 | ja | witte ondergrond #f6f1e8, 6 tegels met voegen #d8d0c4 |
| bg-herbs | Kruidentuin / Herb garden | rare | 25 | ja | groen #5f8f4a, 6 blaadjes in twee groentinten |
| bg-wood | Houten tafel / Wooden table | rare | 27 | ja | #b07d4b met 4 nerflijnen #8a5a30 opacity .6 |
| bg-night | Sterrennacht / Starry night | rare | 35 | ja | #1b2a4a, 7 sterren (cirkels) #fff5c2, maansikkel |
| bg-spring | Lente / Spring blossom | rare | 40 | ja | #e9f3e1 met 6 roze bloesems (#f4a7b9) en een tak |
| bg-summer | Zomer / Summer beach | epic | 44 | ja | lucht #8fd0f0, zee #2f8fc8, zand #f0d9a6, zon |
| bg-autumn | Herfst / Autumn leaves | epic | 48 | ja | #d98b3a met 6 blaadjes in #b8441f/#e9b44c |
| bg-winter | Winter / Winter snow | epic | 52 | ja | #dfe9f2, 9 sneeuwvlokken (cirkels), witte sneeuwheuvel onderaan |
| bg-market | Markt / Market stall | epic | 58 | ja | luifel met 6 rood-witte banen bovenin (#d9402b/#fff), kraam #a9743f onderin |
| bg-fire | Vuur / Flames | epic | 65 | ja | #2a1a14 met 3 vlamvormen (#ff7a1a, #ffb52e, #fff1a8) |
| bg-aurora | Noorderlicht / Northern lights | legendary | 75 | ja | #0f1f3d met 3 gebogen banen (#4fe3b0, #7fd1d6, #b58cff opacity .7) en 6 sterren |
| bg-galaxy | Melkweg / Galaxy | legendary | 90 | ja | #120a2a met een schuine lichte band (#6b4fa8 opacity .6), 10 sterren, één planeet met ring |

Dekkende achtergronden beginnen met een `<rect width="100" height="100" fill="…"/>` (of een cirkel r 50) als eerste element; de
validator eist dat bij `covers: true` (eenvoudige regex op het eerste element). Van de 13 bestaande achtergronden blijven er 11 doorschijnend; `bg-gold` en `bg-sunset` waren al dekkend en krijgen
`covers: true` (besluit Fable na de lens: 14 dekkende achtergronden; de validator eist voortaan ook het omgekeerde: een dekkend
eerste element zonder `covers` is een fout). Balans na dit blok (test): legendarisch ≤ 10 % van de bibliotheek (7 + 2 lijsten + 2 achtergronden =
11 van 154 = 7 %); ≥ 75 % van de level-commons op level ≤ 20 en ≥ 75 % van de level-rares op level ≤ 50 blijven gelden.

## 5. Bestandsverdeling

| Bouwer | Raakt alleen |
|---|---|
| A (domein, validator, tests, contactblad) | `src/domain/avatar.ts`, `tools/validate-data.ts`, `tools/avatar-sheet.ts`, `tests/avatar.test.ts`, `tests/validate-data*.test.ts` (als die het avatar-deel testen) |
| B (data) | `data/avatar-parts.json` (11 lijsten + 17 achtergronden; `covers` op de 12 dekkende), `data/badges.json` (alleen `unlock` op `uitdager` en `vaste-klant`) |
| C (UI) | `src/components/AvatarSheet.tsx` (`ROWS` krijgt `'frame'` na `'bg'`, `OPTIONAL` krijgt `'frame'`; verder niets: tegels, groepen, stipjes en "geen" volgen automatisch), `src/i18n/avatar.ts` (`avatar.layer.frame`: NL "Lijst" / EN "Frame"), `src/styles/avatar.css` alleen als een lijst op 40 px wegvalt (dan niets aan maten, alleen `overflow: visible` als dat nodig is), `docs/DEVICE-TEST.md` rij 108 (§6) |
| Integrator | samenvoegen, groen, `node --experimental-strip-types tools/avatar-sheet.ts` draaien en het pad van het contactblad in STATUS zetten, dev-app-check (§6), docs/STATUS.md, één regel "Gebouwd" onder deze spec |

Bouwer B tekent tegen het contract van §2a zonder op bouwer A te wachten (de velden zijn hier volledig beschreven); de
integrator maakt de validator groen op de echte data. Nieuwe i18n-sleutel: alleen `avatar.layer.frame`.

## 6. Testplan en acceptatie

1. `tests/avatar.test.ts`: de structuurtests van `renderAvatarSvg` volgen §2b (rect in de clip, ring als nu zonder lijst,
   clipvorm-ring met lijst, frame ná de ring, `--accent`); "elk onderdeel rendert" dekt ook de lijsten; de tekenbudgetten gelden
   voor alle 154; de ronde-2-test over "nieuwe onderdelen op level 3–60" blijft gelden voor de ronde-2-onderdelen en sluit
   `frame-*` en de 17 nieuwe achtergronden uit (of wordt 3–100 voor ronde 3; de bouwer kiest de kleinste wijziging en zegt het).
2. `normalizeAvatarParts`: een frame zonder `clip` of `accent` wordt overgeslagen; `covers` alleen `true`; op een andere laag
   genegeerd. `normalizeAvatarSpec` houdt een `frame-*`-id (bekende laag).
3. Kleurregel §2c als test over het kruisproduct van alle achtergronden × (alle lijsten + geen), met een testprofielkleur `#aa3366`:
   dekkend ⇒ de string bevat `#aa3366` buiten de clip-groep (in `--accent` of als `stroke`); niet dekkend ⇒ de rect binnen de clip
   heeft `fill="#aa3366"`.
4. `randomAvatar` kan een lijst kiezen (met een seed die dat doet) en blijft compleet; `isComplete` ongewijzigd (frame niet
   verplicht).
5. Validator-tests: frame zonder clip/accent → fout; `clip` met `fill=` → fout; `covers` op `hat` → fout; `covers: true` zonder
   dekkend eerste element → fout; badge-kruiscontrole op `uitdager`/`frame-laurel`.
6. Bevroren tokens in tests/token.test.ts ongewijzigd (een `#f=` met een `frame-*`-id hoeft niet bevroren te worden: zelfde
   formaat).
7. Dev-app (integrator, 375 px, licht en donker, NL en EN): tab Lijst na Achtergrond met "geen" en de groepen; kies Houten
   plank → de preview en Mijn profiel tonen de plank, de niveauring loopt langs de binnenkant; kies daarna Sterrennacht → de plank
   kleurt in de profielkleur; zet de lijst op "geen" → een ring in de profielkleur verschijnt vanzelf; zet de achtergrond terug op
   Verloop → de ring verdwijnt, de profielkleur schijnt weer door. Een avatar met lijst in de rij Mijn profiel (Meer), op Home
   (72 px), in Profielen beheren (56 px) en op het kaartje (48 px) is herkenbaar; op 40 px (kalenderstip is geen avatar: n.v.t.).
8. `docs/DEVICE-TEST.md` rij 108 (EN, in de stijl van rij 104/105): kies een lijst en een dekkende achtergrond, kijk op Mijn
   profiel, Home en het kaartje; verwacht: de vorm, de niveaulijn langs de vorm, de lijst in je profielkleur bij een dekkende
   achtergrond, de ring in je profielkleur zonder lijst.

## 7. Opus mag dit NIET zelf beslissen

- Andere ids, namen, zeldzaamheden, levels, accentkleuren of clipvormen dan §3/§4; een extra laag of veld; een nieuw formaat voor
  `#f=`/`#x=`; iets aan `isComplete`, `REQUIRED_LAYERS`, de niveaukleuren of `ringForLevel`.
- De kleurregel versoepelen (bv. een dekkende achtergrond zonder lijst zonder impliciete ring).
- Een lijst die buiten 0–100 tekent of de budgetten overschrijdt "omdat het mooier is": dan eenvoudiger tekenen en melden.
- Gradients, `<text>`, nieuwe `style=`-waarden, een dependency.

**Na de lens (besluit Fable, 8 nov):** (1) `bg-gold` en `bg-sunset` waren al dekkend zonder `covers` (lens, gereproduceerd):
optie (a) — `covers: true` erop, 14 dekkende achtergronden, en de validator plus de kruisproduct-test eisen voortaan dat een
achtergrond zonder `covers` geen dekkend eerste element heeft. (2) Buiten de maker bleef een ronde schijf in de profielkleur
achter een niet-ronde lijst staan (`.avatar.has-svg` had `background: profile.color`): weg voor avatars met SVG; de letter-avatar
houdt zijn cirkel. (3) Lijst-tegels in de maker renderen op een eigen tegelkleur `#b7c0cc`, zodat Rand, Stippelrand en Bord
zichtbaar zijn. (4) Bord: accent wit op de brede rand, de blauwe lijn vast (§3 aangepast). (5) Bouwerskeuzes akkoord: schulpen op
r 43 (binnen 0–100), koksmuts met een randring, `--accent` weggelaten zonder lijst, contactblad met ring van level 30, Engelse
én Nederlandse rij 108 via Jouw stijl → Avatar. (6) Het kaartje op een tweede telefoon en de combinatie plank + sterrennacht
zijn niet in de dev-app gezien (testprofiel op level 33): rij 108. Contactblad: `scratch/avatar-sheet.html` (niet in git).
Gebouwd: 8 nov 2026 (6D-F, workflow wf_bc8903f0-0ed; nabewerking (1)–(4) door een Opus-fixer, docs door Fable)

## 8. Niet in dit blok

Lijsten als beloning in uitdagingen (later, data-ronde), geanimeerde lijsten, lijsten op de kalenderstip of in de lijstregel
van de boodschappen, een aparte "verzameling"-pagina voor lijsten (de maker-tab is de verzameling), herbalancering van ronde 2.
