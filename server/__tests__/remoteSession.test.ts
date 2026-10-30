import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import {
  describeProject,
  isRemoteProjectDir,
  parseRemoteProjectDir,
  sanitizeForRemote,
} from '../src/remoteSession.js';

describe('sanitizeForRemote', () => {
  const raw = {
    session_id: '12345678-aaaa-bbbb-cccc-1234567890ab',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'cat /home/me/secret.txt', run_in_background: true },
    cwd: '/home/me/private-project',
    transcript_path: '/home/me/.claude/projects/x/y.jsonl',
    prompt: 'my private prompt',
  };

  it('keeps status fields and drops everything that identifies content', () => {
    const out = sanitizeForRemote(raw, 'nat-pc');
    expect(out.session_id).toBe(raw.session_id);
    expect(out.hook_event_name).toBe('PreToolUse');
    expect(out.tool_name).toBe('Bash');
    expect(out.tool_input).toEqual({ run_in_background: true });
    expect(out).not.toHaveProperty('transcript_path');
    expect(out).not.toHaveProperty('prompt');
    const json = JSON.stringify(out);
    expect(json).not.toContain('secret.txt');
    expect(json).not.toContain('private-project');
    expect(json).not.toContain('/home/me');
  });

  it('replaces cwd with a synthetic remote dir whose basename is the machine', () => {
    const out = sanitizeForRemote(raw, 'nat-pc');
    expect(out.cwd).toBe('/pixel-agents-remote/12345678/nat-pc');
    expect(isRemoteProjectDir(out.cwd as string)).toBe(true);
  });

  it('adds the repo label only when one is passed, and never a path', () => {
    const off = sanitizeForRemote(raw, 'nat-pc');
    const on = sanitizeForRemote(raw, 'nat-pc', 'my-repo@feat/x y');
    expect(off.cwd).toBe('/pixel-agents-remote/12345678/nat-pc');
    expect(on.cwd).toBe('/pixel-agents-remote/12345678/nat-pc/my-repo@feat-xy');
    expect(JSON.stringify(on)).not.toContain('/home/me');
  });

  it('round-trips person and label through the synthetic dir', () => {
    const out = sanitizeForRemote(raw, 'nat-pc', 'repo@main');
    expect(parseRemoteProjectDir(out.cwd as string)).toEqual({
      person: 'nat-pc',
      label: 'repo@main',
    });
    expect(parseRemoteProjectDir('/pixel-agents-remote/abcd1234/nat-pc')).toEqual({
      person: 'nat-pc',
      label: undefined,
    });
    expect(parseRemoteProjectDir('/home/me/x')).toBeNull();
  });

  it('keeps tool_use_id and the sub-agent kind so sub-agents can be matched', () => {
    const out = sanitizeForRemote(
      {
        ...raw,
        tool_name: 'Task',
        tool_use_id: 'toolu_01',
        tool_input: { subagent_type: 'Explore', prompt: 'private prompt', description: 'private' },
      },
      'nat-pc',
    );
    expect(out.tool_use_id).toBe('toolu_01');
    expect(out.tool_input).toEqual({ subagent_type: 'Explore' });
    expect(JSON.stringify(out)).not.toContain('private');
  });

  it('omits tool_input when nothing in it is status', () => {
    const out = sanitizeForRemote({ ...raw, tool_input: { command: 'ls' } }, 'nat-pc');
    expect(out).not.toHaveProperty('tool_input');
  });
});

describe('isRemoteProjectDir', () => {
  it('only accepts the synthetic prefix', () => {
    expect(isRemoteProjectDir('/pixel-agents-remote/abc/pc')).toBe(true);
    expect(isRemoteProjectDir('\\pixel-agents-remote\\abc\\pc')).toBe(true);
    expect(isRemoteProjectDir('/home/me/pixel-agents-remote/abc')).toBe(false);
    expect(isRemoteProjectDir('/pixel-agents-remote')).toBe(false);
    expect(isRemoteProjectDir(undefined)).toBe(false);
  });
});

describe('describeProject', () => {
  it('reports repo@branch from a sub-folder and from a linked worktree', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-desc-'));
    const repo = path.join(root, 'my-repo');
    fs.mkdirSync(path.join(repo, '.git', 'worktrees', 'wt1'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/feat/login\n');
    fs.writeFileSync(
      path.join(repo, '.git', 'worktrees', 'wt1', 'HEAD'),
      'ref: refs/heads/fix/bug\n',
    );
    const wt = path.join(root, 'some-task-folder');
    fs.mkdirSync(wt);
    fs.writeFileSync(
      path.join(wt, '.git'),
      `gitdir: ${path.join(repo, '.git', 'worktrees', 'wt1')}\n`,
    );

    expect(describeProject(path.join(repo, 'src', 'deep'))).toBe('my-repo@feat/login');
    expect(describeProject(wt)).toBe('my-repo@fix/bug');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('falls back to the folder name outside git', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-nogit-'));
    expect(describeProject(dir)).toBe(path.basename(dir));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
