import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const InstallPrompt = ({ compact = false }: { compact?: boolean }) => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
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

  if (!installEvent || dismissed) {
    return null;
  }

  if (compact) {
    return (
      <button className="button button--secondary button--small" onClick={() => void handleInstall()}>
        Install App
      </button>
    );
  }

  return (
    <div className="install-prompt">
      <div>
        <p className="install-prompt__title">Add to Home Screen</p>
        <p className="install-prompt__body">Install Accountabilibuddy for faster access and notifications.</p>
      </div>
      <div className="install-prompt__actions">
        <button className="button button--secondary" onClick={() => void handleInstall()}>
          Add to Home Screen
        </button>
        <button className="button button--ghost" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
