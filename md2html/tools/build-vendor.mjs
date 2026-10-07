#!/usr/bin/env node
// Builds the files under runtime/vendor/ that ship with the skill, so the converter needs nothing but node.
//  - markdown-it.mjs   markdown-it and highlight.js (common languages) in one ESM file
//  - hljs.css          the GitHub light theme, and the dark theme under prefers-color-scheme: dark
//  - LICENSES.txt      the license of every package that ended up in the bundle
// Run only when updating those libraries: cd md2html/tools && npm install && npm run build
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../runtime/vendor');
const modules = path.join(here, 'node_modules');
fs.mkdirSync(out, { recursive: true });

const entry = path.join(here, 'vendor-entry.mjs');
fs.writeFileSync(entry, [
  "export { default as MarkdownIt } from 'markdown-it';",
  "export { default as hljs } from 'highlight.js/lib/common';",
  '',
].join('\n'));

const pkgOf = (file) => {
  const rel = path.relative(modules, path.resolve(here, file)).split(path.sep);
  if (rel[0] === '..') return null;
  return rel[0].startsWith('@') ? `${rel[0]}/${rel[1]}` : rel[0];
};

try {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    minify: true,
    legalComments: 'none', // collected into LICENSES.txt instead
    metafile: true,
    outfile: path.join(out, 'markdown-it.mjs'),
  });

  const pkgs = [...new Set(Object.keys(result.metafile.inputs).map(pkgOf).filter(Boolean))].sort();
  const licenses = pkgs.map((name) => {
    const dir = path.join(modules, name);
    const { version, license } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const file = fs.readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
    const text = file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : `(${license}; no license file in the package)`;
    return `${name}@${version} (${license})\n${'-'.repeat(60)}\n${text}\n`;
  });
  fs.writeFileSync(path.join(out, 'LICENSES.txt'),
    `Third-party software bundled into markdown-it.mjs and hljs.css\n\n${licenses.join('\n\n')}`);

  const theme = (name) => fs.readFileSync(path.join(modules, 'highlight.js/styles', name), 'utf8').trim();
  fs.writeFileSync(path.join(out, 'hljs.css'), [
    '/* highlight.js GitHub themes (BSD-3-Clause, see LICENSES.txt) */',
    theme('github.min.css'),
    '@media (prefers-color-scheme: dark) {',
    theme('github-dark.min.css'),
    '}',
    '',
  ].join('\n'));

  console.log(`bundled: ${pkgs.join(', ')}`);
} finally {
  fs.rmSync(entry, { force: true });
}
