#!/usr/bin/env node
// Repository-wide checks that do not need a fixture project: JSON templates parse, relative markdown links
// resolve, every {{PLACEHOLDER}} used in the harness assets is explained in SKILL.md, no level codes ("L3",
// "レベル5") leak into user-facing text, and "if level" markers in templates are balanced.
// Run: node tests/check-repo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const fail = (msg) => { bad++; console.log('FAIL', msg); };

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === '.claude') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const files = walk(root);

// 1. JSON templates parse
for (const f of files.filter((x) => x.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { fail(`JSON ${path.relative(root, f)}: ${e.message}`); }
}

// 2. relative links in markdown resolve (skip templates' placeholder links and code blocks)
for (const f of files.filter((x) => x.endsWith('.md'))) {
  const text = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#|<)/.test(href) || href.includes('{{')) continue;
    if (/assets.(docs.state\.md|skills.change-receipt.receipt\.template\.md)$/.test(f)) continue; // links valid only where the file is generated
    const target = path.resolve(path.dirname(f), decodeURI(href.split('#')[0]));
    if (!fs.existsSync(target)) fail(`link ${path.relative(root, f)} -> ${href}`);
  }
}

// 3. every placeholder used in harness assets is explained in SKILL.md
const skillMd = fs.readFileSync(path.join(root, 'project-design-harness/SKILL.md'), 'utf8');
const used = new Set();
for (const f of files.filter((x) => x.includes(`project-design-harness${path.sep}assets`))) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\{\{([A-Z_]+)\}\}/g)) used.add(m[1]);
}
for (const name of used) {
  if (name.startsWith('AREA_')) continue; // explained in assets/rules/area.template.md's own comment
  if (!skillMd.includes(`{{${name}}}`)) fail(`placeholder {{${name}}} is not explained in SKILL.md`);
}

// 4. no level codes in user-facing harness text (the decision log may discuss them historically)
const codes = /\bL[0-6]\b|レベル ?[0-9]|Lv\.?[0-9]/;
for (const f of files.filter((x) => x.includes(`project-design-harness${path.sep}`) && /\.(md|json|mjs)$/.test(x))) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (codes.test(line) && !/見せ|分からない|出さない|書かない/.test(line)) fail(`level code ${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 80)}`);
  });
}

// 5. "if level" / "endif" markers are balanced in templates
for (const f of files.filter((x) => x.includes(`project-design-harness${path.sep}assets`) && x.endsWith('.md'))) {
  const t = fs.readFileSync(f, 'utf8');
  const opens = (t.match(/<!-- if level[<>]=?\d -->/g) || []).length;
  const closes = (t.match(/<!-- endif -->/g) || []).length;
  if (opens !== closes) fail(`if/endif ${path.relative(root, f)}: ${opens} open, ${closes} close`);
}

console.log(bad ? `${bad} problem(s)` : `ok: ${files.length} files checked, ${used.size} placeholders`);
process.exit(bad ? 1 : 0);
