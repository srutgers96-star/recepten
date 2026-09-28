// '#/add' and '#/edit/:id' — the recipe editor (docs/phase-1-spec.md §5): language NL / EN / both,
// name per language, servings stepper, ingredient lines, steps, "paste whole method" (splitSteps),
// Bewaar in the header (always above the keyboard) and at the bottom, Verwijder for own recipes.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { LineEditor, editTextHasContent, newEditText, type EditText } from '@/components/LineEditor';
import { Segmented } from '@/components/Segmented';
import { celebrate } from '@/celebrate';
import { deleteUserRecipe, duplicateAsOwn, getRecipe, isBuiltinId, saveUserRecipe, userRecipes } from '@/db/repo';
import { hasLang, newUserId, nowIso, type Lang, type Line, type Recipe, type Step, type Text } from '@/domain/model';
import { normalizeRecipe } from '@/domain/recipe-io';
import { splitSteps } from '@/domain/steps';
import { lang, t, tIn } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';

type Mode = 'nl' | 'en' | 'both';
type LoadState = 'loading' | 'ready' | 'missing' | 'builtin';

const MODE_LANGS: Record<Mode, Lang[]> = { nl: ['nl'], en: ['en'], both: ['nl', 'en'] };

/** Mode that shows every language the recipe has text in. */
function modeOf(r: Recipe): Mode {
  const has = (l: Lang) => hasLang(r.name, l) || r.lines.some((x) => hasLang(x.raw, l)) || r.steps.some((s) => hasLang(s.text, l));
  const nl = has('nl');
  const en = has('en');
  if (nl && en) return 'both';
  return en ? 'en' : 'nl';
}

/** {nl, en} from an edit row; empty sides are omitted, so a hidden language is kept as it was. */
function textOf(nl: string, en: string): Text {
  const out: Text = {};
  if (nl.trim()) out.nl = nl.trim();
  if (en.trim()) out.en = en.trim();
  return out;
}

/** True when the row has text in ANY language — a hidden language is never dropped on save. */
function rowHasText(x: EditText): boolean {
  return x.nl.trim() !== '' || x.en.trim() !== '';
}

/**
 * Edit rows for the lines or steps of a recipe. `src` remembers the original object per row so
 * its unknown keys (from a newer app version) survive a save (PLAN §5 round-trip).
 */
function rowsOf<T>(items: T[], text: (x: T) => Text, src: Map<string, T>): EditText[] {
  src.clear();
  const rows = items.map((x) => {
    const tx = text(x);
    const row = newEditText(tx.nl ?? '', tx.en ?? '');
    src.set(row.key, x);
    return row;
  });
  return rows.length ? rows : [newEditText()];
}

export function EditScreen(props: { id?: string }) {
  const [state, setState] = useState<LoadState>('loading');
  const [existing, setExisting] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<Mode>('nl');
  const [nameNl, setNameNl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [servingsText, setServingsText] = useState('4');
  const [lines, setLines] = useState<EditText[]>([]);
  const [steps, setSteps] = useState<EditText[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteLang, setPasteLang] = useState<Lang>('nl');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  // Original Line / Step per row key (unknown keys are carried over on save).
  const lineSrc = useRef(new Map<string, Line>());
  const stepSrc = useRef(new Map<string, Step>());

  // Load the recipe (or start empty). Defaults for a new recipe follow the active profile's language.
  useEffect(() => {
    let cancelled = false;
    setStatus('');
    setPasteOpen(false);
    setPasteText('');
    if (!props.id) {
      const l: Lang = activeProfile.value?.lang ?? lang.value;
      lineSrc.current.clear();
      stepSrc.current.clear();
      setExisting(null);
      setMode(l);
      setPasteLang(l);
      setNameNl('');
      setNameEn('');
      setServingsText('4');
      setLines([newEditText(), newEditText(), newEditText()]);
      setSteps([newEditText()]);
      setState('ready');
      return;
    }
    setState('loading');
    getRecipe(props.id).then((r) => {
      if (cancelled) return;
      if (!r) {
        setExisting(null);
        setState('missing');
        return;
      }
      setExisting(r);
      if (isBuiltinId(r.id) || r.origin.kind === 'builtin') {
        setState('builtin');
        return;
      }
      const m = modeOf(r);
      setMode(m);
      setPasteLang(m === 'en' ? 'en' : 'nl');
      setNameNl(r.name.nl ?? '');
      setNameEn(r.name.en ?? '');
      setServingsText(String(r.servings || 4));
      setLines(rowsOf(r.lines, (x) => x.raw, lineSrc.current));
      setSteps(rowsOf(r.steps, (s) => s.text, stepSrc.current));
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [props.id]);

  const langs = MODE_LANGS[mode];
  const servings = Math.max(1, Math.min(99, parseInt(servingsText, 10) || 0)) || 4;
  // Valid = something to see in the VISIBLE language(s); saving keeps every row with text in any language.
  const nameOk = langs.some((l) => (l === 'nl' ? nameNl : nameEn).trim() !== '');
  const valid = nameOk && lines.some((x) => editTextHasContent(x, langs)) && steps.some((x) => editTextHasContent(x, langs));

  const modeOptions = useMemo(
    () => [
      { value: 'nl' as Mode, label: t('edit.lang.nl') },
      { value: 'en' as Mode, label: t('edit.lang.en') },
      { value: 'both' as Mode, label: t('edit.lang.both') },
    ],
    [lang.value],
  );

  function setServings(n: number) {
    setServingsText(String(Math.max(1, Math.min(99, n))));
  }

  /**
   * The schema-2 recipe from the form; normalizeRecipe derives header lines and step timers.
   * Invariants 2 + 3: a row with text only in the hidden language is kept, not deleted (translating
   * a received EN recipe in NL mode must never drop the EN lines). Unknown keys of an original
   * line/step ride along; `kind` and `timers` are re-derived from the new text.
   */
  function build(): Recipe | null {
    const now = nowIso();
    const base: Recipe = existing ?? {
      schema: 2,
      id: newUserId(),
      rev: 1,
      createdAt: now,
      updatedAt: now,
      origin: { kind: 'user', author: activeProfile.value?.name ?? null },
      name: {},
      tags: [],
      servings: 4,
      lines: [],
      steps: [],
      goesWith: [],
      aliases: [],
    };
    const draft = {
      ...base,
      name: textOf(nameNl, nameEn),
      servings,
      lines: lines.filter(rowHasText).map((x) => {
        const { raw: _raw, kind: _kind, ...rest } = lineSrc.current.get(x.key) ?? ({ raw: {} } as Line);
        return { ...rest, raw: textOf(x.nl, x.en) };
      }),
      steps: steps.filter(rowHasText).map((x) => {
        const { text: _text, timers: _timers, ...rest } = stepSrc.current.get(x.key) ?? ({ text: {} } as Step);
        return { ...rest, text: textOf(x.nl, x.en) };
      }),
    };
    return normalizeRecipe(draft);
  }

  async function save() {
    if (!valid || busy) return;
    const recipe = build();
    if (!recipe) {
      setStatus(t('edit.saveError'));
      return;
    }
    setBusy(true);
    setStatus(t('edit.saving'));
    try {
      const firstOwn = !existing && (await userRecipes()).every((r) => r.origin.kind !== 'user');
      await saveUserRecipe(recipe);
      if (firstOwn) celebrate('firstRecipe');
      navigate('/recipe/' + recipe.id, { replace: true });
    } catch (e) {
      setStatus(`${t('edit.saveError')}: ${String(e)}`);
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || busy) return;
    if (!confirm(t('edit.confirmDelete'))) return;
    setBusy(true);
    try {
      await deleteUserRecipe(existing.id);
      navigate('/recipes', { replace: true });
    } catch (e) {
      setStatus(`${t('common.error')}: ${String(e)}`);
      setBusy(false);
    }
  }

  async function makeCopy() {
    const profile = activeProfile.value;
    if (!existing || !profile || busy) return;
    setBusy(true);
    try {
      const copy = await duplicateAsOwn(existing, profile);
      navigate('/edit/' + copy.id, { replace: true });
    } catch (e) {
      setStatus(`${t('common.error')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** "Plak hele bereiding": splitSteps; fills the empty language column by index, else appends. */
  function applyPaste() {
    const parts = splitSteps(pasteText);
    if (!parts.length) {
      setStatus(t('edit.splitNone'));
      return;
    }
    const other: Lang = pasteLang === 'nl' ? 'en' : 'nl';
    const kept = steps.filter((x) => x.nl.trim() || x.en.trim());
    const columnEmpty = kept.every((x) => x[pasteLang].trim() === '');
    let next: EditText[];
    if (kept.length && columnEmpty && kept.some((x) => x[other].trim() !== '')) {
      next = kept.map((x, i) => (i < parts.length ? { ...x, [pasteLang]: parts[i] as string } : x));
      for (let i = kept.length; i < parts.length; i++) next.push(pasteLang === 'nl' ? newEditText(parts[i], '') : newEditText('', parts[i]));
    } else {
      next = [...kept, ...parts.map((p) => (pasteLang === 'nl' ? newEditText(p, '') : newEditText('', p)))];
    }
    setSteps(next);
    setPasteText('');
    setPasteOpen(false);
    setStatus(t('edit.splitDone', { n: parts.length }));
  }

  const title = existing && state !== 'builtin' ? t('edit.titleEdit') : t('edit.titleNew');
  const saveButton = (
    <button type="button" class="btn btn-primary" disabled={!valid || busy} onClick={() => void save()}>
      {t('edit.save')}
    </button>
  );

  if (state !== 'ready') {
    return (
      <>
        <Header title={title} back backLabel={t('common.back')} />
        <div class="screen">
          {state === 'loading' && <div class="empty">{t('common.loading')}</div>}
          {state === 'missing' && <div class="empty">{t('edit.notFound')}</div>}
          {state === 'builtin' && (
            <div class="card">
              <p>{t('edit.builtin')}</p>
              <button type="button" class="btn btn-primary btn-block" disabled={busy || !activeProfile.value} onClick={() => void makeCopy()}>
                {t('edit.makeCopy')}
              </button>
              <div class="status" role="status">
                {status}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={title} back backLabel={t('common.back')}>
        {/* Sticky sub-header: language of the recipe + Bewaar, never under the keyboard. */}
        <div class="edit-bar">
          <Segmented name="edit-lang" options={modeOptions} selected={[mode]} onChange={(next) => next[0] && setMode(next[0])} />
          {saveButton}
        </div>
      </Header>
      <form
        class="screen form edit"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div class="field">
          <span>{t('edit.name')}</span>
          {langs.map((l) => (
            <div class="edit-name" key={l}>
              {langs.length > 1 && <span class="le-tag">{l.toUpperCase()}</span>}
              <input
                class="input"
                type="text"
                value={l === 'nl' ? nameNl : nameEn}
                placeholder={tIn(l, 'edit.namePlaceholder')}
                autocomplete="off"
                enterKeyHint="next"
                onKeyDown={(e) => {
                  // Enter never submits; it moves on to the next field.
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const form = (e.currentTarget as HTMLElement).closest('form');
                  const fields = form ? [...form.querySelectorAll<HTMLElement>('input.input, textarea.input')] : [];
                  const next = fields[fields.indexOf(e.currentTarget as HTMLElement) + 1];
                  if (next) {
                    next.focus();
                    next.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }
                }}
                onInput={(e) => (l === 'nl' ? setNameNl : setNameEn)((e.currentTarget as HTMLInputElement).value)}
              />
            </div>
          ))}
        </div>

        <div class="field">
          <span>{t('edit.servings')}</span>
          <div class="stepper">
            <button type="button" class="btn btn-icon" aria-label={t('edit.fewer')} disabled={servings <= 1} onClick={() => setServings(servings - 1)}>
              −
            </button>
            <input
              class="input stepper-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={servingsText}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              onInput={(e) => setServingsText((e.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))}
              onBlur={() => setServingsText(String(servings))}
            />
            <button type="button" class="btn btn-icon" aria-label={t('edit.more')} disabled={servings >= 99} onClick={() => setServings(servings + 1)}>
              +
            </button>
          </div>
        </div>

        <div class="field">
          <span>{t('edit.ingredients')}</span>
          <LineEditor
            items={lines}
            langs={langs}
            onChange={setLines}
            placeholder={{ nl: tIn('nl', 'edit.linePlaceholder'), en: tIn('en', 'edit.linePlaceholder') }}
            addLabel={t('edit.addLine')}
            removeLabel={t('edit.removeLine')}
          />
          <p class="muted small edit-hint">{t('edit.lineHint')}</p>
        </div>

        <div class="field">
          <span>{t('edit.steps')}</span>
          <LineEditor
            items={steps}
            langs={langs}
            onChange={setSteps}
            multiline
            numbered
            placeholder={{ nl: tIn('nl', 'edit.stepPlaceholder'), en: tIn('en', 'edit.stepPlaceholder') }}
            addLabel={t('edit.addStep')}
            removeLabel={t('edit.removeStep')}
          />
          {!pasteOpen ? (
            <button type="button" class="btn btn-small edit-paste-toggle" onClick={() => setPasteOpen(true)}>
              {t('edit.pasteMethod')}
            </button>
          ) : (
            <div class="card edit-paste">
              <p class="muted small">{t('edit.pasteHint')}</p>
              {langs.length > 1 && (
                <div class="edit-paste-lang">
                  <span class="muted small">{t('edit.pasteLang')}</span>
                  <Segmented
                    name="paste-lang"
                    options={[
                      { value: 'nl' as Lang, label: t('edit.lang.nl') },
                      { value: 'en' as Lang, label: t('edit.lang.en') },
                    ]}
                    selected={[pasteLang]}
                    onChange={(next) => next[0] && setPasteLang(next[0])}
                  />
                </div>
              )}
              <textarea class="input" rows={8} value={pasteText} autocomplete="off" onInput={(e) => setPasteText((e.currentTarget as HTMLTextAreaElement).value)} />
              <div class="actions">
                <button type="button" class="btn btn-primary" disabled={!pasteText.trim()} onClick={applyPaste}>
                  {t('edit.split')}
                </button>
                <button
                  type="button"
                  class="btn"
                  onClick={() => {
                    setPasteOpen(false);
                    setPasteText('');
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {!valid && <p class="muted small">{t('edit.invalidHint')}</p>}
        <div class="actions">
          <button type="submit" class="btn btn-primary btn-block" disabled={!valid || busy}>
            {t('edit.save')}
          </button>
        </div>
        {existing && (
          <div class="actions">
            <button type="button" class="btn btn-block btn-danger" disabled={busy} onClick={() => void remove()}>
              {t('edit.delete')}
            </button>
          </div>
        )}
        <div class="status" role="status">
          {status}
        </div>
      </form>
    </>
  );
}
