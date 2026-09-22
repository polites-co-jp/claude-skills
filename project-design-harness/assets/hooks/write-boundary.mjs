#!/usr/bin/env node
// PreToolUse hook: the tool gateway. The model proposes an action; this decides whether it may run.
//  1. Commands with external or irreversible effects (.claude/harness.json "commands"):
//     "deny" is refused for everyone; "ask" needs human approval and may only be requested by the listed roles.
//  2. Writes: each role (main session, each subagent) may only write where its rules allow.
//  3. Harness files (.claude/, CLAUDE.md, .mcp.json) are never written silently:
//     the main session must get human approval, subagents are refused.
//     The one exception is the skill's own installer, which the main session runs after the user approved the file plan.
// Decisions are made here, outside the model's reasoning, so they hold even when instructions are forgotten.
// Shell commands are inspected on a best-effort basis; file tools are checked exactly.
import {
  DEFAULT_PROTECTED, appendTrace, canWrite, emit, findCommandRule, gitBranchCheck, gitSubcommands, loadConfig, matchesAny, message,
  projectRoot, readInput, roleConfig, roleOf, toProjectPath, writeTargets,
} from './lib/harness.mjs';

const GIT_FALLBACK = {
  branchCommit: 'The current branch "{branch}" is protected. Do not commit on it ({sub}): create a feature branch first (git switch -c feature/<name>); your uncommitted changes come along. Protected branches receive changes through pull requests.',
  branchPush: 'Pushing to the protected branch "{branch}" is prohibited in this project. Push a feature branch and open a pull request.',
  branchPushAll: 'Pushing several branches at once (--all, --mirror, --prune, a pattern) may include a protected branch and is prohibited. Name one branch.',
  pushDelete: 'deleting a remote branch ({ref})',
  pushTag: 'pushing tags (this can start a release)',
  pushUnknownRef: 'pushing something that is not a local branch ({ref})',
};

const FILE_TOOLS = { Edit: 'file_path', Write: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

// Inline code run through an interpreter can write anywhere, and its targets cannot be read as arguments.
// When such a command names a harness path, treat it as a write to the harness.
// Running a script file (node .claude/hooks/x.mjs, node --check ...) is not inline code and is left alone.
const HARNESS_MENTION = /(^|[\s"'=/\\(])(\.claude[/\\]|CLAUDE(\.local)?\.md|\.mcp\.json)/i;
const CAN_WRITE_UNSEEN = /\b(node|deno|bun|python3?|perl|ruby|php|bash|sh|zsh|pwsh|powershell)(\.exe)?\b[^;|&\n]*\s(-e|-c|-p|-r|--eval|--print|-Command|-EncodedCommand)(\s|$)|\bgit\s+(checkout|restore|rm|mv|apply|stash|reset|clean)\b/i;

// The installer of the project-design-harness skill rewrites the harness in one step, after the user has approved
// the file plan in the main session. A subagent cannot get that approval, so it may not run the installer.
const INSTALLER = /harness-install\.mjs/i;

const input = readInput();
const config = loadConfig();
const tool = input && input.tool_name;
if (!input || !tool) process.exit(0);

const role = roleOf(input);
const isMain = role === 'main';
const protectedGlobs = (config && config.protected) || DEFAULT_PROTECTED;
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

function decide(permissionDecision, permissionDecisionReason, trace) {
  appendTrace(config, input, { event: `boundary.${permissionDecision}`, agent: role, tool, ...trace });
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason } });
  process.exit(0);
}

function protectedWrite(rel) {
  if (isMain) {
    decide('ask', message(config, 'protectedAsk',
      'This changes a harness file ({path}). Changing the harness needs your approval.', { path: rel }), { path: rel, rule: 'protected' });
  }
  decide('deny', message(config, 'protectedDeny',
    'Subagents may not modify harness files ({path}). Report the needed change to the main session instead.', { path: rel }), { path: rel, rule: 'protected' });
}

function checkWrite(rel) {
  if (matchesAny(rel, protectedGlobs)) protectedWrite(rel);
  if (!config) {
    // Fail closed for project files, but never deadlock: harness files were handled above with "ask".
    decide('deny', 'The harness config .claude/harness.json is missing or not valid JSON, so write boundaries cannot be evaluated. Ask the user to repair it.', { path: rel, rule: 'config' });
  }
  const rc = roleConfig(config, role);
  if (!canWrite(rel, rc.write, config.pathSets)) {
    decide('deny', fill(rc.onDeny || 'Role "{role}" may not write to {path}.', { role, path: rel }), { path: rel, rule: 'role' });
  }
}

if (SHELL_TOOLS.has(tool)) {
  const command = String((input.tool_input && input.tool_input.command) || '');

  const rule = findCommandRule(config, command);
  if (rule) {
    const label = rule.label || rule.match;
    if (rule.decision === 'deny') {
      decide('deny', message(config, 'commandDeny',
        'This operation is prohibited in this project: {label}. Do not look for another way to achieve it; report that it is needed.', { label }), { rule: `command:${rule.match}` });
    }
    const mayAsk = Array.isArray(rule.roles) ? rule.roles : ['main', 'operator'];
    if (!mayAsk.includes(role)) {
      decide('deny', message(config, 'commandNotYourRole',
        'Role "{role}" does not run this operation: {label}. It has effects outside the workspace, so it belongs to: {roles}. Report that it is needed instead of running it.',
        { role, label, roles: mayAsk.join(', ') }), { rule: `command:${rule.match}` });
    }
    decide('ask', message(config, 'commandAsk',
      'This operation has effects outside the workspace or cannot be undone: {label}. It needs your approval.', { label }), { rule: `command:${rule.match}` });
  }

  const cwd = input.cwd || projectRoot;
  const branch = gitBranchCheck(config, command, cwd);
  if (branch && branch.decision === 'deny') decide('deny', message(config, branch.key, GIT_FALLBACK[branch.key], branch.vars), { rule: `git:${branch.key}` });
  // Pushing is the main session's job (after review and verification), or the operator's.
  const pushRoles = (config && config.git && Array.isArray(config.git.pushRoles)) ? config.git.pushRoles : ['main', 'operator'];
  if (!pushRoles.includes(role) && gitSubcommands(command, cwd).includes('push')) {
    decide('deny', message(config, 'commandNotYourRole',
      'Role "{role}" does not run this operation: {label}. It has effects outside the workspace, so it belongs to: {roles}. Report that it is needed instead of running it.',
      { role, label: message(config, 'pushLabel', 'pushing to the remote', {}), roles: pushRoles.join(', ') }), { rule: 'git:push' });
  }
  if (branch) {
    const text = message(config, branch.key, GIT_FALLBACK[branch.key], branch.vars);
    const mayAsk = pushRoles;
    if (!mayAsk.includes(role)) {
      decide('deny', message(config, 'commandNotYourRole',
        'Role "{role}" does not run this operation: {label}. It has effects outside the workspace, so it belongs to: {roles}. Report that it is needed instead of running it.',
        { role, label: text, roles: mayAsk.join(', ') }), { rule: `git:${branch.key}` });
    }
    decide('ask', message(config, 'commandAsk',
      'This operation has effects outside the workspace or cannot be undone: {label}. It needs your approval.', { label: text }), { rule: `git:${branch.key}` });
  }

  for (const target of writeTargets(command)) {
    const rel = toProjectPath(target, input.cwd);
    if (rel !== null) checkWrite(rel);
  }
  if (!isMain && INSTALLER.test(command)) protectedWrite('.claude/, CLAUDE.md, .mcp.json');
  if (HARNESS_MENTION.test(command) && CAN_WRITE_UNSEEN.test(command)) protectedWrite('.claude/, CLAUDE.md, .mcp.json');
  process.exit(0);
}

const field = FILE_TOOLS[tool];
if (!field) process.exit(0);

const rel = toProjectPath(input.tool_input && input.tool_input[field], input.cwd);
if (rel === null) process.exit(0); // Outside the project: leave it to Claude Code's own permission system.
checkWrite(rel);
process.exit(0);
