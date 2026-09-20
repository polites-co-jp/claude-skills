#!/usr/bin/env node
// PreToolUse hook: the tool gateway. The model proposes an action; this decides whether it may run.
//  1. Commands with external or irreversible effects (.claude/harness.json "commands"):
//     "deny" is refused for everyone; "ask" needs human approval and may only be requested by the listed roles.
//  2. Writes: each role (main session, each subagent) may only write where its rules allow.
//  3. Harness files (.claude/, CLAUDE.md, .mcp.json) are never written silently:
//     the main session must get human approval, subagents are refused.
// Decisions are made here, outside the model's reasoning, so they hold even when instructions are forgotten.
// Shell commands are inspected on a best-effort basis; file tools are checked exactly.
import {
  DEFAULT_PROTECTED, appendTrace, canWrite, emit, findCommandRule, loadConfig, matchesAny, message,
  readInput, roleConfig, roleOf, toProjectPath, writeTargets,
} from './lib/harness.mjs';

const FILE_TOOLS = { Edit: 'file_path', Write: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

// Inline code run through an interpreter can write anywhere, and its targets cannot be read as arguments.
// When such a command names a harness path, treat it as a write to the harness.
// Running a script file (node .claude/hooks/x.mjs, node --check ...) is not inline code and is left alone.
const HARNESS_MENTION = /(^|[\s"'=/\\(])(\.claude[/\\]|CLAUDE(\.local)?\.md|\.mcp\.json)/i;
const CAN_WRITE_UNSEEN = /\b(node|deno|bun|python3?|perl|ruby|php|bash|sh|zsh|pwsh|powershell)(\.exe)?\b[^;|&\n]*\s(-e|-c|-p|-r|--eval|--print|-Command|-EncodedCommand)(\s|$)|\bgit\s+(checkout|restore|rm|mv|apply|stash|reset|clean)\b/i;

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
  if (!canWrite(rel, rc.write)) {
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

  for (const target of writeTargets(command)) {
    const rel = toProjectPath(target, input.cwd);
    if (rel !== null) checkWrite(rel);
  }
  if (HARNESS_MENTION.test(command) && CAN_WRITE_UNSEEN.test(command)) protectedWrite('.claude/, CLAUDE.md, .mcp.json');
  process.exit(0);
}

const field = FILE_TOOLS[tool];
if (!field) process.exit(0);

const rel = toProjectPath(input.tool_input && input.tool_input[field], input.cwd);
if (rel === null) process.exit(0); // Outside the project: leave it to Claude Code's own permission system.
checkWrite(rel);
process.exit(0);
