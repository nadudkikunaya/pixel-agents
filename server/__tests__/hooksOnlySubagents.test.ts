import { beforeEach, describe, expect, it } from 'vitest';

import { AgentStateStore } from '../src/agentStateStore.js';
import { HookEventHandler } from '../src/hookEventHandler.js';
import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import { SessionRouter } from '../src/sessionRouter.js';
import type { AgentState } from '../src/types.js';

function createHooksOnlyAgent(): AgentState {
  return {
    id: 1,
    sessionId: 'sess-1',
    isExternal: true,
    hooksOnly: true,
    projectDir: '/pixel-agents-remote/sess-1/nat-pc',
    jsonlFile: '',
    fileOffset: 0,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    backgroundAgentToolIds: new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    lastDataAt: 0,
    linesProcessed: 0,
    seenUnknownRecordTypes: new Set(),
    hookDelivered: false,
  } as unknown as AgentState;
}

describe('hooks-only sub-agents (remote machines)', () => {
  let messages: Array<Record<string, unknown>>;
  let handler: HookEventHandler;

  beforeEach(() => {
    const agents = new AgentStateStore();
    messages = [];
    agents.on('broadcast', (msg) => {
      messages.push(msg as Record<string, unknown>);
    });
    agents.set(1, createHooksOnlyAgent());
    handler = new HookEventHandler(
      agents,
      new Map(),
      new Map(),
      claudeProvider,
      new SessionRouter(),
    );
    handler.registerAgent('sess-1', 1);
  });

  const send = (event: Record<string, unknown>) =>
    handler.handleEvent('claude', { session_id: 'sess-1', ...event } as never);

  it('one orchestrator with 10 parallel Task calls spawns 10 sub-agent starts', () => {
    for (let i = 0; i < 10; i++) {
      send({
        hook_event_name: 'PreToolUse',
        tool_name: 'Task',
        tool_use_id: `toolu_${i}`,
        tool_input: { subagent_type: 'Explore' },
      });
    }
    const starts = messages.filter((m) => m.type === 'agentToolStart');
    expect(starts).toHaveLength(10);
    expect(new Set(starts.map((m) => m.toolId)).size).toBe(10);
    expect(starts.every((m) => m.toolName === 'Task' && m.status === 'Subtask: Explore')).toBe(
      true,
    );
  });

  it('each PostToolUse clears only its own sub-agent', () => {
    for (const id of ['toolu_a', 'toolu_b']) {
      send({ hook_event_name: 'PreToolUse', tool_name: 'Task', tool_use_id: id });
    }
    send({ hook_event_name: 'PostToolUse', tool_name: 'Task', tool_use_id: 'toolu_a' });
    const clears = messages.filter((m) => m.type === 'subagentClear');
    expect(clears).toHaveLength(1);
    expect(clears[0].parentToolId).toBe('toolu_a');
    expect(messages.filter((m) => m.type === 'agentToolDone')).toHaveLength(1);
  });

  it('a background Task is not cleared by its PostToolUse', () => {
    send({
      hook_event_name: 'PreToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_bg',
      tool_input: { run_in_background: true },
    });
    send({
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_bg',
      tool_input: { run_in_background: true },
    });
    expect(messages.filter((m) => m.type === 'subagentClear')).toHaveLength(0);
  });

  it('ordinary tools still take the normal path', () => {
    send({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'toolu_x' });
    const start = messages.find((m) => m.type === 'agentToolStart');
    expect(start?.toolName).toBe('Bash');
    expect(String(start?.toolId)).toMatch(/^hook-/);
  });
});
