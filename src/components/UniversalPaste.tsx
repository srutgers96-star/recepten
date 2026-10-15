// One paste box for everything (phase 6, docs/phase-6-spec.md 13A — Stijn: "elk plakvak moet alles
// kunnen plakken"). The same component sits in the editor (Toevoegen), the Inbox and the Household:
// a plain textarea (iPhone: long-press → Plak keeps working, invariant 5), "Plak van klembord" and
// "Wis" above it, and under it one line that says what the text is (src/paste.ts `summarizePaste`:
// "3 deellinks herkend", "Kaartje van Noor", "Recept van een website: 12 ingrediënten, 6 stappen",
// "AI-antwoord herkend", "Geen recept of link herkend — probeer de AI-opdracht") with the button(s)
// for it. Where the box sits only decides the wording (`defaultAction`) and what happens on a tap:
// a callback the host leaves out means the host shows the result itself under the box (the Inbox
// renders its import preview for links and bundles, the Household its card rows), a callback it
// passes becomes a button (the editor's "Vul in", elsewhere "Open in de Inbox" / "Open in de
// editor" / "Voeg toe aan je huishouden"). The host owns the text (controlled), so the Inbox can
// drop a share-target or a boot-time token into it.
import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PasteKind } from '@/domain/paste-classify';
import { lang, t } from '@/i18n';
import { isInboxKind, isRecipeKind, summarizePaste, type PasteSummary } from '@/paste';

const SUMMARY_DEBOUNCE_MS = 150;

export type PasteDefaultAction = 'import' | 'recipe' | 'member';

export interface UniversalPasteProps {
  /** Where the box sits: decides the wording of the buttons (the editor says "Vul in", elsewhere "Open in de editor"). */
  defaultAction: PasteDefaultAction;
  value: string;
  onChange: (text: string) => void;
  /** Share links / a bundle: the button hands the text over (src/paste.ts `openPasteIn('inbox', …)`). Omitted = the host shows the import preview itself. */
  onImport?: (text: string, kind: PasteKind) => void;
  /** Member cards: the button hands the text over. Omitted = the host shows the card rows itself. */
  onMember?: (text: string, kind: PasteKind) => void;
  /** A website recipe / AI answer (and "Toch proberen" for an unrecognised text): "Vul in" in the editor, "Open in de editor" elsewhere. */
  onRecipe?: (text: string, kind: PasteKind) => void;
  /** "Met AI" when nothing was recognised: copy the instruction for an external AI. */
  onAi?: () => void;
  /** Extra buttons in the row next to "Plak van klembord" (the Inbox's "Kies bestand"). */
  extra?: ComponentChildren;
  /** Accessible name of the textarea; defaults to "Plakvak". */
  label?: string;
  rows?: number;
  /** Focus the textarea once it is on screen ("+" → Plak een recept). */
  autoFocus?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement>;
  /** Decoding problems (invalid code, newer version) under the line; off where the host lists them itself (the Inbox). */
  showProblems?: boolean;
}

/** The icon in front of the summary line, one per kind. */
function iconOf(kind: PasteKind): string {
  switch (kind) {
    case 'tokens':
      return '🔗';
    case 'member':
      return '👋';
    case 'bundle':
      return '📦';
    case 'website':
      return '🌐';
    case 'ai':
      return '🤖';
    default:
      return '❓';
  }
}

export function UniversalPaste(props: UniversalPasteProps) {
  const [summary, setSummary] = useState<PasteSummary | null>(null);
  const [notice, setNotice] = useState('');
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);
  const ref = props.textareaRef ?? ownRef;
  const ui = lang.value;
  const text = props.value;

  // What the text is (debounced; tokens are decoded, so async). Re-run on a language switch so
  // the line is in the right language.
  useEffect(() => {
    const my = ++seq.current;
    if (!text.trim()) {
      setSummary(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void summarizePaste(text)
        .then((s) => {
          if (my === seq.current) setSummary(s);
        })
        .catch((e: unknown) => {
          console.warn('summarizePaste', e);
          if (my === seq.current) setSummary(null);
        });
    }, SUMMARY_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [text, ui]);

  // Only on mount: a later re-render must not steal the focus.
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus();
  }, []);

  // readText() must run inside the tap (iOS shows its Paste callout only then).
  function pasteFromClipboard() {
    setNotice('');
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    const failed = () => {
      setNotice(t('inbox.pasteFailed'));
      ref.current?.focus();
    };
    if (!clip || typeof clip.readText !== 'function') {
      failed();
      return;
    }
    clip.readText().then((s) => {
      if (s && s.trim()) props.onChange(s);
      else failed();
    }, failed);
  }

  function clear() {
    setNotice('');
    props.onChange('');
    ref.current?.focus();
  }

  // The buttons for what was found. The editor is the only place that fills in; everywhere else
  // the recipe button travels to it.
  const kind = summary?.kind ?? 'empty';
  const inEditor = props.defaultAction === 'recipe';
  const buttons: ComponentChildren[] = [];
  if (summary && summary.kind !== 'empty') {
    const hasLinks = summary.shareTokens > 0 || kind === 'bundle';
    const hasCards = summary.memberNames.length > 0;
    if (isInboxKind(kind)) {
      if (props.onImport && (hasLinks || (!hasCards && kind !== 'member'))) {
        buttons.push(
          <button key="import" type="button" class="btn btn-primary" onClick={() => props.onImport?.(text, kind)}>
            {t('paste.actImport')}
          </button>,
        );
      }
      if (props.onMember && hasCards) {
        buttons.push(
          <button key="member" type="button" class={'btn' + (hasLinks && props.onImport ? '' : ' btn-primary')} onClick={() => props.onMember?.(text, kind)}>
            {t('paste.actMember')}
          </button>,
        );
      }
    } else if (isRecipeKind(kind)) {
      if (props.onRecipe) {
        buttons.push(
          <button key="recipe" type="button" class="btn btn-primary" onClick={() => props.onRecipe?.(text, kind)}>
            {t(inEditor ? 'paste.actFill' : 'paste.actEditor')}
          </button>,
        );
      }
    } else if (kind === 'unknown') {
      if (props.onRecipe) {
        buttons.push(
          <button key="try" type="button" class="btn" onClick={() => props.onRecipe?.(text, kind)}>
            {t(inEditor ? 'paste.actTryAnyway' : 'paste.actEditorAnyway')}
          </button>,
        );
      }
      if (props.onAi) {
        buttons.push(
          <button key="ai" type="button" class="btn btn-secondary" onClick={props.onAi}>
            {t('paste.actAi')}
          </button>,
        );
      }
    }
  }

  return (
    <div class="upaste">
      <div class="actions upaste-actions">
        <button type="button" class="btn btn-primary" onClick={pasteFromClipboard}>
          {t('inbox.paste')}
        </button>
        {props.extra}
        {text !== '' && (
          <button type="button" class="btn btn-small" onClick={clear}>
            {t('inbox.clear')}
          </button>
        )}
      </div>
      <textarea
        class="input upaste-box"
        ref={ref}
        rows={props.rows ?? 4}
        value={text}
        autocomplete="off"
        spellcheck={false}
        aria-label={props.label ?? t('paste.label')}
        placeholder={t('paste.placeholder')}
        onInput={(e) => props.onChange((e.currentTarget as HTMLTextAreaElement).value)}
      />
      <p class="muted small upaste-hint">{t('inbox.pasteHint')}</p>
      {notice && (
        <div class="status" role="status">
          {notice}
        </div>
      )}
      {summary && summary.kind !== 'empty' && (
        <div class={'upaste-found is-' + kind} role="status">
          <div class="upaste-found-text">
            <span class="upaste-icon" aria-hidden="true">
              {iconOf(kind)}
            </span>
            <span>{summary.label}</span>
          </div>
          {props.showProblems !== false &&
            summary.problems.map((p, i) => (
              <p class="upaste-problem" key={'p' + i}>
                {p}
              </p>
            ))}
          {buttons.length > 0 && <div class="actions upaste-found-actions">{buttons}</div>}
        </div>
      )}
    </div>
  );
}
