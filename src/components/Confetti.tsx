// CSS-only confetti burst (~1.2 s) driven by the `celebration` signal (src/celebrate.ts). Mount
// <Confetti/> once in the shell. Pointer events pass through; the overlay is aria-hidden; the CSS
// hides it under `prefers-reduced-motion` (celebrate() also skips it there).
import { useEffect, useMemo } from 'preact/hooks';
import { celebration, clearCelebration } from '@/celebrate';

export interface ConfettiProps {
  /** Number of pieces (default 80). */
  pieces?: number;
  /** Total duration in ms (default 1200). */
  durationMs?: number;
}

const COLORS = ['var(--cobalt, #2b4fa8)', 'var(--tomato, #d9402b)', 'var(--rosemary, #3d7a3a)', 'var(--orange, #d98a2e)', '#f2d16b', '#7a3d8a'];

const CSS = `
.confetti{position:fixed;inset:0;z-index:1000;pointer-events:none;overflow:hidden}
.confetti i{position:absolute;left:50%;top:58%;width:10px;height:14px;border-radius:2px;background:var(--c);
  opacity:0;transform:translate(-50%,-50%);will-change:transform,opacity;
  animation:confetti-fly var(--d) cubic-bezier(.2,.75,.3,1) var(--delay) forwards}
.confetti i.round{border-radius:50%;width:9px;height:9px}
@keyframes confetti-fly{
  0%{opacity:1;transform:translate(-50%,-50%) rotate(0deg) scale(1)}
  70%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rot)) scale(.6)}
}
@media (prefers-reduced-motion: reduce){.confetti{display:none}}
`;

/** Deterministic pseudo-random numbers so a re-render does not reshuffle the pieces. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Confetti(props: ConfettiProps) {
  const current = celebration.value;
  // Phase 5 block C: 'stars' (rating a recipe) is the small burst — fewer pieces, a shorter
  // flight. Every other kind keeps the full burst; the overlay carries data-kind either way.
  const small = current?.kind === 'stars';
  const pieces = props.pieces ?? (small ? 26 : 80);
  const durationMs = props.durationMs ?? (small ? 850 : 1200);

  useEffect(() => {
    if (!current) return;
    const handle = setTimeout(clearCelebration, durationMs + 100);
    return () => clearTimeout(handle);
  }, [current, durationMs]);

  const styles = useMemo(() => {
    if (!current) return [];
    const rnd = mulberry32(current.at);
    const out: Array<{ style: string; round: boolean }> = [];
    for (let i = 0; i < pieces; i++) {
      const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.4; // mostly upwards, wide fan
      const dist = small ? 80 + rnd() * 180 : 120 + rnd() * 320; // the small burst stays close
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist + (small ? 90 : 140); // gravity: pieces end lower than they peaked
      const color = COLORS[Math.floor(rnd() * COLORS.length)] ?? COLORS[0];
      const style = [
        `--c:${color}`,
        `--dx:${dx.toFixed(0)}px`,
        `--dy:${dy.toFixed(0)}px`,
        `--rot:${((rnd() - 0.5) * 900).toFixed(0)}deg`,
        `--d:${(durationMs * (0.75 + rnd() * 0.25)).toFixed(0)}ms`,
        `--delay:${(rnd() * 120).toFixed(0)}ms`,
      ].join(';');
      out.push({ style, round: rnd() < 0.3 });
    }
    return out;
  }, [current, pieces, durationMs]);

  if (!current) return null;
  return (
    <div class="confetti" aria-hidden="true" data-kind={current.kind}>
      <style>{CSS}</style>
      {styles.map((p, i) => (
        <i key={i} class={p.round ? 'round' : ''} style={p.style} />
      ))}
    </div>
  );
}
