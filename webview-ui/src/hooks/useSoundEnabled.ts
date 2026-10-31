import { useSyncExternalStore } from 'react';

import { isSoundEnabled, subscribeSound } from '../notificationSound.js';

/** Live view of the sound on/off state, shared by the mute button and the settings checkbox. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribeSound, isSoundEnabled);
}
