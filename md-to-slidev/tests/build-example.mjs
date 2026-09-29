#!/usr/bin/env node
// Regression test for the bundled Slidev parts: copies assets/slidev/* and the example deck (plus
// tests/parts-gallery.md, which exercises every component and md-toc) into a temp project, runs static
// checks on the parts and on the example's writing rules, then installs Slidev and builds.
// Run: node md-to-slidev/tests/build-example.mjs          (set SKIP_BUILD=1 to run only the static checks)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parts = path.join(skill, 'assets/slidev');
const example = path.join(skill, 'assets/example');
let bad = 0;
function check(name, ok, detail = '') {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     ${detail}`}`);
}

const slides = fs.readFileSync(path.join(example, 'slides.md'), 'utf8');
const gallery = fs.readFileSync(path.join(skill, 'tests/parts-gallery.md'), 'utf8');
const deck = `${slides.trimEnd()}\n${gallery}`;
const layouts = fs.readdirSync(path.join(parts, 'layouts')).map((f) => f.replace(/\.vue$/, ''));
const components = fs.readdirSync(path.join(parts, 'components')).map((f) => f.replace(/\.vue$/, ''));
const internal = ['MdSide'];

// 1. layouts: the example uses only bundled ones; every bundled one is exercised (md-toc only by the gallery)
const layoutsIn = (text) => [...new Set([...text.matchAll(/^layout:\s*(\S+)/gm)].map((m) => m[1]))];
check('example uses only bundled layouts', layoutsIn(slides).every((l) => layouts.includes(l)), layoutsIn(slides).filter((l) => !layouts.includes(l)).join(','));
check('every bundled layout except md-toc appears in the example', layouts.filter((l) => l !== 'md-toc').every((l) => layoutsIn(slides).includes(l)), layouts.filter((l) => l !== 'md-toc' && !layoutsIn(slides).includes(l)).join(','));
check('every bundled layout is built', layouts.every((l) => layoutsIn(deck).includes(l)), layouts.filter((l) => !layoutsIn(deck).includes(l)).join(','));

// 2. components: only bundled ones are used, and every public one is built
const usedComponents = [...new Set([...deck.matchAll(/<([A-Z][A-Za-z]+)[\s/>]/g)].map((m) => m[1]))];
check('deck uses only bundled components', usedComponents.every((c) => components.includes(c)), usedComponents.filter((c) => !components.includes(c)).join(','));
const unbuilt = components.filter((c) => !internal.includes(c) && !usedComponents.includes(c));
check('every bundled component is built', unbuilt.length === 0, unbuilt.join(','));

// 3. the design contract: no ad-hoc styling in slides.md, no font size below 18px in the parts
check('slides.md has no <style>, style= or size/color classes', !/<style|style=|font-size|\btext-(xs|sm|base|lg|xl)|color:/.test(deck));
for (const f of fs.readdirSync(path.join(parts, 'components')).concat(fs.readdirSync(path.join(parts, 'layouts')).map((x) => `../layouts/${x}`))) {
  const text = fs.readFileSync(path.join(parts, 'components', f), 'utf8');
  const small = [...text.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])).filter((n) => n < 18);
  check(`${path.basename(f)} has no font-size below 18px`, small.length === 0, small.join(','));
}
const css = fs.readFileSync(path.join(parts, 'style.css'), 'utf8');
check('style.css defines the palette and the 22px text minimum', /--md-fg:\s*#1d1f20/i.test(css) && /--md-size-note:\s*22px/.test(css) && /--md-side-width:\s*440px/.test(css));
check('style.css has no shadow or gradient', !/box-shadow|gradient\(/.test(css));
check('md-section and MdSide share composables/chapters.ts', fs.existsSync(path.join(parts, 'composables/chapters.ts')));

// 4. the example follows the writing rules (references/writing.md)
const frontmatters = [...slides.matchAll(/^---\n([\s\S]*?)\n---/gm)].map((m) => m[1]);
const bodySlides = frontmatters.filter((f) => /^layout:\s*md-(standard|shots|stack|wide)/m.test(f));
for (const f of bodySlides) {
  const title = (f.match(/^title:\s*(.+)$/m) || [])[1] || '';
  check(`title is a topic name: ${title}`, title.length <= 20 && !/[。、]/.test(title), title);
  const block = f.match(/^conclusion:\s*\|-\n((?:  .*\n?|\n)+)/m);
  check(`conclusion is a |- block: ${title}`, !!block);
  if (block) {
    const lines = block[1].split('\n').map((l) => l.trim()).filter(Boolean);
    const width = (l) => [...l].reduce((w, ch) => w + (/[ -~]/.test(ch) ? 0.5 : 1), 0); // full-width = 1, ASCII = 0.5
    const long = lines.filter((l) => width(l) > 13);
    check(`conclusion lines are ~12 chars: ${title}`, long.length === 0 && lines.length >= 2 && lines.length <= 5, long.join(' | '));
  }
}
check('no speaker-note timing in the example', !/想定時間/.test(slides));

// 5. documentation references every component and layout
const docs = fs.readFileSync(path.join(skill, 'references/components.md'), 'utf8');
for (const c of components.filter((c) => !internal.includes(c))) check(`components.md documents ${c}`, docs.includes(`### ${c}`) || docs.includes(`\`${c}\``));
for (const l of layouts) check(`components.md documents ${l}`, docs.includes(`\`${l}\``));

if (process.env.SKIP_BUILD) {
  console.log(bad ? `${bad} problem(s)` : 'ok (static checks only)');
  process.exit(bad ? 1 : 0);
}

// 6. install and build in a temp project
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'md-to-slidev-'));
const copy = (src, dst) => fs.cpSync(src, dst, { recursive: true });
for (const d of ['layouts', 'components', 'composables', 'style.css', 'package.json']) copy(path.join(parts, d), path.join(work, d));
fs.writeFileSync(path.join(work, 'slides.md'), deck);

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args) => spawnSync(cmd, args, { cwd: work, encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000 });

const install = run(npm, ['install', '--no-audit', '--no-fund', '--loglevel=error']);
check('npm install succeeds', install.status === 0, (install.stderr || '').slice(-2000));
if (install.status === 0) {
  const build = run(npx, ['slidev', 'build', '--out', 'dist']);
  const built = build.status === 0 && fs.existsSync(path.join(work, 'dist/index.html'));
  check('slidev build succeeds', built, ((build.stdout || '') + (build.stderr || '')).slice(-3000));
}
fs.rmSync(work, { recursive: true, force: true });

console.log(bad ? `${bad} problem(s)` : 'ok');
process.exit(bad ? 1 : 0);
