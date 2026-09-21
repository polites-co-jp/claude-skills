#!/usr/bin/env node
// Applies an approved file plan in one step, so that the user is not asked once per file.
// The skill writes drafts to a staging folder (docs/harness/.staging), the user approves the plan,
// and this script moves the drafts into place: .claude/, CLAUDE.md, .mcp.json, docs/agent-architecture.md, docs/harness/.
//
//   node harness-install.mjs <project-root> [--staging <dir>] [--dry-run]
//
// plan.json (in the staging folder):
//   { "schema": "harness-install/1",
//     "files": [ { "path": ".claude/agents/implementer.md", "action": "create", "staged": "claude__agents__implementer.md.staged" },
//                { "path": ".claude/hooks/write-boundary.mjs", "action": "update", "asset": "hooks/write-boundary.mjs" },
//                { "path": ".claude/skills/harness-retro/SKILL.md", "action": "delete" } ] }
//
// Everything is validated before anything is written. Nothing outside the harness's own locations can be written,
// so this cannot be used to get around the write boundary of the generated harness.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNED = [/^\.claude\//, /^CLAUDE\.md$/, /^\.mcp\.json$/, /^docs\/agent-architecture\.md$/, /^docs\/harness\//];
const NEVER = [/^\.claude\/settings\.local\.json$/, /^\.claude\/worktrees\//];
const SETTINGS = '.claude/settings.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const stagingFlag = args.indexOf('--staging');
const stagingArg = stagingFlag === -1 ? null : args[stagingFlag + 1];
const positional = args.filter((a, i) => !a.startsWith('--') && (stagingFlag === -1 || i !== stagingFlag + 1));

function fail(lines) {
  console.error(['harness-install: nothing was written.', ...[].concat(lines)].join('\n  '));
  process.exit(1);
}

if (positional.length !== 1) fail('usage: node harness-install.mjs <project-root> [--staging <dir>] [--dry-run]');
const root = path.resolve(positional[0]);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) fail(`project root not found: ${root}`);
const staging = path.resolve(root, stagingArg || 'docs/harness/.staging');
const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

let plan;
try {
  plan = JSON.parse(fs.readFileSync(path.join(staging, 'plan.json'), 'utf8'));
} catch (e) {
  fail(`cannot read ${path.join(staging, 'plan.json')}: ${e.message}`);
}
if (!plan || plan.schema !== 'harness-install/1' || !Array.isArray(plan.files) || plan.files.length === 0) {
  fail('plan.json must be { "schema": "harness-install/1", "files": [ ... ] } with at least one file.');
}

const inside = (base, target) => {
  const rel = path.relative(base, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

function hasCommentKey(value) {
  if (Array.isArray(value)) return value.some(hasCommentKey);
  if (value && typeof value === 'object') return Object.keys(value).some((k) => k === '//' || hasCommentKey(value[k]));
  return false;
}

// ---- validate everything first ----
const problems = [];
const jobs = [];
const seen = new Set();
for (const [i, f] of plan.files.entries()) {
  const where = `files[${i}]`;
  if (!f || typeof f.path !== 'string' || !f.path) {
    problems.push(`${where}: "path" is missing`);
    continue;
  }
  const rel = f.path.replace(/\\/g, '/').replace(/^\.\//, '');
  const target = path.resolve(root, rel);
  if (path.isAbsolute(f.path) || rel.split('/').includes('..') || !inside(root, target)) problems.push(`${rel}: must be a path inside the project`);
  else if (!OWNED.some((re) => re.test(rel)) || NEVER.some((re) => re.test(rel))) problems.push(`${rel}: not a harness file. Only .claude/, CLAUDE.md, .mcp.json, docs/agent-architecture.md and docs/harness/ may be installed`);
  else if (inside(staging, target)) problems.push(`${rel}: is inside the staging folder`);
  if (seen.has(rel.toLowerCase())) problems.push(`${rel}: listed twice`);
  seen.add(rel.toLowerCase());

  const exists = fs.existsSync(target);
  if (exists && !fs.statSync(target).isFile()) problems.push(`${rel}: exists and is not a file`);
  if (!['create', 'update', 'delete'].includes(f.action)) problems.push(`${rel}: "action" must be create, update or delete`);
  if (f.action === 'create' && exists) problems.push(`${rel}: action is "create" but the file exists. Read it, merge, and use "update"`);
  if ((f.action === 'update' || f.action === 'delete') && !exists) problems.push(`${rel}: action is "${f.action}" but the file does not exist`);

  let source = null;
  if (f.action !== 'delete') {
    if (Boolean(f.staged) === Boolean(f.asset)) problems.push(`${rel}: give exactly one of "staged" (a draft in the staging folder) or "asset" (a file copied unchanged from the skill)`);
    else if (f.staged) {
      source = path.resolve(staging, f.staged);
      if (/[\\/]/.test(f.staged) || !inside(staging, source)) problems.push(`${rel}: "staged" must be a file name in the staging folder, without folders`);
    } else {
      source = path.resolve(assets, f.asset);
      if (!inside(assets, source)) problems.push(`${rel}: "asset" must be a path inside the skill's assets folder`);
    }
    if (source && (!fs.existsSync(source) || !fs.statSync(source).isFile())) problems.push(`${rel}: source not found: ${source}`);
    else if (source) {
      const text = fs.readFileSync(source, 'utf8');
      if (rel.endsWith('.json')) {
        try {
          if (hasCommentKey(JSON.parse(text))) problems.push(`${rel}: still contains "//" keys from the template`);
        } catch (e) {
          problems.push(`${rel}: is not valid JSON (${e.message})`);
        }
      }
      if (/\{\{[A-Z_]+\}\}/.test(text)) problems.push(`${rel}: still contains a {{PLACEHOLDER}}`);
      if (/<!-- (if level[<>]=?\d|endif) -->/.test(text)) problems.push(`${rel}: still contains an "if level" marker from the template`);
      if (text.includes('このコメントは生成時に削除する')) problems.push(`${rel}: still contains the template's usage comment`);
    }
  }
  jobs.push({ rel, target, action: f.action, source });
}
if (problems.length) fail(problems);

// settings.json registers the hooks, and hooks take effect as soon as it is written: write it last.
jobs.sort((a, b) => Number(a.rel === SETTINGS) - Number(b.rel === SETTINGS));

const count = { create: 0, update: 0, delete: 0 };
for (const j of jobs) count[j.action]++;
if (dryRun) {
  for (const j of jobs) console.log(`${j.action.padEnd(6)} ${j.rel}`);
  console.log(`dry run: ${count.create} to create, ${count.update} to update, ${count.delete} to delete. Nothing was written.`);
  process.exit(0);
}

// ---- apply ----
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(os.tmpdir(), `harness-install-backup-${stamp}`);
let backedUp = 0;
const done = [];
try {
  for (const j of jobs) {
    if (j.action !== 'create') { // keep the previous version: the file may hold things a person wrote
      const keep = path.join(backup, j.rel);
      fs.mkdirSync(path.dirname(keep), { recursive: true });
      fs.copyFileSync(j.target, keep);
      backedUp++;
    }
    if (j.action === 'delete') fs.rmSync(j.target);
    else {
      fs.mkdirSync(path.dirname(j.target), { recursive: true });
      fs.copyFileSync(j.source, j.target);
    }
    done.push(j.rel);
  }
} catch (e) {
  fail([`stopped at an error: ${e.message}`, `already written: ${done.join(', ') || '(none)'}`,
    backedUp ? `previous versions are in ${backup}` : 'no file had a previous version']);
}

// The drafts have served their purpose. Remove the staging folder, and docs/harness if that leaves it empty.
fs.rmSync(staging, { recursive: true, force: true });
const parent = path.dirname(staging);
if (inside(root, parent) && fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);

for (const j of jobs) console.log(`${j.action.padEnd(6)} ${j.rel}`);
console.log(`installed: ${count.create} created, ${count.update} updated, ${count.delete} deleted.`);
if (backedUp) console.log(`previous versions of updated and deleted files: ${backup}`);
