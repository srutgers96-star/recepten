// The import preview of the Inbox (docs/phase-3-spec.md §4): every item of an ImportPlan with its
// status chip (Nieuw / Heb je al / Bijgewerkt door X / Conflict / Lijkt op Y), the dictionary
// delta ("2 nieuwe ingrediënten"), a ConflictCard where a decision is needed, and ONE "Importeer"
// button. The plan comes from src/domain/merge.ts `planImport`; the choices go back to the screen,
// which calls repo.applyImportPlan.
import type { ComponentChildren } from 'preact';
import { ConflictCard, itemName } from '@/components/ConflictCard';
import { pickText, type Lang } from '@/domain/model';
import { defaultChoice, type ImportChoice, type ImportChoices, type ImportItem, type ImportPlan } from '@/domain/merge';
import { VARIANT_DIETS } from '@/domain/diets';
import { t } from '@/i18n';

export interface ImportPreviewProps {
  plan: ImportPlan;
  choices: ImportChoices;
  ui: Lang;
  busy?: boolean;
  onChoice: (id: string, choice: ImportChoice) => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  /** V2 §1c: the sender's avatar in front of "Van {naam}" (a friend; a housemate gets the line above). */
  senderAvatar?: ComponentChildren;
}

function fmtDate(iso: string | undefined, l: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(l === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** True when the plan with these choices would write anything (items or dictionary entries). */
export function planWrites(plan: ImportPlan, choices: ImportChoices): boolean {
  if (plan.dict.add.length > 0) return true;
  return plan.items.some((item) => {
    if (item.status === 'present') return false;
    if (item.kind === 'patch' && item.problem) return false;
    const c = choices[item.id];
    if (!c) return item.status === 'new' || item.status === 'update';
    if (c.action === 'skip') return false;
    if (c.action === 'fields') return Object.values(c.fields).some((v) => v === 'theirs' || v === 'both');
    return true;
  });
}

function StatusChip(props: { item: ImportItem; by?: string; ui: Lang }) {
  const { item, ui } = props;
  if (item.kind === 'patch' && item.problem === 'unknown-base') return <span class="badge badge-next">{t('inbox.status.unknownBase')}</span>;
  switch (item.status) {
    case 'new':
      return <span class="badge badge-green">{t('inbox.status.new')}</span>;
    case 'present':
      return <span class="badge badge-muted">{t('inbox.status.present')}</span>;
    case 'update':
      return <span class="badge">{props.by ? t('inbox.status.update', { name: props.by }) : t('inbox.status.updateAnon')}</span>;
    case 'conflict':
      return <span class="badge badge-next">{t('inbox.status.conflict')}</span>;
    case 'similar': {
      const twin = item.kind === 'recipe' ? item.similarTo : undefined;
      return <span class="badge">{t('inbox.status.similar', { name: twin ? pickText(twin.name, ui) : '…' })}</span>;
    }
    default:
      return null;
  }
}

function countsLine(item: ImportItem): string {
  if (item.kind === 'recipe') {
    const r = item.incoming;
    return `${t('inbox.ingredients', { n: r.lines.filter((l) => l.kind !== 'header').length })} · ${t('inbox.steps', { n: r.steps.length })}`;
  }
  if (item.linksOnly) return t('inbox.patchLinksOnly', { n: item.incoming.lineOverrides?.length ?? 0 });
  const fields = item.fields && item.fields.length ? item.fields : Object.keys(item.incoming.patch).map((k) => (k === 'name' || k === 'lines' || k === 'steps' ? k : 'meta'));
  const labels = [...new Set(fields)].map((f) => t('inbox.field.' + f).toLowerCase());
  return labels.length ? t('inbox.patchFields', { fields: labels.join(', ') }) : '';
}

/**
 * 13D blok 4 (docs/specs/varianten-tabs.md §1g): what an incoming recipe (or a classic's patch)
 * carries besides its lines — a maker's tip with text in a language, and the number of approved diet
 * versions. A key that is not a known diet or a version that is not approved does not count.
 */
export function importExtras(item: ImportItem): { tip: boolean; approved: number } {
  const src: { tip?: unknown; variants?: unknown } = item.kind === 'recipe' ? item.incoming : (item.incoming.patch ?? {});
  const tip = src.tip;
  const hasTip =
    !!tip && typeof tip === 'object' && Object.values(tip as Record<string, unknown>).some((v) => typeof v === 'string' && v.trim() !== '');
  let approved = 0;
  const vs = src.variants;
  if (vs && typeof vs === 'object') {
    for (const diet of VARIANT_DIETS) {
      const v = (vs as Record<string, unknown>)[diet];
      if (v && typeof v === 'object' && (v as { approved?: unknown }).approved === true) approved++;
    }
  }
  return { tip: hasTip, approved };
}

/** The small "met een tip van de maker" / "met n goedgekeurde versies" lines (§1g), in that order. */
export function extrasLines(item: ImportItem): string[] {
  const x = importExtras(item);
  const out: string[] = [];
  if (x.tip) out.push(t('inbox.withTip'));
  if (x.approved === 1) out.push(t('inbox.withVariant1'));
  else if (x.approved > 1) out.push(t('inbox.withVariants', { n: x.approved }));
  return out;
}

function ItemCard(props: { item: ImportItem; choice: ImportChoice; by?: string; ui: Lang; onChoice: (c: ImportChoice) => void; onOpen: (id: string) => void }) {
  const { item, ui } = props;
  const name = itemName(item, ui);
  const other = item.kind === 'recipe' ? item.incoming.name : (item.base?.name ?? item.incoming.name);
  const otherLang = other && other.nl && other.en && other.nl !== other.en ? (ui === 'en' ? other.nl : other.en) : '';
  const skipped = props.choice.action === 'skip' && item.status !== 'present';
  const decided = item.status === 'conflict' || item.status === 'similar' || item.status === 'update';
  const existingId = item.kind === 'recipe' ? (item.existing?.id ?? item.similarTo?.id) : item.base?.id;
  return (
    <div class={'card ip-item ip-' + item.status + (skipped && !decided ? ' ip-skipped' : '')}>
      <div class="ip-head">
        <div class="ip-titles">
          {item.kind === 'patch' && <div class="muted small ip-kind">{t('inbox.patch')}</div>}
          <h3 class="ip-name">{name || '—'}</h3>
          {otherLang && <div class="muted ip-alt">{otherLang}</div>}
          {item.kind === 'patch' && <div class="muted small">{props.by ? t('inbox.patchBy', { name: props.by }) : t('inbox.patchAnon')}</div>}
        </div>
        <StatusChip item={item} by={props.by} ui={ui} />
      </div>
      <p class="muted small ip-counts">{countsLine(item)}</p>
      {extrasLines(item).map((line) => (
        <p key={line} class="muted small ip-counts ip-extra">
          {line}
        </p>
      ))}

      {item.kind === 'patch' && item.problem === 'unknown-base' && <p class="bad small">{t('inbox.unknownBase')}</p>}
      {item.status === 'present' && !(item.kind === 'patch' && item.problem) && (
        <div class="ip-present">
          <span class="muted small">{t('inbox.presentHint')}</span>
          {existingId && (
            <button type="button" class="btn btn-small" onClick={() => props.onOpen(existingId)}>
              {t('inbox.open')}
            </button>
          )}
        </div>
      )}
      {item.status === 'update' && <p class="muted small">{t('inbox.updateHint')}</p>}

      {decided && <ConflictCard item={item} choice={props.choice} by={props.by} ui={ui} onChange={props.onChoice} onOpen={props.onOpen} />}
    </div>
  );
}

export function ImportPreview(props: ImportPreviewProps) {
  const { plan, choices, ui } = props;
  const by = plan.by;
  const recipes = plan.items.filter((i) => i.kind === 'recipe').length;
  const patches = plan.items.length - recipes;
  const found: string[] = [];
  if (recipes === 1) found.push(t('inbox.foundRecipe'));
  else if (recipes > 1) found.push(t('inbox.foundRecipes', { n: recipes }));
  if (patches === 1) found.push(t('inbox.foundPatch'));
  else if (patches > 1) found.push(t('inbox.foundPatches', { n: patches }));
  const add = plan.dict.add.length;
  const known = plan.dict.skip.length;
  const dictParts: string[] = [];
  if (add === 1) dictParts.push(t('inbox.dictAdd1'));
  else if (add > 1) dictParts.push(t('inbox.dictAddN', { n: add }));
  if (known > 0 && add > 0) dictParts.push(t('inbox.dictKnown', { n: known }));
  const canImport = !props.busy && planWrites(plan, choices);

  return (
    <section class="ip">
      <div class="ip-summary">
        <div class="ip-summary-main">
          <strong>{t('inbox.found')}:</strong> {found.join(' · ') || t('inbox.dictOnly')}
          {by ? ' · ' : ''}
          {by && props.senderAvatar}
          {by ? t('common.from', { name: by }) : ''}
          {plan.at ? ` · ${t('inbox.at')} ${fmtDate(plan.at, ui)}` : ''}
        </div>
        {dictParts.length > 0 && (
          <div class="muted small ip-dict">
            {dictParts.join(' · ')}
            {add > 0 && <span class="ip-dict-names">{': ' + plan.dict.add.map((e) => pickText({ nl: e.nl.one, en: e.en.one }, ui)).join(', ')}</span>}
          </div>
        )}
      </div>

      {plan.items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          choice={choices[item.id] ?? defaultChoice(item)}
          by={by}
          ui={ui}
          onChoice={(c) => props.onChoice(item.id, c)}
          onOpen={props.onOpen}
        />
      ))}

      <div class="actions ip-actions">
        <button type="button" class="btn btn-primary btn-block" disabled={!canImport} onClick={props.onImport}>
          {props.busy ? t('inbox.importing') : t('inbox.import')}
        </button>
      </div>
      {!props.busy && !planWrites(plan, choices) && <p class="muted small ip-nothing">{t('inbox.nothingToImport')}</p>}
    </section>
  );
}
