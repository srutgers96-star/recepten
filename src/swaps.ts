// The diet swaps of data/swaps.json for the app (docs/specs/varianten-tabs.md §3 blok 1). The domain
// (src/domain/*) never imports the JSON itself: callers pass `swapsData` to `planVariant` /
// `variantView`, so the domain stays testable with any swap list.
import swapsJson from '@data/swaps.json';
import type { Swap } from '@/domain/variants';

/** data/swaps.json as the domain type (validated by tools/validate-data.ts `validateSwaps`). */
export const swapsData: Swap[] = swapsJson as Swap[];
