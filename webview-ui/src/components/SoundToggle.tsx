import { useSoundEnabled } from '../hooks/useSoundEnabled.js';
import { setViewerSoundEnabled } from '../notificationSound.js';
import { Button } from './ui/Button.js';

/** Speaker button: mutes or unmutes the notification chimes for this viewer only. */
export function SoundToggle({ className = '' }: { className?: string }) {
  const enabled = useSoundEnabled();
  const label = enabled ? 'Sound on (click to mute)' : 'Sound muted (click to unmute)';
  return (
    <Button
      size="icon_lg"
      onClick={() => setViewerSoundEnabled(!enabled)}
      className={`absolute z-10 border-border! shadow-pixel ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={!enabled}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 7h3l4-3v10l-4-3H2z" fill="currentColor" />
        {enabled ? (
          <>
            <path
              d="M11.5 6.5a3.5 3.5 0 0 1 0 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M13.5 4.5a6.5 6.5 0 0 1 0 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M12 6.5l4 5M16 6.5l-4 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </Button>
  );
}
