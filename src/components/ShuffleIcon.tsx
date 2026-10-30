// The "shuffle" mark for every random pick in the app: Verras me (week, Kies 7, avatar maker), Iets anders /
// Nog een (Home) and the per-slot reroll in the week. Replaces the 🎲 emoji (Stijn 30 Oct: "zo Claude-standaard"):
// two crossing arrows in the line style of the other icon buttons, currentColor, decorative (the button text or
// aria-label carries the meaning).
import type { JSX } from 'preact';

export function ShuffleIcon(props: { size?: number; class?: string }): JSX.Element {
  const s = props.size ?? 18;
  return (
    <svg
      class={'shuffle-icon' + (props.class ? ` ${props.class}` : '')}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: '-4px' }}
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </svg>
  );
}
