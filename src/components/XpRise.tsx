// The XP strip (docs/specs/verbeterronde-4.md §1b, block V4), mounted once in the shell before
// <LevelUpSheet/>. settleXp (src/xp.ts) puts the XP of cooking, the week, badges and challenges in
// the `xpRise` signal (photo and rating stay the small pops of <XpPop/>); this strip shows it:
// - it slides in from below, right above the navigation bar, with the content of the XpBar: line 1
//   "Level 5 · Boterhamsmeerder" with "+42 XP" (`xp.rise.plus`) on the right, the cobalt bar under it;
// - the bar starts at `totalFrom` and runs to `totalTo` in 1.2 s (RISE_MS, requestAnimationFrame,
//   ease-out); the number on the right counts along. A level-up on the way: the bar runs full, jumps
//   empty into the new level, the title line changes and the bar runs on to `totalTo`; then
//   `releaseLevelUp` opens the existing level-up sheet (it waited for this);
// - it stays 1.2 s (HOLD_MS) after running up, slides away and clears `xpRise`. A tap on the strip
//   closes it at once (and releases a waiting level-up);
// - a second rise while the strip stands (settleXp merged it into the same `xpRise`) runs on from
//   where the bar is to the new `totalTo`;
// - only with badges on (`badgesEnabled`); otherwise it renders nothing and releases at once;
// - prefers-reduced-motion: no running up, the bar stands on `totalTo` straight away, 1.8 s visible
//   (the level-up is released right away: there is nothing to wait for);
// - a crit 'overcooked' shakes the shell (`.shell.shake`, shakeShell from XpPop; moved here from the
//   pops in V4);
// - all durations run at `celebrationSpeed` (a tap anywhere during the celebration halves what is left).
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { badgesEnabled } from '@/badges';
import { afterCelebration, celebrationSpeed, holdCelebration, prefersReducedMotion, type CelebrationTimer } from '@/celebrate';
import { MAX_LEVEL } from '@/domain/levels';
import { levelForXp, xpForLevel } from '@/domain/xp';
import { t } from '@/i18n';
import { clearXpRise, releaseLevelUp, xpRise, type XpRiseInfo } from '@/xp';
import { formatXp, levelTitleText } from './XpBar';
import { shakeShell } from './XpPop';

/** Running up from totalFrom to totalTo (celebration time, speed 1). */
export const RISE_MS = 1200;
/** How long the strip stays after running up. */
export const HOLD_MS = 1200;
/** Under prefers-reduced-motion: no running up, visible this long. */
export const RISE_STILL_MS = 1800;
/** The slide-out at the end (CSS uses the same time, divided by the speed). */
export const RISE_OUT_MS = 250;

/** Ease-out (cubic): fast first, slow at the end. */
export function easeOut(p: number): number {
  const x = Math.min(1, Math.max(0, p));
  return 1 - (1 - x) ** 3;
}

/** The level and how far into it (0…1) a total is; 1 on the max level. */
export function riseBar(total: number): { level: number; progress: number } {
  const level = levelForXp(Math.max(0, total));
  if (level >= MAX_LEVEL) return { level, progress: 1 };
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - start;
  if (span <= 0) return { level, progress: 1 };
  return { level, progress: Math.min(1, Math.max(0, (total - start) / span)) };
}

interface ShownRise {
  /** The total the bar shows right now (not rounded). */
  value: number;
  /** `totalFrom` of this rise: "+n XP" = value − from. */
  from: number;
  out: boolean;
}

export function XpRise(): JSX.Element | null {
  const info = xpRise.value;
  const on = badgesEnabled.value;
  const speed = celebrationSpeed.value;
  const [shown, setShown] = useState<ShownRise | null>(null);

  const valueRef = useRef(0);
  const active = useRef<XpRiseInfo | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<CelebrationTimer | null>(null);
  const release = useRef<(() => void) | null>(null);

  function cancelMotion(): void {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    timer.current?.cancel();
    timer.current = null;
  }

  /** Opens the level-up sheet the rise held back (releaseLevelUp announces each level-up once). */
  function releaseFor(r: XpRiseInfo): void {
    releaseLevelUp(r);
  }

  /** Gone (slid away, or tapped): a waiting level-up is released, `xpRise` cleared. */
  function finish(): void {
    cancelMotion();
    const r = active.current;
    active.current = null;
    if (r) releaseFor(r);
    release.current?.();
    release.current = null;
    setShown(null);
    clearXpRise();
  }

  function leave(): void {
    setShown((s) => (s ? { ...s, out: true } : s));
    timer.current = afterCelebration(RISE_OUT_MS, finish);
  }

  function hold(ms: number): void {
    timer.current?.cancel();
    timer.current = afterCelebration(ms, leave);
  }

  /** Runs the bar from where it stands to `r.totalTo` in RISE_MS of celebration time. */
  function runUp(r: XpRiseInfo): void {
    cancelMotion();
    const from = valueRef.current;
    const to = r.totalTo;
    let elapsed = 0;
    let last: number | null = null;
    const step = (now: number): void => {
      if (last !== null) elapsed += (now - last) * celebrationSpeed.peek();
      last = now;
      const p = elapsed / RISE_MS;
      const value = from + (to - from) * easeOut(p);
      valueRef.current = value;
      setShown((s) => (s ? { ...s, value, out: false } : s));
      if (p < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      frame.current = null;
      valueRef.current = to;
      setShown((s) => (s ? { ...s, value: to } : s));
      releaseFor(r);
      hold(HOLD_MS);
    };
    frame.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!info) {
      // Cleared from outside (a restore, badges off): nothing left to show.
      if (active.current) {
        cancelMotion();
        active.current = null;
        release.current?.();
        release.current = null;
        setShown(null);
      }
      return;
    }
    if (info === active.current) return;
    // Badges off: XP leaves no trace; a waiting level-up is not held back by a strip that never shows.
    if (!on) {
      clearXpRise();
      return;
    }
    // Another member's rise replaced the open one (settleXp released that one's level-up): start over.
    const prev = active.current && active.current.memberId === info.memberId ? active.current : null;
    if (active.current && !prev) cancelMotion();
    active.current = info;
    if (info.crit === 'overcooked' && prev?.crit !== 'overcooked') shakeShell();
    const still = prefersReducedMotion();
    if (!prev) {
      release.current ??= holdCelebration();
      valueRef.current = still ? info.totalTo : info.totalFrom;
      setShown({ value: valueRef.current, from: info.totalFrom, out: false });
    } else {
      setShown((s) => (s ? { ...s, from: info.totalFrom, out: false } : { value: valueRef.current, from: info.totalFrom, out: false }));
    }
    if (still) {
      cancelMotion();
      valueRef.current = info.totalTo;
      setShown((s) => (s ? { ...s, value: info.totalTo } : s));
      releaseFor(info);
      hold(RISE_STILL_MS);
      return;
    }
    runUp(info);
  }, [info, on]);

  useEffect(
    () => () => {
      cancelMotion();
      release.current?.();
      release.current = null;
    },
    [],
  );

  if (!shown || !on) return null;
  const { level, progress } = riseBar(shown.value);
  const title = levelTitleText(level);
  const plus = t('xp.rise.plus', { xp: formatXp(Math.max(0, Math.round(shown.value - shown.from))) });
  return (
    <div class="xp-rise-wrap">
      <button
        type="button"
        class={'xp-rise' + (shown.out ? ' out' : '')}
        style={{ '--rise-out': `${Math.round(RISE_OUT_MS / speed)}ms` }}
        onClick={finish}
      >
        <span class="xp-head">
          <strong class="xp-title">{title}</strong>
          <span class="xp-rise-plus">{plus}</span>
        </span>
        <span class="xp-bar" aria-hidden="true">
          <span class="xp-bar-fill" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
        </span>
      </button>
    </div>
  );
}
