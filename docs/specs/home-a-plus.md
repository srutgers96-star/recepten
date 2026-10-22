# Spec Home A+ — Home opnieuw ingedeeld: Vanavond, compacte week, rijen en de + in de kop

Status: compleet (Fable, 22 okt 2026)

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (docs/specs/README.md §2 heeft
de besluiten die over specs heen gelden; bij tegenspraak wint README.md). Voor deze spec:
- DEVICE-TEST-rijen 70 en 71 zijn definitief (de nummering loopt over alle specs: 13K 72–74, 6B 75–80,
  bijgerechten 81, 13F 82–85, 13D 86–88, 6C 89–91, 6D 92–100).
- `HomeLevelRow.tsx` is het slot dat **6D-1** vult met `LevelLine` (xp-levels.md §1b; 6D-1 bouwer C bezit
  dan dit bestand, niet HomeScreen.tsx). Na 6D-1 staat er géén badge-telling meer op Home; de ingang naar
  Badges is dan Meer → Badges. **6D-3** geeft in de begroeting `level` mee aan `<Avatar>` (één regel in
  HomeScreen.tsx, door 6D-3 bouwer C).
- **6B blok 3 en 4** raken na Home A+ niet HomeScreen.tsx maar `TonightCard.tsx` (keukenrij in de
  chips; dobbelsteenpool met `mainOnly`) en `WeekCard.tsx` (weekregel alleen hoofdgerechten).
- **6C blok 2** zet in de lege weekkaart van `WeekCard.tsx` de tekstlink `home.weekEmptyStanding` — NL
  **Alleen de vaste lijst ›** · EN **Just the every-week list ›** → `navigateTab('/shopping?tab=standing')`
  (key in src/i18n/browse.ts). Tot dan is de lege kaart ongewijzigd.
- **13K** houdt het `<TimerBar />`-slot en de componentnaam; alleen de inhoud wordt de kookbalk.
- `pickRandomId` trekt uit `ids.filter((id) => id !== not)` (als die lijst niet leeg is); geen
  do/while op `rng` (anders loopt de test met `rng = () => 0` vast).
- §6b check 4 en rij 70 stap 3: "1 ontvangen" verschijnt alleen voor een recept dat deze telefoon nog
  niet heeft (plak een link van een ander profiel/kanaal, niet van je eigen recept).
- Open vraag 1 (regel "🏆 Badges x/y ›" tot 6D) blijft staan; standaard = tonen.

Feitencheck Opus, 22 okt 2026: 17 correcties
- §1b ⚠: het huidige +-menu kent geen veeggebaar; vegen-om-te-sluiten zit alleen in CookedSheet.tsx.
- §1d ⚠: "In & uit"/"In & out" bestaat al als `inbox.title` en `nav.inbox` (key `home.inOut` blijft).
- §1d ⚠: de badge op de Meer-tab (`.nav-badge`) is `var(--tomato)`, niet cobalt (keuze cobalt blijft).
- §1g: tijd = `r.time?.total ?? r.time?.active` (time is optioneel/nullable); `categoryLabel` komt uit
  src/components/FilterChips.tsx en wil `id: string` → `r.category ?? ''`.
- §1j: bij een databasefout toont de rij de laatst bekende telling, "niets nieuws" alleen als de eerste
  telling al faalde.
- §2a: `badgeStatuses` staat in src/badges.ts, niet in repo.ts.
- §2b: voorbeeld-id `b:goulash` bestaat niet → `b:hongaarse-goulash` (data/recipes.json).
- §2c: plaats van de hergebruikte en weg-keys (browse.ts, week.ts, phase2.ts); `home.teaser` en
  `home.weekOpen` zijn nu al ongebruikt; ⚠ weghalen raakt ook week.ts en phase2.ts.
- §3 blok 1 A: `isListSort` bestaat maar RecipesScreen importeert hem nog niet.
- §3 blok 2 A ⚠: `LastViewed` uit src/recent.ts maakt "alleen Plan/PlanItem en Recipe" onwaar.
- §3 blok 2 A (aanvulling op die ⚠): src/domain importeert nu uitsluitend relatief binnen src/domain,
  nooit via `@/` of uit de app-laag.
- §3 blok 2 A ⚠: `isToday(iso)`/`localDay(d)` bestaan al in src/cooklog.ts (app-laag; keuze voor een pure
  `isSameLocalDay` blijft).
- §3 blok 2 B ⚠: de kaart-CSS hangt nu aan `.surprise` (browse.css én home.css, incl. de chip-bleed).
- §3 blok 2 integrator: ook `pickFilterActive` en `type PickFilter` verlaten HomeScreen.
- §6a: `tonightMode([], …)` compileert niet (Plan is een object) → `plan([])`.
- §6b check 4: alleen In & uit openen markeert niets als gezien; je moet het ontvangen recept aantikken.
- §6d rij 71: de dieetchip heet **Vegetarisch** / **Vegetarian** (`filter.vegetarisch`, met hoofdletter).
- Bevestigd (geen correctie): Dexie v7; `CategoryShelf` alleen op Home; alle "nieuwe" bestanden en keys
  bestaan nog niet; DEVICE-TEST rij 58 staat op regel 102/220, rij 69 op 113/231; routes `/inbox`,
  `/story`, `/more/badges`, `/add?mode=paste|ai` bestaan; `.add-menu`/`.list-add` staan in week.css.

Bouwspec door Fable (22 okt 2026) voor Opus 5.5. Bron: docs/home-voorstel.md (variant A + uit B: de rij
In & uit met tellingen en Plak als eerste keuze onder de +), Stijns keuze "A+" (docs/phase-6-spec.md 13A,
besluit 15 okt), 6D "Level en avatar op Home" (Stijn 16 okt: begroeting toont avatar en later "Level 6 ·
Oma" met XP-balkje; tot 6D er is het bestaande avatar-rondje; badges uit = geen level) en 13K (de kookbalk
krijgt de plek van de timerbalk; aparte spec docs/specs/kookbalk.md). Code gecontroleerd op 22 okt 2026
(HomeScreen, RecipesScreen, inbox-badge, repo, recent, Header, TimerBar, PickSheet, CategoryShelf).
Alles wat een keuze is, staat hier gekozen; bij twijfel §5.

## 1. Doel en gebruikersgedrag

**In één zin:** de vraag in de kop ("Vanavond?") krijgt meteen één antwoord op het scherm; de wekelijkse
acties (Kies 7, Boodschappenlijst) staan er direct onder; beheer (post, eigen recepten, verhaal) zakt naar
één regel per ding. Geen nieuwe data; alles komt uit wat de app al bewaart.

### 1a. Home van boven naar beneden (eindstand na blok 2)

```
Kop  "Vanavond?"                                   [+]  [NEXT]  [NL|EN]
(timerbalk — in 13K de kookbalk — precies hier, boven .screen)
 1  Begroetingsrij: avatar-rondje + "Hoi Stijn, wat eten we vanavond?"
    + levelregel-slot (tot 6D: "🏆 Badges 7/40 ›", alleen als badges aan)
 2  Kaart VANAVOND  (blok 2; tot dan de huidige kaart Verras me)
 3  Regel "Verder met: Goulash ›"  (blok 2; alleen als van toepassing)
 4  Deze week, compact  (blok 2; tot dan de huidige weekkaart) — of de lege kaart "Kies 7 voor deze week"
 5  Back-upkaart  (ongewijzigd; alleen als de back-up achterloopt)
 6  Rij  📥 In & uit        1 ontvangen · 2 te delen                ›
 7  Favorieten  (één scrollende chiprij, zoals nu)
 8  Laatst gekookt  (3 rijen, ★ Beoordeel blijft)
 9  Categorieën  (één scrollende rij tegels)
10  Rij  📒 Mijn recepten    22                                     ›
11  Rij  📖 Het verhaal van dit boek                                ›
```
Weg: de twee herinneringskaarten "nog niet gedeeld" en "In & uit" (→ rij 6), de sectie Eigen & ontvangen met
Selecteer en + (→ rij 10 en de + in de kop), de kaart Badges 7/40 (→ de levelregel in 1), de kaart Het
verhaal (→ rij 11). Blok 1 bouwt 1 en 5–11 plus de + in de kop en zet de blokken al in deze volgorde; de
oude kaarten Verras me en Deze week blijven in blok 1 op plek 2 en 4 staan. Blok 2 vervangt ze door 2–4.

### 1b. De + in de kop (blok 1)
Rechts in de kop van Home, vóór het NEXT-label en de NL|EN-pil, dezelfde knop als op Recepten:
`class="icon-btn list-add"`, `aria-label={t('list.add')}` ("Recept toevoegen" / "Add recipe"),
`aria-haspopup="dialog"`, hetzelfde plus-svg. Eén tik opent het menu `AddMenu` (nieuw component, §3; de
huidige inline-sheet van RecipesScreen wordt eruit gehaald en op BEIDE schermen gebruikt). Volgorde van de
vier rijen, in beide schermen: **Plak een recept** (`list.addPaste`) · **Zelf schrijven** (`list.addWrite`)
· **Met AI** (`list.addAi`) · **Kies een bestand** (`list.addFileChoice`), elk met de bestaande hint-regel
eronder. Gedrag per rij ongewijzigd (`/add?mode=paste`, `/add`, `/add?mode=ai`, bestandskiezer via
`openPastedText`). Het menu is een sheet via `SheetPortal` met `.sheet-head` (titel `list.add`, ×-knop
`common.close`); het bewaart niets, dus geen Annuleer/Bewaar-kop. Wegvegen of ernaast tikken sluit het.
⚠ Feitencheck: het huidige +-menu in RecipesScreen sluit alleen via ernaast tikken en ×; het kent geen
veeggebaar. Vegen-om-te-sluiten bestaat alleen in src/components/CookedSheet.tsx (eigen pointer-code,
`drag`-ref, ±regels 117–150), niet in SheetPortal of base.css. AddMenu moet dat gebaar dus zelf krijgen,
anders klopt "Veeg het venster naar beneden" in rij 70 stap 2 niet.
iPhone en Android: identiek (plakken gebeurt pas op het volgende scherm; de textarea daar blijft, invariant 5).

### 1c. Begroetingsrij en levelregel-slot (blok 1)
`<div class="home-hello">` met links het bestaande `<Avatar profile={profile} />` (uit
src/screens/ProfilesScreen.tsx; weg als er geen actief profiel is) en rechts de huidige
`<h2 class="home-greeting">` met `home.greeting` / `home.greetingAnon` (bestaande teksten). De avatar is
decoratie (`aria-hidden`), niet tikbaar; 6D maakt de hele rij tikbaar naar profiel/badges.
Direct onder de begroeting staat het slot `<HomeLevelRow profileId={pid} />` (nieuw component, §3). Tot 6D
rendert het, alleen als badges aan staan en de telling geladen is, één dunne regel
`🏆 Badges 7/40 ›` (tekst `home.badges` + `{earned}/{total}`), tik → `/more/badges`. Badges uit, geen
profiel of nog niet geladen → het component rendert `null` en de regel neemt geen ruimte in. 6D-1 vervangt
alleen de INHOUD van dit component door `LevelLine` (xp-levels.md §1b: avatar-rand + "Level 6 · Oma" +
XP-balkje, tik → `/more/profiles`); Home verandert dan niet en de Badges-telling verdwijnt van Home.

### 1d. Rij In & uit (blok 1)
Eén rij (`<a class="home-row">`, 52 px hoog, hele rij tikbaar) in een `.card.home-rows`:
icoon 📥 · titel `home.inOut` — NL **In & uit** · EN **In & out** · detail (grijs) · ›.
⚠ Feitencheck: dezelfde tekst bestaat al als `inbox.title` (src/i18n/edit.ts) en `nav.inbox`
(src/i18n/common.ts); de keuze voor een eigen key `home.inOut` blijft staan.
Detail = de niet-lege delen van [`home.inOutReceived` "{n} ontvangen" / "{n} received" als `inboxUnseen`
> 0, `home.inOutToShare` "{n} te delen" / "{n} to share" als `unsentChanges` > 0], gescheiden door " · ";
beide 0 → `home.inOutNothing` — NL **niets nieuws** · EN **nothing new**. Als `inboxUnseen` > 0 krijgt de
rij class `has-new` (detail in `var(--cobalt)`, zodat hij opvalt zoals de badge op de Meer-tab).
⚠ Feitencheck: die badge op de Meer-tab (`.nav-badge`, src/styles/base.css) is `var(--tomato)`, niet
cobalt; de keuze voor `var(--cobalt)` hier blijft staan.
Tik → `navigate('/inbox')` (In & uit toont daar zelf de kaart "nog niet gedeeld" met de link naar Deel je
nieuwe recepten; die kaart en de keys `home.unsent*` blijven, InboxScreen gebruikt ze). De rij staat er
altijd, ook bij "niets nieuws": hij is de ingang naar In & uit vanaf Home.

### 1e. Rij Mijn recepten en rij Het verhaal (blok 1)
Samen in één `.card.home-rows` onderaan:
- 📒 `home.myRecipes` — NL **Mijn recepten** · EN **My recipes**; detail = het aantal eigen + ontvangen
  recepten (`userRecipes().length`); 0 → `home.myRecipesNone` — NL **nog geen** · EN **none yet**.
  Tik → `navigateTab('/recipes?sort=ownReceived')`. RecipesScreen leest `?sort=<ListSort>` net als `?cat=`
  (§3): kiest die sortering (ook onthouden, precies alsof je de pil aantikte) en haalt de query uit de hash.
  Selecteer zit daar al in de kop; de lege staat daar is `list.emptyOwnReceived` (bestaat).
- 📖 `home.storyRow` — NL **Het verhaal van dit boek** · EN **The story of this book**; geen detail;
  tik → `navigate('/story')`.

### 1f. Favorieten, Laatst gekookt, Categorieën (blok 1)
- Favorieten: ongewijzigd (de `.chips`-strip scrolt al horizontaal; lege staat `home.noFavorites`).
- Laatst gekookt: `recentCooked(undefined, 3)` in plaats van 5; rijen, ★ Beoordeel (`?rate=<id>`) en lege
  staat `home.noCooked` ongewijzigd.
- Categorieën: `CategoryShelf` wordt één rij in plaats van twee (`grid-template-rows: auto`, tegels 148 px
  breed) en zakt onder Laatst gekookt. Alleen Home gebruikt het component (controleer met Grep; is dat
  niet zo, dan een prop `rows?: 1 | 2` met default 2 en Home geeft 1).
  Feitencheck 22 okt: klopt, alleen src/screens/HomeScreen.tsx importeert `CategoryShelf` (de CSS staat
  in src/styles/home.css: `.cat-shelf` met `grid-template-rows: repeat(2, auto)`, `grid-auto-columns:
  128px`); de prop `rows` is dus niet nodig.

### 1g. Kaart VANAVOND (blok 2, component `TonightCard`)
Eén kaart (`.card.tonight`) met bovenin klein `home.tonight` — NL **Vanavond** · EN **Tonight** (als
kopregel in kapitalen via CSS, zoals `.diet-label`). De kaart heeft drie standen (puur bepaald in
src/domain/tonight.ts `tonightMode`):
- **loading** — `recipes` of `plan` nog `undefined` → alleen de kopregel en `common.loading`.
- **plan** — het weekplan heeft minstens één niet-gekookt gerecht waarvan het recept bestaat, en de
  gebruiker heeft niet op "Iets buiten je week" getikt. De kaart toont dat gerecht:
  naam (knop `.surprise-name`, met de naam in de andere taal eronder via `otherLanguageName`), de
  metaregel, en twee knoppen: **Open** (`home.open`, primair → `/recipe/<id>`) en **🎲 Iets anders**
  (`home.tonightOther` — NL **Iets anders** · EN **Something else**, secundair). "Iets anders" gaat naar
  het VOLGENDE niet-gekookte gerecht van het plan (volgorde van `plan.items`, rond; `nextPlanItem`); is er
  maar één, dan is de knop `disabled`. Welk gerecht getoond wordt onthoudt de module in `planItemId`
  (zoals `surpriseId` nu), zodat Home na terugkomen hetzelfde laat zien; is dat gerecht intussen gekookt
  of uit het plan, dan valt het terug op het eerste niet-gekookte (`currentPlanItem`).
  Metaregel (grijs, delen met " · " via `tonightMeta`, lege delen weg, lege regel helemaal weg):
  tijd `home.tonightMin` — NL **{n} min** · EN **{n} min** met `n = r.time?.total ?? r.time?.active`
  (`Recipe.time` is optioneel én nullable; beide leeg → deel weg); categorie via
  `categoryLabel(dict.categories.find(c => c.id === r.category), r.category ?? '')` (`categoryLabel(c:
  Category | undefined, id: string)` uit src/components/FilterChips.tsx; `r.category` is `string | null |
  undefined`, '' geeft een leeg deel); en de teller
  `home.tonightLeft` — NL **nog {n} te gaan** · EN **{n} to go** met n = aantal niet-gekookte gerechten
  inclusief dit (n ≥ 2), of `home.tonightLast` — NL **de laatste van je week** · EN **the last of your
  week** (n = 1). Voorbeeld: "45 min · Vlees · nog 3 te gaan".
  Onder de knoppen een voetregel (`.tonight-foot`, klein, grijs) met één tekstknop
  `home.tonightOutside` — NL **Iets buiten je week ›** · EN **Something outside your week ›** → zet de
  module-variabele `freeMode = true` (geldt tot de app opnieuw start).
- **free** — geen plan, alles gekookt, of `freeMode`. Dit is de huidige Verras me: een willekeurig recept
  uit de pool (`applyPickFilter(recipes, filters, dict, l)`), onthouden in `diceId`; knoppen **Open** en
  **🎲 Nog een** (`home.reroll`, bestaat); metaregel met alleen tijd en categorie. Pool leeg door chips →
  `home.noMatch` (bestaat); pool leeg zonder chips → `common.loading`.
  Voetregel: links de schakelaar **filters ▾** (`home.filters` — NL **filters** · EN **filters**;
  met chips aan: `home.filtersActive` — NL **filters ({n})** · EN **filters ({n})**, n = `tags.length +
  cats.length`; open: pijl ▴ en `aria-expanded=true`) en, alleen als het plan nog een niet-gekookt gerecht
  heeft, rechts `home.tonightBack` — NL **Terug naar je week ›** · EN **Back to your week ›** → `freeMode =
  false`. Staat de schakelaar open, dan verschijnt `<PickChips filter noQuery tags>` onder de voetregel
  (zelfde chips en zelfde `recepten.surpriseFilters` als nu). Open/dicht wordt onthouden per telefoon in
  localStorage `recepten.tonightFiltersOpen` ("1" = open; standaard dicht). De chips gelden alleen voor
  de dobbelsteen, nooit voor het plan (daarom staat de schakelaar niet in de plan-stand).
Namen zijn in beide standen tikbaar (→ recept). Beide telefoons: identiek.

### 1h. Regel "Verder met: … ›" (blok 2)
Onder de kaart Vanavond, één dunne tekstregel (`<a class="home-continue">`): `home.continueWith` — NL
**Verder met: {name} ›** · EN **Continue with: {name} ›**, tik → `/recipe/<id>`. Alleen als: het laatst
bekeken recept (`lastViewed()` uit src/recent.ts, nieuw: id + tijdstip, per telefoon) vandaag bekeken is
(`isSameLocalDay`), het recept nog bestaat, het NIET het recept is dat de kaart Vanavond nu toont, en
er vandaag geen kookbeurt van is (`latestCookFor(id)` met `at` vandaag → regel weg). Anders niets.

### 1i. Deze week compact (blok 2, component `WeekCard`)
`plan.items.length === 0` → de bestaande lege kaart "Kies 7 voor deze week" (`home.weekEmpty` +
`home.weekEmptyHint`, tik → `/week`), ongewijzigd. 6C blok 2 voegt daar later de tekstlink
`home.weekEmptyStanding` — NL **Alleen de vaste lijst ›** · EN **Just the every-week list ›** aan toe
(→ `navigateTab('/shopping?tab=standing')`; key in src/i18n/browse.ts); Home A+ bouwt die niet.
Anders `.card.week-card.compact`:
- Titelrij: link `home.week` **Deze week** › (→ `/week`) met rechts grijs `week.cookedOf` (bestaat) — NL
  **{n} van {total} gekookt** · EN **{n} of {total} cooked**, ook bij 0 gekookt ("0 van 7 gekookt").
- Eén regel namen (tik → `/week`): eerst de niet-gekookte in planvolgorde, dan de gekookte
  (doorgestreept, class `cooked`), maximaal 3 namen + `home.weekMore` "+{n}" (bestaat), gescheiden door
  " · " (`weekLine`); CSS `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` als vangnet.
  Voorbeeld: "Goulash · Dahl · Pad thai · +4".
- Knop: zoals nu — alles gekookt → secundair `home.weekAllCooked` (→ `/week`), anders primair
  `home.weekList` **Boodschappenlijst** (→ `navigateTab('/shopping')`).

### 1j. Lege staten en fouten
Geen profiel: begroeting `home.greetingAnon`, geen avatar, geen levelregel, Laatst gekookt zonder
Beoordeel (zoals nu). Geen recepten geladen: Vanavond in loading-stand. Databasefout: de signalen
houden hun laatste waarde (inbox-badge.ts), de rij In & uit toont dan de laatst bekende telling (faalt de
eerste telling al, dan staan beide signalen op hun beginwaarde 0 → "niets nieuws"); niets crasht.
localStorage onbeschikbaar (privémodus): filters dicht, geen "Verder met", dobbelsteen werkt gewoon.

## 2. Datamodel en migraties

### 2a. Database: niets
Geen nieuwe tabel, geen nieuw veld op Recipe, geen index. **Dexie blijft op v7.** Alles op Home is
afgeleid van bestaande tabellen via bestaande repo-functies: `allRecipes`, `userRecipes`, `getPlan`,
`listFavorites(pid)`, `recentCooked(undefined, 3)`, `latestCookFor(id)`, `backupHealth` (via het signaal
`backupStatus`), de signalen `inboxUnseen` en `unsentChanges` (src/inbox-badge.ts, al live via liveQuery),
`badgeStatuses(pid)` (die laatste staat in src/badges.ts, niet in repo.ts). Geen nieuwe settings-keys in
de settings-tabel.

### 2b. localStorage (per telefoon, geen data; `resetEverything` wist alle `recepten.*`-keys)
- `recepten.surpriseFilters` — bestaat; de chips van de dobbelsteen (PickFilter zonder query). Verhuist
  als constante naar TonightCard.tsx, zelfde naam, zodat niemand zijn chips kwijtraakt.
- `recepten.tonightFiltersOpen` — nieuw; `"1"` = de chips staan open; elke andere waarde of afwezig =
  dicht. Alleen gelezen/geschreven in try/catch.
- `recepten.recent.last` — nieuw; JSON `{"id":"b:hongaarse-goulash","at":"2026-10-22T17:03:12.000Z"}` (het laatst
  bekeken recept en wanneer). `recepten.recent` (de lijst van 50 ids) blijft zoals hij is.
- `recepten.recipes.sort` — bestaat; de rij Mijn recepten zet hem via RecipesScreen op `ownReceived`.
Een back-up draagt niets hiervan (bewust: gemak per telefoon, invariant 14 "back-up is één tik" raakt dit
niet). Een herstel verandert hier niets aan.

### 2c. i18n-keys (allemaal in `src/i18n/browse.ts`, prefix `home.`; NL én EN verplicht)
Nieuw in blok 1: `home.inOut`, `home.inOutReceived`, `home.inOutToShare`, `home.inOutNothing`,
`home.myRecipes`, `home.myRecipesNone`, `home.storyRow` (teksten in §1d–1e).
Nieuw in blok 2: `home.tonight`, `home.tonightOther`, `home.tonightMin`, `home.tonightLeft`,
`home.tonightLast`, `home.tonightOutside`, `home.tonightBack`, `home.filters`, `home.filtersActive`,
`home.continueWith` (teksten in §1g–1h). Hergebruikt: `home.open`, `home.reroll`, `home.noMatch`,
`home.week`, `home.weekMore`, `home.weekList`, `home.weekAllCooked`, `home.weekEmpty`,
`home.weekEmptyHint`, `week.cookedOf`, `home.badges`, `list.add`, `list.add*`, `common.loading`,
`common.close`.
Weg (pas ná Grep buiten src/i18n, Haiku): blok 1 → `home.ownReceived`, `home.noOwn`, `home.addFirst`,
`home.allRecipes`, `home.inboxUnseen`, `home.inboxUnseenOne`, `home.inboxAction`, `home.badgesHint`,
`home.story`, `home.storyHint`, `home.teaser` (als ongebruikt), `home.surpriseFilters` (nu al ongebruikt);
blok 2 → `home.surprise`, `home.weekOpen` (als ongebruikt). **Blijven**: `home.unsent`, `home.unsentOne`,
`home.unsentAction` (InboxScreen gebruikt ze), `home.backup*`.
Feitencheck 22 okt (waar de keys nu staan): de hergebruikte keys zitten verspreid — `home.open`,
`home.reroll`, `home.badges`, `list.add*` (behalve `list.add`) in browse.ts; `list.add`, `home.week`,
`home.weekMore`, `home.weekList`, `home.weekAllCooked`, `home.weekEmpty*`, `week.cookedOf` in week.ts;
`home.noMatch`, `home.categories`, `home.unsent*`, `home.backup*` in phase2.ts. De weg-keys staan in drie
bestanden: browse.ts (`home.ownReceived`, `home.noOwn`, `home.addFirst`, `home.allRecipes`,
`home.badgesHint`, `home.story`, `home.storyHint`, `home.teaser`, `home.surprise`), week.ts
(`home.inboxUnseen`, `home.inboxUnseenOne`, `home.inboxAction`, `home.weekOpen`) en phase2.ts
(`home.surpriseFilters`). `home.teaser` en `home.weekOpen` zijn nu al ongebruikt (net als
`home.surpriseFilters`); de rest wordt alleen door HomeScreen.tsx gebruikt.
⚠ Feitencheck: wie de weg-keys verwijdert, raakt dus ook src/i18n/week.ts en src/i18n/phase2.ts, niet
alleen browse.ts (bouwer B bezit alleen browse.ts; dit is het werk van Haiku/integrator, §3).

### 2d. Back-up, export/import, deelformaat
`exportBundle`/`importBundle` (src/db/repo.ts) ongewijzigd. Het deelformaat (`#r=`/`#p=`/`#w=`/`#b=`/`#f=`)
ongewijzigd: geen nieuw veld, geen nieuwe bevroren tokens in tests/token.test.ts. 6D en 13D hoeven hier
niets van te weten behalve: de levelregel staat in `HomeLevelRow.tsx`, en Home leest geen enkel veld dat
zij toevoegen.

### 2e. Uitbreidbaar houden (docs/IDEAS.md)
De metaregel van de kaart Vanavond is een lijst van losse delen (`tonightMeta(parts)`): een later
"≈ 620 kcal p.p." (idee 1) is één extra deel, geen herontwerp. Geen enkele rule-kind of datamodel wordt
hier geraakt.

## 3. Bestandsverdeling en contracten

Elk blok past in één Opus-workflow: 2–3 bouwers + integrator (+ Haiku voor i18n en DEVICE-TEST).
Een bouwer raakt alleen zijn eigen bestanden; de integrator zet HomeScreen.tsx in elkaar en draait
`npm run check`, `npm test`, `npm run build`.

### Blok 1 — bouwer A: het +-menu en de lijst
Bezit: `src/components/AddMenu.tsx` (nieuw), `src/screens/RecipesScreen.tsx`.
```ts
// src/components/AddMenu.tsx — het menu achter de + (Home en Recepten). Rijen in de volgorde van §1b.
// Rendert via SheetPortal; `open=false` → null. Bestandskiezer, status en openPastedText zitten erin.
export function AddMenu(props: { open: boolean; onClose: () => void }): JSX.Element | null;
```
RecipesScreen: verwijder de inline `{addMenu && (<div class="sheet-backdrop"> …)}` en `onAddFile`/
`addStatus`; render `<AddMenu open={addMenu} onClose={() => setAddMenu(false)} />`. Nieuw: de query
`?sort=<ListSort>`, naast `?cat=` en `?select=`:
```ts
const sortQuery = onList ? route.value.query.get('sort') : null;
useEffect(() => {
  if (!isListSort(sortQuery)) return;
  changeSort(sortQuery);                       // kiest én onthoudt (saveListSort), scrolt naar boven
  navigate('/recipes', { replace: true });
}, [sortQuery]);
```
`isListSort` komt uit `src/recent.ts` (bestaat; RecipesScreen importeert hem nog niet — de bestaande
importregel `import { LIST_SORTS, loadListSort, orderRecipes, recentIds, saveListSort, type ListSort }
from '@/recent'` uitbreiden). CSS van het menu (`.add-menu`, `.add-menu-row`,
`.list-add`) staat in `src/styles/week.css` en blijft daar; bouwer A raakt geen CSS.

### Blok 1 — bouwer B: Home-rijen, begroeting, levelregel
Bezit: `src/screens/HomeScreen.tsx`, `src/components/HomeLevelRow.tsx` (nieuw),
`src/components/CategoryShelf.tsx` (één rij), `src/styles/home.css`, `src/i18n/browse.ts` (keys §2c).
```ts
// src/components/HomeLevelRow.tsx — het slot onder de begroeting. Tot 6D: "🏆 Badges 7/40 ›".
// Leest badgesEnabled/loadBadgeSettings/badgeStatuses (src/badges.ts) zelf; null als badges uit,
// geen profiel of nog niet geladen. 6D vervangt alleen de inhoud van dit bestand.
export function HomeLevelRow(props: { profileId: string }): JSX.Element | null;
```
HomeScreen: kop `<Header title={t('home.title')} action={<button … list-add …/>} />`, daaronder
`<TimerBar />` (ongewijzigd; 13K zet daar zijn kookbalk) en dan `.screen.home` in de volgorde van §1a.
Verwijder: de kaarten unsent/unseen, de sectie Eigen & ontvangen (incl. `home-select`, `home-add`,
`ownList`), de badges-kaart (verhuist naar HomeLevelRow), de link-card Het verhaal. De weekkaart en de
kaart Verras me blijven in blok 1 ongewijzigd staan (plek 2 en 4). Nieuwe CSS-klassen (alle in home.css):
`.home-hello` (flex, gap 12 px, align-items center), `.home-rows` (kaart zonder padding, rijen gescheiden
door `1px solid var(--line)`), `.home-row` (flex, min-height 52 px, padding 0 14 px, gap 12 px, `.home-row
.detail` grijs met `font-variant-numeric: tabular-nums`, `.home-row.has-new .detail { color:
var(--cobalt) }`), `.home-level` (dunne regel, 44 px tikhoogte, cobalt), `.cat-shelf` naar één rij.
Oude CSS die alleen de verwijderde blokken bediende (`.home-section h2 .home-add`, `.home-select`,
`.badges-card`) weghalen.

### Blok 1 — integrator
Voegt A en B samen, past DEVICE-TEST rij 58 aan (volgorde van de vier keuzes, NL en EN), voegt rij 70 toe
(§6d), werkt STATUS.md bij. Haiku: i18n-keys NL+EN aanvullen en ongebruikte keys weghalen ná een Grep.

### Blok 2 — bouwer A: domein en recent
Bezit: `src/domain/tonight.ts` (nieuw, framework-vrij), `src/recent.ts`, `tests/tonight.test.ts` (nieuw).
```ts
// src/domain/tonight.ts — puur; geen preact, geen dexie. Alleen Plan/PlanItem (src/domain/planner.ts)
// en Recipe (src/domain/model.ts).
export type TonightMode = 'loading' | 'plan' | 'free';
/** 'loading' zolang plan of recipes undefined; 'plan' als uncookedItems(...) niet leeg is en !free. */
export function tonightMode(plan: Plan | undefined, recipes: readonly Recipe[] | undefined, free: boolean): TonightMode;
/** Niet-gekookte slots in planvolgorde; slots zonder bestaand recept worden overgeslagen. */
export function uncookedItems(plan: Plan, byId: ReadonlyMap<string, Recipe>): PlanItem[];
/** Het slot met id `currentId` als het er nog in staat, anders items[0]; undefined bij leeg. */
export function currentPlanItem(items: readonly PlanItem[], currentId: string | null): PlanItem | undefined;
/** Het slot ná `currentId`, rond; bij één slot dat slot zelf; undefined bij leeg. */
export function nextPlanItem(items: readonly PlanItem[], currentId: string | null): PlanItem | undefined;
/** Willekeurig id ≠ `not` (tenzij er maar één is); null bij leeg. rng in [0,1), Math.random standaard. */
export function pickRandomId(ids: readonly string[], not: string | null, rng?: () => number): string | null;
/** De niet-lege delen met " · " ertussen; '' als alles leeg. */
export function tonightMeta(parts: ReadonlyArray<string | null | undefined>): string;
export function weekProgress(plan: Plan): { total: number; cooked: number };
/** Namen voor de compacte weekregel: niet-gekookt eerst (planvolgorde), dan gekookt; onbekend recept → overgeslagen. */
export function weekNames(plan: Plan, byId: ReadonlyMap<string, Recipe>, nameOf: (r: Recipe) => string): Array<{ name: string; cooked: boolean }>;
/** De eerste `max` (standaard 3) en hoeveel er over zijn: {shown, more}. */
export function weekLine<T>(names: readonly T[], max?: number): { shown: T[]; more: number };
/** Zelfde kalenderdag in lokale tijd (geen UTC-vergelijking!). false bij ongeldige iso. */
export function isSameLocalDay(iso: string, now: Date): boolean;
/** Het id voor "Verder met", of null (niet vandaag, onbekend recept, gelijk aan hideId, of vandaag gekookt). */
export function continueWithId(last: LastViewed | null, now: Date, known: ReadonlySet<string>, hideId: string | null, cookedTodayAt: string | null): string | null;
```
⚠ Feitencheck: `continueWithId` neemt `LastViewed`, dat volgens dit plan in src/recent.ts komt (app-laag,
gebruikt localStorage). Dan importeert tonight.ts méér dan Plan/PlanItem en Recipe: een `import type
{ LastViewed } from '@/recent'` is in Node veilig (alleen een type; tests importeren src/recent.ts al in
tests/share-events.test.ts), maar de zin "Alleen Plan/PlanItem … en Recipe" klopt dan niet letterlijk.
Bovendien importeren alle huidige src/domain-modules uitsluitend relatief binnen src/domain (`./model.ts`,
`./planner.ts` …), nooit via `@/` en nooit uit de app-laag; tonight.ts zou de eerste uitzondering zijn.
⚠ Feitencheck: iets als `isSameLocalDay` bestaat al in de app-laag: `isToday(iso)` en `localDay(d)` in
src/cooklog.ts (zonder `now`-parameter; dat bestand importeert `@/db/repo`, `@/badges` en `@/celebrate`, dus
niet bruikbaar vanuit src/domain). De keuze voor een eigen pure `isSameLocalDay` blijft staan.
```ts
// src/recent.ts — erbij (de bestaande exports blijven):
export const RECENT_LAST_KEY = 'recepten.recent.last';
export interface LastViewed { id: string; at: string }
/** Puur: JSON {id, at} → LastViewed; null bij junk, lege id of ongeldige datum. */
export function parseLastViewed(raw: string | null): LastViewed | null;
/** Leest RECENT_LAST_KEY (try/catch; null als onbeschikbaar). */
export function lastViewed(): LastViewed | null;
// noteViewed(recipeId) schrijft voortaan óók RECENT_LAST_KEY = JSON.stringify({ id, at: new Date().toISOString() }).
```
`pickRandom` verdwijnt uit HomeScreen (→ `pickRandomId`). RecipeScreen hoeft niet te veranderen
(`noteViewed` wordt daar al aangeroepen).

### Blok 2 — bouwer B: de twee kaarten
Bezit: `src/components/TonightCard.tsx` (nieuw), `src/components/WeekCard.tsx` (nieuw), `src/styles/home.css`
(klassen `.tonight`, `.tonight-head`, `.tonight-meta`, `.tonight-foot`, `.tonight-filters-toggle`,
`.home-continue`, `.week-card.compact`, `.week-line`, `.week-line .cooked`), `src/i18n/browse.ts` (keys §2c).
⚠ Feitencheck: de CSS van de huidige kaart Verras me hangt aan de klasse `.surprise`: `.surprise`,
`.surprise-name`, `.surprise-actions` in src/styles/browse.css (bouwer B bezit dat bestand niet) en
`.surprise-name`, `.surprise-alt`, `.surprise .filter-chips`, `.surprise .diet-chips` (de chips lopen door
tot de kaartrand, `margin: 0 -16px`) in src/styles/home.css. Een kaart met alleen `.card.tonight` krijgt die
chip-regels niet vanzelf.
```ts
// src/components/TonightCard.tsx — §1g. Module-variabelen: diceId, planItemId, freeMode (zoals surpriseId nu).
export const SURPRISE_FILTERS_KEY = 'recepten.surpriseFilters';      // verhuist uit HomeScreen, zelfde waarde
export const TONIGHT_FILTERS_OPEN_KEY = 'recepten.tonightFiltersOpen';
export interface TonightCardProps {
  recipes: readonly Recipe[] | undefined;   // allRecipes (undefined = laden)
  plan: Plan | undefined;                   // getPlan (undefined = laden)
  /** Het recept-id dat de kaart nu toont (null bij laden/leeg); HomeScreen gebruikt het voor "Verder met". */
  onShown?: (recipeId: string | null) => void;
}
export function TonightCard(props: TonightCardProps): JSX.Element;

// src/components/WeekCard.tsx — §1i; rendert zelf de lege kaart bij 0 slots.
export function WeekCard(props: { plan: Plan; byId: ReadonlyMap<string, Recipe> }): JSX.Element;
```
`onShown` wordt in een `useEffect` aangeroepen als het getoonde id verandert (niet tijdens de render).

### Blok 2 — integrator
HomeScreen: vervangt de kaart Verras me door `<TonightCard recipes={all} plan={plan} onShown={setShownId} />`,
de weekkaart door `plan !== undefined && <WeekCard plan={plan} byId={byId} />`, en zet daartussen de regel
"Verder met" (§1h) met `lastViewed()` (gelezen bij mount), `continueWithId(...)` en
`useLive(() => id ? latestCookFor(id) : Promise.resolve(undefined), [id])`. Haalt `PickChips`,
`loadPickFilter`, `savePickFilter`, `applyPickFilter`, `tagIdsIn`, `pickRandom`, `surpriseId` en
`SURPRISE_FILTERS_KEY` uit HomeScreen (zitten nu in TonightCard). Feitencheck: HomeScreen importeert uit
src/components/PickSheet.tsx ook `pickFilterActive` en `type PickFilter` (alleen voor de dobbelsteen);
die gaan mee. DEVICE-TEST rij 71 (§6d), STATUS.md.

## 4. Stappenplan

Twee bouwblokken, elk apart online (eerst `/next/` → beide telefoons volgens DEVICE-TEST → `main`).
Geen vlag nodig: elk blok levert een complete, bruikbare Home op; `main` blijft altijd bruikbaar.

**Blok 1 — rijen en de + in de kop** (bouwers A en B uit §3, integrator). Klaar als: de kop van Home een
+ heeft met het menu (Plak eerst, ook op Recepten); de begroeting een avatar heeft en het slot
`HomeLevelRow` (tot 6D "🏆 Badges x/y ›"); de kaarten unsent/unseen vervangen zijn door de rij In & uit met
tellingen; de sectie Eigen & ontvangen vervangen is door de rij Mijn recepten N › die de lijst op
`ownReceived` opent; Laatst gekookt 3 rijen toont; Categorieën één rij is; Het verhaal een tekstregel;
de blokken in de volgorde van §1a staan (Verras me en de weekkaart nog oud); DEVICE-TEST rij 58 aangepast
en rij 70 toegevoegd; check/test/build groen; 0 nieuwe dependencies.

**Blok 2 — de kaart Vanavond en de compacte week** (bouwers A en B uit §3, integrator). Klaar als:
`src/domain/tonight.ts` met tests/tonight.test.ts (alle gevallen §6a) groen is; TonightCard de drie
standen uit §1g heeft met onthouden ingeklapte filters; WeekCard §1i; de regel "Verder met" §1h;
HomeScreen geen dobbelsteen-logica meer bevat; DEVICE-TEST rij 71; check/test/build groen.

Daarna (niet in deze spec): 13K zet zijn kookbalk op de plek van `<TimerBar />` op Home; 6D vult
`HomeLevelRow` met level en XP-balk; 6C zet "Alleen de vaste lijst ›" in de lege weekkaart.

## 5. Regels en eerlijkheid

### 5a. Invarianten (CLAUDE.md) die dit raakt
- 1–4 (ids, raw-regels, {nl,en}, deelformaat): niet geraakt; er wordt niets opgeslagen of gedeeld. Alle
  namen op Home via `pickText(r.name, l)` en `otherLanguageName` zoals nu.
- 5 (iPhone zonder share target): het menu achter de + opent het bestaande plakscherm met textarea én
  "Plak van klembord"; niets wordt weggehaald. Geen tekst op Home die suggereert dat een link de iPhone-app
  opent.
- 6, 7 (landing bundle, boot rule): niet geraakt; alleen de volledige app verandert.
- 8, 10, 11, 12: niet geraakt.
- 13 (timers): de timerbalk blijft op dezelfde plek onder de kop; Home belooft niets over timers. 13K
  neemt die plek over (één slot: `<Header/>` → balk → `.screen.home`).
- 14 (geen backend/analytics): localStorage-keys zijn gemak per telefoon; niets verlaat de telefoon.
- 15: geen nieuwe dependency (`createPortal` komt uit `preact/compat`, al in gebruik door SheetPortal).
- PLAN §0 "één duidelijke actie, A–Z één tik": de Recepten-tab blijft A–Z; Mijn recepten opent bewust
  een andere sortering en zegt dat in de pil, die de gebruiker met één tik terugzet.
- Gamification nooit in de weg (PLAN §0, 6D): badges uit = geen levelregel, geen lege ruimte, geen XP
  op Home tijdens bladeren.

### 5b. iPhone vs Android
Geen verschil in gedrag. Let op bij bouwen: het menu via `SheetPortal` (13J: een sheet binnen `.screen`
verloor op de iPhone zijn onderkant); `.home-row` minimaal 44 px hoog; de voetregel van de kaart Vanavond
heeft tekstknoppen van minimaal 44 px tikhoogte (padding, niet lettergrootte); `font-size` van zichtbare
tekst nooit onder 13 px, inputs blijven ≥ 16 px (er zijn er geen op Home).

### 5c. Opus mag dit NIET zelf beslissen (zo doen als hier staat, anders vragen aan Stijn/Fable)
1. De volgorde van de blokken op Home (§1a) en van de vier menukeuzes (Plak eerst, §1b).
2. Dat de rij In & uit altijd zichtbaar is en naar `/inbox` gaat (niet naar `/share`), met de tekst
   "niets nieuws" bij nul.
3. Dat Mijn recepten de onthouden sortering op `ownReceived` zet (geen tijdelijke sortering).
4. Dat de badges-kaart verdwijnt en tot 6D één regel "🏆 Badges x/y ›" onder de begroeting staat.
5. De drie standen van de kaart Vanavond, de teksten, dat "Iets anders" binnen het plan blijft en dat
   de chips alleen voor de dobbelsteen gelden. Geen lang-drukken-gebaren toevoegen.
6. Dat `freeMode` niet wordt onthouden (module-variabele) en de filter-open-stand wél (localStorage).
7. Dat "Verder met" alleen vandaag geldt, verdwijnt na een kookbeurt van vandaag en nooit het gerecht van
   de kaart herhaalt; geen extra data, geen Dexie-tabel.
8. Namen op de weekregel: niet-gekookt eerst, dan gekookt doorgestreept, max 3 + "+N".
9. Geen nieuwe Dexie-versie, geen nieuwe settings-key, geen nieuw veld op Recipe, geen nieuwe dependency.
10. Geen i18n-key verwijderen zonder Grep buiten src/i18n; `home.unsent*` blijft.
11. Geen wijziging aan TimerBar, timers.ts, CookScreen, sw.ts, boot.ts, landing.ts of het deelformaat.
12. Emoji's van de rijen: 📥 In & uit · 📒 Mijn recepten · 📖 Het verhaal · 🏆 Badges · 🎲 dobbelsteen.

## 6. Testplan

### 6a. Unit tests (Vitest, node) — `tests/tonight.test.ts` (nieuw, blok 2)
Fixtures inline, zoals tests/share-events.test.ts: `recipe(id, name, time?, category?)` als
`as unknown as Recipe`; `plan(items)` met `PlanItem`s `{ id: 's1', recipeId: 'b:goulash', servings: 4,
addedAt: '2026-10-20T10:00:00.000Z', cooked?: true }`. Gevallen:
- `tonightMode`: (undefined, [], false) → 'loading'; (plan([]), undefined, false) → 'loading' (Feitencheck:
  `Plan` is een object `{ id: 'current', items, updatedAt }`, geen array; `[]` als eerste argument
  compileert niet); plan met één
  niet-gekookt slot → 'plan'; alles gekookt → 'free'; leeg plan → 'free'; plan met slot maar `free=true`
  → 'free'; slot waarvan het recept niet in `recipes` zit → 'free'.
- `uncookedItems`: planvolgorde; gekookte weg; onbekend recipeId weg; leeg → [].
- `currentPlanItem`: id aanwezig → dat slot; id gekookt/weg → items[0]; null → items[0]; [] → undefined.
- `nextPlanItem`: [s1,s2,s3] na s1 → s2; na s3 → s1 (rond); na onbekend id → s1; [s1] → s1; [] → undefined.
- `pickRandomId`: [] → null; ['a'] met not 'a' → 'a'; ['a','b'] met not 'a' en rng altijd 0 → 'b'
  (implementatie: trek uit `ids.filter((id) => id !== not)` als die lijst niet leeg is, anders uit
  `ids`; géén do/while op `rng`, die zou met `rng = () => 0` eeuwig lopen); rng 0.99 → laatste.
- `tonightMeta`: ['45 min', null, 'Vlees', '', 'nog 3 te gaan'] → '45 min · Vlees · nog 3 te gaan';
  [null, undefined] → ''.
- `weekProgress`: 7 slots, 3 gekookt → {total: 7, cooked: 3}; leeg → {0, 0}.
- `weekNames`: niet-gekookt eerst in planvolgorde, dan gekookt; onbekend recept overgeslagen; `cooked`
  klopt per naam.
- `weekLine`: 7 namen, max 3 → shown 3, more 4; 3 namen → more 0; [] → shown [], more 0; max 1.
- `isSameLocalDay`: zelfde lokale dag → true; 23:59 vs 00:01 volgende dag → false; ongeldige iso →
  false. Bouw `now` met `new Date(2026, 9, 22, 8, 0)` en de iso via `.toISOString()` van lokale Dates, zodat
  de test in elke tijdzone klopt.
- `continueWithId`: vandaag bekeken, bekend, ≠ hideId, niet gekookt → id; gisteren → null; onbekend →
  null; gelijk aan hideId → null; `cookedTodayAt` vandaag → null; `cookedTodayAt` gisteren → id; null → null.
- `parseLastViewed` (uit src/recent.ts): geldige JSON → object; null/''/'x'/`{"id":""}`/ongeldige datum →
  null; extra velden genegeerd.
Blok 1 heeft geen eigen domeincode: geen nieuwe unit tests (de bestaande suite moet groen blijven).

### 6b. Acceptatiechecks in de dev-app (`npm run dev`, Chrome devtools 375 × 812, NL én EN)
Blok 1:
1. Kop Home: "Vanavond?" links, dan +, NEXT-label (op /next/), NL|EN; niets valt af bij 360 px.
2. Tik + → sheet met vier rijen in de volgorde Plak · Zelf · AI · Bestand; Plak → Nieuw recept met het
   plakvak open; op Recepten dezelfde volgorde. Wegvegen/ernaast tikken sluit zonder iets te doen.
3. Begroeting met avatar-rondje; wissel profiel in Meer → andere kleur/letter. Badges aan → "🏆 Badges
   x/y ›" eronder, tik → Badges-pagina; badges uit → regel weg, geen lege ruimte.
4. Rij In & uit: importeer via het plakvak een recept dat deze database nog niet heeft (een `#r=`-link van
   een ander profiel/kanaal; een link van je eigen recept maakt geen ontvangen rij) → "1 ontvangen"; open In & uit en tik op het
   tabblad Ontvangen op dat recept → terug op Home "niets nieuws" (of alleen "n te delen"). Tik → In & uit.
   (Feitencheck: alleen In & uit openen telt niet als gezien; `markInboxSeen` wordt alleen aangeroepen
   bij een tik op een ontvangen rij, `openReceived` in src/screens/InboxScreen.tsx.)
5. Rij Mijn recepten toont het aantal; tik → Recepten met de pil Eigen & ontvangen aan, de hash is weer
   `#/recipes`; terug naar Recepten later → nog steeds die sortering.
6. Laatst gekookt toont maximaal 3 rijen; Categorieën is één rij die zijdelings scrolt; Het verhaal is
   een tekstregel; geen kaart Badges en geen sectie Eigen & ontvangen meer.
7. Back-upkaart: in de code rendert hij alleen bij `backup?.overdue` (ongewijzigde voorwaarde) en staat
   hij direct boven de rij In & uit; in de dev-app is hij afwezig na een verse back-up (Opslag → Bewaar of
   deel → Download). Een echte "achterloop"-situatie hoeft niet nagespeeld te worden.
Blok 2:
8. Zonder weekplan: kaart VANAVOND met een willekeurig recept, Open, 🎲 Nog een, "filters ▾" dicht;
   tik → chips open; herlaad → nog open; zet een chip aan en klap dicht → "filters (1) ▾".
9. Kies 7 in Week → terug op Home: het eerste gerecht uit het plan, metaregel "… · nog 7 te gaan",
   "🎲 Iets anders" bladert door de zeven en komt rond; "Iets buiten je week ›" → dobbelsteen met
   "Terug naar je week ›"; herladen → weer de plan-stand.
10. Vink in Week zes gerechten Gekookt → metaregel "de laatste van je week", "Iets anders" grijs;
    vink het zevende → kaart in free-stand, Deze week toont "7 van 7 gekookt" en de knop "Alles gekookt —
    kies nieuwe?".
11. Deze week compact: "3 van 7 gekookt", regel "A · B · C · +4" met niet-gekookte eerst en de gekookte
    doorgestreept; tik op de regel → Week; knop Boodschappenlijst → Boodschappen.
12. Open een recept dat niet in de kaart staat, terug → "Verder met: <naam> ›"; markeer het Gekookt
    (vandaag) → regel weg; zet de systeemklok niet om, maar controleer met een `at` van gisteren in
    `recepten.recent.last` dat de regel weg is.
13. Taalwissel NL↔EN op Home: alle nieuwe teksten wisselen mee; geen key-namen zichtbaar.
14. `npm run check`, `npm test`, `npm run build`, `npm run build:next` groen.

### 6c. Fixtures
Geen nieuwe bestanden in tests/fixtures (geen deelformaat, geen parser). Inline fixtures in 6a.

### 6d. DEVICE-TEST-rijen (definitief 70 en 71). Toevoegen in BEIDE tabellen
(Nederlands na rij 69 op ±regel 113; English na rij 69 op ±regel 231). Ook rij 58 aanpassen: in de "goed"-
kolom wordt de volgorde "**Plak een recept**, **Zelf schrijven**, **Met AI** en **Kies een bestand**" (EN:
"**Paste a recipe**, **Write it yourself**, **With AI** and **Choose a file**").
De vier regels hieronder zijn letterlijk de tabelrijen voor DEVICE-TEST.md (één rij per regel, zoals dat
bestand het wil) en daarom de enige lange regels in deze spec.

| 70 | **Home opnieuw ingedeeld: rijen en de + in de kop (Home A+, blok 1).** 1. Tik onderaan op **Home**. Kijk naar de kop en naar wat er onder de begroeting staat. 2. Tik rechtsboven op **+**. Lees de vier regels. Veeg het venster naar beneden. 3. Scrol naar beneden. Zoek de rij **In & uit** en lees wat erachter staat. 4. Tik op de rij **Mijn recepten**. 5. Tik onderaan op **Home** en scrol helemaal naar beneden. Tik op **Het verhaal van dit boek**. 6. Ga terug naar Home. Tel de rijen onder **Laatst gekookt** en veeg met je vinger over de **Categorieën**. 7. Tik onderaan op **Meer** → **Instellingen** → zet **Badges** uit. Ga terug naar Home. | 1. In de kop staat **Vanavond?** met rechts een **+**, daarnaast NL/EN. Naast "Hoi <naam>, wat eten we vanavond?" staat je gekleurde rondje met je beginletter; eronder een dunne regel **🏆 Badges x/y ›**. 2. Een venster met vier keuzes, in deze volgorde: **Plak een recept**, **Zelf schrijven**, **Met AI**, **Kies een bestand**. Na het wegvegen is er niets gebeurd. 3. Eén rij **📥 In & uit** met erachter bijvoorbeeld "1 ontvangen · 2 te delen" (of "niets nieuws"); er zijn géén losse kaarten meer voor "nog niet gedeeld" en "nieuwe dingen bij In & uit". 4. De lijst Recepten opent met de knop **Eigen & ontvangen** aan: alleen je eigen en ontvangen recepten, nieuwste bovenaan. 5. De verhaalpagina opent; op Home was het een tekstregel met een boekje ervoor, geen kaart. 6. Hoogstens drie rijen onder Laatst gekookt; de categorieën staan in één rij die zijdelings schuift. Er is géén blok "Eigen & ontvangen" en géén kaart "Badges" meer. 7. De regel **🏆 Badges x/y ›** is weg en er staat geen lege ruimte. |
| 71 | **Home: de kaart Vanavond en de compacte week (Home A+, blok 2).** 1. Tik onderaan op **Week**. Staan er gerechten? Tik dan rechtsboven op **Leeg** en bevestig. Tik onderaan op **Home**. 2. Kijk naar de kaart **Vanavond**. Tik op **🎲 Nog een**. Tik op **filters ▾**, zet **Vegetarisch** aan en tik op **filters ▴**. Sluit de app helemaal en open hem weer. 3. Tik onderaan op **Week** → **Kies 7** en kies zeven gerechten. Tik onderaan op **Home**. 4. Tik twee keer op **🎲 Iets anders**. Tik op **Iets buiten je week ›**. Tik op **Terug naar je week ›**. 5. Kijk naar **Deze week** onder de kaart. Tik op de regel met de namen. 6. Vink in Week zes van de zeven gerechten **Gekookt**. Ga terug naar Home. 7. Vink ook het zevende gerecht. Ga terug naar Home. 8. Open een recept dat niet in de kaart staat (via **Recepten**) en ga terug naar Home. 9. Tik op **✓ Gekookt** bij dat recept en **Bewaar**. Ga terug naar Home. | 2. De kaart heet **VANAVOND** en toont één gerecht met **Open** en **🎲 Nog een**; onder de knoppen staat **filters ▾**. Na de tik op Nog een staat er een ander gerecht. De filterchips klappen open en dicht; dicht staat er **filters (1) ▾**. Na het opnieuw openen staat er nog steeds een vegetarisch gerecht en **filters (1) ▾**. 3. De kaart toont het eerste gerecht van je week met een grijze regel eronder, bijvoorbeeld "45 min · Vlees · nog 7 te gaan", en de knoppen **Open** en **🎲 Iets anders**; **filters** staat er nu niet. 4. Elke tik op Iets anders toont het volgende gerecht uit je week. Na "Iets buiten je week" komt er een gerecht dat NIET in je week zit, met **🎲 Nog een**, **filters ▾** en rechts **Terug naar je week ›**; daarna staat het weekgerecht er weer. 5. **Deze week** is één kaartje: "0 van 7 gekookt", één regel met drie namen en "+4", en de knop **Boodschappenlijst**. De tik opent de Week. 6. De kaart Vanavond zegt "de laatste van je week"; **Iets anders** is grijs. Deze week zegt "6 van 7 gekookt"; de gekookte namen staan doorgestreept achteraan. 7. De kaart Vanavond toont weer de dobbelsteen met **🎲 Nog een**. Deze week zegt "7 van 7 gekookt" met de knop **Alles gekookt — kies nieuwe?**. 8. Onder de kaart Vanavond staat een dunne regel **Verder met: <naam> ›**; tikken opent dat recept. 9. De regel **Verder met** is weg. |

| 70 | **Home rearranged: rows and the + in the header (Home A+, block 1).** 1. Tap **Home** at the bottom. Look at the header and at what is under the greeting. 2. Tap **+** at the top right. Read the four rows. Swipe the sheet down. 3. Scroll down. Find the row **In & out** and read what follows it. 4. Tap the row **My recipes**. 5. Tap **Home** at the bottom and scroll all the way down. Tap **The story of this book**. 6. Go back to Home. Count the rows under **Recently cooked** and swipe your finger across the **Categories**. 7. Tap **More** → **Settings** → switch **Badges** off. Go back to Home. | 1. The header says **Tonight?** with a **+** on the right, next to NL/EN. Next to "Hi <name>, what shall we cook tonight?" is your coloured circle with your initial; under it a thin line **🏆 Badges x/y ›**. 2. A sheet with four choices, in this order: **Paste a recipe**, **Write it yourself**, **With AI**, **Choose a file**. After swiping it away nothing has happened. 3. One row **📥 In & out** followed by, for example, "1 received · 2 to share" (or "nothing new"); there are no separate cards any more for "not shared yet" and "new things in In & out". 4. The Recipes list opens with the **Own & received** button on: only your own and received recipes, newest first. 5. The story page opens; on Home it was a text row with a little book in front, not a card. 6. At most three rows under Recently cooked; the categories are one row that slides sideways. There is no "Own & received" block and no "Badges" card any more. 7. The line **🏆 Badges x/y ›** is gone and leaves no empty space. |
| 71 | **Home: the Tonight card and the compact week (Home A+, block 2).** 1. Tap **Week** at the bottom. Are there dishes? Then tap **Clear** at the top right and confirm. Tap **Home** at the bottom. 2. Look at the **Tonight** card. Tap **🎲 Another**. Tap **filters ▾**, switch **Vegetarian** on and tap **filters ▴**. Close the app completely and open it again. 3. Tap **Week** → **Pick 7** and choose seven dishes. Tap **Home** at the bottom. 4. Tap **🎲 Something else** twice. Tap **Something outside your week ›**. Tap **Back to your week ›**. 5. Look at **This week** under the card. Tap the line with the names. 6. In Week, tick six of the seven dishes **Cooked**. Go back to Home. 7. Tick the seventh dish too. Go back to Home. 8. Open a recipe that is not in the card (via **Recipes**) and go back to Home. 9. Tap **✓ Cooked** on that recipe and **Save**. Go back to Home. | 2. The card is called **TONIGHT** and shows one dish with **Open** and **🎲 Another**; under the buttons it says **filters ▾**. After tapping Another a different dish is shown. The filter chips open and close; closed, it says **filters (1) ▾**. After reopening the app there is still a vegetarian dish and **filters (1) ▾**. 3. The card shows the first dish of your week with a grey line under it, for example "45 min · Meat · 7 to go", and the buttons **Open** and **🎲 Something else**; **filters** is not shown now. 4. Each tap on Something else shows the next dish from your week. After "Something outside your week" a dish appears that is NOT in your week, with **🎲 Another**, **filters ▾** and **Back to your week ›** on the right; after that the week dish is back. 5. **This week** is one small card: "0 of 7 cooked", one line with three names and "+4", and the button **Shopping list**. The tap opens the Week. 6. The Tonight card says "the last of your week"; **Something else** is grey. This week says "6 of 7 cooked"; the cooked names are struck through at the end. 7. The Tonight card shows the dice again with **🎲 Another**. This week says "7 of 7 cooked" with the button **All cooked — pick new ones?**. 8. Under the Tonight card is a thin line **Continue with: <name> ›**; tapping it opens that recipe. 9. The **Continue with** line is gone. |

## 7. Controlelijst voor Fable (eindcontrole)

1. [ ] HomeScreen.tsx rendert exact de volgorde van §1a; geen restant van unsent/unseen-kaarten, de sectie
       Eigen & ontvangen, `home-select`/`home-add` of de badges-kaart.
2. [ ] `AddMenu` is één component, gebruikt op Home én Recepten, via SheetPortal, Plak als eerste rij; het
       bestandspad (openPastedText, PASTE_FILE_ACCEPT, foutteksten `edit.fileEmpty`/`edit.fileFailed`) werkt.
3. [ ] RecipesScreen: `?sort=` wordt verwerkt, onthouden en uit de hash gehaald; `?cat=`/`?select=`
       werken nog; een ongeldige waarde (`?sort=foo`) doet niets en blijft niet hangen.
4. [ ] `HomeLevelRow` rendert null bij badges uit / geen profiel; geen lege ruimte; 6D hoeft alleen dit
       bestand te vullen.
5. [ ] De rij In & uit volgt `inboxUnseen` en `unsentChanges` live (liveQuery) en toont "niets nieuws" bij
       0/0; `has-new` alleen bij ontvangen > 0.
6. [ ] `src/domain/tonight.ts` importeert niets uit preact/dexie/i18n; alle §6a-gevallen staan in
       tests/tonight.test.ts en `isSameLocalDay` is tijdzone-onafhankelijk getest.
7. [ ] TonightCard: plan-stand toont het eerste niet-gekookte slot, "Iets anders" is rond en `disabled` bij
       één slot, de metaregel heeft geen losse " · " bij ontbrekende delen, de free-stand behoudt de oude
       chips (`recepten.surpriseFilters`) en `recepten.tonightFiltersOpen` wordt alleen in try/catch gelezen.
8. [ ] `onShown` loopt via useEffect; "Verder met" verdwijnt bij een kookbeurt van vandaag en herhaalt
       nooit het kaartgerecht; `noteViewed` schrijft `recepten.recent.last` zonder `recepten.recent` te breken.
9. [ ] WeekCard: lege kaart ongewijzigd; "0 van 7 gekookt"; weekregel max 3 + "+N", gekookte achteraan en
       doorgestreept; knoppen zoals voorheen.
10. [ ] Elke nieuwe i18n-key bestaat in NL én EN; geen key-naam zichtbaar bij taalwissel; verwijderde keys
        nergens meer gebruikt (Grep).
11. [ ] 360 px: niets valt af in de kop (titel, +, NEXT, NL|EN) of in de voetregel van de kaart; alle
        tikdoelen ≥ 44 px; donkere modus leesbaar (`var(--cobalt)` op `var(--card)`).
12. [ ] Dexie nog v7; geen nieuwe dependency in package.json; tests/token.test.ts onaangeroerd.
13. [ ] DEVICE-TEST rij 58 aangepast, rijen 70 en 71 in NL én EN; STATUS.md bijgewerkt per blok.
14. [ ] `npm run check`, `npm test`, `npm run build`, `npm run build:next` groen; /next/ eerst, dan main.

## 8. Open vragen voor Stijn

1. Tot 6D er is staat onder de begroeting één dunne regel "🏆 Badges 7/40 ›" (zodat de ingang naar Badges
   op Home niet verdwijnt). Wil je die liever helemaal weg tot 6D? Zeg "weg" en Opus laat `HomeLevelRow`
   null renderen; de plek blijft gereserveerd.
