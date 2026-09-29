// The choice UI of one import item that needs a decision (docs/phase-3-spec.md §4 "Inbox"):
//   conflict  -> per field (name / lines / steps / meta) a segmented mine | theirs | both, with
//                "Alles van mij" / "Alles van <naam>" shortcuts; "both" = keep mine + their version
//                as a copy ("<naam> (<by>s versie)", src/domain/merge.ts)
//   similar   -> replace | keep both | skip
//   update    -> take | skip
// It only edits the ImportChoice; src/domain/merge.ts `resolveImport` gives it its meaning.
import { Segmented } from '@/components/Segmented';
import { pickText, type Lang, type Recipe, type Text } from '@/domain/model';
import { CONFLICT_FIELDS, type ConflictField, type FieldChoice, type ImportChoice, type ImportItem } from '@/domain/merge';
import { t } from '@/i18n';

export interface ConflictCardProps {
  item: ImportItem;
  choice: ImportChoice;
  /** Sender name (plan.by), for the "Van <naam>" labels. */
  by?: string;
  ui: Lang;
  onChange: (choice: ImportChoice) => void;
  /** "Open de bestaande" for a look-alike. */
  onOpen?: (id: string) => void;
}

/** The per-field choices of a conflict as the segmented controls show them (skip = all mine). */
function fieldsOf(choice: ImportChoice, fields: readonly ConflictField[]): Record<ConflictField, FieldChoice> {
  const out = { name: 'mine', lines: 'mine', steps: 'mine', meta: 'mine' } as Record<ConflictField, FieldChoice>;
  for (const f of fields) {
    if (choice.action === 'fields') out[f] = choice.fields[f] ?? 'mine';
    else if (choice.action === 'replace' || choice.action === 'apply') out[f] = 'theirs';
    else if (choice.action === 'both') out[f] = 'both';
  }
  return out;
}

function fieldLabel(f: ConflictField): string {
  return t('inbox.field.' + f);
}

/** "Mijn: 12 regels · Van Stijn: 13 regels" style summary of one field, when it is cheap to show. */
function fieldSummary(f: ConflictField, mine: Recipe | undefined, theirs: Recipe | undefined, ui: Lang, who: string): string {
  if (!mine || !theirs) return '';
  const m = t('inbox.mine');
  if (f === 'name') return `${m}: ${pickText(mine.name, ui)} · ${who}: ${pickText(theirs.name, ui)}`;
  if (f === 'lines') return `${m}: ${t('inbox.lineCount', { n: mine.lines.length })} · ${who}: ${t('inbox.lineCount', { n: theirs.lines.length })}`;
  if (f === 'steps') return `${m}: ${t('inbox.stepCount', { n: mine.steps.length })} · ${who}: ${t('inbox.stepCount', { n: theirs.steps.length })}`;
  return t('inbox.field.metaHint');
}

export function ConflictCard(props: ConflictCardProps) {
  const { item, choice, ui } = props;
  const name = (props.by ?? '').trim();
  const who = name ? t('inbox.theirs', { name }) : t('inbox.theirsAnon');
  const other = name || t('inbox.other');

  if (item.status === 'update') {
    const on: 'apply' | 'skip' = choice.action === 'skip' ? 'skip' : 'apply';
    return (
      <div class="cc">
        <Segmented<'apply' | 'skip'>
          name={'cc-' + item.id}
          options={[
            { value: 'apply', label: t('inbox.take') },
            { value: 'skip', label: t('inbox.skip') },
          ]}
          selected={[on]}
          onChange={(next) => {
            const v = next[0];
            if (v) props.onChange({ action: v });
          }}
        />
      </div>
    );
  }

  if (item.status === 'similar') {
    const on: 'replace' | 'both' | 'skip' = choice.action === 'replace' ? 'replace' : choice.action === 'both' ? 'both' : 'skip';
    const twin = item.kind === 'recipe' ? item.similarTo : undefined;
    return (
      <div class="cc">
        <p class="muted small cc-hint">{t('inbox.similarHint')}</p>
        <Segmented<'replace' | 'both' | 'skip'>
          name={'cc-' + item.id}
          options={[
            { value: 'replace', label: t('inbox.replace') },
            { value: 'both', label: t('inbox.keepBoth') },
            { value: 'skip', label: t('inbox.skip') },
          ]}
          selected={[on]}
          onChange={(next) => {
            const v = next[0];
            if (v) props.onChange({ action: v });
          }}
        />
        {twin && props.onOpen && (
          <button type="button" class="btn btn-small cc-open" onClick={() => props.onOpen?.(twin.id)}>
            {t('inbox.openExisting')}
          </button>
        )}
      </div>
    );
  }

  if (item.status !== 'conflict') return null;

  const fields = (item.fields && item.fields.length ? item.fields : CONFLICT_FIELDS).slice();
  const current = fieldsOf(choice, fields);
  const mine: Recipe | undefined = item.kind === 'recipe' ? item.existing : item.base;
  const theirs: Recipe | undefined = item.kind === 'recipe' ? item.incoming : undefined;

  function set(f: ConflictField, v: FieldChoice) {
    const next = { ...current, [f]: v } as Record<ConflictField, FieldChoice>;
    const picked: Partial<Record<ConflictField, FieldChoice>> = {};
    for (const k of fields) picked[k] = next[k];
    props.onChange({ action: 'fields', fields: picked });
  }

  function setAll(v: FieldChoice) {
    const picked: Partial<Record<ConflictField, FieldChoice>> = {};
    for (const k of fields) picked[k] = v;
    props.onChange({ action: 'fields', fields: picked });
  }

  return (
    <div class="cc">
      <p class="muted small cc-hint">{t('inbox.conflictHint', { name: other })}</p>
      {fields.map((f) => {
        const summary = fieldSummary(f, mine, theirs, ui, who);
        return (
          <div class="cc-field" key={f}>
            <div class="cc-label">
              <span>{fieldLabel(f)}</span>
              {summary && <span class="muted small cc-summary">{summary}</span>}
            </div>
            <Segmented<FieldChoice>
              name={'cc-' + item.id + '-' + f}
              options={[
                { value: 'mine', label: t('inbox.mine') },
                { value: 'theirs', label: who },
                { value: 'both', label: t('inbox.both') },
              ]}
              selected={[current[f]]}
              onChange={(next) => {
                const v = next[0];
                if (v) set(f, v);
              }}
            />
          </div>
        );
      })}
      {fields.length > 1 && (
        <div class="cc-all">
          <button type="button" class="btn btn-small" onClick={() => setAll('mine')}>
            {t('inbox.allMine')}
          </button>
          <button type="button" class="btn btn-small" onClick={() => setAll('theirs')}>
            {t('inbox.allTheirs', { name: other })}
          </button>
        </div>
      )}
    </div>
  );
}

/** Name of the recipe/classic an item is about, in the UI language (for headings). */
export function itemName(item: ImportItem, ui: Lang): string {
  const text: Text | undefined = item.kind === 'recipe' ? item.incoming.name : (item.base?.name ?? item.incoming.name);
  return pickText(text, ui);
}
