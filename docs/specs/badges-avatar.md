# Spec 6D-2/6D-3 — Badge-catalogus (±120) en avatar-bibliotheek (±64 onderdelen)

Status: compleet (Fable, 22 okt 2026)
Gebouwd: 29 okt 2026 (blok 6D-2a, workflow wf_6f6fb349-c5a)

**Besluit Stijn (24 okt 2026) — de ambitie gaat omhoog, niet omlaag.** De avatar wordt een echte garderobe:
**zeven lagen** die je apart kiest (voorstel: achtergrond · lichaam/shirt · gezicht · haar · hoofddeksel · attribuut in
de hand · iets in de lucht/erbij; Fable mag de zeven definitief maken) met per laag **40–70 onderdelen**, veel met
ingrediënten-thema. Dat is te veel voor één blok: **6D-3 bouwt het raamwerk met ronde 1** (de ±60 onderdelen uit §2f,
verdeeld over de zeven lagen, zodat elke laag al keuze heeft en er bij vrijwel elk level iets vrijkomt), en daarna
**uitbreidingsrondes** van telkens ±60–100 onderdelen (alleen data/avatar-parts.json + SVG; geen code), tot elke laag
40–70 heeft. Het tekenen van de onderdelen is ontwerpwerk voor Fable (Stijn: "iets wat Fable goed zou doen"); Opus
zet ze in de data. Het datamodel (§2f: id, laag, nl/en, unlock, svg) is daarvoor al gemaakt; de validator eist dat elk
level 1–100 minstens één ontgrendeling heeft (onderdeel, confetti, geluid, lettertype of achtergrond) zodra de
bibliotheek groot genoeg is. Zie ook xp-levels.md §2e (ontgrendelingen) voor confetti-stijlen, timergeluiden,
lettertypes, gouden modus en challenges op level 20.

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs, vooral docs/specs/xp-levels.md
(besluiten over specs heen in docs/specs/README.md §2; bij tegenspraak wint README.md). De twee
6D-specs zijn op elkaar afgestemd; dit model wint waar ze botsten:
- **Bloknamen (canoniek, README §1):** 6D-1 XP (xp-levels) → **6D-2a/2b** (§3a/§3b hier) → **6D-3**
  avatar (§3c) → 6D-4a ontgrendelingen (xp-levels "Blok 6D-3") → 6D-4b sync + kalender (xp-levels
  "Blok 6D-4"). DEVICE-TEST-rijen definitief **94–97** (xp-levels: 92–93, 98–100).
- Badge-model: `tiers`/`tier`/`maxTier`, `hidden`, `xp`, `badgeXp` — xp-levels.md §2f is hierop
  herschreven. XP: ladder per bereikt niveau k één event base 50·k; eenmalig één event
  `badge.xp ?? (hidden ? 250 : 50)`. **6D-2a zet `XP_RULES_VERSION` op 2** (catalogus en badge-XP
  veranderen; eerlijke melding). Bouwer C van 6D-2a bezit daarvoor ook `src/xp.ts` en `src/domain/xp.ts`
  (alleen: mapping `{ id, level: status.tier, secret: badge.hidden === true, xp: badge.xp }`, de
  badge-XP-regel en de versiebump).
- `streakDays` gebruikt **`longestDayStreak(cookDays, rules?)` uit `src/domain/xp.ts`** (6D-1 levert
  hem; er komt geen src/domain/streak.ts); badges.ts maakt `cookDays` met `dayIndexOfIso` uit
  src/domain/days.ts.
- De badge **Overcooked!** is geen feature-event: regelsoort `{ kind: 'overcooked'; n?: number }` telt
  `facts.xp?.events` met `crit === 'overcooked'`; `BadgeFacts.xp?: XpState` (gevuld door `buildFacts` via
  `xpStateFor(memberId)`, leeg op 'all'). `'overcooked'` is uit FEATURE_IDS (32 ids, 32 hooks).
- Avatar-maker op **level 3** in beide specs (data/unlocks.json `by: { level: 3 }`).
- `#x=` (xp-levels): `badges` in het formaat `id` / `id@k` (zoals `badges.earned`); `avatar?: AvatarSpec`.
- 6B (gebouwd eerder) voegde `zuivelvrije-ziel` (🥥, eenmalig n 5) toe: 44 bestaande ids. Deze spec houdt
  dat id en maakt er de ladder "tag lactosevrij" van; `zonder-zuivel` vervalt (§2d aangepast, telling
  blijft 144).
- NL-naam "Huiskok" blijft (geen hernoeming naar "Thuiskok"); EN "Home cook".
- Facial-onderdelen heten `facial-stubble`, `facial-beard`, `facial-moustache`, `facial-moustache-chili`
  (regel "id begint met `<laag>-`" klopt dan; vuurspuwer's `unlock.part` mee aangepast).
- Home: na Home A+ en 6D-1 heeft Home géén badgekaart meer (HomeLevelRow toont `LevelLine`). De
  Home-taak van 6D-2b bouwer C vervalt; DT 95 stap 5 kijkt op Meer → Badges. 6D-3 bouwer C geeft in
  HomeScreen.tsx `level` mee aan `<Avatar>` in de begroeting (één regel) en zet `avatar` in
  `memberFromProfile` (household.ts, bouwer A) en in de handgebouwde Members van DeltaShareScreen.tsx,
  zodat lokale leden overal hun avatar tonen. De Badges-tabs houden hun kleurstip (DT 97 stap 4 weg).
- Feature-momenten die de feitencheck openliet: `listMade` = alleen "Maak de lijst" (`build(true)`);
  `surprise` = TonightCard "🎲 Nog een" (Home A+) én WeekScreen `surpriseFill`/`surpriseUnlocked`/`reroll`;
  `langToggle` = één hook in `chooseLang` (src/components/Header.tsx; dekt MoreScreen en de NL|EN-pil);
  `planShared` = `shareText` outcome 'shared' én `shareJsonFile` outcome 'shared'/'downloaded'; `dictEdit`
  ook in LineView.tsx. Header.tsx, LineView.tsx en TonightCard.tsx staan nu bij 6D-2b bouwer B.
- `BadgeFacts.photoRows` krijgt een lokaal structureel type `{ recipeId: string; memberId: string; at:
  string }` (geen import uit src/db in het domein).
- `PHOTOREC` eindigt op 200 · 250 (196 was de oude klassiekerstelling; na 13F zijn er 236).
- De drie open vragen voor Stijn blijven (catalogus goedkeuren; hartje; maker op level 3 of 5).

Feitencheck Opus, 22 okt 2026: 12 correcties
- §1b, §3c, §3d: `levelFor(xp)` → `levelForXp(total, rules?)` in src/domain/xp.ts (zo heet hij in
  docs/specs/xp-levels.md §2c).
- §2c `qrShown`: er is geen `setShowQr(true)`; beide knoppen doen `setShowQr((v) => !v)`.
- §2c `langToggle`: MoreScreen roept `chooseLang(v[0])` aan (src/components/Header.tsx), niet
  `setLang`/`toggleLang`.
- §2c `listMade`: de knoppen heten "Maak de lijst" (`shop.make`) en "Bevestig lijst" (`shop.confirm`),
  niet "Maak lijst"/"Klaar".
- §2c `surprise`: de knop die op Home een nieuw recept kiest heet "🎲 Nog een" (`home.reroll`); "Verras me"
  is de kaarttitel.
- §2c `dictEdit`: `setLineOverride`/`linkUserRecipeLine` staan in src/components/LineView.tsx, niet in
  DictionaryScreen/IngredientPicker; `saveUserIngredient` in IngredientPicker.tsx en DictionaryScreen.tsx.
- §2c `cardShared` en §6c.12: de knop heet "Kopieer link" (`household.copyCard`).
- §2f telling: 13 L3-basisdelen (niet 12) en 22 badge-delen (niet 19), volgens de eigen lijst.
- §2g: herstel doet `db.profiles.bulkPut` (bestand overschrijft lokaal); "het nieuwste profiel wint" klopt
  niet, `Profile` heeft geen `updatedAt`.
- §6a: `normalizeMember` is niet geëxporteerd; testbaar via `normalizeHousehold`.
- DEVICE-TEST 94 (NL+EN): de datum kies je via **Wanneer?** → **Andere datum** → **Datum**.
- DEVICE-TEST 96 en 97 (NL+EN): de rij heet **Profielen beheren** / **Manage profiles**; de kopieerknop
  **Kopieer link** / **Copy link**.
Daarnaast 18 regels "⚠ Feitencheck" waar een keuze op een feit rust dat niet (meer) klopt; de keuze zelf
is niet veranderd: §1c (avatar komt niet "vanzelf" bij lokale `Member`s; Badges-tabs hebben een
kleurstip), §2a/§2b/§3d (xp-levels.md levert geen `longestDayStreak`/streak.ts, verwacht
`levels`/`level`, zet de avatar-maker op level 4, roept geen `recordFeature` aan), §2c (Header.tsx en
LineView.tsx ontbreken bij Bouwer B, WeekScreen heeft ook "Verras me", plan delen kan ook als bestand,
`Photo` staat in src/db/model.ts), §2d ("Huiskok" heet nu zo; 6B voegt `zuivelvrije-ziel` toe), §2f
(facial-ids beginnen niet met `facial-`), §3d (Home A+ geeft geen `big`/`level`), DEVICE-TEST 97.

Bron: docs/phase-6-spec.md blok 6D, deel "Badges: een eigen deelplan" (8 kleurniveaus geel→platina,
eenmalige badges, badges voor alle functies, doneer-badge = hartje met 0 XP, verborgen badges, groepen
Koken · Ontdekken (196) · Keukens van de wereld · Seizoenen · Samen & delen · Fotografie · Reeksen · Geheim,
XP per badge-niveau 50×niveau en 250 voor geheime) en "eigen avatar" (SVG-lagen in data, profielkleur als
achtergrond, rand per level), plus Stijns besluiten van 6, 13 en 16 okt. Het XP-raamwerk (afleiding, curve,
hoe een badge XP oplevert, dagstreak met één overslaan-dag, anti-valsspeel) staat in docs/specs/xp-levels.md;
deze spec levert daar alleen de velden `tiers`, `hidden`, `xp` en de `tier` in BadgeStatus voor aan.
**Stijn keurt de catalogus (§2d) en de avatar-bibliotheek (§2f) goed vóór de bouw begint** (plan 6D:
"eerst de catalogus als lijst laten goedkeuren"). Alles wat een keuze is, staat hier gekozen; bij twijfel §5.

## 1. Doel en gebruikersgedrag

**In één zin:** de 44 badges (43 + `zuivelvrije-ziel` uit 6B) worden een catalogus van 144 (115 zichtbaar, 29 verborgen), gegroepeerd en met
kleurniveaus die je blijft opschuiven; wie level 3 haalt mag een eigen avatar bouwen uit onderdelen die je
met levels en badges vrijspeelt. Beide vallen onder de bestaande schakelaars: **Badges uit** (`badges.enabled`)
= geen badgepagina, geen toasts, geen avatar-maker (de getekende avatar zelf blijft wél staan: die is van de
persoon, niet van het spel); **Confetti uit** = geen animaties. Taal volgt de app-taal (`lang`).

### 1a. Badgepagina (`#/more/badges`, src/screens/BadgesScreen.tsx)

Van boven naar beneden:
1. Kop `badges.title` (bestaat) met Terug. De ledentabs blijven zoals nu (per lid + `badges.together`).
2. Regel `badges.earnedOf` (bestaat) telt alleen ZICHTBARE badges: "{earned} van {total} badges verdiend".
   Erachter, als er geheime gevonden zijn: `badges.secretFound` — NL "· {n} geheime gevonden" · EN
   "· {n} secret found".
3. Acht **groepen** in deze volgorde (BADGE_GROUPS): Koken · Ontdekken · Keukens van de wereld · Seizoenen ·
   Samen & delen · Fotografie · Reeksen · Geheim. Elke groep is een `<section>` met een inklapbare kop
   (zelfde patroon als `Group` in MoreScreen; stand per groep in localStorage `recepten.badges.groups`,
   standaard alles open): "{groepsnaam} · {verdiend}/{totaal}". Keys: `badges.group.koken` — NL "Koken" · EN
   "Cooking"; `badges.group.ontdekken` — "Ontdekken" · "Discovering"; `badges.group.keukens` — "Keukens van de
   wereld" · "Cuisines of the world"; `badges.group.seizoenen` — "Seizoenen" · "Seasons"; `badges.group.samen`
   — "Samen & delen" · "Together & sharing"; `badges.group.foto` — "Fotografie" · "Photography";
   `badges.group.reeksen` — "Reeksen" · "Streaks"; `badges.group.geheim` — "Geheim" · "Secret".
4. In een groep het bestaande `.badge-grid` (2 kolommen op 360 px) met `BadgeCard`s, catalogusvolgorde.
   Op een ledentab staan de huishouden-brede badges (HOUSEHOLD_KINDS) niet; op Samen staan ze wel.
5. **Eenmalige badge** (geen `tiers`): kaart zoals nu — icoon, naam, "✓ Verdiend" of "3/5" met balkje.
   De kaartrand van een verdiende eenmalige badge is goud (`--lvl-7`), niet meer de oude tier-1/2/3-kleur.
6. **Ladderbadge**: het icoon staat in een ring in de kleur van het huidige niveau (niveau 0 = grijze
   stippelring), onder de naam de regel `badges.tierLabel` — NL "Niveau {k} · {colour}" · EN "Level {k} ·
   {colour}" (niveau 0: `badges.tierNone` — NL "Nog geen niveau" · EN "No level yet"), dan "27/50" en het
   balkje naar het VOLGENDE niveau. Op platina: `badges.tierMax` — NL "✓ Platina" · EN "✓ Platinum", geen
   balkje. Kleurnamen: `badges.tier.1`…`badges.tier.8` — NL geel · groen · blauw · rood · brons · zilver ·
   goud · platina / EN yellow · green · blue · red · bronze · silver · gold · platinum.
7. **Tik op een kaart** → detail eronder (zoals nu): de omschrijving met `{n}` ingevuld (volgende drempel;
   op platina de laatste); bij een ladder een rij van 8 stipjes in de 8 kleuren, gehaalde gevuld, met
   daaronder `badges.tierNext` — NL "Volgende: {n} ({colour})" · EN "Next: {n} ({colour})"; bij `season`
   de regel `badges.season` — NL "Telt van {from} tot {to}" · EN "Counts from {from} to {to}" ({from}/{to}
   als "24 dec" / "24 Dec", via `Intl.DateTimeFormat(lang, {day:'numeric', month:'short'})`); bij een
   huishouden-brede badge `badges.householdOnly` — NL "Telt voor het hele huishouden" · EN "Counts for the
   whole household"; bij `unlock` de regel `badges.unlocks` — NL "Geeft: {part}" · EN "Unlocks: {part}"
   ({part} = de nl/en-naam van het avatar-onderdeel) plus, bij een ladder, "op niveau {colour}".
8. **Groep Geheim**: toont alleen `badges.secretCount` — NL "{n} geheime badges gevonden" · EN "{n} secret
   badges found" en daaronder de gevonden kaarten (compleet, met omschrijving). Nul gevonden:
   `badges.secretNone` — NL "Nog geen geheime badge gevonden. Ontdek de app: sommige dingen die je doet
   leveren er een op." · EN "No secret badge found yet. Explore the app: some things you do earn one."
   Nooit het totaal, nooit een naam of hint van een niet-gevonden geheime badge (ook niet in de DOM).
   Een `hidden` badge buiten de groep Geheim (het hartje) staat gewoon in zijn groep, maar alleen als hij
   verdiend is.
9. Lege staten: geen kookbeurten = alle kaarten op 0 (zoals nu). Badges uit: `badges.disabled` (bestaat).
10. Toasts (shell, bestaand `badgeToast`): eenmalig `badges.toast` (bestaat); ladderniveau `badges.toastTier`
    — NL "🏆 {name} · niveau {k}: {colour}" · EN "🏆 {name} · level {k}: {colour}"; geheim
    `badges.toastSecret` — NL "🤫 Geheime badge: {name}" · EN "🤫 Secret badge: {name}"; levert de badge een
    avatar-onderdeel op, dan een tweede regel in dezelfde toast `badges.toastUnlock` — NL "Nieuw voor je
    avatar: {part}" · EN "New for your avatar: {part}". Samen-varianten zoals nu (`badges.toastTogether`).
    XP-cijfers in de toast komen uit xp-levels.md (die spec bepaalt of "+150" erbij staat).

### 1b. Avatar-maker (`AvatarSheet`, src/components/AvatarSheet.tsx)

**Waar je hem opent.** (1) Meer → kaart Profiel: tik op het grote avatar-rondje (`aria-label` `avatar.open`
— NL "Avatar aanpassen" · EN "Edit avatar"). (2) Meer → Profielen → Bewerk: onder Kleur een rij
`avatar.row` — NL "Avatar" · EN "Avatar" met knop `avatar.edit` — NL "Maak je avatar" · EN "Make your avatar"
(of `avatar.change` — NL "Pas je avatar aan" · EN "Change your avatar" als er al een is). Onder level 3
(AVATAR_MAKER_LEVEL, level uit xp-levels.md `levelForXp(total)` in src/domain/xp.ts) is de knop uitgeschakeld met de regel
`avatar.lockedHint` — NL "Komt vrij op level 3, na je eerste kookbeurt." · EN "Unlocks at level 3, after your
first cooked dish." en doet een tik op het rondje niets. Alleen het ACTIEVE profiel kan zijn avatar
bewerken (level is per persoon). Badges uit: geen knop, geen rij.

**De sheet** (SheetPortal + `.sheet-head.with-actions`): links `common.cancel`, midden `avatar.title` — NL
"Jouw avatar" · EN "Your avatar", rechts `common.save`. Onder de kop:
1. Voorbeeld: de avatar 120 px groot op de profielkleur, met de rand van je level; eronder klein
   `avatar.colorHint` — NL "De achtergrond is je profielkleur (Profielen → Kleur)." · EN "The background is
   your profile colour (Profiles → Colour)."
2. Knop `avatar.random` — NL "🎲 Verras me" · EN "🎲 Surprise me": kiest willekeurig uit je vrijgespeelde
   onderdelen (`randomAvatar`, seed = Date.now()); verplichte lagen altijd gevuld, optionele 50% kans.
3. Per laag een rij, in deze volgorde en met deze labels (`avatar.layer.*`): face — NL "Gezicht" · EN "Face";
   tone — "Huid" · "Skin"; hair — "Haar" · "Hair"; hairColor — "Haarkleur" · "Hair colour"; eyes — "Ogen" ·
   "Eyes"; mouth — "Mond" · "Mouth"; facial — "Baard & snor" · "Beard & moustache"; glasses — "Bril" ·
   "Glasses"; hat — "Hoofddeksel" · "Headwear"; body — "Kleding" · "Clothes"; prop — "Accessoire" ·
   "Accessory"; pin — "Speldje" · "Pin"; bg — "Achtergrond" · "Background". Elke rij is een horizontaal
   scrollende strook van tegels (56 × 56 px, 44 px tikdoel ruim gehaald, `role="radiogroup"`). Tone en
   hairColor zijn kleurrondjes (AVATAR_TONES / AVATAR_HAIR, alle vrij). Optionele lagen (facial, glasses,
   hat, prop, pin, bg) beginnen met de tegel `avatar.none` — NL "geen" · EN "none". De gekozen tegel heeft
   een cobalt rand. Elke tegel toont het onderdeel op een neutrale lichte cirkel (geen profielkleur, zodat
   een bg-tegel leesbaar blijft).
4. **Vergrendelde onderdelen** staan grijs (opacity .45, grijsfilter) met een 🔒 en een labeltje:
   `avatar.lockLevel` — NL "Lv {n}" · EN "Lv {n}" of het badge-icoon. Tik → de tegel schudt niet (rust), er
   verschijnt onder de rij één regel: `avatar.lockedLevel` — NL "Komt vrij op level {n}." · EN "Unlocks at
   level {n}." of `avatar.lockedBadge` — NL "Komt vrij met de badge {badge}." · EN "Unlocks with the badge
   {badge}." of `avatar.lockedBadgeTier` — NL "Komt vrij met de badge {badge} op niveau {colour}." · EN
   "Unlocks with the badge {badge} at level {colour}." Vergrendelde onderdelen van een GEHEIME badge
   tonen niet de badgenaam maar `avatar.lockedSecret` — NL "Komt vrij met een geheime badge." · EN
   "Unlocks with a secret badge." (en de tegel toont 🔒 met ❓).
5. Nieuw vrijgespeeld sinds de vorige keer (niet in `avatar.seen`): klein cobalt stipje rechtsboven op de
   tegel; verdwijnt bij sluiten van de sheet (alle nu zichtbare vrije ids worden "gezien").
6. Onderaan: knop `avatar.reset` — NL "Terug naar de beginletter" · EN "Back to the initial" (zet bij Bewaar
   `avatar: null`; de preview toont dan direct het letterrondje) en de bestaande regel `cooked.dismissHint`
   ("Alleen Bewaar bewaart. …").
7. **Bewaar** → `updateProfile({ ...p, avatar })`; bij een fout de bestaande `common.error` als snackregel in
   de sheet, de sheet blijft open. Annuleer/wegvegen/ernaast tikken/Escape sluit zonder bewaren (13J).
   Een spec met een onderdeel dat je (nog) niet vrij hebt (bv. na herstel van een back-up op een telefoon
   met minder XP) blijft gewoon staan en wordt getekend; alleen de maker toont zo'n tegel vergrendeld en
   geselecteerd tegelijk, met de uitleg eronder. Opnieuw kiezen is dan niet meer mogelijk tot je hem weer
   vrij hebt.

**Eerste keer** (profiel zonder avatar): de sheet opent met `defaultAvatar()` (rond gezicht, stippen,
glimlach, kort haar, T-shirt), zodat Bewaar meteen iets oplevert.

### 1c. Waar de avatar te zien is

De bestaande `Avatar`-component (src/screens/ProfilesScreen.tsx) krijgt: `profile: Pick<Profile, 'name' |
'color' | 'avatar'>`, optioneel `level?: number`. Heeft het profiel een complete avatar (`isComplete`), dan
tekent hij `renderAvatarSvg` in het bestaande `.avatar`-rondje (zelfde maat: 40/56 px, 32 px in chips); anders
het letterrondje van nu. Daarmee verschijnt de avatar vanzelf op Meer (profielkaart en profielchips),
Profielen, Huishouden (leden met een kaartje mét avatar), In & uit (afzender die lid is), Het verhaal,
"Deel je nieuwe recepten" en de Home-begroeting (Home A+-spec; die geeft `level` mee). De rand per level
staat alleen waar `level` meegegeven wordt: Home-begroeting, Meer-profielkaart, Profielen, de Badges-tabs
niet (te klein). Een lid van een andere telefoon heeft geen level op deze telefoon (tenzij via `#x=`, XP-
spec): dan geen rand.

"Vanzelf" geldt waar een `Profile` of `MemberCard` wordt doorgegeven (Meer, Profielen, HouseholdScreen `me`
en `MemberCardRow`). **Besluit (kritische lezer):** `memberFromProfile` (src/domain/household.ts:93, bouwer A
van 6D-3) kopieert ook `avatar`, en DeltaShareScreen.tsx:155 (bouwer C) geeft `avatar` mee aan zijn
handgebouwde Members, zodat lokale leden in Huishouden, Het verhaal, In & uit en "Deel je nieuwe recepten"
hun avatar tonen. De Badges-tabs houden hun kleurstip (`.badge-tab-dot`, BadgesScreen.tsx:115): te klein
voor een avatar, geen wijziging.

### 1d. iPhone vs Android

Geen verschil in badges of avatar. Twee geheime badges (`stemkok`, `op-papier`) zijn op de iPhone niet te
verdienen (spraak en printen bestaan daar bewust niet, invariant 5/13); omdat de pagina nooit het totaal
geheime badges noemt, belooft de app niets dat de iPhone niet kan. `navigator.share` blijft één veld;
het kaartje met avatar is nog steeds `{text}`.

## 2. Datamodel en migraties

**Geen Dexie-wijziging.** Alles in dit blok is een veld op `Profile`, een setting of een databestand. Dexie
blijft op de versie die 13F/13D achterlaten (v8/v9); 6D-2 en 6D-3 voegen géén tabel toe (het plan zei al:
XP liever settings/afgeleid).

### 2a. Het uitgebreide badge-model (src/domain/badges.ts, additief)

```ts
export type BadgeGroup = 'koken' | 'ontdekken' | 'keukens' | 'seizoenen' | 'samen' | 'foto' | 'reeksen' | 'geheim';

/** 'MM-DD' … 'MM-DD', inclusief; `to` < `from` loopt over de jaarwisseling ('12-21' … '03-19'). */
export interface BadgeSeason { from: string; to: string }

/** Een badge geeft een avatar-onderdeel vrij: bij een eenmalige badge zodra hij verdiend is, bij een
 *  ladderbadge zodra niveau `tier` bereikt is (verplicht bij een ladder). */
export interface BadgeUnlock { part: string; tier?: number }

export interface Badge {
  id: string;
  nl: { name: string; description: string };
  en: { name: string; description: string };
  icon: string;
  rule: BadgeRule;
  group: BadgeGroup;
  /** Ladder: precies 8 oplopende drempels (geel, groen, blauw, rood, brons, zilver, goud, platina).
   *  Dan heeft `rule` geen `n`, en bevatten beide descriptions de placeholder `{n}`. */
  tiers?: number[];
  /** Onzichtbaar tot verdiend (groep 'geheim' is altijd hidden; andere groepen mogen het ook zijn). */
  hidden?: boolean;
  /** Alleen voor rule.kind 'seasonCooks': het venster waarin kookbeurten tellen. */
  season?: BadgeSeason;
  unlock?: BadgeUnlock;
  /** XP-override voor een EENMALIGE badge (standaard 50; hidden standaard 250). Ladders: 50 × niveau,
   *  nooit een override (docs/specs/xp-levels.md rekent ermee). 0 = cosmetisch (het hartje). */
  xp?: number;
  /** Bestaat alleen nog omdat `badges.earned` de id kent; wordt niet getoond, niet geëvalueerd, geeft
   *  geen XP. `replacedBy` wijst naar de ladder die het stokje overnam. */
  retired?: boolean;
  replacedBy?: string;
  /** Fase 5-veld; blijft geldig, wordt door de nieuwe UI genegeerd (de kleur komt uit het niveau). */
  tier?: 1 | 2 | 3;
}
```

`normalizeBadges` blijft tolerant (nooit een exception): een ongeldige `group` wordt `'koken'`, een ongeldige
`tiers` (geen array van precies 8 strikt stijgende gehele getallen ≥ 1) wordt weggelaten, `hidden`/`retired`
alleen `true` telt, `season` alleen met twee geldige `MM-DD`-strings, `unlock` alleen met een niet-lege
`part`, `xp` alleen een geheel getal ≥ 0. De **validator** (2e) is wél streng; de data komt altijd eerst door
`npm run validate:data`.

Nieuwe exports van badges.ts (naast de bestaande):

```ts
export const BADGE_GROUPS: readonly BadgeGroup[];               // in paginavolgorde (zie §1a)
export const TIER_COLOURS: readonly ['geel','groen','blauw','rood','brons','zilver','goud','platina'];
export function isLadder(b: Badge): b is Badge & { tiers: number[] };
/** Het niveau (0..8) dat `current` haalt op de ladder; 0/1 voor een eenmalige badge. */
export function tierFor(b: Badge, current: number): number;
/** Hoeveel XP deze status waard is volgens het plan: ladder Σ 50·k (k ≤ tier), eenmalig b.xp ?? (hidden ? 250 : 50). */
export function badgeXp(s: BadgeStatus): number;                // xp-levels.md roept dit aan
export function parseSeasonWindow(s: BadgeSeason): { from: [number, number]; to: [number, number] } | null;
export function inSeason(monthDay: [number, number], s: BadgeSeason): boolean;
```

Afgestemd (kritische lezer): docs/specs/xp-levels.md §2f volgt nu dit model (`tiers`/`tier`, eenmalig
`xp ?? (hidden ? 250 : 50)`, ladder 50·k per niveau) en bumpt `XP_RULES_VERSION` naar 2 in 6D-2a.

`BadgeStatus` wordt:

```ts
export interface BadgeStatus {
  badge: Badge;
  /** Eenmalig: verdiend. Ladder: niveau ≥ 1. */
  earned: boolean;
  /** Voortgang naar het VOLGENDE niveau (ladder) of naar het doel (eenmalig); op platina = target. */
  current: number;
  target: number;
  /** 0..8 (ladder) of 0/1 (eenmalig). */
  tier: number;
  /** 8 (ladder) of 1. */
  maxTier: number;
}
```

`evaluateBadges(badges, facts)` slaat `retired` badges over (ze komen niet in de uitvoer) en levert verder
één status per badge in catalogusvolgorde. `current` wordt afgetopt op `target`.

### 2b. Regelsoorten (rule kinds)

Bestaand en ongewijzigd in betekenis: `cookCount`, `distinctRecipes`, `ownRecipes`, `reviews`, `oneStar`,
`photos`, `shared`, `received`, `streakWeeks`, `category`, `tag`, `ingredient`, `letters`, `allClassics`,
`halfClassics`. Nieuw: bij een ladderbadge vervalt `n` (de drempels staan in `badge.tiers`); de teller is
dezelfde.

Eén wijziging in bereik: **`photos` telt voortaan per lid** (facts.photoRows gefilterd op `memberId`, dat de
Photo-rij al heeft; 'Samen' = alles). `HOUSEHOLD_KINDS` in src/badges.ts wordt
`{ownRecipes, received, shared, householdMembers, cooks}`; `photos` gaat eruit, `photoRecipes` en
`photosOfOneRecipe` komen er niet in.

Nieuwe soorten, elk met de meting (alles uit `BadgeFacts`, zie 2c; "kookbeurt" = CookLogEntry van het lid
of, op Samen, van iedereen; "lokale dag" = de kalenderdag in de tijdzone van de telefoon, zoals
`localDayIndex` nu al doet):

```ts
export type BadgeRule =
  | { kind: CountKind; n?: number }                       // n weg = ladder (tiers op de badge)
  | { kind: 'category' | 'tag' | 'ingredient' | 'cuisine'; id: string; n?: number }
  | { kind: 'letters' | 'allClassics' | 'halfClassics' | 'allCategories' }
  | { kind: 'seasonCooks'; n?: number }                   // venster = badge.season
  | { kind: 'weekdayCooks'; days: number[]; n?: number }  // 0 = zondag … 6 = zaterdag
  | { kind: 'cookHour'; from: number; to: number; n?: number } // uren 0–23, inclusief
  | { kind: 'sameRecipeDays'; n: number }                 // n opeenvolgende lokale dagen hetzelfde recept
  | { kind: 'calendar'; when: 'friday-13' | 'leap-day'; n?: number }
  | { kind: 'feature'; id: FeatureId; n?: number }
  | { kind: 'retryAfterOneStar'; n?: number }
  | { kind: 'comeback'; days: number; n?: number }
  | { kind: 'overcooked'; n?: number };                   // telt facts.xp?.events met crit 'overcooked'

type CountKind = 'cookCount' | 'distinctRecipes' | 'ownRecipes' | 'reviews' | 'oneStar' | 'fiveStar'
  | 'photos' | 'photoRecipes' | 'photosOfOneRecipe' | 'shared' | 'received' | 'streakWeeks' | 'streakDays'
  | 'fullWeeks' | 'classics' | 'cuisines' | 'householdMembers' | 'cooks' | 'donor';
```

- `fiveStar` — kookbeurten met `stars === 5` (zoals `oneStar`).
- `classics` — aantal VERSCHILLENDE gekookte klassiekers (`id` begint met `b:` en bestaat in `recipes`);
  dezelfde teller als allClassics/halfClassics, maar met eigen drempels.
- `cuisine` {id} — kookbeurten van recepten met `recipe.cuisine === id` (veld uit de labels-spec 6B.2;
  ontbreekt het veld, dan telt niets). `cuisines` — aantal verschillende `cuisine`-waarden onder de gekookte
  recepten (null telt niet).
- `allCategories` — current = aantal verschillende `recipe.category` onder gekookte recepten, target =
  `facts.categoriesTotal` (lengte van data/categories.json, meegegeven door src/badges.ts).
- `seasonCooks` — kookbeurten waarvan de lokale maand-dag in `badge.season` valt (inclusief; over de
  jaarwisseling als `to` < `from`). De dag van een teruggedateerde kookbeurt (12:00 lokaal) telt gewoon.
- `weekdayCooks` {days} — kookbeurten op die lokale weekdagen (`Date.getDay()`).
- `cookHour` {from,to} — kookbeurten waarvan het lokale uur in [from, to] ligt, **behalve** rijen die precies
  12:00:00.000 lokaal zijn: dat is de marker van `cookedAtForDay` (src/cooklog.ts) voor een achteraf
  ingevoerde dag, daarvan is het echte uur onbekend.
- `sameRecipeDays` {n} — er bestaat een recept met kookbeurten op n opeenvolgende lokale dagen (één per dag is
  genoeg). current = de langste reeks over alle recepten, target = n.
- `calendar` {when} — kookbeurten op een vrijdag de 13e (`friday-13`) of op 29 februari (`leap-day`), lokaal.
- `feature` {id} — `facts.features[id] ?? 0` (zie 2c). Smoke-test erbij: `overcooked` met `facts.xp` dat
  één event `crit: 'overcooked'` heeft → earned; zonder `facts.xp` → 0/1.
- `retryAfterOneStar` — aantal recepten waarvoor ná een kookbeurt met `stars === 1` (op `at`) nog een
  kookbeurt volgde.
- `comeback` {days} — aantal kookbeurten waarvan de vorige kookbeurt van hetzelfde recept (door hetzelfde
  lid / iedereen op Samen) meer dan `days` dagen eerder was.
- `streakDays` — langste reeks lokale dagen met minstens één kookbeurt waarbij **per 7 dagen één gat van één
  dag vergeven wordt**. badges.ts maakt de gesorteerde, unieke `cookDays` (dagindexen via `dayIndexOfIso`
  uit src/domain/days.ts) en roept `longestDayStreak(cookDays)` aan uit **src/domain/xp.ts** (eigendom van
  docs/specs/xp-levels.md, 6D-1, gebouwd vóór 6D-2); badges.ts definieert hem niet opnieuw. Opus: bestaat
  die export bij de start van 6D-2 niet, dan stoppen en melden, niet zelf schrijven.
- `overcooked` — `facts.xp?.events.filter((e) => e.crit === 'overcooked').length` (0 zonder `facts.xp`;
  `BadgeFacts.xp?: XpState` komt van `xpStateFor(memberId)` en is leeg op 'all').
- `fullWeeks` — aantal ISO-weken (maandag-start, lokale dag, zoals `isoWeekMonday`) met kookbeurten op alle
  7 dagen.
- `photos` — rijen in `facts.photoRows`; `photoRecipes` — verschillende `recipeId` daarin; `photosOfOneRecipe`
  — het maximum aantal rijen voor één `recipeId`.
- `householdMembers` — `facts.householdMembers` (alleen Samen); `cooks` — verschillende `profileId` in het log
  (alleen Samen); `donor` — `facts.donorLevel` (0 = geen hartje).

**Ladder-niveau:** `tierFor` telt hoeveel drempels `current` haalt. **Toasten:** `checkNewBadges` registreert
per lid de strings `id` (eenmalig) en `id@k` (ladderniveau k) in `badges.earned`; een nieuw niveau geeft één
toast voor het hóógste nieuwe niveau (de tussenliggende worden stil geregistreerd). Een al geregistreerd
`id`/`id@k` blijft staan ook als de telling later daalt (zoals nu). Oude plain `id`-registraties van een badge
die nu een ladder is, gelden als "niveau 1 bekend".

### 2c. Feature-events: wat wordt wanneer vastgelegd

Lichte registratie zonder tabel: setting **`features.log`** =
`Record<FeatureId, { n: number; first: string; last: string; by: Record<string, number> }>` (`first`/`last`
ISO; `by` = telling per lid-id, `'anon'` zonder actief profiel). Domein: **src/domain/features.ts**
(framework-vrij):

```ts
export const FEATURE_IDS = ['voice', 'print', 'qrShown', 'theme', 'amounts', 'readAloud', 'langToggle',
  'fahrenheit', 'pasteRecipe', 'aiImport', 'backup', 'restore', 'story', 'pick7', 'pantry', 'wordPicker',
  'scaled', 'standingList', 'sort', 'cookSwipe', 'cookMode', 'timer', 'planCook', 'listMade', 'surprise',
  'dictEdit', 'variant', 'planShared', 'listShared', 'deltaShared', 'cardShared', 'feedback'] as const;
// 32 ids. 'overcooked' is GEEN feature-event: die badge leest uit BadgeFacts.xp (kritische lezer).
export type FeatureId = (typeof FEATURE_IDS)[number];
export interface FeatureCount { n: number; first: string; last: string; by: Record<string, number> }
export type FeatureLog = Partial<Record<FeatureId, FeatureCount>>;
export function isFeatureId(v: unknown): v is FeatureId;
export function normalizeFeatureLog(v: unknown): FeatureLog;            // tolerant, zoals normalizeEarned
export function bumpFeature(log: FeatureLog, id: FeatureId, memberId: string, at: string): FeatureLog;
export function mergeFeatureLogs(a: FeatureLog, b: FeatureLog): FeatureLog; // n = max, first = min, last = max, by = max per lid
export function featureCounts(log: FeatureLog, memberId: string | 'all'): Record<string, number>;
```

App-laag **src/features.ts**: `recordFeature(id: FeatureId): Promise<void>` leest de setting, bumpt voor
`activeProfile.value?.id ?? 'anon'` met `nowIso()`, schrijft terug en roept `checkNewBadges(memberId)` aan
(no-op als badges uit staan). Aanroepen worden geserialiseerd zoals `checking` in src/badges.ts. Nooit
`await`en in een tap-handler: `void recordFeature('timer')`. Waar en wanneer (het moment is **na succes**):

- `voice` — src/screens/CookScreen.tsx: een herkend `VoiceCommand` wordt uitgevoerd (niet bij null).
- `print` — src/screens/RecipeScreen.tsx `onPrintAs(...)` en src/screens/ShoppingScreen.tsx print-knop.
- `qrShown` — ShareScreen.tsx en ProfilesScreen.tsx (`MemberCardPanel`): de knop `setShowQr((v) => !v)` op
  het moment dat hij de QR tóónt (van false naar true).
- `theme` — MoreScreen.tsx: `setTheme(v)` met een andere waarde dan de huidige.
- `amounts` — src/step-amounts.ts `setShowAmounts(true)`.
- `readAloud` — src/speech.ts `setReadAloud(true)`.
- `langToggle` — één hook in `chooseLang(l)` zelf (src/components/Header.tsx), als `l` verschilt van de
  huidige taal; dat dekt MoreScreen (`chooseLang(v[0])`, MoreScreen.tsx:515) én de NL|EN-pil `LangToggle`
  in elke kop (niet de profielwissel). Header.tsx staat bij Bouwer B (§3b).
- `fahrenheit` — MoreScreen.tsx `setFahrenheit(on)` (aan én uit).
- `pasteRecipe` — EditScreen.tsx: "Vul in" na een websiteroute (classifyPaste → 'website') is toegepast.
- `aiImport` — EditScreen.tsx: "Vul in" na een AI-antwoord (classifyPaste → 'ai').
- `backup` — StorageScreen.tsx: Download of Delen van de back-up met outcome 'shared' of 'downloaded'.
- `restore` — StorageScreen.tsx: `importBundle` is geslaagd.
- `story` — StoryScreen.tsx: bij mount (één keer per bezoek).
- `pick7` — WeekScreen.tsx: PickSheet "Voeg N toe" bevestigd.
- `pantry` — ShoppingScreen.tsx: `setInHouse(ing, true, …)` (Heb ik al aan).
- `wordPicker` — WordPicker.tsx: "Koppel zo" bevestigd.
- `scaled` — RecipeScreen.tsx `onServings(n)` met n ≠ `base`.
- `standingList` — spec 6C: een regel op de vaste lijst gezet (`addStandingItem`-pad in ShoppingScreen).
- `sort` — RecipesScreen.tsx `setSortMode(next)` met next ≠ 'az'.
- `cookSwipe` — CookScreen.tsx: een veeg die daadwerkelijk van stap wisselt.
- `cookMode` — CookScreen.tsx: "Begin" getikt.
- `timer` — src/timers.ts `startTimer(opts)` (één per gestarte timer).
- `planCook` — src/cooklog.ts `recordCooked` én CookScreen.onCooked: als `markRecipeCookedInPlan` `true` gaf.
- `listMade` — ShoppingScreen.tsx: alleen "Maak de lijst" (`shop.make` → `build(true)`), na een geslaagde
  `generateList`; niet "Bijwerken" (`build(false)`) en niet "Bevestig lijst" (besluit kritische lezer).
- `surprise` — elke knop die de app een gerecht laat kiezen: in `src/components/TonightCard.tsx` (Home A+)
  "🎲 Nog een" (`home.reroll`) en in WeekScreen.tsx `surpriseFill`, `surpriseUnlocked` en `reroll` (🎲 per
  slot). Niet "🎲 Iets anders" (dat bladert door het eigen weekplan).
- `dictEdit` — eigen ingrediënt bewaard of een regel gekoppeld vanuit de UI: `saveUserIngredient` in
  src/components/IngredientPicker.tsx (r. 202) en DictionaryScreen.tsx (r. 451); `setLineOverride` /
  `linkUserRecipeLine` in src/components/LineView.tsx `onPick` (r. 210–211). LineView.tsx staat bij
  Bouwer B (§3b).
- `variant` — RecipeScreen.tsx: een dieetversie bewaard (13D: goedgekeurd).
- `planShared` — WeekScreen.tsx `onShare`: tekstroute `shareText` outcome 'shared' én bestandsroute
  `shareJsonFile` outcome 'shared' of 'downloaded'; `listShared` — ShoppingScreen.tsx overal waar
  `markListShared` wordt aangeroepen (`doShare` met 'shared'/'no-share-api' en `doCopy`); `deltaShared` —
  DeltaShareScreen.tsx naast `bumpSharedRecipes(n)`; `cardShared` — ProfilesScreen.tsx MemberCardPanel
  outcome 'shared' of na "Kopieer link".
- `feedback` — MoreScreen.tsx: feedback `shareText` outcome 'shared' of 'no-share-api'.
- (Overcooked! is geen feature-event; zie de regelsoort `overcooked` in §2b.)

Niet vastgelegd (bewust): zoeken, bladeren, openen van schermen (behalve Het verhaal): nooit XP voor kijken.

`BadgeFacts` wordt (additief; `photos: number` blijft bestaan = `photoRows.length`):

```ts
export interface BadgeFacts {
  log: CookLogEntry[];                     // al gefilterd op lid; alles voor 'all'
  recipes: ReadonlyMap<string, Recipe>;
  classicsTotal: number;
  categoriesTotal: number;                 // data/categories.json length
  ownRecipes: number; received: number; shared: number;   // huishouden-breed, zoals nu
  photos: number;
  photoRows: ReadonlyArray<PhotoRow>;      // gefilterd op lid; alles voor 'all'
  features: Record<string, number>;        // featureCounts(log, memberId)
  householdMembers: number;                // membersFrom(profiles, household).length
  donorLevel: number;                      // setting 'donate.hearts'[memberId] ?? 0; 'all' = max
  /** XP-stand van dit lid (xp-levels.md), voor de regelsoort 'overcooked'; undefined op 'all'. */
  xp?: XpState;
}
/** Lokaal structureel type (geen import uit src/db in het domein); src/badges.ts vult het uit Photo-rijen. */
export interface PhotoRow { recipeId: string; memberId: string; at: string }
```

`buildFacts` in src/badges.ts leest daarvoor extra: `listAllPhotoMeta()` (nieuw in repo.ts, alleen
recipeId/memberId/at, geen blobs), `getSetting('features.log')`, `getHousehold()` + `profiles.value`,
`getSetting('donate.hearts', {})` en voor een lid `xpStateFor(memberId)` (src/xp.ts; niet op 'all').

### 2d. De catalogus (data/badges.json)

Vorm per regel hieronder: `id · groep · icoon · regel [drempels] · NL-naam / EN-naam · NL-omschrijving /
EN-omschrijving · extra`. In het JSON-bestand krijgt elke badge de velden `id, nl, en, icon, rule, group` en
waar genoemd `tiers, hidden, season, unlock, xp, retired, replacedBy`; het bestaande `tier` (1–3) mag blijven
staan. Een `{n}` in de omschrijving is letterlijk zo in de data (de UI vult de volgende drempel in).
Drempelreeksen (precies 8, in de data voluit):

- COOK = 5 · 10 · 25 · 50 · 100 · 250 · 500 · 1000 — DISTINCT = 3 · 10 · 25 · 50 · 75 · 100 · 150 · 200
- CAT = ING = TAG = WEEKDAY = 3 · 10 · 25 · 50 · 100 · 200 · 350 · 500 — OWN = 2 · 5 · 10 · 15 · 25 · 50 · 100 · 150
- REVIEWS = 5 · 10 · 25 · 50 · 100 · 250 · 500 · 1000 — SHARE = FEAT = 1 · 5 · 10 · 25 · 50 · 100 · 250 · 500
- CUISINE = 1 · 3 · 5 · 10 · 20 · 35 · 50 · 100 — CUISINES = 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16
- SEASON = 1 · 3 · 5 · 10 · 15 · 25 · 40 · 60 — HOLIDAY = 1 · 2 · 3 · 5 · 8 · 12 · 16 · 20
- PHOTO = 3 · 10 · 25 · 50 · 100 · 250 · 500 · 1000 — PHOTOREC = 3 · 10 · 25 · 50 · 100 · 150 · 200 · 250
- WEEKS = 2 · 4 · 8 · 12 · 26 · 52 · 104 · 208 — DAYS = 3 · 7 · 14 · 30 · 60 · 100 · 200 · 365
- FULLWEEKS = 1 · 3 · 5 · 10 · 25 · 52 · 100 · 200 — SURPRISE = 1 · 5 · 10 · 25 · 50 · 100 · 200 · 365
- VARIANT = 1 · 3 · 5 · 10 · 25 · 50 · 100 · 200

Bestaande 44 (43 + `zuivelvrije-ziel` uit 6B): ids blijven; 6 worden `retired` (hun telling leeft voort
in de ladder die ze vervangt), de rest krijgt `group` en waar een familie was `tiers`. Icoonwijzigingen bij
bestaande badges staan erbij. `zuivelvrije-ziel` (6B: eenmalig `tag lactosevrij n 5`, 🥥) wordt hier onder
hetzelfde id de ladder "tag lactosevrij [TAG]"; een registratie `zuivelvrije-ziel` in `badges.earned` geldt
als niveau 1 bekend.

**Koken (koken) — 33**
- eerste-hap · 🍳 · cookCount n 1 · Eerste hap / First bite · Kook je eerste gerecht / Cook your first dish
- huiskok · 🍲 · cookCount [COOK] · Huiskok / Home cook · Kook {n} keer / Cook {n} times ·
  unlock {part: hat-pan, tier: 5} (naam ongewijzigd)
- keukenbaas · retired, replacedBy huiskok (was cookCount 50) — chef-kok · retired, replacedBy huiskok (200)
- sterrenregen · 🌟 · reviews [REVIEWS] · Sterrenregen / Star shower · Beoordeel {n} kookbeurten met sterren /
  Rate {n} cooks with stars · unlock {part: eyes-star, tier: 4}
- vijfsterrenkok · 🌠 · fiveStar [REVIEWS] · Vijfsterrenkok / Five-star cook · Geef {n} keer vijf sterren /
  Give five stars {n} times
- kritische-tong · 😖 (was 🍋) · oneStar n 5 · Kritische tong / Critical tongue · Geef 5 gerechten één ster /
  Give 5 dishes a single star
- eigen-inbreng · ✍️ · ownRecipes n 1 · Eigen inbreng / Own creation · Voeg je eerste eigen recept toe /
  Add your first recipe of your own
- receptenschrijver · 📝 · ownRecipes [OWN] · Receptenschrijver / Recipe writer · Voeg {n} eigen recepten toe /
  Add {n} recipes of your own — kookboekauteur · retired, replacedBy receptenschrijver (was 15)
- alleskunner · 🎯 · allCategories · Alleskunner / All-rounder · Kook uit elke categorie minstens één gerecht /
  Cook at least one dish from every category
- stap-voor-stap · 👩‍🍳 · feature cookMode [FEAT] · Stap voor stap / Step by step · Kook {n} keer met de
  kookstand / Cook {n} times in cook mode
- timerbaas · ⏲️ · feature timer [FEAT] · Timerbaas / Timer boss · Zet {n} timers / Set {n} timers
- volgens-plan · 📅 · feature planCook [FEAT] · Volgens plan / According to plan · Kook {n} gerechten uit je
  weekplan / Cook {n} dishes from your week plan
- boodschapper · 🛒 · feature listMade [FEAT] · Boodschapper / Shopper · Maak {n} boodschappenlijsten /
  Make {n} shopping lists
- kindervriend · 🧒 · tag kids [TAG] · Kindervriend / Kids' favourite · Kook {n} kindvriendelijke gerechten /
  Cook {n} kid-friendly dishes
- zuivelvrije-ziel · 🥥 · tag lactosevrij [TAG] · Zuivelvrije ziel / Dairy-free soul · Kook {n} lactosevrije
  gerechten / Cook {n} lactose-free dishes · (id en naam uit 6B; was daar eenmalig n 5, wordt hier een ladder)
- fishlover · 🐟 · category vis [CAT] · Fishlover / Fishlover · Kook {n} visgerechten / Cook {n} fish dishes ·
  unlock {part: body-apron-fish, tier: 3}
- pastafarian · 🍝 · category pasta [CAT] · Pastafarian / Pastafarian · Kook {n} pastagerechten /
  Cook {n} pasta dishes · unlock {part: hair-spaghetti, tier: 3}
- souperheld · 🍜 · category soep [CAT] · Souperheld / Souper hero · Kook {n} soepen / Cook {n} soups
- bladgoud · 🥗 · category salade [CAT] · Bladgoud / Lettuce celebrate · Kook {n} salades / Cook {n} salads
- korrelkenner · 🍚 · category rijst [CAT] · Korrelkenner / Grain brain · Kook {n} rijstgerechten /
  Cook {n} rice dishes
- noedelninja · 🥢 · category wok-noedels [CAT] · Noedelninja / Noodle ninja · Kook {n} wok- of
  noedelgerechten / Cook {n} wok or noodle dishes
- stamppotstamper · 🥔 · category stamppot [CAT] · Stamppotstamper / Mash master · Kook {n} stamppotten /
  Cook {n} stamppot dishes
- carnivoor · 🥩 · category vlees [CAT] · Carnivoor / Carnivore · Kook {n} vleesgerechten / Cook {n} meat dishes
- taartenbakker · 🥧 · category hartige-taart [CAT] · Taartenbakker / Pie maker · Kook {n} hartige taarten /
  Cook {n} savoury pies
- zoete-tand · 🍰 · category gebak [CAT] · Zoete tand / Sweet tooth · Bak {n} keer gebak / Bake {n} cakes or
  bakes · AANNAME 13E-id `gebak`
- toetjestovenaar · 🍮 · category nagerecht [CAT] · Toetjestovenaar / Pudding wizard · Maak {n} nagerechten /
  Make {n} desserts · AANNAME 13E-id `nagerecht`
- bijzaak · 🥖 · category bijgerecht [CAT] · Bijzaak / Side show · Maak {n} bijgerechten / Make {n} side
  dishes · AANNAME 13E-id `bijgerecht`
- vroege-vogel · 🥐 · category ontbijt-lunch [CAT] · Vroege vogel / Early bird · Maak {n} ontbijt- of
  lunchgerechten / Make {n} breakfast or lunch dishes · AANNAME 13E-id `ontbijt-lunch`
- wokmeester · 🥘 · tag wok [TAG] · Wokmeester / Wok master · Kook {n} wokgerechten / Cook {n} wok dishes
- oventovenaar · 🧙 · tag oven [TAG] · Oventovenaar / Oven wizard · Kook {n} ovengerechten / Cook {n} oven dishes
- groenteheld · 🥬 (was 🥦) · tag vegetarisch [TAG] · Groenteheld / Veggie hero · Kook {n} vegetarische
  gerechten / Cook {n} vegetarian dishes
- plantaardige-pionier · 🌱 · tag vegan [TAG] · Plantaardige pionier / Plant pioneer · Kook {n} veganistische
  gerechten / Cook {n} vegan dishes
- glutenvrijbuiter · 🌾 · tag glutenvrij [TAG] · Glutenvrijbuiter / Gluten-free spirit · Kook {n} glutenvrije
  gerechten / Cook {n} gluten-free dishes
- snelle-jelle · ⚡ · tag snel [TAG] · Snelle Jelle / Speedy chef · Kook {n} snelle gerechten /
  Cook {n} quick dishes

**Ontdekken (ontdekken) — 31**
- ontdekkingsreiziger · 🧭 · distinctRecipes [DISTINCT] · Ontdekkingsreiziger / Explorer · Kook {n}
  verschillende recepten / Cook {n} different recipes · unlock {part: mouth-tongue, tier: 3}
- proever · retired, replacedBy ontdekkingsreiziger (was 10) — culinaire-avonturier · retired, idem (was 100)
- van-a-tot-z · 🅰️ (was 🔤) · letters · Van A tot Z / A to Z · (omschrijving ongewijzigd)
- boekenlegger · 🔖 · classics [3·10·25·50·75·100·125·150] · Boekenlegger / Bookmark · Kook {n} verschillende
  klassiekers / Cook {n} different classics
- halverwege-het-boek · 📖 · halfClassics · (ongewijzigd) — het-hele-boek · 📚 · allClassics · (ongewijzigd) ·
  unlock {part: pin-medal-gold}
- verras-me · 🎲 · feature surprise [SURPRISE] · Verras me / Surprise me · Laat de app {n} keer een gerecht
  kiezen / Let the app pick a dish {n} times
- woordenboekpuzzelaar · 📘 · feature dictEdit [FEAT] · Woordenboekpuzzelaar / Dictionary puzzler · Voeg {n}
  eigen ingrediënten toe of koppel ze / Add or link {n} ingredients of your own
- omdenker · 🔀 · feature variant [VARIANT] · Omdenker / Switcheroo · Maak {n} glutenvrije, vegan of
  vegetarische versies / Make {n} gluten-free, vegan or vegetarian versions
- saffraankenner 🌸 · ansjovisfan 🐠 · kappertjeskenner 🫒 · citroengrasfluisteraar 🌿 — alle vier ongewijzigd
  (eenmalig, ingredient n 3/3/5/3), group ontdekken
- knoflookkoning · 🧄 · ingredient knoflook [ING] · Knoflookkoning / Garlic king · Kook {n} gerechten met
  knoflook / Cook {n} dishes with garlic
- uienhuiler · 🧅 · ingredient ui [ING] · Uienhuiler / Onion weeper · Kook {n} gerechten met ui /
  Cook {n} dishes with onion
- kaaskop · 🧀 · ingredient kaas [ING] · Kaaskop / Cheesehead · Kook {n} gerechten met kaas /
  Cook {n} dishes with cheese · unlock {part: hat-cheese, tier: 3}
- botervlieg · 🧈 · ingredient boter [ING] · Botervlieg / Butterfly · Kook {n} gerechten met boter /
  Cook {n} dishes with butter
- eierkoning · 🥚 · ingredient ei [ING] · Eierkoning / Egg master · Kook {n} gerechten met ei /
  Cook {n} dishes with egg
- vuurspuwer · 🌶️ · ingredient rode-peper [ING] · Vuurspuwer / Fire breather · Kook {n} gerechten met rode
  peper / Cook {n} dishes with red chilli · unlock {part: facial-moustache-chili, tier: 2}
- gembergek · 🫚 · ingredient gember [ING] · Gembergek / Ginger nut · Kook {n} gerechten met gember /
  Cook {n} dishes with ginger
- zuurpruim · 🍋 · ingredient citroen [ING] · Zuurpruim / Sourpuss · Kook {n} gerechten met citroen /
  Cook {n} dishes with lemon · unlock {part: glasses-lemon, tier: 2}
- paprikapaus · 🫑 · ingredient paprika [ING] · Paprikapaus / Pepper pope · Kook {n} gerechten met paprika /
  Cook {n} dishes with peppers
- spekkie · 🥓 · ingredient spekblokjes [ING] · Spekkie / Bacon bit · Kook {n} gerechten met spek /
  Cook {n} dishes with bacon
- paddenstoelplukker · 🍄 · ingredient champignon [ING] · Paddenstoelplukker / Mushroom forager · Kook {n}
  gerechten met champignons / Cook {n} dishes with mushrooms
- kippenhok · 🍗 · ingredient kipfilet [ING] · Kippenhok / Chicken coop · Kook {n} gerechten met kipfilet /
  Cook {n} dishes with chicken breast
- aubergineknuffel · 🍆 · ingredient aubergine [ING] · Aubergineknuffel / Aubergine hug · Kook {n} gerechten
  met aubergine / Cook {n} dishes with aubergine · unlock {part: prop-aubergine, tier: 2}
- broccolibaas · 🥦 · ingredient broccoli [ING] · Broccolibaas / Broccoli boss · Kook {n} gerechten met
  broccoli / Cook {n} dishes with broccoli · unlock {part: hair-broccoli, tier: 2}
- wortelwijsneus · 🥕 · ingredient wortel [ING] · Wortelwijsneus / Carrot clever-clogs · Kook {n} gerechten met
  wortel / Cook {n} dishes with carrot · unlock {part: prop-carrot-ear, tier: 2}
- spinaziespier · 🍃 · ingredient spinazie [ING] · Spinaziespier / Spinach muscle · Kook {n} gerechten met
  spinazie / Cook {n} dishes with spinach
- tomatentijd · 🍅 · ingredient tomaat [ING] · Tomatentijd / Tomato time · Kook {n} gerechten met tomaat /
  Cook {n} dishes with tomato
- wijnkok · 🍷 · ingredient wijn [ING] · Wijnkok / Wine cook · Kook {n} gerechten met wijn /
  Cook {n} dishes with wine · unlock {part: prop-wine, tier: 3}
- korianderkamp · 🪴 · ingredient koriander [ING] · Korianderkamp / Team coriander · Kook {n} gerechten met
  koriander / Cook {n} dishes with coriander

**Keukens van de wereld (keukens) — 18.** AANNAME: de cuisine-ids komen uit de labels-spec (6B.2,
data/cuisines.json); hieronder de 16 die deze spec verwacht. Wijkt de labels-spec af, dan volgt de catalogus
de labels-spec (ids aanpassen, namen houden). Alle 16 zijn ladders `cuisine {id} [CUISINE]`, omschrijving
"Kook {n} <bijvoeglijk> gerechten" / "Cook {n} <adjective> dishes".
- wereldreiziger · 🌍 · tag wereld [TAG] · Wereldreiziger / Globetrotter · Kook {n} wereldgerechten /
  Cook {n} world dishes
- wereldburger · 🌐 · cuisines [CUISINES] · Wereldburger / Citizen of the world · Kook uit {n} verschillende
  keukens / Cook from {n} different cuisines · unlock {part: pin-globe, tier: 4}
- hollandse-pot · 🌷 · hollands · Hollandse pot / Dutch pot · Hollandse / Dutch
- mamma-mia · 🍕 · italiaans · Mamma mia / Mamma mia · Italiaanse / Italian
- bon-appetit · 🥐 · frans · Bon appétit / Bon appétit · Franse / French · unlock {part: prop-baguette, tier: 2}
- ole · 💃 · spaans · ¡Olé! / ¡Olé! · Spaanse / Spanish
- opa · 🏛️ · grieks · Opa! / Opa! · Griekse / Greek
- duizend-en-een · 🧆 · midden-oosten · Duizend-en-één / Thousand and one · Midden-Oosterse / Middle Eastern
- tajinetijd · 🏺 · marokkaans · Tajinetijd / Tagine time · Marokkaanse / Moroccan
- kruidenkoning · 🍛 · indiaas · Kruidenkoning / Spice king · Indiase / Indian
- thaise-tinteling · 🥭 · thais · Thaise tinteling / Thai tingle · Thaise / Thai
- chopstick-chef · 🥡 · chinees · Chopstick-chef / Chopstick chef · Chinese / Chinese
- umami · 🍣 · japans · Umami / Umami · Japanse / Japanese
- rijsttafel · 🍢 · indonesisch · Rijsttafel / Rijsttafel · Indonesische / Indonesian
- switi · 🌴 · surinaams · Switi / Switi · Surinaamse / Surinamese
- arriba · 🌮 · mexicaans · ¡Arriba! / ¡Arriba! · Mexicaanse / Mexican
- stars-and-stripes · 🍔 · amerikaans · Stars & stripes / Stars & stripes · Amerikaanse / American
- cuppa · ☕ · brits · Cuppa / Cuppa · Britse / British

**Seizoenen (seizoenen) — 13.** `seasonCooks` leest `badge.season`.
- zomerkok · ☀️ · tag zomer [TAG] · Zomerkok / Summer sizzler · Kook {n} zomergerechten / Cook {n} summer
  dishes · unlock {part: hat-strawhat, tier: 2}
- winterwarmer · ❄️ · tag winter [TAG] · Winterwarmer / Winter warmer · Kook {n} wintergerechten /
  Cook {n} winter dishes
- feestbeest · 🎉 · tag feest [TAG] · Feestbeest / Party animal · Kook {n} feestgerechten / Cook {n} festive
  dishes · unlock {part: hat-party, tier: 2}
- lentekriebels · 🌼 · seasonCooks [SEASON] season 03-20..06-20 · Lentekriebels / Spring fever · Kook {n}
  keer in de lente / Cook {n} times in spring
- zomeravond · 🏖️ · seasonCooks [SEASON] 06-21..09-22 · Zomeravond / Summer evening · Kook {n} keer in de
  zomer / Cook {n} times in summer
- herfstpot · 🍂 · seasonCooks [SEASON] 09-23..12-20 · Herfstpot / Autumn pot · Kook {n} keer in de herfst /
  Cook {n} times in autumn
- winterkost · ☃️ · seasonCooks [SEASON] 12-21..03-19 · Winterkost / Winter fare · Kook {n} keer in de
  winter / Cook {n} times in winter
- kerstkok · 🎄 · seasonCooks [HOLIDAY] 12-24..12-26 · Kerstkok / Christmas cook · Kook {n} keer met kerst /
  Cook {n} times at Christmas · unlock {part: hat-santa, tier: 1}
- oud-en-nieuw · 🎆 · seasonCooks [HOLIDAY] 12-31..01-01 · Oud en nieuw / New Year · Kook {n} keer rond de
  jaarwisseling / Cook {n} times at New Year
- sinterklaas · 🎁 · seasonCooks [HOLIDAY] 12-05..12-05 · Sinterklaas / Sinterklaas · Kook {n} keer op
  pakjesavond / Cook {n} times on 5 December
- koningsdag · 🧡 · seasonCooks [HOLIDAY] 04-27..04-27 · Koningsdag / King's Day · Kook {n} keer op Koningsdag /
  Cook {n} times on King's Day
- valentijn · 💘 · seasonCooks [HOLIDAY] 02-14..02-14 · Valentijn / Valentine · Kook {n} keer op
  Valentijnsdag / Cook {n} times on Valentine's Day
- halloween · 🎃 · seasonCooks [HOLIDAY] 10-31..10-31 · Halloween / Halloween · Kook {n} keer met Halloween /
  Cook {n} times at Halloween

**Samen & delen (samen) — 11**
- gulle-gever · 🤲 (was 🎁) · shared [SHARE] · Gulle gever / Generous giver · Deel {n} recepten / Share {n} recipes
- verzamelaar · 📬 · received [SHARE] · Verzamelaar / Collector · Ontvang {n} recepten / Receive {n} recipes
- weekplanner · 🗓️ · feature planShared [SHARE] · Weekplanner / Week planner · Deel {n} weekplannen /
  Share {n} week plans
- lijstjesdeler · 🧾 · feature listShared [SHARE] · Lijstjesdeler / List sharer · Deel {n} boodschappenlijsten /
  Share {n} shopping lists
- postbode · 📨 · feature deltaShared [SHARE] · Postbode / Postie · Stuur {n} keer je nieuwe recepten /
  Send your new recipes {n} times
- visitekaartje · 🪪 · feature cardShared n 1 · Visitekaartje / Calling card · Deel je ledenkaartje /
  Share your member card
- huisgenoten · 🏠 · householdMembers n 2 · Huisgenoten / Housemates · Je huishouden heeft twee leden /
  Your household has two members
- volle-tafel · 🍽️ · householdMembers n 4 · Volle tafel / Full table · Je huishouden heeft vier leden /
  Your household has four members
- samen-in-de-keuken · 👫 · cooks n 2 · Samen in de keuken / Together in the kitchen · Twee leden kookten /
  Two members cooked
- zeg-het-maar · 💬 · feature feedback n 1 · Zeg het maar / Have your say · Stuur Stijn feedback /
  Send Stijn feedback
- hartje · ❤️ · donor n 1 · Hartje / Little heart · Je steunde dit project. Dank je! / You supported this
  project. Thank you! · hidden, xp 0, unlock {part: pin-heart}. Mechanisme: §5c (nog niet te verdienen).

**Fotografie (foto) — 4**
- eerste-kiekje · 📷 · photos n 1 · (ongewijzigd) — foodfotograaf · 📸 · photos [PHOTO] · Foodfotograaf /
  Food photographer · Voeg {n} foto's toe / Add {n} photos · unlock {part: prop-camera, tier: 3}
- fotoalbum · 🖼️ · photoRecipes [PHOTOREC] · Fotoalbum / Photo album · Fotografeer {n} verschillende
  gerechten / Photograph {n} different dishes
- fotogeniek · 🤳 · photosOfOneRecipe n 5 · Fotogeniek / Photogenic · Vijf foto's van hetzelfde gerecht /
  Five photos of the same dish

**Reeksen (reeksen) — 6**
- op-dreef · 🔥 · streakWeeks [WEEKS] · Op dreef / On a roll · Kook {n} weken op rij / Cook {n} weeks in a
  row · unlock {part: hair-flame, tier: 4} — vaste-prik · retired, replacedBy op-dreef (was 12)
- dagelijkse-kost · 📆 · streakDays [DAYS] · Dagelijkse kost / Daily bread · Kook {n} dagen op rij (één dag
  per week overslaan mag) / Cook {n} days in a row (you may skip one day a week)
- volle-week · 7️⃣ · fullWeeks [FULLWEEKS] · Volle week / Full week · Kook {n} weken alle zeven dagen /
  Cook all seven days in {n} weeks
- weekendkok · 🛋️ · weekdayCooks days [6,0] [WEEKDAY] · Weekendkok / Weekend cook · Kook {n} keer in het
  weekend / Cook {n} times at the weekend
- maandagmoed · 💪 · weekdayCooks days [1] [WEEKDAY] · Maandagmoed / Monday courage · Kook {n} keer op
  maandag / Cook {n} times on a Monday
- doordeweeks · 🏃 · weekdayCooks days [1,2,3,4,5] [WEEKDAY] · Doordeweeks / Weeknight warrior · Kook {n}
  keer op een doordeweekse dag / Cook {n} times on a weekday

**Geheim (geheim) — 28, alle `hidden: true`.** App-ontdekkers (20): `feature <id> n 1`, `xp: 100`.
- stemkok · 🎙️ · voice · Stemkok / Voice chef · Gebruik je eerste spraakcommando / Use your first voice command
- op-papier · 🖨️ · print · Op papier / On paper · Print een recept of ingrediëntenlijst / Print a recipe or
  ingredient list
- qr-tovenaar · 🔳 · qrShown · QR-tovenaar / QR wizard · Toon een QR-code / Show a QR code
- van-kleur-verschoten · 🌗 · theme · Van kleur verschoten / Changed colours · Wissel van thema / Switch theme
- weegschaal · ⚖️ · amounts · Weegschaal / Kitchen scales · Klap de hoeveelheden uit in de kookstand /
  Show the amounts in cook mode
- voorlezer · 🔊 · readAloud · Voorlezer / Narrator · Laat een stap voorlezen / Have a step read aloud
- taalknobbel · 🔤 · langToggle · Taalknobbel / Polyglot · Wissel de taal van de app / Switch the app's language
- graden · 🌡️ · fahrenheit · Graden / Degrees · Zet Fahrenheit aan of uit / Switch Fahrenheit on or off
- plakker · 📋 · pasteRecipe · Plakker / Paster · Plak een recept van een website / Paste a recipe from a
  website
- slimme-hulp · 🤖 · aiImport · Slimme hulp / Smart help · Plak een AI-antwoord in de app / Paste an AI answer
  into the app
- veilig-gesteld · 💾 · backup · Veilig gesteld / Safe and sound · Maak een back-up / Make a backup
- terug-van-weggeweest · ♻️ · restore · Terug van weggeweest / Back again · Zet een back-up terug /
  Restore a backup
- het-verhaal · 📜 · story · Het verhaal / The story · Lees Het verhaal / Read The story
- kies-7 · 🎰 · pick7 · Kies 7 / Pick 7 · Laat de app een hele week kiezen / Let the app pick a whole week
- voorraadkast · 🧺 · pantry · Voorraadkast / Pantry · Zet iets op Heb ik al / Mark something as Already have it
- woordpikker · 🔠 · wordPicker · Woordpikker / Word picker · Tik woorden weg bij een ?-chip / Tap words away
  on a ?-chip
- rekenwonder · 📐 · scaled · Rekenwonder / Number cruncher · Pas de porties van een recept aan / Change a
  recipe's servings
- vaste-klant · 📌 · standingList · Vaste klant / Regular · Zet iets op de vaste lijst / Put something on Every
  week · (6C; pas opnemen als 6C online is)
- sorteerder · ↕️ · sort · Sorteerder / Sorter · Sorteer de receptenlijst anders dan A–Z / Sort the recipe list
  other than A–Z
- veger · 👆 · cookSwipe · Veger / Swiper · Veeg in de kookstand naar de volgende stap / Swipe to the next
  step in cook mode

Gekke geheime (8), standaard-XP 250 (geen `xp`-veld):
- nachtbraker · 🦉 · cookHour from 0 to 4 n 1 · Nachtbraker / Night owl · Kook tussen middernacht en vijf
  uur 's nachts / Cook between midnight and five in the morning · unlock {part: eyes-sleepy}
- ochtendgloren · 🌅 · cookHour from 5 to 7 n 1 · Ochtendgloren / Crack of dawn · Kook tussen vijf en acht
  uur 's ochtends / Cook between five and eight in the morning
- drie-op-een-rij · 🔁 · sameRecipeDays n 3 · Drie op een rij / Three in a row · Kook drie dagen achter
  elkaar hetzelfde recept / Cook the same recipe three days running
- overcooked · 💥 · overcooked n 1 (regelsoort uit `facts.xp`, §2b) · Overcooked! / Overcooked! · Gooi een
  Overcooked! (vijf keer zoveel XP) / Roll an Overcooked! (five times the XP)
- vrijdag-de-13e · 🐈‍⬛ · calendar friday-13 n 1 · Vrijdag de 13e / Friday the 13th · Kook op vrijdag de 13e /
  Cook on Friday the 13th
- schrikkelkok · 🐸 · calendar leap-day n 1 · Schrikkelkok / Leap cook · Kook op 29 februari / Cook on 29
  February
- tweede-kans · 🔄 · retryAfterOneStar n 1 · Tweede kans / Second chance · Kook een gerecht opnieuw dat je één
  ster gaf / Cook a dish again that you gave one star
- oude-liefde · 💌 · comeback days 365 n 1 · Oude liefde / Old flame · Kook een gerecht opnieuw na meer dan
  een jaar / Cook a dish again after more than a year

Telling: 115 zichtbaar + 29 verborgen (28 in Geheim + het hartje) = **144 badges**, plus 6 retired = 150
regels in het bestand. Op het
moment van bouwen laat Opus de AANNAME-badges weg waarvan de id nog niet bestaat (validator-fout), en meldt
dat in het rapport; ze komen erbij zodra 6B/13E/6C online zijn.

### 2e. Validator (tools/validate-data.ts `validateBadges`)

Fouten (errors): `group` ontbreekt of niet in BADGE_GROUPS · `tiers` aanwezig maar niet precies 8 strikt
stijgende gehele getallen ≥ 1 · `tiers` én `rule.n` allebei (of geen van beide) bij een telsoort ·
`tiers` bij een plain-soort (letters, allClassics, halfClassics, allCategories) · een ladder waarvan
nl.description of en.description géén `{n}` bevat, of een eenmalige badge die wél `{n}` bevat · `group ===
'geheim'` zonder `hidden: true` · `season` zonder `kind: 'seasonCooks'` of andersom; `from`/`to` niet
`MM-DD` met geldige maand/dag · `unlock.part` niet in data/avatar-parts.json (de validator leest dat
bestand mee, zoals hij de dictionary meeleest) · `unlock.tier` ontbreekt bij een ladder, aanwezig bij een
eenmalige, of buiten 1..8 · twee badges met dezelfde `unlock.part` · `xp` geen geheel getal ≥ 0, of `xp`
op een ladder · `retired` zonder `replacedBy`, of `replacedBy` wijst niet naar een bestaande, niet-retired
badge · `cuisine`-id niet in data/cuisines.json (alleen als dat bestand bestaat; anders een warning) ·
`feature`-id niet in FEATURE_IDS · `weekdayCooks.days` leeg of buiten 0..6 · `cookHour` from/to buiten
0..23 of from > to · `calendar.when` onbekend · `comeback.days` < 1.
Waarschuwingen: een ladder-cuisine/tag/ingredient waarvan de id in 0 klassiekers voorkomt (nooit te halen
zonder eigen recepten) · meer dan 150 badges.
De bestaande fouten (id-slug, dubbel id, nl/en, icon, rule.kind, n ≥ 1, ref-ids) blijven.

### 2f. Avatar: datamodel en bibliotheek

```ts
// src/domain/avatar.ts (framework-vrij)
export type AvatarLayer = 'bg' | 'body' | 'pin' | 'face' | 'facial' | 'mouth' | 'eyes' | 'hair' | 'glasses'
  | 'hat' | 'prop';
/** Tekenvolgorde van onder naar boven. */
export const LAYER_ORDER: readonly AvatarLayer[] = ['bg','body','pin','face','facial','mouth','eyes','hair',
  'glasses','hat','prop'];
/** Lagen die een avatar MOET hebben; de rest mag leeg. */
export const REQUIRED_LAYERS: readonly AvatarLayer[] = ['face', 'eyes', 'mouth', 'body'];

export interface AvatarSpec {
  v: 1;
  /** Onderdeel-ids, hoogstens één per laag; onbekende ids worden bij het tekenen overgeslagen. */
  parts: string[];
  /** Huidskleur uit AVATAR_TONES; standaard AVATAR_TONES[1]. */
  tone?: string;
  /** Haarkleur uit AVATAR_HAIR; standaard AVATAR_HAIR[0]. */
  hair?: string;
}

export type AvatarUnlock = { level: number } | { badge: string };

export interface AvatarPart {
  id: string;                 // '<laag>-<naam>', kebab-case
  layer: AvatarLayer;
  nl: string; en: string;     // korte naam voor de maker en de toast
  unlock: AvatarUnlock;       // level N, of de badge die hem geeft (die badge heeft `unlock.part` = deze id)
  /** SVG-fragment binnen viewBox 0 0 100 100; mag `var(--tone)`/`var(--hair)` gebruiken en `__u` als
   *  uniek-suffix voor ids (de renderer vervangt het). Leeg = tekent niets (bg-color). */
  svg: string;
}

export const AVATAR_TONES = ['#f7dcc4', '#f3d2b3', '#e0b08a', '#c68a5a', '#9c6a45', '#6b4530'] as const;
export const AVATAR_HAIR = ['#4a2c17', '#1e1a19', '#8a5a2b', '#d9a85c', '#b23a2a', '#9a9a9a', '#7a3d8a',
  '#2b6fd6'] as const;
/** Vanaf dit level opent de avatar-maker (na je eerste kookbeurt zit je op level 3, plan 6D-tabel). */
export const AVATAR_MAKER_LEVEL = 3;
// Afgestemd: data/unlocks.json (xp-levels.md §2e) zet `avatar-maker` ook op level 3. Open vraag 3 (3 of 5)
// blijft voor Stijn; wijzigt hij het, dan beide plekken.

export function normalizeAvatarParts(data: unknown): AvatarPart[];      // tolerant, zoals normalizeBadges
export function normalizeAvatarSpec(v: unknown): AvatarSpec | null;     // null = geen bruikbare avatar
export function isComplete(spec: AvatarSpec, parts: ReadonlyMap<string, AvatarPart>): boolean; // REQUIRED_LAYERS
export function isUnlocked(part: AvatarPart, ctx: { level: number; badgeTiers: ReadonlyMap<string, number> }): boolean;
/** Randkleur per level: null onder 5, daarna de 8 kleuren: 5–9 geel, 10–19 groen, 20–29 blauw,
 *  30–39 rood, 40–49 brons, 50–59 zilver, 60–79 goud, 80–100 platina. */
export function ringForLevel(level: number): (typeof TIER_COLOURS)[number] | null;
export function defaultAvatar(): AvatarSpec; // face-round, eyes-dots, mouth-smile, hair-short, body-tee
export function randomAvatar(unlocked: AvatarPart[], seed: number): AvatarSpec;
/** De hele SVG als string (geen framework): achtergrondcirkel in `color`, lagen geclipt, rand per level. */
export function renderAvatarSvg(spec: AvatarSpec, parts: ReadonlyMap<string, AvatarPart>,
  opts: { color: string; level: number; uid: string }): string;
```

`renderAvatarSvg` levert exact deze structuur (ids krijgen het `uid`-suffix):

```
<svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:…;--hair:…" aria-hidden="true">
  <defs><clipPath id="c-UID"><circle cx="50" cy="50" r="46"/></clipPath></defs>
  <circle cx="50" cy="50" r="46" fill="COLOR"/>
  <g clip-path="url(#c-UID)">…lagen in LAYER_ORDER…</g>
  <circle cx="50" cy="50" r="48" fill="none" stroke="RINGKLEUR" stroke-width="4"/>   ← alleen met rand
</svg>
```

**Profile** (src/domain/model.ts, additief): `avatar?: AvatarSpec | null`. **Member** (src/domain/
household.ts): `avatar?: AvatarSpec` (uit het kaartje). **MemberCard** (src/domain/share.ts): `avatar?:
AvatarSpec` — `cardFromMember` zet hem erin als het profiel er een heeft, `memberFromCard`/`readMemberPayload`
nemen hem over via `normalizeAvatarSpec` (ongeldig = weggelaten). De sync-link `#x=` van xp-levels.md draagt
dezelfde `AvatarSpec` onder de sleutel `avatar` (alleen ids: een avatar is ±120 bytes vóór compressie).

**data/avatar-parts.json** — een array van AvatarPart. Hieronder de volledige bibliotheek (66 onderdelen);
`L3` = unlock level 3, `B:id` = unlock door die badge. Body-basis (alle body-delen beginnen ermee):
`BODY = <path d="M14 100C14 80 30 72 50 72s36 8 36 28z" fill="…"/>`.

Gezicht (face; alle L3):
- face-round · Rond / Round · `<circle cx="50" cy="50" r="26" style="fill:var(--tone)"/>`
- face-oval · Ovaal / Oval · `<ellipse cx="50" cy="50" rx="23" ry="27" style="fill:var(--tone)"/>`
- face-square · Hoekig / Square · `<rect x="26" y="25" width="48" height="50" rx="14" style="fill:var(--tone)"/>`

Ogen (eyes):
- eyes-dots L3 · Stippen / Dots · `<circle cx="41" cy="47" r="2.6" fill="#222"/><circle cx="59" cy="47" r="2.6" fill="#222"/>`
- eyes-happy L3 · Blij / Happy · `<path d="M36 48q5-6 10 0M54 48q5-6 10 0" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`
- eyes-wink L5 · Knipoog / Wink · `<circle cx="41" cy="47" r="2.6" fill="#222"/><path d="M54 48q5-5 10 0" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`
- eyes-star B:sterrenregen · Sterrenogen / Starry eyes · `<path d="M41 42l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#e6b800"/><path d="M59 42l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#e6b800"/>`
- eyes-sleepy B:nachtbraker · Slaperig / Sleepy · `<path d="M36 47h10M54 47h10" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><text x="68" y="40" font-size="9" fill="#555">z</text>`

Mond (mouth):
- mouth-smile L3 · Glimlach / Smile · `<path d="M42 59q8 7 16 0" fill="none" stroke="#7a2e2e" stroke-width="2.4" stroke-linecap="round"/>`
- mouth-grin L3 · Grijns / Grin · `<path d="M40 58q10 10 20 0z" fill="#fff" stroke="#7a2e2e" stroke-width="2"/>`
- mouth-open L5 · Open / Open · `<ellipse cx="50" cy="61" rx="5" ry="6" fill="#7a2e2e"/>`
- mouth-tongue B:ontdekkingsreiziger · Tong / Tongue · `<path d="M41 58q9 9 18 0z" fill="#7a2e2e"/><ellipse cx="52" cy="63" rx="4" ry="3.5" fill="#e9707b"/>`
- mouth-whistle L8 · Fluitje / Whistle · `<circle cx="50" cy="60" r="3" fill="#7a2e2e"/><path d="M58 56q6-2 8-6" fill="none" stroke="#888" stroke-width="1.5" stroke-dasharray="2 2"/>`

Haar (hair; `var(--hair)` tenzij anders):
- hair-short L3 · Kort / Short · `<path d="M24 46q0-24 26-24t26 24q-8-12-26-12T24 46z" style="fill:var(--hair)"/>`
- hair-long L3 · Lang / Long · `<path d="M22 72V46q0-24 28-24t28 24v26h-9V50q-4-6-19-6t-19 6v22z" style="fill:var(--hair)"/>`
- hair-curly L4 · Krullen / Curls · `<g style="fill:var(--hair)"><circle cx="30" cy="36" r="8"/><circle cx="40" cy="28" r="8"/><circle cx="50" cy="25" r="8"/><circle cx="60" cy="28" r="8"/><circle cx="70" cy="36" r="8"/><circle cx="25" cy="46" r="6"/><circle cx="75" cy="46" r="6"/></g>`
- hair-bun L6 · Knotje / Bun · `<path d="M24 46q0-22 26-22t26 22q-8-10-26-10T24 46z" style="fill:var(--hair)"/><circle cx="50" cy="20" r="8" style="fill:var(--hair)"/>`
- hair-mohawk L12 · Hanenkam / Mohawk · `<path d="M44 30 50 6l6 24q-3-3-6-3t-6 3z" style="fill:var(--hair)"/><path d="M26 46q2-14 12-18l4 6q-8 2-10 12zM74 46q-2-14-12-18l-4 6q8 2 10 12z" style="fill:var(--hair)"/>`
- hair-broccoli B:broccolibaas · Broccolikapsel / Broccoli hair · `<g fill="#3d9a3a"><circle cx="34" cy="34" r="9"/><circle cx="50" cy="26" r="11"/><circle cx="66" cy="34" r="9"/><circle cx="42" cy="26" r="7"/><circle cx="58" cy="26" r="7"/></g><rect x="46" y="34" width="8" height="8" fill="#9bbd63"/>`
- hair-spaghetti B:pastafarian · Spaghettihaar / Spaghetti hair · `<g fill="none" stroke="#e8c979" stroke-width="3" stroke-linecap="round"><path d="M28 44q4-20 22-20t22 20"/><path d="M30 40q-6 10-8 24"/><path d="M70 40q6 10 8 24"/><path d="M38 28q-4 10-2 18"/><path d="M62 28q4 10 2 18"/></g><circle cx="50" cy="22" r="4" fill="#b23a2a"/>`
- hair-flame B:op-dreef · Vlammen / Flames · `<path d="M30 46q-2-18 10-24-2 8 4 10-2-10 8-16-2 10 6 12 0-8 6-10-2 10 6 16-2-6 2-10 6 10 0 22-8-8-26-8t-16 8z" fill="#f0742a"/><path d="M40 44q-2-10 6-14-1 6 4 8 0-6 6-8-1 6 4 10-10-4-20 4z" fill="#f8c33c"/>`

Baard & snor (facial):
- facial-stubble L5 · Stoppels / Stubble · `<path d="M30 54q4 20 20 20t20-20q-6 12-20 12T30 54z" fill="#222" opacity=".35"/>`
- facial-beard L7 · Volle baard / Full beard · `<path d="M28 50q2 26 22 26t22-26q-6 12-22 12T28 50z" style="fill:var(--hair)"/>`
- facial-moustache L6 · Snor / Moustache · `<path d="M50 56q-6-5-12 1 4 3 12 1 8 2 12-1-6-6-12-1z" style="fill:var(--hair)"/>`
- facial-moustache-chili B:vuurspuwer · Chilisnor / Chilli moustache · `<path d="M50 56q-6-6-13-1 4 5 13 2 9 3 13-2-7-5-13 1z" fill="#d9402b"/><path d="M50 55v-3" stroke="#3d9a3a" stroke-width="2"/>`

Bril (glasses):
- glasses-round L4 · Rond brilletje / Round glasses · `<g fill="none" stroke="#333" stroke-width="2"><circle cx="41" cy="47" r="7"/><circle cx="59" cy="47" r="7"/><path d="M48 47h4M34 46l-6-2M66 46l6-2"/></g>`
- glasses-sun L9 · Zonnebril / Sunglasses · `<g fill="#222"><rect x="33" y="42" width="15" height="11" rx="3"/><rect x="52" y="42" width="15" height="11" rx="3"/></g><path d="M48 46h4M33 45l-6-2M67 45l6-2" stroke="#222" stroke-width="2"/>`
- glasses-lemon B:zuurpruim · Citroenbril / Lemon glasses · `<g fill="#f3e13a" stroke="#c9a227" stroke-width="1.5"><ellipse cx="41" cy="47" rx="8" ry="6"/><ellipse cx="59" cy="47" rx="8" ry="6"/></g><path d="M49 47h2M33 47l-6-2M67 47l6-2" stroke="#333" stroke-width="2"/>`
- glasses-monocle L30 · Monocle / Monocle · `<circle cx="59" cy="47" r="7" fill="none" stroke="#c9a227" stroke-width="2"/><path d="M63 53q6 8 4 16" fill="none" stroke="#c9a227" stroke-width="1.5"/>`

Hoofddeksel (hat):
- hat-dino L3 · T-rex-kop / T-rex head · `<path d="M22 46q0-26 28-26t28 26q-8-10-28-10T22 46z" fill="#3d9a3a"/><path d="M34 26l4-10 4 10M46 22l4-12 4 12M58 26l4-10 4 10" fill="#2f7a2e"/><circle cx="36" cy="38" r="3" fill="#fff"/><circle cx="64" cy="38" r="3" fill="#fff"/><circle cx="36" cy="38" r="1.5" fill="#222"/><circle cx="64" cy="38" r="1.5" fill="#222"/>`
- hat-bandana L5 · Bandana / Bandana · `<path d="M24 42q0-18 26-18t26 18q-8-6-26-6t-26 6z" fill="#d9402b"/><path d="M74 40l12-6-4 12z" fill="#d9402b"/><g fill="#fff" opacity=".7"><circle cx="38" cy="32" r="1.5"/><circle cx="50" cy="28" r="1.5"/><circle cx="62" cy="32" r="1.5"/></g>`
- hat-beanie L6 · Muts / Beanie · `<path d="M24 44q0-20 26-20t26 20v6H24z" fill="#2b6fd6"/><rect x="24" y="44" width="52" height="7" rx="2" fill="#1f3b73"/><circle cx="50" cy="22" r="4" fill="#fff"/>`
- hat-toque L10 · Koksmuts / Chef's hat · `<path d="M30 40V26q-10-2-8-10t12-6q4-8 16-8t16 8q10-2 12 6t-8 10v14z" fill="#fff" stroke="#ccd" stroke-width="1.5"/><rect x="29" y="38" width="42" height="7" rx="2" fill="#eee" stroke="#ccd" stroke-width="1.5"/>`
- hat-cheese B:kaaskop · Kaasblokhoed / Cheese-wedge hat · `<path d="M26 42l10-18h28l10 18z" fill="#f3c947" stroke="#d9a520" stroke-width="1.5"/><g fill="#e0a92a"><circle cx="42" cy="34" r="2.5"/><circle cx="56" cy="30" r="2"/><circle cx="50" cy="38" r="1.8"/></g>`
- hat-party B:feestbeest · Feesthoedje / Party hat · `<path d="M38 42L50 12l12 30z" fill="#b0246b"/><path d="M42 36h16M45 28h10" stroke="#fff" stroke-width="2"/><circle cx="50" cy="12" r="3.5" fill="#f8c33c"/>`
- hat-santa B:kerstkok · Kerstmuts / Santa hat · `<path d="M24 42q4-22 30-24 14 2 20 16l-6 2q-6-8-16-8-20 0-24 14z" fill="#d9402b"/><rect x="22" y="38" width="54" height="8" rx="4" fill="#fff"/><circle cx="76" cy="36" r="5" fill="#fff"/>`
- hat-strawhat B:zomerkok · Strohoed / Straw hat · `<path d="M14 44h72q-4 4-36 4T14 44z" fill="#e8c979"/><path d="M28 44q0-20 22-20t22 20z" fill="#e8c979"/><rect x="28" y="36" width="44" height="6" fill="#3d7a3a"/>`
- hat-pan B:huiskok · Steelpan / Saucepan · `<ellipse cx="50" cy="26" rx="22" ry="7" fill="#555"/><rect x="28" y="26" width="44" height="14" fill="#666"/><path d="M72 30h18" stroke="#333" stroke-width="4" stroke-linecap="round"/>`
- hat-crown L50 · Kroon / Crown · `<path d="M28 44V26l10 8 12-14 12 14 10-8v18z" fill="#c9a227"/><g fill="#d9402b"><circle cx="38" cy="38" r="2.5"/><circle cx="50" cy="36" r="2.5"/><circle cx="62" cy="38" r="2.5"/></g>`

Kleding (body; `BODY` = de basisvorm hierboven met de genoemde fill):
- body-tee L3 · T-shirt / T-shirt · BODY fill #2b6fd6
- body-apron L4 · Schort / Apron · BODY fill #4a5d78 + `<path d="M34 100V80q0-6 16-6t16 6v20z" fill="#f4efe6"/><path d="M34 84h32" stroke="#d9402b" stroke-width="2"/>`
- body-apron-fish B:fishlover · Visschort / Fish apron · als body-apron, met in plaats van de streep `<path d="M42 90q6-6 12 0-6 6-12 0zM54 90l5-3v6z" fill="#2a8a8a"/>`
- body-striped L6 · Streepjesshirt / Striped shirt · BODY fill #f4efe6 + `<path d="M20 84h60M16 92h68" stroke="#1f3b73" stroke-width="4"/>`
- body-hoodie L8 · Hoodie / Hoodie · BODY fill #7a3d8a + `<path d="M36 74q14-8 28 0l-4 8q-10-4-20 0z" fill="#5a2a66"/><path d="M46 80v12M54 80v12" stroke="#fff" stroke-width="1.5"/>`
- body-chef-jacket L15 · Koksbuis / Chef's jacket · BODY fill #fff stroke #ccd + `<path d="M50 74v26" stroke="#ccd" stroke-width="1.5"/><g fill="#333"><circle cx="44" cy="84" r="1.5"/><circle cx="56" cy="84" r="1.5"/><circle cx="44" cy="92" r="1.5"/><circle cx="56" cy="92" r="1.5"/></g>`
- body-gold-jacket L60 · Gouden buis / Gold jacket · BODY fill #c9a227 + `<path d="M50 74v26" stroke="#8a5a00" stroke-width="1.5"/><g fill="#fff"><circle cx="44" cy="84" r="1.5"/><circle cx="56" cy="84" r="1.5"/></g>`

Accessoire (prop):
- prop-wooden-spoon L3 · Houten lepel / Wooden spoon · `<path d="M78 98L88 62" stroke="#a6421c" stroke-width="4" stroke-linecap="round"/><ellipse cx="90" cy="58" rx="6" ry="8" fill="#c58a4a"/>`
- prop-ladle L5 · Pollepel / Ladle · `<path d="M78 98L88 62" stroke="#888" stroke-width="3.5" stroke-linecap="round"/><path d="M80 60q8-6 16 0v4q-8 8-16 0z" fill="#999"/>`
- prop-whisk L7 · Garde / Whisk · `<path d="M80 98l6-26" stroke="#555" stroke-width="3.5" stroke-linecap="round"/><g fill="none" stroke="#999" stroke-width="1.8"><path d="M86 72q-10-10-2-20 10 2 8 14"/><path d="M86 72q10-10 2-20-10 2-8 14"/></g>`
- prop-knife L12 · Koksmes / Chef's knife · `<path d="M80 98l6-20" stroke="#4a2c17" stroke-width="4" stroke-linecap="round"/><path d="M86 78l4-26q6 8 2 26z" fill="#c9ced6"/>`
- prop-pepper-mill L18 · Pepermolen / Pepper mill · `<rect x="80" y="74" width="10" height="24" rx="3" fill="#4a2c17"/><rect x="81" y="66" width="8" height="8" rx="2" fill="#c58a4a"/><path d="M78 72h14" stroke="#c9a227" stroke-width="2"/>`
- prop-baguette B:bon-appetit · Stokbrood onder de arm / Baguette under the arm · `<path d="M8 96q6-30 32-40" stroke="#c58a4a" stroke-width="9" stroke-linecap="round"/><path d="M16 84l4-4M22 74l4-4M30 66l4-4" stroke="#8a5a00" stroke-width="1.5"/>`
- prop-carrot-ear B:wortelwijsneus · Wortel achter je oor / Carrot behind the ear · `<path d="M26 44l-12 8 10 4z" fill="#f0742a"/><path d="M14 52l-6-3 4 6z" fill="#3d9a3a"/>`
- prop-aubergine B:aubergineknuffel · Aubergineknuffel / Aubergine cuddle · `<ellipse cx="84" cy="88" rx="9" ry="12" fill="#5a2a66"/><path d="M80 76q4-4 8 0l2-6" fill="#3d7a3a"/><ellipse cx="81" cy="86" rx="3" ry="4" fill="#fff" opacity=".2"/>`
- prop-wine B:wijnkok · Glas wijn / Glass of wine · `<path d="M80 98h10M85 98V84" stroke="#555" stroke-width="2"/><path d="M78 66h14v8q0 10-7 10t-7-10z" fill="#eee" opacity=".6"/><path d="M78 72h14v2q0 10-7 10t-7-10z" fill="#7a1f3d"/>`
- prop-camera B:foodfotograaf · Camera / Camera · `<rect x="74" y="80" width="20" height="14" rx="3" fill="#333"/><circle cx="84" cy="87" r="4.5" fill="#999"/><circle cx="84" cy="87" r="2.5" fill="#222"/><rect x="78" y="77" width="7" height="4" rx="1" fill="#333"/>`

Speldje (pin):
- pin-heart B:hartje · Hartje / Little heart · `<path d="M28 84l-5-5q-3-3 0-6t6 0q3-3 6 0t0 6z" fill="#d9402b"/>`
- pin-star L20 · Ster / Star · `<path d="M28 76l2 4.3 4.7.6-3.4 3.3.8 4.7-4.1-2.2-4.1 2.2.8-4.7-3.4-3.3 4.7-.6z" fill="#c9a227"/>`
- pin-medal-gold B:het-hele-boek · Gouden medaille / Gold medal · `<path d="M24 74l4 6 4-6" fill="#d9402b"/><circle cx="28" cy="86" r="5.5" fill="#c9a227" stroke="#8a5a00"/>`
- pin-globe B:wereldburger · Wereldbol / Globe · `<circle cx="28" cy="84" r="6" fill="#2b6fd6"/><path d="M24 81q4 2 8 0M24 87q4-2 8 0M28 78v12" stroke="#fff" stroke-width="1.2" fill="none"/>`

Achtergrond (bg; getekend óver de profielkleur):
- bg-color L3 · Je profielkleur / Your profile colour · `` (leeg)
- bg-gradient L8 · Verloop / Gradient · `<defs><linearGradient id="g1-__u" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs><rect width="100" height="100" fill="url(#g1-__u)"/>`
- bg-rays L12 · Stralen / Rays · `<g stroke="#fff" stroke-opacity=".25" stroke-width="6"><path d="M50 50L50-10M50 50l50-30M50 50l50 30M50 50 50 110M50 50 0 80M50 50 0 20"/></g>`
- bg-stars L20 · Sterrenhemel / Starry sky · `<g fill="#fff" opacity=".8"><circle cx="20" cy="20" r="1.5"/><circle cx="80" cy="16" r="1.2"/><circle cx="14" cy="60" r="1"/><circle cx="88" cy="56" r="1.5"/><circle cx="30" cy="86" r="1"/><circle cx="70" cy="90" r="1.2"/><circle cx="60" cy="8" r="1"/></g>`
- bg-rainbow L30 · Regenboog / Rainbow · `<g fill="none" stroke-width="7"><circle cx="50" cy="50" r="46" stroke="#d9402b"/><circle cx="50" cy="50" r="39" stroke="#f0742a"/><circle cx="50" cy="50" r="32" stroke="#f3e13a"/><circle cx="50" cy="50" r="25" stroke="#3d9a3a"/><circle cx="50" cy="50" r="18" stroke="#2b6fd6"/></g>`
- bg-gold L50 · Goud / Gold · `<defs><radialGradient id="g2-__u"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#c9a227"/></radialGradient></defs><rect width="100" height="100" fill="url(#g2-__u)"/>`

Per level is er zo altijd iets te halen: L3 (13 basisdelen + alle huids- en haarkleuren), L4, L5, L6, L7, L8,
L9, L10, L12, L15, L18, L20, L30, L50, L60; 22 delen komen van badges (44 van levels, samen 66). Validator voor dit bestand
(`validateAvatarParts` in tools/validate-data.ts): id kebab-case en uniek, id begint met `<layer>-`, layer in
LAYER_ORDER, nl/en niet leeg, unlock = `{level: 3..100}` of `{badge: bestaande badge-id met unlock.part ===
deze id}` (kruiscontrole beide kanten), svg een string zonder `<script`, zonder `href=` en zonder
`style=` behalve de twee toegestane `fill:var(--tone)`/`fill:var(--hair)`, elke `id="…"` in de svg eindigt
op `__u` en elke `url(#…)` verwijst naar zo'n id; elke laag in REQUIRED_LAYERS heeft minstens één L3-deel.
(De vier delen van laag `facial` heten `facial-stubble`, `facial-beard`, `facial-moustache` en
`facial-moustache-chili`, zodat de prefixregel klopt; kritische lezer.)

### 2g. Settings, back-up, deelformaat

Settings (allemaal in de bestaande `settings`-tabel, dus automatisch in de back-up):
- `badges.earned` — bestaand; waarden nu ook `id@k`. **Herstel: unie** (nu wordt het vervangen; dat gaf bij een
  oudere back-up opnieuw toasts). `importBundle` krijgt daarvoor dezelfde behandeling als `inbox.seenIds`.
- `features.log` — nieuw (2c). Herstel: `mergeFeatureLogs(lokaal, bestand)`.
- `donate.hearts` — nieuw: `Record<memberId, number>` (0/1 nu; niveaus later). Herstel: max per lid.
- `avatar.seen` — nieuw, toestel-lokaal (in DEVICE_LOCAL_SETTINGS): `string[]` onderdeel-ids die de gebruiker
  al in de maker zag; nieuwe vrijgespeelde delen krijgen een stipje tot ze gezien zijn.
`Profile.avatar` reist mee in `profiles` (`db.profiles.bulkPut(profiles)` by id, zoals nu: het profiel uit
het bestand overschrijft het lokale; `Profile` heeft geen `updatedAt`, er is geen "nieuwste wint").

Deelformaat (invariant 4): `MemberCard.avatar?` is een nieuw OPTIONEEL veld in het bestaande `#f=`-envelope;
geen nieuwe fragmentsleutel (onbekende sleutels werden al bewaard; een oude app negeert het veld en toont de
beginletter). Bevroren token: **`FROZEN_TOKEN_F_AVATAR` + `FROZEN_ENVELOPE_F_AVATAR`** in
tests/fixtures/frozen-share-tokens.ts (één keer gemaakt met beide engines, zoals FROZEN_TOKEN_F), met
`f.avatar = { v: 1, parts: ['face-round','eyes-happy','mouth-grin','hair-curly','body-apron','hat-toque'],
tone: '#e0b08a', hair: '#8a5a2b' }`. De bestaande FROZEN_TOKEN_F blijft en moet een Member zónder avatar
opleveren.

## 3. Bestandsverdeling en contracten

Drie Opus-workflows (±3 bouwers + integrator elk). Een bouwer raakt alleen zijn eigen bestanden; wat een
ander nodig heeft staat hier als contract, zodat ze parallel kunnen.

### 3a. Blok 6D-2a — catalogus, regels, registratie (domein + data + app-laag)

**Bouwer A — domein** (bezit: src/domain/badges.ts, src/domain/features.ts [nieuw], tests/badges.test.ts,
tests/features.test.ts [nieuw]). Levert precies de exports van §2a/2b/2c. Importeert `longestDayStreak`
en `type XpState` uit `./xp.ts` (6D-1), `dayIndexOfIso` uit `./days.ts` en `FeatureId` uit features.ts.
Geen preact, geen dexie, geen `Date.now()` in de evaluatie (alles komt uit `facts`).

**Bouwer B — data en validator** (bezit: data/badges.json, data/avatar-parts.json [nieuw],
tools/validate-data.ts, tests/validate-badges.test.ts [nieuw]). Schrijft de catalogus van §2d en de
bibliotheek van §2f letterlijk over (Haiku-geschikt), breidt `validateBadges` uit volgens §2e, voegt
`validateAvatarParts(data: unknown, badges: unknown): ValidationResult` toe en haakt beide in de `main()`
van het script (lees data/cuisines.json alleen als het bestaat). `npm run validate:data` moet 0 errors
geven; AANNAME-badges waarvan de id ontbreekt laat hij weg en noemt hij in zijn rapport.

**Bouwer C — app-laag** (bezit: src/badges.ts, src/features.ts [nieuw], src/db/repo.ts [alleen de
genoemde toevoegingen], src/i18n/badges.ts, en uit xp-levels.md alleen deze regels: src/xp.ts
`buildXpFacts.badges` → `{ id, level: status.tier, secret: badge.hidden === true, xp: badge.xp }`,
src/domain/xp.ts de badge-XP-regel van xp-levels §2f en `XP_RULES_VERSION = 2`).
- src/badges.ts: `buildFacts` vult de nieuwe facts (§2c, incl. `xp` via `xpStateFor(memberId)` voor een lid);
  `HOUSEHOLD_KINDS` = ownRecipes, received, shared,
  householdMembers, cooks; `badgeStatuses(memberId)` filtert `hidden` NIET weg (de UI doet dat) en past de
  sticky-regel toe op niveaus: geregistreerd `id@k` → `tier ≥ k`; `checkNewBadges` registreert `id`/`id@k`
  en zet per nieuw hoogste niveau één `NewBadge` in de wachtrij. `NewBadge` wordt
  `{ badge: Badge; memberId: string; tier: number; unlockedPart?: AvatarPart }` (unlockedPart alleen als
  deze badge/dit niveau een `unlock` heeft). Nieuwe export `badgeTiersFor(memberId): Promise<ReadonlyMap<string, number>>`
  (badge-id → bereikt niveau, eenmalig = 1) voor de avatar-maker.
- src/features.ts: `recordFeature(id: FeatureId): Promise<void>` zoals §2c; export `featuresLoaded` niet
  nodig (altijd via setting lezen; de aanroepen zijn zeldzaam).
- src/db/repo.ts: `listAllPhotoMeta(): Promise<Array<Pick<Photo, 'recipeId' | 'memberId' | 'at'>>>`
  (`db.photos.toArray()` zonder blob-gebruik is goed genoeg: ≤ enkele honderden rijen); in `importBundle`
  de merges van §2g voor `badges.earned` (unie), `features.log` (`mergeFeatureLogs`) en `donate.hearts`
  (max per lid), en `'avatar.seen'` in `DEVICE_LOCAL_SETTINGS`. Pure merge-helpers (`mergeEarned`) komen in
  src/domain/badges.ts (Bouwer A) zodat ze testbaar zijn; Bouwer C roept ze alleen aan.
- src/i18n/badges.ts: alle `badges.*`-keys uit §1a (NL én EN).

**Integrator**: `npm run check`, `npm test`, `npm run validate:data`, `npm run build`; controleert dat de oude
BadgesScreen nog rendert met de nieuwe data (hij kent `tiers` niet, toont dan `current/target` naar het
volgende niveau: acceptabel tot 6D-2b); STATUS.md bijwerken. Bestanden die nog niemand bezit, pakt de
integrator.

### 3b. Blok 6D-2b — badgepagina, toasts, ontdekker-registratie (UI)

**Bouwer A — badgepagina** (bezit: src/screens/BadgesScreen.tsx, src/styles/badges.css). Bouwt §1a. In
badges.css komen de acht niveaukleuren als tokens op `.badges` én op `:root` (de avatar-rand gebruikt ze
ook): `--lvl-1: #e6b800; --lvl-2: #3d9a3a; --lvl-3: #2b6fd6; --lvl-4: #d9402b; --lvl-5: #b0712d;
--lvl-6: #8d9aa8; --lvl-7: #c9a227; --lvl-8: #7fd1d6`. De oude `--tier-*` mogen blijven als alias.
Groepsstand: localStorage `recepten.badges.groups` (try/catch, zoals MoreScreen).

**Bouwer B — toasts en hooks** (bezit: src/app.tsx [alleen de toast], en de `void recordFeature(...)`-regels
in: CookScreen.tsx, RecipeScreen.tsx, ShoppingScreen.tsx, ShareScreen.tsx, ProfilesScreen.tsx, MoreScreen.tsx,
src/step-amounts.ts, src/speech.ts, EditScreen.tsx, StorageScreen.tsx, StoryScreen.tsx, WeekScreen.tsx,
RecipesScreen.tsx, src/components/TonightCard.tsx (surprise), DeltaShareScreen.tsx, WordPicker.tsx,
DictionaryScreen.tsx / IngredientPicker.tsx, src/components/LineView.tsx (dictEdit),
src/components/Header.tsx (`chooseLang`, langToggle), src/timers.ts, src/cooklog.ts). Elke hook is één
regel op het moment van §2c; geen andere wijziging in die bestanden. WordPicker.tsx wordt gebruikt vanuit
src/components/LineChips.tsx. De toast in app.tsx kiest de tekst: hidden → `badges.toastSecret`;
`tier > 1` of ladder → `badges.toastTier`; anders `badges.toast`; met `unlockedPart` een tweede regel.

**Bouwer C — documentatie** (bezit: docs/DEVICE-TEST.md rijen 94–95, docs/STATUS.md). Home heeft na
Home A+ en 6D-1 geen badgekaart meer (HomeLevelRow toont de levelregel), dus hier geen Home-werk; de
telling "{earned} van {total} badges verdiend · {n} geheime gevonden" staat alleen op de badgepagina.

**Integrator**: alles groen, dev-app op 375 px nalopen met de acceptatiechecks van §6c, deploy /next/.

### 3c. Blok 6D-3 — avatar

**Bouwer A — domein en contract** (bezit: src/domain/avatar.ts [nieuw], tests/avatar.test.ts [nieuw],
src/domain/model.ts [alleen `Profile.avatar`], src/domain/household.ts [`Member.avatar`, memberFromCard,
cardFromMember, normalizeMember], src/domain/share.ts [`MemberCard.avatar`, buildMemberEnvelope,
readMemberPayload], tests/fixtures/frozen-share-tokens.ts [toevoegen, nooit wijzigen], tests/token.test.ts,
tests/share.test.ts, tests/household.test.ts). Exports: §2f.

**Bouwer B — maker** (bezit: src/components/AvatarSheet.tsx [nieuw], src/styles/avatar.css [nieuw;
src/main.tsx importeert hem na badges.css], src/i18n/avatar.ts [nieuw; index.ts merged hem na badges],
src/avatar.ts [nieuw, app-laag]).
- src/avatar.ts: `avatarParts(): ReadonlyMap<string, AvatarPart>` (module-cache van data/avatar-parts.json
  via `normalizeAvatarParts`), `unlockContext(memberId): Promise<{ level: number; badgeTiers: ReadonlyMap<string, number> }>`
  (level via `levelForXp` uit xp-levels.md, src/domain/xp.ts, + `badgeTiersFor` uit src/badges.ts), `markPartsSeen(ids)` /
  `unseenParts(ids)` op setting `avatar.seen`, `avatarUid()` (oplopende teller voor `renderAvatarSvg`).
- AvatarSheet props: `{ profile: Profile; onClose: () => void }`; bewaart zelf via `updateProfile`.

**Bouwer C — in de schermen** (bezit: src/screens/ProfilesScreen.tsx [`Avatar`-component + bewerk-rij],
src/screens/MoreScreen.tsx [tik op het rondje], src/screens/HouseholdScreen.tsx en InboxScreen.tsx [alleen
het doorgeven van `avatar` op Member, als dat niet al via `Avatar profile={m}` vanzelf gaat],
src/screens/DeltaShareScreen.tsx [r. 155: `avatar` meegeven aan de handgebouwde Members],
src/screens/HomeScreen.tsx [één regel: `<Avatar profile={profile} level={level} />` in `.home-hello`, met
`level` uit `xpStates`/`levelForXp`], src/db/repo.ts [niets nieuws als 6D-2a `avatar.seen` al toevoegde],
docs/DEVICE-TEST.md rijen 96–97, docs/STATUS.md).
`Avatar` wordt: `(props: { profile: Pick<Profile, 'name' | 'color' | 'avatar'>; big?: boolean; level?: number })`
en gebruikt `dangerouslySetInnerHTML` met de string van `renderAvatarSvg` — de string komt uitsluitend uit
data/avatar-parts.json (gevalideerd, geen gebruikersinvoer), dat staat als commentaar bij de aanroep.

**Integrator**: groen, acceptatiechecks §6c, deploy /next/; meldt aan Home A+ (als dat al gebouwd is) dat
de begroeting `level` mag meegeven.

### 3d. Contracten met andere specs

- **xp-levels.md** (afgestemd door de kritische lezer) levert vóór 6D-2: `longestDayStreak(cookDays:
  readonly number[], rules?): number`, `levelForXp(total: number, rules?: XpRules): number` en `type
  XpState` (alle in src/domain/xp.ts), `dayIndexOfIso` (src/domain/days.ts) en `xpStateFor(memberId)`
  (src/xp.ts); gebruikt van ons: `badgeXp(status)`, `BadgeStatus.tier`, `Badge.hidden/xp/tiers`,
  `BadgeFacts.xp`; zijn `#x=`-sync draagt `avatar?: AvatarSpec` en badges als `id`/`id@k`. Zijn
  level-up-overzicht noemt bij level 3 "avatar-maker" en bij elk level de avatar-onderdelen met
  `unlock.level === dat level` (uit `avatarParts()`). 6D-2a zet `XP_RULES_VERSION` op 2.
- **Home A+** (gebouwd) rendert `<Avatar profile={profile} />` in `.home-hello`; 6D-3 bouwer C voegt daar
  `level={level}` aan toe (geen `big`).
- **Labels-spec (6B/13E)** levert `Recipe.cuisine`, data/cuisines.json, de categorie-ids gebak/nagerecht/
  bijgerecht/ontbijt-lunch en de tag lactosevrij; **6C** levert het moment voor `standingList`.

## 4. Stappenplan

Volgorde binnen 6D (canoniek, README §1): 6D-1 XP-domein (xp-levels.md) → **6D-2a → 6D-2b → 6D-3** →
6D-4a ontgrendelingen (xp-levels.md "Blok 6D-3") → 6D-4b sync + kookkalender (xp-levels.md "Blok 6D-4").
Vooraf: **Stijn keurt §2d
en §2f goed** (open vraag 1). Elk blok apart online op `/next/`; `main` pas als het blok op beide telefoons
is bekeken (Stijn Android, Gabi iPhone) — geen aparte vlag nodig, het /next/-kanaal is de vlag.

1. **6D-2a — catalogus, regels, registratie.** Klaar als: `npm run validate:data` 0 errors met de nieuwe
   data/badges.json en data/avatar-parts.json; `evaluateBadges` kent alle regelsoorten van §2b;
   `features.log` wordt geschreven door `recordFeature` (nog zonder aanroepen uit de UI: die komen in 2b);
   back-up/herstel merget `badges.earned`, `features.log`, `donate.hearts`; alle tests van §6a groen.
   Online: /next/ (de oude pagina toont de nieuwe badges al, zonder groepen). Vereist 6D-1.
2. **6D-2b — badgepagina en ontdekkers.** Klaar als: groepen, ladderkaarten, Geheim-telling, toasts met
   niveau en avatar-regel; alle 32 feature-hooks staan er; acceptatiechecks §6c badges; DEVICE-TEST 94–95.
   Online: /next/, daarna main na Stijn + Gabi.
3. **6D-3 — avatar.** Klaar als: avatar-maker open vanaf level 3, 66 onderdelen met vergrendeling, bewaren in
   `Profile.avatar`, `Avatar` toont de SVG overal, kaartje `#f=` draagt de avatar (bevroren token), herstel
   draagt hem mee; acceptatiechecks §6c avatar; DEVICE-TEST 96–97. Online: /next/, daarna main.
4. **Later (niet in deze spec gebouwd):** het hartje verdienen (dank-je-link `#d=`, §5c) als eigen klein blok
   na bevestiging van open vraag 2; voedingsbadges (docs/IDEAS.md 1) als nieuwe regelsoorten op dezelfde
   `BadgeRule`-unie; niveaus voor het hartje (tiers op `donor`).

Hervatten na een afgebroken run: eerst de werkmap bekijken (`git status`), dan per bouwer kijken welke
bestanden al af zijn; de catalogus is door §2d altijd reproduceerbaar.

## 5. Regels en eerlijkheid

### 5a. Invarianten die dit blok raakt

- **1 (ids):** recept-ids ongemoeid. Badge-ids volgen dezelfde geest: de 44 blijven in het bestand; zes
  worden `retired` (niet getoond, niet geëvalueerd) en een registratie in `badges.earned` van zo'n id doet
  niets meer — nooit een fout. Avatar-onderdeel-ids zijn ook voor altijd: een hernoeming is een nieuw id plus
  het oude als `retired`-onderdeel (veld `retired?: true` op AvatarPart, tekent nog wél, staat niet meer in
  de maker) — nu nog niet nodig.
- **3 ({nl,en}):** elke badge nl+en naam en omschrijving, elk onderdeel nl+en; de validator eist beide.
- **4 (deelformaat):** alleen een optioneel veld `avatar` op het `#f=`-kaartje, nieuw bevroren token ernaast,
  het oude token blijft gelden. Geen nieuwe fragmentsleutel voor het kaartje; de dank-je-link (§5c) krijgt
  wél een eigen sleutel `#d=`, omdat het geen share-envelope is.
- **5/7/13 (iPhone):** niets in dit blok hangt van spraak, printen of linkvangst af; geheime badges daarvoor
  bestaan zonder dat de iPhone ze mist (geen totaal). De landing-bundel (boot-regel) kent `#d=` niet: op de
  iPhone opent zo'n link Safari; de route is dan kopiëren → app → Plak (§5c).
- **6 (landing schrijft niets):** ongewijzigd; `renderAvatarSvg` wordt niet in landing.ts gebruikt.
- **9 (share één veld):** het kaartje blijft `{text}`.
- **14 (geen backend):** feature-events, hartje en avatar blijven op het toestel; de dank-je-link wordt
  lokaal gecontroleerd met WebCrypto, Stijn ondertekent op zijn pc.
- **15 (geen dependency):** `createPortal` komt uit `preact/compat` (al in gebruik), WebCrypto is native.
  Geen SVG-bibliotheek: de onderdelen zijn strings in data.

### 5b. Eerlijkheid en rust

- Geen beloning voor kijken: alleen handelingen staan in FEATURE_IDS. Een feature-ladder (timers, kookstand,
  lijsten, delen) kost echte handelingen; "porties aanpassen" en "sorteren" zijn daarom eenmalig en geheim.
- Reeksen en seizoenen tellen op datum van de kookbeurt; terugdateren tot 7 dagen (xp-levels.md) telt voor
  badges gewoon mee (badges liegen niet over wanneer je kookte), alleen `cookHour` negeert de 12:00-marker.
- Een badge wordt nooit afgenomen (sticky, zoals nu). Een avatar-onderdeel ook niet: eenmaal in je spec blijft
  hij getekend, ook na herstel op een telefoon met minder XP.
- Rendering van een avatar van iemand anders (kaartje) controleert niets: zijn vrijgespeelde delen zijn op zijn
  telefoon verdiend.
- Badges uit = pagina, toasts en maker weg; bestaande avatars blijven zichtbaar (de persoon, niet het spel).

### 5c. Het hartje: mechanisme (alleen beschrijven; bouwen later, na open vraag 2)

1. De doneerknop (Meer en Het verhaal, bestaand) opent `https://bunq.me/StijnRutgers`. Later-blok: met
   referentie, `https://bunq.me/StijnRutgers/<bedrag>/RR-<4 tekens>` (bunq.me ondersteunt bedrag en
   omschrijving in de link: **eerst op een echte telefoon testen**, DEVICE-TEST-rij in dat blok). De ref =
   `RR-` + 4 tekens uit `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (geen 0/O/1/I/L), eenmalig per telefoon gemaakt en
   bewaard in setting `donate.ref`.
2. Na de tik toont de app een kaartje "Gedoneerd? Stuur Stijn een berichtje voor je hartje" → `shareText`
   met "Ik heb gedoneerd, ref RR-7K3F" (de gebruiker kiest Stijn zelf in WhatsApp: geen nummer in de code).
3. Stijn ziet dezelfde ref bij de betaling en draait `node tools/thank-you.ts RR-7K3F 1` (Node 22; de
   PRIVÉ-sleutel staat in een omgevingsvariabele of een bestand buiten de repo, nooit in git). Het script
   ondertekent `{ ref, lvl, at }` met **ECDSA P-256 / SHA-256** (overal in WebCrypto beschikbaar, ook Safari
   16) en drukt de link `https://…/recepten/#d=<base64url(JSON{ref,lvl,at,sig})>` af. Stijn stuurt die
   terug in hetzelfde WhatsApp-gesprek.
4. De app (src/domain/donate.ts, publieke sleutel als JWK-constante) controleert `sig` met
   `crypto.subtle.verify`, eist `ref === donate.ref`, en zet `donate.hearts[activeProfile.id] = lvl`; daarna
   `checkNewBadges` → het hartje + `pin-heart`. Eén gebruik per link (bewaar `at` in `donate.used`).
   Ongeldig: "Deze dank-je-link klopt niet of is al gebruikt." / "This thank-you link is not valid or was
   used already." Android: de link opent de app (als linkvangst werkt) of Chrome; de app herkent `#d=` in
   `boot.ts` (alleen full app, nooit landing) en in UniversalPaste (`classifyPaste` → 'donate'). iPhone:
   Safari toont niets bruikbaars → de landing-bundel toont voor `#d=` NIETS (hij kent de sleutel niet en
   laadt de full app niet, want niet standalone); daarom zegt het WhatsApp-bericht van Stijn's script er
   altijd bij: "iPhone: kopieer deze link, open de app en plak hem bij In & uit."
5. Niveaus/drempels: later (open vraag 2); het datamodel kan het al (`donor` met `tiers`).

### 5d. Opus mag dit NIET zelf beslissen

Zo doen als hier staat, anders vragen aan Stijn/Fable:
1. Badge-ids, groepen, drempelreeksen, namen en omschrijvingen (§2d) — geen "betere" naam bedenken, geen
   extra badge, geen badge weglaten behalve de genoemde AANNAME-gevallen (en dat melden).
2. Welke 6 badges `retired` zijn en waardoor ze vervangen worden.
3. De 8 niveaukleuren en hun hex-waarden; de rand-per-level-tabel (`ringForLevel`).
4. De FEATURE_IDS en het moment van vastleggen per id (§2c); geen extra ids.
5. Het bereik van `photos` (per lid) en de inhoud van HOUSEHOLD_KINDS.
6. Het format van `badges.earned` (`id`, `id@k`) en de merge-regels bij herstel.
7. `AVATAR_MAKER_LEVEL = 3`, LAYER_ORDER, REQUIRED_LAYERS, de 66 onderdelen met hun SVG en unlock, de
   tonen- en haarkleurpaletten — een SVG mag alleen worden aangepast als hij aantoonbaar niet rendert
   (dan de kleinste fix, en melden).
8. Hoe de avatar meereist: optioneel veld op `#f=`, bevroren token FROZEN_TOKEN_F_AVATAR; geen nieuwe
   fragmentsleutel; `#x=` is van xp-levels.md.
9. `streakDays` gebruikt `longestDayStreak` uit src/domain/xp.ts (xp-levels.md); nooit een eigen variant
   schrijven. `overcooked` leest uit `facts.xp`, niet uit een feature-event.
10. Niets van §5c bouwen in 6D-2/6D-3; geen sleutelmateriaal genereren.
11. Geen nieuwe dependency (ook geen SVG- of kleurbibliotheek); geen Dexie-versie.
12. Teksten: letterlijk de NL/EN uit deze spec; een ontbrekende tekst → vragen, niet verzinnen.

## 6. Testplan

### 6a. Unit tests (Vitest, node)

**tests/badges.test.ts** (uitbreiden; de helpers `recipe`, `entry`, `facts`, `badge`, `status` blijven;
`facts()` krijgt de nieuwe velden met lege standaardwaarden: categoriesTotal 11, photoRows [], features {},
householdMembers 1, donorLevel 0):
- normalizeBadges: `group` ontbreekt → 'koken'; `tiers` met 7 of 9 waarden of niet stijgend → weggelaten;
  `hidden: 'ja'` → weggelaten; `season` zonder `to` → weggelaten; `unlock` zonder part → weggelaten; `xp: -1`
  → weggelaten; `retired: true` zonder replacedBy → badge blijft, retired blijft true (data-fout is voor de
  validator); garbage-array → [] (bestaande test blijft).
- evaluateBadges slaat retired over: twee badges, één retired → één status.
- tierFor/ladder-voortgang met `cookCount` tiers COOK: 0 kookbeurten → tier 0, current 0, target 5; 7 →
  tier 1, current 7, target 10; 1000 → tier 8, current = target = 1000, earned true; 1200 → idem (cap).
- badgeXp: ladder tier 3 → 300; eenmalig verdiend zonder xp → 50; hidden zonder xp → 250; `xp: 100` → 100;
  `xp: 0` → 0; niet verdiend → 0.
- fiveStar: twee entries met 5, één met 4 → current 2.
- classics: b:a, b:a, b:b, u:c gekookt → 2.
- cuisine 'italiaans': recipes met `cuisine: 'italiaans'` ×3 kookbeurten en één zonder veld → 3; cuisines:
  italiaans, frans, null → 2.
- allCategories: categoriesTotal 11, gekookt uit soep en pasta → current 2, target 11.
- seasonCooks: season 12-21..03-19: 10 jan telt, 20 mrt niet, 21 dec telt, 20 dec niet; season 12-24..12-26:
  24, 25, 26 dec tellen, 23 en 27 niet; season 02-14..02-14: alleen 14 feb. Lokale datums via `localIso`.
- weekdayCooks [6,0]: za en zo tellen, ma niet; [1]: alleen ma.
- cookHour 0..4: 00:30 telt, 04:59 telt, 05:00 niet; 12:00:00.000 lokaal (via `cookedAtForDay`-vorm) telt
  NIET, 12:00:01 wel in venster 12..12.
- sameRecipeDays 3: dag 1-2-3 zelfde recept → earned; dag 1-2-4 → current 2; twee kookbeurten op dag 2
  tellen als één dag; een ander recept ertussen onderbreekt niet (per recept geteld).
- calendar friday-13: 2026-02-13 (vrijdag) telt, 2026-03-13 (vrijdag) telt, 2026-02-12 niet; leap-day:
  2028-02-29 telt, 2028-02-28 niet.
- feature 'timer': features {timer: 4} → current 4.
- retryAfterOneStar: 1 ster op dag 1, opnieuw gekookt dag 5 → 1; alleen de 1-ster → 0; opnieuw gekookt VÓÓR
  de 1-ster → 0.
- comeback 365: zelfde recept op 2025-01-01 en 2026-01-02 → 1; 2025-01-01 en 2025-12-01 → 0.
- streakDays: één smoke-test die `longestDayStreak` aanroept via de regel (3 dagen op rij → current 3); de
  overslaan-semantiek staat in de tests van xp-levels.md.
- fullWeeks: ma t/m zo van één ISO-week → 1; zes dagen → 0; twee volle weken → 2; de week over de
  jaarwisseling (2025-12-29 … 2026-01-04) → 1.
- photos per lid: photoRows gefilterd meegegeven; photoRecipes: 3 foto's van 2 recepten → 2;
  photosOfOneRecipe n 5: 5 foto's van één recept → earned, 4+1 → current 4.
- householdMembers 2 → facts.householdMembers 1 → 1/2; cooks: log met twee profileIds → 2; donor: donorLevel
  1 → earned, 0 → 0/1.
- mergeEarned: unie per sleutel, volgorde behouden, dubbelen weg; `id@k`-strings blijven strings.
- Catalogus-smoke: `normalizeBadges(data/badges.json)` → ≥ 140 badges, ids uniek, alle 44 oude ids erin,
  elke ladder heeft `{n}` in beide omschrijvingen, elke `geheim`-badge is hidden.

**tests/features.test.ts** (nieuw): bumpFeature maakt een nieuwe teller (n 1, first = last = at, by[lid] 1);
tweede bump verhoogt n en last, first blijft; ander lid → by met twee sleutels; mergeFeatureLogs neemt max n,
min first, max last, max per lid; normalizeFeatureLog gooit garbage weg en houdt geldige ids;
featureCounts(log, 'all') = n, (log, lid) = by[lid] ?? 0; isFeatureId('voice') true, ('kijken') false.

**tests/validate-badges.test.ts** (nieuw): echte data/badges.json + data/avatar-parts.json → 0 errors; dan
negatieve gevallen op een minimale badge: group ontbreekt; tiers met 7 waarden; tiers én n; ladder zonder
`{n}`; eenmalig mét `{n}`; geheim zonder hidden; season bij cookCount; `from: '13-01'`; unlock.part onbekend;
unlock.tier bij eenmalig; twee badges met dezelfde unlock.part; xp op een ladder; retired zonder replacedBy;
replacedBy naar retired badge; feature-id onbekend; weekdayCooks days [7]; cookHour from 5 to 3. En
validateAvatarParts: id zonder laag-prefix; onbekende layer; unlock.badge dat niet terugwijst; svg met
`<script`; `id="x"` zonder `__u`; laag face zonder L3-deel.

**tests/avatar.test.ts** (nieuw): normalizeAvatarParts(echte data) → 66, alle ids uniek, elke id begint met
zijn laag; normalizeAvatarSpec: `{v:1, parts:['face-round']}` ok, `{v:2}` → null, parts met niet-strings
gefilterd, onbekende tone → weggelaten; isComplete: default true, zonder mouth false; isUnlocked: level-part
bij level ≥ n true, lager false; badge-part met badgeTiers.get(id) ≥ unlock.tier true, zonder tier (eenmalig)
≥ 1; ringForLevel: 1→null, 4→null, 5→geel, 9→geel, 10→groen, 19→groen, 20→blauw, 30→rood, 40→brons,
50→zilver, 60→goud, 79→goud, 80→platina, 100→platina; defaultAvatar complete; randomAvatar: zelfde seed →
zelfde spec, complete, alleen vrijgespeelde ids; renderAvatarSvg: bevat `id="c-UID"` en `url(#c-UID)`, geen
`__u` meer, de profielkleur als fill, de lagen in LAYER_ORDER (indexOf-vergelijking van body < face < hat),
onbekende id weggelaten zonder fout, rand aanwezig bij level 10 en afwezig bij level 3, geen `<script`.

**tests/token.test.ts + tests/share.test.ts + tests/household.test.ts** (uitbreiden): FROZEN_TOKEN_F_AVATAR
(beide engines) → FROZEN_ENVELOPE_F_AVATAR exact; `parseEnvelope` → member.avatar gelijk aan de spec;
FROZEN_TOKEN_F → member zonder `avatar`; kaartje met `avatar: 'x'` → member zonder avatar, kaartje verder
geldig; `cardFromMember` zet avatar alleen als het profiel er een heeft; `memberFromCard`/`normalizeHousehold`
(via de niet-geëxporteerde `normalizeMember`) bewaren hem; `upsertMemberFromCard` werkt een bestaande member's avatar bij.

### 6b. Fixtures

- tests/fixtures/frozen-share-tokens.ts: FROZEN_TOKEN_F_AVATAR, FROZEN_TOKEN_F_AVATAR_FFLATE,
  FROZEN_ENVELOPE_F_AVATAR (§2g). Eén keer gemaakt, daarna nooit meer veranderd.
- tests/fixtures/badge-log.ts (nieuw, klein): een kooklog van ±40 entries over 2025-11 … 2026-02 met twee
  leden, een 1-ster met herkansing, een kerstkookbeurt, een nachtelijke, drie dagen hetzelfde recept en één
  volle week — één fixture waarop de catalogus-smoke én de regel-tests kunnen draaien.

### 6c. Acceptatiechecks in de dev-app (`npm run dev`, 375 px, licht én donker)

Badges (6D-2b):
1. Meer → Badges: acht groepskoppen in de goede volgorde met tellingen; inklappen onthouden na herladen.
2. Nieuw profiel, één keer ✓ Gekookt: toast "Eerste hap"; Huiskok staat op 1/5 met grijze stippelring.
3. Vijf keer ✓ Gekookt (verschillende dagen via de datumkiezer): toast "🏆 Huiskok · niveau 1: geel"; de
   ring is geel; detail toont acht stipjes, één gevuld, "Volgende: 10 (groen)".
4. Meer → Thema wisselen: toast "🤫 Geheime badge: Van kleur verschoten"; groep Geheim: "1 geheime badges
   gevonden" + de kaart; de regel boven de groepen zegt "… · 1 geheime gevonden" (Home heeft geen
   badgekaart meer na Home A+/6D-1).
5. Ledentab: Huisgenoten/Volle tafel/Gulle gever ontbreken; Samen-tab: ze staan er.
6. Herstel een back-up van vóór dit blok: geen stortvloed aan oude toasts (alleen echt nieuwe niveaus),
   `badges.earned` bevat de oude ids nog.
7. Badges uit (Meer → Instellingen): pagina toont alleen `badges.disabled`; geen toasts bij koken.

Avatar (6D-3):
8. Profiel op level < 3: knop "Maak je avatar" uitgeschakeld met de uitleg; tik op het rondje in Meer doet
   niets. Na één kookbeurt (level 3): knop actief.
9. Sheet: Annuleer/Bewaar bovenaan; "🎲 Verras me" geeft steeds een complete avatar; kleding "Schort" is
   vergrendeld met "Lv 4" en de uitleg verschijnt bij tikken; "Kaasblokhoed" toont het 🧀-icoon en bij
   tikken "Komt vrij met de badge Kaaskop op niveau blauw"; een geheim deel toont ❓ en de geheime uitleg.
10. Bewaar: het rondje in Meer, Profielen, Huishouden en Home toont de SVG; rand verschijnt pas op level 5.
11. Wegvegen na wijzigen: niets bewaard. "Terug naar de beginletter" + Bewaar: letterrondje terug.
12. Deel mijn kaartje → Kopieer link → plak in In & uit op een tweede profiel/telefoon: het lid toont de avatar.
13. Donker thema: tegels, vergrendeling en ringen leesbaar; 360 px: rijen scrollen horizontaal, de pagina
    niet.

### 6d. DEVICE-TEST-rijen (definitief 94–97)

Nederlands:

| 94 | **Badges in groepen en kleurniveaus (fase 6, blok 6D-2).** 1. Tik onderaan op **Meer** → **Badges**. Kijk naar de kopjes. 2. Tik op het kopje **Koken** zodat het inklapt. Sluit de app helemaal en open hem weer. Ga terug naar Badges. 3. Tik op **Koken** zodat het weer openklapt. Tik op de kaart **Huiskok**. 4. Open een recept. Tik op **✓ Gekookt** en op **Bewaar**. Doe dat nog vier keer, telkens met een andere datum (tik bij **Wanneer?** op **Andere datum** en kies bij **Datum** een dag). 5. Ga naar **Meer → Badges** en kijk bij Huiskok. 6. Tik bovenaan op **Samen**. Zoek **Huisgenoten**. Tik daarna op je eigen naam en zoek nog eens. | 1. Je ziet acht kopjes: Koken, Ontdekken, Keukens van de wereld, Seizoenen, Samen & delen, Fotografie, Reeksen, Geheim. Bij elk kopje staat "verdiend/totaal". 2. Koken staat nog ingeklapt. 3. Onder de kaart verschijnt de uitleg "Kook 5 keer" met acht gekleurde stipjes en "Volgende: 5 (geel)". 4. Na de vijfde keer verschijnt bovenaan "🏆 Huiskok · niveau 1: geel". 5. Het icoon van Huiskok heeft een gele ring, eronder staat "Niveau 1 · geel" en een balkje naar 10. 6. Op **Samen** staat Huisgenoten; op je eigen tabblad niet. |
| 95 | **Geheime badges (fase 6, blok 6D-2).** 1. Tik onderaan op **Meer** → **Badges** en scrol naar **Geheim**. Lees wat er staat. 2. Tik onderaan op **Meer** → kopje **Instellingen** → **Thema** → kies een ander thema dan nu. 3. Ga terug naar **Meer → Badges** → **Geheim**. 4. Tik op de kaart die er staat. 5. Ga terug naar **Meer → Badges** en lees de regel boven de kopjes. | 1. Er staat "0 geheime badges gevonden" (of "Nog geen geheime badge gevonden …") en géén namen of kaarten. 2. Bovenaan verschijnt "🤫 Geheime badge: Van kleur verschoten". 3. Er staat "1 geheime badges gevonden" en één kaart, Van kleur verschoten. 4. De uitleg zegt "Wissel van thema". Nergens staat hoeveel geheime badges er in totaal zijn. 5. Achter "… van … badges verdiend" staat "· 1 geheime gevonden". |
| 96 | **Je eigen avatar maken (fase 6, blok 6D-3).** 1. Tik onderaan op **Meer**. Kijk bij je profiel naar het gekleurde rondje met je beginletter. 2. Tik op dat rondje. 3. Tik bovenaan op **🎲 Verras me**. 4. Scrol naar **Kleding**. Tik op een grijze tegel met een slotje. 5. Scrol naar **Hoofddeksel**. Tik op de grijze tegel met het 🧀-icoontje. 6. Kies bij **Huid** een andere kleur en bij **Mond** een andere mond. 7. Veeg het venster naar beneden. Kijk naar het rondje. 8. Tik weer op het rondje, kies iets, en tik bovenaan op **Bewaar**. 9. Tik onderaan op **Home**. | 1–2. Heb je nog nooit gekookt in de app, dan gebeurt er niets (in Meer → Profielen beheren → Bewerk staat dan "Komt vrij op level 3, na je eerste kookbeurt"). Heb je wel gekookt: een venster **Jouw avatar** met bovenaan **Annuleer** en **Bewaar** en een groot voorbeeld op je profielkleur. 3. Het voorbeeld verandert in een compleet gezicht met haar en kleding. 4. Onder de rij verschijnt "Komt vrij op level 4." 5. Onder de rij verschijnt "Komt vrij met de badge Kaaskop op niveau blauw." 6. Het voorbeeld past direct mee. 7. Het rondje toont nog je beginletter: er is niets bewaard. 8. Het rondje in Meer toont nu je avatar. 9. In de begroeting op Home staat dezelfde avatar. |
| 97 | **Avatar reist mee op je kaartje (fase 6, blok 6D-3; twee telefoons of twee profielen).** 1. Zorg dat je een avatar hebt (test 96). Tik onderaan op **Meer** → **Profielen beheren** → bij jouw profiel **Deel mijn kaartje** → **Kopieer link**. 2. *Andere telefoon:* open de app, **Meer → In & uit**, plak de link in het plakvak (*iPhone:* houd het vak ingedrukt → **Plak**) en tik op **Voeg toe aan je huishouden**. 3. Ga op die telefoon naar **Meer → Huishouden**. 4. Ga naar **Meer → In & uit** en kijk bij de regel van het kaartje. | 2. Het kaartje toont jouw naam mét je avatar. 3. In de ledenlijst staat jouw avatar, niet alleen je beginletter (zonder gekleurde rand: jouw level staat niet op die telefoon). 4. Ook daar staat je avatar bij je naam. |

(Rij 97 stap 4 keek eerst naar de Badges-tabs; die houden hun kleurstip (`.badge-tab-dot`), dus de stap
kijkt nu naar In & uit, waar de afzender als lid met avatar staat; kritische lezer.)

English:

| 94 | **Badges in groups and colour levels (phase 6, block 6D-2).** 1. Tap **More** at the bottom → **Badges**. Look at the headings. 2. Tap the heading **Cooking** so it collapses. Close the app completely and open it again. Go back to Badges. 3. Tap **Cooking** so it opens again. Tap the card **Home cook**. 4. Open a recipe. Tap **✓ Cooked** and **Save**. Do that four more times, each time with a different date (under **When?** tap **Another date** and pick a day under **Date**). 5. Go to **More → Badges** and look at Home cook. 6. Tap **Together** at the top. Find **Housemates**. Then tap your own name and look again. | 1. You see eight headings: Cooking, Discovering, Cuisines of the world, Seasons, Together & sharing, Photography, Streaks, Secret. Each heading shows "earned/total". 2. Cooking is still collapsed. 3. Under the card the text "Cook 5 times" appears with eight coloured dots and "Next: 5 (yellow)". 4. After the fifth time, "🏆 Home cook · level 1: yellow" appears at the top. 5. The Home cook icon has a yellow ring, under it "Level 1 · yellow" and a bar towards 10. 6. Housemates is on **Together**; not on your own tab. |
| 95 | **Secret badges (phase 6, block 6D-2).** 1. Tap **More** at the bottom → **Badges** and scroll to **Secret**. Read what it says. 2. Tap **More** at the bottom → heading **Settings** → **Theme** → pick a theme other than the current one. 3. Go back to **More → Badges** → **Secret**. 4. Tap the card that is there. 5. Go back to **More → Badges** and read the line above the headings. | 1. It says "0 secret badges found" (or "No secret badge found yet …") and no names or cards. 2. "🤫 Secret badge: Changed colours" appears at the top. 3. It says "1 secret badges found" and one card, Changed colours. 4. The text says "Switch theme". Nowhere does it say how many secret badges exist in total. 5. After "… of … badges earned" it says "· 1 secret found". |
| 96 | **Making your own avatar (phase 6, block 6D-3).** 1. Tap **More** at the bottom. Look at the coloured circle with your initial next to your profile. 2. Tap that circle. 3. Tap **🎲 Surprise me** at the top. 4. Scroll to **Clothes**. Tap a grey tile with a padlock. 5. Scroll to **Headwear**. Tap the grey tile with the 🧀 icon. 6. Under **Skin** pick another colour and under **Mouth** another mouth. 7. Swipe the sheet down. Look at the circle. 8. Tap the circle again, pick something, and tap **Save** at the top. 9. Tap **Home** at the bottom. | 1–2. If you have never cooked in the app, nothing happens (in More → Manage profiles → Edit it says "Unlocks at level 3, after your first cooked dish"). If you have cooked: a sheet **Your avatar** with **Cancel** and **Save** at the top and a big preview on your profile colour. 3. The preview turns into a complete face with hair and clothes. 4. Under the row: "Unlocks at level 4." 5. Under the row: "Unlocks with the badge Cheesehead at level blue." 6. The preview follows at once. 7. The circle still shows your initial: nothing was saved. 8. The circle in More now shows your avatar. 9. The greeting on Home shows the same avatar. |
| 97 | **Your avatar travels on your card (phase 6, block 6D-3; two phones or two profiles).** 1. Make sure you have an avatar (test 96). Tap **More** at the bottom → **Manage profiles** → at your profile **Share my card** → **Copy link**. 2. *Other phone:* open the app, **More → In & out**, paste the link in the paste box (*iPhone:* long-press the box → **Paste**) and tap **Add to your household**. 3. On that phone go to **More → Household**. 4. Go to **More → In & out** and look at the card's row. | 2. The card shows your name with your avatar. 3. The member list shows your avatar, not just your initial (without a coloured ring: your level is not on that phone). 4. Your avatar is next to your name there too. |

## 7. Controlelijst voor Fable (eindcontrole)

1. data/badges.json: alle 44 oude ids aanwezig (6 `retired` met geldige `replacedBy`), 144 actieve badges,
   geen afwijkende namen/drempels t.o.v. §2d; `npm run validate:data` 0 errors, warnings gelezen.
2. `normalizeBadges` blijft tolerant (garbage-test), `evaluateBadges` slaat `retired` over en levert `tier`
   en `maxTier`; `badgeXp` geeft 300 voor ladderniveau 3, 250 voor een gekke geheime, 100 voor een
   ontdekker, 0 voor het hartje.
3. `photos` telt per lid; HOUSEHOLD_KINDS = ownRecipes, received, shared, householdMembers, cooks; op een
   ledentab staan die vijf niet.
4. `cookHour` negeert rijen op precies 12:00:00.000 lokaal; `seasonCooks` loopt goed over de jaarwisseling;
   `fullWeeks` gebruikt dezelfde ISO-weeklogica als `streakWeeks`; `streakDays` gebruikt `longestDayStreak`
   uit src/domain/xp.ts, niet herschreven; `overcooked` leest `facts.xp`.
5. `badges.earned` krijgt `id@k`; één toast per hoogste nieuwe niveau; oude plain ids van ladders breken
   niets; herstel merget earned/features/hearts (unie/max) in plaats van te vervangen.
6. Alle 32 feature-hooks staan op het moment van §2c en zijn één regel; geen hook bij kijken/bladeren;
   `recordFeature` is geserialiseerd en no-op met badges uit.
7. Badgepagina: acht groepen in volgorde, inklapbaar (localStorage), Geheim toont alleen de telling en de
   gevonden kaarten, nergens in de DOM een niet-gevonden geheime badge; `{n}` overal ingevuld; 360 px zonder
   horizontaal scrollen; donker thema leesbaar; 44 px tikdoelen.
8. i18n: elke nieuwe key in NL én EN (badges.*, avatar.*); geen hardgecodeerde tekst in componenten.
9. Avatar: `renderAvatarSvg` tekent lagen in LAYER_ORDER, vervangt `__u`, geen `<script`/`href`; onbekende
   ids overgeslagen; incomplete spec → letterrondje; rand alleen met `level` en vanaf 5; alle 66 onderdelen
   renderen in de browser (één keer de hele bibliotheek op een testpagina bekeken op licht én donker).
10. Maker: alleen vanaf level 3 en alleen voor het actieve profiel; vergrendeld = grijs + uitleg, geheime
    badge-delen zonder badgenaam; Annuleer/wegvegen/Escape bewaart niets; Bewaar schrijft `Profile.avatar`;
    "Terug naar de beginletter" zet `null`.
11. Kaartje: FROZEN_TOKEN_F decodeert nog exact, FROZEN_TOKEN_F_AVATAR levert de avatar, een kapotte avatar
    in een kaartje wordt weggelaten (niet het hele kaartje afgekeurd).
12. `npm run check`, `npm test`, `npm run build`, `npm run build:next` groen; geen nieuwe dependency in
    package.json; Dexie-versie onveranderd door dit blok.
13. DEVICE-TEST 94–97 staan er in NL en EN, in alledaagse taal, en zijn op beide telefoons gedaan voordat
    het blok naar `main` gaat.
14. docs/STATUS.md en docs/phase-6-spec.md (open vraag 1 → beantwoord of nog open) bijgewerkt; het hartje
    staat als "nog niet te verdienen" in STATUS.

## 8. Open vragen voor Stijn

**Beantwoord door Stijn, 23 okt 2026:** vraag 1 → **catalogus en avatar-bibliotheek goedgekeurd** zoals ze
in §2d en §2f staan (Engelse namen als "Fishlover"/"Cuppa" blijven; drempelreeksen en de zes `retired`
badges akkoord). Vragen 2 en 3 kregen geen ander antwoord: de standaard geldt (hartje als eigen klein blok
ná 6D-3, één hartje tot Stijn niveaus wil; avatar-maker vanaf level 3). 6D-2 en 6D-3 zijn vrij om te bouwen.

1. **Goedkeuring van de catalogus (§2d) en de avatar-bibliotheek (§2f)** — dit is de afgesproken stap vóór de
   bouw. Vooral: de namen (mag Engels als "Fishlover"/"Cuppa" blijven staan in de NL-editie?), de
   drempelreeksen (COOK begint op 5 zodat "Eerste hap" het eerste-kookbeurt-moment houdt), en de zes
   `retired` badges. Zeg per punt "ja" of geef een andere naam/getal; Fable past de spec aan, Opus bouwt pas
   daarna.
2. **Het hartje (phase-6 open vraag 1):** akkoord met de route ref + WhatsApp + dank-je-link `#d=` met
   ECDSA-handtekening (§5c), gebouwd als eigen klein blok ná 6D-3? En wil je niveaus (bv. € 5 · 10 · 25 ·
   50 · 100 → één tot vijf hartjes) of blijft het één hartje?
3. **Avatar-maker vanaf level 3** (direct na je eerste kookbeurt) — Fable koos dit omdat de beloning dan
   meteen voelbaar is; wil je het liever iets later (level 5)?
