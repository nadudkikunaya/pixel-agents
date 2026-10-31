import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SERVER_JSON_DIR } from './constants.js';

/** Synthetic project dir for sessions that arrive from another machine. The
 *  hook sends this instead of the real cwd, so no path leaves the sender.
 *  Shape: <prefix>/<session8>/<person>[/<label>] */
export const REMOTE_PROJECT_PREFIX = '/pixel-agents-remote';

/** How long a finished remote session rests in the office before it leaves. */
export const REMOTE_REST_MS = 15 * 60 * 1000;

/** A remote session that sends nothing for this long is gone (closed terminal, sleeping
 *  laptop, killed VM never send SessionEnd). It comes back by itself on its next event. */
export const REMOTE_STALE_MS = 3 * 60 * 60 * 1000;

/** How often the runtime looks for silent remote sessions. */
export const REMOTE_SWEEP_MS = 5 * 60 * 1000;

/** File under ~/.pixel-agents/ that points a machine's hook at a shared server. */
export const REMOTE_CONFIG_NAME = 'remote.json';

export interface RemoteConfig {
  /** Base URL of the shared server, e.g. https://agents.example.com */
  url: string;
  /** The shared server's token (Bearer). */
  token: string;
  /** Person or machine name shown on the character. */
  machine: string;
  /** Opt in to sending the repo name and branch (never paths) as the label. */
  showProject: boolean;
}

/** True for the synthetic project dirs built by sanitizeForRemote. */
export function isRemoteProjectDir(dir: string | undefined): boolean {
  return !!dir && dir.replace(/\\/g, '/').startsWith(`${REMOTE_PROJECT_PREFIX}/`);
}

/** Split a synthetic remote dir back into the person and the optional project label. */
export function parseRemoteProjectDir(
  dir: string | undefined,
): { person: string; label?: string } | null {
  if (!isRemoteProjectDir(dir)) return null;
  const segments = dir!
    .replace(/\\/g, '/')
    .slice(REMOTE_PROJECT_PREFIX.length)
    .split('/')
    .filter(Boolean);
  // segments: [session8, person, label?]
  if (segments.length < 2) return null;
  return { person: segments[1], label: segments[2] };
}

/** Read ~/.pixel-agents/remote.json; null when absent or invalid. */
export function readRemoteConfig(): RemoteConfig | null {
  try {
    const file = path.join(os.homedir(), SERVER_JSON_DIR, REMOTE_CONFIG_NAME);
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    if (typeof raw.url !== 'string' || !/^https?:\/\//.test(raw.url)) return null;
    if (typeof raw.token !== 'string' || raw.token.length === 0) return null;
    const machine = String(raw.machine ?? os.hostname())
      .replace(/[^A-Za-z0-9._-]/g, '')
      .slice(0, 24);
    if (!machine) return null;
    return {
      url: raw.url.replace(/\/+$/, ''),
      token: raw.token,
      machine,
      showProject: raw.showProject === true || raw.showFolder === true,
    };
  } catch {
    return null;
  }
}

/**
 * Describe the project a session runs in as `repo@branch`, using only file reads
 * (no git process, so the hook stays fast). The repo is the git repository the
 * folder belongs to, so a session in a sub-folder or a linked worktree still reports
 * the real repo name. Falls back to the folder name outside git. Names only, never paths.
 */
export function describeProject(cwd: string): string {
  let dir = path.resolve(cwd);
  for (let i = 0; i < 40; i++) {
    const dotGit = path.join(dir, '.git');
    try {
      const stat = fs.statSync(dotGit);
      let repoDir = dir;
      let gitDir = dotGit;
      if (stat.isFile()) {
        // Linked worktree or submodule: ".git" holds "gitdir: <path>".
        const pointer = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, 'utf-8'))?.[1]?.trim();
        if (pointer) {
          gitDir = path.resolve(dir, pointer);
          const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
          const at = gitDir.indexOf(marker);
          if (at > 0) repoDir = gitDir.slice(0, at);
        }
      }
      const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
      const branch = head.startsWith('ref:')
        ? head.replace(/^ref:\s*refs\/heads\//, '')
        : head.slice(0, 7);
      return `${path.basename(repoDir)}@${branch}`;
    } catch {
      /* no .git here, keep walking up */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.basename(path.resolve(cwd));
}

/** Hook fields that carry status only. Everything else (prompts, tool input,
 *  file paths, commands, transcript path, cwd) stays on the sender. */
const STATUS_FIELDS = [
  'session_id',
  'hook_event_name',
  'source',
  'tool_name',
  'notification_type',
  'reason',
  'agent_type',
  'tool_use_id',
] as const;

/** Reduce a hook payload to status-only fields for a shared server. `label` is the
 *  optional `repo@branch` text from describeProject (already opted in by the caller). */
export function sanitizeForRemote(
  data: Record<string, unknown>,
  machine: string,
  label?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of STATUS_FIELDS) {
    const value = data[key];
    if (typeof value === 'string') out[key] = value.slice(0, 80);
  }
  // Of tool_input only the sub-agent kind and the background flag are status.
  const input = data.tool_input;
  if (typeof input === 'object' && input !== null) {
    const { run_in_background, subagent_type } = input as Record<string, unknown>;
    const status: Record<string, unknown> = {};
    if (run_in_background === true) status.run_in_background = true;
    if (typeof subagent_type === 'string') status.subagent_type = subagent_type.slice(0, 40);
    if (Object.keys(status).length > 0) out.tool_input = status;
  }
  const sid = typeof out.session_id === 'string' ? out.session_id.slice(0, 8) : 'unknown';
  const safeLabel = (label ?? '')
    .replace(/[\\/]/g, '-')
    .replace(/[^A-Za-z0-9._@-]/g, '')
    .slice(0, 64);
  out.cwd = `${REMOTE_PROJECT_PREFIX}/${sid}/${machine}${safeLabel ? `/${safeLabel}` : ''}`;
  return out;
}
