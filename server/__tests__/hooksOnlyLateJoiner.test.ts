import { describe, expect, it } from 'vitest';

import { resendAgentActivity } from '../src/agentActivityResend.js';
import { createAgentState } from '../src/agentState.js';
import { AgentStateStore } from '../src/agentStateStore.js';
import { HookEventHandler } from '../src/hookEventHandler.js';
import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import { SessionRouter } from '../src/sessionRouter.js';

function setup() {
  const store = new AgentStateStore();
  store.set(
    1,
    createAgentState({
      id: 1,
      sessionId: 'sess-1',
      isExternal: true,
      hooksOnly: true,
      projectDir: '/pixel-agents-remote/sess-1/nat',
      jsonlFile: '',
    }),
  );
  const handler = new HookEventHandler(
    store,
    new Map(),
    new Map(),
    claudeProvider,
    new SessionRouter(),
  );
  handler.registerAgent('sess-1', 1);
  const send = (event: Record<string, unknown>) =>
    handler.handleEvent('claude', { session_id: 'sess-1', ...event } as never);
  const replay = () => {
    const out: Array<Record<string, unknown>> = [];
    resendAgentActivity((m) => out.push(m), store);
    return out;
  };
  return { send, replay };
}

describe('hooks-only agents replay open tools to viewers that join later', () => {
  it('replays the 7 sub-agents that are still running out of 10', () => {
    const { send, replay } = setup();
    for (let i = 0; i < 10; i++) {
      send({ hook_event_name: 'PreToolUse', tool_name: 'Task', tool_use_id: `toolu_${i}` });
    }
    for (let i = 0; i < 3; i++) {
      send({ hook_event_name: 'PostToolUse', tool_name: 'Task', tool_use_id: `toolu_${i}` });
    }
    const starts = replay().filter((m) => m.type === 'agentToolStart' && m.toolName === 'Task');
    expect(starts).toHaveLength(7);
  });

  it('replays an ordinary tool while it runs and forgets it once done', () => {
    const { send, replay } = setup();
    send({ hook_event_name: 'PreToolUse', tool_name: 'Edit' });
    expect(replay().filter((m) => m.type === 'agentToolStart')).toHaveLength(1);
    send({ hook_event_name: 'PostToolUse', tool_name: 'Edit' });
    expect(replay().filter((m) => m.type === 'agentToolStart')).toHaveLength(0);
  });
});
