#!/usr/bin/env node
// Render Slidev pages to PNG at canvas size through the official `slidev export --format png --scale 1`,
// and write a page map (page number -> source file and lines). The exporter needs playwright-chromium,
// resolved from the Slidev project or the global npm root, exactly as Slidev itself resolves it.
//
// Usage:
//   node render.mjs --deck slides.md --list                       # print the page map only (no browser)
//   node render.mjs --deck slides.md --out <dir> [--pages all]    # every page -> <dir>/page-NN.png + pages.json
//   node render.mjs --deck slides.md --out <dir> --pages 3-5,8    # some pages
// Exit codes: 0 ok, 1 usage or render failure, 2 not a Slidev project / not installed, 3 playwright-chromium missing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { die, findSlidevRoot, pageFile, resolveFrom } from './lib.mjs';

const { values: opt } = parseArgs({
  options: {
    deck: { type: 'string', default: 'slides.md' },
    out: { type: 'string' },
    pages: { type: 'string', default: 'all' },
    list: { type: 'boolean', default: false },
    timeout: { type: 'string', default: '60000' },
  },
});

const deck = path.resolve(opt.deck);
if (!fs.existsSync(deck)) die(`デッキが見つからない: ${deck}`, 1);
const root = findSlidevRoot(path.dirname(deck));
if (!root) die(`Slidev のプロジェクトではない: ${deck} から上に、dependencies に @slidev/cli を持つ package.json が無い`, 2);
const cliPkg = resolveFrom(root, '@slidev/cli/package.json');
if (!cliPkg) die(`@slidev/cli が入っていない。${root} で npm install（または使っているパッケージマネージャの install）を実行する`, 2);
const cliDir = path.dirname(cliPkg);
const cliVersion = JSON.parse(fs.readFileSync(cliPkg, 'utf8')).version;
const toPosix = (p) => p.split(path.sep).join('/');

// 1. Page map from Slidev's own parser. Hidden/disabled slides are already excluded, as in the exporter,
//    so page N here is page N in the rendered deck.
const parserPath = resolveFrom(cliDir, '@slidev/parser/fs');
if (!parserPath) die('@slidev/parser が見つからない（@slidev/cli の依存）。install をやり直す', 2);
const { load } = await import(pathToFileURL(parserPath).href);
const userRoot = path.dirname(deck);
const data = await load({ roots: [userRoot], userRoot }, deck);
const total = data.slides.length;
const pages = data.slides.map((s, i) => ({
  page: i + 1,
  file: toPosix(path.relative(root, s.source.filepath)),
  startLine: s.source.start + 1,
  endLine: s.source.end,
  layout: s.frontmatter?.layout ?? null,
  title: s.title ?? s.frontmatter?.title ?? null,
}));
const map = { deck: toPosix(path.relative(root, deck)), root: toPosix(root), slidev: cliVersion, total, pages };

if (opt.list) {
  console.log(JSON.stringify(map, null, 2));
  process.exit(0);
}
if (!opt.out) die('--out が要る（書き出し先のフォルダ）', 1);

// 2. Which pages.
let wanted;
if (opt.pages === 'all') wanted = pages.map((p) => p.page);
else {
  if (!/^[\d,\-\s]+$/.test(opt.pages)) die(`--pages の書式が不正: ${opt.pages}（例: 7、3-5,8、all）`, 1);
  wanted = [];
  for (const part of opt.pages.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.split('-').map(Number);
    for (let n = a; n <= (b || a); n++) wanted.push(n);
  }
  wanted = [...new Set(wanted)];
  const bad = wanted.filter((n) => n < 1 || n > total);
  if (bad.length) die(`ページ番号が範囲外: ${bad.join(',')}（このデッキは 1〜${total}）`, 1);
}

// 3. playwright-chromium, resolved the way Slidev's exporter resolves it.
if (!resolveFrom(root, 'playwright-chromium', { global: true })) {
  die([
    'playwright-chromium が見つからない。Slidev の PNG 書き出しに要る。どちらかで入れる:',
    `  プロジェクトに入れる:   cd "${root}" && npm i -D playwright-chromium`,
    '  グローバルに入れる:     npm i -g playwright-chromium',
  ].join('\n'), 3);
}

// 4. Export into a fresh temp dir: `slidev export` deletes its output directory before writing.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-render-'));
const args = [path.join(cliDir, 'bin/slidev.mjs'), 'export', path.relative(root, deck),
  '--format', 'png', '--scale', '1', '--output', tmp, '--timeout', opt.timeout, '--wait', '300'];
if (opt.pages !== 'all') args.push('--range', wanted.join(','));
const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 10 * 60 * 1000 });
const produced = fs.existsSync(tmp) ? fs.readdirSync(tmp).filter((f) => /^\d+\.png$/.test(f)) : [];
const missing = wanted.filter((n) => !produced.includes(`${n}.png`));
if (r.status !== 0 || missing.length) {
  fs.rmSync(tmp, { recursive: true, force: true });
  const log = ((r.stdout || '') + (r.stderr || '')).split('\n')
    .filter((l) => !/Failed to patch FloatingVue|^\s+at /.test(l)).slice(-40).join('\n');
  die(`書き出しに失敗した（exit ${r.status}${missing.length ? `、出なかったページ: ${missing.join(',')}` : ''}）。\n${log}`, 1);
}

// 5. Move into place as page-NN.png and write the page map next to them.
const out = path.resolve(opt.out);
fs.mkdirSync(out, { recursive: true });
for (const n of wanted) {
  const dst = path.join(out, pageFile(n, total));
  fs.rmSync(dst, { force: true });
  fs.copyFileSync(path.join(tmp, `${n}.png`), dst);
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'pages.json'), JSON.stringify(map, null, 2) + '\n');

for (const n of wanted) {
  const p = pages[n - 1];
  console.log(`page ${n} -> ${toPosix(path.join(out, pageFile(n, total)))}  (${p.file}:${p.startLine}-${p.endLine}${p.layout ? `, layout: ${p.layout}` : ''})`);
}
console.log(`ok: ${wanted.length} page(s), Slidev ${cliVersion}`);
