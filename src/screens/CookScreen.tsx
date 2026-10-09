// '#/cook/:id' — cook mode (docs/phase-1-spec.md §5 "Koken"): page 0 = "Klaarzetten" checklist,
// then one step per screen in big type with timer chips, progress dots + "stap 3 van 8", swipe
// (pointer events, 60 px) and big prev/next tap zones, wake lock while open, the running-timers
// bar on top, and a last "Gekookt!" page (stars + note) → logCooked + confetti + back to the detail.
// Phase 2: the checklist renders the dictionary lines scaled to the servings chosen on the detail
// page (`?srv=6`, else the session memory, else the recipe's own), with a scaler on the card; the
// steps show °F next to °C when that setting is on. Phase 4: "Gekookt!" also ticks the dish in
// the week plan (markRecipeCookedInPlan). Phase 5 (docs/phase-5-spec.md B.1-2): a 🔊 "Lees voor"
// button per step (tap = the step, long-press = the scaled ingredient list; auto-read on step
// change with the setting speech.readAloud) and — only when the API exists and speech.commands is
// on — a mic button for voice commands (volgende/vorige/lees voor/stop/timer N minuten).
// Phase 6 (docs/phase-6-spec.md 6A.8): "herhaal" says the last read text again, "ingrediënten"
// reads the list, "hoe lang nog" speaks the remaining time of this recipe's timers, and a small
// "?" next to the mic opens <VoiceHelp/> with every command in the UI language.
import { useEffect, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { celebrate } from '@/celebrate';
import { Header } from '@/components/Header';
import { IngredientList } from '@/components/LineView';
import { parseServingsParam, rememberServings, rememberedServings, ServingsPicker } from '@/components/ServingsPicker';
import { StepView, useFahrenheit } from '@/components/StepView';
import { TimerBar } from '@/components/TimerBar';
import { VoiceHelp } from '@/components/VoiceHelp';
import { useLive } from '@/db/live';
import { addPhoto, getRecipe, listCookLog, logCooked, markRecipeCookedInPlan } from '@/db/repo';
import { lineText } from '@/dictionary';
import { nowIso, pickText, type Lang } from '@/domain/model';
import { encodePhotoFile } from '@/photo';
import { pickSpoken, type VoiceCommand } from '@/domain/voice';
import { lang, t, tIn } from '@/i18n';
import { useRecipeLines } from '@/lines';
import { activeProfile } from '@/profile';
import { goBack, route } from '@/router';
import { canSpeak, loadSpeechSettings, readAloud, speak, speaking, stopSpeaking } from '@/speech';
import { MINUTE_MS, startTimer, timers } from '@/timers';
import { canListen, commandsEnabled, loadVoiceSettings, micState, startListening, stopListening } from '@/voice';

const SWIPE_PX = 60;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 10;

/** Cook counts of one member that earn the big burst instead of the normal one (phase 5 C.4). */
const COOK_MILESTONES = new Set([10, 25, 50]);

/**
 * The remaining time of one timer as a spoken sentence (6A.8 "hoe lang nog"): whole minutes
 * (rounded up) from one minute on, seconds below that. "stap 3: nog 4 minuten" when the timer
 * belongs to a step.
 */
function spokenTimeLeft(ms: number, stepIndex: number | null, l: Lang): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  let left: string;
  if (totalSec >= 60) {
    const m = Math.ceil(totalSec / 60);
    left = m === 1 ? tIn(l, 'cook.voice.leftMin1') : tIn(l, 'cook.voice.leftMin', { n: m });
  } else {
    left = tIn(l, 'cook.voice.leftSec', { n: totalSec });
  }
  return stepIndex === null ? left : `${tIn(l, 'cook.stepShort', { n: stepIndex + 1 })}: ${left}`;
}

/**
 * Pointer handlers for the 🔊 button: a still ~500 ms press fires `onLong` (read the ingredient
 * list) and swallows the click that follows, so it never also toggles the step reading. Same
 * pattern as the long press in src/components/LineView.tsx.
 */
function useLongPress(onLong: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return {
    onPointerDown(e: PointerEvent) {
      cancel();
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        start.current = null;
        fired.current = true;
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: PointerEvent) {
      const s = start.current;
      if (!s) return;
      if (Math.abs(e.clientX - s.x) > LONG_PRESS_MOVE_PX || Math.abs(e.clientY - s.y) > LONG_PRESS_MOVE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture(e: MouseEvent) {
      // The tap that ends a long press must not also act as a normal tap.
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onContextMenu(e: Event) {
      e.preventDefault();
    },
  };
}

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
  // Phase 5 C.4: the FIRST time stars are picked in this visit gets the small burst — changing
  // the rating afterwards does not fire it again.
  const starsCelebrated = useRef(false);
  // 6A.8 "herhaal": the last text this screen read aloud (step, ingredients or a timer answer).
  const lastSpoken = useRef<{ text: string; lang: Lang } | null>(null);

  const card = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number; drag: boolean } | null>(null);
  const swiped = useRef(false);

  // --- Phase 5 block D: "Foto toevoegen" on the "Gekookt!" page (docs/phase-5-spec.md D.1).
  const [photoState, setPhotoState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhotoState('idle');
  }, [id]);

  /** Re-encodes the picked picture (≤ 1024 px WebP/JPEG) and stores it for this recipe + member. */
  async function onPhotoPicked(file: File) {
    if (!profile || photoState === 'busy') return;
    setPhotoState('busy');
    try {
      const blob = await encodePhotoFile(file);
      await addPhoto({ recipeId: id, memberId: profile.id, blob, at: nowIso() });
      setPhotoState('done');
      // The photo badges count household-wide; never block the UI on the check.
      void checkNewBadges(profile.id).catch((e: unknown) => console.error('checkNewBadges', e));
    } catch (e) {
      console.error('addPhoto', e);
      setPhotoState('error');
    }
  }

  useEffect(() => {
    setPage(0);
    setTicked(new Set());
    setStars(0);
    setNote('');
    starsCelebrated.current = false;
    lastSpoken.current = null;
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

  // --- Phase 5 B.1-2: read-aloud + voice commands (invariant 13: only offered when the API exists).
  const speechOk = canSpeak();
  const showMic = canListen() && commandsEnabled.value;
  const mic = micState.value;
  const isSpeaking = speaking.value;
  // 6A.8: the "?" sheet with every voice command.
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    void loadSpeechSettings();
    void loadVoiceSettings();
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, []);

  /** Every read-aloud of this screen goes through here so "herhaal" knows what to say again. */
  function say(text: string, spokenLang: Lang) {
    if (!text.trim()) return;
    lastSpoken.current = { text, lang: spokenLang };
    speak(text, spokenLang);
  }

  /** Reads one step in the language it is shown in (pickSpoken makes the fallback explicit). */
  function speakStep(index: number) {
    const step = steps[index];
    if (!step) return;
    const s = pickSpoken(step.text, l);
    say(s.text, s.lang);
  }

  /** Reads the scaled ingredient lines as the "Klaarzetten" page shows them; headers are skipped. */
  function speakIngredients() {
    const factor = base > 0 && servings > 0 ? servings / base : 1;
    const parts: string[] = [];
    for (const ln of lines) {
      if (ln.kind === 'header') continue; // the sentence break between lines is pause enough
      const text = lineText(ln, l, factor).trim();
      if (text) parts.push(text);
    }
    if (parts.length) say(parts.join('. '), l);
  }

  /** "Hoe lang nog": the running timers of THIS recipe, earliest first; "geen timer" when none. */
  function speakTimeLeft() {
    const at = Date.now();
    const mine = timers.value.filter((tm) => tm.recipeId === id && tm.endAt > at);
    if (mine.length === 0) {
      say(tIn(l, 'cook.voice.noTimer'), l);
      return;
    }
    say(mine.map((tm) => spokenTimeLeft(tm.endAt - at, tm.stepIndex ?? null, l)).join('. '), l);
  }

  /** "Herhaal": the last thing read aloud; before anything was read it acts like "lees voor". */
  function speakAgain(onStep: boolean) {
    const prev = lastSpoken.current;
    if (prev) say(prev.text, prev.lang);
    else if (onStep) speakStep(page - 1);
    else if (page === 0) speakIngredients();
  }

  const press = useLongPress(() => speakIngredients());

  function onReadTap() {
    if (speaking.value) stopSpeaking();
    else speakStep(page - 1);
  }

  // Auto-read on a page change onto a step (setting speech.readAloud); every other page change
  // stops the voice. Runs once at mount too (page 0 = Klaarzetten: a harmless stop).
  useEffect(() => {
    const step = page > 0 && page <= steps.length ? steps[page - 1] : undefined;
    if (step && readAloud.value && canSpeak()) {
      const s = pickSpoken(step.text, lang.value);
      say(s.text, s.lang);
    } else {
      stopSpeaking();
    }
  }, [page, id]);

  // The recognition callback lives as long as the mic runs; the ref keeps it at the latest state.
  const onVoiceCommand = useRef<(cmd: VoiceCommand) => void>(() => undefined);
  onVoiceCommand.current = (cmd) => {
    if (!recipe) return;
    const onStep = page > 0 && page <= steps.length;
    switch (cmd.kind) {
      case 'next':
        go(page + 1);
        break;
      case 'prev':
        go(page - 1);
        break;
      case 'read':
        if (onStep) speakStep(page - 1);
        else if (page === 0) speakIngredients();
        break;
      case 'repeat':
        speakAgain(onStep);
        break;
      case 'ingredients':
        speakIngredients();
        break;
      case 'timeLeft':
        speakTimeLeft();
        break;
      case 'stop':
        stopSpeaking();
        break;
      case 'timer':
        void startTimer({
          durationMs: cmd.minutes * MINUTE_MS,
          label: onStep ? `${name} · ${t('cook.stepShort', { n: page })}` : name,
          recipeId: id,
          stepIndex: onStep ? page - 1 : null,
        });
        break;
    }
  };

  function toggleMic() {
    if (micState.value !== 'off') {
      stopListening();
      return;
    }
    const voiceLang: Lang = activeProfile.value?.lang ?? lang.value;
    startListening(voiceLang, (cmd) => onVoiceCommand.current(cmd));
  }

  const micLabel =
    mic === 'listening' ? t('cook.micListening') : mic === 'starting' ? t('cook.micOn') : mic === 'error' ? t('cook.micError') : t('cook.micOff');

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

  /** A tap on star n: toggle off when it was the rating already; first pick = small burst (C.4). */
  function chooseStars(n: number) {
    const next = stars === n ? 0 : n;
    setStars(next);
    if (next > 0 && !starsCelebrated.current) {
      starsCelebrated.current = true;
      celebrate('stars');
    }
  }

  async function onCooked() {
    if (busy) return;
    setBusy(true);
    try {
      if (profile) {
        // Phase 5 (docs/phase-5-spec.md A.8): the cook-log entry is attributed to a household
        // member; a local member's id IS the profile id (src/domain/household.ts), so `profileId`
        // stays the field and no migration is needed.
        await logCooked({
          recipeId: id,
          profileId: profile.id,
          at: nowIso(),
          stars: stars > 0 ? stars : null,
          note: note.trim() ? note.trim() : null,
        });
        // Phase 5 C.4: this member's 10th/25th/50th cook gets the big burst instead of the normal one.
        let kind: 'cooked' | 'milestone' = 'cooked';
        try {
          const mine = (await listCookLog()).filter((e) => e.profileId === profile.id).length;
          if (COOK_MILESTONES.has(mine)) kind = 'milestone';
        } catch (e) {
          console.error('listCookLog', e);
        }
        celebrate(kind);
      }
      // Phase 4: a dish in the week plan gets its "Gekookt" tick (no-op when it is not in the plan).
      try {
        await markRecipeCookedInPlan(id);
      } catch (e) {
        console.error('markRecipeCookedInPlan', e);
      }
      // Phase 5 block C: start the badge check, but never make goBack wait for it — the toast
      // signal survives the navigation (the shell renders it).
      if (profile) void checkNewBadges(profile.id).catch((e: unknown) => console.error('checkNewBadges', e));
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
  const allTicked = tickable.length > 0 && tickedCount === tickable.length;

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
                  <div class="cook-ready-row">
                    <p class="muted">
                      {t('cook.prepareHint')} {tickable.length > 0 && <strong>{t('cook.ready', { n: tickedCount, total: tickable.length })}</strong>}
                    </p>
                    {tickable.length > 0 && (
                      <button type="button" class="btn btn-secondary cook-tick-all" onClick={() => setTicked(allTicked ? new Set() : new Set(tickable))}>
                        {allTicked ? t('cook.untickAll') : t('cook.tickAll')}
                      </button>
                    )}
                  </div>
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
                  {speechOk && (
                    <div class="cook-speak">
                      <button
                        type="button"
                        class={'btn-speak' + (isSpeaking ? ' on' : '')}
                        title={t('cook.readAloudHint')}
                        aria-label={isSpeaking ? t('cook.readAloudStop') : `${t('cook.readAloud')} — ${t('cook.readAloudHint')}`}
                        onClick={onReadTap}
                        {...press}
                      >
                        <span aria-hidden="true">{isSpeaking ? '■' : '🔊'}</span>
                        {isSpeaking ? t('cook.readAloudStop') : t('cook.readAloud')}
                      </button>
                    </div>
                  )}
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
                            onClick={() => chooseStars(n)}
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
                      <input
                        ref={photoInput}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style="display:none"
                        onChange={(e) => {
                          const input = e.currentTarget as HTMLInputElement;
                          const f = input.files?.[0];
                          input.value = '';
                          if (f) void onPhotoPicked(f);
                        }}
                      />
                      <button
                        type="button"
                        class={'btn btn-block cook-photo' + (photoState === 'done' ? ' done' : '')}
                        disabled={photoState === 'busy'}
                        onClick={() => photoInput.current?.click()}
                      >
                        <span aria-hidden="true">📷</span>{' '}
                        {photoState === 'busy'
                          ? t('cook.photoBusy')
                          : photoState === 'done'
                            ? `${t('cook.photoAdded')} ✓`
                            : photoState === 'error'
                              ? t('cook.photoFailed')
                              : t('cook.photoAdd')}
                      </button>
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
            {showMic && (
              <>
                <button
                  type="button"
                  class={'cook-mic' + (mic !== 'off' ? ' ' + mic : '')}
                  aria-pressed={mic !== 'off'}
                  aria-label={`${t('cook.mic')} — ${micLabel}`}
                  title={t('cook.mic')}
                  onClick={toggleMic}
                >
                  <span class="mic-ico" aria-hidden="true">
                    🎤
                  </span>
                  <span class="mic-state" aria-live="polite">
                    {micLabel}
                  </span>
                </button>
                {/* 6A.8: "?" (44 px) opens the list of commands in the UI language. */}
                <button type="button" class="cook-help" aria-label={t('cook.help')} title={t('cook.help')} aria-expanded={helpOpen} onClick={() => setHelpOpen(true)}>
                  ?
                </button>
              </>
            )}
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
      <VoiceHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
