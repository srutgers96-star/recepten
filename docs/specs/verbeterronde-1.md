# Spec V1 — Verbeterronde 1 (Stijn, 8 nov 2026, na het testen)

Status: compleet (Fable, 8 nov 2026). Eén blok, vier bouwers + integrator (lichte modus). Bron: drie berichten van Stijn op
8 nov na het testen van de app op zijn telefoon (letterlijk in §0). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
CLAUDE.md (invarianten, huisregels), docs/specs/handbook.md §4 (schrijfregels van de handleiding).
Gebouwd: 8 nov 2026 (V1, lichte workflow wf_3ec5d3a4-1a9; afwijking van §1c punt 5: `more.manageProfiles` is verwijderd, want de knop op Huishouden gebruikt `household.manageProfiles` en de test duldt geen dode sleutel; §1c punt 7 was al zo: HomeLevelRow ging al naar /more/profile; handboekrij voor de chips = `recepten.labels-categorieen`; `.hb-section` kreeg het Meer-ritme 14px 0 4px (Fable))

**Kritische lezer (Fable, vooraf).** (1) De kopjes op Meer zijn vandaag al een gecentreerd kobalt bijschrift geworden (commit
cb779b2, alleen CSS in settings.css); V1 maakt daar één gedeelde component van, zodat de handleiding er precies zo uitziet.
(2) "Profielen eruit" betekent NIET dat de profielmachinerie weggaat: `activeProfile`, XP per lid, favorieten en kooklog hangen
aan een profiel-id (invariant 1). Alleen de ingangen verdwijnen; een telefoon die al meer dan één profiel heeft, houdt één
eerlijke rij zodat niemand gegevens kwijtraakt. (3) De route naar Huishouden blijft "Meer → Huishouden" heten: alle bestaande
DEVICE-TEST-rijen en handboekrijen met dat pad blijven kloppen. (4) De chipvolgorde (gekozen vooraan) geldt overal waar
`PickChips` staat (Home, Recepten, Kies-N-venster): één gedrag, geen uitzondering per scherm.

**Feitencheck (Fable, in de code).** Handleiding: `HandbookScreen.tsx` toont per onderwerp een `<h2>`, de intro
(`s.intro[l]`) en `<details class="hb-row">` per rij (dicht zonder zoekopdracht, open mét); zoektekst in een module-signal
`query`. Meer: `Group()` in `MoreScreen.tsx` (h2.more-group-head → button → span.more-group-title + badge + `<Chevron/>`),
groep "you" = Mijn profiel · Profielen beheren · Huishouden · 🏆 Badges (alleen met badges aan) · 📅 Kookkalender · 🎨 Jouw
stijl · stepper Aantal personen. Huishouden-leden: `membersFrom(profiles.value, household)` (src/domain/household.ts),
vrienden en levels van anderen uit `getProgressSnapshots()` (`friend: true`; HouseholdScreen.tsx regels 362–394 voor de
levelregels). Profiel-ingangen: Meer-rij, knop "Profielen beheren" onderaan de ledenkaart op Huishouden (regel ±702),
HomeLevelRow (tik → '#/more/profiles'), ProfileEditFields na Verwijder, ProfileScreen zonder profiel. Chips: `PickChips` in
`src/components/PickSheet.tsx` (regel 211–281): × wissen, "Ook bijgerechten & zoet", zoekchip, dan tags, dan categorieën in
data-volgorde; `loadPickFilter`/`savePickFilter` (regel 137–158) bewaren de keuze in localStorage zonder tijdstempel, dus
voor altijd. Categorieën in data/categories.json: bijgerecht (25 recepten), nagerecht/gebak/ontbijt-lunch (0 recepten; de
chips bestaan sinds 6B, de corpus heeft ze nog niet nodig gehad).

## 0. Wat Stijn vroeg (8 nov 2026, letterlijk)

1. "in de handleiding mogen de grote kopjes: recepten, koken, eerste keer etc. standaard ingeklapt zijn, is nu een hele grote
   pagina. de uitleg eronder mogen overal weg, en de handleiding mag ook zo netjes dubbel uitklapbaar zijn als meer nu."
2. "doe ook in meer de badges maar weg aangezien die al in het profiel staan, huishouden mag soortvan onder profiel komen,
   waarbij ik meteen gewoon iets kleiner dan mijn eigen profiel gabi zie staan. de profielen functie mag wat mij betreft
   eruit. ik zie het meer als huishouden en vrienden, denk dat niemand op 1 apparaat meerdere profielen gaat gebruiken dus nu
   is dat verwarrend."
3. "als in recepten bijvoorbeeld hartige taart is geselecteerd, onthoud hij dat heel lang en dan heb ik soms niet door dat
   die nog geselecteerd is, hij staat ook helemaal rechts. hij mag het van mij wel iets sneller vergeten. als dat niet handig
   is, kan je alle geselecteerde dingen duidelijker onder de dingen die je kan selecteren zetten, met een klein kruisje in de
   highlighted categorie."

Besluiten Fable: bij 3 doen we allebei (sneller vergeten én gekozen chips vooraan met een kruisje). Bij 2 blijft de
profielmachinerie; alleen de ingangen gaan weg (zie Kritische lezer 2).

## 1. Gedrag

### 1a. Eén uitklapkop voor Meer én de handleiding (`FoldHead`)

Nieuwe component `src/components/FoldHead.tsx` (bouwer A), de kop die Meer sinds cb779b2 heeft, nu gedeeld:

```tsx
import type { ComponentChildren } from 'preact';
export function FoldHead(props: { title: string; open: boolean; onToggle: () => void; controls?: string; badge?: ComponentChildren }) {
  return (
    <h2 class="fold-head">
      <button type="button" aria-expanded={props.open} aria-controls={props.open ? props.controls : undefined} onClick={props.onToggle}>
        <span class="fold-title">{props.title}</span>
        {props.badge}
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </h2>
  );
}
```

CSS in `src/styles/base.css` (bouwer A; letterlijk, dit is de kop die nu in settings.css onder `.more-group-head` staat):

```css
/* ---------- Fold head (V1): the caption of a collapsible group on Meer and in the handbook ---------- */
/* Centred, cobalt, small capitals between two rules (::before/::after), badge and chevron right after
   the name, 44 px tap target; the rows under it stay left-aligned in the ink colour, so a glance tells
   a head from an item (Stijn 8 nov 2026). The chevron turns when the group is open (aria-expanded). */
.fold-head { margin: 0; font-size: 13px; }
.fold-head > button {
  display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 44px;
  padding: 4px 0; border: 0; border-radius: 8px; background: transparent; color: var(--cobalt); font: inherit;
  font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.fold-head > button::before, .fold-head > button::after { content: ''; flex: 1; height: 1px; background: var(--cobalt); opacity: 0.35; }
.fold-head > button:active { background: var(--press); }
.fold-head .fold-title { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fold-head .menu-badge { flex: none; letter-spacing: 0; text-transform: none; user-select: none; -webkit-user-select: none; }
.fold-head .chev { flex: none; width: 16px; height: 16px; color: inherit; opacity: 0.8; transition: transform 0.15s; }
.fold-head > button[aria-expanded='true'] .chev { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .fold-head .chev { transition: none; } }
```

Meer (bouwer B) vervangt in `Group()` de eigen `<h2 class="more-group-head">…</h2>` door `<FoldHead title=… open=… onToggle={() =>
props.onToggle(props.id)} controls={bodyId} badge={!props.open && props.badge ? <span class={'badge menu-badge' + (props.badgeTone ===
'red' ? ' badge-next' : '')}>{props.badge}</span> : undefined} />` en haalt uit settings.css alle regels `.more-group-head …`
en `.more-group.open .more-group-head .chev` weg (ook het reduced-motion-blok ervan); `.more .more-group { margin: 14px 0 4px }`,
`.more-group-body`, `.more-group-body > .card`, `.more .more-storage` en `.more-sub` blijven. `Chevron()` in MoreScreen.tsx blijft
bestaan voor `MenuRow`.

### 1b. De handleiding: dubbel uitklapbaar, standaard dicht, zonder intro's

`src/screens/HandbookScreen.tsx` + `src/styles/handbook.css` (bouwer A):

- Elk onderwerp krijgt bovenaan een `<FoldHead>` met de onderwerptitel (Eerste keer, Recepten, Koken, …). **Standaard zijn
  alle onderwerpen dicht**; de pagina is dan tien bijschriften onder elkaar. Tik → de rijen van dat onderwerp verschijnen, elk
  dicht (zoals nu: titel + eerste zin van "Wat het doet"); tik op een rij → de uitleg (ongewijzigd: Wat het doet · Waar je
  tikt · Wat je dan ziet · Goed om te weten · Open). Nog een tik op het bijschrift → dicht.
- De intro-alinea onder een onderwerptitel (`s.intro[l]`, class `hb-section-intro`) verdwijnt uit de app. De data houdt het
  veld `intro` (de validator en de Markdown-uitvoer docs/HANDLEIDING.md / HANDBOOK.md blijven ongewijzigd). De ene regel
  `handbook.intro` bovenaan de pagina blijft.
- Open onderwerpen staan in een module-signal `openTopics = signal<ReadonlySet<string>>(new Set())` naast `query`, zodat
  **Open** → terug het scherm in dezelfde stand terugvindt. Niet bewaren in localStorage (elk nieuw bezoek begint dicht).
- Zoeken: zoals nu tonen alleen de passende rijen, open, per onderwerp; tijdens een zoekopdracht staan de bijschriften van de
  getoonde onderwerpen open (ongeacht `openTopics`) en is de kop niet-interactief (`aria-expanded="true"`, onToggle no-op).
- De onderwerpchips in de kop: tik → dat onderwerp gaat open (toevoegen aan `openTopics`) én scrollt in beeld (bestaande
  `scrollToSection`).
- `.hb-section h2`-stijl in handbook.css vervalt (de kop is nu `.fold-head`); `.hb-section-intro` vervalt. Verder geen
  stijlwijziging aan rijen of uitleg.

### 1c. Meer, groep "Jij & je huishouden" (bouwer B)

Nieuwe inhoud van de groep, van boven naar beneden:

1. **Mijn profiel** — ongewijzigd (avatar 36 px met niveauring, naam, "Level n · titel" met badges aan) → `/more/profile`.
2. **Huisgenoten**, direct eronder, één rij per lid dat NIET het actieve profiel is: alle leden uit `membersFrom(profiles.value,
   household)` (lokale profielen én leden via kaartje of met de hand). Kleiner dan Mijn profiel: `MenuRow` met een extra class
   `row-member` (min-height 44 px, avatar 28 px via `<Avatar profile={m} />` met een override in settings.css, naam 15 px gewoon
   gewicht). Onder de naam (`sub`): met badges aan de levelregel zoals op Huishouden (lokaal lid: `useAvatarLevel` →
   `levelTitleText`; ander lid: snapshot-level + titel, zonder "bijgewerkt"); zonder level of met badges uit: "via kaartje" /
   "met de hand" (bestaande sleutels `household.fromCard`, `household.byHand`) of niets voor een lokaal profiel. Tik →
   `/more/household`.
3. **Vrienden** (`getProgressSnapshots()` met `friend: true`), zelfde rijvorm, `sub` = `more.friend` NL "Vriend" · EN "Friend",
   met badges aan gevolgd door " · Level n · titel". Tik → `/more/household`.
4. **Huishouden** — `MenuRow` label `more.householdRow` (bestaat: NL "Huishouden" · EN "Household"), nieuwe hint
   `more.householdRowHint` → NL "Leden, vrienden en je kaartje" · EN "Members, friends and your card"; zonder enig ander lid:
   hint `more.householdRowEmpty` NL "Voeg een huisgenoot toe" · EN "Add a housemate". → `/more/household`. (De rij heet nog
   steeds Huishouden: elk bestaand pad "Meer → Huishouden" blijft kloppen.)
5. **Profielen op deze telefoon** — ALLEEN als `profiles.value.length > 1`: `MenuRow` label `more.profilesHere` NL "Profielen op
   deze telefoon" · EN "Profiles on this phone", sub `more.profilesHereHint` NL "{n} profielen · tik om te wisselen" · EN
   "{n} profiles · tap to switch" → `/more/profiles`. Met precies één profiel: geen rij, geen spoor. De sleutel
   `more.manageProfiles` blijft bestaan voor de knop op Huishouden (zie 7).
6. 📅 **Kookkalender** en 🎨 **Jouw stijl** — ongewijzigd. De rij **🏆 Badges** vervalt (de badges staan als tegel op Mijn
   profiel; de route `/more/badges` blijft). De stepper **Aantal personen** blijft onderaan de groep.
7. Overige profiel-ingangen: `HomeLevelRow` (tik → `/more/profile` in plaats van `/more/profiles`; pas de kopcommentaarregel
   aan); knop "Profielen beheren" onderaan de ledenkaart op Huishouden alleen tonen als `profiles.value.length > 1`;
   `ProfileEditFields` (na Verwijder → `/more/profiles`) en `ProfileScreen` (geen profiel → `/more/profiles`) blijven zoals ze
   zijn (randgevallen die de verborgen pagina juist nodig hebben). De pagina Profielen zelf blijft bestaan en ongewijzigd.
8. Data: leden en snapshots laden zoals HouseholdScreen dat doet (`getHousehold`, `getProgressSnapshots`; `useEffect` zoals de
   rest van MoreScreen), één keer bij mount; `profiles` is al een signal.

i18n (bouwer B, src/i18n/settings.ts, NL én EN letterlijk uit deze spec): `more.friend`, `more.householdRowHint` (gewijzigd),
`more.householdRowEmpty`, `more.profilesHere`, `more.profilesHereHint`. tests/i18n.test.ts `SHORT_HINTS`: `more.householdRowHint`
blijft (de nieuwe zin is één korte zin), `more.householdRowEmpty` en `more.profilesHereHint` erbij.

### 1d. Recepten-chips: gekozen vooraan met een kruisje, en na drie uur vergeten (bouwer C)

`src/components/PickSheet.tsx`:

- **Volgorde** in de generieke rij (`pick-chips`): [× wissen] [Ook bijgerechten & zoet] [zoekchip] en dan **eerst alle gekozen
  tags en categorieën** (in hun bestaande onderlinge volgorde: tags vóór categorieën, binnen elke groep de data-volgorde),
  daarna de niet-gekozen in de bestaande volgorde. In de Keuken-rij (`CuisineChips`, src/components/FilterChips.tsx) ook:
  gekozen keukens vooraan. De Dieet-rij houdt haar vaste volgorde van vier (kort, altijd in beeld).
- **Kruisje**: elke gekozen chip (class `on`) in de generieke rij, de Keuken-rij en de Dieet-rij krijgt achter de tekst
  `<span class="chip-x" aria-hidden="true">×</span>` (CSS in browse.css: `margin-left: 6px; opacity: .85; font-weight: 700`).
  De chip blijft één knop: tikken zet hem uit (geen aparte knop). De losse `chip-clear` (×) vooraan blijft.
- **Vergeten**: `savePickFilter` schrijft `at: Date.now()` mee; `loadPickFilter` laat een opgeslagen keuze ouder dan
  `PICK_FILTER_TTL_MS = 3 * 3_600_000` (drie uur na de laatste wijziging) vallen (verwijdert de sleutel, geeft
  `EMPTY_PICK_FILTER`). `sanitizePickFilter` negeert `at`. Een keuze zonder `at` (van vóór V1) geldt als verlopen. Dit raakt elke
  bewaarde chipkeuze (Recepten `recepten.filters`, en elke andere sleutel die `loadPickFilter` gebruikt: bouwer C zoekt ze op en
  noemt ze in het rapport). Bestaat er een test voor `sanitizePickFilter`/`loadPickFilter`, voeg een TTL-geval toe; anders geen
  nieuwe testinfrastructuur.
- Geen nieuwe i18n-sleutels nodig.

### 1e. Handboek (bouwer D, alleen data/handbook/*.json + Markdown-uitvoer)

- 10-hulp: `hulp.handleiding`, `hulp.handleiding-zoeken`, `hulp.handleiding-onderwerpen`: "Wat je dan ziet" → tien bijschriften,
  dicht; tik op een bijschrift → de rijen; tik op een rij → de uitleg; chips openen een onderwerp.
- 08: `instellingen-en-opslag.profiel-toevoegen` + `profiel-wisselen` → samenvoegen tot één rij `instellingen-en-opslag.meer-profielen`
  "Meer dan één profiel op deze telefoon": een telefoon is normaal van één persoon, huisgenoten komen via Huishouden; staan er toch
  meerdere profielen op (van vroeger), dan staat onder Jij & je huishouden de rij **Profielen op deze telefoon**; daar wissel je met
  **Maak actief**. `per-profiel` herschrijven naar "per persoon" (wat van jou is en wat van de telefoon), `profiel-verwijderen` blijft
  (Mijn profiel → Verwijder). Nergens meer "Profielen beheren" als gewone stap.
- 07: `badges-xp.badges-bekijken`: route via **Mijn profiel** → **Badges** (niet meer Meer → Badges).
- 05: `delen-en-ontvangen.huishouden` (en `lid-toevoegen`, `kaartje-delen` waar ze het pad noemen): pad "Meer → Jij & je huishouden →
  Huishouden (onder je huisgenoten)"; vermeld dat huisgenoten en vrienden ook direct onder Mijn profiel staan.
- 02: `recepten.categorie-snel` en `recepten.zoeken`/`recepten.keukens`: gekozen chips staan vooraan met een kruisje; de keuze
  wordt na drie uur vergeten.
- Daarna `npm run validate:data` en `node --experimental-strip-types tools/handbook-md.ts`. Schrijfregels: docs/specs/handbook.md §4
  (geen jargon, knopnamen vet en letterlijk zoals de app ze toont).

## 2. Opus mag dit NIET zelf beslissen

De TTL-waarde (3 uur) · de volgorde in de groep Jij & je huishouden (§1c 1–6) · het uiterlijk van de kop (CSS §1a letterlijk) ·
de Profielen-pagina weghalen (nee: blijft, alleen de ingangen) · de rij Huishouden hernoemen (nee) · intro's uit de data of de
Markdown halen (nee: alleen uit de app) · handboekrijen schrappen buiten §1e · nieuwe dependencies (nee).

## 3. Bestandsverdeling

**Bouwer A — Uitklapkop + handleiding:** `src/components/FoldHead.tsx` [nieuw], `src/styles/base.css` (blok §1a onderaan),
`src/screens/HandbookScreen.tsx`, `src/styles/handbook.css`.
**Bouwer B — Meer + profiel-ingangen:** `src/screens/MoreScreen.tsx`, `src/styles/settings.css`, `src/i18n/settings.ts`,
`src/components/HomeLevelRow.tsx`, `src/screens/HouseholdScreen.tsx` (alleen de knop regel ±702), `tests/i18n.test.ts`. Gebruikt
`FoldHead` van A (bestaat het bestand nog niet bij jouw `npm run check`: meld het als open, de integrator voegt samen).
**Bouwer C — Chips:** `src/components/PickSheet.tsx`, `src/components/FilterChips.tsx`, `src/styles/browse.css`, en een bestaande
test over de pick-filter als die er is.
**Bouwer D — Handboek:** `data/handbook/*.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md` (gegenereerd). Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; acceptatie in de dev-app (375 px, NL én EN): handleiding start met tien
dichte bijschriften, onderwerp open → rijen dicht, rij open → uitleg, zoeken → open rijen, chip → onderwerp open; Meer: geen rij
Badges, onder Mijn profiel de huisgenoten (maak via `#/more/profiles` een tweede profiel om de rij "Profielen op deze telefoon" te
zien en verwijder het daarna weer), dan Huishouden; Recepten: kies "Hartige taart" → de chip springt vooraan met ×, tik op de chip
→ uit; zet in localStorage `recepten.filters` een `at` van vier uur geleden → herladen → geen keuze meer. DEVICE-TEST: nieuwe rij
109 "Verbeterronde 1 (V1)" NL én EN na rij 108 met precies deze acceptatiestappen; rij 55 stap 1–2 bijwerken (geen rij Badges;
huisgenoten onder Mijn profiel; Profielen beheren alleen bij meer dan één profiel); elke rij die "Meer → **Badges**" als pad
noemt → "Mijn profiel → **Badges**". STATUS-alinea en de regel "Gebouwd: …" in deze spec.

## 4. Niet in dit blok

De ring om een gekozen chip in "Deel je nieuwe recepten" (README §5, wacht op Stijn) · alles uit docs/IDEAS.md (apart plan).
