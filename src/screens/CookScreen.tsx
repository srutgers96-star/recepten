// '#/cook/:id' — cook mode (docs/phase-1-spec.md §5 "Koken"): page 0 = "Klaarzetten" checklist,
// then one step per screen in big type with timer chips, progress dots + "stap 3 van 8", swipe
// (pointer events, 60 px) and big prev/next tap zones, wake lock while open, the running-timers
// bar on top, and a last "Gekookt!" page (stars + note) → logCooked + confetti + back to the detail.
// Phase 2: the checklist renders the dictionary lines scaled to the servings chosen on the detail
// page (`?srv=6`, else the session memory, else the recipe's own), with a scaler on the card; the
// steps show °F next to °C when that setting is on.
import { useEffect, useRef, useState } from 'preact/hooks';
import { celebrate } from '@/celebrate';
import { Header } from '@/components/Header';
import { IngredientList } from '@/components/LineView';
import { parseServingsParam, rememberServings, rememberedServings, ServingsPicker } from '@/components/ServingsPicker';
import { StepView, useFahrenheit } from '@/components/StepView';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { getRecipe, logCooked } from '@/db/repo';
import { nowIso, pickText } from '@/domain/model';
import { lang, t } from '@/i18n';
import { useRecipeLines } from '@/lines';
import { activeProfile } from '@/profile';
import { goBack, route } from '@/router';

const SWIPE_PX = 60;

type WakeLockSentinelLike = { release(): Promise<void>; addEventListener?: (type: 'release', cb: () => void) => void };

/** Keeps the screen on while cooking; re-requests when the app comes back to the foreground. */
function useWakeLock(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wl) {
      setSupported(false);
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let gone = false;
    const request = async () => {
      if (gone || document.visibilityState !== 'visible') return;
      try {
        sentinel = await wl.request('screen');
        setSupported(true);
        if (gone) await sentinel.release();
      } catch {
        // Denied (low battery, not visible) — try again on the next visibility change.
        setSupported((s) => s ?? false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void request();
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) void sentinel.release().catch(() => undefined);
      sentinel = null;
    };
  }, []);
  return supported;
}

export function CookScreen(props: { id: string }) {
  const id = props.id;
  const l = lang.value;
  const profile = activeProfile.value;
  const recipe = useLive(async () => (await getRecipe(id)) ?? null, [id]);
  const lines = useRecipeLines(recipe);
  const fahrenheit = useFahrenheit();
  // Servings: the detail page passes its choice as ?srv=; else the session memory; else the recipe's.
  const [chosen, setChosen] = useState<number | null>(() => {
    const fromQuery = parseServingsParam(route.value.query.get('srv'));
    if (fromQuery) {
      rememberServings(id, fromQuery);
      return fromQuery;
    }
    const n = rememberedServings(id, 0);
    return n > 0 ? n : null;
  });
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const wake = useWakeLock();

  const card = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number; drag: boolean } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    setPage(0);
    setTicked(new Set());
    setStars(0);
    setNote('');
  }, [id]);

  const steps = recipe?.steps ?? [];
  const total = steps.length + 2; // prepare + steps + done
  const last = total - 1;
  const name = recipe ? pickText(recipe.name, l) : '';
  const base = recipe && recipe.servings > 0 ? recipe.servings : 4;
  const servings = chosen ?? base;

  function onServings(n: number) {
    setChosen(n);
    rememberServings(id, n);
  }

  function go(n: number) {
    if (!recipe || n < 0 || n > last || n === page) return;
    setDir(n > page ? 'next' : 'prev');
    setPage(n);
    if (card.current) card.current.scrollTop = 0;
  }

  // --- Swipe: pointerdown/pointerup delta ≥ 60 px horizontal; vertical movement dominating = scroll.
  function onPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('textarea, input, select')) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false };
    swiped.current = false;
  }
  function onPointerMove(e: PointerEvent) {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.drag && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) s.drag = true;
    if (s.drag && card.current) {
      // Follow the finger a little (capped) so the card feels attached to it.
      const follow = Math.max(-80, Math.min(80, dx * 0.35));
      card.current.style.transform = `translateX(${follow}px)`;
      card.current.style.transition = 'none';
    }
  }
  function endSwipe(e: PointerEvent, cancelled: boolean) {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id) return;
    swipe.current = null;
    if (card.current) {
      card.current.style.transition = 'transform .18s ease-out';
      card.current.style.transform = '';
    }
    if (cancelled) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      if (dx < 0) go(page + 1);
      else go(page - 1);
    }
  }

  async function onCooked() {
    if (busy) return;
    setBusy(true);
    try {
      if (profile) {
        await logCooked({
          recipeId: id,
          profileId: profile.id,
          at: nowIso(),
          stars: stars > 0 ? stars : null,
          note: note.trim() ? note.trim() : null,
        });
        celebrate('cooked');
      }
    } finally {
      setBusy(false);
    }
    goBack();
  }

  const isPrepare = page === 0;
  const isDone = page === last;
  const stepIndex = page - 1;
  const tickable = lines.map((ln, i) => (ln.kind === 'header' ? -1 : i)).filter((i) => i >= 0);
  const tickedCount = tickable.filter((i) => ticked.has(i)).length;

  return (
    <>
      <Header title={name || t('cook.title')} back backLabel={t('common.back')} />
      <TimerBar />
      {recipe === null && (
        <div class="screen">
          <div class="empty">{t('recipe.notFound')}</div>
        </div>
      )}
      {recipe && (
        <div class="cook">
          <div class="cook-progress" aria-live="polite">
            {isPrepare ? t('cook.prepare') : isDone ? t('cook.doneTitle') : t('cook.stepOf', { n: stepIndex + 1, total: steps.length })}
            <div class="dots" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <i key={i} class={i === page ? 'on' : i < page ? 'past' : ''} />
              ))}
            </div>
          </div>

          <div
            class="cook-track"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endSwipe(e, false)}
            onPointerCancel={(e) => endSwipe(e, true)}
            onClickCapture={(e) => {
              // A swipe that started on a button must not also count as a tap on it.
              if (swiped.current) {
                swiped.current = false;
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {page > 0 && <div class="cook-ghost prev" aria-hidden="true" />}
            {page < last && <div class="cook-ghost next" aria-hidden="true" />}
            <div key={page} class={'cook-card enter-' + dir} ref={card}>
              {isPrepare && (
                <>
                  <div class="cook-kicker">{t('cook.prepare')}</div>
                  <p class="muted">
                    {t('cook.prepareHint')} {tickable.length > 0 && <strong>{t('cook.ready', { n: tickedCount, total: tickable.length })}</strong>}
                  </p>
                  <ServingsPicker compact value={servings} base={base} onChange={onServings} />
                  <IngredientList
                    recipeId={id}
                    lines={lines}
                    servings={servings}
                    base={base}
                    big
                    tick={{
                      ticked,
                      toggle: (i) =>
                        setTicked((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        }),
                    }}
                  />
                  <p class="muted small cook-foot">
                    {wake === false ? t('cook.wakeNo') : t('cook.wakeHint')} {t('cook.swipeHint')}
                  </p>
                </>
              )}
              {!isPrepare && !isDone && steps[stepIndex] && (
                <>
                  <div class="cook-kicker">{t('cook.stepOf', { n: stepIndex + 1, total: steps.length })}</div>
                  <StepView big recipeId={id} recipeName={name} index={stepIndex} step={steps[stepIndex]!} fahrenheit={fahrenheit} />
                </>
              )}
              {isDone && (
                <div class="cook-done">
                  <h2>{t('cook.doneTitle')}</h2>
                  <p>{t('cook.doneText')}</p>
                  {profile ? (
                    <>
                      <div class="muted small">{t('cook.stars')}</div>
                      <div class="stars" role="radiogroup" aria-label={t('cook.stars')}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={stars === n}
                            aria-label={t('cook.starN', { n })}
                            class={n <= stars ? 'on' : ''}
                            onClick={() => setStars(stars === n ? 0 : n)}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <label class="field">
                        <span>{t('cook.noteLabel')}</span>
                        <textarea
                          class="input notes"
                          value={note}
                          placeholder={t('cook.notePlaceholder')}
                          onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)}
                        />
                      </label>
                    </>
                  ) : (
                    <p class="muted">{t('cook.noProfile')}</p>
                  )}
                  <button type="button" class="btn btn-primary btn-block cook-log" disabled={busy} onClick={() => void onCooked()}>
                    {t('cook.logIt')} 🎉
                  </button>
                </div>
              )}
            </div>
          </div>

          <div class="cook-nav">
            <button type="button" class="btn btn-secondary" disabled={page === 0} onClick={() => go(page - 1)}>
              ‹ {isDone ? t('cook.notYet') : t('cook.prev')}
            </button>
            {!isDone && (
              <button type="button" class="btn btn-primary" onClick={() => go(page + 1)}>
                {isPrepare ? t('cook.begin') : page === last - 1 ? t('cook.finish') : t('cook.next')} ›
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
