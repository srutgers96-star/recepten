// '#/recipe/:id' — detail (docs/phase-1-spec.md §5, phase-2 §5): name, category + tags, meta,
// servings scaler, Koken / Deel, "+ Deze week" (phase 4), ★, ingredient lines through the dictionary (scaled, with
// "Koppel ingrediënt"), numbered steps with timer chips (°F when enabled), "Bij dit gerecht",
// notes per profile (autosave), and own → Bewerk / Verwijder, classic → "Maak eigen kopie".
// Phase 5 (docs/phase-5-spec.md A.3): diet chips under the title (vegetarisch · vegan · glutenvrij
// and the -optie tags); for own recipes derived live from the lines, "waarschijnlijk" when unsure.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { IngredientList } from '@/components/LineView';
import { formatShortDate } from '@/components/RecipeRow';
import { rememberServings, rememberedServings, ServingsPicker } from '@/components/ServingsPicker';
import { StepView, useFahrenheit } from '@/components/StepView';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import {
  addToPlan,
  allRecipes,
  cookStats,
  deleteUserRecipe,
  duplicateAsOwn,
  getNote,
  getOverride,
  getPlan,
  getRecipe,
  isBuiltinId,
  listFavorites,
  saveOverride,
  saveUserRecipe,
  setNote,
  toggleFavorite,
} from '@/db/repo';
import { DIET_ROW_TAGS, OPTIE_TAG, tagTextLabel } from '@/components/FilterChips';
import { dictionary } from '@/dictionary';
import { DIET_TAGS, dietTags, type DietTag } from '@/domain/diet';
import type { Dictionary } from '@/domain/dictionary';
import { hasLang, pickText, type Lang, type Line, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { useRecipeLines } from '@/lines';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';

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
 * the diet tags.
 */
function dietChipsFor(recipe: Recipe, lines: readonly Line[], dict: Dictionary, linesAdjusted: boolean): DietChip[] {
  const stored = new Set(recipe.tags);
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
  const inWeek = !!plan?.items.some((p) => p.recipeId === id);
  const [weekBusy, setWeekBusy] = useState(false);

  // The delete confirmation is per recipe, in memory only.
  useEffect(() => {
    setConfirmDelete(false);
    setEditCat(false);
  }, [id]);

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

  const name = recipe ? pickText(recipe.name, l) : '';
  const isFav = !!favs?.has(id);
  const editable = !!recipe && recipe.origin.kind !== 'builtin';
  const base = recipe && recipe.servings > 0 ? recipe.servings : 4;
  const servings = chosen ?? base;

  function onServings(n: number) {
    setChosen(n);
    rememberServings(id, n);
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
  // Phase 5: diet chips under the title; the generic tag list below leaves those tags out.
  const dietChips = useMemo(() => (recipe ? dietChipsFor(recipe, lines, dict, linesAdjusted) : []), [recipe, lines, dict, linesAdjusted]);
  const otherTags = recipe ? recipe.tags.filter((tag) => !DIET_ROW_TAGS.has(tag)) : [];
  // Curator badge: the English edition of a classic is a machine translation until someone improves
  // it (the editor's override patch then sets text.en = 'human', src/screens/EditScreen.tsx).
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
    navigate('/recipes', { replace: true });
  }

  async function onCopy() {
    if (!recipe || !profile) return;
    const copy = await duplicateAsOwn(recipe, profile);
    navigate('/edit/' + copy.id);
  }

  /** "+ Deze week": a slot with the household servings (repo default); already there → open the week. */
  async function onAddToWeek() {
    if (weekBusy) return;
    if (inWeek) {
      navigate('/week');
      return;
    }
    setWeekBusy(true);
    try {
      await addToPlan(id);
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

  return (
    <>
      <Header title={name || t('app.title')} back backLabel={t('common.back')} />
      <TimerBar />
      <div class="screen detail">
        {recipe === null && <div class="empty">{t('recipe.notFound')}</div>}
        {recipe === undefined && <div class="empty">{t('common.loading')}</div>}
        {recipe && (
          <>
            <div class="detail-head">
              <h2 class="detail-title">{name}</h2>
              <button
                type="button"
                class={'fav-btn' + (isFav ? ' on' : '')}
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

            {missingLang && (
              <button type="button" class="detail-translate" onClick={() => navigate('/edit/' + id + '?translate=1')}>
                {missingLang === 'en' ? t('recipe.missingEn') : t('recipe.missingNl')}
              </button>
            )}

            {machineEn && (
              <button type="button" class="curator-badge" onClick={() => navigate('/edit/' + id)}>
                {t('recipe.machineTranslation')}
              </button>
            )}

            <div class="detail-actions">
              <button type="button" class="btn btn-primary" onClick={() => navigate(`/cook/${id}?srv=${servings}`)}>
                {t('recipe.cook')}
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => navigate('/share/' + id)}>
                {t('recipe.share')}
              </button>
            </div>
            <button
              type="button"
              class={'btn btn-block detail-week' + (inWeek ? ' on' : '')}
              aria-pressed={inWeek}
              disabled={weekBusy || plan === undefined}
              onClick={() => void onAddToWeek()}
            >
              {inWeek ? t('recipe.inWeek') : t('recipe.addToWeek')}
            </button>

            <section class="section">
              <h2>{t('recipe.ingredients')}</h2>
              <ServingsPicker value={servings} base={base} onChange={onServings} />
              <IngredientList recipeId={id} lines={lines} servings={servings} base={base} />
              {lines.some((ln) => ln.kind !== 'header' && !(ln.ing && dict.get(ln.ing))) && <p class="muted small ing-hint">{t('line.linkHint')}</p>}
            </section>

            <section class="section">
              <h2>{t('recipe.steps')}</h2>
              {recipe.steps.some((s) => s.timers && s.timers.length) && <p class="muted small">{t('recipe.timerHint')}</p>}
              <ol class="steps">
                {recipe.steps.map((s, i) => (
                  <StepView key={i} recipeId={id} recipeName={name} index={i} step={s} fahrenheit={fahrenheit} />
                ))}
              </ol>
              {recipe.servingTip && pickText(recipe.servingTip, l) && <p class="serving-tip">{pickText(recipe.servingTip, l)}</p>}
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
          </>
        )}
      </div>
    </>
  );
}
