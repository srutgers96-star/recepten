# Spec 6E — Uitdagingen (challenges), vrij op level 20

Status: compleet (Fable, 8 nov 2026). Eén blok, drie bouwers + integrator (lichte modus). Bron: docs/IDEAS.md idee 3 (Stijn 6 en
28 okt) en het besluitblok "ontgrendelingen rijk, niet spaarzaam" in xp-levels.md. Leidend bij tegenspraak: docs/specs/README.md §2,
xp-levels.md §2 (XP is afgeleid, nooit opgeteld), badges-avatar.md (badgeregels, zeldzaamheid). Fable's antwoorden op de open
vragen van idee 3: **één lopende uitdaging tegelijk; je kiest zelf uit een aanbod van drie dat elke maandag ververst; beloning =
bonus-XP plus de ladderbadge Uitdager; avatar-onderdelen als beloning komen in een latere data-ronde.** Nooit verplicht, nooit straf.

## 1. Doel en gebruikersgedrag

1a. **Vrij op level 20.** De ontgrendeling `challenges` (data/unlocks.json, kind `feature`, level 20, zeldzaamheid rare, al
gereserveerd in xp-levels.md §2e) maakt de kaart **Uitdaging** zichtbaar op **Mijn profiel** (onder de XP-balk, boven de tegels).
Onder level 20, of met badges uit: geen kaart, geen spoor (xp-levels §1 "geen spoor van XP").

1b. **De kaart zonder lopende uitdaging:** kop "🎯 Uitdaging", de regel `challenge.pick` NL "Kies een uitdaging voor deze week" ·
EN "Pick a challenge for this week" en de knop **Kies** → sheet **Kies een uitdaging** (SheetPortal, Sluit rechts) met drie
kaarten: naam, uitleg met het doel ingevuld ("Kook deze week 3 keer vegetarisch"), termijn ("tot zondag", "tot 30 nov", "hele
winter"), beloning ("+250 XP"), zwaarte als één tot drie 🌶. Tik op een kaart → **Start** → de sheet sluit, de kaart toont de
lopende uitdaging. Het aanbod ververst elke maandag (lokale tijd); je mag binnen de week wisselen (Opgeven, zie 1d).

1c. **De kaart met lopende uitdaging:** naam, voortgangsbalk ("2 van 3"), resterende tijd ("nog 4 dagen" / "tot zondag"),
beloning. Haal je het doel: de balk loopt vol, `celebrate('challenge')` (confetti in de actieve stijl) en een toast
`challenge.doneToast` NL "🎯 Uitdaging gehaald: {name} · +{xp} XP" · EN "🎯 Challenge done: {name} · +{xp} XP"; de uitdaging gaat
naar de geschiedenis en de kaart staat weer op "Kies". Verloopt de termijn zonder doel: stille regel `challenge.expired`
NL "Niet gehaald, geen punt — kies een nieuwe." · EN "Not this time, no harm done — pick a new one.", kaart terug op Kies; geen XP,
geen melding die stoort.

1d. **Opgeven:** in de kaart een kleine knop **Opgeven** (`challenge.giveUp`), met bevestiging; de uitdaging verdwijnt zonder
geschiedenis-regel en zonder straf; het aanbod van die week blijft beschikbaar (dezelfde drie, de opgegeven ook).

1e. **Geschiedenis:** onder de kaart een uitklapbare regel "Gehaald: {n}" met de laatste vijf (naam, datum, XP). De badge
**Uitdager** (🎯, groep koken, ladder `tiers: [1, 3, 5, 10, 20, 35, 50, 75]`, regel `{ kind: 'challenges' }` = aantal gehaalde
uitdagingen) telt mee zoals elke ladder.

1f. **Eerlijk.** Alleen kookbeurten, foto's enz. met een tijdstip binnen de termijn tellen (terugdateren mag zoals altijd, maar
alleen binnen het venster); de voortgang wordt steeds opnieuw berekend uit de feiten (nooit opgeteld); een gehaalde uitdaging
blijft gehaald (de geschiedenis is de bron van de bonus-XP, zie §2). Het level-up-venster noemt op level 20 "Uitdagingen" als
ontgrendeling (bestaand mechanisme van unlocks.json).

## 2. Datamodel

```ts
// src/domain/challenges.ts (framework-vrij)
export type ChallengeTerm = 'week' | 'month' | 'season';          // week = ma–zo van de start; month = t/m einde maand; season = t/m einde seizoen (badges-avatar seizoensvensters)
export type ChallengeRule =
  | { kind: 'cooks'; n: number }                                   // n kookbeurten
  | { kind: 'cooksWithTag'; tag: string; n: number }               // n kookbeurten van recepten met tag (tagsWithVariants + entry.variant zoals badges)
  | { kind: 'cooksInCategory'; category: string; n: number }
  | { kind: 'newCuisines'; n: number }                             // n keukens die dit lid vóór de start nog nooit kookte
  | { kind: 'newRecipes'; n: number }                              // n recepten die dit lid vóór de start nog nooit kookte
  | { kind: 'photos'; n: number }                                  // n foto's bij gekookte gerechten in het venster
  | { kind: 'everyWeekday' }                                       // elke dag ma–zo minstens één kookbeurt (alleen term 'week')
  | { kind: 'categories'; categories: string[] }                   // uit elke genoemde categorie minstens één kookbeurt
  | { kind: 'surpriseCooks'; n: number };                          // n kookbeurten van een gerecht dat via Verras me/🎲 in de week kwam (feature 'surprise' + planCook op dezelfde dag)
export interface Challenge { id: string; nl: { name: string; description: string }; en: { name: string; description: string };
  rule: ChallengeRule; term: ChallengeTerm; xp: number; weight: 1 | 2 | 3; icon: string; }
export interface ActiveChallenge { id: string; memberId: string; startedAt: string; deadline: string }
export interface DoneChallenge { id: string; memberId: string; startedAt: string; finishedAt: string; xp: number }
export function normalizeChallenges(v: unknown): Challenge[];
export function termDeadline(term: ChallengeTerm, startedAt: string, seasons: SeasonWindows): string; // ISO einde van het venster, lokale tijd
export function weekKey(date: Date): string;                                                          // 'YYYY-Www' met maandag als start
export function offerFor(pool: readonly Challenge[], key: string, memberId: string, recentDone: readonly DoneChallenge[]): Challenge[]; // 3 stuks: één van elke zwaarte, niet gehaald in de laatste 8 weken, deterministisch via hash32(key + memberId)
export function progressFor(c: Challenge, active: ActiveChallenge, facts: ChallengeFacts): { current: number; target: number; done: boolean };
export interface ChallengeFacts { log: CookLogEntry[]; recipes: ReadonlyMap<string, Recipe>; photoRows: ReadonlyArray<{ recipeId: string; at: string }>; features: ReadonlyArray<{ id: string; at: string }>; now: string }
```
- Settings (per lid, in de back-up): `challenges.active` = `Record<memberId, ActiveChallenge | null>`, `challenges.done` =
  `DoneChallenge[]` (groeit alleen; dedupe op id+startedAt). Toestel-lokaal: niets. README §2b-register (integrator).
- **Bonus-XP:** `deriveXp` (src/domain/xp.ts) krijgt één extra invoer `challenges: readonly DoneChallenge[]` en telt per gehaalde
  uitdaging één event `{ kind: 'challenge', xp }` op `finishedAt` (geen crit, geen cap). XP_RULES_VERSION blijft 3: dit is een nieuwe
  bron die voor bestaande gebruikers niets verschuift (0 gehaalde uitdagingen = 0 verschil); wel in xp-levels.md §2b noteren.
  `XpState.events` kent de soort 'challenge'; de XP-pop toont "+250" zoals bij een badge.
- **Badge:** `uitdager` in data/badges.json; regel kind `challenges` (nieuw in src/domain/badges.ts: `facts.challengesDone` =
  aantal gehaalde voor het lid, 'all' = totaal).
- **Data:** data/challenges.json met 30 uitdagingen (ids kebab-case; NL én EN; `weight` 1/2/3 gelijk verdeeld; termijnen gemengd),
  inhoud uit IDEAS 3 en deze set, letterlijk over te nemen door bouwer B:
  week (w1): drie-keer-vega (cooksWithTag vegetarisch 3, 250 XP, 🌶), nieuwe-keuken (newCuisines 1, 200, 🌶), soep-en-salade
  (categories [soep, salade], 250, 🌶🌶), nagerecht-en-bijgerecht (categories [nagerecht, bijgerecht], 250, 🌶🌶), elke-dag-koken
  (everyWeekday, 400, 🌶🌶🌶), twee-nieuwe-recepten (newRecipes 2, 250, 🌶🌶), foto-bij-alles (photos 3, 200, 🌶), verras-me-kookt
  (surpriseCooks 2, 250, 🌶🌶), glutenvrij-eens (cooksWithTag glutenvrij 1, 150, 🌶), vegan-dag (cooksWithTag vegan 1, 200, 🌶),
  pasta-week (cooksInCategory pasta 2, 150, 🌶), oven-week (cooksInCategory oven 2, 150, 🌶), vijf-kookbeurten (cooks 5, 300, 🌶🌶);
  maand (m): vijf-nieuwe-klassiekers (newRecipes 5, 600, 🌶🌶), drie-nieuwe-keukens (newCuisines 3, 600, 🌶🌶🌶), tien-kookbeurten
  (cooks 10, 500, 🌶🌶), foto-maand (photos 8, 500, 🌶🌶), vega-maand (cooksWithTag vegetarisch 6, 600, 🌶🌶), wereldreis (newCuisines
  5, 900, 🌶🌶🌶), bakmaand (cooksInCategory gebak 3, 500, 🌶🌶), soepmaand (cooksInCategory soep 4, 400, 🌶), twintig-kookbeurten
  (cooks 20, 1000, 🌶🌶🌶), lactosevrij-maand (cooksWithTag lactosevrij 3, 450, 🌶🌶);
  seizoen (s): winterkost-pakket (cooksInCategory soep 8, 800, 🌶🌶), zomersalades (cooksInCategory salade 6, 700, 🌶🌶),
  seizoen-van-nieuw (newRecipes 12, 1500, 🌶🌶🌶), fotoseizoen (photos 15, 900, 🌶🌶), keukenreis-seizoen (newCuisines 8, 1500, 🌶🌶🌶),
  dertig-kookbeurten (cooks 30, 1500, 🌶🌶🌶), feestmaal (categories [nagerecht, bijgerecht, soep], 600, 🌶🌶).
  Namen en omschrijvingen NL én EN met `{n}` waar het doel staat; Fable keurt de teksten in de eindcontrole.

## 3. Bestandsverdeling

**Bouwer A — domein** (`src/domain/challenges.ts` [nieuw], `src/domain/xp.ts` (alleen de invoer `challenges` en het event 'challenge'),
`src/domain/badges.ts` (regelsoort `challenges`, `BadgeFacts.challengesDone`), `tools/validate-data.ts` (`validateChallenges`: unieke
ids, NL/EN, bekende tag/categorie-ids, `everyWeekday` alleen bij week, xp 100–2000, weight 1–3, precies 30 stuks), `tests/challenges.test.ts`
[nieuw; alle regelsoorten, `offerFor` deterministisch en zonder recent gehaalde, `termDeadline` per termijn incl. jaarwissel],
`tests/xp.test.ts` (het challenge-event; de 30-jaar-simulatie blijft onder budget), `tests/badges.test.ts` (uitdager)).
**Bouwer B — data en app-laag** (`data/challenges.json` [nieuw, §2], `data/badges.json` (uitdager, na vaste-klant), `data/unlocks.json`
(`challenges` level 20 rare als die er nog niet staat; anders alleen de rarity), `src/challenges.ts` [nieuw: signals `activeChallenge`,
`challengeOffer`, `doneChallenges`; `startChallenge`, `giveUp`, `settleChallenges()` na elke `settleXp` (haalt progressFor op, zet
done + toast + celebrate), `loadChallenges()` bij boot], `src/db/repo.ts` (alleen `challenges.active`/`challenges.done` lezen/schrijven +
`xpStateFor` krijgt de done-lijst mee), `src/xp.ts` (de done-lijst aan deriveXp geven; `settleChallenges` aanroepen), `tests/validate-badges.test.ts`
(aantallen 145 → 146)).
**Bouwer C — UI** (`src/components/ChallengeCard.tsx` [nieuw], `src/components/ChallengeOfferSheet.tsx` [nieuw], `src/screens/ProfileScreen.tsx`
(alleen de kaart invoegen onder de XP-balk, alleen met badges aan én `isActive('challenges')`), `src/celebrate.ts` (soort 'challenge' =
confetti in de actieve stijl), `src/components/XpPop.tsx` alleen als het event-type een label nodig heeft, `src/i18n/xp.ts` (`challenge.*`
NL én EN), `src/styles/xp.css` (kaart, balk, sheet-kaarten, 🌶)).
**Integrator:** check/test/build/build:next/validate; acceptatie in de dev-app (profiel op level 20 via testdata: kaart, kiezen, voortgang
na een kookbeurt, gehaald → toast + XP-pop + badge Uitdager 1/…, opgeven, aanbod ververst bij een andere weekKey); DEVICE-TEST rij 107
"Uitdagingen (6E)" NL én EN na rij 106; STATUS-kop "… (Opus): 6E — Uitdagingen, vrij op level 20"; README §2b (settings), xp-levels.md §2b
één regel over het challenge-event.

## 4. Regels

1. Nooit verplicht, nooit straf; verlopen = stil terug naar Kies.  2. Eén lopende per lid.  3. Voortgang altijd afgeleid uit feiten in het
venster.  4. Bonus-XP alleen uit de geschiedenis; de geschiedenis groeit alleen.  5. Badges uit of onder level 20: niets zichtbaar.
6. Geen nieuwe dependency, geen Dexie-versie, geen nieuwe fragmentsleutel.  7. Alle teksten NL én EN; het doel altijd ingevuld.
