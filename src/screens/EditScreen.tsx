// '#/add' and '#/edit/:id' — the recipe editor (docs/phase-1-spec.md §5, docs/phase-2-spec.md §5
// "Editor"): language NL / EN / both, name per language, servings stepper, ingredient lines with
// live chips (parsed against the dictionary; "Koppel" / "Nieuw ingrediënt" for unresolved lines;
// tapping a chip edits qty/unit/prep/optional, written back into the raw text), steps, "paste
// whole method" (splitSteps), the language pair ("Kopieer voor vertaling" / "Plak vertaling" via
// an external AI) and, on the add screen, "Importeer van foto/tekst". Bewaar in the header (always
// above the keyboard) and at the bottom, Verwijder for own recipes.
//
// A builtin opens in OVERRIDE mode: the classic itself is never modified; Bewaar stores only the
// changed fields (name, servingTip, lines, steps) as a RecipeOverride patch (repo.saveOverride),
// "Herstel origineel" removes it. The structure of a line (qty, unit, ing, …) is re-derived from
// its raw text whenever that text changes (invariant 2); a hand-linked ingredient wins.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { IngredientPicker } from '@/components/IngredientPicker';
import { LineChips, rawFromLine, type LineEdit } from '@/components/LineChips';
import { LineEditor, editTextHasContent, newEditText, type EditText } from '@/components/LineEditor';
import { Segmented } from '@/components/Segmented';
import { celebrate } from '@/celebrate';
import { clearOverride, deleteUserRecipe, duplicateAsOwn, getBaseRecipe, getOverride, getRecipe, isBuiltinId, listLineOverrides, saveOverride, saveUserRecipe, userRecipes } from '@/db/repo';
import { dictionary, type Dictionary } from '@/dictionary';
import { hasLang, newUserId, nowIso, type Lang, type Line, type Recipe, type Step, type Text } from '@/domain/model';
import { applyLineOverrides, type RecipeOverride, type RecipePatch } from '@/domain/overrides';
import { parseLine } from '@/domain/parser';
import { buildImportPrompt, parsePlainRecipe } from '@/domain/photo-import';
import { normalizeRecipe } from '@/domain/recipe-io';
import { splitSteps } from '@/domain/steps';
import { buildTranslationPrompt, parseTranslationAnswer } from '@/domain/translate-prompt';
import { lang, t, tIn } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';

type Mode = 'nl' | 'en' | 'both';
type LoadState = 'loading' | 'ready' | 'missing';

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

// --- effective line of a row ---------------------------------------------------------------------

/** The keys the parser derives; everything else on a line is an unknown key that rides along. */
const STRUCT_KEYS = new Set(['raw', 'kind', 'qty', 'unit', 'ing', 'name', 'qual', 'part', 'prep', 'note', 'packSize', 'alt', 'altMode', 'optional', 'role', 'confidence']);

/** A line that carries parser output (builtins, lines saved by this editor), not just `raw`. */
function isStructured(l: Line): boolean {
  return 'confidence' in l || 'ing' in l || 'qty' in l;
}

/**
 * The structured line for an edit row: the original line as long as its source-language text is
 * unchanged (keeps the translation pass's `prep.en`, `ing`, …), else a fresh parse of the text
 * (Dutch when present, else English) with the original's unknown keys, its English prep/note
 * when the Dutch prep is the same, and its hand-set `ing` when the parser cannot resolve the
 * line. A manually linked ingredient (the picker) always wins. An `ing` this dictionary does not
 * know (a received recipe linked to a user entry on the other phone) is never carried forward:
 * the line is re-parsed and shows as unresolved.
 */
function effectiveLine(row: EditText, src: Line | undefined, manualIng: string | undefined, dict: Dictionary): Line {
  const raw = textOf(row.nl, row.en);
  const srcLang: Lang = raw.nl ? 'nl' : 'en';
  const srcKnown = !src?.ing || !!dict.get(src.ing);
  let line: Line;
  if (!raw.nl && !raw.en) {
    line = { raw, kind: 'line', qty: null, unit: null, ing: null, name: '', confidence: 0 };
  } else if (src && isStructured(src) && srcKnown && (src.raw[srcLang] ?? '') === raw[srcLang]) {
    line = { ...src, raw };
  } else {
    const parsed = parseLine(raw[srcLang] as string, dict, srcLang);
    const rest: Line = { raw };
    if (src) for (const [k, v] of Object.entries(src)) if (!STRUCT_KEYS.has(k)) rest[k] = v;
    line = { ...rest, ...parsed, raw };
    if (src && parsed.kind !== 'header') {
      for (const k of ['prep', 'note'] as const) {
        const s = src[k];
        const p = parsed[k];
        if (s && p && s.nl && s.nl === p.nl && s.en && !p.en) line[k] = { ...p, en: s.en };
      }
      if (!parsed.ing && src.ing && dict.get(src.ing)) {
        line.ing = src.ing;
        if (src.qual) line.qual = [...src.qual];
        line.confidence = Math.max(parsed.confidence ?? 0, 0.6);
      }
    }
  }
  if (manualIng !== undefined && line.kind !== 'header') {
    line.ing = manualIng;
    line.confidence = 1;
  }
  return line;
}

// --- override patch -------------------------------------------------------------------------------

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) o[k] = sortKeys(x);
    }
    return o;
  }
  return v;
}

function stable(v: unknown): string {
  return JSON.stringify(sortKeys(v));
}

function textKey(x: Text | null | undefined): string {
  return `${(x?.nl ?? '').trim()}\u0000${(x?.en ?? '').trim()}`;
}

/** True when the English side of name, a step or a line differs between the draft and the shipped recipe. */
function englishChanged(draft: Recipe, base: Recipe): boolean {
  const en = (x: Text | null | undefined) => (x?.en ?? '').trim();
  if (en(draft.name) !== en(base.name)) return true;
  if (draft.steps.length !== base.steps.length || draft.steps.some((s, i) => en(s.text) !== en(base.steps[i]?.text))) return true;
  return draft.lines.length !== base.lines.length || draft.lines.some((l, i) => en(l.raw) !== en(base.lines[i]?.raw));
}

/**
 * The override patch for a builtin: the previous patch with name / servingTip / lines / steps set
 * when they differ from the shipped recipe and removed when they are equal again (repo.saveOverride
 * replaces the stored patch, and an empty patch removes the override). When the English text of
 * a machine-translated classic (`text.en === 'llm'`) was changed, the patch also marks it
 * `text.en = 'human'` (with the curator's name), which turns the "Machine translation" badge off.
 */
export function buildOverridePatch(draft: Recipe, base: Recipe, prev: RecipePatch | undefined, by?: string | null): RecipePatch {
  const patch: RecipePatch = { ...(prev ?? {}) };
  const put = (k: 'name' | 'servingTip' | 'lines' | 'steps' | 'text', changed: boolean, v: unknown) => {
    if (changed) (patch as Record<string, unknown>)[k] = v;
    else delete patch[k];
  };
  put('name', textKey(draft.name) !== textKey(base.name), draft.name);
  put('servingTip', textKey(draft.servingTip) !== textKey(base.servingTip), draft.servingTip ?? null);
  const stepsChanged = draft.steps.length !== base.steps.length || draft.steps.some((s, i) => textKey(s.text) !== textKey(base.steps[i]?.text));
  put('steps', stepsChanged, draft.steps);
  const linesChanged = draft.lines.length !== base.lines.length || draft.lines.some((l, i) => stable(l) !== stable(base.lines[i]));
  put('lines', linesChanged, draft.lines);
  const reviewed = base.text?.en === 'llm' && englishChanged(draft, base);
  const text: NonNullable<Recipe['text']> = { ...(base.text ?? {}), en: 'human' };
  if (by) text.reviewedBy = by;
  put('text', reviewed, text);
  return patch;
}

/** Short local date for "Aangepast op …". */
function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang.value === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short' });
}

export function EditScreen(props: { id?: string }) {
  const [state, setState] = useState<LoadState>('loading');
  const [existing, setExisting] = useState<Recipe | null>(null);
  // Override mode (builtins): the classic as shipped + the stored patch, if any.
  const [base, setBase] = useState<Recipe | null>(null);
  const [override, setOverride] = useState<RecipeOverride | null>(null);
  const [mode, setMode] = useState<Mode>('nl');
  const [nameNl, setNameNl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [tipNl, setTipNl] = useState('');
  const [tipEn, setTipEn] = useState('');
  const [servingsText, setServingsText] = useState('4');
  const [lines, setLines] = useState<EditText[]>([]);
  const [steps, setSteps] = useState<EditText[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteLang, setPasteLang] = useState<Lang>('nl');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  // Chips: hand-linked ingredient per row key, the row whose inline editor is open, the row the picker is for.
  const [links, setLinks] = useState<Record<string, string>>({});
  const [chipRow, setChipRow] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  // "Nieuw ingrediënt": the picker opens on its form instead of the search.
  const [pickNew, setPickNew] = useState(false);
  // Language pair.
  const [trFrom, setTrFrom] = useState<Lang>('nl');
  const [trOpen, setTrOpen] = useState(false);
  const [trText, setTrText] = useState('');
  // Photo/text import (add screen).
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  // A prompt shown in a textarea when the clipboard refused (iOS without a user gesture, http dev server).
  const [promptFallback, setPromptFallback] = useState('');
  // Original Line / Step per row key (unknown keys are carried over on save).
  const lineSrc = useRef(new Map<string, Line>());
  const stepSrc = useRef(new Map<string, Step>());
  // Parsed line per row, memoised on its text, its manual link and the dictionary.
  const lineCache = useRef(new Map<string, { sig: string; dict: Dictionary; line: Line }>());

  const overrideMode = !!base;

  // Load the recipe (or start empty). Defaults for a new recipe follow the active profile's language.
  useEffect(() => {
    let cancelled = false;
    setStatus('');
    setPasteOpen(false);
    setPasteText('');
    setLinks({});
    setChipRow(null);
    setPickFor(null);
    setTrOpen(false);
    setTrText('');
    setImportOpen(false);
    setImportText('');
    setPromptFallback('');
    lineCache.current.clear();
    if (!props.id) {
      const l: Lang = activeProfile.value?.lang ?? lang.value;
      lineSrc.current.clear();
      stepSrc.current.clear();
      setExisting(null);
      setBase(null);
      setOverride(null);
      setMode(l);
      setPasteLang(l);
      setTrFrom(l);
      setNameNl('');
      setNameEn('');
      setTipNl('');
      setTipEn('');
      setServingsText('4');
      setLines([newEditText(), newEditText(), newEditText()]);
      setSteps([newEditText()]);
      setState('ready');
      return;
    }
    setState('loading');
    const id = props.id;
    const builtin = isBuiltinId(id);
    Promise.all([
      getRecipe(id),
      builtin ? getBaseRecipe(id) : Promise.resolve(undefined),
      builtin ? getOverride(id) : Promise.resolve(undefined),
      builtin ? Promise.resolve([]) : listLineOverrides(id),
    ]).then(([loaded, b, o, lineOv]) => {
      if (cancelled) return;
      if (!loaded) {
        setExisting(null);
        setBase(null);
        setOverride(null);
        setState('missing');
        return;
      }
      // An own/received recipe keeps its links in the lines; any line overrides an older app
      // version stored for it are folded in here and persisted into the lines on save
      // (repo.saveUserRecipe clears the rows). A builtin's line overrides stay in their table.
      const r = lineOv.length ? { ...loaded, lines: applyLineOverrides(loaded.lines, lineOv) } : loaded;
      setExisting(r);
      setBase(builtin || r.origin.kind === 'builtin' ? (b ?? r) : null);
      setOverride(o ?? null);
      const m = modeOf(r);
      setMode(m);
      setPasteLang(m === 'en' ? 'en' : 'nl');
      setTrFrom(hasLang(r.name, 'nl') ? 'nl' : 'en');
      setNameNl(r.name.nl ?? '');
      setNameEn(r.name.en ?? '');
      setTipNl(r.servingTip?.nl ?? '');
      setTipEn(r.servingTip?.en ?? '');
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

  /** The structured line of a row (cached per row on text + link + dictionary). */
  function lineFor(row: EditText): Line {
    const dict = dictionary.value;
    const manual = links[row.key];
    const sig = `${row.nl}\u0000${row.en}\u0000${manual ?? '\u0001'}`;
    const hit = lineCache.current.get(row.key);
    if (hit && hit.sig === sig && hit.dict === dict) return hit.line;
    const line = effectiveLine(row, lineSrc.current.get(row.key), manual, dict);
    lineCache.current.set(row.key, { sig, dict, line });
    return line;
  }

  /**
   * The schema-2 recipe from the form; normalizeRecipe derives header lines and step timers.
   * Invariants 2 + 3: a row with text only in the hidden language is kept, not deleted (translating
   * a received EN recipe in NL mode must never drop the EN lines). Lines carry their parsed
   * structure (and a hand-linked `ing`); unknown keys of an original line/step ride along.
   */
  function build(): Recipe | null {
    const now = nowIso();
    const src: Recipe = existing ?? {
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
    const tip = textOf(tipNl, tipEn);
    const draft = {
      ...src,
      name: textOf(nameNl, nameEn),
      servings,
      servingTip: tip.nl || tip.en ? tip : null,
      lines: lines.filter(rowHasText).map((x) => lineFor(x)),
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
      if (base) {
        const by = activeProfile.value?.name ?? null;
        const patch = buildOverridePatch(recipe, base, override?.patch, by);
        await saveOverride({ baseId: base.id, patch, by });
        navigate('/recipe/' + base.id, { replace: true });
        return;
      }
      const firstOwn = !existing && (await userRecipes()).every((r) => r.origin.kind !== 'user');
      await saveUserRecipe(recipe);
      if (firstOwn) celebrate('firstRecipe');
      navigate('/recipe/' + recipe.id, { replace: true });
    } catch (e) {
      setStatus(`${t('edit.saveError')}: ${String(e)}`);
      setBusy(false);
    }
  }

  async function restoreOriginal() {
    if (!base || busy) return;
    if (!confirm(t('edit.confirmRestore'))) return;
    setBusy(true);
    try {
      await clearOverride(base.id);
      navigate('/recipe/' + base.id, { replace: true });
    } catch (e) {
      setStatus(`${t('common.error')}: ${String(e)}`);
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || base || busy) return;
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
      // The applied builtin carries an `override` marker (src/domain/overrides.ts); a copy does not need it.
      const { override: _o, ...clean } = existing;
      const copy = await duplicateAsOwn(clean as Recipe, profile);
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

  // --- chips -----------------------------------------------------------------------------------

  /**
   * Inline chip editor → raw text (raw stays the truth). Rewritten are the language the chips
   * were edited in and the language the parser reads (Dutch when present, else English) — the
   * edit must land in the parsed text; a hand-written line in the other language is left as
   * typed. `rawFromLine` writes the quantity and unit as stored, so nothing is re-united.
   */
  function applyChipEdit(rowKey: string, edit: LineEdit) {
    const row = lines.find((r) => r.key === rowKey);
    if (!row) return;
    const dict = dictionary.value;
    const l = lang.value;
    const srcLang: Lang = row.nl.trim() ? 'nl' : 'en';
    const rewrite = (x: Lang) => (x === l || x === srcLang) && row[x].trim() !== '';
    const edited: Line = { ...lineFor(row), qty: edit.qty, unit: edit.unit };
    edited.prep = edit.prep ? (l === 'nl' ? dict.prepFor(edit.prep) : dict.prepFromEn(edit.prep)) : null;
    if (edit.optional) {
      edited.optional = true;
    } else {
      delete edited.optional;
      delete edited.role;
      if (edited.note && edited.note.nl === 'naar smaak') edited.note = null;
    }
    setLines(
      lines.map((r) =>
        r.key !== rowKey
          ? r
          : {
              ...r,
              nl: rewrite('nl') ? rawFromLine(edited, dict, 'nl') : r.nl,
              en: rewrite('en') ? rawFromLine(edited, dict, 'en') : r.en,
            },
      ),
    );
    setChipRow(null);
  }

  function openPicker(rowKey: string, startNew = false) {
    setChipRow(null);
    setPickNew(startNew);
    setPickFor(rowKey);
  }

  /** True when the row's line is linked to an ingredient this dictionary knows. */
  function rowResolved(row: EditText): boolean {
    const ing = lineFor(row).ing;
    return !!ing && !!dictionary.value.get(ing);
  }

  const pickRow = pickFor ? lines.find((r) => r.key === pickFor) : undefined;
  const pickQuery = pickRow ? lineFor(pickRow).name || pickRow[lang.value].trim() || pickRow.nl.trim() || pickRow.en.trim() : '';

  // --- language pair ---------------------------------------------------------------------------

  /** Puts `text` on the clipboard inside the tap; shows it in a textarea when the clipboard refuses. */
  function copyToClipboard(text: string) {
    setPromptFallback('');
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip || typeof clip.writeText !== 'function') {
      setStatus(t('edit.copyFailed'));
      setPromptFallback(text);
      return;
    }
    clip.writeText(text).then(
      () => setStatus(t('edit.promptCopied')),
      () => {
        setStatus(t('edit.copyFailed'));
        setPromptFallback(text);
      },
    );
  }

  function copyTranslationPrompt() {
    const to: Lang = trFrom === 'nl' ? 'en' : 'nl';
    const prompt = buildTranslationPrompt(
      {
        name: textOf(nameNl, nameEn),
        lines: lines.filter(rowHasText).map((r) => ({ raw: textOf(r.nl, r.en) })),
        steps: steps.filter(rowHasText).map((r) => ({ text: textOf(r.nl, r.en) })),
      },
      trFrom,
      to,
    );
    copyToClipboard(prompt);
  }

  /** "Plak vertaling": fills ONLY the target language, refusing when the counts do not match. */
  function applyTranslation() {
    const answer = parseTranslationAnswer(trText);
    const to: Lang = trFrom === 'nl' ? 'en' : 'nl';
    const keptLines = lines.filter(rowHasText);
    const keptSteps = steps.filter(rowHasText);
    if (!answer.name && answer.lines.length === 0 && answer.steps.length === 0) {
      setStatus(t('edit.translateNone'));
      return;
    }
    if (answer.steps.length > 0 && answer.steps.length !== keptSteps.length) {
      setStatus(t('edit.translateStepsMismatch', { got: answer.steps.length, expected: keptSteps.length }));
      return;
    }
    if (answer.lines.length > 0 && answer.lines.length !== keptLines.length) {
      setStatus(t('edit.translateLinesMismatch', { got: answer.lines.length, expected: keptLines.length }));
      return;
    }
    if (answer.name) (to === 'nl' ? setNameNl : setNameEn)(answer.name);
    if (answer.lines.length) {
      let i = 0;
      setLines(
        lines.map((r) => {
          if (!rowHasText(r)) return r;
          const v = answer.lines[i++];
          return v ? { ...r, [to]: v } : r;
        }),
      );
    }
    if (answer.steps.length) {
      let i = 0;
      setSteps(
        steps.map((r) => {
          if (!rowHasText(r)) return r;
          const v = answer.steps[i++];
          return v ? { ...r, [to]: v } : r;
        }),
      );
    }
    setTrText('');
    setTrOpen(false);
    setStatus(t('edit.translateDone', { lines: answer.lines.length, steps: answer.steps.length }));
  }

  // --- photo / text import ---------------------------------------------------------------------

  const importLang: Lang = mode === 'both' ? lang.value : mode;

  function applyImport() {
    const r = parsePlainRecipe(importText);
    if (!r) {
      setStatus(t('edit.importNone'));
      return;
    }
    const mk = (s: string) => (importLang === 'nl' ? newEditText(s, '') : newEditText('', s));
    if (r.name) (importLang === 'nl' ? setNameNl : setNameEn)(r.name);
    if (r.servings) setServings(r.servings);
    if (r.lines.length) setLines([...lines.filter(rowHasText), ...r.lines.map(mk)]);
    if (r.steps.length) setSteps([...steps.filter(rowHasText), ...r.steps.map(mk)]);
    setImportText('');
    setImportOpen(false);
    setPromptFallback('');
    setStatus(t('edit.importDone', { lines: r.lines.length, steps: r.steps.length }));
  }

  // --- render ----------------------------------------------------------------------------------

  const title = overrideMode ? t('edit.titleOverride') : existing ? t('edit.titleEdit') : t('edit.titleNew');
  const saveButton = (
    <button type="button" class="btn btn-primary" disabled={!valid || busy} onClick={() => void save()}>
      {t('edit.save')}
    </button>
  );

  /** Enter never submits; it moves on to the next field. */
  function nextFieldOnEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const form = (e.currentTarget as HTMLElement).closest('form');
    const fields = form ? [...form.querySelectorAll<HTMLElement>('input.input, textarea.input')] : [];
    const next = fields[fields.indexOf(e.currentTarget as HTMLElement) + 1];
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  if (state !== 'ready') {
    return (
      <>
        <Header title={title} back backLabel={t('common.back')} />
        <div class="screen">
          {state === 'loading' && <div class="empty">{t('common.loading')}</div>}
          {state === 'missing' && <div class="empty">{t('edit.notFound')}</div>}
        </div>
      </>
    );
  }

  const promptBox = promptFallback ? (
    <label class="field">
      <span>{t('edit.promptText')}</span>
      <textarea class="input edit-prompt" readOnly rows={6} value={promptFallback} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />
    </label>
  ) : null;

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
        {overrideMode && (
          <div class="card edit-override">
            <p class="muted small">{t('edit.overrideHint')}</p>
            {override && (
              <div class="edit-override-row">
                <span class="badge badge-muted">{t('edit.overrideActive', { date: shortDate(override.updatedAt) })}</span>
                <button type="button" class="btn btn-small" disabled={busy} onClick={() => void restoreOriginal()}>
                  {t('edit.restoreOriginal')}
                </button>
              </div>
            )}
          </div>
        )}

        {!props.id && (
          <div class="edit-import">
            {!importOpen ? (
              <button type="button" class="btn btn-secondary btn-block" onClick={() => setImportOpen(true)}>
                {t('edit.import')}
              </button>
            ) : (
              <div class="card edit-tools">
                <h2>{t('edit.import')}</h2>
                <p class="muted small">{t('edit.importHint')}</p>
                <div class="actions">
                  <button type="button" class="btn btn-secondary" onClick={() => copyToClipboard(buildImportPrompt(importLang))}>
                    {t('edit.copyImportPrompt')}
                  </button>
                </div>
                {promptBox}
                <label class="field">
                  <span>{t('edit.importPaste')}</span>
                  <textarea class="input" rows={8} value={importText} autocomplete="off" onInput={(e) => setImportText((e.currentTarget as HTMLTextAreaElement).value)} />
                </label>
                <div class="actions">
                  <button type="button" class="btn btn-primary" disabled={!importText.trim()} onClick={applyImport}>
                    {t('edit.importApply')}
                  </button>
                  <button
                    type="button"
                    class="btn"
                    onClick={() => {
                      setImportOpen(false);
                      setImportText('');
                      setPromptFallback('');
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                onKeyDown={nextFieldOnEnter}
                onInput={(e) => (l === 'nl' ? setNameNl : setNameEn)((e.currentTarget as HTMLInputElement).value)}
              />
            </div>
          ))}
        </div>

        <div class="field">
          <span>{t('edit.servings')}</span>
          <div class="stepper">
            <button type="button" class="btn btn-icon" aria-label={t('edit.fewer')} disabled={overrideMode || servings <= 1} onClick={() => setServings(servings - 1)}>
              −
            </button>
            <input
              class="input stepper-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={servingsText}
              enterKeyHint="done"
              disabled={overrideMode}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              onInput={(e) => setServingsText((e.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))}
              onBlur={() => setServingsText(String(servings))}
            />
            <button type="button" class="btn btn-icon" aria-label={t('edit.more')} disabled={overrideMode || servings >= 99} onClick={() => setServings(servings + 1)}>
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
            renderExtra={(it) =>
              rowHasText(it) ? (
                <LineChips
                  line={lineFor(it)}
                  lang={lang.value}
                  editing={chipRow === it.key}
                  onOpenEdit={() => setChipRow(it.key)}
                  onCloseEdit={() => setChipRow(null)}
                  onLink={() => openPicker(it.key)}
                  onNew={() => openPicker(it.key, true)}
                  onApply={(edit) => applyChipEdit(it.key, edit)}
                />
              ) : null
            }
          />
          <p class="muted small edit-hint">{t('edit.lineHint')}</p>
          {/* A resolved line renders its English from the dictionary: the typed EN text of such a line is not what the app shows. */}
          {langs.includes('en') && lines.some((row) => row.nl.trim() !== '' && row.en.trim() !== '' && rowResolved(row)) && (
            <p class="muted small edit-hint">{t('edit.enFromDictionaryHint')}</p>
          )}
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

        <div class="field">
          <span>{t('edit.servingTip')}</span>
          {langs.map((l) => (
            <div class="edit-name" key={l}>
              {langs.length > 1 && <span class="le-tag">{l.toUpperCase()}</span>}
              <input
                class="input"
                type="text"
                value={l === 'nl' ? tipNl : tipEn}
                placeholder={tIn(l, 'edit.servingTipPlaceholder')}
                autocomplete="off"
                enterKeyHint="done"
                onKeyDown={nextFieldOnEnter}
                onInput={(e) => (l === 'nl' ? setTipNl : setTipEn)((e.currentTarget as HTMLInputElement).value)}
              />
            </div>
          ))}
        </div>

        {mode === 'both' && (
          <div class="card edit-tools">
            <h2>{t('edit.translate')}</h2>
            <p class="muted small">{t('edit.translateHint')}</p>
            <div class="edit-paste-lang">
              <span class="muted small">{t('edit.translateFrom')}</span>
              <Segmented
                name="tr-from"
                options={[
                  { value: 'nl' as Lang, label: 'NL → EN' },
                  { value: 'en' as Lang, label: 'EN → NL' },
                ]}
                selected={[trFrom]}
                onChange={(next) => next[0] && setTrFrom(next[0])}
              />
            </div>
            <div class="actions">
              <button type="button" class="btn btn-secondary" onClick={copyTranslationPrompt}>
                {t('edit.copyForTranslation')}
              </button>
              <button type="button" class="btn" onClick={() => setTrOpen(!trOpen)}>
                {t('edit.pasteTranslation')}
              </button>
            </div>
            {!importOpen && promptBox}
            {trOpen && (
              <>
                <textarea class="input" rows={8} value={trText} autocomplete="off" onInput={(e) => setTrText((e.currentTarget as HTMLTextAreaElement).value)} />
                <div class="actions">
                  <button type="button" class="btn btn-primary" disabled={!trText.trim()} onClick={applyTranslation}>
                    {t('edit.applyTranslation')}
                  </button>
                  <button
                    type="button"
                    class="btn"
                    onClick={() => {
                      setTrOpen(false);
                      setTrText('');
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!valid && <p class="muted small">{t('edit.invalidHint')}</p>}
        <div class="actions">
          <button type="submit" class="btn btn-primary btn-block" disabled={!valid || busy}>
            {t('edit.save')}
          </button>
        </div>
        {overrideMode && (
          <div class="actions">
            {override && (
              <button type="button" class="btn" disabled={busy} onClick={() => void restoreOriginal()}>
                {t('edit.restoreOriginal')}
              </button>
            )}
            <button type="button" class="btn" disabled={busy || !activeProfile.value} onClick={() => void makeCopy()}>
              {t('edit.makeCopy')}
            </button>
          </div>
        )}
        {existing && !overrideMode && (
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

      <IngredientPicker
        open={pickFor !== null}
        initialQuery={pickQuery}
        startNew={pickNew}
        onPick={(id) => {
          if (pickFor) setLinks({ ...links, [pickFor]: id });
          setPickFor(null);
        }}
        onClose={() => setPickFor(null)}
      />
    </>
  );
}
