# Spec V1c-10 — Gabi's ei: het panterprint-thema (SPOILER — Stijn, niet lezen: jij wilde niet weten hoe het vrijspeelt)

Status: compleet (Fable, 15 nov 2026). Twee bouwers + integrator (lichte modus). Bron: Gabi, getypt op Stijns laptop (15 nov, Engels):
"if I click to shopping list and then only add leopard print and save, the leopard print theme would appear; there would be multiple
options for the colour theme, and a mask would unlock to put on the avatar." Stijn: "ze is jaloers op goud; zodat ik niet weet wat het is".
Leidend bij tegenspraak: docs/specs/README.md §2–§4, docs/specs/verbeterronde-5.md §1d (het gouden thema en het makers-ei: dit ei volgt
dezelfde plumbing), docs/specs/badges-avatar.md (avatar-onderdelen). De manier van vrijspelen staat ALLEEN in dit bestand: niet in STATUS,
niet in het handboek, niet in DEVICE-TEST (daar staat "Gabi weet hoe"), niet in commit-berichten.
Gebouwd: 15 nov 2026 (V1c-10, lichte workflow wf_6b027015-4e1; lens: twee bevindingen, allebei hersteld: de controle zit op de hele getypte regel via een prop `onLine` op ExtraField (niet in `addItem`, anders telde "2 leopard print" of "melk, leopard print" ook), en DEVICE-TEST rij 125 noemt het scherm niet; besluiten Fable: zo laten; bouwer A: nog eens vrijspelen zet het thema ook op Panter, `color-mix` voor de balken)

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

### 2. Opus mag dit NIET zelf beslissen
- De zinnen in `PANTER_PHRASES`; één regel, precies de zin; niets op de lijst; het thema schakelt meteen om; geen handboekrij; de manier van
  vrijspelen alleen in dit bestand.
- Vier kleuren met deze namen; device-local; het printje alleen op body en kop-/navigatiebalk; kaarten effen.
- Eén masker in de laag `glasses`, legendary, ontgrendeld door het ei (geen level, geen badge).
- Geen nieuwe dependency; geen nieuwe confettistijl.

### 3. Bestandsverdeling
| Bouwer | Bestanden |
|---|---|
| A | `src/domain/eggs.ts`, `src/theme.ts`, `src/screens/ShoppingScreen.tsx`, `src/screens/StyleScreen.tsx`, `src/styles/base.css`, `src/styles/shopping.css`, `src/styles/xp.css`, `src/db/repo.ts`, `src/i18n/xp.ts`, `src/i18n/shopping.ts`, `tests/eggs.test.ts`, de theme-tests |
| B | `data/avatar-parts.json`, `src/domain/avatar.ts`, `src/components/AvatarSheet.tsx`, `tools/validate-data.ts`, `src/i18n/avatar.ts`, avatar-/validator-tests, `tools/avatar-sheet.ts` (alleen als nodig) |
| Integrator | samenvoegen, check/test/build/validate groen, acceptatie in de dev-app (NL/EN: het ei via het plakvak, snackbar, thema meteen panter, Jouw stijl → Thema: tegel Panter + Kleur met vier opties, elk bekijken op Home/Recepten/recept/Boodschappen/Meer op 360 px, het masker onder Bril vrij en op de avatar), `docs/DEVICE-TEST.md` rij 125 (NL + EN) ZONDER de zin: "Gabi weet hoe je het vrijspeelt" + verwachtingen, `docs/STATUS.md` (kop, alinea zonder de manier van vrijspelen; verwijs naar docs/specs/ei-gabi.md als spoiler), de regel "Gebouwd" in dit bestand |
