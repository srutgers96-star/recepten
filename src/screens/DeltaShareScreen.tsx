// '#/share' (no id) — "Stuur nieuwe naar <naam>" (docs/phase-3-spec.md §3): keeps two phones in
// step without a server. Partner = another profile on this phone or a free-text name; the
// setting 'share.lastSentTo' remembers per name when something was last sent. Everything changed
// since then (own recipes, received ones edited after receipt, adjusted classics, the user
// ingredients they reference) goes as ONE WhatsApp text with several tokens when it fits in
// 3.5 KB, else as one bundle file (.json → .txt → download). After a share-sheet share the date
// is stored automatically; "Markeer als verzonden" covers Copy / wa.me (share() cannot tell
// whether it was sent). Invariant 9: navigator.share with exactly one field, inside the tap.
import { useEffect, useState } from 'preact/hooks';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { collectDeltaSince, getLastSentTo, markSentTo, type DeltaSince } from '@/db/repo';
import { pickText, type Text } from '@/domain/model';
import { buildPatchEnvelope, buildRecipeEnvelope, planMessages, type MessagePlan } from '@/domain/share';
import { lang, t } from '@/i18n';
import { refreshShareBadges } from '@/inbox-badge';
import { activeProfile, profiles } from '@/profile';
import { copyText, shareJsonFile, shareText } from '@/share-actions';

const OTHER = '\u0000other';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang.value === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** "3 recepten · 1 aangepaste klassieker · 2 nieuwe ingrediënten" (only the non-zero parts). */
function summarize(d: DeltaSince): string {
  const parts: string[] = [];
  const r = d.recipes.length;
  const p = d.patches.length;
  const i = d.userIngredients.length;
  if (r) parts.push(r === 1 ? t('delta.recipe') : t('delta.recipes', { n: r }));
  if (p) parts.push(p === 1 ? t('delta.patch') : t('delta.patches', { n: p }));
  if (i) parts.push(i === 1 ? t('delta.ingredient') : t('delta.ingredients', { n: i }));
  return parts.join(' · ');
}

function ingredientName(e: { nl: { one: string }; en: { one: string }; id: string }, l: 'nl' | 'en'): string {
  return (l === 'nl' ? e.nl.one : e.en.one) || e.nl.one || e.en.one || e.id;
}

export function DeltaShareScreen() {
  const ui = lang.value;
  const me = activeProfile.value;
  const by = me?.name ?? '';
  const [lastSent, setLastSent] = useState<Record<string, string> | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [custom, setCustom] = useState('');
  /** The typed name, settled: the delta (and its compression) follows it after a short pause. */
  const [customName, setCustomName] = useState('');
  const [delta, setDelta] = useState<DeltaSince | null>(null);
  const [plan, setPlan] = useState<MessagePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // Partner names: the other profiles on this phone plus everyone something was sent to before.
  const others = profiles.value.filter((p) => p.id !== me?.id).map((p) => p.name);
  const known = [...new Set([...others, ...Object.keys(lastSent ?? {})])].filter((n) => n && n !== by);
  const name = choice === OTHER ? customName : choice;
  const since = name && lastSent ? (lastSent[name] ?? null) : null;

  useEffect(() => {
    const id = setTimeout(() => setCustomName(custom.trim()), 400);
    return () => clearTimeout(id);
  }, [custom]);

  useEffect(() => {
    let cancelled = false;
    getLastSentTo()
      .then((m) => {
        if (cancelled) return;
        setLastSent(m);
        // Default: the most recently used partner, else the first other profile, else free text.
        const recent = Object.entries(m)
          .filter(([k]) => k !== by)
          .sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0];
        const first = others[0];
        setChoice(recent ?? first ?? OTHER);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The delta and its message plan follow the partner (and their last-sent date).
  useEffect(() => {
    if (!lastSent) return;
    let cancelled = false;
    setDelta(null);
    setPlan(null);
    if (!name) return;
    (async () => {
      const d = await collectDeltaSince(since);
      if (cancelled) return;
      setDelta(d);
      if (!d.recipes.length && !d.patches.length) return;
      const ctx = { by, userIngredients: d.userIngredients };
      const envs = [
        ...d.recipes.map((r) => buildRecipeEnvelope(r, ctx)),
        ...d.patches.map((o) => buildPatchEnvelope(o, { ...ctx, lineOverrides: d.lineOverrides.filter((lo) => lo.recipeId === o.baseId), name: d.names[o.baseId] as Text | undefined })),
      ];
      const p = await planMessages(envs, appInfo.appUrl, { lang: ui, by, name });
      if (!cancelled) setPlan(p);
    })().catch((e: unknown) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [lastSent, name, since, by, ui]);

  async function markSent(auto: boolean) {
    if (!name) return;
    await markSentTo(name);
    const m = await getLastSentTo();
    setLastSent(m);
    setStatus(t(auto ? 'delta.sharedMarked' : 'delta.marked', { name }));
    void refreshShareBadges();
  }

  function shareAsText() {
    if (!plan || !('text' in plan) || busy) return;
    setBusy(true);
    setStatus('');
    // navigator.share runs before the first await inside shareText: still within the tap.
    void shareText(plan.text)
      .then(async (r) => {
        if (r.outcome === 'shared') await markSent(true);
        else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
        else if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  function copyAsText() {
    if (!plan || !('text' in plan)) return;
    void copyText(plan.text).then((r) => setStatus(r.ok ? t('delta.copiedHint') : `${t('share.copyError')}: ${r.error ?? ''}`));
  }

  function shareAsFile() {
    if (!plan || !('file' in plan) || busy) return;
    setBusy(true);
    setStatus('');
    void shareJsonFile(plan.file.name, plan.file.json)
      .then(async (r) => {
        if (r.outcome === 'shared') await markSent(true);
        else if (r.outcome === 'downloaded') setStatus(t('share.fileDownloaded', { name: r.name }));
        else if (r.outcome === 'failed') setStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  function choose(n: string) {
    setChoice(n);
    setStatus('');
  }

  const empty = delta !== null && !delta.recipes.length && !delta.patches.length;
  const hasItems = delta !== null && !empty;

  return (
    <>
      <Header title={t('delta.title')} back backLabel={t('common.back')} />
      <div class="screen delta">
        <p class="muted small">{t('delta.intro')}</p>

        <section class="card">
          <h2>{t('delta.partner')}</h2>
          <div class="partner-chips" role="group" aria-label={t('delta.partner')}>
            {known.map((n) => (
              <button key={n} type="button" class={'partner-chip' + (choice === n ? ' on' : '')} onClick={() => choose(n)}>
                {n}
              </button>
            ))}
            <button type="button" class={'partner-chip' + (choice === OTHER ? ' on' : '')} onClick={() => choose(OTHER)}>
              {t('delta.other')}
            </button>
          </div>
          {choice === OTHER && (
            <input
              class="input partner-input"
              type="text"
              value={custom}
              placeholder={t('delta.otherName')}
              aria-label={t('delta.otherName')}
              autocomplete="off"
              onInput={(e) => setCustom((e.currentTarget as HTMLInputElement).value)}
            />
          )}
          <p class="muted small partner-since">
            {!name ? t('delta.noPartner') : since ? t('delta.lastSent', { name, when: formatWhen(since) }) : t('delta.neverSent', { name })}
          </p>
        </section>

        {error && <p class="warn">{error}</p>}

        {name && (
          <section class="card">
            <h2>{t('delta.preview')}</h2>
            {delta === null && <div class="muted">{t('common.loading')}</div>}
            {empty && <div class="muted">{t('delta.nothing')}</div>}
            {hasItems && delta && (
              <>
                <p class="delta-summary">{summarize(delta)}</p>
                <ul class="delta-list">
                  {delta.recipes.map((r) => (
                    <li key={r.id}>{pickText(r.name, ui) || r.id}</li>
                  ))}
                  {delta.patches.map((o) => (
                    <li key={'p:' + o.baseId}>
                      {pickText(patchName(delta, o.baseId), ui) || o.baseId} <span class="muted">({t('delta.adjusted')})</span>
                    </li>
                  ))}
                  {delta.userIngredients.map((e) => (
                    <li key={'i:' + e.id} class="muted">
                      + {ingredientName(e, ui)}
                    </li>
                  ))}
                </ul>
                {plan === null && <div class="muted small">{t('share.encoding')}</div>}
                {plan && 'text' in plan && (
                  <>
                    <p class="muted small">{t('delta.asText', { tokens: plan.tokens, chars: plan.chars })}</p>
                    <div class="actions">
                      <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={shareAsText}>
                        {t('share.whatsapp')}
                      </button>
                      <button type="button" class="btn" onClick={copyAsText}>
                        {t('share.copy')}
                      </button>
                    </div>
                  </>
                )}
                {plan && 'file' in plan && (
                  <>
                    <p class="muted small">{t('delta.asFile', { name: plan.file.name })}</p>
                    <div class="actions">
                      <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={shareAsFile}>
                        {t('share.file')}
                      </button>
                    </div>
                  </>
                )}
                {plan && (
                  <div class="actions" style="margin-top:0">
                    <button type="button" class="btn btn-secondary btn-block" disabled={busy} onClick={() => void markSent(false)}>
                      {t('delta.markSent')}
                    </button>
                  </div>
                )}
                <p class="muted small">{t('delta.markHint')}</p>
              </>
            )}
            <div class="status" role="status">
              {status}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** The effective name of a patched classic (collected with the delta), or nothing. */
function patchName(delta: DeltaSince, baseId: string): Text | undefined {
  return delta.names[baseId] as Text | undefined;
}
