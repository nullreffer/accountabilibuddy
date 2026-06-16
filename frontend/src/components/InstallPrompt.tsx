import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const InstallPrompt = ({ compact = false }: { compact?: boolean }) => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const canInstallOnIos = isIosDevice && !isStandalone;

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setDismissed(true);
      setShowIosInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent && canInstallOnIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      setDismissed(true);
    }
  };

  if ((!installEvent && !canInstallOnIos) || dismissed) {
    return null;
  }

  if (compact) {
    return (
      <button className="button button--secondary button--small" onClick={() => void handleInstall()}>
        Install SquadGoals
      </button>
    );
  }

  return (
    <div className="install-prompt">
      <div>
        <p className="install-prompt__title">{canInstallOnIos ? 'Install SquadGoals on your phone' : 'Add SquadGoals to your Home Screen'}</p>
        <p className="install-prompt__body">
          {canInstallOnIos
            ? 'Use Safari’s share menu, then tap “Add to Home Screen” to install SquadGoals.'
            : 'Install SquadGoals for faster access, reminders, and push notifications.'}
        </p>
        {showIosInstructions ? (
          <p className="helper-text">On iPhone, tap Share → Add to Home Screen.</p>
        ) : null}
      </div>
      <div className="install-prompt__actions">
        <button className="button button--secondary" onClick={() => void handleInstall()}>
          {canInstallOnIos ? 'Show iPhone steps' : 'Add to Home Screen'}
        </button>
        <button className="button button--ghost" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
