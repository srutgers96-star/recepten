// '#/add' — proves keyboard behaviour: 16 px inputs, focused field never under the keyboard.
import { useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { t } from '@/i18n';
import { navigate } from '@/router';
import { db } from '@/db/db';

export function AddScreen() {
  const [name, setName] = useState('');
  const [lines, setLines] = useState<string[]>(['', '']);
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function setLine(i: number, v: string) {
    setLines((prev) => prev.map((x, j) => (j === i ? v : x)));
  }

  // Enter / "Next" on a single-line input would otherwise submit the form (implicit submission);
  // instead move focus to the next field, so enterKeyHint="next" is honest and test 5 (tap through
  // every field) never saves a half-empty recipe.
  function focusNext(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const current = e.currentTarget as HTMLElement;
    const form = current.closest('form');
    if (!form) return;
    const fields = [...form.querySelectorAll<HTMLElement>('input.input, textarea.input')];
    const next = fields[fields.indexOf(current) + 1];
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      current.blur();
    }
  }

  async function save(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      setStatus(t('add.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      const id = await db.userRecipes.add({
        name: name.trim(),
        ingredients: lines.map((l) => l.trim()).filter(Boolean),
        instructions: instructions.trim(),
        origin: 'own',
        createdAt: new Date().toISOString(),
      });
      setStatus(t('add.saved'));
      setName('');
      setLines(['', '']);
      setInstructions('');
      navigate('/recipe/u' + id);
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title={t('add.title')} />
      <form class="screen form" onSubmit={save}>
        <label class="field">
          <span>{t('add.name')}</span>
          <input
            class="input"
            type="text"
            value={name}
            placeholder={t('add.namePlaceholder')}
            autocomplete="off"
            enterKeyHint="next"
            onKeyDown={focusNext}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <div class="field">
          <span>{t('add.ingredients')}</span>
          {lines.map((line, i) => (
            <div class="line-row" key={i}>
              <input
                class="input"
                type="text"
                value={line}
                placeholder={t('add.ingredientPlaceholder')}
                autocomplete="off"
                enterKeyHint="next"
                onKeyDown={focusNext}
                onInput={(e) => setLine(i, (e.currentTarget as HTMLInputElement).value)}
              />
              {lines.length > 2 && (
                <button type="button" class="btn btn-danger" aria-label={t('add.remove')} onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" class="btn btn-small" onClick={() => setLines((prev) => [...prev, ''])}>
            {t('add.addLine')}
          </button>
        </div>

        <label class="field">
          <span>{t('add.instructions')}</span>
          <textarea class="input" rows={6} value={instructions} placeholder={t('add.instructionsPlaceholder')} onInput={(e) => setInstructions((e.currentTarget as HTMLTextAreaElement).value)} />
        </label>

        <div class="actions">
          <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
            {t('add.save')}
          </button>
        </div>
        <div class="status" role="status">
          {status}
        </div>
      </form>
    </>
  );
}
