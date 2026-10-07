#!/usr/bin/env node
// Scenarios for md2html: setup into a throwaway project, then convert, hook, clean up and check.
// Run: node md2html/tests/convert.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'md2html-test-'));
let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(proj, rel)), { recursive: true }); fs.writeFileSync(path.join(proj, rel), text); };
const read = (rel) => fs.readFileSync(path.join(proj, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(proj, rel));
const node = (args, input) => spawnSync(process.execPath, args, { cwd: proj, input, encoding: 'utf8' });
const converter = path.join(proj, '.claude/md2html/md2html.mjs');
const hook = (rel, sessionId = 'test') => node([converter, '--hook'], JSON.stringify({ session_id: sessionId, tool_name: 'Edit', tool_input: { file_path: path.join(proj, rel) } }));

try {
  write('README.md', '# readme\n');
  write('docs/guide/a.md', [
    '---', 'title: "Guide A"', '---', '# Heading A', '',
    '[B](../spec/b.md#api-一覧) [self](#section-1) [web](https://example.com) [readme](../../README.md)', '',
    '![img](img/x.png)', '', '## Section 1', '', '- [ ] todo', '- [x] done', '',
    '```js', 'const a = 1;', '```', '', '```mermaid', 'graph TD; A-->B;', '```', '',
  ].join('\n'));
  write('docs/guide/img/x.png', 'png');
  write('docs/spec/b.md', '# Spec B\n\n## API 一覧\n\n[A](../guide/a.md)\n');
  write('docs/.hidden/skip.md', '# skip\n');
  write('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo other' }] }] } }, null, 2));

  // ---- setup
  let r = node([path.join(skill, 'scripts/setup.mjs'), '--root', proj]);
  ok(r.status === 0, `setup exits 0 (got ${r.status}) ${r.stderr}`);
  ok(exists('.claude/md2html/vendor/markdown-it.mjs') && exists('.claude/md2html/config.json'), 'converter copied into the project');
  const settings = JSON.parse(read('.claude/settings.json'));
  ok(settings.permissions.allow[0] === 'Bash(ls)', 'existing settings kept');
  ok(settings.hooks.PostToolUse.length === 2 && settings.hooks.PostToolUse[0].matcher === 'Bash', 'existing hook kept, md2html hook added');
  r = node([path.join(skill, 'scripts/setup.mjs'), '--root', proj]);
  ok(JSON.parse(read('.claude/settings.json')).hooks.PostToolUse.length === 2, 'setup is idempotent');

  // ---- page content
  const a = read('docs/html/guide/a.html');
  ok(a.includes('<title>Guide A</title>'), 'frontmatter title used, frontmatter not rendered');
  ok(!a.includes('title: '), 'frontmatter removed from the body');
  ok(a.includes('href="../spec/b.html#api-%E4%B8%80%E8%A6%A7"'), 'md link -> html, anchor kept');
  ok(a.includes('href="#section-1"') && a.includes('id="section-1"'), 'in-page anchor matches heading id');
  ok(a.includes('href="https://example.com"'), 'external link untouched');
  ok(a.includes('href="../../../README.md"'), 'md outside srcDir points at the original file');
  ok(a.includes('src="../../guide/img/x.png"'), 'image points at the original file');
  ok(/<input type="checkbox" disabled> todo/.test(a) && /disabled checked> done/.test(a), 'task list');
  ok(a.includes('class="hljs language-js"'), 'syntax highlight');
  ok(a.includes('<pre class="mermaid">') && a.includes('mermaid.min.js'), 'mermaid block and script');
  ok(!read('docs/html/spec/b.html').includes('mermaid.min.js'), 'mermaid script only where needed');
  ok(read('docs/html/spec/b.html').includes('id="api-一覧"'), 'GitHub-style heading id for non-ASCII');
  ok(!exists('docs/html/.hidden/skip.html'), 'dot folders skipped');
  ok(read('docs/html/index.html').includes('href="guide/a.html"'), 'generated index lists pages');
  ok(read('docs/html/_md2html/nav.js').includes('"Spec B"'), 'nav.js lists pages');
  ok(!/\r/.test(a), 'LF line endings');

  // ---- check
  ok(node([converter, '--check']).status === 0, '--check passes right after --all');

  // ---- hook: new page with a broken link
  write('docs/new.md', '# New\n\n[gone](missing.md)\n');
  r = hook('docs/new.md');
  ok(r.status === 2 && r.stderr.includes('docs/new.md:3') && r.stderr.includes('missing.md'), 'hook reports a broken link with exit 2');
  ok(exists('docs/html/new.html') && read('docs/html/new.html').includes('href="missing.md"'), 'html still written, broken link kept as written');
  ok(read('docs/html/_md2html/nav.js').includes('"New"'), 'hook updates nav.js');

  // ---- hook ignores what is not a source md
  ok(hook('README.md').status === 0, 'md outside srcDir ignored');
  write('docs/html/stray.md', '# stray\n');
  ok(hook('docs/html/stray.md').status === 0 && !exists('docs/html/stray.html'), 'md inside outDir ignored');

  // ---- delete outside Write/Edit: the next run removes the orphan, keeps hand-made files
  write('docs/html/manual.html', '<p>mine</p>\n');
  fs.rmSync(path.join(proj, 'docs/spec/b.md'));
  ok(node([converter, '--check']).status === 1, '--check fails after a source is deleted');
  hook('docs/new.md');
  ok(!exists('docs/html/spec/b.html') && !exists('docs/html/spec'), 'orphan html and its empty folder removed');
  ok(exists('docs/html/manual.html'), 'hand-made html kept');

  // ---- index.md replaces the generated index
  write('docs/index.md', '# Home\n');
  hook('docs/index.md');
  ok(read('docs/html/index.html').includes('<title>Home</title>'), 'index.md becomes index.html');

  // ---- CRLF on disk (git autocrlf) is not drift
  node([converter, '--all']);
  const p = path.join(proj, 'docs/html/new.html');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\n/g, '\r\n'));
  ok(node([converter, '--check']).status === 0, 'CRLF checkout does not count as drift');

  // ---- custom dirs
  write('notes/x.md', '# X\n');
  r = node([path.join(skill, 'scripts/setup.mjs'), '--root', proj, '--src', 'notes', '--out', 'site']);
  ok(r.status === 0 && exists('site/x.html'), 'srcDir/outDir configurable');
  ok(JSON.parse(read('.claude/md2html/config.json')).srcDir === 'notes', 'config.json updated');
  ok(node([path.join(skill, 'scripts/setup.mjs'), '--root', proj, '--src', 'nope']).status === 1, 'missing srcDir refused');
} finally {
  fs.rmSync(proj, { recursive: true, force: true });
}

console.log(bad ? `${bad} failure(s)` : 'all md2html scenarios passed');
process.exit(bad ? 1 : 0);
