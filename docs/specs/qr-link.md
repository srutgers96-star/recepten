# Spec 13Q — QR én link bij elke deelknop; de boodschappenlijst als link (`#l=`)

Status: compleet (Fable, 8 nov 2026). Eén blok, drie bouwers + integrator (lichte modus). Bron: Stijn (30 okt 2026):
"elke deelknop die een link is: deel via link en deel via QR. Recepten, boodschappenlijsten en kaartje via link of QR
zou ideaal zijn." Leidend bij tegenspraak: docs/specs/README.md §2, CLAUDE.md invarianten 4, 5, 6, 7 en 9, ADR-0004
(tokens) en ADR-0007 (QR: `qrcode` lazy, alleen encoderen, scannen met de camera-app van de telefoon).
**Na de lens (besluit Fable, 8 nov):** (1) grens 1.200 → 1.600 tekens met foutniveau L en een QR van 320 px (zie 1b); een recept
past daarmee ongeveer de helft van de keren, de link werkt altijd. (2) Een lijst van ±100+ regels heeft geen link (de tekst wordt
een bestand): aanvaard voor nu; afwerkronde: de link negeert de berichtgrens (één veld {text}) of toont de reden. (3) Een
gedeelde regel verliest zijn kwalificatie ("rode ui" → "ui"): aanvaard voor nu; afwerkronde: `variant` optioneel in
`ListShareLine` en matchen op ing+variant. (4) Delen als tekst logt geen 'out'-rij, de link wel: akkoord. (5) Engelse teksten
en landingsteksten van de bouwers akkoord. (6) `more.experimentsHint` noemt de QR niet meer (Fable). (7) Landing-chunk 24,9 →
29,6 kB gzip door `buildListEnvelope` in share.ts: aanvaard; afwerkronde: eigen module. (8) Opschoonronde: `share.qrShow`,
`share.qrHide`, `household.cardQrHint` ongebruikt; `addListLinesFromShare` schrijft ook als alles is overgeslagen.
Gebouwd: 8 nov 2026 (13Q, workflow wf_55088b35-038; nabewerking (1) en (6) door Fable)

## 1. Doel en gebruikersgedrag

1a. **Overal twee knoppen.** Waar de app nu een link deelt of kopieert, staat naast **Deel** (share sheet) en **Kopieer link**
een derde knop **Toon QR**: het recept (ShareScreen, `#r=`/`#p=`), de selectie en de weggeef-bundel (RecipesScreen,
`#b=`), het weekplan (WeekScreen, `#w=`), het kaartje (MemberCardPanel, `#f=`, bestaat al), de voortgang
(ProgressSharePanel, `#x=`) en nieuw de boodschappenlijst (ShoppingScreen, `#l=`). De QR verschijnt onder de knoppen
in een blok (`QrPanel`): de code (±220 px, wit vlak met marge, ook in het donkere thema), eronder de regel
`share.qrHint` NL "Laat de ander dit scannen met de camera van de telefoon." · EN "Let the other person scan this with
their phone camera." Tik nogmaals op Toon QR of ernaast → dicht. De Experimenten-vlag gaat van de QR af (ShareScreen).

1b. **Eerlijke grens.** Een QR met meer dan **1.600 tekens** in de URL wordt op een telefoon onbetrouwbaar gescand
(boven versie ±27 bij foutniveau L, getekend op 320 px; Fable 8 nov: was 1.200, maar de helft van de recepten zit tussen 1.200 en 1.700). Past de link niet, dan toont Toon QR geen code maar de regel `share.qrTooBig` NL "Te groot voor
een QR-code. Deel de link." · EN "Too big for a QR code. Share the link instead." (de knop blijft, zodat je begrijpt waarom).
Een weggeef-bundel past vrijwel nooit; een los recept ongeveer de helft van de keren (gemeten: mediaan ±1.700 tekens, 4 van
50 onder de 1.200); kaartje, voortgang en een lijst vrijwel altijd. De grens staat in één constante `QR_MAX_URL_CHARS = 1600` (src/domain/qr-fit.ts) met pure `qrFits(url)`.

1c. **De boodschappenlijst als link (`#l=`).** Op Boodschappen krijgt het deelblok naast "Deel als tekst" en "Kopieer als
tekst" de knoppen **Deel link** / **Kopieer link** / **Toon QR**. De link draagt de lijst zoals de tekst hem toont: de
regels die niet "in huis" zijn (afgevinkte regels volgens de bestaande schakelaar `shareHideChecked`), met titel
("Boodschappen week 46"). Ontvangen: **In & uit** herkent de link (en het geplakte token) en toont een kaart
"🛒 Lijst van {name} · {n} regels" met de regels als tekst en één knop **Zet op mijn lijst**: elke regel komt als
handmatige regel (`manual`) op de eigen weeklijst, met ingrediënt, aantal, eenheid en gangpad als die herkend zijn;
een regel waarvan het ingrediënt al op de lijst staat wordt overgeslagen (één snack "{n} regels op je lijst gezet, {m}
stonden er al"). Niets wordt samengeteld. Op de iPhone (Safari, niet standalone) opent de link de landingspagina met
de lijst als tekst en de bestaande kopieerknop (invariant 5/6).

1d. **Wat niet verandert.** Geen scanner in de app (ADR-0007), geen camera-permissie. Een `#l=` is geen weekplan: het
plant niets en raakt het weekplan niet. De bestaande tekstdeling blijft ("Deel als tekst" is voor WhatsApp-lezers zonder
de app).

## 2. Datamodel en deelformaat

- **Nieuwe fragmentsleutel `l`** (invariant 4: nieuwe sleutel, nooit een herinterpretatie). Envelop
  `{ v: 2, t: 'l', by, at, l: ListShare }` met
  ```ts
  export interface ListShare {
    title: Text;                       // {nl, en}: "Boodschappen week 46" in beide talen (invariant 3)
    lines: ListShareLine[];            // max 200
  }
  export interface ListShareLine {
    raw: Text;                         // de regel zoals getoond, per taal ("400 g gehakt" / "400 g minced meat")
    ing?: string | null;               // ingrediënt-id als herkend
    qty?: number | null; unit?: string | null; aisle?: string | null;
    [k: string]: unknown;              // onbekende sleutels blijven
  }
  ```
  `buildListEnvelope(items, dict, by, { title, hideChecked, hideInHouse })` (share.ts) bouwt hem uit `ListItem[]` met
  `renderListItem` per taal; `readListPayload(v)` leest tolerant (title via `readOptionalText`-regels, lines alleen met
  een `raw`-tekst in minstens één taal, max 200, getallen alleen als eindige getallen); `parseEnvelope` → `kind: 'list'`,
  `ParsedShare.list?: ListShare`; `combineEnvelopes` laat `l` vallen; `planMessages` geeft voor één `l` de tekst
  `share.listMessage` NL "🛒 Boodschappenlijst van {name} — {n} regels. Open de link in de app of plak hem bij In & uit."
  · EN "🛒 {name}'s shopping list — {n} lines. Open the link in the app or paste it into In & out." met de URL alleen op de
  laatste regel. `TokenKey` + 'l', `TOKEN_RE [rpwbfxl]`, boot.ts `(r|p|w|b|f|x|l)`, router.ts, landing.ts, pwa.ts
  `urlForChrome` (dezelfde vijf plekken als bij `x`, zie xp-levels.md §2h). Bevroren `FROZEN_TOKEN_L`/`_FFLATE`/
  `FROZEN_ENVELOPE_L` in tests/fixtures/frozen-share-tokens.ts (alleen toevoegen).
- **Ontvangst:** `Collected.lists: ListShare[]` (paste.ts; eerste per `at`+`by` wint), `summarizePaste`-label
  `paste.list` NL "Boodschappenlijst van {name}" · EN "{name}'s shopping list". `ShareEvent.kind` + 'list' bestaat al
  (`'list'`, repo.ts `SHARE_EVENT_KINDS`); "Zet op mijn lijst" logt één 'in'-rij, delen logt één 'out'-rij kind 'list'
  (daarna `recheckActiveBadges()`; het haakje `listShared` bestaat al en blijft op de tekstdeling én de linkdeling).
- **Op de eigen lijst zetten:** repo.ts `addListLinesFromShare(lines: ListShareLine[], dict): Promise<{ added: number;
  skipped: number }>`: per regel `addExtra`-pad (bestaande handmatige-regel-logica van ExtraField/`addExtraItem`) met
  `ing/qty/unit/aisle` als meegegeven, anders de `raw` in de UI-taal als vrije tekst; overslaan als `ing` al op de lijst
  staat (`items.some(it => it.ing === line.ing && !it.checked)`) of, zonder `ing`, dezelfde genormaliseerde tekst.
- Geen nieuwe setting, geen Dexie-versie. README §2b-register: sleutel `l`, `Collected.lists`, `paste.list`.
  CLAUDE.md invariant 7 en de tokenregel krijgen `#l=` (Fable bij de commit). ADR-0004 één regel: "8 nov 2026: sleutel `l`
  (boodschappenlijst) toegevoegd; bevroren token in tests".

## 3. Bestandsverdeling en contracten

**Bouwer A — contract en ontvangstpad** (`src/domain/token.ts`, `src/domain/share.ts`, `src/domain/qr-fit.ts` [nieuw],
`src/boot.ts`, `src/router.ts`, `src/landing.ts` (de lijst als tekst + bestaande kopieerknop), `src/pwa.ts` (alleen de regex),
`src/paste.ts`, `src/domain/paste-classify.ts` alleen als de regex daar apart staat, `tests/fixtures/frozen-share-tokens.ts`
[toevoegen], `tests/token.test.ts`, `tests/share.test.ts`, `tests/qr-fit.test.ts` [nieuw], `tests/paste.test.ts`).
Exports: `ListShare`, `ListShareLine`, `buildListEnvelope`, `readListPayload`, `QR_MAX_URL_CHARS`, `qrFits(url: string): boolean`.

**Bouwer B — QrPanel en de knoppen** (`src/components/QrPanel.tsx` [nieuw: props `{ url: string; open: boolean; onToggle(): void;
label?: string }`, gebruikt `QrCode`, toont `share.qrTooBig` als `!qrFits(url)`, `share.qrHint` eronder], `src/components/QrCode.tsx`
alleen als de marge/achtergrond voor het donkere thema ontbreekt, `src/screens/ShareScreen.tsx` (QR zonder Experimenten-vlag,
via QrPanel; de vlag-code eruit), `src/screens/RecipesScreen.tsx` (Toon QR bij de selectie en bij Exporteer, met de grens),
`src/screens/WeekScreen.tsx` (Toon QR bij het weekplan), `src/components/ProgressSharePanel.tsx` (Toon QR), `src/screens/ProfilesScreen.tsx`
alleen `MemberCardPanel` → QrPanel i.p.v. de losse QrCode, `src/styles/base.css` (`.qr-panel`), `src/i18n/common.ts` of
`edit.ts` (`share.qr`, `share.qrHint`, `share.qrTooBig`, NL én EN; één plek)).

**Bouwer C — de lijst delen en ontvangen** (`src/screens/ShoppingScreen.tsx` (deelblok: Deel link / Kopieer link / Toon QR via
QrPanel; bouwt de envelop met `buildListEnvelope` over dezelfde regels als de tekst; logt 'out' kind 'list'), `src/db/repo.ts`
(`addListLinesFromShare`), `src/screens/InboxScreen.tsx` (kaart "Lijst van {name}" met de regels en **Zet op mijn lijst**; logt 'in'),
`src/components/ImportPreview.tsx` alleen als de kaart daar hoort volgens het bestaande patroon van kaartjes/voortgang,
`src/i18n/shopping.ts` (`shop.shareLink`, `shop.copyLink`, `shop.list.received`, `shop.list.put`, `shop.list.putSnack`),
`src/i18n/edit.ts` (`paste.list`, `inbox.ev.list` als die ontbreekt), `tests/list-share.test.ts` [nieuw: envelop uit regels,
tolerant lezen, de overslaan-regel als pure functie]).

**Integrator:** check/test/build/build:next/validate; acceptatie in de dev-app (QR zichtbaar op alle zes plekken, te-groot-regel bij
een bundel, lijst delen → plakken in In & uit → Zet op mijn lijst; landing met een `#l=`); DEVICE-TEST rij 106 "Deel via QR en de
lijst als link" (NL én EN): (1) recept → Deel → Toon QR → code zichtbaar, scan met de andere telefoon → landing/app; (2) Boodschappen
→ Deel link → op de andere telefoon In & uit → Zet op mijn lijst → regels staan erop, dubbele overgeslagen; (3) Recepten → Selecteer
alles → Exporteer → Toon QR → "Te groot voor een QR-code. Deel de link."; STATUS-kop "… (Opus): 13Q — QR en link overal, de lijst
als link"; ADR-0004 regel; README §2b.

## 4. Regels en eerlijkheid

1. Nieuwe sleutel, geen herinterpretatie; bestaande bevroren tokens blijven byte-gelijk (invariant 4).
2. De landing schrijft niets (invariant 6); op de iPhone opent een link nooit "de app" (invariant 5): de landing zegt dat eerlijk.
3. `navigator.share` met precies één veld (invariant 9): de link gaat als `{ text }` met de bestaande tekstregel erboven.
4. De QR-grens is een getal, geen gevoel: `qrFits` is puur en getest; de UI zegt waarom er geen code is.
5. "Zet op mijn lijst" telt niets samen en raakt het weekplan niet; een ontvangen lijst is handmatige regels.
6. Geen scanner, geen camera-permissie (ADR-0007).

## 5. Testplan

- tests/token.test.ts: `FROZEN_TOKEN_L` decodeert op beide engines, encode byte-gelijk; onbekende soort blijft 'z'; `[rpwbfx]` ziet `#l=` niet.
- tests/share.test.ts: `buildListEnvelope` over drie regels (NL/EN raw), `readListPayload` tolerant (geen raw → regel weg, > 200 → afgekapt,
  onbekende sleutels blijven), `parseEnvelope` → kind 'list', `combineEnvelopes` laat `l` vallen, `planMessages` voor één `l`.
- tests/qr-fit.test.ts: 1.600 past, 1.601 niet; een echte `#r=` van een kort recept past; een bundel van 20 recepten niet.
- tests/list-share.test.ts: de overslaan-regel (zelfde ing → overslaan; zelfde tekst zonder ing → overslaan; anders toevoegen).
- tests/paste.test.ts: een geplakte `#l=` komt in `Collected.lists`, `summarizePaste` noemt "Boodschappenlijst van …".

## 6. Controlelijst voor Fable

1. Zes plekken met Toon QR, allemaal via QrPanel; de Experimenten-vlag heeft geen QR-rol meer.
2. `#l=` in token.ts, boot.ts, router.ts, landing.ts, pwa.ts; CLAUDE.md invariant 7 en tokenregel.
3. Bevroren L-token aanwezig; geen bestaand token veranderd.
4. De te-groot-regel verschijnt bij een bundel en nooit bij een kaartje.
5. Landing met `#l=`: tekst + kopieerknop, geen storage.
