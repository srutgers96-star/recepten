// The slot under the Home greeting (docs/specs/home-a-plus.md §1c). Since 6D-1
// (docs/specs/xp-levels.md §1b) it holds the level line of the active profile:
// "Level 3 · Aardappelschiller", a thin bar and a › (tap → '#/more/profiles'), without its own
// avatar: the greeting right above already shows it (Fable, 28 Oct). <LevelLine/>
// (src/components/XpBar.tsx) renders null when badges are off, there is no profile or the state has
// not loaded yet, so the line takes no space then (PLAN.md §0: gamification never in the way). No
// badge count on Home any more (Meer → Badges is the way in). HomeScreen does not change.
import type { JSX } from 'preact';
import { LevelLine } from '@/components/XpBar';

export function HomeLevelRow(props: { profileId: string }): JSX.Element | null {
  if (!props.profileId) return null;
  return <LevelLine memberId={props.profileId} avatar={false} />;
}
