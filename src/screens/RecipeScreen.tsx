// '#/recipe/:id' — detail (docs/phase-1-spec.md §5): name, servings, meta, Koken / Deel, ★,
// tickable ingredients (memory only), numbered steps with timer chips, "Bij dit gerecht", notes
// per profile (autosave), and own → Bewerk / Verwijder, classic → "Maak eigen kopie".
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { formatShortDate } from '@/components/RecipeRow';
import { StepView } from '@/components/StepView';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { allRecipes, cookStats, deleteUserRecipe, duplicateAsOwn, getNote, getRecipe, listFavorites, setNote, toggleFavorite } from '@/db/repo';
import { pickText, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';

const NOTE_DEBOUNCE_MS = 600;

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

export function RecipeScreen(props: { id: string }) {
  const id = props.id;
  const l = lang.value;
  const profile = activeProfile.value;
  const pid = profile?.id ?? '';
  const recipe = useLive(async () => (await getRecipe(id)) ?? null, [id]);
  const favs = useLive(() => (pid ? listFavorites(pid) : Promise.resolve(new Set<string>())), [pid]);
  const stats = useLive(() => cookStats(id), [id]);
  const all = useLive(allRecipes, []);
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimer = useRef<number | null>(null);
  const noteDirty = useRef<string | null>(null);

  // Tick state and the delete confirmation are per recipe, in memory only.
  useEffect(() => {
    setTicked(new Set());
    setConfirmDelete(false);
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

  const related = useMemo(() => {
    if (!recipe || !all) return [];
    const ids = new Set(recipe.goesWith);
    const out = all.filter((r) => r.id !== recipe.id && (ids.has(r.id) || r.goesWith.includes(recipe.id)));
    return out.sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), l));
  }, [recipe, all, l]);

  const meta: string[] = [];
  if (recipe) {
    meta.push(t('recipe.persons', { n: recipe.servings }));
    meta.push(originLine(recipe, l, all));
    if (stats) {
      if (stats.count > 0) {
        meta.push(t('recipe.cookedTimes', { n: stats.count }));
        if (stats.last) meta.push(t('recipe.lastCooked', { date: formatShortDate(stats.last, l) }));
      } else meta.push(t('recipe.neverCooked'));
    }
  }

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
            <p class="detail-meta">{meta.join(' · ')}</p>

            <div class="detail-actions">
              <button type="button" class="btn btn-primary" onClick={() => navigate('/cook/' + id)}>
                {t('recipe.cook')}
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => navigate('/share/' + id)}>
                {t('recipe.share')}
              </button>
            </div>

            <section class="section">
              <h2>{t('recipe.ingredients')}</h2>
              <ul class="ing">
                {recipe.lines.map((line, i) => {
                  const text = pickText(line.raw, l);
                  if (line.kind === 'header') {
                    return (
                      <li key={i} class="ing-header">
                        {text.replace(/:\s*$/, '')}
                      </li>
                    );
                  }
                  const on = ticked.has(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        class={'ing-row' + (on ? ' on' : '')}
                        aria-pressed={on}
                        onClick={() =>
                          setTicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                      >
                        <span class="box" aria-hidden="true">
                          {on ? '✓' : ''}
                        </span>
                        <span class="txt">{text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section class="section">
              <h2>{t('recipe.steps')}</h2>
              {recipe.steps.some((s) => s.timers && s.timers.length) && <p class="muted small">{t('recipe.timerHint')}</p>}
              <ol class="steps">
                {recipe.steps.map((s, i) => (
                  <StepView key={i} recipeId={id} recipeName={name} index={i} step={s} />
                ))}
              </ol>
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
