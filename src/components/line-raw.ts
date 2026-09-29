// The raw text of a structured line in the app's own notation (editor chips → raw, invariant 2).
// Framework-free so it can be tested in Node; used by LineChips / EditScreen.
import type { Dictionary } from '@/domain/dictionary';
import type { Lang, Line } from '@/domain/model';
import { formatQty, renderLineParts, unitName } from '@/domain/render';

/** The stored quantity as typed text ("½", "2-3", "ca. 400") for the chip editor's amount field. */
export function seedQty(line: Line, lang: Lang): string {
  return line.qty ? formatQty(line.qty.min, line.qty.max, lang, line.qty.approx === true) : '';
}

/**
 * "2 el olijfolie [fijngehakt] (ontdooid) naar smaak": prep in [brackets], a free note in
 * (parentheses), "naar smaak" / "(optioneel)" / "(garnering)" at the end — so that parsing the
 * text back yields the same structure. Headers return their raw text.
 *
 * The quantity and unit are written as stored (`line.qty`, `line.unit`), never through the
 * display conversion of `renderLineParts` (½ l stays "½ l", not "500 ml"; dl stays "dl" in
 * English): the raw text is the source of truth and a chip edit must not re-unit the line.
 */
export function rawFromLine(line: Line, dict: Dictionary, lang: Lang): string {
  if (line.kind === 'header') return line.raw[lang] ?? line.raw[lang === 'nl' ? 'en' : 'nl'] ?? '';
  const p = renderLineParts(line, dict, lang, 1);
  const qty = seedQty(line, lang);
  const unitDef = line.unit ? dict.unit(line.unit) : undefined;
  const unit = unitDef ? unitName(unitDef, lang, line.qty) : '';
  const toTaste = !!line.note && line.note.nl === 'naar smaak';
  let s = [p.part, qty, unit, p.name, p.packSize ? `(${p.packSize})` : '', p.alt].filter(Boolean).join(' ');
  if (p.prep) s += ` [${p.prep}]`;
  if (p.note && !toTaste) s += ` (${p.note})`;
  if (toTaste) s += lang === 'nl' ? ' naar smaak' : ' to taste';
  if (p.optional) s += ` ${p.optional}`;
  return s.replace(/\s+/g, ' ').trim();
}
