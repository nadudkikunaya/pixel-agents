/** Where the viewer's choice is kept (the browser's localStorage in the app). */
export interface PreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const VIEWER_SOUND_KEY = 'pixelAgents.soundEnabled';

/**
 * Sound on/off for one viewer. In a shared office the server-side setting is one value
 * for everyone, so the viewer's own choice (kept in their browser) wins over the
 * server default that `settingsLoaded` pushes.
 */
export function createSoundPreference(store: PreferenceStore) {
  let enabled = true;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const readViewerChoice = (): boolean | null => {
    try {
      const raw = store.getItem(VIEWER_SOUND_KEY);
      return raw === 'true' ? true : raw === 'false' ? false : null;
    } catch {
      return null;
    }
  };

  return {
    isEnabled: () => enabled,
    /** The server's default; the viewer's own choice, if any, wins. */
    applyServerDefault(value: boolean): void {
      enabled = readViewerChoice() ?? value;
      notify();
    },
    /** The viewer flipped the mute button or the settings checkbox. */
    setViewerChoice(value: boolean): void {
      enabled = value;
      try {
        store.setItem(VIEWER_SOUND_KEY, String(value));
      } catch {
        // Private window or blocked storage: the choice lasts until reload.
      }
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
