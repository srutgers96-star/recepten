// '#/share' (no id) — "Stuur nieuwe naar <naam>" (docs/phase-3-spec.md §3): keeps two phones in
// step without a server. Partner = a member of the household (phase 5 block F: the other profiles
// on this phone, members from a card, hand-typed ones — shown first with their colour), a name
// something was sent to before, or a free-text name; the
// setting 'share.lastSentTo' remembers per name when something was last sent. Everything changed
// since then (own recipes, received ones edited after receipt, adjusted classics, the user
// ingredients they reference) goes as ONE WhatsApp text with several tokens when it fits in
// 3.5 KB, else as one bundle file (.json → .txt → download). After a share-sheet share the date
// is stored automatically; "Markeer als verzonden" covers Copy / wa.me (share() cannot tell
// whether it was sent). Invariant 9: navigator.share with exactly one field, inside the tap.
import { useEffect, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { bumpSharedRecipes, collectDeltaSince, getHousehold, getLastSentTo, markSentTo, type DeltaSince } from '@/db/repo';
import { membersFrom, type HouseholdSetting, type Member } from '@/domain/household';
import { pickText, type Text } from '@/domain/model';
import { buildPatchEnvelope, buildRecipeEnvelope, planMessages, type MessagePlan } from '@/domain/share';
import { lang, t } from '@/i18n';
import { refreshShareBadges } from '@/inbox-badge';
import { activeProfile, profiles } from '@/profile';
import { navigate } from '@/router';
import { copyText, shareJsonFile, shareText } from '@/share-actions';
import { Avatar } from './ProfilesScreen';

const OTHER = '\u0000other';

function foldName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * When something was last sent to a partner: the newest 'share.lastSentTo' entry whose key folds
 * to the same name. The keys keep the spelling that was typed ("gabi" via "Anders…" before her card
 * arrived as "Gabi"), while a member chip carries the member's name; comparing folded keeps the
 * delta, the chip and the "laatst verzonden" line on one partner. (The old key stays in the setting;
 * it is hidden by the chip filter and harmless.)
 */
function lastSentFor(lastSent: Record<string, string>, name: string): string | null {
  const wanted = foldName(name);
  if (!wanted) return null;
  let best: string | null = null;
  for (const [k, v] of Object.entries(lastSent)) if (foldName(k) === wanted && (best === null || v.localeCompare(best) > 0)) best = v;
  return best;
}

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

/**
 * Phase 5 block C (badge rule 'shared'): n recipes left this phone through the share sheet.
 * Fire-and-forget: bump the counter, then re-check badges for the active profile.
 */
function countShared(n: number) {
  void bumpSharedRecipes(n)
    .then(() => {
      const pid = activeProfile.value?.id;
      return pid ? checkNewBadges(pid) : undefined;
    })
    .catch((e: unknown) => console.error('bumpSharedRecipes', e));
}

export function DeltaShareScreen() {
  const ui = lang.value;
  const me = activeProfile.value;
  const by = me?.name ?? '';
  const [lastSent, setLastSent] = useState<Record<string, string> | null>(null);
  // Block F: the household (loaded with lastSent); its members are the first partner choices.
  const [household, setHousehold] = useState<HouseholdSetting | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [custom, setCustom] = useState('');
  /** The typed name, settled: the delta (and its compression) follows it after a short pause. */
  const [customName, setCustomName] = useState('');
  const [delta, setDelta] = useState<DeltaSince | null>(null);
  const [plan, setPlan] = useState<MessagePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // Partner choices: the household members (the other profiles on this phone, members from a card,
  // hand-typed ones) first, then everyone else something was sent to before.
  const members: Member[] = (household ? membersFrom(profiles.value, household) : profiles.value.map((p) => ({ id: p.id, name: p.name, color: p.color, lang: p.lang, local: true }) as Member)).filter(
    (m) => m.id !== me?.id && foldName(m.name) !== foldName(by),
  );
  const memberNames = new Set(members.map((m) => foldName(m.name)));
  const known = [...new Set(Object.keys(lastSent ?? {}))].filter((n) => n && foldName(n) !== foldName(by) && !memberNames.has(foldName(n)));
  const name = choice === OTHER ? customName : choice;
  const since = name && lastSent ? lastSentFor(lastSent, name) : null;
  /** The chip that is on: compared folded, like the member/known split above. */
  const chosen = choice === OTHER ? OTHER : foldName(choice);

  useEffect(() => {
    const id = setTimeout(() => setCustomName(custom.trim()), 400);
    return () => clearTimeout(id);
  }, [custom]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getLastSentTo(), getHousehold()])
      .then(([m, h]) => {
        if (cancelled) return;
        setHousehold(h);
        setLastSent(m);
        // Default: the most recently used partner, else the first other member, else free text.
        const recent = Object.entries(m)
          .filter(([k]) => foldName(k) !== foldName(by))
          .sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0];
        const others = membersFrom(profiles.value, h).filter((x) => x.id !== me?.id && foldName(x.name) !== foldName(by));
        // A name typed before that person became a member ("gabi") selects the member's chip ("Gabi").
        const recentMember = recent ? others.find((x) => foldName(x.name) === foldName(recent))?.name : undefined;
        setChoice(recentMember ?? recent ?? others[0]?.name ?? OTHER);
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
    // Recipes + patched classics in this delta count for the 'shared' badge (ingredients do not).
    const shared = delta ? delta.recipes.length + delta.patches.length : 0;
    // navigator.share runs before the first await inside shareText: still within the tap.
    void shareText(plan.text)
      .then(async (r) => {
        if (r.outcome === 'shared') {
          await markSent(true);
          countShared(shared);
        } else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
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
    const shared = delta ? delta.recipes.length + delta.patches.length : 0;
    void shareJsonFile(plan.file.name, plan.file.json)
      .then(async (r) => {
        if (r.outcome === 'shared') {
          await markSent(true);
          countShared(shared);
        } else if (r.outcome === 'downloaded') setStatus(t('share.fileDownloaded', { name: r.name }));
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
            {members.map((m) => (
              <button key={m.id} type="button" class={'partner-chip member' + (chosen === foldName(m.name) ? ' on' : '')} onClick={() => choose(m.name)}>
                <Avatar profile={m} />
                {m.name}
              </button>
            ))}
            {known.map((n) => (
              <button key={n} type="button" class={'partner-chip' + (chosen === foldName(n) ? ' on' : '')} onClick={() => choose(n)}>
                {n}
              </button>
            ))}
            <button type="button" class={'partner-chip' + (choice === OTHER ? ' on' : '')} onClick={() => choose(OTHER)}>
              {t('delta.other')}
            </button>
          </div>
          {household && !members.some((m) => !m.local) && (
            <p class="muted small partner-hint">
              {t('delta.memberHint')}{' '}
              <a
                href="#/more/household"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/more/household');
                }}
              >
                {t('household.toHousehold')} ›
              </a>
            </p>
          )}
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
