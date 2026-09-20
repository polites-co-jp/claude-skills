#!/usr/bin/env node
// SubagentStart / SubagentStop hook (level 6): records which role started and finished, and nothing else.
// Boundary and verification events are recorded by the other hooks. Command text and file contents are never recorded.
import { appendTrace, loadConfig, readInput } from './lib/harness.mjs';

const input = readInput();
const config = loadConfig();
if (input && config) {
  const event = input.hook_event_name === 'SubagentStart' ? 'agent.start' : 'agent.stop';
  appendTrace(config, input, { event, agent: input.agent_type || '' });
}
process.exit(0);
