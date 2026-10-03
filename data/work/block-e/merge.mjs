// data/work/block-e/merge.mjs — merges the block-E dictionary slices into data/ingredients.json.
// Work tool for phase 5 block E (docs/phase-5-spec.md, "groot woordenboek"); not shipped.
//
// What it does, in order:
//   1. Base = data/ingredients.json as committed in HEAD (so a re-run gives the same result). It
//      refuses to write when the working-tree file has edits other than a previous run of this script.
//   2. Reads every data/work/block-e/slice-*.json (file-name order, entries in file order), then
//      the integrator's own ADD entries.
//   3. Applies the integrator decisions below (DROP whole entries, DROP_NAMES, PATCH fields,
//      BASE_DROP_NAMES on existing entries).
//   4. Validates each entry on the required fields and shapes (the rules of tools/validate-data.ts).
//   5. Dedupes: (a) on id against the base and earlier slices (first wins); (b) on the name key
//      (normalizeKey: lower case, diacritics folded) over nl.one / nl.many / aliases.nl and the
//      English side. A Dutch clash drops the entry (one/many) or only the clashing alias — Dutch
//      clashes are validation errors. An English clash drops the clashing alias; a clashing
//      en.one / en.many drops the entry (no new validator warnings). The id counts as a Dutch key,
//      because the Dictionary indexes it as a last-resort Dutch name.
//   6. Inserts the survivors in id order (code points, like the file) with the file's own JSON style.
//   Everything dropped is logged; review notes (a qualifier in front of an existing name, a name that
//   is also a unit word) are logged too but change nothing.
//
// Run:   node data/work/block-e/merge.mjs [--dry-run] [--log <file>]
//        (Node 22.18+ strips the types of the imported src/domain/dictionary.ts by itself; on older
//        Node add --experimental-strip-types.)

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { normalizeKey } from '../../../src/domain/dictionary.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const TARGET = join(ROOT, 'data', 'ingredients.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const logIdx = args.indexOf('--log');
const LOG_FILE = logIdx >= 0 ? args[logIdx + 1] : undefined;

// ---------------------------------------------------------------------------------------------
// Integrator decisions (reviewed by hand: validator, parser golden, spot checks).
// ---------------------------------------------------------------------------------------------

/** Whole entries left out, with the reason. */
const DROP = {};

/** Single names left out of an entry (by slice id): id -> ['nl:<name>' | 'en:<name>', ...] (aliases or many). */
const DROP_NAMES = {
  // The English is "chicken ragout"; "1 blik kalfsragout" would render as chicken.
  ragout: ['nl:kalfsragout'],
  // "ijs" in a drink is ice, not ice cream ("gemalen ijs", "een handvol ijs"). Leave it unclaimed.
  roomijs: ['nl:ijs'],
  // "een plak koek" in stoofvlees/hachee is ontbijtkoek, not a biscuit.
  koekje: ['nl:koek'],
};

/**
 * Field overrides (by slice id): id -> partial entry (shallow; `aliases` replaces per language,
 * `null` removes a field). An `id` here renames a NEW entry (never an existing one: ids are forever).
 */
const PATCH = {
  // Supermarket spijs often contains egg; err on the safe side (a false "vegan" tag is worse).
  amandelspijs: { vegan: false },
  // Dutch Turks fruit is often set with gelatine.
  'turks-fruit': { veg: false, vegan: false },
  // Plain "soda" in a recipe is usually soda water in a drink; the id is also a lookup key, so it moves too.
  soda: { id: 'huishoudsoda', nl: { one: 'huishoudsoda' }, aliases: { nl: ['kristalsoda'] } },
};

/** Entries the integrator adds (gaps between slices), merged after all slices. */
const ADD = [
  // Both the dranken and the diepvries slice left ice cubes to the other one.
  { id: 'ijsblokje', nl: { one: 'ijsblokje', many: 'ijsblokjes' }, en: { one: 'ice cube', many: 'ice cubes' }, aliases: { nl: ['ijsklontje', 'ijsklontjes'], en: ['crushed ice'] }, aisle: 'diepvries', defaultUnit: 'stuk', buyUnit: 'zak', staple: false, veg: true, vegan: true, gluten: false },
];

/**
 * Names taken away from EXISTING entries (HEAD) so a new, more precise entry can own them:
 * id -> ['nl:<name>' | 'en:<name>', ...]. Applied to the base before any merging.
 */
const BASE_DROP_NAMES = {
  // "Tenderstem broccoli" is the British name of bimi (new entry), not of ordinary broccoli.
  broccoli: ['en:tenderstem broccoli'],
};

// ---------------------------------------------------------------------------------------------

const KEY_ORDER = ['id', 'nl', 'en', 'aliases', 'aisle', 'defaultUnit', 'buyUnit', 'gramsPer', 'cut', 'unitNames', 'staple', 'veg', 'vegan', 'gluten', 'glutenUnsure', 'perishable', 'gloss'];
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const lines = [];
const log = (s) => lines.push(s);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string');
const hasName = (v) => isRecord(v) && typeof v.one === 'string' && v.one.trim() !== '';

/** The file's own style: one entry per line, `{ "k": v }`, `["a", "b"]`. */
function fmt(v) {
  if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
  if (isRecord(v)) {
    const ks = Object.keys(v);
    return ks.length === 0 ? '{}' : '{ ' + ks.map((k) => JSON.stringify(k) + ': ' + fmt(v[k])).join(', ') + ' }';
  }
  return JSON.stringify(v);
}
const serialize = (entries) => '[\n' + entries.map((e) => '  ' + fmt(e)).join(',\n') + '\n]\n';

function canonical(e) {
  const out = {};
  for (const k of KEY_ORDER) if (e[k] !== undefined) out[k] = e[k];
  for (const k of Object.keys(e)) if (!(k in out)) out[k] = e[k];
  return out;
}

// --- base -------------------------------------------------------------------------------------

let baseText;
try {
  baseText = execSync('git show HEAD:data/ingredients.json', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch {
  console.error('merge: could not read data/ingredients.json from HEAD (git). Aborting.');
  process.exit(1);
}
const base = JSON.parse(baseText);
const baseIds = new Set(base.map((e) => e.id));

/** Remove names ('nl:x' / 'en:x') from an entry's `many` and aliases; returns the removed specs. */
function dropNames(e, specs) {
  const removed = [];
  for (const spec of specs) {
    const [lang, ...rest] = spec.split(':');
    const name = rest.join(':');
    const k = normalizeKey(name);
    let hit = false;
    if (e[lang]?.many !== undefined && normalizeKey(e[lang].many) === k) {
      e[lang] = { ...e[lang] };
      delete e[lang].many;
      hit = true;
    }
    if (e.aliases?.[lang]) {
      const keep = e.aliases[lang].filter((a) => normalizeKey(a) !== k);
      if (keep.length !== e.aliases[lang].length) hit = true;
      e.aliases = { ...e.aliases, [lang]: keep };
      if (keep.length === 0) delete e.aliases[lang];
      if (Object.keys(e.aliases).length === 0) delete e.aliases;
    }
    if (hit) removed.push(spec);
  }
  return removed;
}

const baseNameDrops = [];
for (const [id, specs] of Object.entries(BASE_DROP_NAMES)) {
  const e = base.find((x) => x.id === id);
  if (!e) {
    console.error(`merge: BASE_DROP_NAMES names unknown id "${id}". Aborting.`);
    process.exit(1);
  }
  for (const spec of dropNames(e, specs)) baseNameDrops.push(`[base] ${id}: ${spec.replace(':', ' name "')}" removed`);
}

const units = readJson(join(ROOT, 'data', 'units.json'));
const aisles = new Set(readJson(join(ROOT, 'data', 'aisles.json')).map((a) => a.id));
const unitIds = new Set(units.map((u) => u.id));
const qualifiers = readJson(join(ROOT, 'data', 'qualifiers.json'));
const qualWords = new Set(qualifiers.flatMap((q) => q.nl.map((w) => normalizeKey(w))));
const unitWordsNl = new Set(units.flatMap((u) => [u.nl.one, u.nl.many, u.nl.long, ...(u.aliases?.nl ?? [])].filter(Boolean).map((w) => normalizeKey(w))));
const unitOrPiece = (v) => typeof v === 'string' && (v === 'stuk' || unitIds.has(v));

// --- slices -----------------------------------------------------------------------------------

const sliceFiles = readdirSync(HERE).filter((f) => /^slice-.*\.json$/.test(f)).sort();
const incoming = [];
for (const f of sliceFiles) {
  const arr = readJson(join(HERE, f));
  if (!Array.isArray(arr)) {
    console.error(`merge: ${f} is not a JSON array. Aborting.`);
    process.exit(1);
  }
  for (const e of arr) incoming.push({ file: f.replace(/^slice-|\.json$/g, ''), entry: structuredClone(e) });
}
for (const e of ADD) incoming.push({ file: 'integrator', entry: structuredClone(e) });
// Ids this script may write: slice ids, renamed ids and added ids.
const sliceIds = new Set([...incoming.map((x) => x.entry?.id), ...Object.values(PATCH).map((p) => p.id).filter(Boolean)]);

// Refuse to clobber foreign edits: the working tree minus slice ids must equal HEAD.
{
  const current = readJson(TARGET);
  const foreign = serialize(current.filter((e) => !sliceIds.has(e.id) || baseIds.has(e.id)));
  if (foreign !== baseText && foreign !== serialize(base)) {
    console.error('merge: data/ingredients.json has edits that are not from this script (it differs from HEAD outside the slice ids). Commit or revert them first.');
    process.exit(1);
  }
}

// --- validation ---------------------------------------------------------------------------------

function problems(e) {
  const p = [];
  if (!isRecord(e)) return ['not an object'];
  if (typeof e.id !== 'string' || !ID_RE.test(e.id)) p.push(`id ${JSON.stringify(e.id)} is not a slug`);
  if (!hasName(e.nl)) p.push('nl.one missing');
  if (!hasName(e.en)) p.push('en.one missing');
  for (const lang of ['nl', 'en']) if (isRecord(e[lang]) && e[lang].many !== undefined && (typeof e[lang].many !== 'string' || !e[lang].many.trim())) p.push(`${lang}.many is not a string`);
  if (typeof e.aisle !== 'string' || !aisles.has(e.aisle)) p.push(`aisle ${JSON.stringify(e.aisle)} unknown`);
  if (e.defaultUnit !== null && !unitOrPiece(e.defaultUnit)) p.push(`defaultUnit ${JSON.stringify(e.defaultUnit)} unknown`);
  if (e.buyUnit !== undefined && !unitOrPiece(e.buyUnit)) p.push(`buyUnit ${JSON.stringify(e.buyUnit)} unknown`);
  if (e.gramsPer !== undefined) {
    if (!isRecord(e.gramsPer)) p.push('gramsPer not an object');
    else for (const [k, v] of Object.entries(e.gramsPer)) if (!unitOrPiece(k) || typeof v !== 'number' || !(v > 0)) p.push(`gramsPer.${k} invalid`);
  }
  for (const k of ['staple', 'veg', 'vegan', 'gluten']) if (typeof e[k] !== 'boolean') p.push(`${k} must be a boolean`);
  for (const k of ['glutenUnsure', 'perishable']) if (e[k] !== undefined && typeof e[k] !== 'boolean') p.push(`${k} must be a boolean`);
  if (e.gluten === true && e.glutenUnsure === true) p.push('gluten true + glutenUnsure');
  if (e.vegan === true && e.veg === false) p.push('vegan true but veg false');
  if (e.gloss !== undefined && (!isRecord(e.gloss) || typeof e.gloss.en !== 'string')) p.push('gloss must be { en }');
  if (e.cut !== undefined && e.cut !== 'slice' && e.cut !== 'chop') p.push('cut must be slice | chop');
  if (e.unitNames !== undefined) {
    if (!isRecord(e.unitNames)) p.push('unitNames not an object');
    else for (const [u, n] of Object.entries(e.unitNames)) {
      if (!unitOrPiece(u)) p.push(`unitNames.${u} unknown unit`);
      if (!isRecord(n) || !['nl', 'en'].some((l) => hasName(n[l])) || ['nl', 'en'].some((l) => n[l] !== undefined && !hasName(n[l]))) p.push(`unitNames.${u} shape`);
    }
  }
  const a = e.aliases;
  if (a !== undefined && (!isRecord(a) || (a.nl !== undefined && !isStringArray(a.nl)) || (a.en !== undefined && !isStringArray(a.en)))) p.push('aliases shape');
  const known = new Set(KEY_ORDER);
  for (const k of Object.keys(e)) if (!known.has(k)) p.push(`unknown field ${k}`);
  return p;
}

// --- claims -----------------------------------------------------------------------------------

const nlOwner = new Map(); // normalized Dutch key -> id
const enOwner = new Map(); // normalized English key -> id
const idKey = new Map(); // id (last-resort Dutch key) -> id
const namesOf = (e, lang) => {
  const out = [];
  for (const k of ['one', 'many']) if (typeof e[lang]?.[k] === 'string') out.push({ field: k, name: e[lang][k] });
  for (const n of e.aliases?.[lang] ?? []) out.push({ field: 'alias', name: n });
  return out;
};
for (const e of base) {
  for (const { name } of namesOf(e, 'nl')) if (!nlOwner.has(normalizeKey(name))) nlOwner.set(normalizeKey(name), e.id);
  for (const { name } of namesOf(e, 'en')) if (!enOwner.has(normalizeKey(name))) enOwner.set(normalizeKey(name), e.id);
  idKey.set(e.id, e.id);
}
const baseNlOwner = new Map(nlOwner);

// --- merge ------------------------------------------------------------------------------------

const accepted = [];
const dropped = [];
const nameDrops = [];
const notes = [];
const takenIds = new Set(baseIds);

const patchLog = [];
for (const { file, entry: raw } of incoming) {
  const sliceId = raw?.id;
  if (typeof sliceId === 'string' && DROP[sliceId]) {
    dropped.push(`[${file}] ${sliceId}: integrator drop — ${DROP[sliceId]}`);
    continue;
  }
  let e = raw;
  if (typeof sliceId === 'string' && PATCH[sliceId]) {
    const patch = PATCH[sliceId];
    e = { ...e, ...patch };
    if (patch.aliases) e.aliases = { ...raw.aliases, ...patch.aliases };
    for (const k of Object.keys(patch)) if (patch[k] === null && k !== 'defaultUnit') delete e[k];
    patchLog.push(`[${file}] ${sliceId}: patched ${JSON.stringify(patch)}`);
  }
  if (typeof sliceId === 'string' && DROP_NAMES[sliceId]) {
    const removed = dropNames(e, DROP_NAMES[sliceId]);
    for (const spec of DROP_NAMES[sliceId]) {
      if (removed.includes(spec)) nameDrops.push(`[${file}] ${sliceId}: integrator drop of ${spec.replace(':', ' name "')}"`);
      else nameDrops.push(`[${file}] ${sliceId}: DROP_NAMES ${spec} matched nothing (stale decision?)`);
    }
  }
  const id = e?.id;
  const where = `[${file}] ${id}`;
  const bad = problems(e);
  if (bad.length) {
    dropped.push(`${where}: invalid — ${bad.join('; ')}`);
    continue;
  }
  if (takenIds.has(id)) {
    dropped.push(`${where}: id already ${baseIds.has(id) ? 'in data/ingredients.json' : 'taken by an earlier slice'}`);
    continue;
  }

  // Dutch side: one/many clash -> drop the entry; alias clash -> drop the alias.
  const ownNl = new Set();
  let fatal = null;
  for (const { field, name } of namesOf(e, 'nl')) {
    const k = normalizeKey(name);
    const owner = nlOwner.get(k) ?? (idKey.has(k) && idKey.get(k) !== id ? idKey.get(k) : undefined);
    if (owner !== undefined && owner !== id) {
      if (field !== 'alias') {
        fatal = `Dutch ${field} "${name}" is already claimed by "${owner}"`;
        break;
      }
    }
    ownNl.add(k);
  }
  // The id as a Dutch key must not shadow someone else's name.
  if (!fatal && nlOwner.has(id) && nlOwner.get(id) !== id && !ownNl.has(id)) fatal = `id "${id}" equals a Dutch name of "${nlOwner.get(id)}"`;
  // English side: one/many clash -> drop the entry.
  if (!fatal) {
    for (const { field, name } of namesOf(e, 'en')) {
      if (field === 'alias') continue;
      const owner = enOwner.get(normalizeKey(name));
      if (owner !== undefined && owner !== id) {
        fatal = `English ${field} "${name}" is already claimed by "${owner}"`;
        break;
      }
    }
  }
  if (fatal) {
    dropped.push(`${where}: ${fatal}`);
    continue;
  }

  // Aliases: drop the clashing ones and same-entry repeats.
  const out = canonical(e);
  if (out.aliases) {
    const aliases = {};
    for (const lang of ['nl', 'en']) {
      if (!out.aliases[lang]) continue;
      const owners = lang === 'nl' ? nlOwner : enOwner;
      const seen = new Set([out[lang].one, out[lang].many].filter(Boolean).map((n) => normalizeKey(n)));
      const keep = [];
      for (const a of out.aliases[lang]) {
        const k = normalizeKey(a);
        if (!k || seen.has(k)) continue; // repeat inside the entry: no meaning, no claim
        const owner = owners.get(k) ?? (lang === 'nl' && idKey.has(k) && idKey.get(k) !== id ? idKey.get(k) : undefined);
        if (owner !== undefined && owner !== id) {
          nameDrops.push(`${where}: ${lang} alias "${a}" dropped (claimed by "${owner}")`);
          continue;
        }
        seen.add(k);
        keep.push(a);
      }
      if (keep.length) aliases[lang] = keep;
    }
    if (Object.keys(aliases).length) out.aliases = aliases;
    else delete out.aliases;
  }

  // Claim.
  for (const { name } of namesOf(out, 'nl')) nlOwner.set(normalizeKey(name), id);
  for (const { name } of namesOf(out, 'en')) enOwner.set(normalizeKey(name), id);
  idKey.set(id, id);
  takenIds.add(id);
  accepted.push({ file, entry: canonical(out) });
}

// --- review notes (no effect) -------------------------------------------------------------------

for (const { file, entry: e } of accepted) {
  for (const { name } of namesOf(e, 'nl')) {
    const k = normalizeKey(name);
    const words = k.split(' ');
    if (unitWordsNl.has(k)) notes.push(`[${file}] ${e.id}: Dutch name "${name}" is also a unit word`);
    if (qualWords.has(k)) notes.push(`[${file}] ${e.id}: Dutch name "${name}" is also a qualifier word`);
    for (const n of [1, 2]) {
      if (words.length <= n) continue;
      const head = words.slice(0, n).join(' ');
      const rest = words.slice(n).join(' ');
      if (qualWords.has(head) && baseNlOwner.has(rest)) notes.push(`[${file}] ${e.id}: "${name}" = qualifier "${head}" + existing "${baseNlOwner.get(rest)}"`);
    }
  }
}

// --- write ------------------------------------------------------------------------------------

const merged = [...base, ...accepted.map((x) => x.entry)].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const perFile = new Map();
for (const { file } of accepted) perFile.set(file, (perFile.get(file) ?? 0) + 1);

log(`base: ${base.length} entries (HEAD); slices: ${sliceFiles.length} files, ${incoming.length - ADD.length} entries; integrator ADD: ${ADD.length}`);
log(`accepted: ${accepted.length}; dropped entries: ${dropped.length}; dropped names: ${nameDrops.length}; result: ${merged.length} entries`);
for (const [f, n] of perFile) log(`  ${f}: ${n}`);
log('');
log(`## Integrator patches (${patchLog.length})`);
for (const p of patchLog) log(p);
log('');
log(`## Names taken from existing entries (${baseNameDrops.length})`);
for (const d of baseNameDrops) log(d);
log('');
log(`## Dropped entries (${dropped.length})`);
for (const d of dropped) log(d);
log('');
log(`## Dropped names (${nameDrops.length})`);
for (const d of nameDrops) log(d);
log('');
log(`## Review notes (${notes.length}, no effect)`);
for (const n of notes) log(n);

const report = lines.join('\n') + '\n';
if (LOG_FILE) writeFileSync(LOG_FILE, report, 'utf8');
console.log(LOG_FILE ? lines.slice(0, 3 + perFile.size).join('\n') + `\n(full log: ${LOG_FILE})` : report);
if (!DRY) {
  writeFileSync(TARGET, serialize(merged), 'utf8');
  console.log(`wrote data/ingredients.json (${merged.length} entries)`);
} else {
  console.log('dry run: nothing written');
}
