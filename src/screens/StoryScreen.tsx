// '#/story' — cover hero, the About text of the first edition (NL verbatim, EN translation), the
// edition line and "Samen al N van de 196 gekookt" (distinct builtin ids in the cook log).
import { useEffect, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { bundled, cookedRecipeIds, isBuiltinId } from '@/db/repo';
import { t } from '@/i18n';

export function StoryScreen() {
  const [cooked, setCooked] = useState<number | null>(null);
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
    return () => {
      cancelled = true;
    };
  }, []);

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
      </div>
    </>
  );
}
