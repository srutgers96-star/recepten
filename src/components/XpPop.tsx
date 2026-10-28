// The "+12" pop (docs/specs/xp-levels.md §1c, block 6D-1), mounted once in the shell next to
// <Confetti/> and <BadgeToast/>. settleXp (src/xp.ts) puts the pops of a reward moment in the
// `xpPops` queue; this component shows them top right under the header:
// - each pop 900 ms after it was queued (the confetti is on its way back down), pops of one series
//   350 ms after each other, each visible 1.4 s (CSS fade), then dismissXpPop(id);
// - a series of two or more: the sum line `xp.sum` ("samen +66 XP", muted) under the pops, 600 ms
//   after the last pop appeared, visible 1.4 s like a pop; it is only shown for the item that carries
//   `sumAfter` and is still the last of its series (settleXp moves the sum when it merges pops);
// - Cooked! (×2): gold pill `xp.cooked`; Overcooked! (×5): tomato pill `xp.overcooked` and the shell
//   shakes 400 ms (`.shell.shake`) — not under prefers-reduced-motion and not with Confetti off
//   (then only the text).
// A stale queue is never shown for a quiet recompute: settleXp only queues pops on reward moments.
// Also here: <XpToast/>, the honest 0-XP toast (§1e: `xp.busyWeek`, `xp.dayCap`, `xp.rulesChanged`;
// class `xp-toast`, 5 s, not tappable), driven by the `xpToast` signal (an i18n key).
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { badgesEnabled } from '@/badges';
import { confettiEnabled, prefersReducedMotion } from '@/celebrate';
import type { Crit } from '@/domain/xp';
import { t } from '@/i18n';
import { dismissXpPop, xpPops, xpToast, type XpPopItem } from '@/xp';
import { formatXp } from './XpBar';

/** Delay between the reward moment (the item entering the queue) and its pop. */
export const POP_DELAY_MS = 900;
/** Between two pops of one series. */
export const POP_GAP_MS = 350;
/** How long one pop (and the sum line) stays visible; the CSS fade runs over the same time. */
export const POP_VISIBLE_MS = 1400;
/** The sum line appears this long after the last pop of a series. */
export const POP_SUM_MS = 600;
/** The Overcooked! shake of the shell. */
export const SHAKE_MS = 400;
/** The 0-XP toast. */
export const XP_TOAST_MS = 5000;

/**
 * True while a pop or a sum line is scheduled or on screen. <LevelUpSheet/> waits for this (and an
 * empty queue) so the sheet opens after the last pop.
 */
export const xpPopsActive = signal(false);

interface ShownPop {
  id: number;
  xp: number;
  crit: Crit | null;
}

interface ShownSum {
  key: number;
  amount: number;
}

function popLabel(p: ShownPop): string {
  const n = formatXp(p.xp);
  if (p.crit === 'overcooked') return t('xp.overcooked', { n });
  if (p.crit === 'cooked') return t('xp.cooked', { n });
  return `+${n}`;
}

function shakeShell(): void {
  if (!confettiEnabled.value || prefersReducedMotion()) return;
  const shell = typeof document !== 'undefined' ? document.querySelector('.shell') : null;
  if (!shell) return;
  shell.classList.remove('shake');
  // Restart the animation when two Overcooked! pops follow each other closely.
  void (shell as HTMLElement).offsetWidth;
  shell.classList.add('shake');
  setTimeout(() => shell.classList.remove('shake'), SHAKE_MS);
}

export function XpPop(): JSX.Element | null {
  const queue = xpPops.value;
  const [shown, setShown] = useState<ShownPop[]>([]);
  const [sum, setSum] = useState<ShownSum | null>(null);

  // Scheduler state (refs: it lives across renders and must not re-render by itself).
  const scheduled = useRef(new Set<number>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const lastShowAt = useRef(0);
  const lastId = useRef<number | null>(null);
  const seriesCount = useRef(0);
  const pending = useRef(0);

  function later(ms: number, fn: () => void): void {
    pending.current++;
    xpPopsActive.value = true;
    const h = setTimeout(() => {
      timers.current.delete(h);
      try {
        fn();
      } finally {
        pending.current--;
        if (pending.current <= 0) {
          pending.current = 0;
          seriesCount.current = 0;
          xpPopsActive.value = false;
        }
      }
    }, Math.max(0, ms));
    timers.current.add(h);
  }

  useEffect(() => {
    const fresh = queue.filter((item) => !scheduled.current.has(item.id));
    if (fresh.length === 0) return;
    // Badges off: XP leaves no trace (settleXp is a no-op then; this only guards a stray item).
    if (!badgesEnabled.value) {
      for (const item of fresh) dismissXpPop(item.id);
      return;
    }
    const now = Date.now();
    for (const item of fresh) {
      scheduled.current.add(item.id);
      const showAt = Math.max(now + POP_DELAY_MS, lastShowAt.current + POP_GAP_MS);
      lastShowAt.current = showAt;
      lastId.current = item.id;
      seriesCount.current++;
      const id = item.id;
      later(showAt - now, () => {
        const current: XpPopItem = xpPops.value.find((q) => q.id === id) ?? item;
        setShown((list) => [...list, { id, xp: current.xp, crit: current.crit }]);
        if (current.crit === 'overcooked') shakeShell();
        later(POP_SUM_MS, () => {
          const latest = xpPops.value.find((q) => q.id === id);
          const amount = latest?.sumAfter;
          // Only the last pop of a series of two or more carries the sum line.
          if (amount === undefined || lastId.current !== id || seriesCount.current < 2) return;
          const key = id;
          setSum({ key, amount });
          later(POP_VISIBLE_MS, () => setSum((s) => (s && s.key === key ? null : s)));
        });
        later(POP_VISIBLE_MS, () => {
          setShown((list) => list.filter((p) => p.id !== id));
          dismissXpPop(id);
        });
      });
    }
  }, [queue]);

  // The shell lives as long as the app; still, never leave timers behind.
  useEffect(
    () => () => {
      for (const h of timers.current) clearTimeout(h);
      timers.current.clear();
      xpPopsActive.value = false;
    },
    [],
  );

  return (
    <div class="xp-pop-wrap" aria-live="polite">
      {shown.map((p) => (
        <div key={p.id} class={'xp-pop' + (p.crit ? ' ' + p.crit : '')}>
          {popLabel(p)}
        </div>
      ))}
      {sum && (
        <div key={'sum' + sum.key} class="xp-pop-sum">
          {t('xp.sum', { n: formatXp(sum.amount) })}
        </div>
      )}
    </div>
  );
}

/** The honest 0-XP toast (§1e), same look as the badge toast, 5 s, not tappable. */
export function XpToast(): JSX.Element {
  const key = badgesEnabled.value ? xpToast.value : null;
  useEffect(() => {
    if (!key) return;
    const handle = setTimeout(() => {
      if (xpToast.value === key) xpToast.value = null;
    }, XP_TOAST_MS);
    return () => clearTimeout(handle);
  }, [key]);
  return (
    <div class="xp-toast-wrap" aria-live="polite">
      {key && <div class="xp-toast">{t(key)}</div>}
    </div>
  );
}
