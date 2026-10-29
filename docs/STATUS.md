# Status — Rutgers' Recepten (bijgewerkt 29 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).
Losse ideeën voor later (niet gepland) staan in **docs/IDEAS.md**; eerste idee: voedingswaarden en macro's
(17 okt). Stijn wil eerst het XP/level-plan (6D) en de rest afmaken.

## 29 okt (Opus): 6D-2a — badge-catalogus, regelsoorten en registratie
**Besluit Stijn (29 okt): toch direct naar `main`** ("laat die next maar zitten"); tot 6D-2b toont de oude badgepagina de
geheime badges bij naam en "{n}" letterlijk — 6D-2b volgt meteen. 6D-2b bouwt een **stille eerste registratie**: de eerste
badgecontrole na deze update registreert alle al behaalde badges en niveaus zonder toast (setting
`badges.catalogSynced` = 2), daarna gewoon toasts per nieuw niveau. Ontbrekende tekst §1a.7: key `badges.unlocksTier`
NL "op niveau {colour}" · EN "at {colour} tier" (6D-2b). Cycle-guard `badgeStatuses(memberId, { xp: false })` in
buildXpFacts akkoord (Overcooked!-badge telt in XP zodra hij geregistreerd is). Overige keuzes van bouwers A, B en C
akkoord. `vaste-klant` komt bij 6C. Gate groen (1265 tests), geen bevindingen.
Gebouwd volgens docs/specs/badges-avatar.md blok 6D-2a (bouwer A domein, B data en validator, C app-laag, integrator).
Niet gecommit. Geen Dexie-versie, geen nieuwe dependency. Gate groen: check, 1265 tests, build, build:next,
validate:data (0 fouten; 2 waarschuwingen: de keukens van Duizend-en-één en Switi staan nog in geen enkele klassieker).
Voor de gebruiker verandert er weinig zichtbaars: de nieuwe badgepagina, toastteksten en de 32 haakjes in de schermen
zijn blok 6D-2b.
- **Catalogus:** data/badges.json heeft 149 regels: 143 actieve badges (115 zichtbaar, 28 verborgen = 27 in Geheim +
  het hartje) en 6 oude die met pensioen zijn (keukenbaas, chef-kok → Huiskok; kookboekauteur → Receptenschrijver; proever,
  culinaire-avonturier → Ontdekkingsreiziger; vaste-prik → Op dreef). Alle 44 oude ids staan er nog. **Vaste klant** is
  weggelaten tot 6C online is (§2d); daarna 144. data/avatar-parts.json heeft de 66 onderdelen van §2f (pas zichtbaar in 6D-3).
- **Regels:** acht groepen, ladders met acht kleurniveaus (geel → platina; de voortgang loopt naar het volgende niveau),
  alle nieuwe regelsoorten (seizoenen, weekdagen, uur, drie dagen hetzelfde recept, vrijdag de 13e, feature-tellers,
  tweede kans, oude liefde, Overcooked!, volle weken, foto's per lid). `recordFeature` (src/features.ts) schrijft
  `features.log`, maar wordt nog nergens aangeroepen (6D-2b).
- **Registratie:** `badges.earned` krijgt `id` en `id@k`; een nieuw niveau geeft één toast voor het hoogste nieuwe niveau,
  de tussenliggende stil; een geregistreerd niveau blijft staan als de telling daalt. Back-up terugzetten voegt
  `badges.earned` samen (unie), net als `features.log` en `donate.hearts` (hoogste per lid); `avatar.seen` blijft op de telefoon.
- **XP:** regelversie 2. Ladders 50 × niveau per bereikt niveau, geheime badges 250, ontdekkers 100, het hartje 0. Wie de
  app opent krijgt één keer de melding "De XP-regels zijn vernieuwd"; de stand wordt stil herberekend.
- **Integrator:** fixture in tests/validate-data.test.ts kreeg `group: 'koken'`; nieuw tests/badges-registration.test.ts
  (registratie, vaste niveaus, herstel-merge), tests/fixtures/badge-log.ts (§6b: 40 kookbeurten, twee leden) met
  tests/badge-log.test.ts (hele catalogus erop); verouderd commentaar in src/domain/days.ts weg.
- **Dev-app (375 px, NL en EN):** de oude badgepagina toont de nieuwe catalogus (eigen tab "5 van 136", Samen "7 van 143",
  Huisgenoten alleen op Samen; Huiskok "3/5"). `recordFeature('theme')` schreef het log en gaf "Van kleur verschoten";
  Herfstpot kreeg niveau 1 en 2 met één toast; met badges uit werd niets geschreven; herstel van een kunstmatige back-up
  voegde samen zoals bedoeld; een geregistreerd `huiskok@4` hield Huiskok op niveau 4 bij 3 kookbeurten. Geen
  consolefouten. Instellingen daarna teruggezet; alleen `xp.seenRulesVersion` (2) en `xp.lastSeen` (628 XP, level 6) zijn
  bij het openen door de app zelf bijgewerkt (de stille herberekening na de regelwijziging).
- **Graag beslissen (Stijn/Fable) — tussenstand tot 6D-2b:** de oude pagina toont ook de 28 geheime badges mét naam, de
  uitleg toont `{n}` letterlijk ("Kook {n} keer"), en de toast zegt nog "Nieuwe badge: …". De eerste controle na de update
  geeft elke al gehaalde nieuwe badge en elk al gehaald niveau een eigen toast van 6 s (testprofiel met 3 kookbeurten:
  6 toasts; met veel kookbeurten veel meer; de spec kent geen stille eerste registratie). §4 zegt: 6D-2a online op
  `/next/`. Advies: 6D-2a pas samen met 6D-2b naar `main`, ook al gaan blokken sinds 23 okt direct door.
- **Keuzes die de spec niet maakte (graag bevestigen):** (1) XP en badges vroegen elkaar op: `buildXpFacts` vraagt de badges
  nu zónder XP-stand, dus Overcooked! telt in de XP pas zodra hij geregistreerd is (direct na de kookbeurt). (2) tijdelijk
  type `AvatarPart` in src/badges.ts tot 6D-3. (3) een avatar-onderdeel staat alleen in de eigen toast, nooit in een
  Samen-toast. (4) de validator kopieert de groepen, feature-ids en avatarlagen (Node kan de domeinmodules niet laden);
  een test bewaakt de groepen en ids, de lagen pas in 6D-3. (5) de 6 gepensioneerde badges houden hun oude regel en
  krijgen de groep van hun §2d-kopje; het oude veld `tier` blijft. (6) de waarschuwing "meer dan 150" telt alleen actieve
  badges; "in geen klassieker" alleen keuken-, tag- en ingrediëntladders. (7) extra validatorregels: `hidden`/`retired`
  alleen true/false, `replacedBy` zonder `retired` en onbekende regelvelden geven een waarschuwing, een onderdeel van een
  gepensioneerde badge is een fout, `sameRecipeDays` altijd met `n`. (8) een badge in Geheim is altijd verborgen. (9)
  regels die alleen het log lezen tellen ook kookbeurten van een recept dat niet meer bestaat. (10) een verborgen
  ladder zou 250 eenmalig krijgen in plaats van 50 × niveau (bestaat niet in de catalogus).
- **Open:** §1a.7 zegt dat achter "Geeft: {part}" bij een ladder "op niveau {colour}" komt, maar noemt geen key en geen
  Engelse tekst: niet toegevoegd, graag beslissen vóór 6D-2b. De regel "elk level 1–100 ontgrendelt iets" hoort bij 6D-4a.

## 28 okt (Opus): 6D-1 — XP, levels, pops en level-up
**Besluit Fable (28 okt), zonder reviewlens (weeklimiet 91%; Stijn test zelf):** geaccepteerd: stil bijwerken van `xp.lastSeen`
bij badges uit en het stil voorbereiden bij de start (anders popt de hele historie bij de eerste actie); somregel 600 ms na
de laatste pop, 1,4 s zichtbaar; geen streaktekst bij een streak van 1 met de laatste kookbeurt gisteren; `--gold` in xp.css;
placeholder-type `Unlock` tot 6D-3; de timing-test meet nu de beste van vijf runs in plaats van de mediaan (de limiet van 50 ms blijft).
**Voor de volgende lichte fixer-ronde (morgen):** (a) Home toont twee avatars (begroeting + LevelLine): de LevelLine op Home
krijgt géén eigen avatar; (b) het level-up-venster heeft Sluit twee keer (kop en onderaan): alleen in de kop; (c) **k-verschuiving
bij terugdateren**: een later teruggedatéérde kookbeurt verlaagt de k (hoeveelste keer dit recept) van latere kookbeurten en
daarmee hun XP — dat botst met "nooit iets afpakken". Besluit: k volgt de volgorde van invoer (`loggedAt`, anders `at`), niet
de kookdatum; pins in tests/xp.test.ts die hierdoor verschuiven bijwerken; regelversie blijft 1 (nog niet live geweest).
Live op `main` achter de schakelaar Badges.
**Fixer-ronde 28 okt:** (a), (b), (c) gedaan; pins in tests/xp.test.ts: geen enkele verschoven (geen bestaande test en de 30-jaar-simulatie hebben `loggedAt`, dus invoervolgorde = `at`-volgorde; 1.259.039 XP, 13.430 events, 967.012 XP, levels 100/95/24/29 ongewijzigd), plus nieuwe test "k follows the order of entry" (1133 tests); 30 jaar los 26–35 ms (HEAD 25–33 ms), maar in de volle `npm test` (20 workers) haalt de timing-test de 50 ms niet, op HEAD evenmin (62–87 ms; met `--maxWorkers=4` groen, 38,6 ms).
**Besluit Fable (28 okt):** `npm test` draait met `--maxWorkers=4`: de 50 ms-test van de 30-jaar-simulatie faalde alleen bij
twintig parallelle workers (ook op de oude code), met vier workers 38 ms; de limiet van 50 ms blijft. Nog niet waterdicht bij
terugdateren met een vroegere `at` op een dag die al beloond was (zelfde recept op één dag, dagplafond, rustregel): voor de
Fable-eindcontrole; k zelf volgt nu de invoervolgorde. **Oma** verhuisd naar level 39, level 6 = Tosti-tovenaar (Stijn).
Gebouwd volgens docs/specs/xp-levels.md blok 6D-1 (deel A, het domein, staat al in e2ec454; nu bouwer B app-laag,
bouwer C UI, integrator). Niet gecommit. Alles valt onder de bestaande schakelaar **Badges**: uit = nergens XP, level,
pop of melding. Geen Dexie-versie, geen nieuwe dependency; gate groen (check, 1132 tests, build, build:next, validate:data).
- **XP wordt afgeleid, nooit opgeteld.** src/xp.ts bouwt per lid de feiten (eigen kooklog, eigen foto's via het nieuwe
  `listAllPhotosMeta()` zonder blobs, ingrediëntregels per recept, eigen recepten, verdiende badges als base 50) en
  memoiseert `deriveXp`. Nieuw veld `CookLogEntry.loggedAt` (logCooked vult het); settings `xp.lastSeen` en
  `xp.seenRulesVersion`. `settleXp` draait alleen op de zeven beloningsmomenten (recordCooked, CookScreen.onCooked,
  CookedSheet beoordelen/foto, CookScreen.onPhotoPicked, RecipeScreen.onPhotoFile, EditScreen eigen recept,
  checkNewBadges na een nieuwe badge). Bij het opstarten (`checkRulesVersion`) en na een herstel (`reloadXp`) rekent de
  app stil opnieuw: geen pops, geen venster.
- **Zichtbaar:** op elke profielkaart (Meer → Profielen beheren) "Level 4 · Afwasser", "304 / 352 XP", een kobalt balk en
  "🔥 vandaag gekookt · nog 48 XP tot level 5"; op Home onder de begroeting dezelfde levelregel met avatar en ›
  (vervangt "🏆 Badges x/y"; tik → Profielen). Pops rechtsboven: blauw "+136", goud "+216 · Cooked!", tomaatrood
  "+… · OVERCOOKED!" met schudden (niet bij Confetti uit of minder beweging), bij twee of meer "samen +… XP". Na de
  laatste pop het venster "🎉 Level N!" met de titel (en de note, bv. Oma). Toasts "Genoeg gekookt voor vandaag — morgen
  weer XP.", "Drukke keukenweek! Morgen weer XP." en (eenmalig na een regelwijziging) "De XP-regels zijn vernieuwd…";
  in Gekookt bij **Andere datum** meer dan 7 dagen terug de regel "Langer dan een week geleden: …".
- **Integrator:** `markXpDirty` ook na het hernoemen van een profiel (eigen recepten tellen op auteursnaam) en na het
  weghalen van een foto (RecipeScreen); beide stil, geen beloningsmoment. Alle i18n-keys van §1a–§1e stonden er al.
- **Dev-app (375 px, badges aan, NL en EN), §6b:** 1. nieuw testprofiel, één kook van Afwasmachinezalm: "+216 · Cooked!"
  op 0,9 s, "+52" (badge Eerste hap) 350 ms later, "samen +268 XP", daarna "🎉 Level 4!" Afwasser. 2. kaart en Home als
  hierboven; tik op de Home-regel opent Profielen. 3. hetzelfde recept nog eens: stil; kookbeurt 4 en 5 van de dag half
  (48, 54); de zesde andere: toast dagplafond. 4. de regel verschijnt vanaf 8 dagen terug (7 niet); na Bewaar geen
  kook-pop, wél "+53" omdat die kookbeurt de badge Glutenvrijbuiter gaf (klopt: telt voor badges). 5. sterren achteraf:
  "+5". 6. badges uit: geen balk, geen Home-regel, geen pops, geen badge-rij; weer aan: zelfde stand, geen pops.
  7. alleen `reloadXp()` gedraaid (geen reset): geen pops, zelfde totalen. Regelmelding getest met
  `xp.seenRulesVersion` = 0: toast, setting weer 1, weg na 5 s. EN: "Level 6 · Grandma", "+159 XP in total", "That's
  plenty for today …". 8–10 horen bij 6D-3/6D-4. Geen consolefouten van de app. Testprofiel, zijn elf kookbeurten en de settings
  weer weg/terug zoals ze waren (Stijn: 3 kookbeurten, level 4, 304 XP).
- **Telefoontest:** docs/DEVICE-TEST.md rij 92 (XP en levels) en 93 (eerlijk over 0 XP), NL en EN, na rij 102. Eerlijk
  erbij gezet: wie al eerder kookte, staat meteen hoger (oude kookbeurten tellen mee, stil berekend); een teruggedateerde
  kook kan wél een badge-blokje geven.
- **Graag beslissen (Stijn/Fable):** (1) badges uit: `settleXp` legt de stand toch stil vast en de opstart rekent alle
  profielen stil door (anders popt bij weer aanzetten of na de update ineens de hele geschiedenis); de regelmelding wacht
  tot badges aan staan. (2) de somregel staat 600 ms ná de laatste pop en blijft 1,4 s (andere lezing: hij staat maar
  600 ms). (3) streak 1 met de laatste kookdag gisteren: geen streaktekst ("vandaag gekookt" zou niet kloppen); een eigen
  tekst? (4) Home toont nu twee avatars onder elkaar (begroeting + levelregel, zoals §1b zegt). (5) `--gold` staat in
  xp.css, niet in base.css. (6) het level-up-venster heeft Sluit boven én onder (§1d letterlijk). (7) in een browsertab
  vallen de pops over de browsermelding heen (de app zelf niet). (8) domein (deel A): een teruggedateerde kook van een
  recept dat je daarna nog kookte, schuift de telling k op, dus die latere kookbeurt zakt 10 base (in de test 110 → 99
  XP): XP kan zo een beetje dalen, terwijl §5 zegt "nooit iets afpakken". (9) een XP-wijziging zonder beloningsmoment
  (bv. een klassieker met extra regels via de editor) komt als kleine pop bij het volgende beloningsmoment.
  (10) de 50 ms-test van de 30-jaarrun (tests/xp.test.ts) haalde bij de bouwers één keer 56–69 ms op een drukke pc;
  bij mij twee keer groen.

## 25 okt (Opus): Boodschappen — Leeg de lijst
**Besluit Fable (25 okt):** ook "Elke week"-regels (pins) gaan mee weg bij Leeg de lijst, Ongedaan zet ze terug; de vaste
lijst van 6C wordt de plek voor wat elke week terugkomt en blijft bij een leging staan. Archief van afgevinkte dingen:
docs/IDEAS.md idee 2. Gebouwd in lichte modus (één bouwer + gate, 10 min, 0,26 M tokens). Direct naar `main`.
Stijn wilde tussendoor snel een nieuw lijstje kunnen maken (er stonden nog testdingen op; één voor één inhouden →
Verwijder duurde te lang). Niet gecommit.
- **Knop Leeg de lijst / Clear the list** in de knoppenrij van Boodschappen, direct na **Klaar**; zichtbaar zodra er
  iets op de lijst staat, niet in de winkelstand. In de controlestap (na "Maak de lijst") staat hij onder **Bevestig lijst**.
- **Eén tik, geen vraag vooraf:** alle regels en zelf toegevoegde dingen weg, en de lijst vergeet voor welk weekplan hij
  gemaakt was (`generatedFrom` '', geen `generatedFromAll`, `sharedAt` null). Met een weekplan staat daarna weer de kaart
  met **Maak de lijst**, zonder weekplan de lege tekst. Weekplan, "Heb ik al"-geheugen en instellingen blijven staan.
- **Ongedaan** in de bestaande melding (5 s, "Lijst geleegd" / "List cleared") zet de oude lijst exact terug: regels,
  vinkjes, hashes, "gedeeld om" en `updatedAt`. Wie vanuit de controlestap leegde, komt ook weer in de controlestap.
- Code: `emptiedList` (puur), `clearShoppingList` en `restoreShoppingList` in src/db/repo.ts; knop en `clearAll` in
  src/screens/ShoppingScreen.tsx; `shop.clear` / `shop.cleared` in src/i18n/shopping.ts; test
  tests/shopping-clear.test.ts. Telefoontest: docs/DEVICE-TEST.md rij 102. Het archief van afgevinkte dingen staat
  als idee in docs/IDEAS.md (§2), niet gepland.
- **Graag bevestigen (Stijn):** "elke week"-regels gaan mee weg (ze staan in dezelfde lijst); de "eerder"-suggesties
  in het +-vak komen uit de zelf toegevoegde dingen en zijn na het legen ook weg.

## 24 okt (Opus): 6B blok 6 — keukens wereldwijd (61 keukens, Litouws voor Gabi)
Gebouwd volgens het besluitblok "Blok 6 — keukens wereldwijd" bovenaan docs/specs/labels-categorieen.md (bouwer A
data + domein + import, bouwer B editor, integrator). Niet gecommit. Wat er nu staat:
- **Data:** data/cuisines.json houdt de 18 gewone keukens van §2c ongewijzigd (order 1–18, zonder `rare`) en krijgt
  er 43 **reservekeukens** bij met `"rare": true`, order 19–61, in de volgorde van het besluitblok (Europa,
  Midden-Oosten/Afrika, Azië, Amerika, Oceanië). Ids zijn kleine letters/ASCII (`oekraiens`, `israelisch`), de
  namen hebben een hoofdletter (Oekraïens, Israëlisch), elk land zijn eigen vlag, Caribisch 🇯🇲. Litouws =
  `{ id: "litouws", nl: "Litouws", en: "Lithuanian", flag: "🇱🇹", order: 25, rare: true }`. recipes.json en
  data/review/meta.json zijn niet veranderd: **geen DATA_VERSION-bump**, geen migrate, Dexie blijft v7.
- **Type en validator:** `Cuisine.rare?: boolean`; validate-data meldt een `rare` dat geen true/false is.
- **Filterchips** (Home, Recepten, Week, Kies 7) zijn ongewijzigd: alleen keukens die in recepten voorkomen. Een
  reservekeuken verschijnt daar dus pas als een recept hem heeft.
- **Editor en "Controleer mijn recepten":** de rij Keuken toont "geen", de 18 gewone keukens en elke reservekeuken
  die gekozen is of in een bestaand recept voorkomt. Daaronder een gewone keuzelijst **Andere keuken…** / **Other
  cuisine…** (16 px, 44 px hoog, volle breedte) met alle 43 reservekeukens met vlag, alfabetisch in de UI-taal.
  Kiezen zet die keuken aan (hij verschijnt als groene chip) en de lijst springt terug naar "Andere keuken…".
- **Importprompt:** noemt alleen de 18 gewone ids en zegt daarna "of een ander land als bijvoeglijk naamwoord in
  kleine letters (bijvoorbeeld litouws, peruaans)" / "or another country as a lower-case adjective (for example
  lithuanian, peruvian)". Het plakken kent alle 61: "Lithuanian", "Litouwse", "Litouwen", "Peruvian",
  "Zuid-Afrikaans" … worden de juiste id.

**Keuzes van de bouwers die de spec open liet (graag even bevestigen):** Engelse namen Filipino, Nepalese,
Argentinian, Israeli, Persian; Nederlandse Oekraïens, Israëlisch, Sri Lankaans. Extra woorden bij het plakken:
iraans/iranian/iran → Perzisch, caraïbisch/caraïben → Caribisch, zuid-korea → Koreaans; "jamaica" bewust niets. De
promptzin staat zonder komma achter de lijst ("…, amerikaans of een ander land …"). De keuzelijst verschijnt niet
als er geen reservekeukens zijn. In "Controleer mijn recepten" telt alleen de eigen lijst (eigen en ontvangen) als
"in gebruik"; de editor kijkt naar alle recepten, ook klassiekers met een eigen keuken in hun aanpassing.

**Integrator:** tests/apply-meta.test.ts gebruikte `zuid-afrikaans` als voorbeeld van een onbekende keuken; dat is
nu een echte keuken, dus het voorbeeld is `mongools` geworden. De commentaarregel in src/domain/data.ts en de rij
cuisines.json in data/README.md noemen nu 61 keukens en `rare`. Niet veranderd (de spec zegt er niets over):
`tools/make-batch-inputs.ts buildVocab` zet nu alle 61 keukens in `vocab.cuisines` (het zijn geldige ids).

**Open voor Stijn/Fable:** (1) de bewuste nulls van §2c (Boeuf Stroganoff, Zuid-Afrikaanse gehaktschotel, Noorse
visschotel) hebben nog steeds geen keuken, al bestaan Russisch, Zuid-Afrikaans en Noors nu; de spec wijst ze niet
toe, dus niets toegevoegd. (2) Uitrol: het besluitblok zegt niet of dit direct naar `main` mag; standaard (README
§3a punt 11) eerst `/next/`.

**Gedraaid:** check, test (1084 in 48 bestanden), build, build:next en validate:data zijn groen (0 errors, 61
cuisines; alleen de bekende warnings). Geen nieuwe dependency, geen nieuwe route of setting; één nieuwe i18n-key
`meta.cuisineOther` (NL "Andere keuken…", EN "Other cuisine…").

**Dev-app (375 px, NL en EN, licht en donker):** Recepten toont in de rij Keuken dezelfde 16 keukens als voorheen.
De editor van een eigen recept toont "geen" + 18 chips en de keuzelijst met 43 keukens (NL Argentijns … Zwitsers,
EN Argentinian … Vietnamese). Litouws kiezen → chip "🇱🇹 Litouws" groen; na Bewaar staat "Keuken: 🇱🇹 Litouws" op
de receptpagina en "🇱🇹 Litouws" als laatste chip in de rij Keuken van Recepten (tik → "1 van 218 recepten"). In
een nieuw recept stond Lithuanian toen ook als chip (in gebruik). Terug op "geen" en bewaard → de chip verdwijnt
weer uit de filterrij. Geen horizontaal scrollen, geen consolefouten. Op Windows toont Chrome de vlaggen als twee
letters ("LT"); op telefoons zijn het vlaggen. **DEVICE-TEST:** rij 76 heeft in beide tabellen een stap 7 (editor
→ Andere keuken… → Litouws → chip actief; na Bewaar staat 🇱🇹 Litouws in de rij Keuken van Recepten).

## PAUZE (24 okt) — volgende stap: 6D-1 XP-kern, in lichte modus
Stijn wil op woensdagavond 28 okt kijken wat er van de weeklimiet over is. Stand: Home A+, kookbalk (13K), labels en
categorieën (6B + 13E, zes blokken) en de 20 bijgerechten staan allemaal op `main`; 216 klassiekers, DATA_VERSION 9,
1084 tests. Besluiten van 24 okt (docs/specs/README.md §1 en §3b): **lichte bouwmodus** (bouwers → integrator → één
Opus-correctness-lens → fixer alleen bij bevindingen → Haiku-gate; data-blokken alleen de gate), **XP eerst** (6D-1 →
6D-2 → 6D-3 → 6D-4, daarna 13F, 13D, 6C, 13J, Z), **ambitie 6D omhoog** (avatar zeven lagen × 40–70 onderdelen in
rondes, rijke ontgrendelingen, gouden modus, challenges op level 20 — zie de besluitblokken bovenaan
badges-avatar.md en xp-levels.md), en Stijn reviewt zelf bij het testen (de Fable-eindcontrole kan kleiner; woensdag
bespreken). Later op 24 okt nog gebouwd (lichte modus, 19 min, 0,7 M tokens): **6B blok 6 — keukens wereldwijd**: 61 keukens (18 gewone
+ 43 reserve met `rare: true`, waaronder Litouws voor Gabi), editor met "Andere keuken…", prompt met "of een ander land",
en door Fable drie toewijzingen (Boeuf Stroganoff russisch, Noorse visschotel noors, Zuid-Afrikaanse gehaktschotel
zuid-afrikaans) → **DATA_VERSION 9** (13F wordt 10; README en inbouwen.md aangepast). 1084 tests.
**Vragen voor woensdag:** (1) meerdere keukens per recept? Besluit van 6 okt is één; meer vraagt een lijstveld en raakt
validator, migratie en deellink. (2) Het label `wereld`: 43 recepten dragen het, 28 daarvan hebben nu een keuken; weghalen
raakt data, filters en teksten. (3) Hoe klein mag de Fable-eindcontrole nu Stijn zelf test.
Werkmap: branch `next` = `main`, schoon. Tijdlijn: https://claude.ai/artifact/6LXkS8KpLeqJfkXLYPrg3L.

## 23 okt (Opus): de 20 bijgerechten (13E) — 216 klassiekers
**Besluit Fable (24 okt) over de restpunten:** rij 81 noemt nu "25 bijgerechten" (de twintig nieuwe en de vijf uit 6B); de botsingscontrole in validate-data filtert op `createdAt === SIDES_TIMESTAMP` zodat hij echt kan afgaan — akkoord; `lactosevrij` op de twaalf plantaardige bijgerechten is juist (geen zuivel, dus geen lactose; de dieettabel van §2g was van vóór 6B blok 2); de Kies-sheet toont bijgerechten pas met de chip Bijgerecht of "ook bijgerechten & zoet" — dat is het bedoelde 6B-gedrag. Review: 3 bevindingen (2 echte), alle verwerkt; gate groen (1082 tests). Uitrol: direct naar `main`.
Gebouwd volgens docs/specs/bijgerechten.md (hele blok, bouwers A data, B pijplijn en tests, C zoeken en
planner-test, integrator). Niet gecommit. Volgens §4 en §8 vraag 2 mag dit direct naar `main` (eerst `/next/`
mag ook). Na de commit en deploy staan er **216 klassiekers** in de app: de 196 uit Recepten2 plus 20 nieuwe,
tweetalige bijgerechten in de categorie **Bijgerecht**, van Stokbrood met kruidenboter tot Focaccia met
rozemarijn, met Engelse tekst die door een mens is geschreven (`text.en = 'human'`, dus geen hint
"machinevertaling"). **`DATA_VERSION` is 8**: elke telefoon laadt de bundel één keer opnieuw, en favorieten,
kooklog, overrides en instellingen blijven staan. Dexie blijft v7. Er zijn geen nieuwe i18n-keys, geen CSS en
geen dependency; landing.ts, sw.ts, token.ts, planner.ts, PickSheet.tsx, WeekScreen.tsx en HomeScreen.tsx zijn
niet aangeraakt.

Hoe de 20 erin komen:
- Bronbestand `data/source/bijgerechten.json` (schema `sides-1`, de blokken van §2g letterlijk) en
  `tools/sides.ts` (`checkSides`, `sidesToRecipes`). `npm run migrate` zet ze na `applyReview` en vóór
  `applyMeta` en `applyDerivedTags`. Uitvoer: `216 recipes (216 unique ids), 2010 ingredient lines + 17
  headers`, `dataVersion 8`, 20 nieuwe `goesWith`-regels en 75 recepten met een keuken. Vier bijgerechten hebben een keuken
  via meta.json: tzatziki grieks, guacamole mexicaans, focaccia italiaans, couscous marokkaans.
- De 196 bestaande recepten zijn inhoudelijk ongewijzigd. `tests/parser.golden.json` ging van 1377 naar
  **1443** regels; er zijn alleen 66 regels bijgekomen en geen bestaande veranderd. `validate:data` meldt
  "20 side dishes, 127 lines" en 0 errors. `measure-parse` geeft identieke uitvoer.
- **Gedraaid:** check, test (1082 tests in 48 bestanden), build, build:next, validate:data en migrate. Alles
  is groen.
- Badges "Het hele boek" en "Halverwege het boek" tellen nu tot **216/108**.
- Zoeken: "patat", "friet" en "frietjes" vinden Ovenfrietjes, "koolsalade" en "koolsla" vinden Coleslaw.
- Kies 7, Verras me, 🎲 en de Home-dobbelsteen kiezen de 20 niet. Dat komt door het bestaande filter
  `mainOnly` van 6B.

**Dev-app (375 px, NL en EN), §6d nagelopen:**
- §6d.1: chip Bijgerecht geeft een platte A–Z-lijst met 25 recepten (20 nieuw + 5 uit 6B). In het
  Nederlands loopt die van Aardappelpartjes tot Worteltjes, in het Engels van Baguette with herb butter tot
  Tzatziki. "patat" vindt Ovenfrietjes, "koolsalade" vindt Coleslaw, "sesame" vindt Gestoomde broccoli onder
  "Met dit ingrediënt".
- §6d.2: Knoflookbrood heeft 6 regels, een timerchip ⏱ 10 min en onder "Bij dit gerecht" Klassieke lasagne,
  Penne all’ arrabbiata en Spaghetti Bolognese. Bij de bolognese staat Knoflookbrood terug.
- §6d.3: in Rode kool met appel is in de kookstand "rode kool" groen in stap 2 (tik geeft "(1)"), en stap 3
  heeft ⏱ 45 min.
- §6d.4: Witte rijst voor 2 personen geeft 150 g basmatirijst en 225 ml water.
- §6d.5: Verras me drie keer, 🎲 vijf keer en de Home-dobbelsteen tien keer gaven nooit een bijgerecht. In
  de Kies-sheet met chip Bijgerecht gaf Verras me · 7 alleen bijgerechten. In het Engels gaf Surprise me ook
  geen bijgerecht.
- §6d.8: de badges tonen …/216 en …/108.
- §6d.9: een geplakte deellink van Knoflookbrood geeft "Heb je al".
- §6d.6 is met `aggregate` + `groupByAisle` in Node nagerekend, niet in de app, omdat dat de
  dev-boodschappenlijst zou overschrijven. Uitkomst: "5 teentjes knoflook" is samengevoegd, peterselie
  blijft twee regels, en water staat onder Overig.
- §6d.7 (back-up maken en terugzetten) is niet gedaan, want daarvoor moet een bestand worden gedownload en
  geüpload. Volgens de code reizen builtins niet mee en zet `ensureBuiltins` ze terug.

DEVICE-TEST rij 81 staat erin, in NL en EN. Eén knopnaam is aangepast (§5 punt 11): in stap 6 stond
"**Kies 7**", nu "**+ Kies meer**" / "**+ Pick more**". Na stap 5 staan er al zeven gerechten in de week en
dan toont de app die knop in plaats van "Kies 7".

**Open voor Fable/Stijn:**
1. De dieettabel van §2g is geschreven vóór lactosevrij (6B blok 2). `applyDerivedTags` zet nu op 12
   bijgerechten ook `lactosevrij`: de 11 vegan bijgerechten en de groene salade. De `DERIVED`-tabel in
   tests/sides.test.ts heeft die erbij gekregen (§5: "de tabel in de test bijwerken, niet de data").
   Graag bevestigen.
2. Rij 81, uitkomst 2, zegt "twintig bijgerechten" / "twenty side dishes". Met 6B toont de chip er 25. De
   eerste en laatste naam kloppen wel. De tekst is volgens §5 punt 11 letterlijk gelaten (ook na de review).
   Fable kiest: (a) "Je ziet 25 bijgerechten, …" / "You see 25 side dishes, …", of (b) "Je ziet 25
   bijgerechten, waaronder de twintig nieuwe, …" / "You see 25 side dishes, the twenty new ones among
   them, …". Tot dan kan een tester stap 2 ten onrechte als fout melden.
3. §1 zegt dat de bijgerechten zonder chip in de lijst van de Kies-N-sheet staan. In de app van 6B gebruikt
   die lijst ook `mainOnly`: ze verschijnen pas met de chip Bijgerecht of met "ook bijgerechten & zoet". Dat
   is 6B-gedrag en hier niet veranderd.
4. De chip in de Kies-sheet is hetzelfde filter als op de Week-pagina. Na rij 81 stap 6 staat Bijgerecht dus
   nog aan, en geeft Verras me op de Week-pagina bijgerechten tot je de chip uitzet. Ook dat is bestaand
   6B-gedrag.
5. Bekende beperking (§1 Delen): een telefoon zonder deze update zegt bij een gedeeld bijgerecht "Nieuw" en
   bewaart een kopie onder het `b:`-id. Na de update overschaduwt die kopie het ingebouwde recept. Dat wordt
   opgeruimd in 13F blok 3; tot dan eerst beide telefoons bijwerken.
6. Bijwerking van de bestaande prefixregel (`termVariants`): "kool" vindt nu ook Coleslaw, en "frie",
   "frit", "pata" en "chip" vallen nu onder de friet-groep.
7. Klein, en niet van dit blok:
   - In het Engels staat achter "50 g grated cheese (optional)" de bestaande uitleg van het woordenboek over
     kaas.
   - Op de boodschappenlijst staat de 7 g peterselie van de bolognese als "5 g", door de afronding van
     `roundForDisplay`.
   - De deellink in de dev-server begint met `http://localhost:5173/#r=`, zonder `/recepten/`.
8. Afwijking van de letterlijke code in §2d (review, fixer): `validate:data` haalt nu alleen de gegenereerde
   bijgerechten (`createdAt === SIDES_TIMESTAMP`) uit de klassiekers, niet elk recept met een id uit het
   sides-bestand. Met het filter op ids viel een klassieker met hetzelfde id weg en vuurde de botsingsregel
   nooit; zo doet hij wat §2d wil ("zo blijft de botsingsregel werken").
9. In de werkmap stond al een niet-gecommitte wijziging in docs/specs/README.md (de besluiten van Stijn van
   23 okt). Die komt niet van deze run en is zo gelaten. Bouwer B heeft in data/README.md ook de ontbrekende
   regel "version 7 = …" toegevoegd.

## 23 okt (Opus): 6B blok 5 — editor Labels en prompt ontbrekende ingrediënten
**Besluit Fable (23 okt) over de restpunten:** (1) een nieuwe entry uit het AI-antwoord is vegetarisch tenzij het schap `vlees-vis` is, en altijd vegetarisch bij "vegan: ja" (geen nieuw promptveld); (2) een eigen entry met dezelfde Nederlandse en Engelse naam (csipetke, pesto) telt als compleet zodra schap én de drie vlaggen zijn ingevuld, zodat de kaart "Niets aan te vullen" kan bereiken; een lege Engelse naam blijft ontbreken; (3) een niet-gekoppelde regel waarvan de naam inmiddels bekend is, blijft buiten telling en prompt (geen dubbele entries; koppelen gebeurt bij het eerstvolgende bewerken van het recept); (4) de M-nummers zijn vastgelegd op het moment van kopiëren (fixer) en een twijfelantwoord ("no idea", "n.v.t.") telt nooit als nee. Keuzes van bouwers en integrator akkoord (rij 79–80 aangepast aan de echte app). Besluit 1 en 2 doorgevoerd in een aparte fixer-run; gate groen. Uitrol: direct naar `main`. **Hiermee is 6B+13E (labels-categorieen.md) helemaal gebouwd.**
Gebouwd volgens docs/specs/labels-categorieen.md §1e, §1f en §3 blok 5 (bouwer A domein, bouwer B editor, bouwer C
woordenboek, integrator). Niet gecommit. Volgens §4 mag dit blok direct naar `main` (geen deelformaat, geen data).
Wat er nu staat:
- **Editor:** categorie, keuken en dieet & labels staan in een eigen laatste kaart **Labels** (`meta.title`), na de
  vertaalkaart en direct boven de onderste Bewaar. Bovenaan de kaart staat de nieuwe uitlegregel `meta.kindsHint`
  (Categorie · Keuken · Dieet & labels; die regel staat ook in Controleer mijn recepten). Voorstel en Overnemen werken
  als voorheen; een keuken wordt nooit voorgesteld. De bestaande regel "Voorstel op basis van naam …" staat onder de
  rijen in de kaart. Nog steeds één formulier, geen wizard, geen route.
- **Woordenboek:** in de standaardweergave (geen zoekterm, geen schapfilter), onder Opruimen, de kaart **Ontbrekende
  gegevens aanvullen met AI**: telregel, "Eerst deze 40 …" boven 40, de prompt in een zichtbaar vak (iPhone: zelf
  selecteren) plus Kopieer, **Plak antwoord** → gewoon tekstvak → **Bekijk voorstel** → MissingSheet (SheetPortal,
  Annuleer en Zet in woordenboek bovenaan, wegvegen/Escape/ernaast tikken bewaart niets). Bij 0 alleen "Niets aan te
  vullen …". Bewaren schrijft via `saveUserIngredient` en `linkUserRecipeLine` (alleen `ing`; raw blijft staan), daarna
  `reloadDictionary()` en de snack "{updated} aangevuld, {created} nieuw, {linked} regels gekoppeld".
- **Domein:** het nieuwe src/domain/dictionary-prompt.ts (`collectMissing`, `buildMissingPrompt`,
  `parseMissingAnswer`, `planMissingAnswer`) volgt de besluiten van de kritische lezer: `en` ontbreekt als `en.one`
  gelijk is aan `nl.one` (hoofdletterongevoelig), `nl` nooit; schap `overig` telt als ontbrekend; een vlag ontbreekt
  alleen als hij afwezig is. "misschien" = `false` + `…Unsure`; een onbekend schap laat het schap staan; een ingevuld
  veld wordt nooit overschreven; een nieuwe entry alleen met nl én en. Lactose streng met regel H1 (vegan ⇒ lactose
  false zonder twijfel; vegan ja + lactose ja houdt de lactose en laat vegan leeg). 28 tests in
  tests/dictionary-prompt.test.ts (alle gevallen van §6a); de prompt van het voorbeeld in §1f komt er letterlijk uit.

**Integrator:** de twee keys van bouwer B toegevoegd in src/i18n/edit.ts, letterlijk uit §1e: `meta.title`
("Labels" / "Labels") en de nieuwe tekst van `meta.kindsHint` (NL en EN). Verder geen code gerepareerd.
**Gedraaid:** check, test (1046 in 47 bestanden), build, build:next en validate:data groen (0 errors, alleen de
bekende swap-warnings). Geen nieuwe dependency; Dexie blijft v7; `DATA_VERSION` blijft 7; landing.ts, sw.ts en
token.ts niet aangeraakt.

**Dev-app (375 px, NL en EN, ook donker), §6c 10–11 nagelopen:** #/add: volgorde naam … serveertip, vertaalkaart,
Labels, Bewaar; in de kaart de uitlegregel, Categorie (met de vier nieuwe), Keuken (geen + 18) en Dieet & labels.
Met AI: de prompt heeft `Keuken:`, lactosevrij en bijgerecht; een geplakt antwoord met "Keuken: italiaans" zette
pasta, 🇮🇹 Italiaans en de labels aan, met "Categorie, keuken en labels overgenomen uit de tekst.". In het Engels
"Labels" en "Category: one per recipe … Cuisine: one …". Woordenboek: eigen ingrediënt "csipetke" gemaakt via
+ Nieuw ingrediënt (Engels werd ook "csipetke", zoals de ⚠ zegt) → telregel 2 (er stond al een eigen "testzuivel"),
prompt met `M1. nl: csipetke | en: ? | schap: ? …`, Kopieer → "Gekopieerd ✓", één met de hand geschreven M-regel in
een codeblok → venster met Annuleer / Bekijk voorstel / Zet in woordenboek en "csipetke: Engels, schap, vegan,
gluten, lactose aanvullen" (aangevinkt) → snack **"1 aangevuld, 0 nieuw, 0 regels gekoppeld"**; csipetke heeft daarna
Engels "pinched noodle", schap Pasta, rijst & granen, bevat gluten, lactosevrij; telregel 1. Rommel plakken (EN) →
"I cannot read the answer …" met Add to dictionary uit; Escape sluit zonder bewaren, het geplakte blijft staan.
Geen horizontale scroll, geen consolefouten. Het testingrediënt "csipetke" staat nog in de dev-database van het
browserpaneel (Verwijder vraagt om een bevestigingsvenster dat ik daar niet kan beantwoorden); "testzuivel" stond er al.

DEVICE-TEST rijen 79 en 80 staan in beide tabellen (NL en EN), na rij 78. Aanvullingen op de tekst van §6d, omdat de
app zo werkt: rij 79 stap 4 noemt **Plak van klembord**, dan **Vul in** (de melding komt pas na Vul in); rij 80 stap 2
zegt het zoekvak eerst leeg te maken (na + Nieuw ingrediënt staat de naam in het zoekvak en is de kaart verborgen);
de ⚠-feitencheck staat als "Goed 1" in gewone taal; bij de snack staat dat de getallen hoger zijn als er meer regels
waren; en de open vraag hieronder (punt 1) staat er als waarschuwing bij.

**Review (fixer, 23 okt):** gerepareerd zijn ja/nee lezen (alleen het hele woord telt; "no idea", "N/B", "n.v.t.",
"nee/misschien" en losse letters j/n/y blijven "?", dus nooit een zekere glutenvrij- of lactosevrij-claim op
twijfel), Engelse regels (punt 5) en de nummers (punt 4). Punten 2 en 3 hieronder zijn bevestigd maar vragen een
keuze. tests/dictionary-prompt.test.ts heeft nu 34 tests.

**Open (niet door de spec beslist; vraag voor Stijn of Fable):**
1. Een Engelse naam die gelijk is aan de Nederlandse (csipetke, pesto, pizza …) telt door het besluit van de kritische
   lezer nooit als ingevuld: zo'n eigen ingrediënt komt bij elke prompt terug met `en: ?` en de kaart haalt nooit
   "Niets aan te vullen". Een AI-antwoord met dezelfde naam telt ook niet als aanvulling. Er is geen veld om "zelfde
   naam, bevestigd" vast te leggen (en een nieuw veld mag niet, README §4.2). Keuze nodig.
2. **Onware dieetclaim (review bevestigd, niet gerepareerd: keuze nodig).** Een nieuwe entry uit het AI-antwoord
   krijgt de standaardwaarden van het formulier "Nieuw ingrediënt": eenheid `stuk`, geen basisvoorraad en
   **`veg: true`**, ook bij "vegan: nee" en schap `vlees-vis`. Een recept met zo'n regel was "vegetarisch, onzeker" en
   wordt na het koppelen zeker vegetarisch (de chip Vegetarisch toont het). In het formulier ziet de gebruiker het
   vinkje, hier niet. Een veld `vega:` in de prompt mag niet (vast formaat, §5 punt 9) en "vegetarisch onbekend" kan
   het model niet uitdrukken (`veg` is verplicht, diet.ts kent geen onbekend). Twee opties: **(a)** `veg` volgt het
   antwoord: alleen `true` bij "vegan: ja", anders `false` (nooit een vegetarisch-claim op een gok; kaas, ei en melk
   heten dan niet-vegetarisch tot iemand het vinkje zet); **(b)** standaard vegetarisch houden, maar het voorstelvenster
   toont "vegetarisch" per nieuwe regel zodat je het ziet en kunt uitzetten (nieuwe UI-tekst, staat niet in §1f).
3. **Regel blijft onherkend (review bevestigd, niet gerepareerd: keuze nodig).** Een niet-gekoppelde regel waarvan het
   woordenboek de naam al kent (bv. een eigen ingrediënt dat na het recept is gemaakt, of een woordenboek-update) komt
   niet in de telling en niet in de prompt. Het contract van §3 noemt maar twee soorten regels om over te slaan
   (≤ 2 tekens en kopregels), en bij 0 zegt de kaart "alle regels zijn herkend", wat dan niet klopt. Twee opties:
   **(a)** letterlijk het contract: de regel komt in telling en prompt en wordt een nieuwe entry (een dubbele, die
   Opruimen daarna voorstelt samen te voegen); **(b)** de regel komt in de telling en wordt bij "Zet in woordenboek"
   gekoppeld aan de bestaande entry, zonder AI (een rijtekst daarvoor staat niet in §1f).
4. ~~De nummers worden live berekend~~ **Gerepareerd na de review:** kopiëren (of het promptvak selecteren) legt de
   items van die prompt vast. Het antwoord wordt daartegen gelezen, bijgewerkt naar het woordenboek van nu
   (`refreshMissingItems`): een eigen ingrediënt dat tussendoor is aangevuld wordt niet overschreven, en een gewist
   ingrediënt of een regel die intussen bekend is, wordt overgeslagen. Daarnaast is het antwoord zelf een controle.
   Een regel waarvan de ingevulde naam (`nl:`, bij een Engelse regel `en:`) een ander ingrediënt noemt, wordt
   overgeslagen met "M{n}: niet te lezen, overgeslagen". Het enkelvoud van de naam telt als dezelfde naam
   ("sultana" bij "sultana's").
5. Geeft de AI een Engelse naam die al een andere entry is, dan komt er toch een nieuwe entry; Opruimen toont de
   dubbele daarna. **Gerepareerd na de review:** een regel met alleen Engelse tekst houdt zijn naam als Engelse naam;
   de prompt vraagt dan `nl: ? | en: <naam>`, en de Nederlandse naam komt uit het antwoord (invariant 3). Nog een
   kleine keuze: de ingevulde naam van een regel blijft zoals hij er staat, ook als de AI hem naar het enkelvoud
   zet ("chorizo sausages" blijft de Engelse naam; zo staat het in "Verander niets wat al is ingevuld").
6. Keuzes van de bouwers: niet-herkende regels alfabetisch; een eigen entry met een onbekend schap-id (niet
   `overig`) telt als ingevuld; de Engelse prompttekst is van bouwer A ("EN analoog"); zes extra keys
   `dict.missingField.*` voor de {fields}-woorden (teksten uit §1f); de kop van het venster is "Bekijk voorstel"
   (`dict.missingReview`), op 360 px over twee regels; kopiëren mislukt → `edit.copyFailed`, aria van het promptvak →
   `edit.promptText`; "niet te lezen" staat in het venster; na Annuleer blijft het antwoord in het vak; vlak voor het
   koppelen worden de regels opnieuw gelezen (een regel die intussen gekoppeld of weg is, telt niet mee in {linked});
   `edit.invalidHint` staat (alleen bij een ongeldig formulier) tussen de kaart Labels en Bewaar.

## 23 okt (Opus): 6B blok 4 — categorieën en + bijgerecht
**Besluit Fable (23 okt) over de restpunten:** Boodschappen telt voortaan alleen hoofdgerechten ("Weekplan: N gerechten" en de titel van de gedeelde lijst), zoals Week, de #w=-melding en In & uit; de bijgerechtregels tellen gewoon mee in de lijst zelf. Keuzes van bouwers A, B en C akkoord: SideSheet met Sluit in de kop; pick.all telt niet mee in "filters (n)"; een `of` naar het eigen recept wordt genegeerd; een bijgerecht zonder hoofdgerecht reist als los gerecht; een ontvangen bijgerecht onder een hoofdgerecht dat al in het plan staat wordt een los gerecht; In & uit toont een bijgerecht ingesprongen zonder eigen personen; precies vijf hercategorisaties (geen klassieker naar nagerecht/gebak/ontbijt-lunch tot Stijn dat wil). Nog open voor later (geen bug): "+ Deze week" op een recept dat al als bijgerecht in de week staat voegt niets toe. Review: 4 echte bevindingen, alle verwerkt (Gekookt vinkt bijgerechten mee; Vanavond-kaart alleen hoofdgerechten; In & uit ingesprongen; telling Boodschappen). Gate groen (1018 tests). Uitrol: direct naar `main` (besluit Stijn 23 okt: geen telefoonronde; de spec wilde dit blok eerst op /next/).
Gebouwd volgens docs/specs/labels-categorieen.md §1c, §1d, §2d, §2e en §3 blok 4 (bouwer A data + domein,
bouwer B repo + Week-UI, bouwer C ontvangst van een weekplan, integrator). Niet gecommit. **Uitrol: eerst
`/next/`** (`npm run build:next`); Stijn (Android) en Gabi (iPhone) lopen DEVICE-TEST 77–78, daarna `main`.
Wat er nu staat:
- **Data:** data/categories.json heeft Nagerecht 11, Gebak 12, Bijgerecht 13, Ontbijt & lunch 14; Overig is 15
  (laatste). data/review/meta.json kreeg `category` (precies de vijf bijgerechten van §2e) en `goesWith`
  (polenta → ratatouille). `DATA_VERSION` is 7; recipes.json verschilt alleen in die vijf categorieën, de goesWith
  van de polenta en `dataVersion`/`generatedAt`. Overig houdt 12 recepten. Geen klassieker in nagerecht, gebak of
  ontbijt-lunch. Plank-iconen 🍨 🍰 🥖 🥪.
- **Alleen hoofdgerechten in de kiezers:** `NON_MAIN_CATEGORIES`, `isMainDish` en `excludeNonMain` in
  src/domain/planner.ts. Kies 7, Verras me, de 🎲 per slot, Verras me in het Kies-venster en de Home-dobbelsteen
  gebruiken `applyPickFilter(…, { mainOnly: true })`. De chip **ook bijgerechten & zoet** staat direct na het × (Week,
  Kies-venster, Home-filters), niet op Recepten. Een aangezette categoriechip Bijgerecht/Nagerecht/… telt als "ja".
  Onder de Week-chips staat "Alleen hoofdgerechten, tenzij …".
- **+ bijgerecht:** een bijgerecht is een eigen PlanItem met `sideOf`. Het SideSheet (SheetPortal) heeft "Past erbij"
  (goesWith in beide richtingen) en "Alle bijgerechten"; één tik voegt toe en sluit. In de lijst: ingesprongen
  "↳ naam" met alleen een ×. Cascades in src/db/repo.ts: personen, gekookt (aan én uit) en × volgen de hoofd;
  🎲 en Verras me op de hoofd halen de bijgerechten weg; `savePlan` laat een wees-`sideOf` vallen. Samenvatting
  "N gerechten · M bijgerechten"; "n van N gekookt" en de Home-weekkaart tellen alleen hoofdgerechten.
- **Delen `#w=`:** `of` = recept-id van de hoofd; een bijgerecht van een gekookte hoofd reist niet mee; `v` blijft 2.
  `planDishCount` en de Inbox-kop tellen alleen hoofdgerechten. Nieuw bevroren token `FROZEN_TOKEN_W_SIDE` (+ fflate),
  één keer gemaakt; de oude tokens zijn byte voor byte gelijk. Ontvangen: het nieuwe src/domain/plan-import.ts
  (`planItemsFromShare`, `sharedDishCount`) hangt een bijgerecht onder het item dat in díe overname voor zijn hoofd
  is gemaakt, anders wordt het een los gerecht (18 tests in tests/plan-import.test.ts).
- **Importprompt:** `CATEGORY_WORDS` kent de vier; 'bake' blijft oven, 'taart' blijft hartige-taart, overig staat
  als laatste in de prompt.

**Gedraaid:** check, test (1007 in 45 bestanden), build, build:next en validate:data zijn groen (0 errors, alleen
de bekende warnings). gen-golden ongewijzigd. Geen nieuwe dependency; Dexie blijft v7; landing.ts, sw.ts, token.ts,
boot.ts en aggregate.ts zijn niet aangeraakt. De integrator hoefde geen code te repareren of keys toe te voegen:
alle 11 keys van §1c/§1d staan letterlijk in src/i18n/week.ts (NL en EN).

**Dev-app (375 px, NL en EN, donker en licht), §6c 7–9 nagelopen:**
- Week leeg → Verras me, daarna nog tien keer Verras me en vijf keer 🎲: 72 verschillende gerechten, geen enkel
  bijgerecht. Kies-venster: chip Bijgerecht geeft precies de vijf; × → "ook bijgerechten & zoet" → 198 i.p.v. 193
  rijen, "naan" vindt Naanbrood. Home-plank: "Bijgerecht 5", Overig als laatste. Recepten: geen schakelchip,
  Naanbrood is gewoon te vinden.
- Kabeljauw → + bijgerecht: het venster heet "Bijgerecht bij Kabeljauw met notencrumble", Past erbij = de drie,
  Alle bijgerechten = Naanbrood en Polenta; de onderkant zit tegen de schermrand. Aardappelpuree → "↳"-rij,
  "1 gerecht · 1 bijgerecht"; opnieuw openen toont "staat erbij" (uitgegrijsd). Personen 4→6: het bijgerecht volgt;
  de lijst geeft 750 g aardappelen (500 g voor 4) met als bron Aardappelpuree. Tweede bijgerecht erbij → balk
  "Weekplan gewijzigd" → Bijwerken → de salsaregels komen erbij. Gekookt aan/uit: beide bijgerechten volgen en
  "+ bijgerecht" verdwijnt bij een gekookt slot. 🎲 op de kabeljauw: nieuw gerecht, bijgerechten weg. × op een hoofd
  met bijgerecht: beide weg.
- Deel weekplan → Kopieer: "Weekplan van Stijn: 1 gerecht"; het token heeft `of` op beide bijgerechten. Geplakt in
  In & uit: kop "1 gerecht"; na Overnemen staan in Week beide bijgerechten ingesprongen onder de kabeljauw. De live
  app (oude versie) heb ik niet geprobeerd: die stond in het browserpaneel op het welkomstformulier en daar vul ik
  niets in. De oude `parseEnvelope` las alleen `rid`/`srv`, dus een oudere app toont het bijgerecht als los gerecht.
- Engels: "+ side dish", "Side dish for Cod with nut crumble", "Goes with it", "All side dishes", "1 dish · 1 side
  dish", "sides & sweet too", de hint en de aria "Remove side dish" kloppen. Alles past op 375 px; niets ingekort.

DEVICE-TEST rijen 77 en 78 staan in beide tabellen (NL en EN), na rij 76. Eén aanvulling in rij 78 stap 6: de balk
"Weekplan gewijzigd" verschijnt alleen als er al een lijst gemaakt was; anders staat er "Nog geen lijst voor dit
weekplan." en tik je op **Maak de lijst** (zo was het in de dev-app).

**Na de review gerepareerd (fixer):** punt 1, 2 en de eerste helft van 4 hieronder, omdat §1c/§1d ze beslissen
("gekookt volgt het hoofdgerecht", "N gerechten" = hoofdgerechten, §6c punt 9 "ingesprongen"). (a) "Gekookt!" in de
kookstand en "✓ Gekookt" van vandaag op de receptpagina (`markRecipeCookedInPlan`) vinken nu ook de bijgerechten
onder dat recept af (pure kern `cookRecipeInPlanItems` in src/db/repo.ts, tests/plan-cooked.test.ts); een bijgerecht
dat je los kookt, vinkt alleen zichzelf af. (b) Vanavond op Home kijkt in plan-modus alleen naar hoofdgerechten
(`mainItems`): geen bijgerecht als "Vanavond" of via "🎲 Iets anders", "nog N te gaan" telt hoofdgerechten; de
dobbelsteenpool houdt het hele plan. (c) In & uit zet een ontvangen bijgerecht ingesprongen met "↳" en zonder eigen
"N pers." onder zijn hoofdgerecht (`sharedPlanRows` in src/domain/plan-import.ts, 5 tests; CSS in
src/styles/shopping.css bij `.inbox-plan`). Een bijgerecht waarvan de hoofd niet in het plan zit, blijft een gewone
rij.

**Open (niet door de spec beslist; vraag voor Stijn of Fable):**
1. ~~Vanavond op Home telt bijgerechten mee~~ — gerepareerd, zie hierboven.
2. ~~In & uit toont een ontvangen bijgerecht als gewone rij~~ — gerepareerd, zie hierboven.
3. Boodschappen zegt "Weekplan: 3 gerechten" bij 1 hoofd + 2 bijgerechten (telt alle items), ook in de titel van de
   gedeelde lijst. §1d: "Niets nieuws in het lijstscherm", dus zo gelaten. Keuze: (a) alleen hoofdgerechten tellen
   (`mainItems(plan.items)` in ShoppingScreen.tsx, gelijk aan Week, `#w=` en In & uit), of (b) zo laten (elk
   ongekookt item is een bron van de lijst).
4. ~~"Gekookt!" in de kookstand vinkt de bijgerechten niet mee af~~ — gerepareerd, zie hierboven. Nog open: "+ Deze
   week" op een recept dat al als bijgerecht in de week staat, voegt niets toe.
5. Toevoegen (append) in In & uit, als het hoofdrecept al in je plan staat: het bijgerecht wordt een los gerecht
   (of wordt overgeslagen als dat recept er al staat); het hangt niet onder het bestaande item. Dat volgt §3 ("het
   nieuw gemaakte item"). Toevoegen leest en bewaart het plan nu zonder transactie (`updatePlan` is privé in
   repo.ts); een gelijktijdige wijziging uit een tweede tabblad zou verloren gaan.
6. De meldingen "Weekplan overgenomen/toegevoegd: {n} gerechten" tellen nu alleen hoofdgerechten. (Al van vóór dit
   blok: bij één gerecht staat er "1 gerechten".)
7. Keuzes van bouwer B: het SideSheet heeft rechts de knop **Sluit** in plaats van "×" (README §1a wint van §1d);
   `pick.all` telt niet mee in "filters (n)" en het × wist hem ook; "+ bijgerecht" staat onder de bijgerecht-rijen;
   de hint staat er altijd; zoeken zonder treffers geeft "Niets gevonden."; Verras me ziet bijgerechten niet als
   eigen slot, en een vegetarisch bijgerecht telt mee voor "≥ 1 vegetarisch".
8. Keuzes van bouwer A: een `of` gelijk aan de eigen `rid` wordt genegeerd; een bijgerecht waarvan de hoofd niet
   meer in het plan staat, reist als los gerecht. Twee bestaande tests in tests/photo-import.test.ts zijn aangepast,
   omdat 'Dessert' nu nagerecht is (het voorbeeld "Categorie: Toetje" werd "Categorie: Tussendoortje").

## 23 okt (Opus): 6B blok 3 — keukens
**Besluit Fable (23 okt) over de restpunten:** de keuken van een klassieker gaat in de aanpassingslaag (override-patch), zoals de categorie — akkoord; rij 76 herschreven naar het Home A+-scherm — akkoord; `inbox.field.metaHint` noemt nu ook "keuken" / "cuisine"; een wijziging van alleen de keuken (of alleen categorie/labels) telt bij ontvangst niet als nieuwe versie — dat blijft zo (de vingerafdruk is bevroren, README §5 punt 8; de keuken komt mee met de eerstvolgende inhoudelijke wijziging); de fixer raakte src/domain/merge.ts en tests/merge.test.ts buiten de blokverdeling, terecht (keuken reist mee in 'meta'). Voor de eindcontrole: het doc-commentaar bij `mergeRecipeFields` belooft dat onbekende sleutels van de ander met 'meta' meekomen, de code kopieert alleen de genoemde velden. Review: 3 bevindingen bevestigd en verwerkt; gate groen (963 tests). Uitrol: direct naar `main`.
Gebouwd volgens docs/specs/labels-categorieen.md §1b, §2c, §2e en §3 blok 3 (bouwer A data + domein + tools,
bouwer B UI, integrator). Volgens §4 mag het direct naar `main`. Niet gecommit. Wat er nu staat:
- **Data:** data/cuisines.json bevat precies de 18 keukens van §2c (teken voor teken gelijk aan het specblok).
  data/review/meta.json heeft alleen het deel `cuisine`, met precies de 71 toewijzingen van §2c: italiaans 22,
  hollands 16, spaans 6, indonesisch 4, frans 3, indiaas 3, mexicaans 3, grieks 2, hongaars 2, marokkaans 2,
  chinees 2, japans 2 en portugees, brits, thais, amerikaans elk 1. Midden-Oosters en Surinaams hebben er 0. De
  bewuste nulls (Boeuf Stroganoff, de Nederlands-Italiaanse pasta's …) hebben geen keuken.
- **Migratie:** het nieuwe tools/apply-meta.ts draait in `migrate()` na `applyReview` en vóór `applyDerivedTags`,
  en ook in `apply-llm-batch --apply all`. Een onbekend id stopt de migratie. `DATA_VERSION` is 6. recipes.json
  verschilt alleen in 71 regels `"cuisine"` (direct na `category`), plus `dataVersion`/`generatedAt`.
- **Woordenboek en validator:** `Dictionary.cuisines` (op volgorde) en `dict.cuisine(id)`. `toData()` en
  `refsFromData` kennen de keukens, dus ze verdwijnen niet bij eigen ingrediënten. De validator controleert
  cuisines.json (id, nl, en, vlag, volgorde) en `cuisine` per recept (leeg, null of een bekend id).
- **Filter:** de rij **Keuken** staat tussen Dieet en de gewone chips op Home (Vanavond-filters), Recepten, beide
  Week-filters en in het Kies-venster. Je ziet alleen keukens die in de lijst voorkomen, in de volgorde van de data.
  Meerdere aan = OF, samen met de rest = EN. Het × wist ze mee. Het bewaarde filter krijgt `cuisines` alleen als
  er een aan staat.
- **Receptpagina:** naast de categorie staat "🇮🇹 Italiaans" (met een verborgen label "Keuken"). Bij een eigen of
  ontvangen recept opent een tik de editor; bij een klassieker is het gewone tekst.
- **Editor en "Controleer mijn recepten":** een rij **Keuken** met "geen" plus de 18 keukens, één tegelijk. Nog
  een keer tikken zet "geen" terug. Een keuken wordt nooit voorgesteld.
- **Importprompt:** de voorbeeldblokken hebben `Keuken: italiaans` / `Cuisine: italian`, plus de regel "alleen als
  het gerecht echt uit die keuken komt". Een geplakt AI-antwoord vult de keukenchip in, met de melding "Categorie,
  keuken en labels overgenomen uit de tekst." Plakken van websitetekst raadt geen keuken.
- **Zoeken:** een recept waarvan de keuken op de zoekterm past, komt onder **Categorie**, ook als een ingrediënt
  ook past. Zo staat Spaghetti Bolognese bij "italiaans" onder Categorie. "pasta" geeft precies dezelfde groepen
  als voor dit blok (test).
- **Delen:** `cuisine` reist mee in `#r=`, `#b=` en als patch-sleutel in `#p=` (test). De bevroren tokens zijn
  niet veranderd.

**Gedraaid:** check, test (959 in 44 bestanden), build, build:next en validate:data zijn groen (0 errors, 18
cuisines; alleen de bekende warnings). gen-golden is ongewijzigd. Geen nieuwe dependency; Dexie blijft v7.

**Dev-app (375 px, NL en EN, donker; de receptpagina ook licht), §6c 4–6 en het keukendeel van 10 nagelopen:**
- **Home:** de rij Keuken toont 16 keukens (zonder Midden-Oosters en Surinaams). Met Italiaans aan gaf
  "🎲 Nog een" zes keer achter elkaar een Italiaans gerecht. Het × wiste alles en haalde het bewaarde filter weg.
- **Recepten, filter:** Italiaans geeft "22 van 198", Italiaans + Hollands geeft 38.
- **Recepten, zoeken:** bij "italiaans" en "italian" staan 21 Italiaanse gerechten onder Categorie; het Italiaans
  gehaktbrood staat onder Op naam. Daarboven staan 33 onder "Met dit ingrediënt". Bij "hollands" en "dutch" staat
  Hutspot onder Categorie.
- **Receptpagina:** Spaghetti Bolognese toont "Pasta · 🇮🇹 Italiaans" (EN "🇮🇹 Italian") als tekst. Boeuf
  Stroganoff toont geen keuken. Hutspot toont in het lichte thema "🇳🇱 Dutch".
- **Editor:** de rij Keuken heeft 19 chips van 44 px. De prompt bij Met AI bevat `Keuken: italiaans` en de regel.
  Een geplakt antwoord zet 🇮🇹 Italiaans groen aan en toont de nieuwe melding. Hollands twee keer tikken geeft
  "geen" terug.
- **Week:** de rij staat er. Het Kies-venster toont 16 keukens; met Grieks blijven Griekse salade en Moussaka over.
- Geen consolefouten. Niets bewaard; het Home-filter en de taal van de dev-browser staan weer zoals ze waren.

**Door de integrator gerepareerd:**
- src/screens/RecipesScreen.tsx: de sprong vanaf de Home-plank (`#/recipes?cat=…`) bouwde een filter zonder
  `cuisines`. Dat was de enige fout van `npm run check`; nu staat er `cuisines: []`.
- src/components/TonightCard.tsx: "filters (n)" telde de keukenchips niet mee. Een dichtgeklapt filter met alleen
  Italiaans heette dus "filters ▾", terwijl er wel gefilterd werd. Nu telt de keuken mee.
- tools/README.md: een regel voor tools/apply-meta.ts.

DEVICE-TEST rij 76 staat in beide tabellen (NL en EN), met de feitencheck erin verwerkt:
- Op Home is er geen "Verras me". Stap 1 zegt nu: kaart **Vanavond**, zo nodig eerst **Iets buiten je week ›**,
  dan **filters ▾** (zoals rij 71). De knop is "🎲 Nog een".
- Goed 4 noemt het kopje **Categorie**, met daarboven de langere lijst onder "Met dit ingrediënt".

**Open (niet door de spec beslist; vraag voor Stijn of Fable):**
1. Een keuken die je in de editor bij een **klassieker** kiest, gaat in de override-patch, net als de categorie
   (`buildOverridePatch`, keuze van bouwer B). Zonder dat zou die keuze bij Bewaar stil verdwijnen. Die sleutel
   reist mee in `#p=`; een oudere app neemt een onbekende patch-sleutel gewoon over (`applyOverride`).
2. De synoniemen in `CUISINE_WORDS` zijn gekozen door bouwer A. Engels/English/Engeland/UK worden brits.
   "Indisch" staat er bewust niet in, omdat het Nederlands-Indonesisch betekent.
3. De Engelse importprompt noemt de keuken-ids (hollands, italiaans …), zoals hij dat ook bij categorieën en
   labels doet. De voorbeeldregel is `Cuisine: italian` (§1b).
4. `matchesCategory` kijkt ook naar de keukennaam, dus "italiaans pasta" vindt Italiaanse pasta's onder Categorie.
   "pasta" alleen is ongewijzigd.
5. Al van vóór dit blok: `apply-llm-batch --apply all` draait `applyDerivedTags` niet. Daardoor wijken de tags van
   84 recepten af van `npm run migrate`; de keukens kloppen wel.
6. De getallen in §1b/§6c/DT 76 (42 en 48 recepten in de ingrediëntgroep) zijn gemeten vóór dit blok. Nu staan er
   bij "italiaans" 32 onder het ingrediëntkopje (33 met de eigen recepten in de dev-database), omdat de Italiaanse
   gerechten naar Categorie zijn verhuisd.
7. Voor blok 4 klaargezet:
   - In tests/validate-data.test.ts schakelt het geval `category: 'bijgerecht'` vanzelf om zodra
     categories.json bijgerecht kent.
   - Het deel `category`/`goesWith` van meta.json en de bijgerecht-gevallen van tests/apply-meta.test.ts zijn
     werk van blok 4.

## 23 okt (Opus): 6B blok 2 — lactosevrij in de app
**Besluit Fable (23 okt) over de restpunten:** de tooltip `filter.dietOptieHint` wordt algemeen ("Ook recepten die dit als optie aanbieden." / "Also recipes that offer it as an option."), zonder opsomming die bij elk nieuw dieet veroudert; een vegan kopie krijgt voorlopig géén `lactosevrij`-tag (13D leidt de tags van een variant straks uit de regels af, dan komt hij vanzelf); regel H1 geldt in het formulier (Vegan ja ⇒ Lactose nee, vergrendeld) en in de validator, niet in `saveUserIngredient`; de knopvolgorde glutenvrij · vegetarisch · vegan · lactosevrij is definitief (README §2b). Review: 2 bevindingen bevestigd en verwerkt; gate groen (919 tests). Uitrol: direct naar `main`.
Gebouwd volgens docs/specs/labels-categorieen.md §1a, §2b en §3 blok 2 (bouwer A domein + data, bouwer B UI + i18n,
integrator). Volgens §4 mag het direct naar `main`. Niet gecommit. Wat er nu staat:
- **Vierde dieet:** `DIET_TAGS` = vegetarisch · vegan · glutenvrij · lactosevrij (chipvolgorde). De dieetrij toont
  vier chips plus "ook als optie" op Home (Vanavond-filters), Recepten, Kies 7 en het Week-filter, overal via
  `DietChips`. De rij schuift op 375 px opzij en de pagina zelf schuift niet.
- **Ook als optie** dekt nu ook `lactosevrij-optie` (`OPTIE_TAG`).
- **Feiten uit het woordenboek:** diet.ts kopieert de glutenregel voor lactose. `lactose: true` spreekt de tag
  tegen; een ontbrekende vlag of `lactoseUnsure` maakt hem "waarschijnlijk". De qualifier "plantaardige" zet
  `lactose: false`.
- **Varianten:** `VARIANT_DIETS` = glutenvrij · vegetarisch · vegan · lactosevrij. De knop "Maak lactosevrije
  versie" staat dus als laatste. De kritische lezer wint van §6c.2/§7.4, die hem tussen glutenvrij en vegetarisch
  zetten.
- **Swaps:** 14 zuivelswaps hebben er `lactosevrij` bij, en ghee→kokosolie, roomkaas→sojayoghurt en
  kwark→sojayoghurt zijn nieuw. Margarine→vegan-boter blijft alleen vegan.
- **Woordenboek:** de kenmerken "lactosevrij" (groen), "bevat lactose" en "misschien lactose". Het formulier van een
  eigen ingrediënt heeft een driewegkeuze **Lactose** onder Gluten.
- **Import:** `TAG_WORDS` kent lactosevrij en lactosevrij-optie, dus de importprompt noemt ze vanzelf.
- **Badge:** "Zuivelvrije ziel" (🥥, 5×) is badge 44.
- **Data:** `DATA_VERSION` 5. `npm run migrate` zette `lactosevrij` op **44** klassiekers (Ratatouille wel; Kaastaart
  en Tagliatelle Carbonara niet) en op geen enkele `lactosevrij-optie`. docs/measure-diet.md is hergenereerd:
  44 zeker ja, 146 zeker nee, 6 twijfel.

**Gedraaid:** check, test (919 in 42 bestanden), build, build:next en validate:data zijn groen (0 errors; alleen de
4 bekende tamari-warnings). Geen nieuwe dependency; Dexie blijft v7.

**Dev-app (375 px, NL en EN), §6c 1–3 nagelopen:**
- Lactosevrij aan geeft "44 van 196": Ratatouille erin, Kaastaart eruit.
- Een eigen recept met alleen `lactosevrij-optie` verschijnt pas met "ook als optie" erbij.
- Tagliatelle Carbonara heeft geen lactosevrij-chipje. De vier variantknoppen staan in de volgorde van
  `VARIANT_DIETS`.
- De sheet toont Annuleer/Bewaar bovenaan, met boter → vegan boter, slagroom → sojaroom en kaas → vegan kaas
  (EN: butter, double cream, cheese). Bewaar maakt "Tagliatelle Carbonara (lactosevrij)" / "(lactose-free)" met
  de tag.
- Woordenboek: Parmezaanse kaas "bevat lactose" / "contains lactose", margarine "misschien lactose" / "may contain
  lactose", sojamelk "lactosevrij" (groen). De driewegkeuze werkt in beide talen.
- De badge staat op de badgepagina. Geen consolefouten.

Licht thema niet apart bekeken: er is geen CSS veranderd. In de testdatabase van localhost staan nu twee eigen
testrecepten (Carbonara lactosevrij/vegetarisch) en het eigen ingrediënt "testzuivel".
DEVICE-TEST rij 75 staat in beide tabellen (NL en EN).

**Na de review gerepareerd (twee bevestigde bevindingen):**
- Regel H1 (§2a) geldt nu ook in het formulier van een eigen ingrediënt. Met "Vegan: ja" staat Lactose vast op
  "nee, lactosevrij" (uitgegrijsd) en bewaart het formulier `lactose: false` zonder unsure. Dat werkt net zo als
  het vinkje Vegetarisch, dat bij "Vegan: ja" al vaststond.
- De uitleg bij "ook als optie" (`filter.dietOptieHint`, src/i18n/phase2.ts) noemt nu ook lactosevrij-optie:
  NL "… (vega-optie, vegan-optie, glutenvrij-optie, lactosevrij-optie)." · EN "… (veggie, vegan, gluten-free or
  lactose-free option)." Dit is alleen het vierde woord in de bestaande opsomming; de spec gaf geen nieuwe tekst.

**Open (niet door de spec beslist; vraag voor Stijn of Fable):**
1. Krijgt een vegan variant ook de tag `lactosevrij`? Nu niet: `DIET_TAGS_FOR.vegan` blijft zoals §2b zegt.
   De receptpagina toont het chipje "lactosevrij" bij een eigen recept wel als de feiten het zeggen
   (`dietChipsFor`), maar de filterchip Lactosevrij vindt hem niet, want die kijkt alleen naar de bewaarde tag.
   Dat is hetzelfde gedrag als bij glutenvrij.
2. tests/fixtures/test-dictionary.ts (§6b: lactosevlaggen volgens de rule sheet) hoort in §3 bij geen enkel blok.
   Hij heeft ook geen vegan- of glutenvlaggen. Niet aangeraakt.
3. data/README.md noemt in een voorbeeld nog `dataVersion: 4`. Dat bestand hoort bij blok 3 bouwer A.
4. De `validateSwaps`-gevallen voor lactosevrij staan in tests/variants.test.ts (daar staan de bestaande ook) en
   niet in het nieuwe tests/validate-data.test.ts van §6a (blok 3).
5. H1 wordt alleen in het formulier en in de validator voor data/ingredients.json bewaakt, niet in
   `saveUserIngredient` zelf. Een eigen ingrediënt dat al `vegan: true` + `lactose: true` had, of dat via een
   ontvangen woordenboekdelta binnenkomt, blijft zo tot iemand het formulier opslaat.

## 23 okt (Opus): 6B blok 1 — lactose-datapass
**Besluit Fable (23 okt) over de randgevallen uit de review:** `oploscappuccino` → `lactose: true` (melkpoeder is een vast bestanddeel; streng, zoals chocolademelkpoeder); `koffiecreamer` en `advocaat` blijven `false` + unsure (wisselt per merk); `flesvoeding` blijft `false` (regel H2, non-food; komt in geen recept voor); `berlinerbol`, `pannenkoek`, `flensje`, `drinkontbijt` → `true` zoals de reviewer vond. Review: 5 bevindingen bevestigd, alle verwerkt; gate groen (901 tests). Uitrol: direct naar `main` (§4: blok 1 verandert niets zichtbaars).
Gebouwd volgens docs/specs/labels-categorieen.md §2a en §3 blok 1 (bouwer D1 tool + validator, tien slice-agents,
integrator). Onzichtbaar: geen UI, geen tag, geen `DATA_VERSION`-bump; recipes.json is ongewijzigd (`npm run migrate`
gaf alleen een nieuw `generatedAt`, teruggezet). Mag volgens §4 direct naar `main`. Alle **1603** entries van
data/ingredients.json hebben nu `lactose`: **186 true, 1206 false, 211 false + `lactoseUnsure`**. Per gangpad
(true/false/unsure): bakken 7/77/13 · blik-pot 5/58/14 · brood-ontbijt 16/80/26 · diepvries 7/18/23 · dranken 3/116/3 ·
drogisterij 0/70/0 · droog 1/62/4 · groente-fruit 1/194/0 · huishoudelijk 0/94/0 · kaas 43/1/0 · kruiden-specerijen
0/89/10 · overig 0/2/0 · sauzen-olie-azijn 5/38/19 · snacks-zoet 34/52/29 · vlees-vis 2/138/61 · wereld 2/94/3 ·
zuivel-eieren 60/23/6. In de 196 klassiekers komen 371 woordenboek-ids voor: 32 true, 14 unsure (kippenfond,
lamsfond, kippen-/runderbouillon(blokje), rookworst, chorizo, salami, margarine, bladerdeeg, burgerbroodje,
tortellini, visstick). Ruwe voorproef voor blok 2 (zonder qualifiers en onopgeloste regels): ±44 recepten zonder
zuivel en zonder twijfel, 6 alleen met twijfel; diet.ts in blok 2 telt het echt. Nieuw: tools/apply-flag-slices.ts
(`--check`/`--apply`), tests/apply-flag-slices.test.ts (18), tests/lactose.test.ts (89: elke entry een boolean, H1,
`lactoseUnsure` alleen naast false, en de steekproef van §2a: alle 85 ids bestaan; rood vóór de merge, groen erna),
de tien slices in data/work/lactose/ als herkomst; tools/validate-data.ts kent `lactose` in `INGREDIENT_DIET_FLAGS`
plus de lactoseregels (ook H1: `vegan: true` met `lactose: true` of `lactoseUnsure` is een error). validate:data (0
errors; de lactose-warning is weg), gen-golden (ongewijzigd), test (901), check, build en build:next groen; geen
nieuwe dependency; niet gecommit.
**Correcties door de integrator (twee):** `bavarois` (bakken, "bavarois mix") true → false + unsure (bakmix-regel en
H3: de agent zette true zonder de mix te kennen); `blinde-vink` (vlees-vis, stond niet op een twijfellijst) false →
false + unsure, net als `slavink` en "gehaktbal kant-en-klaar".
**Ter controle (keuzes van de slice-agents, zo gelaten; geen van deze ids staat in een klassieker):** (1) Twee
feitenchecks van de spec zijn niet beslist en zo ingevuld: `advocaat`, `koffiecreamer`, `oploscappuccino` →
false + unsure (H3 boven "al het andere → false"; `oploscappuccino` is met melkpoeder eigenlijk true);
`flesvoeding` → false (H2), terwijl het meestal op melkbasis is: vraag voor Stijn. (2) true zonder letterlijke regel
(zuivel als vast bestanddeel volgens de agent): carbonarasaus, aspergesoep en champignonsoep (als roomsoep),
butter-chicken-saus, chocopasta, sandwich (melkbroodje), lemon-curd, stol, suikerbrood, koffiebroodje, moorkop,
soes, tompouce, cordon-bleu, proteineshake, vanillesaus, chocolademousse, en kerstkransje/sprits/gevulde-koek
("koekjes met boter"; in de winkel vaak margarine, `zandkoekje` staat via de zanddeegregel op unsure). (3) unsure
waar true te verdedigen is: pannenkoek, flensje en american-pancake (de agent las de bakmixregel als regel voor de
pannenkoek zelf), bokkenpootje en mergpijpje (chocoladeranden), drinkontbijt. (4) false waar unsure te verdedigen
is: hamburger (als vers vlees; kipburger is unsure), aioli, halvanaise en japanse-mayonaise (zoals mayonaise).
**Verder:** de rule sheet noemt `witte-chocolade`, maar dat id bestaat niet (niets toegevoegd). De lactose-alinea in
data/README.md is Engels (de taal van dat bestand) en zegt er één zin over H1 bij (de spectekst noemt bouillonblokje
en chips als unsure, wat H1 voor deze data tegenspreekt). Al eerder zo: in data/README.md breken de dieet-alinea's
de bestandstabel (de rijen erna renderen als tekst); niet opgelost. D1's exports: `checkSlices` krijgt de slices per
bestandsnaam (anders bestaat "id in twee slices" niet), `readSlices` geeft de samengevoegde map voor `applySlices`,
`readSliceFiles` is een extra export.

## 23 okt (Opus): 13K kookbalk blok 1
Gebouwd volgens docs/specs/kookbalk.md §3/§4 blok 1 (bouwer 1 domein + store, bouwer 2 de balk, van bouwer 3
alleen app.tsx, repo.ts, CookScreen.tsx, StepView.tsx en cooklog.ts; integrator). Staat in de werkmap op `next`;
eerst op **/next/** (telefoonronde DEVICE-TEST rij 72–73 en de aangepaste rij 66), daarna `main`. Wat er nu staat:
de timerbalk is de **kookbalk** "Nu aan het koken": per recept dat je kookt één rij "Afwasmachinezalm · stap 3 van 7
›" (tik = kookstand op die stap met de porties, `cookPath`), de timers van dat recept eronder met het korte label
"stap 3", een × op de rij alleen zolang geen timer van dat recept loopt, en timers zonder sessie onder "Losse timers"
met hun volledige label. In de kookstand ontbreekt de rij van het recept zelf; zijn timers staan direct onder de kop.
Een sessie begint bij Begin/elke stapwissel in de kookstand (en een spraaktimer), een ⏱-chip in de kookstand houdt
hem levend, Koken zonder `?step=` opent direct op de onthouden stap, en hij eindigt bij Gekookt!, bij ✓ Gekookt met
vandaag, bij de × of na 8 uur zonder activiteit (nooit zolang een timer van dat recept loopt). Opslag: settings-rij
`cook.sessions` (toestel-lokaal in `DEVICE_LOCAL_SETTINGS`; Dexie blijft v7). Nieuw: src/domain/cooking.ts (puur),
src/cooking.ts (store), tests/cooking.test.ts (29 tests, alle gevallen van §6a). Zonder sessie ziet de balk eruit
als vóór 13K ("Timers", volle labels). Check, test (794), build en build:next groen; geen nieuwe dependency.
**Keuzes en afwijkingen (ter controle door Fable):** (1) src/cooking.ts importeert naast `timers`/`now`/`stopTimer`
ook `startTimerEngine` en wacht daarop vóór het eerste opschonen; anders kan een sessie met een lopende lange timer
verdwijnen voordat de opgeslagen timers geladen zijn (importrichting blijft cooking → timers). (2) De kop "Losse
timers" staat er alleen als er ook een sessie is; zonder sessie is het "Timers" zonder tussenkop (§4: "zonder sessie
gedraagt de balk zich precies als vandaag"). (3) Kleine bouwkeuzes: `endCooking` wacht ook op `loadCooking`;
`sessionFor` leest de levende sessies; een verlopen sessie opnieuw aanraken begint een nieuwe; een harde spatie vóór
" · "; één extra CSS-regel `.timerbar-recipe-btn .timerbar-chev { margin-left: auto }` zodat het › rechts staat; het
korte timerlabel houdt als aria-label het volle "Afwasmachinezalm · stap 3 — naar deze stap". (4) **Rij 66** is
aangepast met de teksten van de kritische lezer, maar "Tik onderaan op **Home**." staat nu aan het eind van stap 3 in
plaats van aan het begin van stap 4: in de kookstand toont de balk de rij van het recept zelf niet (§1b), dus "goed 3"
("met de rij Afwasmachinezalm · stap 3 van 7") klopt pas op Home. Zelfde in het Engels.
**Dev-app (375 en 360 px, NL en EN, donker en licht):** §6b check 1–5 en 8 nagelopen (check 6 en Boodschappen zijn
blok 2, check 7 vervalt), plus ✓ Gekookt met Vandaag (sessie én timer weg), een losse timer onder "Losse timers"
naast een sessie, en F5 rechtstreeks op de kookstand (opent op stap 3). Op 360 px: timerrij zonder overloop (label 56
px, "step 3" 39 px), een lange naam wordt afgekapt en "· stap 3 van 7" blijft heel. Print: alleen in de CSS
nagekeken (`html[data-print] .timerbar` in print.css); een printvoorbeeld kan het browserpaneel niet. De
testdatabase van het browserpaneel heeft twee kookbeurten erbij (Afwasmachinezalm, Spaghetti Bolognese), geen
sessies en geen timers.
**Tip voor de telefoonronde:** rij 72 begint met Koken → **Begin**. Staat er van rij 66 nog een zalm-rij in de balk,
dan opent Koken meteen op die stap (zo hoort het) en is er geen Begin; ga dan met ‹ Vorige naar stap 3.
**Blok 2 (gebouwd 23 okt):** een ⏱-chip op de receptpagina begint de sessie op die stap of zet een sessie op een
lagere stap omhoog; staat de sessie al op dezelfde of een hogere stap, dan schuift alleen `lastActiveAt` (een timer
bij stap 3 zet stap 4 nooit terug). De kookbalk staat ook op Boodschappen, direct onder de kop (ook in de
`?proto=1`-stap). Een eigen recept verwijderen (receptpagina, editor, selectie in Recepten) beëindigt meteen zijn
sessie met zijn timers (`endCooking`); na een geslaagd herstel in Opslag worden de sessies opnieuw gelezen
(`reloadCooking`). DEVICE-TEST rij 74 (NL en EN) staat erin. Check, test (794), build en build:next groen; geen
nieuwe dependency. Bouwkeuze: de receptpagina wacht op `loadCooking()` vóór hij de stap vergelijkt (anders zou hij
bij een koude start een lege lijst zien en een sessie op stap 5 naar stap 2 zetten). Dev-app (375 px, NL): ⏱ 15 min
bij stap 4 → "Afwasmachinezalm · stap 4 van 7" met de timer eronder; daarna ⏱ 5 min bij stap 3 laat stap 4 staan,
en omgekeerd gaat stap 3 naar 4; de balk staat op Boodschappen en niet op Meer; alle drie de verwijderplekken laten
geen rij en geen timer achter. Opgemerkt (niet opgelost, buiten blok 2): met twee recepten en drie timers is de balk
±280 px hoog; in de selectiestand van Recepten valt de knop "Ja, verwijder" dan onder de onderbalk. Uitrol: blok 2
bouwt op blok 1, dat nog op `next` wacht op de telefoonronde (rij 72–73); de spec staat voor blok 2 zelf direct
`main` toe. **Open vragen voor Stijn** (spec §8, standaard zoals gebouwd): Gekookt stopt ook de lopende timers van
dat recept; 8 uur als vervaltijd.
**Besluit Fable (23 okt), alle keuzes van bouwers en integrator geaccepteerd:** rij 66 met "Tik onderaan op Home"
aan het eind van stap 3 (in de kookstand verbergt de balk de eigen rij, dus de controle hoort op Home);
`src/cooking.ts` wacht op `startTimerEngine()` vóór het opruimen (anders verdwijnt een sessie met een lange
timer vóór de timers geladen zijn; richting cooking → timers blijft); het kopje "Losse timers" alleen als er een
sessie is; `touchCooking(…, servings: null)` behoudt de bewaarde porties (de koude start via een melding gaf
anders null); `endCooking` wacht ook op `loadCooking`. Review: 1 bevinding bevestigd en gerepareerd; gate groen
(794 tests). Uitrol: `next` 23 okt; na de telefoonronde met rij 72–73 volgt `main`.

## 23 okt (Opus): Home A+ blok 2
Gebouwd volgens docs/specs/home-a-plus.md §3 blok 2 (bouwers A en B + integrator). **Live op `main` sinds
23 okt** (eerst op `next`; telefoonronde rij 70 en 71 door Stijn: "alles lukt"). Wat er nu
staat: Home heeft op plek 2 de kaart **VANAVOND**
(src/components/TonightCard.tsx) met drie standen uit het pure `tonightMode` (src/domain/tonight.ts): laden;
**plan** (het eerste niet-gekookte gerecht van de week, metaregel "45 min · Vlees · nog 3 te gaan" / "de laatste
van je week", **🎲 Iets anders** bladert rond door de week en is grijs bij één, voetregel **Iets buiten je week ›**);
**free** (de oude Verras me: dobbelsteen met **🎲 Nog een**, voetregel **filters ▾** / **filters (n) ▾** met de
chips eronder, open/dicht onthouden in `recepten.tonightFiltersOpen`, en **Terug naar je week ›** zolang de week
nog iets open heeft). De chips blijven onder `recepten.surpriseFilters`. Op plek 3 de regel **Verder met: … ›**
(alleen vandaag bekeken, niet vandaag gekookt, niet het gerecht van de kaart; `noteViewed` schrijft nu ook
`recepten.recent.last`). Op plek 4 de compacte **Deze week** (src/components/WeekCard.tsx: "n van 7 gekookt", één
regel met max 3 namen + "+N", niet-gekookt eerst, gekookt doorgestreept achteraan; lege kaart ongewijzigd).
HomeScreen bevat geen dobbelsteen-logica meer. tests/tonight.test.ts dekt alle gevallen van §6a (43 nieuwe tests,
ook in andere tijdzones groen). **Afwijking van de letter van §3:** `LastViewed` staat in src/domain/tonight.ts en
src/recent.ts geeft hem door als type (zo importeert src/domain niets uit de app-laag, de ⚠ van de feitencheck).
**Keuze van de integrator** (vervangen door besluit 2 hieronder): de regel Verder met verscheen pas als de kaart
haar gerecht had gemeld (of 250 ms na het laden als de kaart niets toonde); anders flitste in de dev-app één beeld
lang "Verder met: <het kaartgerecht>" bij terugkomen op Home. Ongebruikte keys weggehaald na Grep:
`home.surprise` (browse.ts) en `home.weekOpen` (week.ts); dode CSS van de oude kaart weg (`.surprise` in browse.css, `.surprise .filter-chips` en
`.surprise .diet-chips` in home.css; `.surprise-name/-alt/-actions` blijven, de kaart gebruikt ze). DEVICE-TEST rij
71 toegevoegd, NL en EN, letterlijk uit de spec, op één plek na (review-ronde): stap 4 verwacht **filters (1) ▾**
in plaats van **filters ▾**, want Vegetarisch uit stap 2 staat dan nog aan (§1g; stap 2 van de rij zegt zelf al
"filters (1) ▾"). Check, test (765), build en build:next groen; geen nieuwe
dependency; Dexie blijft v7. In de dev-app (375 en 360 px, NL en EN) §6b checks 8–13 nagelopen; de testdatabase
van het browserpaneel heeft nu profiel "Stijn", een week van 7 (5 gekookt) en één kookbeurt Afwasmachinezalm.
**Besluit Fable (23 okt):** **1.** "Iets buiten je week" betekent echt buiten de week: in de free-stand rolt
de dobbelsteen over `outsideWeekIds(...)` (de chip-pool zonder de gerechten van het weekplan, de hele pool als dat
niets overlaat) en een onthouden worp buiten die pool wordt losgelaten, ook een van vóór Kies 7; rij 71 stap 4 blijft
zoals hij staat. **2.** `onShown` meldt via `useLayoutEffect` (vóór het tekenen), zodat Verder met nooit, ook niet één
beeld, het kaartgerecht herhaalt; het 250 ms-gordijn is weg, de regel wacht alleen op de eerste melding van de kaart
(null telt mee). In de dev-app nagelopen met een frame-monitor (🎲 Iets anders, Nog een, Iets buiten je week, Terug
naar je week, een plan-wijziging): nul foute beelden, met `useEffect` als tegenproef één. **3.** De "+N" van de
weekregel staat in een eigen span met `flex: none` en wordt nooit afgekapt; alleen de namen krimpen met een ellipsis
(360 en 375 px: "Spaanse groenten · Roergebakken… · +4").
**Twee restpunten, door Fable geaccepteerd (23 okt):** (1) Op 360 px breekt "🎲 Iets anders" / "🎲
Something else" over twee regels binnen de knop (48 px hoog, niets valt weg); de tekst blijft, want een korter
woord zegt minder. (2) "n van 7 gekookt" telt ook slots waarvan het recept weg is; de namenregel slaat die over.
Dat volgt de spec-signatuur en is zeldzaam (alleen na het verwijderen van een eigen recept uit een lopende week).
Kleine keuzes van bouwer B: kopregel VANAVOND 13 px (niet 12, §5b), Verder met in cobalt, een tijd van 0 minuten
valt weg uit de metaregel.
**Uitrol:** `next` 23 okt, `main` 23 okt na de telefoonronde. Home A+ is daarmee af; volgende blok: 13K kookbalk.

## 23 okt (Opus): Home A+ blok 1
Gebouwd volgens docs/specs/home-a-plus.md §3 blok 1 (bouwers A en B + integrator). **Live op `main` sinds
23 okt** (eerst op `next`, door Stijn gecheckt). Wat er nu staat: Home heeft in de kop een **+** met het nieuwe
`AddMenu` (src/components/AddMenu.tsx, ook op Recepten; volgorde Plak · Zelf · AI · Bestand; via SheetPortal;
sluit met ×, ernaast tikken, Escape of wegvegen; de veegcode is die van CookedSheet). De begroeting heeft het
avatar-rondje en daaronder het slot `HomeLevelRow` (tot 6D "🏆 Badges x/y ›", null bij badges uit/geen
profiel). De herinneringskaarten "nog niet gedeeld" en "In & uit" zijn de rij **📥 In & uit** ("1 ontvangen · 2
te delen" / "niets nieuws", cobalt bij ontvangen); de sectie Eigen & ontvangen is de rij **📒 Mijn recepten N**
(→ `#/recipes?sort=ownReceived`; RecipesScreen leest `?sort=`, onthoudt de keuze en haalt de query uit de hash);
de badges-kaart en de verhaal-kaart zijn weg (Het verhaal is nu een rij). Laatst gekookt toont 3 rijen,
Categorieën is één rij tegels van 148 px. Verras me en de oude weekkaart staan nog op plek 2 en 4 (blok 2
vervangt ze). Ongebruikte keys weggehaald na Grep: `home.ownReceived`, `noOwn`, `addFirst`, `allRecipes`,
`story`, `storyHint`, `badgesHint`, `teaser` (browse.ts), `home.inboxUnseen`, `inboxUnseenOne`, `inboxAction`
(week.ts) en `home.surpriseFilters` (phase2.ts); `home.weekOpen` (ook ongebruikt) blijft voor blok 2 volgens
§2c. DEVICE-TEST rij 58 (nieuwe volgorde) aangepast en rij 70 toegevoegd, NL en EN; na de review ook rij 15 (op Home
verdwijnt nu "n te delen" uit de rij In & uit, niet meer een kaart) en rij 44 (Home toont de regel "🏆 Badges
N/M ›" onder de begroeting, niet meer een kaart) bijgewerkt, NL en EN. Check, test (722),
build en build:next groen; geen nieuwe dependency; Dexie blijft v7. In de dev-app (375 en 360 px, NL en EN)
§6b checks 1–5 en 7 nagelopen; check 6 alleen in de code (de testdatabase heeft geen kookbeurten). In de
dev-database staat nu een ontvangen testrecept "Testsoep van Gabi" (`u:hometst1`) van check 4.
Twee kleine keuzes van bouwer A, buiten de letterlijke spec-code: een ongeldige `?sort=foo` verandert niets
maar verdwijnt wel uit de hash (§7 punt 3 "blijft niet hangen"), en een sorteerwissel vergeet ook de bewaarde
scrollpositie (anders zou de nieuwe volgorde na laden naar de oude plek springen; "scrolt naar boven").
**Besluit Fable (23 okt):** via de rij Mijn recepten wordt een oude zoekterm uit Recepten gewist
(`setQuery('')` in het `?sort=`-effect); de rij belooft "alleen je eigen en ontvangen recepten" (rij 70
stap 4). Een tik op de sorteerpil zelf laat de zoekterm staan, zoals voorheen. Review (2 lenzen + verifier):
4 bevindingen bevestigd, alle verwerkt. Haiku-gate groen.
**Uitrol:** blok 1 staat op de nieuwe branch `next` → https://srutgers96-star.github.io/recepten/next/ (eigen
database, eigen icoon). `main` is ongewijzigd tot de telefoonronde met rij 70 (beide telefoons) goed is;
daarna `next` in `main` mergen. Dan blok 2 (Vanavond-kaart en compacte week).

## 22–23 okt (Fable): de spec-ronde is af — Opus kan bouwen
**docs/specs/README.md is nu het startpunt voor elk bouwblok** (bouwvolgorde, register van velden/keys,
werkwijze + Workflow-sjabloon voor Opus, "Opus mag niet zelf beslissen", master-controlelijst voor Fable,
vragen aan Stijn). Negen specs, samen ±9.200 regels, elk met status "compleet (Fable, 22 okt 2026)" plus een
feitencheck (Opus, tegen de code van 22 okt) en een blok "Kritische lezer (Fable)" met de besluiten over
specs heen: home-a-plus · kookbalk (13K) · labels-categorieen (6B+13E) · bijgerechten (20 recepten) ·
inbouwen (13F, Dexie v8 = de enige nieuwe versie) · varianten-tabs (13D) · vaste-lijst (6C) · xp-levels (6D)
· badges-avatar (6D-2/6D-3). Bouwvolgorde: Home A+ → 13K → 6B+13E → bijgerechten → 13F → 13D → 6C → 6D-1 →
6D-2 → 6D-3 → 6D-4 → 13J (zonder spec) → Z → Fable-eindcontrole. DEVICE-TEST-rijen 70–101 zijn in de specs
al genummerd. De twee blokkerende vragen (README §6) zijn op 23 okt beantwoord: catalogus en avatar-bibliotheek
goedgekeurd; voornamen in de credits mogen genoemd worden; de rest standaard. **Niets blokkeert meer.**
De run kostte twee pogingen (sessielimiet na de schrijvers; hervat met resumeFromRunId, schrijvers uit cache).

## Online (https://srutgers96-star.github.io/recepten/)
**Fase 5 compleet** (fase 0–4 + blok A t/m F, 8 oktober 2026) **+ fase 6 blok 6A** (6A-1 9 okt, 6A-2 15 okt)
**+ ronde 13 okt deel 1** (15 okt). Repo: https://github.com/srutgers96-star/recepten.

## Branches
`main` = https://srutgers96-star.github.io/recepten/ (beide telefoons). `next` = …/recepten/next/ (testkanaal,
eigen database en icoon). Werkwijze per blok: bouwen op `next` → `next` in `main` mergen (fast-forward), zodat
beide branches daarna gelijk staan. **Besluit Stijn (23 okt): geen telefoonronde meer vóór `main`** ("hoeft
allemaal niet getest voor live nu, lekker door"); een blok gaat na de groene gate meteen live. De DEVICE-TEST-
rijen blijven voor later. Uitzonderingen volgens README §1: 13F (id-migratie) en 13D (deelformaat) krijgen vóór
`main` een korte Fable-blik. 23 okt: Home A+ blok 1–2 en 13K blok 1–2 zo naar `main` gegaan.
Eenmalig geregeld (23 okt): de GitHub Pages-omgeving `github-pages` stond alleen `main` toe als uitrolbranch;
`next` is toegevoegd (Settings → Environments → github-pages → Deployment branches). Zonder die regel faalt
de deploy-job van een push naar `next` met een environment-protection-fout.

## 16 okt (Opus 5.5): bugfixes van Gabi; de spec-ronde van Fable is NIET gelukt
- De spec-ronde (workflow wf_09446677-12f) stuitte twee keer op de Fable-limiet: geen enkele spec af.
  Alleen docs/specs/vaste-lijst.md (38 KB) staat er van de eerste poging, **niet nagekeken en mogelijk
  onvolledig**; niet gecommit. Bij de volgende Fable-sessie de spec-ronde hervatten
  (resumeFromRunId wf_09446677-12f) of opnieuw starten.
- **Gekookt-venster (bug Gabi):** Bewaar staat nu ook bovenaan (naast Annuleer). Besluit Stijn 16 okt: **alleen Bewaar bewaart**; wegvegen (greepbalkje), ernaast tikken, Annuleer en Escape sluiten zonder te bewaren (eerdere variant "wegvegen bewaart" teruggedraaid). Confetti bij sterren pas ná het bewaren (ook in de
  kookstand). Op de pc getest; op Gabi's iPhone nog te bevestigen (DEVICE-TEST rij 65).
- **Zoeken:** spellingvarianten van gerechtnamen (goulash = gulyás = gulasch, shoarma = shawarma,
  saté = satay …) in src/domain/search.ts + tests/search.test.ts. "Dino's Gulyás" verschijnt nu bij
  "goulash". (Hij staat niet in In & uit omdat Stijn hem zelf opsloeg, niet ontving.)
- **Kookstand (wensen Stijn):** (1) **vegen** tussen stappen werkte niet op een echte telefoon: het
  scrollende kaartje liet de browser horizontale vegen overnemen; nu `touch-action: pan-y` op `.cook-card`.
  (2) **Tik op een timer** in de timerbalk (of op de melding) → de kookstand van dat recept, op de stap
  van die timer (`timerPath`/`openTimerPath` in src/timers.ts, `?step=N` in CookScreen). (3) **🔊 is een
  schakelaar**: aan = deze en elke volgende/vorige stap voorlezen, uit = stil blijven; het is de instelling
  Meer → Voorlezen zelf, dus die blijft ook bij de volgende keer koken staan. Op de pc getest (375 px);
  op de telefoon DEVICE-TEST rij 66. De grotere wens, een **"Nu aan het koken"-balk** (ook zonder timer,
  meerdere recepten tegelijk), staat als 13K in docs/phase-6-spec.md voor Fable.
- **13I gebouwd (Opus, workflow: domein → UI+spraak → 3 reviewers → verifier → fixer → gate; 8 van 10
  bevindingen bevestigd en gerepareerd):** src/domain/stepingredients.ts herkent de ingrediënten van het
  recept in de staptekst (hele woorden, langste eerst, precisie boven volledigheid; 89% van de stappen
  heeft minstens één groen woord). Groen + onderstreept = tikbaar: de geschaalde hoeveelheid verschijnt
  erachter. Groen zonder streep = de hoeveelheid staat al in de tekst of de regel heeft er geen.
  "⚖️ Toon hoeveelheden" in de kookstand (instelling cook.showAmounts, src/step-amounts.ts); de
  receptpagina markeert ook. Spraak (Android): "hoeveel?" / "how much?" leest de hoeveelheden van de
  stap voor; tijdvragen ("hoeveel tijd nog") blijven timeLeft, praatzinnen ("hoeveel mensen eten er
  mee") doen niets. Bekend en geaccepteerd: "selderij" in een kipkarbonades-stap en "the onion and pepper
  mixture" tonen de volle hoeveelheid. DEVICE-TEST rij 68. 703 tests.
- **Foto bij ✓ Gekookt (wens Gabi):** 📷 Foto toevoegen in het Gekookt-venster (zonder `capture`, dus
  ook uit de fotobibliotheek). De foto wacht in het venster tot Bewaar, en krijgt de datum van de
  kookbeurt; wegvegen bewaart niets. DEVICE-TEST rij 67.
- **Boodschappen zelf typen (bug Stijn, 17 okt):** "200 gram boter" kwam als "gram boter" onder Overig:
  het vak las alleen een los getal. Nieuw: src/domain/shopinput.ts (`parseShopInput`, `splitShopList`)
  leest getal + eenheid + naam (parseQty van de parser; eenheden alleen in de typtaal; "ons"/"pond" als
  gram; "3 x 200 gram"; Engels "2 cans of chickpeas"; "een paar bananen" blijft tekst; "2 blik tomaten",
  "pak choi", "hand cream" houden hun eigen naam); "1,5 liter melk" blijft één regel. Engelse weergave van
  "2 dl" werd "2 ml": amountText rekent nu om. Nieuw ingrediënt "bloemen" (bos bloemen ≠ bloem).
  Review-workflow (2 reviewers + verifier): 15 van 20 bevindingen bevestigd en gerepareerd. Nog niet:
  verpakkingswoorden zonder eenheid in units.json (doos, tube, net, krat) — die gaan als tekst naar de
  afdeling van het product. DEVICE-TEST rij 69.
- **Vraag Gabi over de glutenvrij-badge:** geen bug. De badge telt kookbeurten van glutenvrije
  recepten (5 nodig), niet het maken van een versie; in de browser nagespeeld: versie maken 0/5,
  één keer gekookt 1/5.

## PAUZE (15 okt, avond) — volgende stap: de spec-ronde door Fable (zie "Werkwijze vanaf 15 okt")
Ronde 13 okt deel 1 staat online. Stijn koos Home-variant **A+** (docs/home-voorstel.md). Op zijn "door"
schrijft Fable eerst de bouwspecs in docs/specs/ voor: Home A+, 6B + 13E, 13F, 13D, 6C, 6D; daarna bouwt
Opus 5.5 ze blok voor blok. Niets in de werkmap; `main` is schoon.

## Afgerond 15 okt (avond): ronde 13 okt deel 1 (vier bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 8 bevindingen gerepareerd)
- **In & uit** (voorheen Inbox, route /inbox): Dexie v7 met tabel `events` (ShareEvent: in/uit, wat, aan/van
  wie, aantal, recept-ids); 'in' bij elke import en bij een kaartje, 'uit' bij elke geslaagde recept-/
  kaartje-/bundel-share (niet bij lijst/weekplan/back-up); tabs **Ontvangen** (met datum en van wie) en
  **Gedeeld** (datum, aan wie, wat; tik → recept(en)); plakvak bovenaan; events mee in de back-up (dedupe).
- **Sorteren** in Recepten: A–Z · Recent bekeken (src/recent.ts, localStorage) · Eigen · Eigen & ontvangen
  (onthouden); zoeken en chips werken in elke stand, letterrail alleen bij A–Z.
- **Browser-melding** (src/components/BrowserNotice.tsx, alleen op een telefoon in een browsertab): per
  platform eerlijke installatie-uitleg; Android buiten Chrome: "Je zit nu in Opera …" + **Open in Chrome**
  (intent-link met fallback "Kopieer de link") — die waarschuwing wordt niet weggesnoozed; in Chrome:
  "wat je hier bewaart komt ook in de app". Meer → Hulp & over → **Links openen in de app** (stappen per
  platform). Landingspagina (iPhone): 1 Kopieer · 2 Open de app → Meer → In & uit · 3 Plak van klembord.
  **Nog te bevestigen op een echte Android-telefoon**: of de intent-link met een #r=-fragment echt Chrome
  opent (DEVICE-TEST rij 62).
- **Opslag**: twee kaarten "Back-up voor mezelf" en "Mijn recepten aan iemand geven", elk met "Bewaar of
  deel" → Delen / Download met één zin uitleg; Herstel met uitleg; eerlijke teksten per telefoon.
- **Curator-pagina verwijderd** (CuratorScreen.tsx, route, Meer-rij, tests, 33 i18n-keys, CSS; CLAUDE.md
  mappenlijst bijgewerkt; DEVICE-TEST rij 48 vervallen). Engels van een klassieker verbeteren = editor.
- docs/home-voorstel.md (twee varianten; Stijn koos A+). DEVICE-TEST rijen 61–63. 659 tests.

## Afgerond 15 okt: blok 6A-2 + 13A(1) + 13C (drie bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 14 bevindingen gerepareerd)
docs/phase-6-spec.md 6A punten 9, 10, 13, 14, 16, 17 + ronde 13 okt 13A (deel 1) en 13C. Kern:
- **Plak-domein**: src/domain/paste-recipe.ts (websiterecept → naam/porties/tijd/regels/stappen/taal/
  confidence/leftovers; 17 fixtures in tests/fixtures/paste, 9 NL + 8 EN, bereiding ingekort), src/domain/
  paste-classify.ts (classifyPaste: empty → tokens → member → bundle → ai → website → unknown), photo-import.ts
  normalizePastedAnswer (markdown-escapes, code-fences, markers midden in een regel, in elkaar geschoven
  ingrediëntregels; Stijns uiensoep-voorbeeld → 13 regels) en de prompt in één codeblok ("tik op Kopieer
  code"); parser.ts: "naar smaak/naar wens/to taste" overal in de regel, "zout peper" → zout-en-peper,
  vage hoeveelheid in haken ("[een snufje]") = notitie. Golden byte-identiek.
- **Universeel plakvak**: src/components/UniversalPaste.tsx + src/paste.ts (classificatie → actie), in
  Toevoegen (defaultAction 'recipe'), Inbox ('import') en Huishouden ('member'); oude losse plakvakken weg.
  "+"-menu: Zelf schrijven · Plak een recept (/add?mode=paste) · Met AI (/add?mode=ai) · Kies een bestand.
  Editor: websiteroute met "Controleer"-kader (→ ingrediënt / → stap / weg), feedbackregel, labels/categorie
  uit een AI-antwoord gevuld (metaManual).
- **WordPicker** (src/components/WordPicker.tsx, src/domain/line-words.ts): woorden van een ?-chip aan/uit
  (groen = ingrediënt, grijs = opmerking), "Koppel zo" via de bestaande override-API (raw blijft),
  Link-vraag "variant van X of nieuw ingrediënt?" in IngredientPicker.
- DEVICE-TEST rijen 58–60. 646 tests.
**Daarna gebouwd:** ronde 13 okt deel 1 (zie boven). **Resterende volgorde:** specs door Fable → Home A+
→ 6B + 13E (labels, lactosevrij, keukens, nagerecht/gebak/bijgerecht/ontbijt & lunch, 20 bijgerechten) →
13F (inbouwen met id-migratie) → 13D (varianten als tabs) → 6C → 6D → Z → Fable-eindcontrole.

## Afgerond 9 okt: blok 6A-1 (vier bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 10 bevindingen gerepareerd)
docs/phase-6-spec.md 6A punten 2–8, 12, 15, 18. Kern: src/cooklog.ts `recordCooked` (zelfde stappen als de
kookstand: milestones, weekplan-vinkje alleen bij "vandaag", badges) + CookedSheet ("✓ Gekookt" op het recept:
vandaag/gisteren/datum, sterren, notitie; "Beoordeel" voor een kookbeurt zonder sterren, ook op Home met
`?rate=<entry-id>`); MoreScreen in vier inklapbare groepen + losse rij Opslag (stand in localStorage
`recepten.more.groups`), Feedback voor Stijn (shareText met versie/kanaal/build/toestel, geen nummers in
code), ☕ Steun dit project → https://bunq.me/StijnRutgers (Meer én Het verhaal), "Deel je nieuwe recepten"
met voorbeeldkader, installeerkaart (Android "Installeer de app"; iPhone inklapbaar, "± 2 MB");
spraak: repeat/ingredients/timeLeft (+ guards tegen keukengepraat) en ?-knop met VoiceHelp; 14
profielkleuren (contrast ≥ 4,5:1); voorraadkast-vinkje in gewone taal + eigen ingrediënt achteraf
bewerken (vlaggen, eenheid); curator toont de effectieve EN-weergave, "Verbeter in het woordenboek" alleen
bij eigen ingrediënten (ingebouwd = via Feedback); CheckRecipes "Categorie: …" / "Labels: …".
DEVICE-TEST rijen 54–57 + oudere rijen die naar de oude Meer-indeling wezen bijgewerkt. 539 tests.

## Afgerond 8 okt: blok F (drie bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 10 bevindingen gerepareerd)
- **Ledenkaartje `#f=`** (ADR-0004, alinea 8 okt): envelop `{ v: 2, t: 'f', f: { id, name, color, lang, deviceId? } }`,
  bevroren tokens in tests/fixtures; token.ts/router.ts/boot.ts/landing.ts kennen `f`. Meer → Huishouden:
  "Mijn kaartje" (Deel mijn kaartje = één `{text}`, Kopieer link, Toon QR alleen achter Experimenten) en
  "Voeg lid toe via link of plak"; de Inbox toont een `#f=` als kaart "Voeg <naam> toe aan je huishouden"
  (Android via de link, iPhone via plakken); "Stuur nieuwe naar …" toont huishoudleden als eerste keuze.
  Setting `device.id` = stabiel telefoon-id (ProfilesScreen `ensureDeviceId`). Eerlijke grens: een app van
  vóór blok F zegt bij een `#f=` "geen leesbaar recept" (v blijft 2), niet "update de app" — beide telefoons
  eerst bijwerken.
- **Receptvarianten**: data/swaps.json (77 swaps, `npm run validate:data` controleert ids en dieetvlaggen),
  src/domain/variants.ts (planVariant/makeVariant), `Recipe.variantOf`, repo.variantsOf, VariantSheet;
  het recept toont "Maak glutenvrije/vegetarische/vegan versie", "Ook als: …" en "Versie van …".
- Reviewfixes: variant zet metaManual (anders haalt "Controleer mijn recepten" het dieetlabel weer weg);
  geteld product → gewichtsproduct via gramsPer ("4 kipfilets" → "800 g tofu"); eenheidswoord-aliassen
  slokken de eenheid niet meer op; kooknotitie van een swap komt op de regel; kaartje van een nieuwe
  telefoon vervangt het oude lid (zelfde naam) i.p.v. een verborgen dubbel; "sinds"-historie in
  "Stuur nieuwe naar …" gevouwen vergeleken; afzender wordt alleen op naam herkend (eerlijk in code).
- Groen op 8 okt: check, test (521), build, build:next, validate:data. DEVICE-TEST rijen 52 en 53.
  CLAUDE.md invariant 7 en de "Also:"-regel noemen `#f=` nu ook.

## Afgerond (ter info)
Blok E (gebouwd met Opus 5.5, zie PAUZE hieronder): data/ingredients.json 378 → 1601 producten
(10 thematische slices in data/work/block-e/, samengevoegd door data/work/block-e/merge.mjs met dedupe;
beslissingen staan in dat script), parser-dekking blijft 1883/1883, 2 regels beter (vegagehakt);
Woordenboek-scherm met gangpadfilter, entry-weergave met vlaggen, "+ Nieuw ingrediënt", "Toon meer".
Kleine wensen 3 okt: "Alles klaar ✓" op Klaarzetten; spraakcommando's uit op iPhone (canListen()).
DEVICE-TEST rij 50 (woordenboek) en 51 (zekerheidscheck Opus-werk), in gewone taal.

Blok D: Dexie v6 photos-tabel + src/photo.ts (canvas ≤1024px WebP/JPEG, EXIF-rotatie), foto-hero +
galerij + overlay op het recept, "Foto toevoegen" bij Gekookt!, back-up "Met foto's" (default uit),
fotobadges live; src/print.ts + print.css (recept 1×A4 / ingrediënten / lijst met gangpad-kolommen+☐)
+ "Kopieer als tekst" (domain/recipe-text.ts, iOS-hint i.p.v. dode printknop); StoryScreen met
huishoudleden; CuratorScreen /more/curator (status machine/gecontroleerd/ontbreekt, EN-only patches
via saveOverride + text{en:'human',reviewedBy}, "Stuur correcties" via bestaande patch-envelopes);
Experimenten-switch; QR op het recept-deelscherm (qrcode-dependency, ADR-0007, lazy chunk);
DEVICE-TEST rijen 46–49. Eerder: blok C badges (commit e7298d8), blok B kookstand+ (4e4519e).

## Fable-review van het Opus-werk — afgerond 8 okt 2026 (ter info)
Blok E en de extra's van 3 okt waren met Opus 5.5 gebouwd zonder reviewronde. Fable heeft ze
nagelopen (workflow wf_7b8c69c0-cb4: 5 reviewers → skeptici → data-fixer + code-fixer → Haiku-gate):
- Data: taal en vlaggen bleken netjes (alle 1223 entries gelezen); 15 geverifieerde correcties
  (o.a. "coffee pad", "cold cuts", 3 vega-vervangers vegan→false, maïs-trema's, perishable/staple);
  nieuw: sultana, platte-perzik (geen "flat-leaf peach" meer); aliassen koosjer zout→zout,
  elstar/jonagold/granny smith/pink lady→appel, philadelphia→roomkaas, mie→noedels (niet eiermie:
  supermarkt-mie bevat geen ei), botrytis-/sémillonwijn→dessertwijn. **DATA_VERSION 3 → 4** (via
  tools/migrate-from-recepten2.ts + npm run migrate); golden hergenereerd (7 regels, allemaal beter).
  Bump in de browser getest: profiel, kooklog, favorieten en instellingen blijven staan, alleen de
  klassiekers worden ververst.
- Code: **vertaal-plakbug (6A.1) gefixt** — parseTranslationAnswer kent nu taalblokken ("=== NL ===",
  "English:", "Original/Translation" …) en krijgt de doeltaal mee; 10 nieuwe tests. Oorzaak was niet
  de UI-taal maar de blokvolgorde in het AI-antwoord ("eerste blok wint"). Al vastgelopen recepten
  herstellen zichzelf niet: in de editor (stand "beide") het verkeerde EN-vak leegmaken en opnieuw
  plakken. IngredientPicker krijgt de taal van de regel mee (6A.14-deel); detail-aliassen niet meer
  dubbel; diet.ts: qualifier "plantaardige" = veg+vegan, "vegetarische" = veg (vegan onzeker);
  "N overgeslagen (stond er al)" in de vertaalstatus.
- **Landingsbundel (iPhone-deelpagina):** woordenboek wordt lazy geladen ná de eerste weergave;
  share-chunk 572 → 57 kB (gzip 107 → 20 kB), landing 12,6 kB; woordenboek apart in data-*.js.
- DEVICE-TEST rij 42 en PLAN.md §0 "Spraak": iPhone-spraak staat bewust uit.
- Let op voor smoke-tests: de dev-database (localhost) is tijdens de review door een testagent
  gereset; er staat nu een profiel "Test" met één kookbeurt in.

## Daarna, blok voor blok, elk apart online — volgorde (bijgewerkt 8 okt 2026)
1. ~~Fable-review van het Opus-werk~~ (afgerond 8 okt)
2. ~~F vrienden via link/QR + varianten~~ (online 8 okt; telefoontest DEVICE-TEST 52–53 volgt later)
3. **Fase 6 — Stijns wensenlijst van 6 okt**, uitgewerkt in **docs/phase-6-spec.md**:
   6A snelle verbeteringen en bugs — **6A-1 online 9 okt; 6A-2 (plakken/prompt) volgt** (import-bug naam NL/EN, curator-ingrediënten, "Gekookt" zonder
   kookstand + later beoordelen, installeerkaart, "Stuur nieuwe naar" duidelijker, Meer opgeruimd,
   feedbackknop, meer spraakcommando's + ?-knop, plak-prompt vult labels in) →
   6B labels (lactosevrij, keukens/nationaliteit, labelstap in de editor, vertaalprompt ontbrekende
   ingrediënten) → 6C vaste boodschappenlijst → 6D XP, levels, badge-niveaus, ontgrendelingen.
   Elk blok begint met de open vragen uit dat document.
4. **Z handleiding** (altijd als laatste; voorheen "G").
5. Daarna testen Stijn en Gabi kritisch op de telefoons, en volgen verbeterrondes.
Stijn zegt per blok "door". De volgorde mag hij altijd omgooien.

## Blok Z — Handleiding (wens Stijn 3 okt 2026; bewust als LAATSTE, "als alles helemaal goed is")
Eén duidelijke, zoekbare, geordende handleiding waarmee je alle functies kunt verkennen — géén
testpagina's meer. Voorstel (bevestigen bij de start van G): in de app als Meer → Handleiding,
tweetalig, met zoekveld en onderwerpen in een logische volgorde (eerste keer · recepten · koken ·
week & boodschappen · delen & ontvangen · woordenboek · badges · instellingen · iPhone vs Android),
per functie: wat het doet, waar je tikt, en wat je dan ziet; tekst in een databestand
(bv. data/handbook.json) zodat hij los te onderhouden is. docs/DEVICE-TEST.md gaat daarin op
(de "probeer het"-stappen). Idee Stijn: DEVICE-TEST, het Apparaatcheck-scherm en de Curator op één
hoop (bv. Meer → "Testen & nakijken") — doen als dat handig blijkt.
Volgorde (Stijn): eerst het plan incl. extra's netjes af (F, fase 6, Z); pas dán testen en
kritisch kijken op de telefoons, daarna verbeterrondes.
Tweede versie erbij (6 okt): een handleiding "achter de schermen" voor Stijn (XP-berekening, waar
data staat, back-ups, delen), zie docs/phase-6-spec.md blok Z.
iPhone-spraakcommando's: bewust uit (3 okt) — canListen() is false op iOS; voorlezen werkt wel.

## Werkwijze vanaf 15 okt 2026: Fable ontwerpt, Opus bouwt, Fable controleert één keer aan het eind
Besluit Stijn (15 okt), om ±80 % Fable te besparen:
1. **Fable schrijft bouwspecs** (één spec-ronde, na ronde 13 okt deel 1) voor alle resterende blokken behalve
   de handleiding: Home A+ (13 okt deel 2), 6B + 13E (labels, lactosevrij, keukens, nieuwe categorieën +
   20 bijgerechten), 13F (inbouwen met id-migratie), 13D (varianten als tabs + "Tip van de maker"), 6C (vaste
   lijst), 6D (XP/levels/badges/avatar — **dit plan moet héél goed zijn**). Specs komen in docs/specs/<blok>.md:
   gedrag met NL+EN-teksten, datamodel, bestandsverdeling per bouwer, contracten, invarianten, testplan +
   acceptatiechecks, DEVICE-TEST-rijen, en een **controlelijst voor Fable**. Expliciet: wat Opus niet zelf
   mag beslissen.
2. **Opus 5.5 bouwt** blok voor blok volgens de specs (workflow met bouwers → integrator → Haiku-gate; de
   review-fan-out mag Opus zelf beperkt doen), Haiku voor het sjouwwerk. Kleine blokken, want ook Opus kan
   halverwege op een limiet stuiten: hervatten met resumeFromRunId, eerst de werkmap bekijken.
3. **Fable controleert één keer kritisch aan het eind**, ná de handleiding (blok Z), over alles wat Opus
   bouwde; alleen 13F (id-migratie) en 13D (deelformaat) krijgen vóór livegang een korte Fable-blik als
   Stijn dat wil. Gevonden fouten worden dan in één verbeterronde gerepareerd.

## Werkwijze (afgesproken 7 okt 2026, om de weeklimiet te sparen)
- **Fable is de bouwer en de controleur.** Ontwerp, ADR's, parser, share-token-codec, migraties,
  merge-logica en de Engelse teksten voor Gabi blijven bij Fable (invarianten 1–4).
- **Haiku voor afgebakend sjouwwerk**, als goedkope losse sessie of als `model: 'haiku'` voor
  mechanische stappen in een workflow: `npm run check/test/build/validate:data` draaien en fouten
  samenvatten, zoekwerk, i18n-keys NL+EN toevoegen, hernoemen, CSS-tokens, STATUS.md/DEVICE-TEST.md
  bijwerken, simpele batches met een duidelijk patroon. **Fable loopt daarna na** wat Haiku veranderde.
- Workflows: geen grote review-fan-outs als het niet nodig is; per stap het lichtste model dat het
  aankan; vertel Stijn vooraf ongeveer hoe zwaar een blok wordt. Let op: een hervatte workflow haalt
  niets uit de cache als het eerste agent()-call mislukte (de cache werkt op een ongebroken reeks).
- **Zichtbaar tijdens het werk (wens Stijn):** bij de start van een workflow het takenpaneel tonen
  (daar loopt de voortgang per agent en fase live mee; in de terminal: /workflows), de tijdlijn
  (https://claude.ai/artifact/6LXkS8KpLeqJfkXLYPrg3L) bijwerken met het blok dat loopt en welke
  agents er per fase aan werken, en na elke deploy de live app openen in het browserpaneel.

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met de `Co-Authored-By:`-regel van het model dat de commit maakt.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
- Blok B t/m E staan nog niet op de telefoons getest (DEVICE-TEST rijen 41–51). Stijn doet dat
  pas als E, F en G af zijn; vanaf blok G via de handleiding in plaats van het testdocument.
