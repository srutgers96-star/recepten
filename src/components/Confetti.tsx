// CSS-only confetti burst (~1.2 s) driven by the `celebration` signal (src/celebrate.ts). Mount
// <Confetti/> once in the shell. Pointer events pass through; the overlay is aria-hidden; the CSS
// hides it under `prefers-reduced-motion`; since V4 celebrate() still sets the burst there (the word shows statically).
//
// 6D-4a (docs/specs/xp-levels.md §1g): the burst's `style` (src/celebrate.ts) changes the pieces:
// 'double' = 160 pieces; 'veggies', 'party', 'trex', 'fire' and 'stars' = emoji pieces (an <i> with
// the emoji as text, 18 px); 'gold' = pieces in three golds. Anything else is the plain burst.
//
// V4 (docs/specs/verbeterronde-4.md §1c): the burst runs at `celebrationSpeed` — `durationMs` divided
// by the speed at the start of the burst; a tap halfway through speeds the pieces still flying up
// (Web Animations `playbackRate`) and re-plans the clear (afterCelebration). It holds the
// celebration while it is on screen, so a tap during the confetti counts.
//
// V5 (docs/specs/verbeterronde-5.md §1a): ten more looks, each one entry in LOOKS plus one branch in
// the piece planner — 'triple' (240 in two waves), 'quadruple' (320 smaller pieces in three waves),
// 'hearts', 'leaves' (sway, 1.6x), 'snow' (white with a rim, 1.8x), 'pasta' (inline SVG shapes),
// 'fireworks' (three bursts from three points), 'bubbles' (rise, 1.6x), 'lanterns' (glow, rise, 2x)
// and 'aurora' (ten blurred streaks, 2x). Durations and wave delays follow the same speed rule
// (divided by the burst speed); the clear waits for the longest flight plus the last wave.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { afterCelebration, celebration, celebrationSpeed, clearCelebration, holdCelebration, type Celebration } from '@/celebrate';

export interface ConfettiProps {
  /** Number of pieces (default 80). */
  pieces?: number;
  /** Total duration in ms (default 1200). */
  durationMs?: number;
}

const COLORS = ['var(--cobalt, #2b4fa8)', 'var(--tomato, #d9402b)', 'var(--rosemary, #3d7a3a)', 'var(--orange, #d98a2e)', '#f2d16b', '#7a3d8a'];
/** The 'gold' style's pieces. */
const GOLD = ['#f2d16b', '#c9a227', '#fff3b0'];
/** Styles whose pieces are emoji (text) instead of coloured paper. */
const EMOJI: Readonly<Record<string, readonly string[]>> = {
  veggies: ['🥕', '🥦', '🍅', '🌽', '🧄'],
  party: ['🐔', '🧁', '🎂', '🍰'],
  trex: ['🦖'],
  fire: ['🔥'],
  stars: ['⭐', '✨'],
  // V5
  hearts: ['❤️', '🧡', '💛', '💗'],
  leaves: ['🍂', '🍁', '🍃'],
};
/** The 'double' style's piece count (the plain burst has 80). */
const DOUBLE_PIECES = 160;

/** One V5 look: how many pieces, how long (factor on the base duration) and in which waves. */
interface LookSpec {
  pieces: number;
  /** Duration factor on the base duration (1 = the plain burst). */
  factor: number;
  /** Start of each wave in ms (speed 1); the pieces are split evenly over the waves. */
  waves: readonly number[];
}

/** V5 looks (§1a table). Looks not listed here: the plain burst's count and timing. */
const LOOKS: Readonly<Record<string, LookSpec>> = {
  triple: { pieces: 240, factor: 1, waves: [0, 250] },
  quadruple: { pieces: 320, factor: 1, waves: [0, 200, 400] },
  hearts: { pieces: 70, factor: 1.25, waves: [0] }, // "iets trager omlaag"
  leaves: { pieces: 60, factor: 1.6, waves: [0] },
  snow: { pieces: 90, factor: 1.8, waves: [0] },
  pasta: { pieces: 60, factor: 1, waves: [0] },
  fireworks: { pieces: 150, factor: 1, waves: [0, 150, 300] }, // three bursts of 50, 150 ms apart
  bubbles: { pieces: 50, factor: 1.6, waves: [0] },
  lanterns: { pieces: 24, factor: 2, waves: [0] },
  aurora: { pieces: 10, factor: 2, waves: [0] },
};

/** Duration factor of a look (1 for the plain burst and the 6D-4a styles). */
export function lookDurationFactor(look: string): number {
  return LOOKS[look]?.factor ?? 1;
}

/** Piece count of a full (not 'stars') burst of `look`. */
export function lookPieces(look: string): number {
  if (look === 'double') return DOUBLE_PIECES;
  return LOOKS[look]?.pieces ?? 80;
}

/**
 * The time a full burst of `look` needs on screen at speed 1 (ms): the longest flight
 * (base × factor) plus the last wave. Pure; the clear waits this long plus 100 ms.
 */
export function lookTotalMs(look: string, baseMs: number): number {
  const waves = LOOKS[look]?.waves ?? [0];
  return Math.round(baseMs * lookDurationFactor(look) + Math.max(0, ...waves));
}

/** Pasta tints (§1a). */
const PASTA_TINTS = ['#e8c56a', '#d9a441', '#f2dc9b'] as const;
/** Pasta shapes as inline SVG: farfalle (bow tie), penne (tube), fusilli (spiral). */
const PASTA_SHAPES = ['farfalle', 'penne', 'fusilli'] as const;
type PastaShape = (typeof PASTA_SHAPES)[number];
/** Fireworks: the three burst points (x %, y %), one per wave. */
const FIREWORK_POINTS: ReadonlyArray<readonly [number, number]> = [
  [25, 30],
  [50, 30],
  [75, 30],
];
/** Aurora streaks: green and purple (§1a). */
const AURORA = ['rgba(60,220,160,.45)', 'rgba(170,110,240,.45)'];
/** Lantern bodies (red; the gold is the rims and the glow). */
const LANTERN_RED = ['#d9402b', '#c4301f', '#e0522f'];

const CSS = `
.confetti{position:fixed;inset:0;z-index:1000;pointer-events:none;overflow:hidden}
.confetti i{position:absolute;left:50%;top:58%;width:10px;height:14px;border-radius:2px;background:var(--c);
  opacity:0;transform:translate(-50%,-50%);will-change:transform,opacity;
  animation:confetti-fly var(--d) cubic-bezier(.2,.75,.3,1) var(--delay) forwards}
.confetti i.round{border-radius:50%;width:9px;height:9px}
.confetti i.emoji{width:auto;height:auto;border-radius:0;background:none;font-size:18px;font-style:normal;line-height:1}
.confetti i.quad{width:8px;height:14px}
.confetti i.quad.round{width:8px;height:8px}
.confetti i.sway{animation:confetti-fly var(--d) cubic-bezier(.2,.75,.3,1) var(--delay) forwards,
  confetti-sway var(--sw) ease-in-out var(--delay) infinite alternate}
.confetti i.snow{width:var(--s);height:var(--s);border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.18);box-sizing:border-box}
.confetti i.pasta{width:22px;height:22px;border-radius:0;background:none}
.confetti i.pasta svg{display:block;width:100%;height:100%}
.confetti i.fw{left:var(--x);top:var(--y);width:6px;height:6px;border-radius:50%}
.confetti i.bubble{top:70%;width:var(--s);height:var(--s);border-radius:50%;background:rgba(255,255,255,.35);
  border:1px solid rgba(140,170,200,.6);box-sizing:border-box}
.confetti i.lantern{top:72%;width:12px;height:18px;border-radius:3px;background:var(--c);box-sizing:border-box;
  border-top:3px solid #f2c14e;border-bottom:3px solid #f2c14e;box-shadow:0 0 10px 2px rgba(255,190,70,.7)}
.confetti i.aurora{left:var(--x);top:var(--y);width:6px;height:120px;border-radius:3px;background:var(--c);
  filter:blur(2px);animation:confetti-aurora var(--d) ease-in-out var(--delay) forwards}
@keyframes confetti-fly{
  0%{opacity:1;transform:translate(-50%,-50%) rotate(0deg) scale(1)}
  70%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rot)) scale(.6)}
}
@keyframes confetti-sway{from{translate:-14px 0}to{translate:14px 0}}
@keyframes confetti-aurora{
  0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r0)) scaleY(.6)}
  20%{opacity:1}
  50%{transform:translate(calc(-50% + var(--dx)),-50%) rotate(var(--r1)) scaleY(1)}
  80%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% - var(--dx)),-50%) rotate(var(--r0)) scaleY(.8)}
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

/** Inline SVG for one pasta shape in one tint (decorative; the overlay is aria-hidden). */
function PastaSvg(props: { shape: PastaShape; tint: string }) {
  const { shape, tint } = props;
  const edge = 'rgba(120,80,20,.45)';
  if (shape === 'farfalle')
    return (
      <svg viewBox="0 0 24 24">
        <path d="M2 5 L12 10 L22 5 L22 19 L12 14 L2 19 Z" fill={tint} stroke={edge} stroke-width="1" stroke-linejoin="round" />
        <rect x="10" y="9" width="4" height="6" rx="1.5" fill={tint} stroke={edge} stroke-width="1" />
      </svg>
    );
  if (shape === 'penne')
    return (
      <svg viewBox="0 0 24 24">
        <path d="M6 3 L12 3 L18 21 L12 21 Z" fill={tint} stroke={edge} stroke-width="1" stroke-linejoin="round" />
        <path d="M8 7 L14 7 M9.5 11 L15.5 11 M11 15 L17 15" stroke={edge} stroke-width="1" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M8 2 C16 3 16 7 8 7 C0 7 0 11 8 11 C16 11 16 15 8 15 C0 15 0 19 8 19 C14 19 15 21 12 22"
        fill="none"
        stroke={tint}
        stroke-width="3.5"
        stroke-linecap="round"
      />
    </svg>
  );
}

interface Piece {
  style: string;
  cls: string;
  text: string | null;
  pasta: { shape: PastaShape; tint: string } | null;
}

export function Confetti(props: ConfettiProps) {
  const current = celebration.value;
  // Phase 5 block C: 'stars' (rating a recipe) is the small burst — fewer pieces, a shorter
  // flight. Every other kind keeps the full burst; the overlay carries data-kind either way.
  const small = current?.kind === 'stars';
  // 6D-4a: 'stars' (the kind) is always the plain small burst, whatever the style says.
  const look = !current || small ? 'default' : current.style;
  const pieces = props.pieces ?? (small ? 26 : lookPieces(look));
  const baseMs = props.durationMs ?? (small ? 850 : 1200);
  // V5: the time this look needs at speed 1 (longer looks, waves); the clear waits for it.
  const totalMs = lookTotalMs(look, baseMs);
  const speed = celebrationSpeed.value;
  // The speed this burst started at: its pieces are planned at durationMs / startSpeed.
  const startSpeed = useRef<{ burst: Celebration | null; speed: number }>({ burst: null, speed: 1 });
  if (startSpeed.current.burst !== current) startSpeed.current = { burst: current, speed };
  const burstSpeed = startSpeed.current.speed;
  const durationMs = baseMs / burstSpeed;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!current) return;
    const release = holdCelebration();
    // Celebration time (speed 1): the clear follows a later tap by itself.
    const timer = afterCelebration(totalMs + 100, () => {
      release();
      clearCelebration();
    });
    return () => {
      timer.cancel();
      release();
    };
  }, [current, totalMs]);

  // A tap during the burst: the pieces already flying speed up relative to the burst's own speed.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof el.getAnimations !== 'function') return;
    const rate = speed / burstSpeed;
    for (const a of el.getAnimations({ subtree: true })) a.playbackRate = rate;
  }, [current, speed, burstSpeed]);

  const styles = useMemo((): Piece[] => {
    if (!current) return [];
    const rnd = mulberry32(current.at);
    const pick = <T,>(list: readonly T[]): T => (list[Math.floor(rnd() * list.length)] ?? list[0]) as T;
    const spec = LOOKS[look];
    const waves = spec?.waves ?? [0];
    // Speed rule: the flight and the wave delays are divided by the burst speed.
    const flightMs = durationMs * (spec?.factor ?? 1);
    // Fireworks: one colour per burst.
    const fwColors = FIREWORK_POINTS.map(() => pick(COLORS));
    const out: Piece[] = [];
    for (let i = 0; i < pieces; i++) {
      const wave = Math.min(waves.length - 1, Math.floor((i * waves.length) / pieces));
      const waveDelay = (waves[wave] ?? 0) / burstSpeed;
      const vars: string[] = [];
      let cls = '';
      let text: string | null = null;
      let pasta: Piece['pasta'] = null;
      if (look === 'fireworks') {
        // A round burst from one of three points (x 25/50/75 %, y 30 %); light gravity.
        const point = FIREWORK_POINTS[wave] ?? [50, 30];
        const angle = rnd() * Math.PI * 2;
        const dist = 60 + rnd() * 110;
        vars.push(
          `--x:${point[0]}%`,
          `--y:${point[1]}%`,
          `--c:${fwColors[wave] ?? COLORS[0]}`,
          `--dx:${(Math.cos(angle) * dist).toFixed(0)}px`,
          `--dy:${(Math.sin(angle) * dist + 40).toFixed(0)}px`,
          '--rot:0deg',
        );
        cls = 'fw';
      } else if (look === 'aurora') {
        // Ten long streaks spread over the upper half of the screen, waving slowly.
        vars.push(
          `--x:${(8 + (i + rnd() * 0.6) * (84 / pieces)).toFixed(1)}%`,
          `--y:${(22 + rnd() * 20).toFixed(0)}%`,
          `--c:${AURORA[i % AURORA.length]}`,
          `--dx:${(10 + rnd() * 18).toFixed(0)}px`,
          `--r0:${((rnd() - 0.5) * 16).toFixed(0)}deg`,
          `--r1:${((rnd() - 0.5) * 24).toFixed(0)}deg`,
        );
        cls = 'aurora';
      } else {
        let angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.4; // mostly upwards, wide fan
        let dist = small ? 80 + rnd() * 180 : 120 + rnd() * 320; // the small burst stays close
        if (look === 'lanterns') {
          // Lanterns drift up almost straight.
          angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 0.5;
          dist = 220 + rnd() * 260;
        }
        const rising = look === 'bubbles' || look === 'lanterns';
        const dx = Math.cos(angle) * dist;
        // Gravity: pieces end lower than they peaked; bubbles and lanterns rise (negative gravity).
        const dy = Math.sin(angle) * dist + (small ? 90 : rising ? -140 : 140);
        const color = pick(look === 'gold' ? GOLD : look === 'lanterns' ? LANTERN_RED : COLORS);
        const spin = look === 'lanterns' ? 40 : look === 'bubbles' || look === 'snow' ? 0 : 900;
        vars.push(`--c:${color}`, `--dx:${dx.toFixed(0)}px`, `--dy:${dy.toFixed(0)}px`, `--rot:${((rnd() - 0.5) * spin).toFixed(0)}deg`);
        const round = rnd() < 0.3;
        const emoji = EMOJI[look];
        if (emoji) {
          text = pick(emoji);
          cls = 'emoji';
          if (look === 'leaves') {
            // Horizontal cradle ±14 px (a second animation on the `translate` property).
            cls += ' sway';
            vars.push(`--sw:${(500 + rnd() * 400).toFixed(0)}ms`);
          }
        } else if (look === 'snow') {
          cls = 'snow';
          vars.push(`--s:${(6 + rnd() * 3).toFixed(1)}px`);
        } else if (look === 'bubbles') {
          cls = 'bubble';
          vars.push(`--s:${(10 + rnd() * 12).toFixed(0)}px`);
        } else if (look === 'lanterns') {
          cls = 'lantern';
        } else if (look === 'pasta') {
          cls = 'pasta';
          pasta = { shape: pick(PASTA_SHAPES), tint: pick(PASTA_TINTS) };
        } else if (look === 'quadruple') {
          cls = round ? 'quad round' : 'quad';
        } else {
          cls = round ? 'round' : '';
        }
      }
      vars.push(`--d:${(flightMs * (0.75 + rnd() * 0.25)).toFixed(0)}ms`, `--delay:${(waveDelay + rnd() * 120).toFixed(0)}ms`);
      out.push({ style: vars.join(';'), cls, text, pasta });
    }
    return out;
  }, [current, look, small, pieces, durationMs, burstSpeed]);

  if (!current) return null;
  return (
    <div class="confetti" ref={root} aria-hidden="true" data-kind={current.kind} data-style={look}>
      <style>{CSS}</style>
      {styles.map((p, i) =>
        p.text !== null ? (
          <i key={i} class={p.cls} style={p.style}>
            {p.text}
          </i>
        ) : p.pasta ? (
          <i key={i} class={p.cls} style={p.style}>
            <PastaSvg shape={p.pasta.shape} tint={p.pasta.tint} />
          </i>
        ) : (
          <i key={i} class={p.cls} style={p.style} />
        ),
      )}
    </div>
  );
}
