#!/usr/bin/env node
// Regression test for the write-boundary and completion-gate hooks (assets/hooks/).
// No test framework: builds a throwaway fixture project (a real git repository, so branch checks are real),
// calls each hook as a child process the way Claude Code would (JSON on stdin), and compares the decision.
// Run: node project-design-harness/tests/hook-scenarios.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const proj = path.join(os.tmpdir(), `pdh-hook-scenarios-${process.pid}-${Date.now()}`);
const norepo = `${proj}-norepo`;

function setup() {
  fs.mkdirSync(path.join(proj, '.claude/hooks/lib'), { recursive: true });
  fs.mkdirSync(path.join(proj, 'docs/harness'), { recursive: true });
  const gitq = (...args) => {
    const r = spawnSync('git', ['-C', proj, ...args], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  gitq('init', '-q', '-b', 'main');
  gitq('config', 'user.email', 'test@example.invalid');
  gitq('config', 'user.name', 'test');
  fs.writeFileSync(path.join(proj, 'README.md'), 'test');
  gitq('add', 'README.md');
  gitq('commit', '-q', '-m', 'init');
  gitq('branch', 'develop');
  gitq('branch', 'feature/x');
  gitq('tag', 'v1.0.0');
  fs.mkdirSync(norepo, { recursive: true });

  for (const f of ['write-boundary.mjs', 'completion-gate.mjs', 'trace.mjs']) {
    fs.copyFileSync(path.join(assets, 'hooks', f), path.join(proj, '.claude/hooks', f));
  }
  fs.copyFileSync(path.join(assets, 'hooks/lib/harness.mjs'), path.join(proj, '.claude/hooks/lib/harness.mjs'));

  // A representative harness.json: the template's roles/pathSets, plus the kind of "commands" rules
  // an actual project definition would produce (see references/policy.md).
  const cfg = JSON.parse(fs.readFileSync(path.join(assets, 'config/harness.json'), 'utf8'));
  cfg.roles.operator = { write: ['-**'] };
  cfg.pathSets.design.push('design/**'); // an existing project that keeps design docs outside docs/
  cfg.localHosts = ['db'];
  cfg.commands = [
    { match: 'git push * --force*', decision: 'deny', label: 'force push' },
    { match: 'git push * -f*', decision: 'deny', label: 'force push' },
    { match: 'git clean', decision: 'ask', label: 'discard work', roles: ['main', 'operator', 'implementer'] },
    { match: 'git reset * --hard', decision: 'ask', label: 'discard work', roles: ['main', 'operator', 'implementer'] },
    { match: 'prisma migrate reset', decision: 'deny', label: 'db reset', localOk: true },
    { match: 'prisma db push * --force-reset', decision: 'deny', label: 'db reset', localOk: true },
    { match: 'pnpm * db:reset', decision: 'deny', label: 'db reset', localOk: true },
    { match: 'prisma migrate dev', decision: 'ask', label: 'schema change', localOk: true },
    { match: 'prisma migrate deploy', decision: 'ask', label: 'prod migration' },
    { match: 'psql', decision: 'ask', label: 'db shell', localOk: true },
    { match: 'stripe', decision: 'ask', label: 'payment CLI' },
    { match: 'dropdb', decision: 'deny', label: 'db drop' },
    { match: 'gh pr merge', decision: 'ask', label: 'merge' },
    { match: 'docker push', decision: 'ask', label: 'image publish' },
    { match: 'docker image push', decision: 'ask', label: 'image publish' },
    { match: 'docker compose push', decision: 'ask', label: 'image publish' },
    { match: 'docker buildx build * --push', decision: 'ask', label: 'image publish' },
  ];
  fs.writeFileSync(path.join(proj, '.claude/harness.json'), JSON.stringify(cfg, null, 1));
  return gitq;
}

const T = { agent_id: 'a', agent_type: 'test-writer' };
const M = {};
const I = { agent_id: 'a', agent_type: 'implementer' };
const V = { agent_id: 'a', agent_type: 'verifier' };
const O = { agent_id: 'a', agent_type: 'operator' };
const sh = (who, command, want, name, tool = 'Bash') => ({ name, want, input: { ...who, tool_name: tool, tool_input: { command } } });
const on = (branch, c) => ({ ...c, branch });
const at = (cwd, c) => ({ ...c, cwd });
const wr = (who, file_path, want, name) => ({ name, want, input: { ...who, tool_name: 'Write', tool_input: { file_path } } });

const cases = [
  // official-docs forms of bypassing Bash(git push *): the hook must catch all of them
  sh(I, 'git -C apps/web push origin main', 'deny', 'git -C dir push (implementer: not your role)'),
  sh(M, 'git -C apps/web push origin main', 'deny', 'git -C dir push to main (main)'),
  sh(M, 'git -C apps/web push --force', 'deny', 'git -C dir push --force'),
  sh(M, 'git -c push.default=current push origin main', 'deny', 'git -c k=v push to main'),
  sh(M, "git 'push' origin main", 'deny', 'quoted subcommand'),
  sh(M, 'git --no-pager push', 'deny', 'flag without value before subcommand (on main)'),
  sh(M, "bash -c 'git push origin main'", 'deny', 'bash -c'),
  sh(I, "sh -c 'pnpm exec prisma migrate reset --force'", 'deny', 'sh -c with indirect prisma reset'),
  sh(I, 'bash -lc "cd apps/web && git push"', 'deny', 'bash -lc compound'),
  sh(M, 'powershell -Command "git push origin main"', 'deny', 'powershell -Command', 'PowerShell'),
  sh(M, 'eval "git push origin main"', 'deny', 'eval'),
  sh(M, '/usr/bin/git push origin main', 'deny', 'absolute program path'),
  sh(I, "bash -c 'echo x > docs/system-design.md'", 'deny', 'nested shell redirect into design doc'),
  sh(M, 'echo "$(git push origin main)"', 'deny', 'command substitution inside quotes'),
  sh(I, 'echo done; git push', 'deny', 'separator without spaces'),
  sh(I, 'pnpm test 2>&1 | tee build.log', 'pass', 'fd duplication is not a separator'),
  sh(I, 'pnpm test > /dev/null 2>&1 &', 'pass', 'background job'),
  sh(I, 'FOO=1 env BAR=2 git push', 'deny', 'env wrapper'),
  sh(M, 'git push --force-with-lease=main origin main', 'deny', '--force-with-lease=ref'),
  sh(M, 'git push -fu origin main', 'deny', 'combined short flags -fu'),
  sh(M, 'docker compose push', 'ask', 'docker compose push'),
  sh(M, 'docker image push ghcr.io/x/y', 'ask', 'docker image push'),
  sh(M, 'docker buildx build -t x --push .', 'ask', 'docker buildx build --push'),
  sh(I, 'docker compose up -d', 'pass', 'docker compose up is not a publish'),
  sh(I, 'docker build -t x .', 'pass', 'docker build is not a publish'),
  // common rows that code-writing roles may request
  sh(I, 'git reset --hard HEAD~1', 'ask', 'implementer may ask to discard its own work'),
  sh(I, 'git reset HEAD~1 --hard', 'ask', 'git reset with --hard at the end'),
  sh(V, 'git clean -fd', 'deny', 'verifier may not discard work'),
  // no false positives
  sh(I, 'git log --grep push', 'pass', 'git log --grep push'),
  sh(I, 'git log -n 5 --oneline', 'pass', 'git log with option values'),
  on('feature/x', sh(I, 'git commit -m "docs: explain git push policy"', 'pass', 'commit message mentioning git push (on a feature branch)')),
  sh(I, 'git -C apps/web status', 'pass', 'git -C dir status'),
  sh(I, 'DATABASE_URL=postgresql://app:pw@localhost:5432/app pnpm exec prisma migrate dev', 'pass', 'prisma migrate dev against a visibly local database'),
  sh(I, 'pnpm run verify', 'pass', 'verify command'),
  sh(I, 'echo "use psql to connect" > apps/web/NOTES.md', 'pass', 'psql inside a quoted string is one word'),
  // write boundaries
  sh(M, 'echo x > apps/web/a.ts', 'deny', 'main redirect into code'),
  sh(V, 'echo x > apps/web/a.ts', 'deny', 'verifier redirect into code'),
  sh(I, 'echo x > docs/project-definition.md', 'deny', 'implementer redirect into design doc'),
  sh(I, 'node --check .claude/hooks/trace.mjs 2>&1', 'pass', 'read-only check of a hook'),
  sh(M, 'node .claude/hooks/write-boundary.mjs', 'pass', 'main runs a hook script'),
  sh(I, 'pnpm exec prisma migrate reset --force', 'deny', 'indirect prisma reset (no local target)'),
  sh(O, 'docker compose exec db psql -U app', 'pass', 'operator psql inside the compose container is local'),
  sh(I, 'docker compose exec db psql -U app', 'pass', 'implementer psql inside the compose container is local'),
  sh(O, 'git add -A && git commit -m x && git push -f origin main', 'deny', 'force push in compound'),
  sh(I, 'mv docs/spec.md apps/web/spec.md', 'deny', 'mv out of docs'),
  sh(I, 'rm -rf node_modules .next', 'pass', 'clean build dirs'),
  sh(I, 'Remove-Item docs/system-design.md', 'deny', 'PowerShell delete of design doc', 'PowerShell'),
  sh(M, "node -e \"require('fs').writeFileSync('.claude/settings.json','{}')\"", 'ask', 'inline script rewriting settings (main)'),
  sh(I, "python -c \"open('CLAUDE.md','w').write('x')\"", 'deny', 'inline script rewriting CLAUDE.md (implementer)'),
  wr(I, 'apps/web/CLAUDE.md', 'deny', 'nested CLAUDE.md'),
  wr(M, 'docs/system-design.md', 'pass', 'main writes design doc'),
  wr(M, 'src/app.ts', 'deny', 'main writes code'),
  wr(I, 'src/app.ts', 'pass', 'implementer writes code'),
  wr(I, 'docs/harness/state.md', 'pass', 'implementer writes work state'),
  wr(I, 'Docs/System-Design.md', 'deny', 'case variant of design doc'),
  wr({ agent_id: 'a', agent_type: 'general-purpose' }, 'src/x.ts', 'deny', 'unknown agent'),
  // code and tests are written by different roles
  wr(I, 'src/app.test.ts', 'deny', 'implementer: test file next to code'),
  wr(I, 'tests/unit/booking.ts', 'deny', 'implementer: tests/ directory'),
  wr(I, 'src/__tests__/booking.ts', 'deny', 'implementer: __tests__ directory'),
  wr(I, 'e2e/booking.spec.ts', 'deny', 'implementer: e2e spec'),
  sh(I, 'echo x > tests/booking.test.ts', 'deny', 'implementer: rewriting a test through the shell'),
  sh(I, 'rm src/app.test.ts', 'deny', 'implementer: deleting a failing test'),
  wr(I, 'src/testing-utils.ts', 'pass', 'not a test file: testing-utils.ts'),
  wr(I, 'src/contest.ts', 'pass', 'not a test file: contest.ts'),
  wr(I, 'vitest.config.ts', 'pass', 'implementer: test runner config is configuration'),
  wr(T, 'tests/booking.test.ts', 'pass', 'test-writer: tests/ directory'),
  wr(T, 'src/app.test.ts', 'pass', 'test-writer: test file next to code'),
  wr(T, 'pkg/booking/booking_test.go', 'pass', 'test-writer: Go test file'),
  wr(T, 'app/test_models.py', 'pass', 'test-writer: Python test file'),
  wr(T, 'src/app.ts', 'deny', 'test-writer: production code'),
  wr(T, 'docs/system-design.md', 'deny', 'test-writer: design doc'),
  wr(T, 'docs/harness/tasks/t1/notes.md', 'pass', 'test-writer: work state'),
  wr(T, '.claude/harness.json', 'deny', 'test-writer: harness file'),
  sh(T, 'git push origin main', 'deny', 'test-writer: push is not its role'),
  wr({ agent_id: 'a', agent_type: 'reviewer' }, 'src/app.ts', 'deny', 'reviewer is read-only'),
  // a one-word rule matches the program being run, not an argument with the same spelling
  sh(I, 'pnpm add stripe', 'pass', 'installing a package named stripe'),
  sh(I, 'pnpm add -D stripe @types/stripe', 'pass', 'installing with an option'),
  sh(I, 'pnpm --filter web add stripe', 'pass', 'installing in a workspace'),
  sh(I, 'grep -rn stripe app', 'pass', 'searching for the word'),
  sh(I, 'mkdir app/api/stripe', 'pass', 'directory named stripe'),
  sh(I, 'pnpm exec vitest run app/api/stripe', 'pass', 'test path named stripe'),
  sh(V, 'git log --grep stripe', 'pass', 'git log --grep stripe'),
  sh(V, 'grep -n psql README.md', 'pass', 'searching for psql'),
  sh(I, 'cat docs/stripe.md | head -5', 'pass', 'file named stripe.md'),
  sh(I, 'git checkout -b feature/stripe', 'pass', 'branch named stripe'),
  sh(M, 'stripe listen --forward-to localhost:3000', 'ask', 'the program itself (main)'),
  sh(I, 'stripe listen', 'deny', 'the program itself (implementer)'),
  sh(M, 'pnpm exec stripe listen', 'ask', 'pnpm exec'),
  sh(M, 'pnpm --filter web exec stripe listen', 'ask', 'pnpm --filter x exec'),
  sh(M, 'pnpm stripe listen', 'ask', 'pnpm short form'),
  sh(M, 'yarn stripe listen', 'ask', 'yarn short form'),
  sh(M, 'npx -y stripe listen', 'ask', 'npx with an option'),
  sh(M, 'pnpm dlx stripe listen', 'ask', 'pnpm dlx'),
  sh(M, './node_modules/.bin/stripe listen', 'ask', 'path to the binary'),
  sh(M, 'STRIPE_API_KEY=x stripe trigger payment_intent.succeeded', 'ask', 'after an assignment'),
  sh(M, 'sudo -u postgres psql', 'ask', 'sudo with an option value'),
  sh(M, 'env PGPASSWORD=x psql -h db.internal', 'ask', 'env wrapper'),
  sh(M, 'uv run psql', 'ask', 'uv run'),
  sh(M, 'ssh prod psql -c "select 1"', 'ask', 'over ssh'),
  sh(M, 'kubectl exec -it db-0 -- psql -U app', 'ask', 'kubectl exec'),
  sh(M, 'docker run --rm postgres:16 psql -h db.example.com', 'ask', 'docker run to a remote host'),
  sh(I, 'docker build -t psql .', 'pass', 'image tag named psql'),
  sh(M, 'cd app && stripe listen', 'ask', 'second command of a list'),
  sh(M, "bash -c 'stripe listen'", 'ask', 'inside bash -c'),
  sh(M, '& stripe listen', 'ask', 'PowerShell call operator', 'PowerShell'),
  sh(M, 'Start-Process stripe -ArgumentList listen', 'ask', 'PowerShell Start-Process', 'PowerShell'),
  sh(M, 'Invoke-Expression "stripe listen"', 'ask', 'PowerShell Invoke-Expression', 'PowerShell'),
  sh(M, 'dropdb yoyaku_dev', 'deny', 'one-word deny rule'),
  sh(I, 'grep -rn dropdb scripts', 'pass', 'searching for dropdb'),
  // merging a pull request is the same external effect as a push
  sh(M, 'gh pr merge 12 --squash', 'ask', 'gh pr merge (main)'),
  sh(I, 'gh pr merge 12 --squash', 'deny', 'gh pr merge (implementer)'),
  sh(I, 'gh pr view 12', 'pass', 'gh pr view'),
  // drafts go to a staging folder, the installer applies them in one step
  wr(M, 'docs/harness/.staging/claude__agents__implementer.md.staged', 'pass', 'main: draft in the staging folder (re-run, hook active)'),
  wr(M, 'docs/harness/.staging/CLAUDE.md.staged', 'pass', 'main: draft of CLAUDE.md is not a harness file'),
  wr(M, 'docs/harness/.staging/plan.json', 'pass', 'main: plan file'),
  wr(M, 'docs/harness/.staging/.claude/agents/implementer.md', 'ask', 'main: a draft under a .claude folder would be asked about (why names are flattened)'),
  sh(M, 'node "C:/Users/x/.claude/skills/project-design-harness/scripts/harness-install.mjs" "E:/proj"', 'pass', 'main: installer runs without a per-file prompt'),
  sh(M, 'node "C:/Users/x/.claude/skills/project-design-harness/scripts/harness-install.mjs" "E:/proj" --dry-run', 'pass', 'main: installer dry run', 'PowerShell'),
  sh(I, 'node "C:/Users/x/.claude/skills/project-design-harness/scripts/harness-install.mjs" .', 'deny', 'implementer: may not run the installer'),
  sh(V, 'node ~/.claude/skills/project-design-harness/scripts/harness-install.mjs .', 'deny', 'verifier: may not run the installer'),
  sh(T, 'cd /tmp && node /x/scripts/harness-install.mjs /e/proj', 'deny', 'test-writer: may not run the installer'),
  // protected branches (the repository is on main; feature/x and develop exist)
  sh(M, 'git commit -m x', 'deny', 'commit on main'),
  sh(M, 'git -C . commit -m x', 'deny', 'commit on main via -C .'),
  sh(M, 'git commit --amend --no-edit', 'deny', 'amend on main'),
  sh(M, 'git merge feature/x', 'deny', 'merge into main'),
  sh(M, 'git rebase feature/x', 'deny', 'rebase on main'),
  sh(M, 'git cherry-pick abc123', 'deny', 'cherry-pick on main'),
  sh(M, "bash -c 'git add -A && git commit -m x'", 'deny', 'commit on main inside bash -c'),
  sh(M, 'git commit -m x', 'deny', 'commit on main (PowerShell)', 'PowerShell'),
  sh(I, 'git commit -m x', 'deny', 'implementer commit on main'),
  sh(M, 'git push', 'deny', 'bare push while on main'),
  sh(M, 'git push origin', 'deny', 'push to remote while on main'),
  sh(M, 'git push -u origin HEAD', 'deny', 'push HEAD while on main'),
  sh(M, 'git push origin HEAD:main', 'deny', 'push HEAD:main'),
  sh(M, 'git push origin feature/x:main', 'deny', 'push feature to main'),
  sh(M, 'git push origin feature/x:refs/heads/main', 'deny', 'push to refs/heads/main'),
  sh(M, 'git push origin +feature/x:develop', 'deny', 'forced refspec to develop'),
  sh(M, 'git push --all origin', 'deny', 'push --all'),
  sh(M, 'git push --mirror origin', 'deny', 'push --mirror'),
  sh(M, 'git push origin "refs/heads/*:refs/heads/*"', 'deny', 'push a pattern'),
  sh(M, 'git push origin --delete main', 'deny', 'delete remote main'),
  sh(M, 'git push origin :master', 'deny', 'delete remote master (colon form)'),
  sh(O, 'git push origin main', 'deny', 'operator may not push to main either'),
  sh(M, 'git push origin feature/x', 'pass', 'push a feature branch while on main'),
  sh(M, 'git switch -c feature/y', 'pass', 'creating a feature branch'),
  sh(M, 'git checkout -b feature/z', 'pass', 'creating a feature branch (checkout -b)'),
  sh(M, 'git pull', 'pass', 'pull on main (updating from the remote)'),
  sh(M, 'git status && git log -3', 'pass', 'reading commands on main'),
  sh(M, 'git stash && git stash pop', 'pass', 'stash on main'),
  on('feature/x', sh(M, 'git commit -m x', 'pass', 'commit on a feature branch')),
  on('feature/x', sh(M, 'git add -A && git commit -m x && git push', 'pass', 'commit and bare push on a feature branch')),
  on('feature/x', sh(M, 'git push -u origin feature/x', 'pass', 'push -u feature branch')),
  on('feature/x', sh(M, 'git push origin HEAD', 'pass', 'push HEAD on a feature branch')),
  on('feature/x', sh(M, 'git push origin HEAD:feature/x', 'pass', 'push HEAD:feature')),
  on('feature/x', sh(M, 'git push origin feature/x:feature/x-copy', 'pass', 'push to another feature name')),
  on('feature/x', sh(M, 'git push origin develop', 'deny', 'push develop from a feature branch')),
  on('feature/x', sh(M, 'git push origin master', 'deny', 'push master (not a local branch, but protected first)')),
  on('feature/x', sh(M, 'git push --force origin feature/x', 'deny', 'force push a feature branch (policy rule)')),
  on('feature/x', sh(M, 'git push origin --delete feature/old', 'ask', 'delete a remote feature branch (main asks)')),
  on('feature/x', sh(I, 'git push origin --delete feature/old', 'deny', 'delete a remote branch (implementer)')),
  on('feature/x', sh(M, 'git push origin :feature/old', 'ask', 'delete a remote branch (colon form)')),
  on('feature/x', sh(M, 'git push --tags', 'ask', 'push tags')),
  on('feature/x', sh(M, 'git push origin v1.0.0', 'ask', 'push a tag by name')),
  on('feature/x', sh(M, 'git push origin refs/tags/v1.0.0', 'ask', 'push refs/tags')),
  on('feature/x', sh(M, 'git push --follow-tags origin feature/x', 'ask', 'push --follow-tags')),
  on('feature/x', sh(M, 'git push origin no-such-branch', 'ask', 'push something that is not a local branch')),
  on('feature/x', sh(M, 'git merge main', 'pass', 'merge main into a feature branch')),
  on('feature/x', sh(M, 'git rebase main', 'pass', 'rebase a feature branch onto main')),
  on('feature/x', sh(I, 'git push', 'deny', 'implementer never pushes')),
  on('feature/x', sh(T, 'git push origin feature/x', 'deny', 'test-writer never pushes')),
  on('feature/x', sh(V, 'git push', 'deny', 'verifier never pushes')),
  on('feature/x', sh(O, 'git push origin feature/x', 'pass', 'operator may push a feature branch')),
  on('develop', sh(M, 'git commit -m x', 'deny', 'commit on develop')),
  on('develop', sh(M, 'git push', 'deny', 'bare push on develop')),
  at(norepo, sh(M, 'git commit -m x', 'pass', 'not a repository: nothing to check')),
  at(norepo, sh(M, 'git push', 'pass', 'not a repository: bare push')),
  at(norepo, sh(M, 'git push origin main', 'deny', 'not a repository: explicit main is still refused')),
  // a database command whose target is visibly local is a routine operation
  sh(I, 'psql -h localhost -U app -d app_test', 'pass', 'psql -h localhost'),
  sh(I, 'psql -h 127.0.0.1 -c "select 1"', 'pass', 'psql -h 127.0.0.1'),
  sh(I, 'psql --host=localhost', 'pass', 'psql --host=localhost'),
  sh(I, 'psql postgresql://app:pw@localhost:5432/app_test', 'pass', 'psql with a local URL'),
  sh(I, 'psql "host=localhost dbname=app_test"', 'pass', 'psql with local conninfo'),
  sh(I, 'psql postgresql://app@[::1]:5432/t', 'pass', 'psql with IPv6 loopback'),
  sh(I, 'PGHOST=localhost psql -U app', 'pass', 'PGHOST=localhost'),
  sh(I, 'mysql -hlocalhost -uroot', 'pass', 'mysql attached -h (no rule for mysql anyway)'),
  sh(I, 'psql', 'deny', 'bare psql (implementer, target unknown)'),
  sh(M, 'psql', 'ask', 'bare psql (main, target unknown)'),
  sh(I, 'psql -h db.prod.example.com -U app', 'deny', 'psql to a remote host (implementer)'),
  sh(M, 'psql -h db.prod.example.com -U app', 'ask', 'psql to a remote host (main)'),
  sh(M, 'psql -h 10.0.0.5', 'ask', 'psql to a LAN address is not local'),
  sh(M, 'psql postgresql://app@localhost/t -h prod.internal', 'ask', 'one local and one remote target'),
  sh(I, 'docker compose exec web psql -h db -U app', 'pass', 'service name inside the compose network'),
  sh(I, 'docker compose exec web psql -h prod.example.com', 'deny', 'remote host from inside a container'),
  sh(I, 'docker --context prod compose exec db psql', 'deny', 'remote docker context'),
  sh(I, 'DOCKER_HOST=ssh://prod docker compose exec db psql', 'deny', 'remote docker daemon'),
  sh(I, 'DATABASE_URL=postgresql://app:pw@localhost:5432/app_test pnpm exec prisma migrate reset --force', 'pass', 'reset a visibly local database'),
  sh(I, 'DATABASE_URL=postgresql://app@localhost/t pnpm db:reset', 'pass', 'wrapped reset with a local URL'),
  sh(I, 'DATABASE_URL="file:./dev.db" pnpm exec prisma migrate reset --force', 'pass', 'SQLite file is local'),
  sh(I, 'docker compose run --rm web pnpm db:reset', 'pass', 'wrapped reset inside a container'),
  sh(I, 'docker compose exec web pnpm exec prisma db push --force-reset', 'pass', 'force-reset inside a container'),
  sh(I, 'pnpm exec prisma migrate reset --force', 'deny', 'reset with an unknown target'),
  sh(M, 'pnpm exec prisma migrate reset --force', 'deny', 'reset with an unknown target (main too)'),
  sh(I, 'pnpm db:reset', 'deny', 'wrapped reset with an unknown target'),
  sh(I, 'DATABASE_URL=postgresql://app@db.prod.example.com:5432/app pnpm exec prisma migrate reset', 'deny', 'reset a remote database'),
  sh(I, 'DATABASE_URL=postgresql://app@localhost/t prisma migrate deploy', 'deny', 'rules without localOk are unchanged'),
  sh(M, 'ssh prod psql -h localhost', 'ask', 'localhost on the far side of ssh is not local'),
  sh(I, 'DATABASE_URL="postgresql://app@db.prod.example.com/app" pnpm exec prisma migrate reset', 'deny', 'quoted remote URL'),
  sh(I, 'DATABASE_URL="postgresql://app@localhost/app" pnpm exec prisma migrate reset', 'pass', 'quoted local URL'),
  sh(I, 'DATABASE_URL=$PROD_URL pnpm exec prisma migrate reset', 'deny', 'URL from a variable is not readable'),
  sh(M, 'kubectl exec db-0 -- psql -h localhost', 'ask', 'localhost inside a cluster pod is not local'),
  sh(M, 'fly postgres connect -a app-db', 'pass', 'no rule for fly postgres here (policy would add one)'),
  // design docs outside docs/ (an existing project that keeps them in design/)
  wr(M, 'design/architecture.md', 'pass', 'main: existing design folder'),
  wr(I, 'design/architecture.md', 'deny', 'implementer: existing design folder'),
];

function main() {
  const gitq = setup();
  let bad = 0;
  let onBranch = 'main';
  for (const c of cases) {
    const want = c.branch || 'main';
    if (want !== onBranch) { gitq('switch', '-q', want); onBranch = want; }
    const r = spawnSync('node', [path.join(proj, '.claude/hooks/write-boundary.mjs')], {
      input: JSON.stringify({ harness_probe: true, cwd: c.cwd || proj, hook_event_name: 'PreToolUse', ...c.input }), encoding: 'utf8',
    });
    let got = 'pass';
    if (r.stdout.trim()) got = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
    const ok = got === c.want && r.status === 0;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(70)} -> ${got}${ok ? '' : ` (want ${c.want}) ${r.stderr}`}`);
  }
  console.log(bad ? `\n${bad} of ${cases.length} write-boundary cases FAILED` : `\nall ${cases.length} write-boundary cases passed`);

  // completion gate: a missing verify directory is explained; the probe flag never advances the retry counter,
  // so five probes in a row all return the same "block" (never reach "give up").
  const gcfg = JSON.parse(fs.readFileSync(path.join(proj, '.claude/harness.json'), 'utf8'));
  gcfg.verify = { command: 'node verify.js', cwd: 'apps/web', roles: ['implementer'], maxBlocks: 3, timeoutSec: 30 };
  fs.writeFileSync(path.join(proj, '.claude/harness.json'), JSON.stringify(gcfg));
  const gate = (extra) => spawnSync('node', [path.join(proj, '.claude/hooks/completion-gate.mjs')], {
    input: JSON.stringify({ session_id: 'g', hook_event_name: 'SubagentStop', agent_id: 'ag', agent_type: 'implementer', last_assistant_message: 'done', ...extra }), encoding: 'utf8',
  }).stdout;

  const first = gate({ harness_probe: true });
  const firstOk = first.includes('"decision":"block"') && first.includes('まだ存在しません');
  if (!firstOk) bad++;
  console.log(`${firstOk ? 'ok  ' : 'FAIL'} gate: missing verify directory is explained${firstOk ? '' : `\n     ${first.slice(0, 300)}`}`);

  const outs = [1, 2, 3, 4, 5].map(() => (gate({ harness_probe: true }).includes('"decision":"block"') ? 'block' : 'other'));
  const probesOk = outs.every((o) => o === 'block');
  if (!probesOk) bad++;
  console.log(`${probesOk ? 'ok  ' : 'FAIL'} gate: five probes in a row never reach the give-up branch (${outs.join(' ')})`);

  return bad;
}

let bad = 1;
try {
  bad = main();
} finally {
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(norepo, { recursive: true, force: true });
}
process.exit(bad ? 1 : 0);
