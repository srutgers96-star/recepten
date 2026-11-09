# Spec V8 — Vegen tussen de vijf tabbladen (Stijn, 29 okt 2026)

Status: in aanbouw (Fable, 9 nov 2026). Eén blok, twee bouwers + integrator (lichte modus). Bron: docs/IDEAS.md idee 6 (Stijn 29 okt:
"horizontaal swipen om naar de volgende/vorige tab van de onderbalk te gaan, zoals in veel apps"). Leidend bij tegenspraak:
docs/specs/README.md §2–§4, docs/specs/handbook.md §4 (handboekrijen), CLAUDE.md invariant 5 (iPhone: niets mag de rand-veeg van iOS
breken) en de huisregel "alleen transform en opacity animeren".
Gebouwd: 9 nov 2026 (V8, lichte workflow; run-id in STATUS)

**Kritische lezer (Fable, vooraf).** (1) Er bestaat al een veeg-helper, `src/swipe.ts` (`useHorizontalSwipe`, pointer-events) voor de
kookstand en de varianten-tabs op de receptpagina. Die is hier NIET bruikbaar: pointer-events krijgen `pointercancel` zodra de browser
de pagina verticaal gaat scrollen, en op de vijf tabbladen is verticaal scrollen het normale gebaar. De tab-veeg gebruikt daarom
touch-events met passieve listeners, net als `src/pulldown.ts`: de browser scrolt gewoon door, en pas bij `touchend` beslissen we op
de afgelegde weg. Een muis of pen veegt nooit (zoals de pull-down). (2) De rand-veeg is op de iPhone (Safari én Home Screen-app)
"terug/vooruit" en op Android de terug-beweging: een aanraking die binnen 24 px van de linker- of rechterrand begint, is nooit een
tab-veeg. (3) Elementen die zelf zijwaarts scrollen mogen geen tab-veeg geven: `.chips` (filterchips), `.list-sort`, `.photo-strip`,
`.vtabs`, `.cat-shelf` (Home), de badge-tabs (badges.css r. 85) en de avatar-lagen (avatar.css r. 153). Niet op klassenaam checken
maar generiek: elk element tussen het aangeraakte element en de luisteraar met `scrollWidth > clientWidth` én `overflow-x` auto of
scroll, plus de ontsnapping `[data-noswipe]`. (4) De pull-down op Home (`usePullDown`, touch) eist dy > |dx|; de tab-veeg eist
|dx| > 2·|dy|: ze kunnen nooit allebei afgaan. (5) Selectiestand op Recepten (`.screen.selecting`, `.select-bar` in de shell) en een
open venster: niet vegen. Venster-portalen (`SheetPortal`) staan onder `<body>`, buiten `.screen-wrap`, dus de luisteraar ziet ze niet;
niet-geportaalde vensters hebben `.sheet-backdrop` als voorouder. (6) De rijen in Recepten en Boodschappen hebben lang-drukken
(`RecipeRow`, `ListRow`), geen veegacties: een zijwaartse beweging > 10 px breekt het lang-drukken al af, en een verplaatste aanraking
geeft geen `click`. Geen conflict. (7) Een transform op `.screen-wrap` tijdens de animatie verplaatst `position: fixed`-kinderen
mee: alleen `.snackbar` (Boodschappen) en `.photo-overlay` staan in de shell, 150 ms, aanvaardbaar. (8) Geen UI-tekst, geen
instelling, geen feature-event (`FEATURE_IDS` blijft 32), geen badge: vegen is een gebaar, geen prestatie (§5b "geen beloning voor
kijken"). Wel een handboekrij en een DEVICE-TEST-rij, want Stijn en Gabi moeten het ontdekken.

**Feitencheck (Fable, in de code).** `src/router.ts`: `route` (signal met `path`, `segments`, `query`), `navigateTab(path)` (vervangt
de geschiedenis behalve de eerste stap weg van Home), `navigate`. `src/components/Nav.tsx`: `TABS` in deze volgorde: `/`, `/recipes`,
`/week`, `/shopping`, `/more`; `tabFor(segment)`. `src/app.tsx`: `<div class="screen-wrap">{onboarding ? <OnboardingScreen/> :
<Screen r={r}/>}</div>`, daaronder `<Nav/>` alleen als `!onboarding`; `needsOnboarding` uit `./profile`. `src/pulldown.ts`:
touch-luisteraars passief op het element van de ref; `ignoredTarget` = `input, textarea, select, .sheet-backdrop`. `src/styles/base.css`
r. 192–216: `.shell { touch-action: manipulation }`, `.screen-wrap { position: relative; flex: 1; display: flex; flex-direction: column }`,
`.screen { overflow-y: auto }`; `@media (prefers-reduced-motion: reduce)` komt al voor (r. 929, 1074). `tests/pulldown.test.ts` test alleen
de pure functie. Handboek: `data/handbook/01-eerste-keer.json`, onderwerp `eerste-keer`, 15 rijen, rij `eerste-keer.tabbladen` ("De vijf
tabbladen"); de validator eist per rij `id` (`eerste-keer.<kebab>`), `title`, `what`, `where` (1–8 stappen, evenveel in nl en en), `see`,
optioneel `know`, `route` uit `HANDBOOK_ROUTES`, `platform` all|android|ios, `keywords` 3–8 per taal, geen jargon (o.a. "sheet",
"standalone"), en een `**naam**` moet letterlijk een i18n-waarde zijn (nav.home = "Home", nav.recipes = "Recepten"/"Recipes", nav.week,
nav.shopping, nav.more = "Meer"/"More"). DEVICE-TEST: rijen 1–116, de NL-tabel eindigt op r. 146, de EN-tabel op r. 307; volgende rij 117.

## 1. Gedrag

### 1a. De pure kant (bouwer A: `src/domain/tabswipe.ts` [nieuw], `tests/tabswipe.test.ts` [nieuw])

Framework-vrij (geen preact, geen dom-types nodig behalve getallen).

- `export const TAB_PATHS = ['/', '/recipes', '/week', '/shopping', '/more'] as const;` — de volgorde van de onderbalk (Nav.tsx `TABS`).
- `export const SWIPE_MIN_PX = 60;` `export const SWIPE_RATIO = 2;` `export const EDGE_PX = 24;` `export const WRAP_AROUND = false;`
- `export type TabSwipeDirection = 'left' | 'right';` — 'left' = de vinger ging naar links (volgend tabblad), 'right' = naar rechts (vorig).
- `export function isTabPath(path: string): boolean` — exact één van `TAB_PATHS` (geen query: de aanroeper geeft `route.path`).
- `export function tabSwipeDirection(dx: number, dy: number): TabSwipeDirection | null` — `|dx| >= SWIPE_MIN_PX` én `|dx| > SWIPE_RATIO · |dy|`,
  anders null.
- `export function startsAtEdge(x: number, viewportWidth: number): boolean` — `x < EDGE_PX || x > viewportWidth - EDGE_PX`.
- `export function neighbourTab(path: string, dir: TabSwipeDirection): string | null` — 'left' = de volgende in `TAB_PATHS`, 'right' = de
  vorige; voorbij het einde: `WRAP_AROUND` false → null (stoppen aan de randen), true → rond. Geen tab-pad → null.
- Tests: elke functie met randgevallen (precies 60 px; 60 px opzij met 30 px omhoog = veeg, met 31 px = geen; 23/24/25 px van de rand;
  Home naar rechts = null; Meer naar links = null; `/recipes?q=x` is geen tab-pad; met `WRAP_AROUND` geforceerd true via een los
  hulpfunctie-argument `wrap = WRAP_AROUND` rond).

### 1b. De dom-kant (bouwer A: `src/tabswipe.ts` [nieuw], `src/app.tsx`, `src/styles/base.css`)

- `src/tabswipe.ts`: `export const slide = signal<TabSwipeDirection | null>(null);` en
  `export function useTabSwipe(ref: RefObject<HTMLElement | null>): void`, opgezet als `usePullDown`: één `useEffect` met passieve
  `touchstart`/`touchmove`/`touchend`/`touchcancel` op `ref.current`.
  - `touchstart`: `start = null`; stop als `e.touches.length !== 1`; als `needsOnboarding.value`; als `!isTabPath(route.value.path)`;
    als `startsAtEdge(t.clientX, document.documentElement.clientWidth)`; als het doel genegeerd wordt (`ignoredSwipeTarget(target, root)`,
    hieronder). Anders `start = { x, y, id: t.identifier }`.
  - `touchmove`: `e.touches.length !== 1` → `start = null` (knijpen). Verder niets: de beslissing valt bij `touchend`.
  - `touchend`: de `changedTouches` met `identifier === start.id`; `dir = tabSwipeDirection(dx, dy)`; `to = neighbourTab(route.value.path,
    dir)`; als `to`: eerst `slide.value = reducedMotion() ? null : dir`, dan `navigateTab(to)`. `start = null`.
  - `touchcancel`: `start = null`.
  - `export function ignoredSwipeTarget(target: EventTarget | null, root: HTMLElement): boolean` — true als `target.closest('input, textarea,
    select, [contenteditable="true"], .sheet-backdrop, .selecting, [data-noswipe]')` iets vindt, of als een element van `target` tot en
    met `root` zijwaarts scrolt: `el.scrollWidth > el.clientWidth + 1` én `getComputedStyle(el).overflowX` is 'auto' of 'scroll'.
    Exporteren zodat de lens het kan nalopen; geen test (dom).
  - `reducedMotion()` = `window.matchMedia('(prefers-reduced-motion: reduce)').matches` (veilig als `matchMedia` ontbreekt → false).
- `src/app.tsx`: `const wrapRef = useRef<HTMLDivElement>(null); useTabSwipe(wrapRef);` in `App` (de hooks staan vóór de early return
  `if (!ready)`; de ref komt pas op het element zodra de shell rendert — de hook moet daarom met een lege `ref.current` kunnen leven:
  zet de effect-afhankelijkheid op `[ready]` door `useTabSwipe(wrapRef, ready)` een tweede argument `active: boolean` te geven; `active`
  false → geen luisteraars). Het element: `<div ref={wrapRef} class={'screen-wrap' + (slide.value ? ' slide-' + slide.value : '')}
  onAnimationEnd={(e) => { if (e.target === e.currentTarget) slide.value = null; }}>` (alleen de eigen animatie, niet die van een kind).
- `src/styles/base.css`, direct onder `.screen.form`:
  ```css
  /* V8: a tab swipe slides the new page in from the side the finger came from (transform + opacity only, 150 ms). */
  .screen-wrap.slide-left { animation: tab-slide-left 0.15s ease-out; }
  .screen-wrap.slide-right { animation: tab-slide-right 0.15s ease-out; }
  @keyframes tab-slide-left { from { transform: translateX(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
  @keyframes tab-slide-right { from { transform: translateX(-24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .screen-wrap.slide-left, .screen-wrap.slide-right { animation: none; } }
  ```
  'left' (vinger naar links, volgend tabblad) = de nieuwe pagina komt van rechts (+24 px → 0); 'right' = van links.

### 1c. Handboek en testrij (bouwer B: `data/handbook/01-eerste-keer.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md` via
`node --experimental-strip-types tools/handbook-md.ts`, `docs/DEVICE-TEST.md`)

- Nieuwe rij direct ná `eerste-keer.tabbladen`, id `eerste-keer.vegen`, `platform: "all"`, `route: "/"`:
  - title nl "Vegen tussen de tabbladen" · en "Swipe between the tabs".
  - what nl "Je hoeft niet op de tabbladen te tikken: veeg over de pagina naar links voor het volgende tabblad en naar rechts voor het
    vorige. De volgorde is die van de balk onderaan: **Home**, **Recepten**, **Week**, **Boodschappen**, **Meer**." · en "You do not have
    to tap the tabs: swipe left across the page for the next tab and right for the previous one. The order is that of the bar at the
    bottom: **Home**, **Recipes**, **Week**, **Shopping**, **More**."
  - where nl ["Open een van de vijf tabbladen onderaan.", "Leg je vinger ergens midden op de pagina.", "Veeg in één beweging duidelijk
    naar links of naar rechts."] · en ["Open one of the five tabs at the bottom.", "Put your finger somewhere in the middle of the
    page.", "Swipe clearly left or right in one movement."]
  - see nl "De volgende of vorige pagina schuift in beeld en het tabblad onderaan licht op. Bij **Home** gaat het niet verder naar
    rechts en bij **Meer** niet verder naar links." · en "The next or previous page slides into view and the tab at the bottom lights
    up. **Home** goes no further right and **More** no further left."
  - know nl "Begin niet aan de rand van het scherm: daar zit de terug-beweging van je telefoon. Op een rij die zelf opzij schuift
    (zoals de keuzeknopjes boven de recepten) schuift die rij, niet de pagina. In een recept, de kookstand en bij het selecteren van
    recepten werkt het vegen niet." · en "Do not start at the edge of the screen: that is where your phone's back gesture lives. On
    a row that slides sideways itself (like the little choice buttons above the recipes) that row slides, not the page. Inside a
    recipe, in cook mode and while selecting recipes, swiping does nothing."
  - keywords nl ["vegen", "swipen", "tabbladen", "volgende pagina", "onderbalk"] · en ["swipe", "tabs", "next page", "bottom bar",
    "gesture"].
- DEVICE-TEST rij 117, NL én EN, in de stijl van rij 116 (stappen genummerd, verwacht resultaat per stap):
  **Vegen tussen de tabbladen (V8).** 1. Tik onderaan op **Home**. Leg je vinger midden op het scherm en veeg naar links; doe dat nog
  drie keer. 2. Veeg op **Meer** nog een keer naar links. 3. Veeg vier keer naar rechts tot je weer op **Home** staat; veeg daar nog een
  keer naar rechts. 4. Tik op **Recepten** en veeg over de rij keuzeknopjes bovenaan naar links. 5. Scrol de receptenlijst omlaag en
  omhoog met een iets schuine beweging. 6. Open een recept en veeg naar links; ga terug. 7. Houd op **Recepten** een recept vast tot
  het selecteren begint en veeg naar links; tik op **Klaar**. 8. *iPhone:* veeg vanaf de uiterste linkerrand naar rechts. *Android:*
  veeg vanaf de uiterste rand naar binnen. 9. Zet de app op Engels en veeg één keer heen en weer. |
  1. Recepten, Week, Boodschappen en Meer komen om de beurt in beeld; elke pagina schuift kort in vanaf rechts en het tabblad onderaan
  licht op. 2. Niets gebeurt: Meer is het laatste tabblad. 3. Elke pagina schuift kort in vanaf links; op Home gebeurt bij de laatste veeg
  niets. 4. De rij knopjes schuift opzij, de pagina blijft Recepten. 5. De lijst scrolt gewoon; de pagina wisselt niet. 6. In een recept
  wisselt het tabblad niet (alleen de ingrediëntentabs van het recept kunnen wisselen). 7. Tijdens het selecteren wisselt de pagina niet.
  8. *iPhone:* de rand-veeg van iOS werkt zoals altijd (terug in de app of in Safari); de pagina wisselt daardoor niet van tabblad.
  *Android:* de terug-beweging van Android werkt zoals altijd. 9. Hetzelfde gedrag in het Engels (de tabbladen heten Home, Recipes,
  Week, Shopping, More). Met "Beweging verminderen" aan in de telefooninstellingen schuift niets: de pagina wisselt zonder animatie.

## 2. Opus mag dit NIET zelf beslissen

- De drempels (60 px, verhouding 2, rand 24 px, 150 ms, 24 px schuif, opacity 0,6) en `WRAP_AROUND = false` (stoppen aan de randen).
- Touch-events, niet pointer-events (zie Kritische lezer 1). Geen `preventDefault`, alle luisteraars passief.
- Geen UI-tekst, geen instelling om het uit te zetten, geen feature-event, geen badge, geen nieuwe dependency.
- Vegen alleen op exact de vijf tab-paden; niet in een recept, de kookstand, de editor, Inbox of een Meer-subpagina.
- De geschiedenis volgt `navigateTab` (vervangen, behalve de eerste stap weg van Home), precies zoals een tik op de balk.

## 3. Bestandsverdeling

| Bouwer | Bestanden |
|---|---|
| A (code) | `src/domain/tabswipe.ts` [nieuw], `tests/tabswipe.test.ts` [nieuw], `src/tabswipe.ts` [nieuw], `src/app.tsx` (ref, hook, class, onAnimationEnd), `src/styles/base.css` (één blok) |
| B (docs) | `data/handbook/01-eerste-keer.json` (één rij), `docs/HANDLEIDING.md` + `docs/HANDBOOK.md` (gegenereerd), `docs/DEVICE-TEST.md` (rij 117 NL + EN) |
| Integrator | samenvoegen, check/test/build/validate groen, acceptatie in de dev-app, `docs/STATUS.md`, de regel "Gebouwd" in deze spec |

**Acceptatie in de dev-app (integrator).** De browser-pane kan geen vinger nadoen; stuur daarom synthetische touch-events met de
javascript-tool op `document.querySelector('.screen-wrap')`: `new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target,
clientX: 200, clientY: 300 })], bubbles: true })`, daarna `touchend` met `changedTouches` op clientX 100 (veeg naar links) — verwacht
`location.hash === '#/recipes'` vanaf Home en de class `slide-left` kort op `.screen-wrap`; vanaf `#/more` naar links verandert niets;
start op clientX 10 verandert niets; start binnen `.chips` op Recepten verandert niets (als `scrollWidth > clientWidth`, anders die check
overslaan en dat melden); `#/recipe/<id>` verandert niets; dx 60 met dy 31 verandert niets. Daarna `npm test` (de nieuwe tests) en de
handboekpagina (Meer → Handleiding → Eerste keer → Vegen tussen de tabbladen) in NL en EN.
