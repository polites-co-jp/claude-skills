#!/usr/bin/env node
// Regression test for scripts/harness-install.mjs: the script that applies an approved file plan in one step.
// Run: node project-design-harness/tests/installer.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(skill, 'scripts/harness-install.mjs');
const work = path.join(os.tmpdir(), `pdh-installer-${process.pid}-${Date.now()}`);
let bad = 0;

function project(name, existing, staged, files) {
  const root = path.join(work, name);
  fs.mkdirSync(root, { recursive: true });
  const put = (rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  for (const [rel, text] of Object.entries(existing)) put(rel, text);
  for (const [n, text] of Object.entries(staged)) put(`docs/harness/.staging/${n}`, text);
  put('docs/harness/.staging/plan.json', JSON.stringify({ schema: 'harness-install/1', files }));
  return root;
}
const run = (root, ...extra) => spawnSync('node', [script, root, ...extra], { encoding: 'utf8' });
function check(name, ok, detail = '') {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     ${detail}`}`);
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (root, rel) => fs.existsSync(path.join(root, rel));

// 1. a first run: create everything, settings.json last, staging removed
{
  const root = project('first', { 'docs/project-definition.md': 'def' }, {
    'claude__harness.json.staged': '{"schema":"harness-config/1"}',
    'claude__agents__implementer.md.staged': '---\nname: implementer\n---\nbody',
    'claude__settings.json.staged': '{"hooks":{}}',
    'CLAUDE.md.staged': '# x',
    'docs__agent-architecture.md.staged': '# arch',
  }, [
    { path: '.claude/settings.json', action: 'create', staged: 'claude__settings.json.staged' },
    { path: '.claude/harness.json', action: 'create', staged: 'claude__harness.json.staged' },
    { path: '.claude/agents/implementer.md', action: 'create', staged: 'claude__agents__implementer.md.staged' },
    { path: '.claude/hooks/write-boundary.mjs', action: 'create', asset: 'hooks/write-boundary.mjs' },
    { path: '.claude/hooks/lib/harness.mjs', action: 'create', asset: 'hooks/lib/harness.mjs' },
    { path: 'CLAUDE.md', action: 'create', staged: 'CLAUDE.md.staged' },
    { path: 'docs/agent-architecture.md', action: 'create', staged: 'docs__agent-architecture.md.staged' },
  ]);
  const dry = run(root, '--dry-run');
  check('dry run writes nothing', dry.status === 0 && !has(root, '.claude') && has(root, 'docs/harness/.staging/plan.json'), dry.stderr + dry.stdout);
  const r = run(root);
  const lines = r.stdout.trim().split('\n');
  check('first run succeeds', r.status === 0 && has(root, '.claude/agents/implementer.md') && has(root, 'CLAUDE.md'), r.stderr);
  check('hook copied unchanged from the skill', read(root, '.claude/hooks/write-boundary.mjs') === fs.readFileSync(path.join(skill, 'assets/hooks/write-boundary.mjs'), 'utf8'));
  check('settings.json is written last', lines.filter((l) => /^(create|update|delete)/.test(l)).pop().includes('.claude/settings.json'), r.stdout);
  check('staging folder and empty docs/harness removed', !has(root, 'docs/harness'), fs.readdirSync(path.join(root, 'docs')).join(','));
  check('other files untouched', read(root, 'docs/project-definition.md') === 'def');
}

// 2. a re-run: update keeps a backup, delete works, docs/harness with content is kept
{
  const root = project('rerun', { 'CLAUDE.md': 'old text by a person', '.claude/skills/harness-retro/SKILL.md': 'retro', 'docs/harness/state.md': 'state' },
    { 'CLAUDE.md.staged': 'old text by a person\n<!-- block -->' }, [
      { path: 'CLAUDE.md', action: 'update', staged: 'CLAUDE.md.staged' },
      { path: '.claude/skills/harness-retro/SKILL.md', action: 'delete' },
    ]);
  const r = run(root);
  const m = /previous versions of updated and deleted files: (.+)/.exec(r.stdout);
  check('re-run succeeds', r.status === 0 && read(root, 'CLAUDE.md').includes('block') && !has(root, '.claude/skills/harness-retro/SKILL.md'), r.stderr);
  check('previous versions are kept outside the repository', Boolean(m) && fs.readFileSync(path.join(m[1].trim(), 'CLAUDE.md'), 'utf8') === 'old text by a person', r.stdout);
  check('docs/harness with a state file is kept', has(root, 'docs/harness/state.md') && !has(root, 'docs/harness/.staging'));
}

// 3. refusals: nothing may be written
const refusals = [
  ['code is not a harness file', {}, { 'a.staged': 'x' }, [{ path: 'src/app.ts', action: 'create', staged: 'a.staged' }], 'not a harness file'],
  ['a test file is not a harness file', {}, { 'a.staged': 'x' }, [{ path: 'tests/a.test.ts', action: 'create', staged: 'a.staged' }], 'not a harness file'],
  ['the project definition is not installed by this script', {}, { 'a.staged': 'x' }, [{ path: 'docs/project-definition.md', action: 'create', staged: 'a.staged' }], 'not a harness file'],
  ['personal settings are never touched', {}, { 'a.staged': '{}' }, [{ path: '.claude/settings.local.json', action: 'create', staged: 'a.staged' }], 'not a harness file'],
  ['path traversal', {}, { 'a.staged': 'x' }, [{ path: '.claude/../../evil.md', action: 'create', staged: 'a.staged' }], 'inside the project'],
  ['absolute path', {}, { 'a.staged': 'x' }, [{ path: 'C:/Windows/evil.md', action: 'create', staged: 'a.staged' }], 'inside the project'],
  ['create over an existing file', { 'CLAUDE.md': 'mine' }, { 'a.staged': 'x' }, [{ path: 'CLAUDE.md', action: 'create', staged: 'a.staged' }], 'the file exists'],
  ['update of a missing file', {}, { 'a.staged': 'x' }, [{ path: 'CLAUDE.md', action: 'update', staged: 'a.staged' }], 'does not exist'],
  ['placeholder left in a draft', {}, { 'a.staged': 'hello {{PROJECT_NAME}}' }, [{ path: '.claude/agents/x.md', action: 'create', staged: 'a.staged' }], 'PLACEHOLDER'],
  ['level marker left in a draft', {}, { 'a.staged': '<!-- if level>=5 -->\nx\n<!-- endif -->' }, [{ path: '.claude/agents/x.md', action: 'create', staged: 'a.staged' }], 'if level'],
  ['template asset with placeholders copied unchanged', {}, {}, [{ path: '.claude/agents/implementer.md', action: 'create', asset: 'agents/implementer.md' }], 'PLACEHOLDER'],
  ['invalid JSON', {}, { 'a.staged': '{oops' }, [{ path: '.claude/harness.json', action: 'create', staged: 'a.staged' }], 'not valid JSON'],
  ['comment keys left in settings', {}, { 'a.staged': '{"hooks":{"//":"note"}}' }, [{ path: '.claude/settings.json', action: 'create', staged: 'a.staged' }], '"//" keys'],
  ['asset outside the skill', {}, {}, [{ path: '.claude/x.md', action: 'create', asset: '../SKILL.md' }], "inside the skill's assets"],
  ['staged name with a folder', {}, { 'a.staged': 'x' }, [{ path: '.claude/x.md', action: 'create', staged: '../../../CLAUDE.md' }], 'without folders'],
  ['one bad entry stops the good ones too', {}, { 'a.staged': 'x' }, [{ path: '.claude/ok.md', action: 'create', staged: 'a.staged' }, { path: 'src/app.ts', action: 'create', staged: 'a.staged' }], 'not a harness file'],
];
for (const [name, existing, staged, files, expect] of refusals) {
  const root = project(`refuse-${refusals.findIndex((r) => r[0] === name)}`, existing, staged, files);
  const r = run(root);
  const wrote = has(root, '.claude') || has(root, 'src') || has(root, 'tests') || (existing['CLAUDE.md'] ? read(root, 'CLAUDE.md') !== existing['CLAUDE.md'] : has(root, 'CLAUDE.md'));
  check(`refused: ${name}`, r.status === 1 && r.stderr.includes(expect) && !wrote && has(root, 'docs/harness/.staging/plan.json'), `${r.status} ${r.stderr}`);
}

console.log(bad ? `\n${bad} installer cases FAILED` : '\nall installer cases passed');
fs.rmSync(work, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
