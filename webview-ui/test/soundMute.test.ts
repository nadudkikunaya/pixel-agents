import { describe, expect, it, vi } from 'vitest';

import { createSoundPreference, type PreferenceStore } from '../src/soundPreference.js';

function memoryStore(initial: Record<string, string> = {}): PreferenceStore {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const blockedStore: PreferenceStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('viewer mute', () => {
  it('takes the server default when the viewer never chose', () => {
    const pref = createSoundPreference(memoryStore());
    pref.applyServerDefault(false);
    expect(pref.isEnabled()).toBe(false);
    pref.applyServerDefault(true);
    expect(pref.isEnabled()).toBe(true);
  });

  it('keeps a viewer muted when the server default arrives afterwards', () => {
    const pref = createSoundPreference(memoryStore());
    pref.setViewerChoice(false);
    pref.applyServerDefault(true);
    expect(pref.isEnabled()).toBe(false);
  });

  it('remembers the choice across reloads', () => {
    const store = memoryStore();
    createSoundPreference(store).setViewerChoice(false);
    const reloaded = createSoundPreference(store);
    reloaded.applyServerDefault(true);
    expect(reloaded.isEnabled()).toBe(false);
  });

  it('survives blocked storage', () => {
    const pref = createSoundPreference(blockedStore);
    pref.setViewerChoice(false);
    expect(pref.isEnabled()).toBe(false);
    pref.applyServerDefault(true);
    expect(pref.isEnabled()).toBe(true);
  });

  it('tells listeners when the state flips, until they unsubscribe', () => {
    const pref = createSoundPreference(memoryStore());
    const seen = vi.fn();
    const off = pref.subscribe(seen);
    pref.setViewerChoice(false);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    pref.setViewerChoice(true);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
