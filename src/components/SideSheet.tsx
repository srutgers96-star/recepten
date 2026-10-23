// "+ bijgerecht" in the week (docs/specs/labels-categorieen.md §1d, 6B blok 4): a picker sheet for a
// side dish under one main dish of the plan. Through SheetPortal (13J: inside `.screen` the iPhone cut
// off the bottom of a sheet) with the head `.sheet-head.with-actions`: the title "Bijgerecht bij
// {name}" and Sluit on the right (README §1a: a picker without Bewaar has Sluit on the right). Under
// the head the search box (`pick.search`, the same search as the Kies sheet: name, ingredient,
// category, tag) and two groups:
// - "Past erbij": the recipes linked to the main dish through `goesWith`, in both directions and of
//   any category (as "Bij dit gerecht" on the recipe page), A–Z;
// - "Alle bijgerechten": the recipes of the category Bijgerecht, A–Z, without the ones above.
// A row is the name + the name in the other language; a side dish that already hangs under this main
// is greyed out with "staat erbij". One tap on a row picks it (the caller adds it and closes the
// sheet): this is a picker, not a form, so there is no Bewaar. Sluit, swiping the sheet down (grab
// bar / head), tapping beside it and Escape close it without adding anything. The sheet mounts on
// open, so every open starts with an empty search box.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { otherLanguageName } from '@/components/RecipeRow';
import { SheetPortal } from '@/components/SheetPortal';
import { dictionary } from '@/dictionary';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { sidesOf, type PlanItem } from '@/domain/planner';
import { flattenResults, searchRecipes } from '@/domain/search';
import { lang, t } from '@/i18n';

/** The category whose recipes make up "Alle bijgerechten" (data/categories.json). */
const SIDE_CATEGORY = 'bijgerecht';
/** How far (px) the sheet must be pulled down before letting go closes it (as AddMenu/CookedSheet). */
const DISMISS_PX = 80;

export interface SideSheetProps {
  /** The main slot the side dish goes under; null = closed. */
  main: PlanItem | null;
  /** All recipes (allRecipes). */
  recipes: readonly Recipe[];
  /** The plan's items: the sides already under `main` are shown as "staat erbij". */
  items: readonly PlanItem[];
  /** A row was tapped: the caller adds the side dish (addSideToPlan) and closes the sheet. */
  onPick: (recipeId: string) => void;
  onClose: () => void;
}

export function SideSheet(props: SideSheetProps): JSX.Element | null {
  if (!props.main) return null;
  return <SideSheetBody {...props} main={props.main} />;
}

function goesWithOf(r: Recipe): readonly string[] {
  return Array.isArray(r.goesWith) ? r.goesWith : [];
}

function byName(list: Recipe[], l: Lang): Recipe[] {
  const locale = l === 'nl' ? 'nl' : 'en';
  return list.sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), locale, { sensitivity: 'base' }));
}

function SideSheetBody(props: SideSheetProps & { main: PlanItem }) {
  const { main, recipes, items, onPick, onClose } = props;
  const l = lang.value;
  const dict = dictionary.value;
  const [query, setQuery] = useState('');
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on Sluit on open (no keyboard popping up over the
  // rows) and hand it back to "+ bijgerecht" on close, while that button is still there.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const mainRecipe = useMemo(() => recipes.find((r) => r.id === main.recipeId), [recipes, main.recipeId]);
  const added = useMemo(() => new Set(sidesOf(items, main.id).map((p) => p.recipeId)), [items, main.id]);

  // The two groups before the search: "Past erbij" (goesWith, both directions) and the rest of the
  // category Bijgerecht. The main dish itself is never offered.
  const { suggested, sides } = useMemo(() => {
    const own = new Set(mainRecipe ? goesWithOf(mainRecipe) : []);
    const suggestedList = recipes.filter((r) => r.id !== main.recipeId && (own.has(r.id) || goesWithOf(r).includes(main.recipeId)));
    const suggestedIds = new Set(suggestedList.map((r) => r.id));
    const sideList = recipes.filter((r) => r.category === SIDE_CATEGORY && r.id !== main.recipeId && !suggestedIds.has(r.id));
    return { suggested: byName(suggestedList, l), sides: byName(sideList, l) };
  }, [recipes, mainRecipe, main.recipeId, l]);

  // The search narrows both groups (same matching as the Kies sheet); the group order stays A–Z.
  const q = query.trim();
  const matches = useMemo(() => (q ? new Set(flattenResults(searchRecipes([...suggested, ...sides], q, dict, l)).map((r) => r.id)) : null), [q, suggested, sides, dict, l]);
  const shownSuggested = matches ? suggested.filter((r) => matches.has(r.id)) : suggested;
  const shownSides = matches ? sides.filter((r) => matches.has(r.id)) : sides;
  const nothingAtAll = suggested.length === 0 && sides.length === 0;

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = close (as AddMenu).
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (e.g. a very short tap): the drag simply works without capture.
    }
  }
  function onDragMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
    }
  }
  function onDragEnd(e: PointerEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform .18s ease-out';
      sheetRef.current.style.transform = '';
    }
    if (!cancelled && d.dy > DISMISS_PX) onClose();
  }

  function row(r: Recipe) {
    const on = added.has(r.id);
    const alt = otherLanguageName(r, l);
    const sub = [alt, on ? t('week.sideAdded') : null].filter(Boolean).join(' · ');
    return (
      <li key={r.id}>
        <button type="button" class={'picker-item side-row' + (on ? ' added' : '')} disabled={on} onClick={() => onPick(r.id)}>
          <span class="picker-name">{pickText(r.name, l)}</span>
          {sub && <span class="picker-sub muted small">{sub}</span>}
        </button>
      </li>
    );
  }

  const title = t('week.sideTitle', { name: mainRecipe ? pickText(mainRecipe.name, l) : t('week.missing') });
  return (
    <SheetPortal>
      <div class="sheet-backdrop" onClick={onClose}>
        <div ref={sheetRef} class="sheet side-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head with-actions">
              <h2>{title}</h2>
              <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          </div>
          <div class="side-tools">
            <input
              class="input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autocomplete="off"
              placeholder={t('pick.search')}
              value={query}
              onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <div class="sheet-body side-body">
            {nothingAtAll ? (
              <p class="muted small picker-hint">{t('week.sideNone')}</p>
            ) : shownSuggested.length === 0 && shownSides.length === 0 ? (
              <p class="muted small picker-hint">{t('pick.none')}</p>
            ) : (
              <>
                {shownSuggested.length > 0 && (
                  <section>
                    <h3 class="side-group">{t('week.sideSuggested')}</h3>
                    <ul class="picker-list side-list">{shownSuggested.map(row)}</ul>
                  </section>
                )}
                {shownSides.length > 0 && (
                  <section>
                    <h3 class="side-group">{t('week.sideAll')}</h3>
                    <ul class="picker-list side-list">{shownSides.map(row)}</ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
