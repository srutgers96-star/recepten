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
//
// Block A-bis (docs/phase-5-spec.md): the translation prompt only carries what the app cannot do
// itself (name, steps, free text of recognised lines, unrecognised lines) and "Plak vertaling"
// writes only those parts into the target language; in "both" mode a recognised line shows its
// dictionary rendering as the other column's grey placeholder (nothing stored unless typed);
// "Kies bestand" reads a recipe/bundle/backup file and hands it to the Inbox for the merge UI.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { Header } from '@/components/Header';
import { IngredientPicker } from '@/components/IngredientPicker';
import { LineChips, rawFromLine, type LineEdit } from '@/components/LineChips';
import { LineEditor, editTextHasContent, newEditText, type EditText } from '@/components/LineEditor';
import { MetaRows, applySuggestion, metaEqual, type MetaValue } from '@/components/MetaRows';
import { Segmented } from '@/components/Segmented';
import { celebrate } from '@/celebrate';
import { clearOverride, deleteUserRecipe, duplicateAsOwn, getBaseRecipe, getOverride, getRecipe, isBuiltinId, listLineOverrides, saveOverride, saveUserRecipe, userRecipes } from '@/db/repo';
import { dictionary, lineText, type Dictionary } from '@/dictionary';
import { suggestMeta } from '@/domain/diet';
import { hasLang, newUserId, nowIso, type Lang, type Line, type Recipe, type Step, type Text } from '@/domain/model';
import { applyLineOverrides, type RecipeOverride, type RecipePatch } from '@/domain/overrides';
import { parseLineAuto } from '@/domain/parser';
import { buildImportPrompt, parseBilingualPlain, type PlainRecipe } from '@/domain/photo-import';
import { normalizeRecipe } from '@/domain/recipe-io';
import { splitSteps } from '@/domain/steps';
import { answeredSteps, applyTranslationAnswer, buildTranslationPrompt, parseTranslationAnswer, planTranslation, type TranslatableLine } from '@/domain/translate-prompt';
import { lang, t, tIn } from '@/i18n';
import { activeProfile } from '@/profile';
import { fileHasRecipes } from '@/file-import';
import { navigate, pendingImport, pendingImportText, route } from '@/router';

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

/** The line without a note/prep that has no text in `l` (never copied into that language's raw text, A-bis.1). */
function withoutForeign(line: Line, l: Lang): Line {
  const out: Line = { ...line };
  if (out.note && !hasLang(out.note, l)) out.note = null;
  if (out.prep && !hasLang(out.prep, l)) out.prep = null;
  return out;
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
    const parsed = parseLineAuto(raw[srcLang] as string, dict, srcLang);
    const rest: Line = { raw };
    if (src) for (const [k, v] of Object.entries(src)) if (!STRUCT_KEYS.has(k)) rest[k] = v;
    line = { ...rest, ...parsed, raw };
    if (src && parsed.kind !== 'header') {
      // A pasted translation of the note/prep survives a re-parse as long as the source-language
      // text is the same, whichever language the row is written in.
      const other: Lang = srcLang === 'nl' ? 'en' : 'nl';
      for (const k of ['prep', 'note'] as const) {
        const s = src[k];
        const p = parsed[k];
        if (s && p && s[srcLang] && s[srcLang] === p[srcLang] && s[other] && !p[other]) line[k] = { ...p, [other]: s[other] };
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

/** True when both carry the same tags (order ignored). */
function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag) => b.includes(tag));
}

/**
 * The override patch for a builtin: the previous patch with name / servingTip / lines / steps /
 * category / tags set when they differ from the shipped recipe and removed when they are equal
 * again (repo.saveOverride replaces the stored patch, and an empty patch removes the override).
 * When the English text of a machine-translated classic (`text.en === 'llm'`) was changed, the
 * patch also marks it `text.en = 'human'` (with the curator's name), which turns the "Machine
 * translation" badge off. `metaManual` (the person chose category/tags by hand, phase-5 A.4)
 * rides along as an unknown key that `applyOverride` copies onto the recipe.
 */
export function buildOverridePatch(draft: Recipe, base: Recipe, prev: RecipePatch | undefined, by?: string | null): RecipePatch {
  const patch: RecipePatch = { ...(prev ?? {}) };
  const put = (k: 'name' | 'servingTip' | 'lines' | 'steps' | 'text' | 'category' | 'tags' | 'metaManual', changed: boolean, v: unknown) => {
    if (changed) (patch as Record<string, unknown>)[k] = v;
    else delete patch[k];
  };
  put('name', textKey(draft.name) !== textKey(base.name), draft.name);
  put('servingTip', textKey(draft.servingTip) !== textKey(base.servingTip), draft.servingTip ?? null);
  put('category', (draft.category ?? null) !== (base.category ?? null), draft.category ?? null);
  put('tags', !sameTags(draft.tags, base.tags), draft.tags);
  put('metaManual', draft.metaManual === true, true);
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
  // Category + diet/labels (phase-5 A.4). `metaManual`: the person chose them (or an import
  // supplied them); until then a NEW recipe follows the live suggestion. Stored on the recipe.
  const [meta, setMeta] = useState<MetaValue>({ category: null, tags: [] });
  const [metaManual, setMetaManual] = useState(false);
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
  // "Kies bestand": the text of a chosen file that holds recipes (offered to the Inbox).
  const [fileRecipes, setFileRecipes] = useState<string | null>(null);
  // The description with a pasted translation added (the editor has no description field).
  const [descTr, setDescTr] = useState<Text | null>(null);
  // Which section's collapsible prompt was opened because the clipboard refused (iOS without a
  // user gesture, http dev server); the prompt itself is always there to select by hand.
  const [promptOpen, setPromptOpen] = useState<'tr' | 'import' | ''>('');
  // '/edit/:id?translate=1' (the "Engels ontbreekt — toevoegen" line on the recipe page): scroll
  // the translation section into view once the recipe is loaded.
  const wantTranslate = useRef(route.value.query.get('translate') === '1');
  const trRef = useRef<HTMLDivElement>(null);
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
    setFileRecipes(null);
    setDescTr(null);
    setPromptOpen('');
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
      setMeta({ category: null, tags: [] });
      setMetaManual(false);
      // Plain text from "Kies bestand" in the Recipes "+" menu (A-bis.9) lands in the import box.
      const fromFile = pendingImportText.value;
      if (fromFile) {
        pendingImportText.value = null;
        setImportOpen(true);
        setImportText(fromFile);
        setStatus(t('edit.fileText'));
      }
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
      setMeta({ category: r.category ?? null, tags: [...r.tags] });
      setMetaManual(r.metaManual === true);
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [props.id]);

  // Once loaded with ?translate=1: bring the translation section into view (once per mount).
  useEffect(() => {
    if (state !== 'ready' || !wantTranslate.current) return;
    wantTranslate.current = false;
    const el = trRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [state]);

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

  // --- category + diet/labels -------------------------------------------------------------------

  /** The live suggestion (src/domain/diet.ts) from the name, the parsed lines and the steps. */
  const dict = dictionary.value;
  const suggestion = useMemo(
    () =>
      state === 'ready'
        ? suggestMeta(
            {
              name: textOf(nameNl, nameEn),
              lines: lines.filter(rowHasText).map((x) => lineFor(x)),
              steps: steps.filter(rowHasText).map((x) => ({ text: textOf(x.nl, x.en) })),
              time: existing?.time ?? null,
            },
            dict,
          )
        : null,
    [state, nameNl, nameEn, lines, steps, links, dict, existing],
  );

  // A new recipe follows the suggestion until the person touches the rows (or an import fills
  // them). Only the sure part is applied; an unsure diet tag stays a "waarschijnlijk" chip.
  useEffect(() => {
    if (state !== 'ready' || props.id || metaManual || !suggestion) return;
    setMeta((m) => {
      const next = { ...applySuggestion(m, suggestion), category: suggestion.category ?? null };
      return metaEqual(next, m) ? m : next;
    });
  }, [state, props.id, metaManual, suggestion]);

  function changeMeta(next: MetaValue) {
    setMeta(next);
    setMetaManual(true);
  }

  /**
   * Category / labels from an import ("Categorie:" / "Labels:" lines): the first block that has
   * them wins (nl before en). Counts as a manual choice; the suggestion hint still offers the
   * ingredient facts. A `Labels:` line whose words were all unknown parses to `[]`
   * (photo-import.ts `tagIdsFromText`) and counts as "no labels line": it must not wipe the live
   * diet suggestion of a new recipe. Returns true when anything was actually taken over.
   */
  function importMeta(blocks: (PlainRecipe | undefined)[]): boolean {
    const category = blocks.find((b) => b?.category !== undefined)?.category;
    const tags = blocks.find((b) => b?.tags !== undefined && b.tags.length > 0)?.tags;
    if (category === undefined && tags === undefined) return false;
    setMeta((m) => ({ category: category ?? m.category, tags: tags ? [...new Set(tags)] : m.tags }));
    setMetaManual(true);
    return true;
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
    const draft: Recipe = {
      ...src,
      name: textOf(nameNl, nameEn),
      servings,
      servingTip: tip.nl || tip.en ? tip : null,
      category: meta.category,
      tags: [...meta.tags],
      lines: lines.filter(rowHasText).map((x) => lineFor(x)),
      steps: steps.filter(rowHasText).map((x) => {
        const { text: _text, timers: _timers, ...rest } = stepSrc.current.get(x.key) ?? ({ text: {} } as Step);
        return { ...rest, text: textOf(x.nl, x.en) };
      }),
    };
    // Phase-5 A.4: `metaManual: true` = category/tags were chosen by hand (the check screen and
    // the auto-suggestion leave such a recipe alone); absent otherwise.
    if (metaManual) draft.metaManual = true;
    else delete draft.metaManual;
    if (descTr) draft.description = descTr;
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
      // Phase 5 block C: an own recipe can finish 'Eigen inbreng'/'Receptenschrijver' the moment
      // it is saved; never make the navigation wait for it (the shell renders the toast).
      const pid = activeProfile.value?.id;
      if (pid) void checkNewBadges(pid).catch((e: unknown) => console.error('checkNewBadges', e));
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
   *
   * A-bis.1: free text is never translated here. A prep typed in the chips is looked up in the
   * language of the chips (`noteFor`: both languages when known, else that language only); an
   * untouched prep keeps its stored text. The parsed language's raw text carries everything, the
   * other language's raw text only what exists in it — a foreign note is not copied over. The
   * edited line is stored as the row's source so `effectiveLine` keeps the exact structure.
   */
  function applyChipEdit(rowKey: string, edit: LineEdit) {
    const row = lines.find((r) => r.key === rowKey);
    if (!row) return;
    const dict = dictionary.value;
    const l = lang.value;
    const srcLang: Lang = row.nl.trim() ? 'nl' : 'en';
    const rewrite = (x: Lang) => (x === l || x === srcLang) && row[x].trim() !== '';
    const edited: Line = { ...lineFor(row), qty: edit.qty, unit: edit.unit };
    if (edit.prepChanged) edited.prep = edit.prep ? dict.noteFor(edit.prep, l) : null;
    if (edit.optional) {
      edited.optional = true;
    } else {
      delete edited.optional;
      delete edited.role;
      if (edited.note && edited.note.nl === 'naar smaak') edited.note = null;
    }
    // Each language's raw text carries only the free text that exists in that language (A-bis.1):
    // a prep typed in English on a Dutch row lives in the structured line only (`lineSrc`, which
    // `effectiveLine` reuses while the Dutch text is unchanged), never as English inside the Dutch raw.
    const rawFor = (x: Lang): string => (rewrite(x) ? rawFromLine(withoutForeign(edited, x), dict, x) : row[x]);
    const nl = rawFor('nl');
    const en = rawFor('en');
    lineSrc.current.set(rowKey, { ...edited, raw: textOf(nl, en) });
    lineCache.current.delete(rowKey);
    setLines(lines.map((r) => (r.key !== rowKey ? r : { ...r, nl, en })));
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

  /**
   * A-bis.3: in "both" mode the empty column of a recognised line shows the dictionary rendering
   * in that language as a grey placeholder; typing replaces it, leaving it empty stores nothing.
   */
  function linePlaceholder(it: EditText, l: Lang): string {
    if (langs.length > 1 && it[l].trim() === '' && rowHasText(it)) {
      const line = lineFor(it);
      if (line.kind !== 'header' && !!line.ing && !!dictionary.value.get(line.ing)) return lineText(line, l);
    }
    return tIn(l, 'edit.linePlaceholder');
  }
  const showPlaceholderHint = langs.length > 1 && lines.some((it) => rowHasText(it) && langs.some((l) => it[l].trim() === '') && rowResolved(it));

  const pickRow = pickFor ? lines.find((r) => r.key === pickFor) : undefined;
  const pickQuery = pickRow ? lineFor(pickRow).name || pickRow[lang.value].trim() || pickRow.nl.trim() || pickRow.en.trim() : '';

  // --- language pair ---------------------------------------------------------------------------

  /** Puts `text` on the clipboard inside the tap; opens that section's prompt when the clipboard refuses. */
  function copyToClipboard(text: string, which: 'tr' | 'import') {
    setPromptOpen('');
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip || typeof clip.writeText !== 'function') {
      setStatus(t('edit.copyFailed'));
      setPromptOpen(which);
      return;
    }
    clip.writeText(text).then(
      () => setStatus(t('edit.promptCopied')),
      () => {
        setStatus(t('edit.copyFailed'));
        setPromptOpen(which);
      },
    );
  }

  // Direction of the translation: fixed by the column mode ("Engels toevoegen" in NL mode adds
  // English, "Nederlands toevoegen" in EN mode adds Dutch); the picker only exists in 'both'.
  const trDir: Lang = mode === 'both' ? trFrom : mode;
  const trTo: Lang = trDir === 'nl' ? 'en' : 'nl';
  // A-bis.2: the prompt carries the parsed lines, so recognised ones only send their free text.
  const keptRows = lines.filter(rowHasText);
  const keptLines = keptRows.map((r) => lineFor(r));
  const isResolved = (l: TranslatableLine) => !!l.ing && !!dictionary.value.get(l.ing);
  const trRecipe = {
    name: textOf(nameNl, nameEn),
    description: descTr ?? existing?.description ?? null,
    servingTip: textOf(tipNl, tipEn),
    lines: keptLines,
    steps: steps.filter(rowHasText).map((r) => ({ text: textOf(r.nl, r.en) })),
  };
  const trPlan = planTranslation(trRecipe, trDir, trTo, { isResolved });
  const translationPrompt = buildTranslationPrompt(trRecipe, trDir, trTo, { isResolved });

  function copyTranslationPrompt() {
    copyToClipboard(translationPrompt, 'tr');
  }

  /**
   * "Plak vertaling" (A-bis.2): the answer's N/P/I items go into the target language of the parsed
   * lines (`applyTranslationAnswer`: notes and preps of recognised lines, the raw text of the
   * others; existing target text is never overwritten). A translated line becomes the row's
   * source so its structure survives; only unrecognised lines and headers get text in the other
   * column — recognised ones render from the dictionary. Name, serving tip, description and steps
   * are positional as before. Refuses when the step count does not match, and switches to "both"
   * so the result is visible next to the original.
   */
  function applyTranslation() {
    const answer = parseTranslationAnswer(trText);
    const to = trTo;
    const hasLineItems = answer.lines.length > 0 || Object.keys(answer.notes).length > 0 || Object.keys(answer.preps).length > 0;
    if (!answer.name && !hasLineItems && answer.steps.length === 0 && !answer.description && !answer.servingTip) {
      setStatus(t('edit.translateNone'));
      return;
    }
    // S-items that match neither the asked step numbers nor their count cannot be placed.
    if (answer.steps.length > 0 && answer.steps.length !== trPlan.steps.length && !trPlan.steps.some((n) => answer.stepByNumber[n] !== undefined)) {
      setStatus(t('edit.translateStepsMismatch', { got: answer.steps.length, expected: trPlan.steps.length }));
      return;
    }
    const stepsByNumber = answeredSteps(answer, trPlan.steps);
    // I-items that match neither the asked row numbers nor their count cannot be placed.
    if (answer.lines.length > 0 && trPlan.lines.length > 0 && answer.lines.length !== trPlan.lines.length && !trPlan.lines.some((n) => answer.lineByNumber[n] !== undefined)) {
      setStatus(t('edit.translateNoLines', { got: answer.lines.length, expected: trPlan.lines.length, rows: trPlan.lines.join(', ') }));
      return;
    }
    const applied = applyTranslationAnswer(keptLines, answer, to, { isResolved, lineNumbers: trPlan.lines });
    if (applied.changed) {
      const byKey = new Map<string, Line>();
      keptRows.forEach((row, i) => {
        const next = applied.lines[i];
        if (next && next !== keptLines[i]) byKey.set(row.key, next);
      });
      for (const [key, next] of byKey) {
        lineSrc.current.set(key, next);
        lineCache.current.delete(key);
      }
      setLines(
        lines.map((r) => {
          const next = byKey.get(r.key);
          if (!next) return r;
          const rawTo = next.raw[to];
          return typeof rawTo === 'string' && rawTo.trim() && r[to].trim() === '' ? { ...r, [to]: rawTo } : r;
        }),
      );
    }
    // Existing target text is never overwritten (A-bis.2), like the lines.
    const nameEmpty = (to === 'nl' ? nameNl : nameEn).trim() === '';
    const tipEmpty = (to === 'nl' ? tipNl : tipEn).trim() === '';
    const nameSet = !!answer.name && nameEmpty;
    if (nameSet) (to === 'nl' ? setNameNl : setNameEn)(answer.name as string);
    if (answer.servingTip && tipEmpty) (to === 'nl' ? setTipNl : setTipEn)(answer.servingTip);
    if (answer.description) setDescTr({ ...(descTr ?? existing?.description ?? {}), [to]: answer.description });
    let stepsSet = 0;
    if (answer.steps.length) {
      let i = 0;
      setSteps(
        steps.map((r) => {
          if (!rowHasText(r)) return r;
          const v = stepsByNumber[++i];
          if (!v || r[to].trim() !== '') return r;
          stepsSet++;
          return { ...r, [to]: v };
        }),
      );
    }
    setTrText('');
    setTrOpen(false);
    setMode('both');
    setStatus(t('edit.translateApplied', { lines: applied.changed, steps: stepsSet, name: nameSet ? t('edit.translateName') : '' }));
  }

  // --- photo / text import ---------------------------------------------------------------------

  /** Language the prompt's instructions are written in (the recipe itself comes back in both). */
  const importLang: Lang = mode === 'both' ? lang.value : mode;
  const importPrompt = buildImportPrompt(importLang);

  /**
   * "Vul in": both blocks fill both columns (mode → both); a single block fills its language;
   * on a count mismatch only the first block is used and the message says so.
   */
  function applyImport() {
    const r = parseBilingualPlain(importText);
    const first: Lang = r.first ?? 'nl';
    if (!r.nl && !r.en) {
      setStatus(t('edit.importNone'));
      return;
    }
    const finish = () => {
      setImportText('');
      setImportOpen(false);
      setPromptOpen('');
    };
    if (r.nl && r.en && !r.mismatch) {
      const nl = r.nl;
      const en = r.en;
      if (nl.name) setNameNl(nl.name);
      if (en.name) setNameEn(en.name);
      const srv = nl.servings ?? en.servings;
      if (srv) setServings(srv);
      if (nl.lines.length) setLines([...lines.filter(rowHasText), ...nl.lines.map((s, i) => newEditText(s, en.lines[i] ?? ''))]);
      if (nl.steps.length) setSteps([...steps.filter(rowHasText), ...nl.steps.map((s, i) => newEditText(s, en.steps[i] ?? ''))]);
      const metaTaken = importMeta([nl, en]);
      setMode('both');
      finish();
      setStatus(t('edit.importDoneBoth', { lines: nl.lines.length, steps: nl.steps.length }) + (metaTaken ? ' · ' + t('edit.importMeta') : ''));
      return;
    }
    const only: PlainRecipe = (r[first] ?? r.nl ?? r.en) as PlainRecipe;
    const mk = (s: string) => (first === 'nl' ? newEditText(s, '') : newEditText('', s));
    if (only.name) (first === 'nl' ? setNameNl : setNameEn)(only.name);
    if (only.servings) setServings(only.servings);
    if (only.lines.length) setLines([...lines.filter(rowHasText), ...only.lines.map(mk)]);
    if (only.steps.length) setSteps([...steps.filter(rowHasText), ...only.steps.map(mk)]);
    // On a mismatch the other block may still carry the Categorie/Labels lines (nl first).
    const metaTaken = importMeta(first === 'nl' ? [r.nl, r.en] : [r.en, r.nl]);
    const nextMode: Mode = mode === 'both' ? 'both' : first;
    if (nextMode !== mode) setMode(nextMode);
    finish();
    if (r.mismatch) {
      const detail = [
        r.mismatch.lines ? t('edit.importMismatchLines', { nl: r.mismatch.lines[0], en: r.mismatch.lines[1] }) : '',
        r.mismatch.steps ? t('edit.importMismatchSteps', { nl: r.mismatch.steps[0], en: r.mismatch.steps[1] }) : '',
      ]
        .filter(Boolean)
        .join(', ');
      // The section to point at carries the title it will have after the mode switch below.
      const section = nextMode === 'both' ? t('edit.translate') : first === 'nl' ? t('edit.addEnglish') : t('edit.addDutch');
      setStatus(t('edit.importMismatch', { detail, lang: first.toUpperCase(), section }));
    } else {
      setStatus(t('edit.importDone', { lines: only.lines.length, steps: only.steps.length }) + (metaTaken ? ' · ' + t('edit.importMeta') : ''));
    }
  }

  /**
   * "Kies bestand" (A-bis.9): a file with recipes (share tokens, a recipe/bundle/backup JSON) is
   * offered to the Inbox — the merge UI lives there; plain text goes into the import box.
   */
  function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    file.text().then(
      (s) => {
        if (!s.trim()) {
          setStatus(t('edit.fileEmpty'));
          return;
        }
        if (fileHasRecipes(s)) {
          setFileRecipes(s);
          setStatus('');
          return;
        }
        setFileRecipes(null);
        setImportOpen(true);
        setImportText(s);
        setStatus(t('edit.fileText'));
      },
      () => setStatus(t('edit.fileFailed')),
    );
  }

  function openFileInInbox() {
    if (!fileRecipes) return;
    pendingImport.value = fileRecipes;
    navigate('/inbox');
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

  /** The prompt of a section, collapsed; opened when the clipboard refused so it can be selected by hand. */
  const promptBox = (text: string, which: 'tr' | 'import') => (
    <details class="edit-prompt-details" open={promptOpen === which}>
      <summary>{t('edit.promptShow')}</summary>
      <textarea class="input edit-prompt" readOnly rows={6} value={text} aria-label={t('edit.promptText')} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />
    </details>
  );

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
                  <button type="button" class="btn btn-secondary" onClick={() => copyToClipboard(importPrompt, 'import')}>
                    {t('edit.copyImportPrompt')}
                  </button>
                  <label class="btn">
                    {t('edit.chooseFile')}
                    <input type="file" accept=".json,.txt,application/json,text/plain" style="display:none" onChange={onFile} />
                  </label>
                </div>
                <p class="muted small">{t('edit.fileHint')}</p>
                {fileRecipes && (
                  <div class="edit-file-card" role="status">
                    <p>{t('edit.fileHasRecipes')}</p>
                    <div class="actions">
                      <button type="button" class="btn btn-primary" onClick={openFileInInbox}>
                        {t('edit.openInInbox')}
                      </button>
                      <button type="button" class="btn" onClick={() => setFileRecipes(null)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
                {promptBox(importPrompt, 'import')}
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
                      setFileRecipes(null);
                      setPromptOpen('');
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
            placeholder={linePlaceholder}
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
          {showPlaceholderHint && <p class="muted small edit-hint">{t('edit.placeholderHint')}</p>}
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

        {/* Phase-5 A.4: category + diet/labels, with the live suggestion from the lines above. */}
        <div class="edit-meta">
          <MetaRows value={meta} suggestion={suggestion} onChange={changeMeta} disabled={busy} />
          {!props.id && !metaManual && <p class="muted small edit-hint">{t('meta.autoHint')}</p>}
        </div>

        {/* PLAN §0 "Vertaling eigen recepten" (1): in every column mode; NL mode adds English, EN mode adds Dutch. */}
        <div class="card edit-tools" ref={trRef}>
          <h2>{mode === 'nl' ? t('edit.addEnglish') : mode === 'en' ? t('edit.addDutch') : t('edit.translate')}</h2>
          <p class="muted small">{mode === 'nl' ? t('edit.addEnglishHint') : mode === 'en' ? t('edit.addDutchHint') : t('edit.translateHint')}</p>
          {keptLines.length > trPlan.lines.length && <p class="muted small">{t('edit.translateOnlyFree')}</p>}
          {mode === 'both' && (
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
          )}
          <div class="actions">
            <button type="button" class="btn btn-secondary" onClick={copyTranslationPrompt}>
              {t('edit.copyForTranslation')}
            </button>
            <button type="button" class="btn" onClick={() => setTrOpen(!trOpen)}>
              {t('edit.pasteTranslation')}
            </button>
          </div>
          {promptBox(translationPrompt, 'tr')}
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
