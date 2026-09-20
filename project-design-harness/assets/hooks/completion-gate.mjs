#!/usr/bin/env node
// Completion requires evidence (level 5+). An agent saying "done" is only another model output.
//
// As a SubagentStop hook: when a code-writing role tries to finish, run the project's verify command.
//  - pass -> the agent may stop
//  - fail -> the agent is kept running and receives the failing output as its next instruction
//  - still failing after maxBlocks attempts -> stop the loop, tell the human, and leave a note for the main session
//  - the agent is not claiming completion (its last message starts with the handback marker) -> let it stop
//
// As a PostToolUse hook on the Agent tool: deliver that note to the main session, so an unverified result
// is never mistaken for a finished one.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendTrace, emit, loadConfig, message, projectRoot, readInput } from './lib/harness.mjs';

const input = readInput();
const config = loadConfig();
const verify = config && config.verify;
if (!input || !verify) process.exit(0);

const safe = (s) => String(s || 'x').replace(/\W/g, '');
const noteFile = path.join(os.tmpdir(), `harness-gate-${safe(input.session_id)}.unverified`);

if (input.hook_event_name === 'PostToolUse') {
  let note = '';
  try { note = fs.readFileSync(noteFile, 'utf8'); fs.unlinkSync(noteFile); } catch { /* nothing pending */ }
  if (note) emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: note } });
  process.exit(0);
}

const agent = input.agent_type || '';
if (Array.isArray(verify.roles) && !verify.roles.includes(agent)) process.exit(0);

// A project with several toolchains has one verify command per code-writing role.
const command = (verify.commands && verify.commands[agent]) || verify.command;
if (!command) process.exit(0);

// Handing work back (ambiguous contract, design error) is not a completion claim, so there is nothing to prove.
const marker = verify.handbackMarker || 'HANDBACK:';
if (String(input.last_assistant_message || '').trimStart().startsWith(marker)) {
  appendTrace(config, input, { event: 'verify.skip', agent, reason: 'handback' });
  process.exit(0);
}

const maxBlocks = Number.isInteger(verify.maxBlocks) ? verify.maxBlocks : 3;
const counterFile = path.join(os.tmpdir(), `harness-gate-${safe(input.session_id)}-${safe(input.agent_id)}.count`);
const probe = input.harness_probe === true; // a probe leaves no trace, no note and no count
const readCount = () => { try { return probe ? 0 : parseInt(fs.readFileSync(counterFile, 'utf8'), 10) || 0; } catch { return 0; } };
const clearCount = () => { try { if (!probe) fs.unlinkSync(counterFile); } catch { /* nothing to clear */ } };

const shownDir = verify.cwd && verify.cwd !== '.' ? verify.cwd : '.';
const runDir = path.resolve(projectRoot, shownDir);
const dirExists = fs.existsSync(runDir);

const started = Date.now();
const run = !dirExists ? { status: 1, stdout: '', stderr: '' } : spawnSync(command, {
  cwd: runDir, shell: true, encoding: 'utf8',
  timeout: (verify.timeoutSec || 900) * 1000, maxBuffer: 32 * 1024 * 1024,
});
const seconds = Math.round((Date.now() - started) / 1000);
const timedOut = Boolean(run.error && run.error.code === 'ETIMEDOUT');

if (!run.error && run.status === 0) {
  clearCount();
  appendTrace(config, input, { event: 'verify.pass', agent, seconds });
  process.exit(0);
}

const blocks = readCount() + 1;
appendTrace(config, input, { event: 'verify.fail', agent, seconds, attempt: blocks, timedOut });

if (blocks > maxBlocks) {
  // Repeating an unchanged failure only pays to reproduce it. Stop and escalate.
  clearCount();
  const text = message(config, 'verifyGiveUp',
    'Verification ("{command}") still fails after {max} attempts by {agent}. The work is NOT verified. Review before relying on it.',
    { command, max: maxBlocks, agent });
  if (!probe) { try { fs.writeFileSync(noteFile, text); } catch { /* best effort */ } }
  emit({ systemMessage: text });
  process.exit(0);
}

if (!probe) fs.writeFileSync(counterFile, String(blocks));
const tail = !dirExists
  ? message(config, 'verifyNoDir', 'The directory "{cwd}" (relative to the project root) does not exist yet. The verify command runs there.', { cwd: shownDir })
  : `${run.stdout || ''}\n${run.stderr || ''}`.trim().split(/\r?\n/).slice(-60).join('\n').slice(-6000);
const head = timedOut
  ? message(config, 'verifyTimeout', 'Verification ("{command}") timed out after {sec}s.', { command, sec: verify.timeoutSec || 900 })
  : message(config, 'verifyFail',
    'Completion requires evidence: "{command}", run in "{cwd}" (relative to the project root), must pass before you finish (attempt {attempt} of {max}). If the project has no such command yet, create it so that it runs the cheapest checks first (syntax, types, focused tests). Read the failure below, change something relevant, and try again. If you are not claiming completion but handing the work back (ambiguous contract, design error, contradictory requirements), start your final message with "{marker}" and you will be allowed to stop.',
    { command, attempt: blocks, max: maxBlocks, marker, cwd: shownDir });
emit({ decision: 'block', reason: `${head}\n\n${tail}` });
process.exit(0);
