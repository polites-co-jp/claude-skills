#!/usr/bin/env node
// Installs md2html into a project, or updates it. Safe to run again.
//  1. copies runtime/ to <root>/.claude/md2html/ (the project then needs nothing from the skill: the hook and
//     --check work for anyone who clones the repository)
//  2. writes .claude/md2html/config.json (srcDir / outDir) — an existing one is kept unless --src / --out is given
//  3. registers the PostToolUse hook in .claude/settings.json, replacing an older md2html entry
//  4. converts every md once (--all)
//
//   node <skill>/scripts/setup.mjs [--root <project>] [--src docs] [--out docs/html]
//
// Exit codes: 0 done / 1 nothing was written (bad arguments, missing srcDir, unreadable settings.json)
// / 2 installed, but the conversion reported broken links or failed
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(skill, 'runtime');

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail(`${name} needs a value`);
  return argv[i + 1];
};
function fail(msg) { console.error(`md2html setup: ${msg}`); process.exit(1); }

const root = path.resolve(opt('--root') || process.cwd());
const dest = path.join(root, '.claude', 'md2html');
const settingsPath = path.join(root, '.claude', 'settings.json');
const posix = (p) => p.split(path.sep).join('/');
const inside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
};

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) fail(`${root} is not a directory`);

// ---- decide everything before writing anything
let config = { srcDir: 'docs', outDir: 'docs/html' };
const configPath = path.join(dest, 'config.json');
if (fs.existsSync(configPath)) {
  try { config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; } catch (e) { fail(`${posix(path.relative(root, configPath))}: ${e.message}`); }
}
const src = opt('--src');
const out = opt('--out');
if (src) config.srcDir = posix(src).replace(/\/+$/, '');
if (out) config.outDir = posix(out).replace(/\/+$/, '');
const srcAbs = path.resolve(root, config.srcDir);
const outAbs = path.resolve(root, config.outDir);
if (!inside(root, srcAbs) || !inside(root, outAbs)) fail('srcDir and outDir must be inside the project');
if (srcAbs === outAbs) fail('srcDir and outDir must differ');
if (!fs.existsSync(srcAbs)) fail(`${config.srcDir}/ does not exist in ${root}`);

const HOOK_SCRIPT = '.claude/md2html/md2html.mjs';
const MATCHER = 'Write|Edit|MultiEdit';
const hook = { type: 'command', command: 'node', args: [`\${CLAUDE_PROJECT_DIR}/${HOOK_SCRIPT}`, '--hook'], timeout: 30 };

let settings = {};
let settingsText = null;
if (fs.existsSync(settingsPath)) {
  settingsText = fs.readFileSync(settingsPath, 'utf8');
  try { settings = JSON.parse(settingsText); } catch (e) { fail(`.claude/settings.json is not valid JSON, left untouched (${e.message})`); }
}
const isOurs = (h) => JSON.stringify(h).includes(HOOK_SCRIPT);
settings.hooks = settings.hooks || {};
const groups = settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];
const mine = groups.findIndex((g) => g.matcher === MATCHER && Array.isArray(g.hooks) && g.hooks.length === 1 && isOurs(g.hooks[0]));
if (mine >= 0) {
  groups[mine].hooks = [hook]; // keep its place in the list
} else {
  for (const g of groups) if (Array.isArray(g.hooks)) g.hooks = g.hooks.filter((h) => !isOurs(h));
  settings.hooks.PostToolUse = groups.filter((g) => !Array.isArray(g.hooks) || g.hooks.length);
  settings.hooks.PostToolUse.push({ matcher: MATCHER, hooks: [hook] });
}
const newSettings = `${JSON.stringify(settings, null, 2)}\n`;

// ---- write
const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  const keep = new Set();
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    keep.add(e.name);
    if (e.isDirectory()) copyDir(path.join(from, e.name), path.join(to, e.name));
    else fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
  }
  // files an older version shipped but this one does not
  for (const name of fs.readdirSync(to)) {
    if (!keep.has(name) && !(to === dest && name === 'config.json')) fs.rmSync(path.join(to, name), { recursive: true });
  }
};
const previous = (() => { try { return JSON.parse(fs.readFileSync(path.join(dest, 'version.json'), 'utf8')).version; } catch { return null; } })();
copyDir(runtime, dest);
const version = JSON.parse(fs.readFileSync(path.join(runtime, 'version.json'), 'utf8')).version;
fs.writeFileSync(configPath, `${JSON.stringify({ srcDir: config.srcDir, outDir: config.outDir }, null, 2)}\n`);
const settingsChanged = settingsText === null || settingsText.replace(/\r\n?/g, '\n') !== newSettings;
if (settingsChanged) fs.writeFileSync(settingsPath, newSettings);

console.log(previous ? `updated  .claude/md2html (${previous} -> ${version})` : `created  .claude/md2html (${version})`);
console.log(`config   ${config.srcDir} -> ${config.outDir}`);
console.log(settingsChanged ? 'hook     registered in .claude/settings.json (PostToolUse: Write|Edit|MultiEdit)' : 'hook     already registered in .claude/settings.json');

// ---- convert everything once
const run = spawnSync(process.execPath, [path.join(dest, 'md2html.mjs'), '--all'], { cwd: root, stdio: 'inherit' });
process.exit(run.status === 0 ? 0 : 2);
