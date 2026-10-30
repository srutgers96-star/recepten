// '#/recipe/:id' — detail (docs/phase-1-spec.md §5, phase-2 §5): name, category + tags, meta,
// servings scaler, Koken / Deel, "+ Deze week" (phase 4), ★, ingredient lines through the dictionary (scaled, with
// "Koppel ingrediënt"), numbered steps with timer chips (°F when enabled), "Bij dit gerecht",
// notes per profile (autosave), and own → Bewerk / Verwijder, classic → "Maak eigen kopie".
// Phase 5 (docs/phase-5-spec.md A.3): diet chips under the title (vegetarisch · vegan · glutenvrij
// and the -optie tags); for own recipes derived live from the lines, "waarschijnlijk" when unsure.
// Phase 5 block D (1-2): latest own photo as hero + gallery strip with a big-view overlay and
// "+ Foto" (photos never travel in tokens), and Print / "Kopieer als tekst" (src/print.ts +
// src/domain/recipe-text.ts); on iOS the Print button is an honest share-sheet hint instead.
// Phase 5 block F (2): a personal version (an own recipe with `variantOf`) shows "Versie van <origineel>".
// 13D blok 2 (docs/specs/varianten-tabs.md §1a–§1d): the old "Maak … versie" buttons and "Ook als:"
// chips are gone. Above "Ingrediënten" a tab row (VariantTabs) offers Origineel · the diet tabs
// (`variantTabs`: dashed = proposal, full = approved, ✓ = naturally so) · the personal versions
// (repo.variantsOf), shown only when there is something to choose. The choice comes from `?v=`, else
// the tab remembered on this phone (src/vtab-memory.ts), else Origineel; a tap or a swipe on the
// ingredient section (src/swipe.ts) sets both. A diet tab shows a status line (approve / check again /
// approved by … with Intrekken) and the lines of `variantView` with markings (coloured bar = swapped,
// orange dot = check yourself); the steps get the same lines, so their green words follow the swaps.
// A personal-version tab shows that version's lines and steps with "Open als recept". Koken,
// ✓ Gekookt, Deel and + Deze week follow the tab (§1d); the approve sheet (VariantSheet) writes
// through repo.approveVariant, Intrekken through repo.revokeVariant.
// Phase 6 (docs/phase-6-spec.md 6A.3): "✓ Gekookt" next to Koken logs a cook without cook mode
// (CookedSheet → src/cooklog.ts recordCooked); when the active member's latest cook of this recipe
// has no stars, a "Beoordeel" row opens the same sheet in rate mode. Home's "Recent gekookt" links
// here with '?rate=<cook-log id>' to open that rate sheet for that one entry straight away.
// 13I (docs/phase-6-spec.md): the steps get the effective lines and the chosen-servings factor, so
// the ingredients they name are green and a tap shows the scaled amount (the cook-mode setting
// "Toon hoeveelheden" applies here too; this page has no button of its own).
// 13K block 2 (docs/specs/kookbalk.md): a ⏱ chip here starts the "Nu aan het koken" session at that
// step, or moves a session on an earlier step up to it; a chip on an earlier step only keeps the
// session alive (never back from step 5 to step 2). Deleting an own recipe ends its session.
// 6B blok 3 (docs/specs/labels-categorieen.md §1b): next to the category a chip "🇮🇹 Italiaans" for
// the recipe's cuisine (nothing without one); on an own/received recipe it opens the editor, on a
// classic it is plain text.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { isIOS } from '@/components/AppInfo';
import { CookedSheet, type CookedSheetMode } from '@/components/CookedSheet';
import { Header } from '@/components/Header';
import { IngredientList, type LineMark } from '@/components/LineView';
import { formatShortDate } from '@/components/RecipeRow';
import { rememberServings, rememberedServings, ServingsPicker } from '@/components/ServingsPicker';
import { hasAmountsToShow, shownStep, StepView, useFahrenheit } from '@/components/StepView';
import { TimerBar } from '@/components/TimerBar';
import { VariantSheet } from '@/components/VariantSheet';
import { nextTabChoice, tabChoiceFromParam, tabChoiceToParam, VariantTabs, type TabChoice } from '@/components/VariantTabs';
import { endCooking, loadCooking, sessionFor, touchCooking } from '@/cooking';
import { useLive } from '@/db/live';
import type { Photo } from '@/db/model';
import {
  addPhoto,
  addToPlan,
  allRecipes,
  cookStats,
  deletePhoto,
  deleteUserRecipe,
  duplicateAsOwn,
  getCookLogEntry,
  getHousehold,
  getNote,
  getOverride,
  getPlan,
  getRecipe,
  isBuiltinId,
  latestCookFor,
  listFavorites,
  listPhotos,
  revokeVariant,
  saveOverride,
  saveUserRecipe,
  setNote,
  setPlanVariant,
  toggleFavorite,
  variantsOf,
} from '@/db/repo';
import { DIET_ROW_TAGS, OPTIE_TAG, cuisineLabel, tagTextLabel } from '@/components/FilterChips';
import { dictionary, lineText } from '@/dictionary';
import { DIET_TAGS, dietTags, type DietTag } from '@/domain/diet';
import type { Dictionary } from '@/domain/dictionary';
import { memberById, membersFrom, type Member } from '@/domain/household';
import { hasLang, nowIso, pickText, type Lang, type Line, type Recipe } from '@/domain/model';
import { ingredientsAsText, recipeAsText, type RecipeTextInput } from '@/domain/recipe-text';
import { tagsWithVariants, variantTabs, variantView, versionName, type VariantDiet } from '@/domain/variants';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';
import { useRecipeLines } from '@/lines';
import { encodePhotoFile, usePhotoUrl } from '@/photo';
import { printPage } from '@/print';
import { activeProfile, profiles } from '@/profile';
import { noteViewed } from '@/recent';
import { navigate, route } from '@/router';
import { copyText } from '@/share-actions';
import { showAmounts } from '@/step-amounts';
import { swapsData } from '@/swaps';
import { useHorizontalSwipe } from '@/swipe';
import { rememberedTab, rememberTab } from '@/vtab-memory';
import { markXpDirty, settleXp } from '@/xp';

const NOTE_DEBOUNCE_MS = 600;

/** One diet chip on the detail page: the tag and whether it is only probable ("waarschijnlijk"). */
interface DietChip {
  tag: string;
  unsure: boolean;
}

/**
 * The diet chips under the title (docs/phase-5-spec.md A.3). An untouched classic shows its
 * stored tags (derived from the ingredients at build time, tools/derive-tags.ts). An own or
 * received recipe — and a classic whose lines were adjusted (an override with `lines`, or a
 * hand-linked ingredient) — shows its stored diet tags plus what `dietTags` finds in its
 * effective lines right now; a tag that is not stored and rests on lines the dictionary cannot
 * judge is marked "waarschijnlijk". The -optie tags (vega-optie, …) are shown as stored, after
 * the diet tags. 13D blok 3 (docs/specs/varianten-tabs.md §1g): the tags are read through
 * `tagsWithVariants`, so an approved diet tab shows as its "-optie" chip (glutenvrij-optie, …);
 * `recipe.tags` itself never changes.
 */
function dietChipsFor(recipe: Recipe, lines: readonly Line[], dict: Dictionary, linesAdjusted: boolean): DietChip[] {
  const stored = new Set(tagsWithVariants(recipe));
  const out: DietChip[] = [];
  if (recipe.origin.kind === 'builtin' && !linesAdjusted) {
    for (const tag of DIET_TAGS) if (stored.has(tag)) out.push({ tag, unsure: false });
  } else {
    const facts = dietTags(lines, dict);
    for (const tag of DIET_TAGS) {
      if (stored.has(tag)) out.push({ tag, unsure: false });
      else if (facts[tag] === true) out.push({ tag, unsure: facts.unsure.includes(tag as DietTag) });
    }
  }
  for (const tag of DIET_TAGS) if (stored.has(OPTIE_TAG[tag])) out.push({ tag: OPTIE_TAG[tag], unsure: false });
  return out;
}

function originLine(r: Recipe, l: 'nl' | 'en', all: Recipe[] | undefined): string {
  const o = r.origin;
  if (o.kind === 'received') return o.receivedFrom ? t('recipe.received', { name: o.receivedFrom }) : t('recipe.receivedAnon');
  if (o.kind === 'user') {
    const base = o.basedOn ? all?.find((x) => x.id === o.basedOn) : undefined;
    const own = o.author ? t('recipe.ownBy', { name: o.author }) : t('recipe.own');
    return base ? `${own} · ${t('recipe.basedOn', { name: pickText(base.name, l) })}` : own;
  }
  return t('recipe.classic');
}

/** Label of a tag (data/recipes.json `tags`); unknown tags show their id. */
export function tagLabel(tag: string): string {
  const key = 'tag.' + tag;
  const label = t(key);
  return label === key ? tag : label;
}

const ORIGINAL_TAB: TabChoice = { kind: 'original' };

/** How long a line under the tab row stays ("Glutenvrij versie goedgekeurd"; the copy flash: 2.5 s). */
const VT_FLASH_MS = 2500;

/**
 * The maker of a personal version as its origin names them (13D §1b "Versie van {name}"): who sent it
 * for a received recipe, the author otherwise; null when there is no name.
 */
function makerName(r: Recipe): string | null {
  const who = r.origin.kind === 'received' ? r.origin.receivedFrom : r.origin.author;
  return typeof who === 'string' && who.trim() ? who.trim() : null;
}

/** True when the event started inside a sheet (`.sheet-backdrop`) that lives in the page tree. */
function inSheet(e: Event): boolean {
  const el = e.target as Element | null;
  return !!el && typeof el.closest === 'function' && el.closest('.sheet-backdrop') !== null;
}

/** "(glutenvrije versie)" after the name in the copied / printed text of a diet tab (13D §1d). */
function dietVersionSuffix(diet: VariantDiet): string {
  return t('vt.version.' + diet).toLocaleLowerCase();
}

/** First letter of a member name for the little colour dot on a thumbnail. */
function memberInitial(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toLocaleUpperCase() : '?';
}

/** One 72 px thumbnail in the gallery strip, with the member's colour dot + initial. */
function PhotoThumb(props: { photo: Photo; member: Member | undefined; onOpen: (p: Photo) => void }) {
  const url = usePhotoUrl(props.photo);
  const m = props.member;
  return (
    <button
      type="button"
      class="photo-thumb"
      aria-label={m ? t('recipe.photoBy', { name: m.name }) : t('recipe.photoView')}
      onClick={() => props.onOpen(props.photo)}
    >
      {url && <img class="photo-thumb-img" src={url} alt="" loading="lazy" />}
      {m && (
        <span class="photo-dot" style={{ background: m.color }} aria-hidden="true">
          {memberInitial(m.name)}
        </span>
      )}
    </button>
  );
}

/**
 * Full-screen photo viewer (no library): tap the backdrop, the × or Escape to close;
 * "Verwijder" asks once, then calls onDelete. Deliberately dark in both themes.
 */
function PhotoOverlay(props: { photo: Photo; member: Member | undefined; busy: boolean; onClose: () => void; onDelete: (p: Photo) => void }) {
  const l = lang.value;
  const url = usePhotoUrl(props.photo);
  const [confirm, setConfirm] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // aria-modal hides the background from assistive tech but moves no focus by itself: put it on
  // the × on open and hand it back to the opener (the tapped thumbnail) on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus();
    return () => opener?.focus();
  }, []);
  const meta = [props.member?.name, formatShortDate(props.photo.at, l)].filter((x): x is string => !!x).join(' · ');
  return (
    <div class="photo-overlay no-print" role="dialog" aria-modal="true" aria-label={t('recipe.photoView')} onClick={onClose}>
      <div class="photo-overlay-top" onClick={(e) => e.stopPropagation()}>
        <span class="photo-overlay-meta">{meta}</span>
        <button ref={closeBtn} type="button" class="photo-overlay-close" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>
      {url && <img class="photo-overlay-img" src={url} alt="" onClick={(e) => e.stopPropagation()} />}
      <div class="photo-overlay-foot" onClick={(e) => e.stopPropagation()}>
        {confirm ? (
          <>
            <p class="photo-overlay-ask">{t('recipe.photoDeleteConfirm')}</p>
            <div class="actions">
              <button type="button" class="btn btn-danger" disabled={props.busy} onClick={() => props.onDelete(props.photo)}>
                {t('recipe.deleteYes')}
              </button>
              <button type="button" class="btn" onClick={() => setConfirm(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </>
        ) : (
          <button type="button" class="btn btn-danger" onClick={() => setConfirm(true)}>
            {t('common.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

export function RecipeScreen(props: { id: string }) {
  const id = props.id;
  const l = lang.value;
  const profile = activeProfile.value;
  const pid = profile?.id ?? '';
  const recipe = useLive(async () => (await getRecipe(id)) ?? null, [id]);
  const favs = useLive(() => (pid ? listFavorites(pid) : Promise.resolve(new Set<string>())), [pid]);
  const stats = useLive(() => cookStats(id), [id]);
  const all = useLive(allRecipes, []);
  const lines = useRecipeLines(recipe);
  // A classic whose ingredient lines differ from the shipped ones: an override patch with
  // `lines`, or a hand-linked ingredient (line override). Its diet chips are then derived live.
  const override = useLive(() => (isBuiltinId(id) ? getOverride(id) : Promise.resolve(undefined)), [id]);
  // (applyLineOverrides copies the array but keeps the untouched line objects, hence the per-line check.)
  const linesAdjusted = Array.isArray(override?.patch?.lines) || (!!recipe && lines.some((ln, i) => ln !== recipe.lines[i]));
  const fahrenheit = useFahrenheit();
  const dict = dictionary.value;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimer = useRef<number | null>(null);
  const noteDirty = useRef<string | null>(null);
  // Servings: the session memory for this recipe, else the recipe's own (classics: 4).
  const [chosen, setChosen] = useState<number | null>(() => {
    const n = rememberedServings(id, 0);
    return n > 0 ? n : null;
  });
  const [editCat, setEditCat] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  // Phase 4: "+ Deze week" / "Staat in je week" (the plan is live: the tick follows cook mode).
  const plan = useLive(getPlan, []);
  const [weekBusy, setWeekBusy] = useState(false);
  // Phase 5 block D: own photos, newest first (photos[0] is the hero), plus the big-view overlay
  // and "+ Foto". The member dot on a thumb comes from the household (profiles + hand-added members).
  const photos = useLive(() => listPhotos(id), [id]);
  const hero = photos?.[0];
  const heroUrl = usePhotoUrl(hero);
  const household = useLive(getHousehold, []);
  const members = useMemo(() => membersFrom(profiles.value, household), [household, profiles.value]);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoDelBusy, setPhotoDelBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  // Phase 5 block D: Print / "Kopieer als tekst" share one small chooser (heel recept / alleen
  // ingrediënten). iOS gets a share-sheet hint instead of a Print button (invariant 13).
  const ios = isIOS();
  const [toolsMenu, setToolsMenu] = useState<'print' | 'copy' | null>(null);
  const [copyFlash, setCopyFlash] = useState<'ok' | 'fail' | null>(null);
  const flashTimer = useRef<number | null>(null);
  // 13D blok 2: the personal versions of this recipe (live: a new one shows as a tab at once), the
  // approve sheet of the chosen diet tab and the short line under the tab row.
  const versions = useLive(() => variantsOf(id), [id]);
  const [approveSheet, setApproveSheet] = useState(false);
  const [vtFlash, setVtFlash] = useState<{ text: string; fail: boolean } | null>(null);
  const vtFlashTimer = useRef<number | null>(null);
  // Phase 6 A.3: "✓ Gekookt" / "Beoordeel". The active member's latest cook of this recipe decides
  // whether a rating is still missing. `undefined` = still loading, `null` = never cooked by them
  // (useLive's own undefined would otherwise collide with "no entry").
  const lastCook = useLive(() => (pid ? latestCookFor(id, pid).then((e) => e ?? null) : Promise.resolve(null)), [id, pid]);
  const needsRating = !!lastCook && !lastCook.stars;
  const [cookedSheet, setCookedSheet] = useState<CookedSheetMode | null>(null);
  // The recipe the "✓ Gekookt" sheet logs: on a personal-version tab the version (13D §1d).
  const [cookedFor, setCookedFor] = useState(id);
  const [cookedFlash, setCookedFlash] = useState<string | null>(null);
  const cookedFlashTimer = useRef<number | null>(null);
  // '?rate=<cook-log id>' (Home → "★ Beoordeel" on one row of "Laatst gekookt") opens the rate sheet
  // for THAT entry — not for the latest cook of this recipe, which may be another, already rated
  // one — once it is checked to be this recipe's, this member's and still without stars. The query
  // then leaves the URL, so a reload or the back gesture never reopens it. Anything else (unknown
  // id, someone else's cook, already rated) = the query is just dropped.
  const rateParam = route.value.query.get('rate');
  useEffect(() => {
    if (rateParam === null) return;
    let cancelled = false;
    const entryId = /^\d+$/.test(rateParam) ? Number(rateParam) : null;
    const lookup = entryId === null || !pid ? Promise.resolve(undefined) : getCookLogEntry(entryId);
    void lookup
      .catch((e: unknown) => {
        console.error('getCookLogEntry', e);
        return undefined;
      })
      .then((entry) => {
        if (cancelled) return;
        if (entry && entry.recipeId === id && entry.profileId === pid && !entry.stars) {
          setCookedFor(id);
          setCookedSheet({ kind: 'rate', entry });
        }
        // Only ?rate= leaves the URL; a chosen tab (?v=) stays.
        const v = route.value.query.get('v');
        navigate('/recipe/' + id + (v ? '?v=' + encodeURIComponent(v) : ''), { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [rateParam, id, pid]);

  // Phase 6 (13A-2): "Recent bekeken" in the recipe list — opening a recipe moves it to the front
  // (src/recent.ts, per phone, never in a backup). Only for a recipe that exists.
  useEffect(() => {
    if (recipe) noteViewed(recipe.id);
  }, [recipe?.id]);

  // The delete confirmation is per recipe, in memory only.
  useEffect(() => {
    setConfirmDelete(false);
    setEditCat(false);
    setViewPhoto(null);
    setToolsMenu(null);
    setPhotoError(false);
    setApproveSheet(false);
    setVtFlash(null);
    setCookedSheet(null);
  }, [id]);

  // The "Gekopieerd ✓" and "Gekookt ✓" flashes never outlive the screen.
  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      if (cookedFlashTimer.current !== null) window.clearTimeout(cookedFlashTimer.current);
      if (vtFlashTimer.current !== null) window.clearTimeout(vtFlashTimer.current);
    },
    [],
  );

  // Notes: load per recipe + profile; autosave debounced; flush on leave.
  useEffect(() => {
    let cancelled = false;
    setNoteText('');
    setNoteSaved(false);
    noteDirty.current = null;
    if (pid) {
      void getNote(id, pid).then((text) => {
        if (!cancelled) setNoteText(text);
      });
    }
    return () => {
      cancelled = true;
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
      noteTimer.current = null;
      if (noteDirty.current !== null && pid) void setNote(id, pid, noteDirty.current);
      noteDirty.current = null;
    };
  }, [id, pid]);

  function onNoteInput(text: string) {
    setNoteText(text);
    setNoteSaved(false);
    noteDirty.current = text;
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      const pending = noteDirty.current;
      noteDirty.current = null;
      if (pending === null || !pid) return;
      void setNote(id, pid, pending).then(() => setNoteSaved(true));
    }, NOTE_DEBOUNCE_MS);
  }

  // --- 13D blok 2: the variant tabs (docs/specs/varianten-tabs.md §1a–§1d) ---
  // Per active diet the status of its tab over the EFFECTIVE lines (an approval's indexes point at
  // them), and whether the row shows at all (something to choose: a non-natural diet or a version).
  const tabs = useMemo(
    () => (recipe ? variantTabs(lines, recipe.variants, swapsData, dict, versions?.length ?? 0) : null),
    [recipe, lines, dict, versions],
  );
  // The choice: ?v= → the tab remembered on this phone → Origineel; a tab that does not (or no
  // longer) exist is Origineel. Derived on every render, so it settles once the versions are read.
  const vParam = route.value.query.get('v');
  const choice: TabChoice = tabs?.show ? tabChoiceFromParam(vParam ?? rememberedTab(id), tabs.diets, versions ?? []) : ORIGINAL_TAB;
  const dietChoice: VariantDiet | null = choice.kind === 'diet' ? choice.diet : null;
  const view = useMemo(
    () => (recipe && dietChoice ? variantView(dietChoice, lines, recipe.variants?.[dietChoice], swapsData, dict) : null),
    [recipe, lines, dietChoice, dict],
  );
  const version = choice.kind === 'version' ? versions?.find((v) => v.id === choice.recipeId) : undefined;
  const versionLines = useRecipeLines(version ?? null);
  /** The recipe whose steps, servings and id this tab acts on: the personal version, else this one. */
  const shownRecipe = version ?? recipe;
  /** The lines this tab shows: the diet version's, the personal version's, or the effective lines. */
  const shownLines = view ? view.lines : version ? versionLines : lines;
  /** Koken / ✓ Gekookt / Deel / + Deze week act on this id (a personal version: its own id). */
  const targetId = version?.id ?? id;
  const inWeek = !!plan?.items.some((p) => p.recipeId === targetId);
  // Markings of a diet tab: a coloured bar on a swapped line, an orange dot on a "controleer zelf"
  // line (✓ after it when it was ticked on approval, only while approved). Swapped lines are derived:
  // no "Koppel ingrediënt" on them.
  const marks = useMemo(() => {
    const m = new Map<number, LineMark>();
    if (!view) return m;
    for (const i of view.swapped) m.set(i, { kind: 'swapped', diet: view.diet });
    for (const i of view.unresolved) m.set(i, { kind: 'check', done: view.status === 'approved' && view.checked.includes(i) });
    return m;
  }, [view]);
  const lockedIndexes = useMemo(() => new Set(view?.swapped ?? []), [view]);
  /**
   * 13D blok 3 (§1d): the diet version that ✓ Gekookt logs and a ⏱ chip gives the cooking session:
   * only an APPROVED diet tab (as cook mode, which cooks the original for a ?v= that is not approved,
   * and "+ Deze week", Fable's decision (4) after blok 2); null otherwise.
   */
  const cookVariant: VariantDiet | null = view?.status === 'approved' ? view.diet : null;
  const storedApproval = recipe && dietChoice ? recipe.variants?.[dietChoice] : undefined;

  /** A tap on a tab (or a swipe): ?v= (replace) and the remembered tab of this recipe follow. */
  function onChooseTab(c: TabChoice) {
    if (c.kind === 'diet' && tabs?.diets.find((d) => d.diet === c.diet)?.status === 'natural') {
      flashVt(t('vt.naturalSnack', { diet: t('vt.tab.' + c.diet).toLocaleLowerCase() }));
      return;
    }
    const param = tabChoiceToParam(c);
    rememberTab(id, param);
    setApproveSheet(false);
    navigate('/recipe/' + id + (param ? '?v=' + encodeURIComponent(param) : ''), { replace: true });
  }

  /** Swipe on the ingredient section: finger to the left = the next tab, to the right = the previous one. */
  function swipeTab(dir: 1 | -1) {
    if (!tabs?.show) return;
    const next = nextTabChoice(choice, dir, tabs.diets, versions ?? []);
    if (tabChoiceToParam(next) !== tabChoiceToParam(choice)) onChooseTab(next);
  }
  const swipeHandlers = useHorizontalSwipe({ onLeft: () => swipeTab(1), onRight: () => swipeTab(-1) });
  // The "Koppel ingrediënt" sheet renders inside the section (it is not portaled): a gesture in an
  // open sheet is never a tab swipe, and never has its tap swallowed.
  const swipe = {
    ...swipeHandlers,
    onPointerDown: (e: PointerEvent) => {
      if (!inSheet(e)) swipeHandlers.onPointerDown(e);
    },
    onClickCapture: (e: MouseEvent) => {
      if (!inSheet(e)) swipeHandlers.onClickCapture(e);
    },
  };

  function flashVt(text: string, fail = false) {
    setVtFlash({ text, fail });
    if (vtFlashTimer.current !== null) window.clearTimeout(vtFlashTimer.current);
    vtFlashTimer.current = window.setTimeout(() => {
      vtFlashTimer.current = null;
      setVtFlash(null);
    }, VT_FLASH_MS);
  }

  /** After VariantSheet stored the approval: close it and say so ("Glutenvrij versie goedgekeurd"). */
  function onApproved(diet: VariantDiet) {
    setApproveSheet(false);
    flashVt(t('vt.approvedSnack', { diet: t('vt.tab.' + diet) }));
    void recordFeature('variant');
  }

  /** "Intrekken": after one confirm the tab becomes a proposal again. */
  async function onRevoke(diet: VariantDiet) {
    if (!window.confirm(t('vt.revokeConfirm'))) return;
    try {
      await revokeVariant(id, diet);
    } catch (e) {
      console.error('revokeVariant', e);
      flashVt(t('variant.saveFailed'), true);
    }
  }

  const name = recipe ? pickText(recipe.name, l) : '';
  const isFav = !!favs?.has(id);
  const editable = !!recipe && recipe.origin.kind !== 'builtin';
  const base = shownRecipe && shownRecipe.servings > 0 ? shownRecipe.servings : 4;
  const servings = chosen ?? base;
  /** Scale of the amounts: the ingredient list, the green words in the steps, the plain-text copy. */
  const factor = base > 0 && servings > 0 ? servings / base : 1;

  function onServings(n: number) {
    setChosen(n);
    rememberServings(id, n);
    if (n !== base) void recordFeature('scaled');
  }

  const related = useMemo(() => {
    if (!recipe || !all) return [];
    const ids = new Set(recipe.goesWith);
    const out = all.filter((r) => r.id !== recipe.id && (ids.has(r.id) || r.goesWith.includes(recipe.id)));
    return out.sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), l));
  }, [recipe, all, l]);

  const meta: string[] = [];
  if (recipe) {
    if (recipe.time?.active) meta.push(t('recipe.timeActive', { n: recipe.time.active }));
    if (recipe.time?.total && recipe.time.total !== recipe.time.active) meta.push(t('recipe.timeTotal', { n: recipe.time.total }));
    meta.push(originLine(recipe, l, all));
    if (stats) {
      if (stats.count > 0) {
        meta.push(t('recipe.cookedTimes', { n: stats.count }));
        if (stats.last) meta.push(t('recipe.lastCooked', { date: formatShortDate(stats.last, l) }));
      } else meta.push(t('recipe.neverCooked'));
    }
  }

  const category = recipe?.category ? dict.category(recipe.category) : undefined;
  const categoryName = category ? category[l] : recipe?.category ?? '';
  // 6B blok 3: no cuisine (or an id this app does not know) = no chip.
  const cuisine = recipe?.cuisine ? dict.cuisine(recipe.cuisine) : undefined;
  // Phase 5: diet chips under the title; the generic tag list below leaves those tags out.
  const dietChips = useMemo(() => (recipe ? dietChipsFor(recipe, lines, dict, linesAdjusted) : []), [recipe, lines, dict, linesAdjusted]);
  const otherTags = recipe ? recipe.tags.filter((tag) => !DIET_ROW_TAGS.has(tag)) : [];
  // The tap hints under "Bereiding": timer chips, and (13I) underlined green words with an amount to
  // show. The amounts hint only while "Toon hoeveelheden" is off: with it on every amount is already
  // there and a tap hides one (reading the signal here re-renders when it changes).
  const timersTappable = !!shownRecipe && shownRecipe.steps.some((s) => !!s.timers && s.timers.length > 0);
  const amountsTappable = useMemo(
    () => !!shownRecipe && shownRecipe.steps.some((s) => hasAmountsToShow(shownStep(s, l, fahrenheit, shownLines, dict), shownLines, dict)),
    [shownRecipe, l, fahrenheit, shownLines, dict],
  );
  const amountsHint = amountsTappable && !showAmounts.value;
  // Block F.2: the original of a personal version (when it still exists on this phone) for the
  // "Versie van …" link.
  const original = recipe?.variantOf ? all?.find((r) => r.id === recipe.variantOf) : undefined;
  // Machine-translation badge: the English edition of a classic is a machine translation until someone
  // improves it in the editor (its override patch then sets text.en = 'human', src/screens/EditScreen.tsx).
  // The badge opens the editor; the separate Curator page was removed in phase 6 (open question 7).
  const machineEn = !!recipe && l === 'en' && recipe.text?.en === 'llm';
  // PLAN §0 "Vertaling eigen recepten" (3): an own/received recipe that lacks the other language's
  // name or steps gets a line that jumps to the editor's translation section. Classics never.
  const missingLang: Lang | null = recipe && editable ? (['nl', 'en'] as const).find((x) => !hasLang(recipe.name, x) || !recipe.steps.some((s) => hasLang(s.text, x))) ?? null : null;

  async function onToggleFav() {
    if (!pid) return;
    await toggleFavorite(id, pid);
  }

  async function onDelete() {
    await deleteUserRecipe(id);
    void endCooking(id);
    navigate('/recipes', { replace: true });
  }

  /** 13K: a ⏱ chip started a timer at step `stepIndex + 1`. New session or a later step → move the
   *  session there; otherwise only bump lastActiveAt on the step it already has. */
  async function onTimerStart(stepIndex: number) {
    // On a personal-version tab the steps (and so the session) are the version's.
    const r = shownRecipe;
    if (!r) return;
    const page = stepIndex + 1;
    // The store may still be loading on a cold start: decide on the stored session, not on [].
    await loadCooking();
    const s = sessionFor(r.id);
    // 13D: on an approved diet tab the session cooks that version (the bar row reopens cook mode with
    // &v=<diet>); elsewhere the variant is left out, so a running session keeps the one it has.
    await touchCooking(r, !s || s.page < page ? page : s.page, servings, cookVariant ?? undefined);
  }

  async function onCopy() {
    if (!recipe || !profile) return;
    const copy = await duplicateAsOwn(recipe, profile);
    navigate('/edit/' + copy.id);
  }

  /**
   * "+ Deze week": a slot with the household servings (repo default); already there → open the week.
   * 13D §1d: on an APPROVED diet tab the slot gets that version (`addToPlan(id, undefined, diet)`; an
   * existing slot of this dish gets it through `setPlanVariant` before the week opens); on a diet tab
   * that is not approved (proposed / stale) the original goes in the week, no `variant` on the slot,
   * as from the Origineel tab ("Besluiten Fable na blok 2", point 4); on a personal-version tab the
   * version itself goes in the week.
   */
  async function onAddToWeek() {
    if (weekBusy) return;
    const planDiet: VariantDiet | null = dietChoice && view?.status === 'approved' ? dietChoice : null;
    const slot = plan?.items.find((p) => p.recipeId === targetId);
    if (slot) {
      if (planDiet && (slot.variant ?? null) !== planDiet) {
        try {
          await setPlanVariant(slot.id, planDiet);
        } catch (e) {
          console.error('setPlanVariant', e);
        }
      }
      navigate('/week');
      return;
    }
    setWeekBusy(true);
    try {
      await addToPlan(targetId, undefined, planDiet);
    } catch (e) {
      console.error('addToPlan', e);
    } finally {
      setWeekBusy(false);
    }
  }

  /**
   * Own/received recipes: saved in the recipe; classics: stored as an override patch {category}.
   * Either way `metaManual: true` rides along (phase-5 A.4): a category chosen here by hand is a
   * manual choice, so the editor's auto-suggestion and "Controleer mijn recepten" leave it alone
   * (same shape as EditScreen.buildOverridePatch).
   */
  async function onCategory(cat: string) {
    if (!recipe || catBusy) return;
    setCatBusy(true);
    try {
      if (isBuiltinId(recipe.id)) {
        const existing = await getOverride(recipe.id);
        await saveOverride({ baseId: recipe.id, patch: { ...(existing?.patch ?? {}), category: cat, metaManual: true }, by: profile?.name ?? null });
      } else {
        await saveUserRecipe({ ...recipe, category: cat, metaManual: true });
      }
      setEditCat(false);
    } catch (e) {
      console.error('category', e);
    } finally {
      setCatBusy(false);
    }
  }

  /**
   * "+ Foto": re-encode on the phone (≤1024 px WebP/JPEG, src/photo.ts) and store it with the
   * active member. Photos never travel in share tokens (phase-5 D.1).
   */
  async function onPhotoFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so the same photo can be picked again after a failure
    if (!file || !pid || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(false);
    try {
      const blob = await encodePhotoFile(file);
      await addPhoto({ recipeId: id, memberId: pid, blob, at: nowIso() });
      markXpDirty(pid);
      void checkNewBadges(pid).catch((err: unknown) => console.error('checkNewBadges', err));
      // 6D-1: a photo is a reward moment (docs/specs/xp-levels.md §3).
      void settleXp(pid).catch((err: unknown) => console.error('settleXp', err));
    } catch (err) {
      console.error('addPhoto', err);
      setPhotoError(true);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onDeletePhoto(p: Photo) {
    if (p.id === undefined || photoDelBusy) return;
    setPhotoDelBusy(true);
    try {
      await deletePhoto(p.id);
      // 6D-1: a photo feeds its maker's XP; recomputed silently (never a pop, no reward moment).
      markXpDirty(p.memberId);
      setViewPhoto(null);
    } catch (e) {
      console.error('deletePhoto', e);
    } finally {
      setPhotoDelBusy(false);
    }
  }

  /**
   * The recipe as the plain-text contract of src/domain/recipe-text.ts: exactly the line texts
   * the screen shows (lineText over the lines of the chosen tab, scaled to the chosen servings). A
   * diet tab adds "(glutenvrije versie)" to the name, only in the text (13D §1d).
   */
  function asTextInput(r: Recipe): RecipeTextInput {
    const timeParts: string[] = [];
    if (r.time?.active) timeParts.push(t('recipe.timeActive', { n: r.time.active }));
    if (r.time?.total && r.time.total !== r.time.active) timeParts.push(t('recipe.timeTotal', { n: r.time.total }));
    const title = pickText(r.name, l);
    return {
      name: dietChoice ? `${title} (${dietVersionSuffix(dietChoice)})` : title,
      servings,
      timeLabel: timeParts.length ? timeParts.join(' · ') : null,
      lines: shownLines.map((ln) => ({ text: lineText(ln, l, factor).trim(), header: ln.kind === 'header' })).filter((x) => x.text !== ''),
      steps: r.steps.map((s) => pickText(s.text, l)).filter((s) => s !== ''),
      lang: l,
    };
  }

  function flashCopy(kind: 'ok' | 'fail') {
    setCopyFlash(kind);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      setCopyFlash(null);
    }, 2500);
  }

  async function onCopyAs(kind: 'recipe' | 'ingredients') {
    if (!shownRecipe) return;
    setToolsMenu(null);
    const input = asTextInput(shownRecipe);
    const res = await copyText(kind === 'recipe' ? recipeAsText(input) : ingredientsAsText(input));
    if (!res.ok) console.error('copyText', res.error);
    flashCopy(res.ok ? 'ok' : 'fail');
  }

  function onPrintAs(kind: 'recipe' | 'ingredients') {
    setToolsMenu(null);
    printPage(kind);
    void recordFeature('print');
  }

  // The status line of an approved diet tab: "Goedgekeurd door Stijn op 22 okt" (anonymous without a name).
  const approvedBy = typeof storedApproval?.by === 'string' && storedApproval.by.trim() ? storedApproval.by.trim() : null;
  const approvedDate = formatShortDate(storedApproval?.approvedAt, l);
  const approvedText = approvedBy ? t('vt.status.approved', { name: approvedBy, date: approvedDate }) : t('vt.status.approvedAnon', { date: approvedDate });
  // The status line of a personal-version tab: "Versie van Dino", plus the version's own name when
  // it is not simply "<naam> (versie van Dino)" (an older diet copy: "Uiensoep (glutenvrij)").
  const versionMaker = version ? makerName(version) : null;
  const versionTitle = version ? pickText(version.name, l) : '';
  const versionTitleDiffers =
    !!version && !!recipe && (!versionMaker || versionTitle !== pickText(versionName(recipe.name, versionMaker), l));

  /** "✓ Gekookt" / "Beoordeel": the sheet for `recipeId` (the personal version on its tab). */
  function openCooked(mode: CookedSheetMode, recipeId: string) {
    setCookedFor(recipeId);
    setCookedSheet(mode);
  }

  /** After the CookedSheet saved: close it and show a short confirmation under the buttons. */
  function onCookedSaved(kind: CookedSheetMode['kind']) {
    setCookedSheet(null);
    setCookedFlash(kind === 'log' ? t('cooked.saved') : t('cooked.ratedSaved'));
    if (cookedFlashTimer.current !== null) window.clearTimeout(cookedFlashTimer.current);
    cookedFlashTimer.current = window.setTimeout(() => {
      cookedFlashTimer.current = null;
      setCookedFlash(null);
    }, 3000);
  }

  return (
    <>
      <Header title={name || t('app.title')} back backLabel={t('common.back')} />
      <TimerBar />
      <div class="screen detail">
        {recipe === null && <div class="empty">{t('recipe.notFound')}</div>}
        {recipe === undefined && <div class="empty">{t('common.loading')}</div>}
        {recipe && (
          <>
            {hero && heroUrl && (
              <button type="button" class="detail-hero no-print" aria-label={t('recipe.photoView')} onClick={() => setViewPhoto(hero)}>
                <img class="detail-hero-img" src={heroUrl} alt="" />
              </button>
            )}
            <div class="detail-head">
              <h2 class="detail-title">
                {name}
                {/* 13D §1d: on paper a diet tab says which version it is; never in the stored name. */}
                {dietChoice && <span class="vtab-print-suffix"> ({dietVersionSuffix(dietChoice)})</span>}
              </h2>
              <button
                type="button"
                class={'fav-btn no-print' + (isFav ? ' on' : '')}
                aria-pressed={isFav}
                aria-label={isFav ? t('recipe.unfav') : t('recipe.fav')}
                disabled={!pid}
                onClick={() => void onToggleFav()}
              >
                {isFav ? '★' : '☆'}
              </button>
            </div>

            {dietChips.length > 0 && (
              <div class="detail-diet" role="list" aria-label={t('recipe.diet')}>
                {dietChips.map((c) => (
                  <span key={c.tag} role="listitem" class={'tag tag-diet' + (c.unsure ? ' tag-unsure' : '') + (c.tag.endsWith('-optie') ? ' tag-optie' : '')}>
                    {tagTextLabel(c.tag)}
                    {c.unsure && <span class="tag-unsure-note"> · {t('recipe.dietProbably')}</span>}
                  </span>
                ))}
              </div>
            )}

            <div class="detail-cat">
              {editCat ? (
                <label class="detail-cat-edit">
                  <span class="visually-hidden">{t('recipe.category')}</span>
                  <select
                    class="input"
                    value={recipe.category ?? ''}
                    disabled={catBusy}
                    onChange={(e) => void onCategory((e.currentTarget as HTMLSelectElement).value)}
                  >
                    {!recipe.category && <option value="">{t('recipe.noCategory')}</option>}
                    {dict.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c[l]}
                      </option>
                    ))}
                  </select>
                  <button type="button" class="icon-btn" onClick={() => setEditCat(false)}>
                    {t('common.cancel')}
                  </button>
                </label>
              ) : (
                <>
                  <span class="detail-cat-name">{categoryName || t('recipe.noCategory')}</span>
                  {cuisine &&
                    (editable ? (
                      <button type="button" class="recipe-cuisine" onClick={() => navigate('/edit/' + id)}>
                        <span class="visually-hidden">{t('recipe.cuisine')}: </span>
                        {cuisineLabel(cuisine, cuisine.id)}
                      </button>
                    ) : (
                      <span class="recipe-cuisine">
                        <span class="visually-hidden">{t('recipe.cuisine')}: </span>
                        {cuisineLabel(cuisine, cuisine.id)}
                      </span>
                    ))}
                  <button type="button" class="link-btn" onClick={() => setEditCat(true)}>
                    {t('recipe.changeCategory')}
                  </button>
                  {otherTags.length > 0 && (
                    <span class="tags">
                      {otherTags.map((tag) => (
                        <span key={tag} class="tag">
                          {tagLabel(tag)}
                        </span>
                      ))}
                    </span>
                  )}
                </>
              )}
            </div>

            <p class="detail-meta">{meta.join(' · ')}</p>

            {/* Phase 5 block F: a personal version links back to its original (13D: the original shows it as a tab). */}
            {original && (
              <button type="button" class="detail-variant-of no-print" onClick={() => navigate('/recipe/' + original.id)}>
                {t('recipe.variantOf', { name: pickText(original.name, l) })}
              </button>
            )}

            {/* Phase 5 block D: gallery strip, newest first, with "+ Foto" at the end. No photos
                = no empty section: only the small "+ Foto" text button remains (spec D.1). */}
            {photos && photos.length > 0 && (
              <div class="photo-strip no-print" role="group" aria-label={t('recipe.photos')}>
                {photos.map((p) => (
                  <PhotoThumb key={p.id ?? p.at} photo={p} member={memberById(members, p.memberId)} onOpen={setViewPhoto} />
                ))}
                {!!pid && (
                  <label class={'photo-add' + (photoBusy ? ' busy' : '')}>
                    <span class="photo-add-label">{t('recipe.addPhoto')}</span>
                    <input type="file" accept="image/*" style="display:none" disabled={photoBusy} onChange={(e) => void onPhotoFile(e)} />
                  </label>
                )}
              </div>
            )}
            {photos && photos.length === 0 && !!pid && (
              <label class="link-btn photo-add-first no-print">
                {t('recipe.addPhoto')}
                <input type="file" accept="image/*" style="display:none" disabled={photoBusy} onChange={(e) => void onPhotoFile(e)} />
              </label>
            )}
            {photoError && (
              <p class="muted small photo-error no-print" role="status">
                {t('recipe.photoError')}
              </p>
            )}

            {missingLang && (
              <button type="button" class="detail-translate no-print" onClick={() => navigate('/edit/' + id + '?translate=1')}>
                {missingLang === 'en' ? t('recipe.missingEn') : t('recipe.missingNl')}
              </button>
            )}

            {machineEn && (
              <button type="button" class="translation-badge no-print" onClick={() => navigate('/edit/' + id)}>
                {t('recipe.machineTranslation')}
              </button>
            )}

            <div class="detail-actions detail-actions-3 no-print">
              {/* 13D §1d: a diet tab cooks with ?v=<diet> (cook mode falls back to the original when it is
                  not approved); a personal-version tab cooks, logs and shares the version itself. */}
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => navigate(`/cook/${targetId}?srv=${servings}` + (dietChoice ? `&v=${dietChoice}` : ''))}
              >
                {t('recipe.cook')}
              </button>
              {/* Phase 6 A.3: log a cook without cook mode (no profile → the sheet says so). */}
              <button type="button" class="btn btn-cooked" onClick={() => openCooked({ kind: 'log' }, targetId)}>
                {t('recipe.cooked')}
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => navigate('/share/' + targetId)}>
                {t('recipe.share')}
              </button>
            </div>
            {cookedFlash !== null && (
              <p class="tool-flash cooked-flash no-print" role="status">
                {cookedFlash}
              </p>
            )}
            {needsRating && lastCook && (
              <button type="button" class="btn btn-block detail-rate no-print" onClick={() => openCooked({ kind: 'rate', entry: lastCook }, id)}>
                <span class="detail-rate-star" aria-hidden="true">
                  ★
                </span>
                <span class="detail-rate-text">
                  <strong>{t('recipe.rate')}</strong>
                  <span class="muted small">{t('recipe.rateHint', { date: formatShortDate(lastCook.at, l) })}</span>
                </span>
              </button>
            )}
            <button
              type="button"
              class={'btn btn-block detail-week no-print' + (inWeek ? ' on' : '')}
              aria-pressed={inWeek}
              disabled={weekBusy || plan === undefined}
              onClick={() => void onAddToWeek()}
            >
              {inWeek ? t('recipe.inWeek') : t('recipe.addToWeek')}
            </button>

            {/* Phase 5 block D: Print + "Kopieer als tekst". On iOS window.print() is unreliable
                in a Home Screen app, so the iPhone gets a short honest hint instead (invariant 13). */}
            <div class="detail-tools no-print">
              {!ios && (
                <button type="button" class="btn" aria-expanded={toolsMenu === 'print'} onClick={() => setToolsMenu(toolsMenu === 'print' ? null : 'print')}>
                  {t('recipe.print')}
                </button>
              )}
              <button type="button" class="btn" aria-expanded={toolsMenu === 'copy'} onClick={() => setToolsMenu(toolsMenu === 'copy' ? null : 'copy')}>
                {t('recipe.copyAsText')}
              </button>
            </div>
            {ios && <p class="muted small print-ios-hint no-print">{t('recipe.printIosHint')}</p>}
            {toolsMenu !== null && (
              <div class="detail-tools-menu no-print" role="group" aria-label={toolsMenu === 'print' ? t('recipe.print') : t('recipe.copyAsText')}>
                <button type="button" class="btn" onClick={() => (toolsMenu === 'print' ? onPrintAs('recipe') : void onCopyAs('recipe'))}>
                  {t('recipe.wholeRecipe')}
                </button>
                <button type="button" class="btn" onClick={() => (toolsMenu === 'print' ? onPrintAs('ingredients') : void onCopyAs('ingredients'))}>
                  {t('recipe.ingredientsOnly')}
                </button>
                <button type="button" class="btn" onClick={() => setToolsMenu(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            )}
            {copyFlash !== null && (
              <p class={'tool-flash no-print' + (copyFlash === 'fail' ? ' fail' : '')} role="status">
                {copyFlash === 'ok' ? t('recipe.copied') : t('recipe.copyFailed')}
              </p>
            )}

            {/* 13D §1a: the tab row, only when there is something to choose. */}
            {tabs?.show && (
              <div class="detail-vtabs">
                <VariantTabs tabs={tabs.diets} versions={versions ?? []} choice={choice} onChoose={onChooseTab} />
                {vtFlash && (
                  <p class={'tool-flash vtab-flash no-print' + (vtFlash.fail ? ' fail' : '')} role="status">
                    {vtFlash.text}
                  </p>
                )}
              </div>
            )}

            {/* 13D §1a: a sideways swipe anywhere on the ingredient section moves to the next / previous
                tab (pan-y keeps the vertical scroll); a swipe that starts on a button is no tap. */}
            <section class="section detail-ingredients" {...swipe}>
              <h2>{t('recipe.ingredients')}</h2>
              {/* 13D §1b: the status line of a diet tab. */}
              {view && (
                <div class={'vtab-status no-print diet-' + view.diet}>
                  {view.status === 'approved' ? (
                    <>
                      <p class="vtab-status-text">{approvedText}</p>
                      <button type="button" class="link-btn vtab-revoke" onClick={() => void onRevoke(view.diet)}>
                        {t('vt.revoke')}
                      </button>
                    </>
                  ) : (
                    <>
                      <p class="vtab-status-text">{t(view.status === 'stale' ? 'vt.status.stale' : 'vt.status.proposed')}</p>
                      <button type="button" class="btn btn-secondary vtab-status-btn" onClick={() => setApproveSheet(true)}>
                        {t(view.status === 'stale' ? 'vt.recheck' : 'vt.approve')}
                      </button>
                    </>
                  )}
                </div>
              )}
              {/* 13D §1b: the status line of a personal-version tab. */}
              {version && (
                <div class="vtab-status personal no-print">
                  <p class="vtab-status-text">
                    {versionMaker ? t('vt.personal.by', { name: versionMaker }) : versionTitle}
                    {versionMaker && versionTitleDiffers && <span class="vtab-status-name">{versionTitle}</span>}
                  </p>
                  <button type="button" class="btn btn-secondary vtab-status-btn" onClick={() => navigate('/recipe/' + version.id)}>
                    {t('vt.personal.open')}
                  </button>
                </div>
              )}
              <ServingsPicker value={servings} base={base} onChange={onServings} />
              <IngredientList
                recipeId={targetId}
                lines={shownLines}
                servings={servings}
                base={base}
                marks={view ? marks : undefined}
                lockedIndexes={view ? lockedIndexes : undefined}
              />
              {marks.size > 0 && <p class="muted small vtab-legend">{t('vt.legend')}</p>}
              {shownLines.some((ln, i) => !lockedIndexes.has(i) && ln.kind !== 'header' && !(ln.ing && dict.get(ln.ing))) && (
                <p class="muted small ing-hint">{t('line.linkHint')}</p>
              )}
            </section>

            <section class="section">
              <h2>{t('recipe.steps')}</h2>
              {/* a tap instruction has no business on paper */}
              {(timersTappable || amountsHint) && (
                <p class="muted small no-print">
                  {[timersTappable ? t('recipe.timerHint') : '', amountsHint ? t('recipe.amountsHint') : ''].filter(Boolean).join(' ')}
                </p>
              )}
              {/* 13D §1b: the steps of the chosen tab, green words over its lines (a swapped line still
                  matches its old name through `swappedFrom`). */}
              <ol class="steps">
                {(version ?? recipe).steps.map((s, i) => (
                  <StepView
                    key={i}
                    recipeId={targetId}
                    recipeName={version ? versionTitle : name}
                    index={i}
                    step={s}
                    fahrenheit={fahrenheit}
                    lines={shownLines}
                    factor={factor}
                    onTimerStart={(n) => void onTimerStart(n)}
                  />
                ))}
              </ol>
              {(version ?? recipe).servingTip && pickText((version ?? recipe).servingTip, l) && (
                <p class="serving-tip">{pickText((version ?? recipe).servingTip, l)}</p>
              )}
            </section>

            {related.length > 0 && (
              <section class="section">
                <h2>{t('recipe.goesWith')}</h2>
                <div class="chips wrap">
                  {related.map((r) => (
                    <a
                      key={r.id}
                      class="chip"
                      href={'#/recipe/' + r.id}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/recipe/' + r.id);
                      }}
                    >
                      {pickText(r.name, l)}
                    </a>
                  ))}
                </div>
              </section>
            )}

            <section class="section">
              <h2>{t('recipe.notes')}</h2>
              {pid ? (
                <>
                  <textarea
                    class="input notes"
                    value={note}
                    placeholder={t('recipe.notesPlaceholder')}
                    onInput={(e) => onNoteInput((e.currentTarget as HTMLTextAreaElement).value)}
                  />
                  <div class="notes-foot">
                    <span class="muted small">{t('recipe.notesHint', { name: profile?.name ?? '' })}</span>
                    {noteSaved && <span class="saved-flag">{t('recipe.saved')}</span>}
                  </div>
                </>
              ) : (
                <p class="muted">{t('recipe.notesNoProfile')}</p>
              )}
            </section>

            <section class="section detail-manage">
              {editable ? (
                confirmDelete ? (
                  <div class="confirm">
                    <p>{t('recipe.deleteConfirm')}</p>
                    <div class="actions">
                      <button type="button" class="btn btn-danger" onClick={() => void onDelete()}>
                        {t('recipe.deleteYes')}
                      </button>
                      <button type="button" class="btn" onClick={() => setConfirmDelete(false)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="actions">
                    <button type="button" class="btn btn-secondary" onClick={() => navigate('/edit/' + id)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" class="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                      {t('common.delete')}
                    </button>
                  </div>
                )
              ) : (
                <>
                  <button type="button" class="btn btn-secondary btn-block" disabled={!profile} onClick={() => void onCopy()}>
                    {t('recipe.copy')}
                  </button>
                  <p class="muted small copy-hint">{profile ? t('recipe.copyHint') : t('recipe.copyNoProfile')}</p>
                </>
              )}
            </section>

            {viewPhoto && (
              <PhotoOverlay
                photo={viewPhoto}
                member={memberById(members, viewPhoto.memberId)}
                busy={photoDelBusy}
                onClose={() => setViewPhoto(null)}
                onDelete={(p) => void onDeletePhoto(p)}
              />
            )}

            {/* 13D §1c: "Controleer en keur goed" / "Opnieuw controleren". */}
            {approveSheet && view && (view.status === 'proposed' || view.status === 'stale') && (
              <VariantSheet recipe={recipe} view={view} onClose={() => setApproveSheet(false)} onApproved={() => onApproved(view.diet)} />
            )}

            {cookedSheet && <CookedSheet recipeId={cookedFor} mode={cookedSheet} variant={cookVariant} onClose={() => setCookedSheet(null)} onSaved={onCookedSaved} />}
          </>
        )}
      </div>
    </>
  );
}
