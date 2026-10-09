// '#/story' — cover hero, the About text of the first edition (NL verbatim, EN translation), the
// edition line, "Samen al N van de 196 gekookt" (distinct builtin ids in the cook log) and — phase
// 5 block D.3 — the household: its name and everyone who cooks along (profiles on this phone plus
// the hand-added members, src/domain/household.ts). Phase 6 (docs/phase-6-spec.md "Besluiten"):
// the "☕ Steun dit project" link at the bottom (DonateBlock from the Meer screen).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { bundled, cookedRecipeIds, getHousehold, isBuiltinId } from '@/db/repo';
import { householdName, membersFrom, type HouseholdSetting } from '@/domain/household';
import { lang, t } from '@/i18n';
import { profiles } from '@/profile';
import { DonateBlock } from './MoreScreen';
import { Avatar } from './ProfilesScreen';

export function StoryScreen() {
  const [cooked, setCooked] = useState<number | null>(null);
  const [household, setHousehold] = useState<HouseholdSetting | null>(null);
  const total = bundled.recipes.length;

  useEffect(() => {
    let cancelled = false;
    cookedRecipeIds()
      .then((ids) => {
        if (cancelled) return;
        let n = 0;
        for (const id of ids) if (isBuiltinId(id)) n++;
        setCooked(n);
      })
      .catch(() => setCooked(0));
    // The household card (D.3): name + members; profiles alone are fine while it loads.
    getHousehold()
      .then((h) => {
        if (!cancelled) setHousehold(h);
      })
      .catch((e: unknown) => console.error('getHousehold', e));
    return () => {
      cancelled = true;
    };
  }, []);

  // Local profiles first, then the hand-added / card members (domain/household rules).
  const list = profiles.value;
  const members = useMemo(() => membersFrom(list, household ?? { name: '', members: [] }), [list, household]);

  return (
    <>
      <Header title={t('story.title')} back backLabel={t('common.back')} />
      <div class="screen">
        <img class="story-hero" src={import.meta.env.BASE_URL + 'cover.webp'} alt="" />
        <div class="story">
          <p>{t('story.p1')}</p>
          <p>{t('story.p2')}</p>
          <p>{t('story.p3')}</p>
          <p>{t('story.p4')}</p>
          <p class="sign">{t('story.sign')}</p>
          <p class="edition">{t('story.edition')}</p>
        </div>
        <div class="card story-stat">
          <strong>{cooked === null ? '…' : `${cooked} / ${total}`}</strong>
          <div>{t('story.cooked', { n: cooked ?? 0, total })}</div>
          <div class="muted small">{t('story.cookedHint')}</div>
        </div>
        {/* Phase 5 block D.3: who cooks along — the household name and its members. */}
        {members.length > 0 && (
          <section class="card story-members">
            <h2>{t('story.members')}</h2>
            <div class="muted small">{householdName(household, lang.value)}</div>
            <ul class="member-chips">
              {members.map((m) => (
                <li key={m.id} class="member">
                  <Avatar profile={m} />
                  <span>{m.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Phase 6: a plain link to the public bunq page; no payments inside the app (invariant 14). */}
        <section class="card story-donate">
          <DonateBlock center />
        </section>
      </div>
    </>
  );
}
