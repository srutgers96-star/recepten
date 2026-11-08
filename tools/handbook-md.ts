// tools/handbook-md.ts — writes the handbook as Markdown (docs/specs/handbook.md §1 and §3, block Z):
// docs/HANDLEIDING.md (nl) and docs/HANDBOOK.md (en), from the same data as the in-app handbook
// (data/handbook/*.json, src/domain/handbook.ts `handbookToMarkdown`). Run it after every change to
// the texts and commit both files; `npm run validate:data` warns when they are older than the data.
//
// Run:   node --experimental-strip-types tools/handbook-md.ts
// Exit:  1 when data/handbook holds no topic file or a file is not valid JSON, 0 otherwise.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { handbookToMarkdown, normalizeHandbook, type HandbookSection } from '../src/domain/handbook.ts';

/** The topic files of `<root>/data/handbook`, parsed and normalised (sorted by `order`). */
export function readHandbook(root: string): HandbookSection[] {
  const dir = join(root, 'data', 'handbook');
  if (!existsSync(dir)) return [];
  const raw = readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')) as unknown);
  return normalizeHandbook(raw);
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  let sections: HandbookSection[];
  try {
    sections = readHandbook(root);
  } catch (e) {
    console.error(`data/handbook: ${String(e)}`);
    process.exit(1);
  }
  if (sections.length === 0) {
    console.error('data/handbook: no topic files found; nothing written.');
    process.exit(1);
  }
  const rows = sections.reduce((n, s) => n + s.entries.length, 0);
  for (const [file, lang] of [
    ['docs/HANDLEIDING.md', 'nl'],
    ['docs/HANDBOOK.md', 'en'],
  ] as const) {
    writeFileSync(join(root, file), handbookToMarkdown(sections, lang), 'utf8');
    console.log(`${file}: ${sections.length} topics, ${rows} rows`);
  }
}

const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
