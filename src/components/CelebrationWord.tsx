// The word of a celebration (docs/specs/verbeterronde-4.md §1a, block V4), mounted once in the shell
// right after <Confetti/>. It listens to `celebration` (src/celebrate.ts): 'cooked' shows "Cooked!" (NL too)
// (`celebrate.cooked`), 'challenge' shows "Gehaald!" (`celebrate.challenge`), big and centred over the
// screen (48 px, 800, the gold --celebrate-gold #c9a227 with a dark text shadow), in the cook typeface
// when one is chosen (`data-font` = the setting `cook.font`, the same font rules as the cook card),
// scaling 0.8 → 1.0 in 180 ms and fading at the end; 1.4 s in all (WORD_MS). 'milestone',
// 'firstRecipe' and 'stars' get no word (the badge toast and the pop already say it).
// Overcooked: a crit 'overcooked' arriving while the word stands (`celebrationCrit`, src/xp.ts) turns
// it into "Overcooked!" (`celebrate.overcooked`) in the crit red of the pop and keeps it 1.0 s longer;
// the shell shake is played by <XpRise/>/<XpPop/>, not here (never twice). A crit 'cooked' gives the
// word a golden glow (a bigger text-shadow), no other text.
// It follows `confettiEnabled` (off = no word; celebrate() fires nothing then) and
// prefers-reduced-motion (1.4 s static: no scale, no glow, no fade). pointer-events none and
// aria-hidden: the toast and the pop stay the accessible message. Its durations run at
// `celebrationSpeed` (a tap anywhere halves what is left, V4 §1c).
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  afterCelebration,
  celebration,
  celebrationSpeed,
  confettiEnabled,
  holdCelebration,
  prefersReducedMotion,
  type CelebrationKind,
  type CelebrationTimer,
} from '@/celebrate';
import { getSetting } from '@/db/repo';
import { t } from '@/i18n';
import { COOK_FONT_SETTING, type CookFont } from '@/unlocks';
import { celebrationCrit } from '@/xp';

/** How long the word stands (celebration time, speed 1). */
export const WORD_MS = 1400;
/** Overcooked! keeps the word this much longer. */
export const OVERCOOKED_EXTRA_MS = 1000;
/** The fade at the end of the word (part of WORD_MS). */
export const WORD_FADE_MS = 250;

export type CelebrationWordKey = 'cooked' | 'overcooked' | 'challenge';

/** The word a celebration starts with: 'cooked' → Cooked!, 'challenge' → Gehaald!, the rest none. */
export function wordForKind(kind: CelebrationKind): CelebrationWordKey | null {
  if (kind === 'cooked') return 'cooked';
  if (kind === 'challenge') return 'challenge';
  return null;
}

const WORD_KEYS: Record<CelebrationWordKey, string> = {
  cooked: 'celebrate.cooked',
  overcooked: 'celebrate.overcooked',
  challenge: 'celebrate.challenge',
};

interface ShownWord {
  /** `celebration.at` of the burst this word belongs to. */
  at: number;
  word: CelebrationWordKey;
  glow: boolean;
  font: CookFont;
  fading: boolean;
  still: boolean;
}

async function readCookFont(): Promise<CookFont> {
  try {
    const v = await getSetting<unknown>(COOK_FONT_SETTING, 'default');
    return v === 'chalk' || v === 'hand' ? v : 'default';
  } catch {
    return 'default';
  }
}

export function CelebrationWord(): JSX.Element | null {
  const current = celebration.value;
  const crit = celebrationCrit.value;
  const speed = celebrationSpeed.value;
  const on = confettiEnabled.value;
  const [shown, setShown] = useState<ShownWord | null>(null);
  const shownRef = useRef<ShownWord | null>(null);
  shownRef.current = shown;
  const timer = useRef<CelebrationTimer | null>(null);
  const release = useRef<(() => void) | null>(null);
  const lastAt = useRef<number | null>(null);

  function stop(): void {
    timer.current?.cancel();
    timer.current = null;
    release.current?.();
    release.current = null;
  }

  function fadeOut(still: boolean): void {
    if (still) {
      stop();
      setShown(null);
      return;
    }
    setShown((w) => (w ? { ...w, fading: true } : w));
    timer.current = afterCelebration(WORD_FADE_MS, () => {
      timer.current = null;
      release.current?.();
      release.current = null;
      setShown(null);
    });
  }

  /** Applies a crit to the standing word (Overcooked! once: +1.0 s; Cooked! ×2: the glow). */
  function applyCrit(c: { crit: string; at: number } | null): void {
    const w = shownRef.current;
    if (!w || !c || c.at < w.at) return;
    if (c.crit === 'overcooked' && w.word !== 'overcooked') {
      setShown({ ...w, word: 'overcooked', fading: false });
      if (w.fading) {
        // Already fading: stand again for the extra second, then fade.
        timer.current?.cancel();
        timer.current = afterCelebration(OVERCOOKED_EXTRA_MS, () => fadeOut(w.still));
      } else {
        timer.current?.extend(OVERCOOKED_EXTRA_MS);
      }
    } else if (c.crit === 'cooked' && !w.glow && !w.still) {
      setShown({ ...w, glow: true });
    }
  }

  // A new burst: start its word (after reading the cook typeface, so the letters never switch).
  useEffect(() => {
    if (!current || current.at === lastAt.current) return;
    lastAt.current = current.at;
    const word = wordForKind(current.kind);
    if (!word || !confettiEnabled.value) return;
    let cancelled = false;
    void readCookFont().then((font) => {
      if (cancelled) return;
      stop();
      const still = prefersReducedMotion();
      const w: ShownWord = { at: current.at, word, glow: false, font, fading: false, still };
      shownRef.current = w;
      setShown(w);
      release.current = holdCelebration();
      timer.current = afterCelebration(still ? WORD_MS : WORD_MS - WORD_FADE_MS, () => fadeOut(still));
      // A crit that came in before the word could show (the settle beat the font read).
      applyCrit(celebrationCrit.peek());
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    applyCrit(crit);
  }, [crit]);

  // Confetti switched off while the word stands: gone.
  useEffect(() => {
    if (!on && shownRef.current) {
      stop();
      setShown(null);
    }
  }, [on]);

  useEffect(() => () => stop(), []);

  if (!shown || !on) return null;
  const cls = ['celebrate-word', shown.word, shown.glow ? 'glow' : '', shown.fading ? 'out' : '', shown.still ? 'still' : ''].filter(Boolean).join(' ');
  return (
    <div class="celebrate-word-wrap" aria-hidden="true">
      <span class={cls} data-font={shown.font} style={{ '--word-fade': `${Math.round(WORD_FADE_MS / speed)}ms` }}>
        {t(WORD_KEYS[shown.word])}
      </span>
    </div>
  );
}
