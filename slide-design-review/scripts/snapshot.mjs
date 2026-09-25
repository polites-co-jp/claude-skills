#!/usr/bin/env node
// Save the Slidev project's source files before a fix, show what the fix changed, and put the files back
// when the fix is rejected. Skips node_modules, .git, dist, design-review and build caches, and files over 5 MB.
//
// Usage:
//   node snapshot.mjs save    <project-root> <snapshot-dir>
//   node snapshot.mjs diff    <project-root> <snapshot-dir>   # unified diff of the changes since save (stdout)
//   node snapshot.mjs restore <project-root> <snapshot-dir>   # put saved files back; files created after the
//                                                              # save are moved to <snapshot-dir>/removed/
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_DIRS, die } from './lib.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const [cmd, rootArg, snapArg] = process.argv.slice(2);
if (!['save', 'diff', 'restore'].includes(cmd) || !rootArg || !snapArg) {
  die('使い方: node snapshot.mjs save|diff|restore <project-root> <snapshot-dir>');
}
const root = path.resolve(rootArg);
const snap = path.resolve(snapArg);
const files = path.join(snap, 'files');
const manifestPath = path.join(snap, 'manifest.json');
const toPosix = (p) => p.split(path.sep).join('/');

const hash = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORED_DIRS.has(e.name) && path.resolve(p) !== snap) walk(p, out);
    } else if (e.isFile() && fs.statSync(p).size <= MAX_BYTES) {
      out.push(toPosix(path.relative(root, p)));
    }
  }
  return out;
}

if (cmd === 'save') {
  fs.rmSync(snap, { recursive: true, force: true });
  const manifest = {};
  for (const f of walk(root)) {
    fs.mkdirSync(path.dirname(path.join(files, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(files, f));
    manifest[f] = hash(path.join(root, f));
  }
  fs.writeFileSync(manifestPath, JSON.stringify({ root: toPosix(root), savedAt: new Date().toISOString(), files: manifest }, null, 2));
  console.log(`saved ${Object.keys(manifest).length} file(s) -> ${toPosix(snap)}`);
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) die(`退避が無い: ${manifestPath}`);
const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files;
const now = walk(root);
const modified = Object.keys(saved).filter((f) => fs.existsSync(path.join(root, f)) && hash(path.join(root, f)) !== saved[f]);
const deleted = Object.keys(saved).filter((f) => !fs.existsSync(path.join(root, f)));
const added = now.filter((f) => !(f in saved));
const nothing = !modified.length && !added.length && !deleted.length;

if (cmd === 'diff') {
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  for (const f of modified) {
    if (!hasGit) { console.log(`modified: ${f}`); continue; }
    const before = path.join(files, f);
    const after = path.join(root, f);
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', '--', before, after], { encoding: 'utf8' });
    // git prints the two absolute paths in the headers; rewrite them as a/<file> and b/<file>
    const text = (r.stdout || '')
      .replace(/^diff --git .*$/m, `diff --git a/${f} b/${f}`)
      .replace(/^--- .*$/m, `--- a/${f}`)
      .replace(/^\+\+\+ .*$/m, `+++ b/${f}`);
    process.stdout.write(text);
  }
  for (const f of added) console.log(`added: ${f}`);
  for (const f of deleted) console.log(`deleted: ${f}`);
  if (nothing) console.log('no changes');
  process.exit(0);
}

// restore
for (const f of [...modified, ...deleted]) {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.copyFileSync(path.join(files, f), path.join(root, f));
  console.log(`restored: ${f}`);
}
for (const f of added) {
  const dst = path.join(snap, 'removed', f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(path.join(root, f), dst);
  console.log(`moved aside (created after save): ${f} -> ${toPosix(dst)}`);
}
if (nothing) console.log('nothing to restore');
