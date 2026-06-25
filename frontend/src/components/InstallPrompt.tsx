import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const InstallPrompt = ({ compact = false }: { compact?: boolean }) => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('install-dismissed') === '1'; } catch { return false; }
  });
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
      // Browser is offering install again – clear any previous dismissal
      try { localStorage.removeItem('install-dismissed'); } catch { /* ignore */ }
      setDismissed(false);
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
      // Browser doesn't support the install prompt (e.g. Firefox, some desktops)
      window.alert('To install Squad-Goals, use your browser\'s menu and look for "Add to Home Screen" or "Install app".');
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      setDismissed(true);
    }
  };

  if (isStandalone) {
    return null;
  }

  if (compact) {
    // Always show in compact (profile dropdown) mode when not in standalone
    return (
      <button className="button button--secondary button--small" onClick={() => void handleInstall()}>
        Install Squad-Goals
      </button>
    );
  }

  if ((!installEvent && !canInstallOnIos) || dismissed) {
    return null;
  }

  return (
    <div className="install-prompt">
      <div>
        <p className="install-prompt__title">{canInstallOnIos ? 'Install Squad-Goals on your phone' : 'Add Squad-Goals to your Home Screen'}</p>
        <p className="install-prompt__body">
          {canInstallOnIos
            ? 'Use Safari\u2019s share menu, then tap \u201cAdd to Home Screen\u201d to install Squad-Goals.'
            : 'Install Squad-Goals for faster access, reminders, and push notifications.'}
        </p>
        {showIosInstructions ? (
          <p className="helper-text">On iPhone, tap Share → Add to Home Screen.</p>
        ) : null}
      </div>
      <div className="install-prompt__actions">
        <button className="button button--secondary" onClick={() => void handleInstall()}>
          {canInstallOnIos ? 'Show iPhone steps' : 'Add to Home Screen'}
        </button>
        <button className="button button--ghost" onClick={() => {
          setDismissed(true);
          try { localStorage.setItem('install-dismissed', '1'); } catch { /* ignore */ }
        }}>
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
