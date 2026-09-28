// '#/recipe/:id' — long-scroll detail with an on-screen back button and a share button.
import { useEffect, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { lang, t } from '@/i18n';
import { navigate } from '@/router';
import { findRecipe, type Recipe } from '@/db/recipes';
import { paragraphs } from '@/db/shared';

export function RecipeScreen(props: { id: string }) {
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setRecipe(undefined);
    findRecipe(props.id).then((r) => {
      if (!cancelled) setRecipe(r ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [props.id]);

  const en = lang.value === 'en';
  const name = recipe ? (en && recipe.nameEn) || recipe.name : '';
  const instructions = recipe ? (en && recipe.instructionsEn) || recipe.instructions : '';

  return (
    <>
      <Header title={name || t('app.title')} back backLabel={t('recipe.back')} />
      <div class="screen">
        {recipe === null && <div class="empty">{t('recipe.notFound')}</div>}
        {recipe && (
          <>
            <h2 class="recipe-title">{name}</h2>
            {recipe.own && (
              <p class="muted">
                {recipe.origin === 'received' ? `${t('recipe.receivedFrom')} ${recipe.by ?? '?'}` : t('recipe.own')}
                {recipe.servings ? ` · ${recipe.servings} ${t('recipe.servings')}` : ''}
              </p>
            )}
            <section class="section">
              <h2>{t('recipe.ingredients')}</h2>
              <ul class="ingredients">
                {recipe.ingredients.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
            <section class="section">
              <h2>{t('recipe.instructions')}</h2>
              <div class="paras">
                {paragraphs(instructions).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
            <div class="actions">
              <button type="button" class="btn btn-primary btn-block" onClick={() => navigate('/share?r=' + recipe.id)}>
                {t('recipe.share')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
