#!/usr/bin/env node
// md2html: converts the Markdown under srcDir (default docs/) into HTML under outDir (default docs/html/).
// Lives in <project>/.claude/md2html/ and needs nothing but node: markdown-it and highlight.js are bundled in vendor/.
//
//   node .claude/md2html/md2html.mjs --hook       PostToolUse hook: reads the tool call on stdin, converts the edited md
//   node .claude/md2html/md2html.mjs --all        converts every md, and removes html whose md is gone
//   node .claude/md2html/md2html.mjs --check      writes nothing; exits 1 if the html on disk differs from the md
//   node .claude/md2html/md2html.mjs <file.md>…   converts the given files
//   --root <dir>                                  project root (default: two levels above this file)
//
// Every run also rewrites the shared files (_md2html/nav.js, _md2html/style.css, a generated index.html) and removes
// orphaned html, so a page that was deleted or renamed outside Write/Edit disappears on the next run.
// Output holds nothing that changes from run to run (no dates, no absolute paths), so --check compares exactly.
//
// Exit codes: 0 ok / 1 --check found drift, or a usage error / 2 broken links or an internal error
// (as a hook, exit 2 hands stderr to Claude so it can fix the link on the spot).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarkdownIt, hljs } from './vendor/markdown-it.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GENERATOR = '<meta name="generator" content="md2html">';
const ASSET_DIR = '_md2html';
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.min.js';

// ---------------------------------------------------------------- arguments and config

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const rootArg = argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? argv[rootArg + 1] : path.join(here, '..', '..'));
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--root');

const usage = (msg) => { console.error(`md2html: ${msg}`); process.exit(1); };

let config = { srcDir: 'docs', outDir: 'docs/html' };
try {
  config = { ...config, ...JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8')) };
} catch (e) {
  if (e.code !== 'ENOENT') usage(`config.json を読めない: ${e.message}`);
}

const posix = (p) => p.split(path.sep).join('/');
const inside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
};
const srcAbs = path.resolve(root, config.srcDir);
const outAbs = path.resolve(root, config.outDir);
if (!inside(root, srcAbs) || !inside(root, outAbs)) usage('srcDir と outDir はプロジェクトの中に置く');
if (srcAbs === outAbs) usage('srcDir と outDir に同じフォルダは指定できない');
const srcLabel = posix(path.relative(root, srcAbs)) || '.';

// ---------------------------------------------------------------- source files

const SKIP_DIRS = new Set(['node_modules']);

/** Every md under srcDir (outDir excluded), as posix paths relative to srcDir, sorted for the sidebar. */
function listSources() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name) || inside(outAbs, abs)) continue;
        walk(abs);
      } else if (e.isFile() && /\.md$/i.test(e.name)) {
        out.push(posix(path.relative(srcAbs, abs)));
      }
    }
  };
  if (fs.existsSync(srcAbs)) walk(srcAbs);
  return out.sort(comparePaths);
}

// index first among its siblings, then by name (code points, so the order is the same on every machine)
function comparePaths(a, b) {
  const pa = a.split('/');
  const pb = b.split('/');
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] === pb[i]) continue;
    const lastA = i === pa.length - 1;
    const lastB = i === pb.length - 1;
    if (lastA && lastB) {
      const ia = /^index\.(md|html)$/i.test(pa[i]);
      const ib = /^index\.(md|html)$/i.test(pb[i]);
      if (ia !== ib) return ia ? -1 : 1;
    }
    return pa[i] < pb[i] ? -1 : 1;
  }
  return pa.length - pb.length;
}

const htmlPathOf = (srcRel) => srcRel.replace(/\.md$/i, '.html');
const isSource = (abs) => /\.md$/i.test(abs) && inside(srcAbs, abs) && !inside(outAbs, abs);

function readSource(srcRel) {
  const text = fs.readFileSync(path.join(srcAbs, srcRel), 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const fm = text.match(/^---\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/);
  if (!fm) return { body: text, title: '', lineOffset: 0 };
  const titleLine = fm[1].match(/^title:[ \t]*(.+?)[ \t]*$/m);
  let title = titleLine ? titleLine[1] : '';
  if (/^(['"]).*\1$/.test(title)) title = title.slice(1, -1);
  return { body: text.slice(fm[0].length), title, lineOffset: fm[0].split('\n').length - 1 };
}

// ---------------------------------------------------------------- markdown-it

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decodeEntities = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const value = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        return `<pre><code class="hljs language-${escapeHtml(lang)}">${value}</code></pre>\n`;
      } catch { /* fall back to plain text */ }
    }
    return '';
  },
});

// ```mermaid is drawn in the browser by mermaid.js; offline, the source stays visible as text.
const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim().split(/\s+/)[0] === 'mermaid') {
    env.mermaid = true;
    return `<pre class="mermaid">${escapeHtml(token.content)}</pre>\n`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Heading ids follow GitHub's rule, so a link like [x](other.md#見出し) written for GitHub keeps working.
const slugify = (s) => s.toLowerCase().trim().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-');
md.core.ruler.push('md2html_heading_ids', (state) => {
  const seen = state.env.slugs || (state.env.slugs = new Map());
  state.tokens.forEach((token, i) => {
    if (token.type !== 'heading_open') return;
    const text = (state.tokens[i + 1].children || [])
      .filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('');
    const base = slugify(text);
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    token.attrSet('id', n ? `${base}-${n}` : base);
  });
});

// - [ ] / - [x] become read-only checkboxes
md.core.ruler.push('md2html_task_lists', (state) => {
  const tokens = state.tokens;
  tokens.forEach((token, i) => {
    if (token.type !== 'inline' || tokens[i - 1]?.type !== 'paragraph_open' || tokens[i - 2]?.type !== 'list_item_open') return;
    const first = token.children[0];
    const m = first && first.type === 'text' && first.content.match(/^\[([ xX])\][ \t]+/);
    if (!m) return;
    first.content = first.content.slice(m[0].length);
    const box = new state.Token('html_inline', '', 0);
    box.content = `<input type="checkbox" disabled${m[1] === ' ' ? '' : ' checked'}> `;
    token.children.unshift(box);
    tokens[i - 2].attrJoin('class', 'task-list-item');
    const level = tokens[i - 2].level - 1;
    for (let j = i - 3; j >= 0; j--) {
      if (tokens[j].level === level && /_list_open$/.test(tokens[j].type)) {
        if (!/\bcontains-task-list\b/.test(tokens[j].attrGet('class') || '')) tokens[j].attrJoin('class', 'contains-task-list');
        break;
      }
    }
  });
});

// Relative links: *.md under srcDir -> the matching html; anything else -> the original file, seen from the html.
md.core.ruler.push('md2html_links', (state) => {
  if (!state.env.srcRel) return; // titleOf() parses without a page
  state.tokens.forEach((block) => {
    if (block.type !== 'inline' || !block.children) return;
    const line = block.map ? block.map[0] + 1 + state.env.lineOffset : 0;
    const visit = (children) => children.forEach((t) => {
      const attr = t.type === 'link_open' ? 'href' : t.type === 'image' ? 'src' : null;
      if (attr) {
        const rewritten = rewriteLink(t.attrGet(attr), state.env, line);
        if (rewritten !== null) t.attrSet(attr, rewritten);
      }
      if (t.children) visit(t.children);
    });
    visit(block.children);
  });
});

function rewriteLink(href, env, line) {
  if (!href || href.startsWith('#') || href.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  const [, rawPath, suffix] = href.match(/^([^?#]*)(.*)$/);
  if (!rawPath) return null;
  let decoded = rawPath;
  try { decoded = decodeURIComponent(rawPath); } catch { /* keep as written */ }

  const target = path.resolve(path.dirname(path.join(srcAbs, env.srcRel)), decoded);
  const exists = fs.existsSync(target);
  const warn = () => env.warnings.push(`${srcLabel}/${env.srcRel}:${line} のリンク先 ${decoded} が無い`);
  let dest = target;
  if (isSource(target)) {
    if (!exists) { warn(); return null; } // keep the link as written, so the author's intent stays visible
    dest = path.join(outAbs, htmlPathOf(posix(path.relative(srcAbs, target))));
  } else if (!exists) {
    warn();
  }
  let rel = posix(path.relative(path.dirname(path.join(outAbs, env.outRel)), dest)) || path.basename(dest);
  if (/[\\/]$/.test(decoded) && !rel.endsWith('/')) rel += '/';
  return rel.split('/').map(encodeURIComponent).join('/') + suffix;
}

// ---------------------------------------------------------------- pages

/** Title for <title> and the sidebar: frontmatter title, else the first h1, else the file name. */
function titleOf(srcRel, source = readSource(srcRel)) {
  if (source.title) return source.title;
  const h1 = md.parse(source.body, {}).find((t, i, all) => t.type === 'inline' && all[i - 1].type === 'heading_open' && all[i - 1].tag === 'h1');
  if (h1) return decodeEntities(md.renderInline(h1.content).replace(/<[^>]*>/g, '')).trim();
  return path.posix.basename(srcRel).replace(/\.md$/i, '');
}

const langOf = (text) => (/[぀-ヿ㐀-鿿]/.test(text) ? 'ja' : 'en');

function layout({ outRel, title, body, lang, mermaid }) {
  const depth = outRel.split('/').length - 1;
  const up = '../'.repeat(depth);
  return [
    '<!doctype html>',
    `<html lang="${lang}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    GENERATOR,
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="stylesheet" href="${up}${ASSET_DIR}/style.css">`,
    '</head>',
    '<body>',
    `<nav class="md2html-nav" id="md2html-nav"><a href="${up}index.html">index</a></nav>`,
    '<main class="markdown-body">',
    body.trimEnd(),
    '</main>',
    `<script src="${up}${ASSET_DIR}/nav.js" data-root="${up}" data-current="${escapeHtml(outRel)}"></script>`,
    ...(mermaid ? [`<script src="${MERMAID_URL}"></script>`, "<script>mermaid.initialize({ startOnLoad: true, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });</script>"] : []),
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function renderPage(srcRel) {
  const source = readSource(srcRel);
  const outRel = htmlPathOf(srcRel);
  const env = { srcRel, outRel, lineOffset: source.lineOffset, warnings: [], mermaid: false };
  const body = md.render(source.body, env);
  const html = layout({ outRel, title: titleOf(srcRel, source), body, lang: langOf(source.body), mermaid: env.mermaid });
  return { outRel, html, warnings: env.warnings };
}

/** index.html when srcDir has no index.md: a static list of every page (readable without JavaScript). */
function renderIndex(pages) {
  const title = path.basename(srcAbs);
  const items = pages.map(([p, t]) => `<li><a href="${p.split('/').map(encodeURIComponent).join('/')}">${escapeHtml(t)}</a> <code>${escapeHtml(p)}</code></li>`);
  const body = `<h1>${escapeHtml(title)}</h1>\n<ul>\n${items.join('\n')}\n</ul>\n`;
  return layout({ outRel: 'index.html', title, body, lang: langOf(pages.map((p) => p[1]).join('')), mermaid: false });
}

/** Everything except the pages themselves: nav.js, style.css and (when there is no index.md) index.html. */
function sharedFiles(sources) {
  const pages = sources.map((s) => [htmlPathOf(s), titleOf(s)]);
  const hasIndex = sources.some((s) => s.toLowerCase() === 'index.md');
  const navPages = hasIndex ? pages : [['index.html', 'index'], ...pages];
  const files = new Map();
  files.set(`${ASSET_DIR}/nav.js`, `// Generated by md2html. Do not edit.\nwindow.MD2HTML_PAGES = ${JSON.stringify(navPages, null, 1).replace(/\n\s*/g, ' ')};\n\n${fs.readFileSync(path.join(here, 'assets/nav-client.js'), 'utf8').replace(/\r\n?/g, '\n')}`);
  files.set(`${ASSET_DIR}/style.css`, `${fs.readFileSync(path.join(here, 'assets/style.css'), 'utf8')}\n${fs.readFileSync(path.join(here, 'vendor/hljs.css'), 'utf8')}`.replace(/\r\n?/g, '\n'));
  if (!hasIndex) files.set('index.html', renderIndex(pages));
  return files;
}

// ---------------------------------------------------------------- disk

const readOut = (rel) => {
  try { return fs.readFileSync(path.join(outAbs, rel), 'utf8').replace(/\r\n?/g, '\n'); } catch { return null; }
};

/** Writes only when the content changed (git may have turned LF into CRLF on checkout; that is not a change). */
function writeOut(rel, content, stats) {
  if (readOut(rel) === content) { stats.unchanged++; return; }
  const abs = path.join(outAbs, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  stats.written.push(rel);
}

/** html under outDir that md2html generated but that no md produces any more. Files a person put there are kept. */
function orphans(expected) {
  const found = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (/\.html$/i.test(e.name)) {
        const rel = posix(path.relative(outAbs, abs));
        if (!expected.has(rel) && (readOut(rel) || '').includes(GENERATOR)) found.push(rel);
      }
    }
  };
  walk(outAbs);
  return found.sort(comparePaths);
}

function removeOrphans(expected, stats) {
  for (const rel of orphans(expected)) {
    fs.rmSync(path.join(outAbs, rel));
    stats.removed.push(rel);
    for (let dir = path.dirname(path.join(outAbs, rel)); dir !== outAbs && inside(outAbs, dir); dir = path.dirname(dir)) {
      if (fs.readdirSync(dir).length) break;
      fs.rmdirSync(dir);
    }
  }
}

function expectedSet(sources, shared) {
  return new Set([...sources.map(htmlPathOf), ...shared.keys()]);
}

// ---------------------------------------------------------------- modes

function convert(targets) {
  const sources = listSources();
  const stats = { written: [], unchanged: 0, removed: [], warnings: [] };
  for (const srcRel of targets) {
    const page = renderPage(srcRel);
    writeOut(page.outRel, page.html, stats);
    stats.warnings.push(...page.warnings);
  }
  const shared = sharedFiles(sources);
  for (const [rel, content] of shared) writeOut(rel, content, stats);
  removeOrphans(expectedSet(sources, shared), stats);
  return stats;
}

function check() {
  const sources = listSources();
  const drift = [];
  const warnings = [];
  const want = new Map();
  for (const s of sources) {
    const page = renderPage(s);
    want.set(page.outRel, page.html);
    warnings.push(...page.warnings);
  }
  const shared = sharedFiles(sources);
  for (const [rel, content] of shared) want.set(rel, content);
  for (const [rel, content] of want) {
    const disk = readOut(rel);
    if (disk === null) drift.push(`missing  ${rel}`);
    else if (disk !== content) drift.push(`outdated ${rel}`);
  }
  for (const rel of orphans(expectedSet(sources, shared))) drift.push(`orphan   ${rel}`);
  return { drift, warnings };
}

/** md path relative to srcDir if `file` is a source md that exists, else null. */
function sourceRelOf(file) {
  const abs = path.resolve(root, file);
  if (!isSource(abs) || !fs.existsSync(abs)) return null;
  return posix(path.relative(srcAbs, abs));
}

// The skill may have been updated since setup copied this converter. Say so once per session.
function versionNotice(sessionId) {
  try {
    const mine = JSON.parse(fs.readFileSync(path.join(here, 'version.json'), 'utf8')).version;
    const home = os.homedir();
    const candidates = [
      path.join(root, '.claude/skills/md2html'),
      path.join(home, '.claude/skills/md2html'),
      path.join(home, '.agents/skills/md2html'),
    ];
    const newer = candidates.map((dir) => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, 'runtime/version.json'), 'utf8')).version; } catch { return null; }
    }).find((v) => v && compareVersions(v, mine) > 0);
    if (!newer) return '';
    const marker = path.join(os.tmpdir(), `md2html-version-${String(sessionId || 'x').replace(/\W/g, '')}`);
    if (fs.existsSync(marker)) return '';
    fs.writeFileSync(marker, '');
    return `md2html: .claude/md2html の変換器（${mine}）は、導入済みのスキル（${newer}）より古い。md2html スキルを呼ぶと更新できる。`;
  } catch {
    return '';
  }
}
const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return null; }
}

function report(stats) {
  for (const rel of stats.written) console.log(`wrote    ${posix(path.relative(root, path.join(outAbs, rel)))}`);
  for (const rel of stats.removed) console.log(`removed  ${posix(path.relative(root, path.join(outAbs, rel)))}`);
  console.log(`md2html: ${stats.written.length} written, ${stats.unchanged} unchanged, ${stats.removed.length} removed`);
}

try {
  if (flag('--hook')) {
    const input = readStdin();
    const file = input?.tool_input?.file_path;
    const srcRel = file ? sourceRelOf(file) : null;
    if (!srcRel) process.exit(0);
    const stats = convert([srcRel]);
    const notice = versionNotice(input.session_id);
    if (stats.warnings.length) {
      console.error(['md2html: html は出力したが、切れたリンクがある。md を直すと html も直る。', ...stats.warnings, notice].filter(Boolean).join('\n'));
      process.exit(2);
    }
    if (notice) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notice } }));
    process.exit(0);
  }

  if (flag('--check')) {
    const { drift, warnings } = check();
    for (const w of warnings) console.log(`warning  ${w}`);
    for (const d of drift) console.log(d);
    console.log(drift.length
      ? `md2html: ${drift.length} file(s) differ from ${srcLabel}. Run: node .claude/md2html/md2html.mjs --all`
      : `md2html: ${posix(path.relative(root, outAbs))} is up to date`);
    process.exit(drift.length ? 1 : 0);
  }

  let targets;
  if (flag('--all')) targets = listSources();
  else if (files.length) {
    targets = files.map((f) => {
      const rel = sourceRelOf(f);
      if (!rel) usage(`${f} は ${srcLabel} の下の md ではない`);
      return rel;
    });
  } else usage('使い方: --hook | --all | --check | <file.md>…  [--root <dir>]');

  if (!fs.existsSync(srcAbs)) usage(`${srcLabel} が無い`);
  const stats = convert(targets);
  report(stats);
  if (stats.warnings.length) {
    console.error(['md2html: 切れたリンクがある。', ...stats.warnings].join('\n'));
    process.exit(2);
  }
} catch (e) {
  console.error(`md2html: 変換に失敗した: ${e.stack || e.message}`);
  process.exit(2);
}
