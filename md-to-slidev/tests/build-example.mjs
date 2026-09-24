#!/usr/bin/env node
// Regression test for the bundled Slidev parts: copies assets/slidev/* and the example deck into a temp
// project, checks that every layout/component the example uses exists, then installs Slidev and builds.
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
const layouts = fs.readdirSync(path.join(parts, 'layouts')).map((f) => f.replace(/\.vue$/, ''));
const components = fs.readdirSync(path.join(parts, 'components')).map((f) => f.replace(/\.vue$/, ''));

// 1. every layout the example uses exists, and every bundled layout is exercised by the example
const usedLayouts = [...new Set([...slides.matchAll(/^layout:\s*(\S+)/gm)].map((m) => m[1]))];
check('example uses only bundled layouts', usedLayouts.every((l) => layouts.includes(l)), usedLayouts.filter((l) => !layouts.includes(l)).join(','));
check('every bundled layout appears in the example', layouts.every((l) => usedLayouts.includes(l)), layouts.filter((l) => !usedLayouts.includes(l)).join(','));

// 2. every component tag the example uses exists (tags are PascalCase; MdFooter is internal to layouts)
const usedComponents = [...new Set([...slides.matchAll(/<([A-Z][A-Za-z]+)[\s/>]/g)].map((m) => m[1]))];
check('example uses only bundled components', usedComponents.every((c) => components.includes(c)), usedComponents.filter((c) => !components.includes(c)).join(','));

// 3. the design contract: no ad-hoc styling in slides.md, no font size below 18px in the parts
check('slides.md has no <style> or inline size/color', !/<style|font-size|text-\w+|color:/.test(slides));
for (const f of fs.readdirSync(path.join(parts, 'components')).concat(fs.readdirSync(path.join(parts, 'layouts')).map((x) => `../layouts/${x}`))) {
  const text = fs.readFileSync(path.join(parts, 'components', f), 'utf8');
  const small = [...text.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])).filter((n) => n < 18);
  check(`${path.basename(f)} has no font-size below 18px`, small.length === 0, small.join(','));
}
const css = fs.readFileSync(path.join(parts, 'style.css'), 'utf8');
check('style.css defines the palette and the 18px minimum', /--md-fg:\s*#222222/.test(css) && /--md-size-note:\s*18px/.test(css));
check('style.css has no shadow or gradient', !/box-shadow|gradient\(/.test(css));

// 4. documentation references every component and layout
const docs = fs.readFileSync(path.join(skill, 'references/components.md'), 'utf8');
for (const c of components.filter((c) => c !== 'MdFooter')) check(`components.md documents ${c}`, docs.includes(`### ${c}`) || docs.includes(`\`${c}\``));
for (const l of layouts) check(`components.md documents ${l}`, docs.includes(`\`${l}\``));

if (process.env.SKIP_BUILD) {
  console.log(bad ? `${bad} problem(s)` : 'ok (static checks only)');
  process.exit(bad ? 1 : 0);
}

// 5. install and build in a temp project
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'md-to-slidev-'));
const copy = (src, dst) => fs.cpSync(src, dst, { recursive: true });
copy(path.join(parts, 'layouts'), path.join(work, 'layouts'));
copy(path.join(parts, 'components'), path.join(work, 'components'));
copy(path.join(parts, 'style.css'), path.join(work, 'style.css'));
copy(path.join(parts, 'package.json'), path.join(work, 'package.json'));
copy(path.join(example, 'slides.md'), path.join(work, 'slides.md'));

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
