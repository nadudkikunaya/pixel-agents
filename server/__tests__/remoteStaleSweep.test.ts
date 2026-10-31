import { afterEach, describe, expect, it } from 'vitest';

import { AgentRuntime } from '../src/agentRuntime.js';
import { AgentStateStore } from '../src/agentStateStore.js';
import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import { REMOTE_PROJECT_PREFIX, REMOTE_STALE_MS } from '../src/remoteSession.js';

/** Remote sessions that vanish without a SessionEnd (closed terminal, sleeping laptop)
 *  must not hold a character and a seat forever. */
describe('AgentRuntime -- silent remote sessions', () => {
  let runtime: AgentRuntime;
  let store: AgentStateStore;

  afterEach(() => runtime?.dispose());

  function remoteEvent(sid: string, person: string, event: string): void {
    runtime.handleHookEvent('claude', {
      hook_event_name: event,
      session_id: sid,
      tool_name: 'Bash',
      cwd: `${REMOTE_PROJECT_PREFIX}/${sid.slice(0, 8)}/${person}/repo@main`,
    });
  }

  it('removes a remote agent after it has been silent, keeps a recent one', () => {
    store = new AgentStateStore();
    runtime = new AgentRuntime(store, claudeProvider);
    remoteEvent('aaaaaaaa-1', 'nat', 'PreToolUse');
    remoteEvent('bbbbbbbb-2', 'mook', 'PreToolUse');
    expect(store.size).toBe(2);

    // mook stays active, nat goes quiet
    const [natId] = [...store.keys()];
    store.get(natId)!.lastDataAt = Date.now() - REMOTE_STALE_MS - 1000;
    runtime.sweepStaleRemoteAgents();

    expect(store.size).toBe(1);
    expect([...store.values()][0].directoryName).toBe('repo@main');
    expect(store.has(natId)).toBe(false);
  });

  it('brings the same session back on its next event', () => {
    store = new AgentStateStore();
    runtime = new AgentRuntime(store, claudeProvider);
    remoteEvent('cccccccc-3', 'nat', 'PreToolUse');
    store.get([...store.keys()][0])!.lastDataAt = 0;
    runtime.sweepStaleRemoteAgents();
    expect(store.size).toBe(0);
    remoteEvent('cccccccc-3', 'nat', 'PreToolUse');
    expect(store.size).toBe(1);
  });
});

describe('AgentRuntime -- remote sessions that began before the server did', () => {
  let runtime: AgentRuntime;
  let store: AgentStateStore;

  afterEach(() => runtime?.dispose());

  const cwd = `${REMOTE_PROJECT_PREFIX}/dddddddd/nat/repo@main`;

  it('adopts a session on its first tool event, with no SessionStart', () => {
    store = new AgentStateStore();
    runtime = new AgentRuntime(store, claudeProvider);
    runtime.handleHookEvent('claude', {
      hook_event_name: 'PreToolUse',
      session_id: 'dddddddd-4',
      tool_name: 'Bash',
      cwd,
    });
    expect(store.size).toBe(1);
  });

  it('does not create an agent for the goodbye of a session it never saw', () => {
    store = new AgentStateStore();
    runtime = new AgentRuntime(store, claudeProvider);
    runtime.handleHookEvent('claude', {
      hook_event_name: 'SessionEnd',
      session_id: 'dddddddd-5',
      reason: 'other',
      cwd,
    });
    expect(store.size).toBe(0);
  });
});
