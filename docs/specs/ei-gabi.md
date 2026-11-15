# Spec V1c-10 — Gabi's ei: het panterprint-thema (SPOILER — Stijn, niet lezen: jij wilde niet weten hoe het vrijspeelt)

Status: compleet (Fable, 15 nov 2026). Twee bouwers + integrator (lichte modus). **Herontwerp V1c-10b (Fable zelf, 15 nov, avond)** na
Gabi's oordeel over de eerste versie ("het ziet eruit als goud met een goedkope achtergrond"): zie §1d–§1f; §1a's CSS-blok is daarmee geschiedenis. Bron: Gabi, getypt op Stijns laptop (15 nov, Engels):
"if I click to shopping list and then only add leopard print and save, the leopard print theme would appear; there would be multiple
options for the colour theme, and a mask would unlock to put on the avatar." Stijn: "ze is jaloers op goud; zodat ik niet weet wat het is".
Leidend bij tegenspraak: docs/specs/README.md §2–§4, docs/specs/verbeterronde-5.md §1d (het gouden thema en het makers-ei: dit ei volgt
dezelfde plumbing), docs/specs/badges-avatar.md (avatar-onderdelen). De manier van vrijspelen staat ALLEEN in dit bestand: niet in STATUS,
niet in het handboek, niet in DEVICE-TEST (daar staat "Gabi weet hoe"), niet in commit-berichten.
Gebouwd: 15 nov 2026 (V1c-10, lichte workflow wf_6b027015-4e1); V1c-10b herontwerp 15 nov 2026 (Fable zelf, geen workflow; §1d–§1f). (V1c-10: lens: twee bevindingen, allebei hersteld: de controle zit op de hele getypte regel via een prop `onLine` op ExtraField (niet in `addItem`, anders telde "2 leopard print" of "melk, leopard print" ook), en DEVICE-TEST rij 125 noemt het scherm niet; besluiten Fable: zo laten; bouwer A: nog eens vrijspelen zet het thema ook op Panter, `color-mix` voor de balken)

**Kritische lezer (Fable, vooraf).** (1) Zelfde plumbing als goud: een thema is pas kiesbaar als het "vrij" is op deze telefoon; voor panter
is er geen level-ontgrendeling, alleen het ei (device-local setting `theme.panterUnlocked` + localStorage-spiegel voor de eerste paint, zoals
`theme.goldUnlocked`/`recepten.theme.goldFree`). Badges uit of aan maakt niet uit. (2) Het ei zit in het plakvak van Boodschappen: één
regel met precies de zin, + of Enter → niets op de lijst, wel het ei. De zin is Engels (Gabi), met Nederlandse synoniemen zodat Stijn hem
ooit per ongeluk ook kan vinden. (3) Kleurvarianten: één setting `theme.panterColor` (device-local), toegepast als tweede attribuut
`data-panter` op `<html>`, zodat de CSS per variant alleen een paar tokens overschrijft. (4) Leesbaarheid gaat voor: het printje staat op de
achtergrond (body) in lage contrast en op de kop- en navigatiebalk; kaarten blijven effen; tekst op het printje moet leesbaar blijven (donker
thema, lichte inkt). (5) Het masker is een avatar-onderdeel in de laag `glasses` (over de ogen); de oog-openingen zijn echte gaten (evenodd),
zodat de gekozen ogen zichtbaar blijven. Een nieuw ontgrendelsoort `{ egg: 'panter' }` naast `level` en `badge`; de validator kent de lijst
van eieren. (6) Confetti bij het vrijspelen via het bestaande `celebrate` (geen nieuwe confettistijl). (7) Het ei is niet via de back-up over
te dragen (device-local, zoals goud): op een nieuwe telefoon doe je het opnieuw. (8) Stuur/handboek: geen handboekrij (eieren staan niet in
het handboek); wél DEVICE-TEST rij 125 zonder de zin.

**Feitencheck (Fable, in de code).** `src/theme.ts`: `Theme = 'system' | 'light' | 'dark' | 'gold'`, `THEME_SETTING`, `GOLD_UNLOCKED_SETTING`,
`GOLD_THEME_UNLOCK`, `LOCAL_KEY`, `GOLD_FREE_KEY`, `PAPER` (theme-color meta), `isTheme`, `effectiveTheme(t, goldFree)`, `goldUnlockedByMaker`
(signal), `goldFreeMirror`, `eggRead`, `goldAvailable(i)`, `goldThemeFree()`, `initTheme` (leest `theme.goldUnlocked` en `theme`), `setTheme`,
`unlockGoldByMaker()`, `GOLD_TAPS`/`tapCounter`. `src/styles/base.css` r. 119–146 `:root[data-theme='gold']` (tokens incl. diet- en rarity-tokens);
`src/styles/shopping.css` r. 142 en `src/styles/xp.css` r. 24: `:root[data-theme='dark'], :root[data-theme='gold']` (gangpadkleuren, `--gold`).
`src/screens/StyleScreen.tsx`: `THEME_TILES`, `goldTileShown(s)`, `styleTiles('theme', s)`, `tileName` (`style.theme.gold`), r. 420 sub onder de
goudtegel (`style.goldUnlockedMaker`), `StyleState { theme, badgesOn, unlocked, disabled, goldByMaker }` (r. 502 vult `goldByMaker`).
`src/components/ExtraField.tsx` r. 100–124 `addText(raw)`: per deel `parseShopInput`, `ingredientByName`; niet herkend → `{ ing: null, aisle, qty,
unit, label: { nl, en } }` → `props.onAdd(item)`; `src/screens/ShoppingScreen.tsx` r. 388 `addItem(item)` → `addExtra` + snack (`showSnack`).
`src/domain/avatar.ts`: `AvatarUnlock = { level } | { badge; tier? }` (r. 54), `rarityFor(unlock, badge)` (r. 173), `isUnlocked(part, ctx: { level,
badgeTiers })` (r. 328); `src/components/AvatarSheet.tsx` r. 105 (sortering op level), r. 138/153/174 (locktekst: `avatar.lockedLevel`,
`avatar.lockedBadge`, `avatar.lockedSecret`, `avatar.lockLevel`), r. 238 `isUnlocked(p, ctx)`. `tools/validate-data.ts` `validateAvatarParts`
(r. 1223) en `checkAvatarSvg`; `data/avatar-parts.json`: 169 onderdelen, laag `glasses` 15, voorbeeld `glasses-round` (SVG in viewBox 0 0 100 100,
ogen rond (39,41) en (61,41)); `src/db/repo.ts` `DEVICE_LOCAL_SETTINGS` (r. 1566: 'theme', …, 'theme.goldUnlocked'). `src/celebrate.ts`:
`celebrate(...)`. i18n: `style.theme.gold` (xp.ts), `more.theme.*` (settings.ts), `avatar.*` (avatar.ts), `shop.*` (shopping.ts). DEVICE-TEST:
laatste rij 124; dit blok krijgt 125.

## 1. Gedrag

### 1a. Het ei, het thema en de kleuren (bouwer A: `src/domain/eggs.ts` [nieuw], `src/theme.ts`, `src/screens/ShoppingScreen.tsx`,
`src/screens/StyleScreen.tsx`, `src/styles/base.css`, `src/styles/shopping.css`, `src/styles/xp.css`, `src/db/repo.ts` (één regel), `src/i18n/xp.ts`,
`src/i18n/shopping.ts`, `tests/eggs.test.ts` [nieuw], `tests/theme.test.ts` (of waar `effectiveTheme` getest wordt))

- `src/domain/eggs.ts` (framework-vrij): `export const PANTER_PHRASES = ['leopard print', 'leopardprint', 'luipaardprint', 'luipaard print',
  'panterprint', 'panter print'] as const;` `export function foldEggText(s: string): string` (trim, kleine letters, diakrieten weg, spaties
  samengevoegd, een punt/uitroepteken aan het eind weg); `export function isPanterEggText(s: string | null | undefined): boolean`. Tests: elke
  zin, hoofdletters, "Leopard print!", niet "leopard prints", niet leeg.
- `src/theme.ts`: `Theme` += `'panter'`; `PAPER.panter = '#14110d'`; `PANTER_UNLOCKED_SETTING = 'theme.panterUnlocked'`, `PANTER_COLOR_SETTING =
  'theme.panterColor'`, `PANTER_FREE_KEY = 'recepten.theme.panterFree'`, `PANTER_COLOR_KEY = 'recepten.theme.panterColor'`; `export type PanterColor =
  'klassiek' | 'roze' | 'sneeuw' | 'paars'` (`PANTER_COLORS`, default 'klassiek'); signalen `panterUnlocked`, `panterFreeMirror`, `panterColor`;
  `panterAvailable(i: { unlocked: boolean; mirror: boolean; eggRead: boolean })` = unlocked, of (nog niet gelezen én mirror) — zelfde optimisme
  als goud; `panterThemeFree()`; `effectiveTheme(t, goldFree, panterFree)` (een niet-vrije 'panter' → 'system'); `initTheme` leest ook
  `theme.panterUnlocked` en `theme.panterColor` en zet `data-panter` op `<html>` zodra het thema panter is (en verwijdert het anders);
  `setPanterColor(c)` (setting + spiegel + attribuut); `unlockPanterEgg(): Promise<'unlocked' | 'already'>` — zet `theme.panterUnlocked`, de spiegel,
  en schakelt het thema meteen naar 'panter' (`setTheme('panter')`; besluit Fable: anders zie je niets gebeuren). Tests: `effectiveTheme` met
  panter vrij/niet vrij; `panterAvailable` (gelezen zonder vlag = false, spiegel vóór lezen = true).
- `src/db/repo.ts`: `DEVICE_LOCAL_SETTINGS` += 'theme.panterUnlocked', 'theme.panterColor'.
- (Na de lens: de controle zit op de HELE getypte regel, vóór splitsen en parsen: `ExtraField` krijgt een prop `onLine(line) => boolean`, die
  ShoppingScreen vult met `eggLine`; alleen Enter/+ en "Voeg toe als tekst" met precies de zin tellen, een hoeveelheid, een komma-lijst of een
  geplakte lijst niet.) Oorspronkelijk: `src/screens/ShoppingScreen.tsx` `addItem(item)`: vóór `addExtra`: `const typed = item.ing ? null : (item.label?.nl || item.label?.en || null)`;
  als `isPanterEggText(typed)`: `const r = await unlockPanterEgg()`; `showSnack(t(r === 'unlocked' ? 'shop.panterEgg' : 'shop.panterAgain'))`; bij
  'unlocked' ook `celebrate` zoals de bestaande milestone-viering (de bouwer gebruikt de bestaande aanroep die het level-up-moment gebruikt;
  bestaat er geen losse aanroep, dan de gewone confetti); geen `addExtra`, geen undo. Niets anders in het pad verandert (meerdere regels,
  herkende producten, de V6-sheet).
- CSS. `src/styles/base.css`, direct onder het goudblok:
  ```css
  /* V1c-10: the leopard theme (Gabi's egg). Dark base like gold; the print lives on the body background and the header/nav bar,
     never on cards or behind body text. Per colour only the five --panter-* tokens and the accent change. */
  :root[data-theme='panter'] {
    color-scheme: dark;
    --paper: #14110d; --card: #1e1812; --ink: #f4ead6; --muted: #c9b48e;
    --cobalt: #d9a441; --tomato: #ef6a55; --rosemary: #9fcf8a; --orange: #e0863a;
    --line: rgba(217, 164, 65, 0.22); --press: rgba(217, 164, 65, 0.16); --on-cobalt: #1a1206; --on-rosemary: #15120c;
    --panter-base: #d9a441; --panter-spot: rgba(0, 0, 0, 0.28); --panter-ring: rgba(217, 164, 65, 0.22);
    /* diet and rarity tokens: copy the gold block */
  }
  :root[data-theme='panter'][data-panter='roze']  { --cobalt: #ff6fae; --panter-base: #ff6fae; --panter-ring: rgba(255, 111, 174, 0.24); --line: rgba(255, 111, 174, 0.22); --press: rgba(255, 111, 174, 0.16); --on-cobalt: #2a0f1d; --orange: #ff9a6a; }
  :root[data-theme='panter'][data-panter='sneeuw'] { --cobalt: #d8dfe6; --panter-base: #cfd6dd; --panter-ring: rgba(216, 223, 230, 0.22); --line: rgba(216, 223, 230, 0.2); --press: rgba(216, 223, 230, 0.14); --on-cobalt: #141a21; --paper: #101317; --card: #181d24; --ink: #eef2f6; --muted: #aab4c0; }
  :root[data-theme='panter'][data-panter='paars'] { --cobalt: #b48cf0; --panter-base: #b48cf0; --panter-ring: rgba(180, 140, 240, 0.24); --line: rgba(180, 140, 240, 0.22); --press: rgba(180, 140, 240, 0.16); --on-cobalt: #1a1030; --paper: #130f1c; --card: #1c1626; }
  /* the print: rosettes = a dark spot with a ring in the accent, two offset layers, tile 44×40 px */
  :root[data-theme='panter'] body {
    background-color: var(--paper);
    background-image:
      radial-gradient(ellipse 7px 5px at 9px 11px, var(--panter-spot) 58%, transparent 62%),
      radial-gradient(ellipse 11px 9px at 9px 11px, transparent 56%, var(--panter-ring) 60%, var(--panter-ring) 70%, transparent 74%),
      radial-gradient(ellipse 6px 5px at 31px 29px, var(--panter-spot) 58%, transparent 62%),
      radial-gradient(ellipse 10px 8px at 31px 29px, transparent 56%, var(--panter-ring) 60%, var(--panter-ring) 70%, transparent 74%);
    background-size: 44px 40px;
  }
  :root[data-theme='panter'] .screen { background: transparent; }   /* only if .screen has its own paper background today */
  :root[data-theme='panter'] .header, :root[data-theme='panter'] .nav { background-color: var(--card); background-image: <same four layers at 70 % of the alpha>; }
  ```
  De bouwer controleert op 360 px dat elke tekst op het printje (kopjes, muted regels, lege-staten) leesbaar blijft; zo niet, dan het printje
  op `body` lichter (alpha omlaag) en nooit op `.card`. `shopping.css` r. 142 en `xp.css` r. 24: `:root[data-theme='panter']` bij de
  dark/gold-selectoren. Thema-meta (`PAPER`) per variant mag één donkere kleur blijven.
- `src/screens/StyleScreen.tsx`: `THEME_TILES` += 'panter'; `StyleState.panterFree: boolean` (uit `panterThemeFree()`), tegel alleen als vrij
  (`panterTileShown`); naam `style.theme.panter`, icoon 🐆, sub onder de tegel `style.panterSecret`; als `s.theme === 'panter'`: onder de
  tegels een `Segmented` **Kleur** (`style.panterColor`) met `style.panterColor.klassiek` · `.roze` · `.sneeuw` · `.paars` → `setPanterColor`.
- i18n: xp.ts `style.theme.panter` "Panter" · "Leopard"; `style.panterSecret` "geheim ontdekt" · "secret found"; `style.panterColor` "Kleur" ·
  "Colour"; `style.panterColor.klassiek` "Klassiek" · "Classic"; `.roze` "Roze" · "Pink"; `.sneeuw` "Sneeuwpanter" · "Snow leopard"; `.paars` "Paars" ·
  "Purple". shopping.ts `shop.panterEgg` "🐆 Panterprint vrijgespeeld! De kleuren staan onder Jouw stijl → Thema." · "🐆 Leopard print unlocked!
  The colours are under Your style → Theme."; `shop.panterAgain` "🐆 Je hebt dit al. Grrr." · "🐆 You already have this. Grrr."

### 1b. Het masker (bouwer B: `data/avatar-parts.json`, `src/domain/avatar.ts`, `src/components/AvatarSheet.tsx`, `tools/validate-data.ts`,
`src/i18n/avatar.ts`, `tests/validate-badges.test.ts` of het avatar-testbestand, `tools/avatar-sheet.ts` alleen als nodig)

- `AvatarUnlock` += `{ egg: string }`; `export const EGG_IDS = ['panter'] as const`; `rarityFor`: egg → 'legendary'; `isUnlocked(part, ctx)` met
  `ctx.eggs?: ReadonlySet<string>`: `'egg' in u → ctx.eggs?.has(u.egg) === true`. `normalizeAvatarParts`: een `egg` buiten `EGG_IDS` → onderdeel
  overslaan (zoals andere ongeldige). AvatarSheet: de ctx krijgt `eggs: new Set(panterUnlocked.value ? ['panter'] : [])` (signal uit theme.ts;
  bouwer A exporteert hem — bestaat hij nog niet, importeer hem toch en meld het); sortering r. 105: egg zoals badge (achteraan); locktekst
  `avatar.lockedEgg` "Komt vrij met een geheim." · "Unlocks with a secret." (lijst) en `avatar.lockEgg` "Geheim" · "Secret" (kort label), op de
  plekken van r. 138/153/174.
- Validator `validateAvatarParts`: `unlock` mag `{ egg }` zijn met `egg` uit `EGG_IDS`; anders fout. Test: geldig egg-onderdeel, onbekend ei
  geweigerd.
- Het onderdeel, in `data/avatar-parts.json` achter de laatste bril: `{ "id": "glasses-panter", "layer": "glasses", "nl": "Pantermasker", "en":
  "Leopard mask", "unlock": { "egg": "panter" }, "rarity": "legendary", "svg": "…" }`. SVG (viewBox 0 0 100 100, zelfde ooghoogte als de brillen:
  ogen rond (39,41) en (61,41)): een maskerade-masker van x 23 tot 77, y 31 tot 50, met twee oog-openingen (ellips r 6×4,5 op (39,41) en (61,41))
  als gaten (`fill-rule="evenodd"`), basiskleur `#d9a441`, zes tot acht donkere vlekken `#2a1b0c` met halve ringetjes `#6b4a1a` (de rozetten),
  dunne rand `#2a2420` 1,2 px, en aan beide zijkanten een kort lintje naar de oren (`#2a2420`, 1,5 px). Leesbaar op 48 px (de lijst) én op de
  grote avatar. `npm run validate:data` groen (`checkAvatarSvg`).

### 1d. Herontwerp V1c-10b: het echte printje, twee smaken, zwarte balken, labels (Fable, 15 nov 2026)

Aanleiding (Stijn, 15 nov, met twee voorbeeldfoto's): "het ziet er nu gewoon uit als goud-modus met een schrale achtergrond; ze wil ook hot
pink & black, dus eigenlijk twee panteropties; de letters zijn nu ook goud, sommige bruin en sommige geel is een goed idee; doe meer je best."
Tweede correctie tijdens het bouwen: "nu ziet het eruit als tepels, blijf dichter bij mijn voorbeelden" → de bruine kern vult de hele binnenkant
van de zwarte ring (de ring zit óp de rand van de kern), geen bolletje in een lege ring.

- **Het printje** is een naadloze SVG-tegel van 216 × 216 px, gegenereerd door `tools/panter-tile.py` (Python, geseed met 23; `python
  tools/panter-tile.py` schrijft de twee data-URI's tussen de markers `/* @panter-tiles */` in `src/styles/panter.css`; `… 7 preview` geeft een
  andere seed en schrijft `scratch/panter-*.svg`). Geometrie: een gejitterd 5 × 5-raster van rozetten (oneven rijen een halve cel verschoven),
  elke rozet een grillige kern (quadratische beziers rond zes punten) met twee of drie dikke zwarte boogstukken (5–7 px, ronde uiteinden) óp
  de rand van de kern, een deel massieve vlekken (Klassiek 14 %, Roze 38 %) en negen kleine vlekjes; rozetten aan een rand komen met `<use>`
  aan de overkant terug (naadloos). Kleuren Klassiek: zand `#dab672`, zwart `#1a1411`, bruin `#8e5f36`; Roze: hot pink `#ff2d93`, zwart `#140b10`,
  lichtroze `#ff5fae`.
- **Eén blad** `src/styles/panter.css` (door `src/main.tsx` als laatste geïmporteerd, dus het wint op volgorde) bezit alles wat panter is; de
  oude blokken in base.css, shopping.css en xp.css zijn weg. Twee smaken op `data-panter`: **Klassiek** = LICHT thema (het printje is de pagina;
  `--card` crème `#fbf4e3`, `--ink` `#2a1a08`, `--muted` bruin `#7a5a33`, `--cobalt` zwart `#1a1411` met `--on-cobalt` zand, kaartkopjes bruin
  `--panter-head #6b4318`, accentwoorden oker `--panter-ochre #a06f1c`; alle diet-, rarity-, `--gold`- en gangpadtokens de lichte waarden) en
  **Roze (Hot pink & zwart)** = DONKER thema (`--card` `#15101a`, `--ink` `#ffe9f4`, `--cobalt` `#ff3d9c`, kopjes en accenten roze; de donkere
  tokens). Kop- en navigatiebalk zijn in beide smaken zwart (`--panter-bar`) met zand- of roze letters (`--panter-bar-ink`), knoppen in de balk
  transparant met die letters. De statusbalk-kleur (theme-color) is per smaak de balk (`PANTER_BAR` in theme.ts), niet het papier.
- **Leesbaarheidsregel: tekst staat nooit los op het printje.** Kaarten, sheets, chips en knoppen waren al vlakken; nieuw in panter.css:
  `ul.list` en `.menu` worden panelen (kaartkleur, rand, radius), `.letter`/`.group-head` krijgen een crème label achter de letter (`::before`),
  `ul.ing` (ingrediënten) een paneel, en een generieke regel maakt van losse `h1–h4`, `label`, `dt`, `.muted` een inline label en van losse
  `p`/`dd` een paneel — "los" = niet binnen `.card, .menu, ul.list, .sheet, .tonight, .row, .chip, .btn, …` (`:not(:is(…) *)`). Daarbovenop
  gerichte regels: `.home-hello` (paneel) en `.home-level` (pil in oker), `.az-rail`, `.badge-gtabs` (tabstrip), `.style-tile-name`/`.style-tile-sub`,
  `.setting` buiten een menu, `.detail-cat-name`/`.link-btn`/`.recipe-meta`/`.diet-label`/`.list-count`, `.ing-header`/`.cook-kicker`/`.field > span`,
  en `.btn-secondary` krijgt een crème vulling. Gecontroleerd in de dev-app op 434 px en 375 px, beide smaken: Home, Recepten (filters, lijst,
  A–Z), recept (kop, categorie, versies, ingrediënten, stappen), kookstand, nieuw recept, Boodschappen, Week, Meer (menu's, Aantal personen),
  Jouw stijl (tabs, tegels, Kleur), Badges, Mijn profiel, Huishouden, Handleiding, In & uit, Woordenboek.
- **Twee kleuren** (`PanterColor = 'klassiek' | 'roze'`): een opgeslagen 'sneeuw' of 'paars' van de eerste versie valt terug op Klassiek
  (`isPanterColor` kent ze niet meer). Labels: Klassiek · Classic; Hot pink & zwart · Hot pink & black. De tegel Panter in Jouw stijl toont het
  printje zelf als vlakje (`.style-swatch-theme[data-theme-swatch='panter'][data-panter-swatch=…]`), in de gekozen smaak.

### 1e. Panterconfetti (Fable, 15 nov 2026; Stijn: "die panterconfetti is echt een goed idee")

- `src/celebrate.ts`: `PANTER_CONFETTI_STYLE = 'panter'`; `usableConfettiStyles()` en de mix (`pickStyle`) krijgen 'panter' erbij zolang het
  panterthema vrij is (`panterThemeFree()`, badges aan of uit — geen unlock, zoals het thema zelf; `eggConfettiStyles()`). Het ei viert met
  `celebrate('milestone', { style: PANTER_CONFETTI_STYLE })`.
- `src/components/Confetti.tsx` look `panter`: 110 snippers in twee golven (0 en 160 ms), factor 1,15; drie soorten: p0 zand met twee zwarte
  vlekjes (45 %), p1 zwart, p2 zand met één rozet (bruine kern in zwarte ring). De kleuren zijn de tokens `--pc-base/--pc-spot/--pc-core` uit
  panter.css: op `:root` zand/zwart/bruin (zodat de look ook onder een ander thema werkt), onder Roze hot pink/zwart/lichtroze; de vlekjes zijn
  radial-gradients op `.confetti i.panter.p0/.p2`.
- Jouw stijl → Confetti: tegel **Panterconfetti** (🐆, "geheim ontdekt") direct na Gewoon, alleen zodra het ei gevonden is (`StyleState.panterFree`),
  nooit met een mix-schakelaar (`inMix` null); `shownConfettiStyle` kent 'panter' als bruikbaar zolang vrij. i18n `style.confetti.panter`;
  de ei-snackbar zegt nu "Thema, panterconfetti en masker staan onder Jouw stijl."

### 1f. Het masker, tweede tekening (Fable, 15 nov 2026)

`glasses-panter` opnieuw getekend in de kleuren van het printje: een maskerade-masker van x 22 tot 78 met opgetrokken kattenooghoeken, zand
`#dab672` met zwarte rand `#1a1411` (1,4 px), twee echte oog-gaten (ellips 6,5 × 4,8 op (39,40.5) en (61,40.5), evenodd), vijf rozetten (bruine
kern `#8e5f36` met twee zwarte boogstukken) op de wangen, de brug en onder de ogen, vier kleine zwarte vlekjes, en aan beide kanten een lintje
naar de oren. Beoordeeld op 220 px en 48 px (scratch-voorbeeldpagina met face-round/eyes-dots en face-oval/eyes-happy): de ogen blijven zichtbaar.

### 1g. Het printje scrolt mee op halve snelheid (V1c-10c, Fable, 15 nov 2026; Gabi: "make the background scroll along, but twice as slow")

- `src/panter-parallax.ts` (nieuw, `initPanterParallax()` vanuit `src/main.tsx`): het printje staat niet meer op `body` maar op een vaste laag
  `#panter-bg` (panter.css: `position: fixed`, één tegel hoger dan het venster, `z-index: -1`, verborgen onder elk ander thema; body blijft
  effen `--paper`). Scroll-events van elke `.screen` worden op het document gevangen (capture, passive); per frame (rAF) krijgt de laag
  `translate3d(0, -(scrollTop × 0,5 mod 216) px, 0)` — alleen een transform (compositor, geen repaint), en de modulo op de tegelhoogte houdt de
  laag klein hoe lang de lijst ook is. Een routewissel zet de laag terug op 0 (de nieuwe `.screen` begint bovenaan). `prefers-reduced-motion`
  → de laag staat stil. Pure delen (`panterOffset`, `scrolledScreen`) in `tests/panter-parallax.test.ts`.

### 1h. Leesbaarheidsronde (V1c-10c; Gabi: "some things are hard to read … check black/beige text without a white background")

- Runtime-audit in de dev-app: een script loopt per scherm over alle tekstnodes in `.screen` en meldt elke node zonder voorouder met een dekkende
  achtergrond (alpha ≥ 0,85, een background-image, of een `::before` met achtergrond). Gevonden en in panter.css gerepareerd: Home `.home-continue`,
  `.standing-home-link`, `.card.reminder` (was transparant met stippelrand), `.cooked-list`-rijen; recept `.nutri-line` (de kcal-regel), `.vtab.dotted`
  (een dieetversie die nog niet bestaat), `.servings-text`, `.timer-chip`; kookstand `.cook-progress`; editor `.le-num`, `.le-tag`; Meer `.more-profile`;
  Mijn profiel het losse `.xp-block`; In & uit `.inbox-tab`, `.inbox-history-toggle`; Deel `.status` (tekens); elke `.empty` (lege staat van
  Boodschappen, In & uit, Nakijken); de checkpagina `.checkrow`; plus panelen voor toestanden met inhoud: `.shop-block`, `.shop-aisle`, `.week-slots`,
  losse `.pr-row`/`.standing-row`. Daarna gaf de audit op elk scherm (Home, Recepten, recept, kookstand, nieuw/bewerk, Week, Boodschappen, Meer,
  profiel, huishouden, Jouw stijl × 5 tabbladen, Badges, kalender, woordenboek, handleiding, opslag, nakijken, In & uit, verhaal, Deel, check,
  onboarding) nul losse tekstnodes. Een parallelle code-audit (workflow wf_f374616f-209, tien lezers per schermgroep) ving de toestanden die de
  dev-app niet toonde; de uitkomst staat in STATUS.

### 2. Opus mag dit NIET zelf beslissen
- De zinnen in `PANTER_PHRASES`; één regel, precies de zin; niets op de lijst; het thema schakelt meteen om; geen handboekrij; de manier van
  vrijspelen alleen in dit bestand.
- (V1c-10b) Twee kleuren, Klassiek en Hot pink & zwart; device-local; het printje is de pagina, de balken zijn zwart, tekst staat nooit los op het printje.
- Eén masker in de laag `glasses`, legendary, ontgrendeld door het ei (geen level, geen badge).
- Geen nieuwe dependency. (V1c-10b: wél een eigen confettilook 'panter', geen unlock.)

### 3. Bestandsverdeling
| Bouwer | Bestanden |
|---|---|
| A | `src/domain/eggs.ts`, `src/theme.ts`, `src/screens/ShoppingScreen.tsx`, `src/screens/StyleScreen.tsx`, `src/styles/base.css`, `src/styles/shopping.css`, `src/styles/xp.css`, `src/db/repo.ts`, `src/i18n/xp.ts`, `src/i18n/shopping.ts`, `tests/eggs.test.ts`, de theme-tests |
| B | `data/avatar-parts.json`, `src/domain/avatar.ts`, `src/components/AvatarSheet.tsx`, `tools/validate-data.ts`, `src/i18n/avatar.ts`, avatar-/validator-tests, `tools/avatar-sheet.ts` (alleen als nodig) |
| Integrator | samenvoegen, check/test/build/validate groen, acceptatie in de dev-app (NL/EN: het ei via het plakvak, snackbar, thema meteen panter, Jouw stijl → Thema: tegel Panter + Kleur met vier opties, elk bekijken op Home/Recepten/recept/Boodschappen/Meer op 360 px, het masker onder Bril vrij en op de avatar), `docs/DEVICE-TEST.md` rij 125 (NL + EN) ZONDER de zin: "Gabi weet hoe je het vrijspeelt" + verwachtingen, `docs/STATUS.md` (kop, alinea zonder de manier van vrijspelen; verwijs naar docs/specs/ei-gabi.md als spoiler), de regel "Gebouwd" in dit bestand |
