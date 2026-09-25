#!/usr/bin/env node
// Compare two render folders (page-NN.png written by render.mjs) pixel by pixel, and list which pages
// changed and where. Rendering the same source twice gives byte-identical PNGs, so a change here is real.
//
// Usage: node compare-renders.mjs <before-dir> <after-dir> [--json]
// Exit code 0 when both folders are readable (the result is in the output), 1 on usage errors.
import fs from 'node:fs';
import { comparePng, die, listPageFiles } from './lib.mjs';

const [before, after] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const asJson = process.argv.includes('--json');
if (!before || !after) die('使い方: node compare-renders.mjs <before-dir> <after-dir> [--json]');
for (const d of [before, after]) if (!fs.existsSync(d)) die(`フォルダが無い: ${d}`);

const a = listPageFiles(before);
const b = listPageFiles(after);
const all = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y);
const results = [];
for (const page of all) {
  if (!a.has(page)) results.push({ page, status: 'added' });
  else if (!b.has(page)) results.push({ page, status: 'removed' });
  else results.push({ page, ...comparePng(fs.readFileSync(a.get(page)), fs.readFileSync(b.get(page))) });
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    if (r.status === 'same') continue;
    const where = r.bbox
      ? `  ${(r.ratio * 100).toFixed(2)}% の画素、範囲 x=${r.bbox.x} y=${r.bbox.y} w=${r.bbox.w} h=${r.bbox.h}`
      : '';
    console.log(`page ${r.page}: ${r.status}${where}${r.note ? `  (${r.note})` : ''}`);
  }
  const changed = results.filter((r) => r.status !== 'same').map((r) => r.page);
  console.log(changed.length ? `changed: ${changed.join(',')}` : 'changed: none');
}
