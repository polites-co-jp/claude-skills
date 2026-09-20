// Shared helpers for the harness hooks. No dependencies beyond Node.js built-ins.
// Installed at <project>/.claude/hooks/lib/harness.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// <project>/.claude/hooks/lib/harness.mjs -> <project>
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const DEFAULT_PROTECTED = ['**/.claude/**', '**/CLAUDE.md', '**/CLAUDE.local.md', '.mcp.json'];

export function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'harness.json'), 'utf8'));
  } catch {
    return null;
  }
}

// The main session has no agent_id. A subagent reports its name in agent_type.
export function roleOf(input) {
  return input && input.agent_id ? input.agent_type || '*' : 'main';
}

export function roleConfig(config, role) {
  const roles = (config && config.roles) || {};
  return roles[role] || roles['*'] || { write: ['-**'] };
}

// Returns a project-relative path with forward slashes, or null when the target is outside the project.
export function toProjectPath(target, cwd) {
  if (!target) return null;
  let p = String(target);
  if (process.platform === 'win32') {
    const m = /^\/([a-zA-Z])\/(.*)$/.exec(p); // Git Bash style: /c/Users/... -> C:/Users/...
    if (m) p = `${m[1]}:/${m[2]}`;
  }
  const rel = path.relative(projectRoot, path.resolve(cwd || projectRoot, p));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

const escapeRegExp = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += escapeRegExp(c);
    }
  }
  // Case-insensitive on every platform: a case variant must not slip past a rule on case-insensitive filesystems.
  return new RegExp(`^${re}$`, 'i');
}

export function matchesAny(relPath, globs) {
  return (globs || []).some((g) => globToRegExp(g).test(relPath));
}

// rules: ["+**", "-@design", "+docs/harness/**", "-@tests"]. The last matching rule wins. No match means not writable.
// "@name" refers to a named list of globs in config.pathSets, so that "where tests live" is written once.
export function canWrite(relPath, rules, pathSets = {}) {
  let allowed = false;
  for (const rule of rules || []) {
    const sign = rule[0];
    if (sign !== '+' && sign !== '-') continue;
    const body = rule.slice(1);
    const globs = body.startsWith('@') ? pathSets[body.slice(1)] || [] : [body];
    if (globs.some((g) => globToRegExp(g).test(relPath))) allowed = sign === '+';
  }
  return allowed;
}

// ---- shell command inspection (best effort: shell text cannot be parsed reliably) ----

// Splits on command separators, subshells and substitutions, so that each piece is one simple command.
// Separators inside quotes are left alone: bash -c "cd x && git push" stays one piece and is unpacked later.
export function splitSegments(command) {
  const text = String(command);
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === quote && !(quote === '"' && text[i - 1] === '\\')) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    const two = text.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '$(') {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (c === '&' && (text[i - 1] === '>' || text[i + 1] === '>')) { // 2>&1, &>file
      cur += c;
      continue;
    }
    if (';|&\n()`'.includes(c)) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

export function tokenize(segment) {
  const tokens = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

const programName = (token) => token.replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd|bat|ps1|sh)$/i, '').toLowerCase();

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish', 'pwsh', 'powershell', 'cmd']);
const INLINE_FLAG = /^(-[a-z]*c|-command|\/c)$/i;
const EVALS = new Set(['eval', 'invoke-expression', 'iex']);

// Every simple command in the text as a list of words, including commands handed to a shell as a string
// (bash -c "...", sh -c "...", powershell -Command "...", eval "...").
export function simpleCommands(command, depth = 0) {
  const out = [];
  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment);
    if (tokens.length === 0) continue;
    out.push(tokens);
    if (depth >= 3) continue;
    for (const tok of tokens) { // command substitution kept inside a quoted word: "$(git push)" or "`git push`"
      for (const m of tok.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) out.push(...simpleCommands(m[1] ?? m[2], depth + 1));
    }
    for (let i = 0; i < tokens.length; i++) {
      const program = programName(tokens[i]);
      if (EVALS.has(program) && tokens[i + 1]) out.push(...simpleCommands(tokens.slice(i + 1).join(' '), depth + 1));
      if (!SHELLS.has(program)) continue;
      const flag = tokens.findIndex((tok, k) => k > i && INLINE_FLAG.test(tok));
      if (flag !== -1 && tokens[flag + 1]) out.push(...simpleCommands(tokens[flag + 1], depth + 1));
    }
  }
  return out;
}

// Positions reachable from t by skipping global options: "-C dir", "-c k=v", "--no-pager".
// Catches "git -C apps/web push" without treating "git log --grep push" as a push.
function afterOptions(tokens, t) {
  const seen = new Set([t]);
  const todo = [t];
  while (todo.length) {
    const i = todo.pop();
    if (i >= tokens.length || !tokens[i].startsWith('-')) continue;
    const next = [i + 1];
    if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) next.push(i + 2); // the option takes a value
    for (const n of next) {
      if (!seen.has(n)) {
        seen.add(n);
        todo.push(n);
      }
    }
  }
  return [...seen];
}

const wordMatches = (want, got) => (want.includes('*')
  ? new RegExp(`^${want.split('*').map(escapeRegExp).join('.*')}$`, 'i').test(got)
  : want.toLowerCase() === got.toLowerCase());

// pattern: "prisma migrate reset", "git push * --force*". Words must appear in order inside one simple command,
// anywhere in it, so "pnpm exec prisma migrate reset" and "docker compose exec db psql" are caught too.
// A lone "*" stands for zero or more words; "*" inside a word matches any characters ("--force*").
function matchRest(tokens, t, pattern) {
  let at = t;
  for (let p = 0; p < pattern.length; p++) {
    if (pattern[p] === '*') {
      const rest = pattern.slice(p + 1);
      if (rest.length === 0) return true;
      for (let k = at; k <= tokens.length; k++) if (matchRest(tokens, k, rest)) return true;
      return false;
    }
    if (at >= tokens.length || !wordMatches(pattern[p], tokens[at])) return false;
    at++;
  }
  return true;
}

function matchAt(tokens, start, pattern) {
  if (programName(tokens[start]) !== pattern[0].toLowerCase()) return false;
  const rest = pattern.slice(1);
  if (rest.length === 0) return true;
  return afterOptions(tokens, start + 1).some((t) => matchRest(tokens, t, rest));
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// Words that run what follows them as a command: "sudo psql", "npx stripe", PowerShell "Start-Process stripe".
const WRAPPERS = new Set(['sudo', 'doas', 'env', 'time', 'nohup', 'nice', 'command', 'exec', 'xargs', 'winpty',
  'npx', 'pnpx', 'bunx', 'dotenv', 'cross-env', 'start-process', 'saps', 'start']);
// Package managers and task runners: "pnpm exec stripe", "uv run psql", and the short form "pnpm stripe" / "yarn stripe".
const RUNNERS = new Set(['pnpm', 'npm', 'yarn', 'bun', 'deno', 'uv', 'poetry', 'pipenv', 'pdm', 'hatch', 'rye', 'bundle', 'mise']);
const RUN_WORDS = new Set(['exec', 'dlx', 'x', 'run']);
// Programs that run the rest of the line somewhere else: "docker compose exec db psql", "ssh host psql".
const CONTAINERS = new Set(['docker', 'podman', 'nerdctl', 'docker-compose', 'kubectl', 'oc']);
const REMOTES = new Set(['ssh', 'wsl']);

// Positions where a word is the program being run, not an argument.
// "grep -rn stripe app" has one (grep); "pnpm exec stripe listen" has three (pnpm, exec, stripe).
function programPositions(tokens) {
  const positions = new Set();
  const todo = [0];
  while (todo.length) {
    let i = todo.pop();
    while (i < tokens.length && (ASSIGNMENT.test(tokens[i]) || tokens[i] === '&' || tokens[i] === '--')) i++;
    if (i >= tokens.length || positions.has(i)) continue;
    positions.add(i);
    const program = programName(tokens[i]);
    if (WRAPPERS.has(program)) {
      todo.push(...afterOptions(tokens, i + 1));
    } else if (RUNNERS.has(program)) {
      for (const k of afterOptions(tokens, i + 1)) {
        todo.push(k);
        if (k < tokens.length && RUN_WORDS.has(tokens[k].toLowerCase())) todo.push(...afterOptions(tokens, k + 1));
      }
    } else if (CONTAINERS.has(program) || REMOTES.has(program)) {
      const from = REMOTES.has(program) ? i : tokens.findIndex((tok, k) => k > i && (tok === 'exec' || tok === 'run'));
      if (from !== -1) for (let k = from + 1; k < tokens.length; k++) positions.add(k);
    }
  }
  return positions;
}

// A pattern of two or more words is looked for anywhere in a simple command. A pattern of one word ("stripe", "psql")
// would then hit "grep -rn stripe app" and "pnpm add stripe", so it matches only where the word is the program being run.
export function commandMatches(command, patternText) {
  const pattern = tokenize(patternText);
  if (pattern.length === 0) return false;
  const oneWord = pattern.filter((w) => w !== '*').length === 1;
  return simpleCommands(command).some((tokens) => {
    const positions = oneWord ? programPositions(tokens) : null;
    for (let i = 0; i < tokens.length; i++) {
      if (positions && !positions.has(i)) continue;
      if (matchAt(tokens, i, pattern)) return true;
    }
    return false;
  });
}

// config.commands: [{ match, decision: "deny" | "ask", roles?: [...], label? }]. A deny rule wins over an ask rule.
export function findCommandRule(config, command) {
  const rules = (config && config.commands) || [];
  const hits = rules.filter((r) => r && r.match && commandMatches(command, r.match));
  return hits.find((r) => r.decision === 'deny') || hits.find((r) => r.decision === 'ask') || null;
}

const ALL_ARGS_ARE_TARGETS = new Set(['rm', 'rmdir', 'touch', 'mkdir', 'truncate', 'del', 'erase', 'rd', 'mv', 'move',
  'remove-item', 'ri', 'set-content', 'add-content', 'clear-content', 'out-file', 'new-item', 'ni', 'move-item', 'rename-item']);
const LAST_ARG_IS_TARGET = new Set(['cp', 'copy', 'copy-item', 'ln', 'install']);

// Paths a shell command would write to, as far as that can be read from its text.
export function writeTargets(command) {
  const targets = [];
  for (const tokens of simpleCommands(command)) {
    const args = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const redirect = /^(?:\d|&)?>>?(.*)$/.exec(tok);
      if (redirect) {
        const target = redirect[1] || tokens[++i];
        if (target && !target.startsWith('&')) targets.push(target);
        continue;
      }
      args.push(tok);
    }
    if (args.length === 0) continue;
    const program = programName(args[0]);
    const operands = args.slice(1).filter((a) => !a.startsWith('-'));
    if (program === 'tee' || ALL_ARGS_ARE_TARGETS.has(program)) targets.push(...operands);
    else if (LAST_ARG_IS_TARGET.has(program) && operands.length) targets.push(operands[operands.length - 1]);
    else if (program === 'sed' && args.some((a) => /^-[a-z]*i/i.test(a) || a === '--in-place')) targets.push(...operands.slice(1));
  }
  return targets;
}

export function message(config, key, fallback, vars = {}) {
  const template = (config && config.messages && config.messages[key]) || fallback;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// One line per milestone event. Never records command text or file contents.
// Probes (input.harness_probe === true) are not recorded, so checking the hooks does not pollute the trace.
export function appendTrace(config, input, event) {
  try {
    if (!config || !config.trace || !config.trace.enabled || (input && input.harness_probe === true)) return;
    const dir = path.join(projectRoot, config.trace.dir || 'docs/harness/traces');
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // local date
    fs.appendFileSync(path.join(dir, `${day}.jsonl`), `${JSON.stringify({ ts: now.toISOString(), ...event })}\n`);
  } catch {
    // Tracing must never break the run.
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}
