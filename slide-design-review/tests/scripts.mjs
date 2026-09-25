#!/usr/bin/env node
// Regression tests for the slide-design-review scripts.
//   1. Without a browser: the PNG decoder and pixel comparison (synthetic PNGs using every row filter),
//      compare-renders.mjs, snapshot.mjs save/diff/restore, and render.mjs's exit codes for broken setups.
//   2. With a browser (skipped when SKIP_RENDER=1): copies md-to-slidev's bundled parts and example deck into a
//      temp project, installs Slidev and playwright-chromium, renders every page, checks size and determinism,
//      edits one slide and checks that exactly that page is reported as changed.
// Run: node slide-design-review/tests/scripts.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { comparePng, decodePng } from '../scripts/lib.mjs';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(skill, '..');
const scripts = path.join(skill, 'scripts');
let bad = 0;
function check(name, ok, detail = '') {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     ${detail}`}`);
}
const node = (script, args, opts = {}) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8', ...opts });
const tmpDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// ---------- 1a. PNG decoding and comparison ----------

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}
// Encode an RGB image, cycling through filter types 0..4 by row so the decoder's unfiltering is exercised.
function encodePng(width, height, pixel) {
  const bpp = 3, stride = width * bpp;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * stride + x * bpp);
  const out = [];
  for (let y = 0; y < height; y++) {
    const f = y % 5;
    const row = raw.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? raw.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const line = Buffer.alloc(stride + 1); line[0] = f;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let pred = 0;
      if (f === 1) pred = a; else if (f === 2) pred = b; else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x + 1] = (row[x] - pred) & 0xff;
    }
    out.push(line);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(out))), chunk('IEND', Buffer.alloc(0))]);
}

const gradient = (x, y) => [(x * 7 + y * 3) & 0xff, (x * 13) & 0xff, (y * 11) & 0xff];
const base = encodePng(40, 30, gradient);
const decoded = decodePng(base);
check('decodePng reads size', decoded && decoded.width === 40 && decoded.height === 30);
check('decodePng unfilters every row filter', decoded && [0, 1, 2, 3, 4, 7, 29].every((y) => {
  const i = (y * 40 + 17) * 3;
  return gradient(17, y).every((v, c) => decoded.data[i + c] === v);
}));
check('comparePng: identical bytes are the same', comparePng(base, Buffer.from(base)).status === 'same');
const edited = encodePng(40, 30, (x, y) => (x >= 10 && x < 14 && y >= 5 && y < 8 ? [255, 0, 0] : gradient(x, y)));
const diff = comparePng(base, edited);
check('comparePng: finds the changed rectangle', diff.status === 'changed' && diff.bbox && diff.bbox.x === 10 && diff.bbox.y === 5 && diff.bbox.w === 4 && diff.bbox.h === 3, JSON.stringify(diff));
check('comparePng: reports the changed ratio', diff.ratio && Math.abs(diff.ratio - 12 / 1200) < 1e-9, JSON.stringify(diff));
const resized = comparePng(base, encodePng(41, 30, gradient));
check('comparePng: size change is a change', resized.status === 'changed' && /寸法/.test(resized.note || ''));

// ---------- 1b. compare-renders.mjs ----------
{
  const a = tmpDir('sdr-a-'), b = tmpDir('sdr-b-');
  fs.writeFileSync(path.join(a, 'page-01.png'), base); fs.writeFileSync(path.join(b, 'page-01.png'), base);
  fs.writeFileSync(path.join(a, 'page-02.png'), base); fs.writeFileSync(path.join(b, 'page-02.png'), edited);
  fs.writeFileSync(path.join(a, 'page-03.png'), base);
  fs.writeFileSync(path.join(b, 'page-04.png'), base);
  const r = node('compare-renders.mjs', [a, b, '--json']);
  const res = r.status === 0 ? JSON.parse(r.stdout) : [];
  const st = Object.fromEntries(res.map((x) => [x.page, x.status]));
  check('compare-renders: same / changed / removed / added', st[1] === 'same' && st[2] === 'changed' && st[3] === 'removed' && st[4] === 'added', r.stdout + r.stderr);
  const text = node('compare-renders.mjs', [a, b]).stdout;
  check('compare-renders: text summary lists changed pages', /changed: 2,3,4/.test(text), text);
  check('compare-renders: missing folder is a usage error', node('compare-renders.mjs', [a, path.join(b, 'nope')]).status === 1);
  fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true });
}

// ---------- 1c. snapshot.mjs ----------
{
  const root = tmpDir('sdr-proj-'), snap = path.join(tmpDir('sdr-snap-'), 's');
  const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); };
  w('slides.md', '# a\n\nline\n'); w('style.css', ':root{}\n'); w('components/Box.vue', '<template/>\n');
  w('node_modules/x/index.js', 'x'); w('design-review/page-01/log.md', 'log');
  check('snapshot save', node('snapshot.mjs', ['save', root, snap]).status === 0);
  const saved = JSON.parse(fs.readFileSync(path.join(snap, 'manifest.json'), 'utf8')).files;
  check('snapshot skips node_modules and design-review', Object.keys(saved).sort().join(',') === 'components/Box.vue,slides.md,style.css', Object.keys(saved).join(','));
  w('slides.md', '# b\n\nline\n'); w('layouts/new.vue', '<template/>\n'); fs.rmSync(path.join(root, 'style.css'));
  w('design-review/page-01/review-1.md', 'review'); // written during the loop; must survive a restore
  const d = node('snapshot.mjs', ['diff', root, snap]).stdout;
  const hasGit = spawnSync('git', ['--version']).status === 0;
  check('snapshot diff lists added and deleted files', /added: layouts\/new\.vue/.test(d) && /deleted: style\.css/.test(d), d);
  if (hasGit) check('snapshot diff shows a normal patch header', /^diff --git a\/slides\.md b\/slides\.md$/m.test(d) && /^-# a$/m.test(d) && /^\+# b$/m.test(d), d);
  check('snapshot restore', node('snapshot.mjs', ['restore', root, snap]).status === 0);
  check('restore brings back modified and deleted files', fs.readFileSync(path.join(root, 'slides.md'), 'utf8') === '# a\n\nline\n' && fs.existsSync(path.join(root, 'style.css')));
  check('restore moves files created after the save aside', !fs.existsSync(path.join(root, 'layouts/new.vue')) && fs.existsSync(path.join(snap, 'removed/layouts/new.vue')));
  check('restore leaves design-review and node_modules alone', fs.existsSync(path.join(root, 'design-review/page-01/review-1.md')) && fs.existsSync(path.join(root, 'node_modules/x/index.js')));
  check('after restore, diff reports no changes', /no changes/.test(node('snapshot.mjs', ['diff', root, snap]).stdout));
  check('snapshot: unknown command is a usage error', node('snapshot.mjs', ['nope', root, snap]).status === 1);
  fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(path.dirname(snap), { recursive: true, force: true });
}

// ---------- 1d. render.mjs exit codes without Slidev ----------
{
  const root = tmpDir('sdr-noslidev-');
  fs.writeFileSync(path.join(root, 'slides.md'), '# hi\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"x","dependencies":{}}');
  check('render: not a Slidev project -> exit 2', node('render.mjs', ['--deck', path.join(root, 'slides.md'), '--list']).status === 2);
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"x","dependencies":{"@slidev/cli":"^53.0.0"}}');
  const r = node('render.mjs', ['--deck', path.join(root, 'slides.md'), '--list']);
  check('render: Slidev declared but not installed -> exit 2', r.status === 2 && /install/.test(r.stderr), r.stderr);
  check('render: missing deck -> exit 1', node('render.mjs', ['--deck', path.join(root, 'none.md'), '--list']).status === 1);
  fs.rmSync(root, { recursive: true, force: true });
}

if (process.env.SKIP_RENDER) {
  console.log(bad ? `${bad} problem(s)` : 'ok (without rendering)');
  process.exit(bad ? 1 : 0);
}

// ---------- 2. real rendering with the md-to-slidev example ----------
const parts = path.join(repo, 'md-to-slidev/assets/slidev');
const example = path.join(repo, 'md-to-slidev/assets/example/slides.md');
const work = tmpDir('sdr-deck-');
for (const f of ['layouts', 'components', 'style.css', 'package.json']) fs.cpSync(path.join(parts, f), path.join(work, f), { recursive: true });
fs.copyFileSync(example, path.join(work, 'slides.md'));

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, args) => spawnSync(cmd, args, { cwd: work, encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000 });
const install = run(npm, ['install', '--no-audit', '--no-fund', '--loglevel=error']);
check('npm install succeeds', install.status === 0, (install.stderr || '').slice(-2000));
const deck = path.join(work, 'slides.md');

if (install.status === 0) {
  const list = node('render.mjs', ['--deck', deck, '--list']);
  const map = list.status === 0 ? JSON.parse(list.stdout) : null;
  check('--list maps every page (13) without a browser', map && map.total === 13, list.stderr);
  const p7 = map?.pages[6];
  const lines = fs.readFileSync(deck, 'utf8').split('\n');
  check('page 7 maps to its own slide in slides.md', p7 && lines[p7.startLine - 1] === '---' && lines.slice(p7.startLine, p7.endLine).some((l) => l.startsWith('title: 自動化は')), JSON.stringify(p7));

  const noPw = node('render.mjs', ['--deck', deck, '--out', path.join(work, 'x')]);
  if (noPw.status === 3) check('render without playwright-chromium -> exit 3 with install hint', /playwright-chromium/.test(noPw.stderr));

  const pw = run(npm, ['install', '-D', 'playwright-chromium', '--no-audit', '--no-fund', '--loglevel=error']);
  check('playwright-chromium installs', pw.status === 0, (pw.stderr || '').slice(-2000));

  const out1 = path.join(work, 'design-review/.renders/a');
  const r1 = node('render.mjs', ['--deck', deck, '--out', out1], { timeout: 10 * 60 * 1000 });
  check('render all pages', r1.status === 0, (r1.stdout + r1.stderr).slice(-3000));
  const pngs = fs.existsSync(out1) ? fs.readdirSync(out1).filter((f) => f.endsWith('.png')) : [];
  check('13 page-NN.png files and pages.json', pngs.length === 13 && pngs.includes('page-07.png') && fs.existsSync(path.join(out1, 'pages.json')), pngs.join(','));
  if (pngs.includes('page-07.png')) {
    const img = decodePng(fs.readFileSync(path.join(out1, 'page-07.png')));
    check('PNG is canvas size (1920x1080)', img && img.width === 1920 && img.height === 1080, img && `${img.width}x${img.height}`);
  }

  const keep = path.join(out1, 'keep.txt');
  fs.writeFileSync(keep, 'x');
  const out2 = path.join(work, 'design-review/.renders/b');
  node('render.mjs', ['--deck', deck, '--out', out2]);
  const same = node('compare-renders.mjs', [out1, out2]).stdout;
  check('rendering the same source twice changes nothing', /changed: none/.test(same), same);

  node('render.mjs', ['--deck', deck, '--out', out1, '--pages', '7']);
  check('rendering into a folder keeps its other files', fs.existsSync(keep));

  fs.writeFileSync(deck, fs.readFileSync(deck, 'utf8').replace('title: 自動化は一度に全部やらず、3段階で広げる', 'title: 自動化は3段階で広げる'));
  const out3 = path.join(work, 'design-review/.renders/c');
  node('render.mjs', ['--deck', deck, '--out', out3]);
  const changed = node('compare-renders.mjs', [out2, out3]).stdout;
  check('editing one slide changes exactly that page', /changed: 7$/m.test(changed), changed);

  const range = node('render.mjs', ['--deck', deck, '--out', out3, '--pages', '99']);
  check('out-of-range page -> exit 1', range.status === 1 && /範囲外/.test(range.stderr), range.stderr);
}
fs.rmSync(work, { recursive: true, force: true });

console.log(bad ? `${bad} problem(s)` : 'ok');
process.exit(bad ? 1 : 0);
