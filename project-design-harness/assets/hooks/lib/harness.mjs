// Shared helpers for the harness hooks. No dependencies beyond Node.js built-ins.
// Installed at <project>/.claude/hooks/lib/harness.mjs
import { execFileSync } from 'node:child_process';
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
function tokensMatch(tokens, patternText) {
  const pattern = tokenize(patternText);
  if (pattern.length === 0) return false;
  const oneWord = pattern.filter((w) => w !== '*').length === 1;
  const positions = oneWord ? programPositions(tokens) : null;
  for (let i = 0; i < tokens.length; i++) {
    if (positions && !positions.has(i)) continue;
    if (matchAt(tokens, i, pattern)) return true;
  }
  return false;
}

export function commandMatches(command, patternText) {
  return simpleCommands(command).some((tokens) => tokensMatch(tokens, patternText));
}

// ---- where a command points: the local machine (test database, container) or somewhere else ----
// The text of "prisma migrate reset" does not say which database it resets. When the command names its target
// (DATABASE_URL=postgresql://...@localhost/..., psql -h 127.0.0.1, docker compose exec db psql), that can be read.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal']);
const REMOTE_PROGRAMS = new Set(['ssh', 'kubectl', 'oc', 'gcloud', 'aws', 'az', 'fly', 'flyctl', 'heroku', 'railway', 'vercel', 'wrangler']);
const LOCAL_DAEMONS = new Set(['docker', 'podman', 'nerdctl', 'docker-compose', 'podman-compose']);
const HOST_FLAGS = new Set(['-h', '--host', '--hostname']);

function urlHost(text) {
  const m = /^[A-Za-z][A-Za-z0-9+.:-]*:\/\/(?:[^@/\s]*@)?(\[[^\]]*\]|[^:/\s?#]*)/.exec(text);
  return m ? m[1] : null;
}

// "local" when every named target is this machine, "remote" when any is not, "unknown" when nothing is named.
export function targetLocality(tokens, localHosts = []) {
  const known = new Set([...LOCAL_HOSTS, ...localHosts.map((h) => String(h).toLowerCase())]);
  const first = tokens.findIndex((t) => !ASSIGNMENT.test(t));
  const program = first === -1 ? '' : programName(tokens[first]);
  if (REMOTE_PROGRAMS.has(program)) return 'remote';
  let container = false;
  let remote = false;
  if (LOCAL_DAEMONS.has(program)) {
    const rest = tokens.slice(first + 1);
    if (rest.some((t) => /^(--context|-H|--host)(=|$)/.test(t))) remote = true; // a remote daemon
    container = rest.some((t) => t === 'exec' || t === 'run');
  }
  const hosts = [];
  const unquote = (v) => v.replace(/^["']|["']$/g, '');
  const fromUrl = (v) => hosts.push(urlHost(unquote(v)) ?? '?'); // an unreadable URL is not treated as local
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const env = /^([A-Z_][A-Z0-9_]*)=([\s\S]*)$/.exec(tok); // FOO=bar; conninfo "host=x" is lowercase
    if (env) {
      const [, name, raw] = env;
      const value = unquote(raw);
      if (/^DOCKER_(HOST|CONTEXT)$/.test(name)) remote = true;
      else if (value.includes('://')) fromUrl(value);
      else if (/^(file|sqlite):/i.test(value)) hosts.push('');
      else if (/HOST$/.test(name) && value) hosts.push(value); // PGHOST, DB_HOST, MYSQL_HOST
      continue;
    }
    if (tok.includes('://')) { fromUrl(tok); continue; }
    if (/^["']?(file|sqlite):/i.test(tok)) { hosts.push(''); continue; }
    const eq = /^--?(host|hostname)=(.+)$/i.exec(tok);
    if (eq) { hosts.push(eq[2]); continue; }
    if (HOST_FLAGS.has(tok) && tokens[i + 1]) { hosts.push(tokens[i + 1]); i++; continue; }
    if (/^-h[^-]/.test(tok)) { hosts.push(tok.slice(2)); continue; } // mysql -hlocalhost
    const conn = /(^|[\s;])host=([^\s;]+)/i.exec(tok); // psql "host=localhost dbname=x"
    if (conn) hosts.push(conn[2]);
  }
  if (remote) return 'remote';
  const isLocal = (h) => {
    const host = String(h).toLowerCase().replace(/^\[|\]$/g, '');
    if (host === '') return true; // unix socket, SQLite file
    if (!/^[\w.:-]+$/.test(host)) return false;
    if (known.has(host) || host.endsWith('.localhost')) return true;
    return container && !host.includes('.') && !host.includes(':') && !/^\d+$/.test(host); // a service name on the container network
  };
  if (hosts.length) return hosts.every(isLocal) ? 'local' : 'remote';
  return container ? 'local' : 'unknown';
}

// config.commands: [{ match, decision: "deny" | "ask", roles?: [...], label?, localOk? }]. A deny rule wins over an ask rule.
// A rule with localOk does not apply when the command visibly targets this machine (the test database, a container).
export function findCommandRule(config, command) {
  const rules = (config && config.commands) || [];
  const localHosts = (config && config.localHosts) || [];
  const hits = [];
  for (const tokens of simpleCommands(command)) {
    for (const r of rules) {
      if (!r || !r.match || !tokensMatch(tokens, r.match)) continue;
      if (r.localOk && targetLocality(tokens, localHosts) === 'local') continue;
      hits.push(r);
    }
  }
  return hits.find((r) => r.decision === 'deny') || hits.find((r) => r.decision === 'ask') || null;
}

// ---- git: protected branches ----
// Work happens on feature branches. Committing on main/master/develop, or pushing to them, is refused;
// they receive changes through pull requests (an approved operation).

const gitCache = new Map();
function git(dir, args) {
  const key = `${dir}\0${args.join('\0')}`;
  if (!gitCache.has(key)) {
    let out = null;
    try {
      out = execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
    } catch { /* not a repository, git missing, or a non-zero exit */ }
    gitCache.set(key, out);
  }
  return gitCache.get(key);
}
export const isRepository = (dir) => git(dir, ['rev-parse', '--git-dir']) !== null;
export function currentBranch(dir) {
  const b = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return b && b !== 'HEAD' ? b : null; // null when detached
}
const isLocalBranch = (dir, name) => git(dir, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`]) !== null;

const GIT_VALUE_OPTS = new Set(['-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
const COMMITTING = new Set(['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am']);
const PUSH_VALUE_OPTS = new Set(['-o', '--push-option', '--receive-pack', '--exec', '--repo']);

// One simple command as a git invocation: { dir, sub, args }, or null. "-C dir" moves the repository.
export function gitCommand(tokens, cwd) {
  let i = 0;
  while (i < tokens.length && (ASSIGNMENT.test(tokens[i]) || WRAPPERS.has(programName(tokens[i])))) i++;
  if (i >= tokens.length || programName(tokens[i]) !== 'git') return null;
  let dir = cwd;
  let j = i + 1;
  while (j < tokens.length && tokens[j].startsWith('-')) {
    const t = tokens[j];
    if (t === '-C' && tokens[j + 1]) { dir = path.resolve(dir, tokens[j + 1]); j += 2; continue; }
    if (t.startsWith('-C') && t.length > 2) { dir = path.resolve(dir, t.slice(2)); j++; continue; }
    j += GIT_VALUE_OPTS.has(t) ? 2 : 1;
  }
  if (j >= tokens.length) return null;
  return { dir, sub: tokens[j].toLowerCase(), args: tokens.slice(j + 1) };
}

// The git subcommands a shell text runs ("push", "commit", ...), for role checks.
export function gitSubcommands(command, cwd) {
  return simpleCommands(command).map((t) => gitCommand(t, cwd)).filter(Boolean).map((g) => g.sub);
}

export function pushPlan(args) {
  const plan = { all: false, tags: false, del: false, positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { plan.positional.push(...args.slice(i + 1)); break; }
    if (a.startsWith('-')) {
      const name = a.split('=')[0];
      if (['--all', '--branches', '--mirror', '--prune'].includes(name)) plan.all = true;
      else if (name === '--tags' || name === '--follow-tags') plan.tags = true;
      else if (name === '--delete' || name === '-d') plan.del = true;
      if (PUSH_VALUE_OPTS.has(a)) i++;
      continue;
    }
    plan.positional.push(a);
  }
  plan.refspecs = plan.positional.slice(1); // positional[0] is the remote
  return plan;
}

// { decision: "deny" | "ask", key, vars } for the first git command that touches a protected branch, or null.
// "ask" is for pushes that are not a plain branch push: tags (they can start a release) and remote branch deletion.
export function gitBranchCheck(config, command, cwd) {
  const gitConfig = (config && config.git) || {};
  const protectedBranches = Array.isArray(gitConfig.protectedBranches) ? gitConfig.protectedBranches : ['main', 'master', 'develop'];
  if (protectedBranches.length === 0) return null;
  const isProtected = (name) => protectedBranches.some((p) => wordMatches(p, name));
  let ask = null;
  for (const tokens of simpleCommands(command)) {
    const g = gitCommand(tokens, cwd);
    if (!g) continue;
    if (COMMITTING.has(g.sub)) {
      const branch = currentBranch(g.dir);
      if (branch && isProtected(branch)) return { decision: 'deny', key: 'branchCommit', vars: { branch, sub: g.sub } };
      continue;
    }
    if (g.sub !== 'push') continue;
    const plan = pushPlan(g.args);
    if (plan.all) return { decision: 'deny', key: 'branchPushAll', vars: {} };
    const repo = isRepository(g.dir);
    const current = repo ? currentBranch(g.dir) : null;
    const strip = (r) => r.replace(/^\+/, '').replace(/^refs\/heads\//, '');
    if (plan.del) {
      const names = plan.refspecs.map((r) => strip(r).split(':').pop());
      const hit = names.find(isProtected);
      if (hit) return { decision: 'deny', key: 'branchPush', vars: { branch: hit } };
      ask = ask || { decision: 'ask', key: 'pushDelete', vars: { ref: names.join(', ') } };
      continue;
    }
    const targets = [];
    if (plan.refspecs.length === 0 && current) targets.push(current);
    for (const raw of plan.refspecs) {
      const r = raw.replace(/^\+/, '');
      const colon = r.indexOf(':');
      const src = strip(colon === -1 ? r : r.slice(0, colon));
      let dst = strip(colon === -1 ? r : r.slice(colon + 1));
      if (colon !== -1 && src === '') { // "origin :branch" deletes the remote branch
        if (isProtected(dst)) return { decision: 'deny', key: 'branchPush', vars: { branch: dst } };
        ask = ask || { decision: 'ask', key: 'pushDelete', vars: { ref: dst } };
        continue;
      }
      if (src.startsWith('refs/tags/') || dst.startsWith('refs/tags/')) { ask = ask || { decision: 'ask', key: 'pushTag', vars: {} }; continue; }
      if (dst.includes('*')) return { decision: 'deny', key: 'branchPushAll', vars: {} };
      if (src === 'HEAD') dst = colon === -1 ? current : dst;
      if (dst && isProtected(dst)) return { decision: 'deny', key: 'branchPush', vars: { branch: dst } };
      if (src !== 'HEAD' && repo && !isLocalBranch(g.dir, src)) { ask = ask || { decision: 'ask', key: 'pushUnknownRef', vars: { ref: src } }; continue; }
      if (dst) targets.push(dst);
    }
    const hit = targets.find(isProtected);
    if (hit) return { decision: 'deny', key: 'branchPush', vars: { branch: hit } };
    if (plan.tags) ask = ask || { decision: 'ask', key: 'pushTag', vars: {} };
  }
  return ask;
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
