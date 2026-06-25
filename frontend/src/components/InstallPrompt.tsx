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
  const [showUnsupportedHint, setShowUnsupportedHint] = useState(false);
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
      setShowUnsupportedHint(false);
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
      // Browser doesn't support the install prompt – show an inline hint
      setShowUnsupportedHint(true);
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
      <div>
        <button className="button button--secondary button--small" onClick={() => void handleInstall()}>
          Install Squad-Goals
        </button>
        {showUnsupportedHint ? (
          <p className="helper-text" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
            Use your browser menu and look for &ldquo;Add to Home Screen&rdquo; or &ldquo;Install app&rdquo;.
          </p>
        ) : null}
        {showIosInstructions ? (
          <p className="helper-text" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
            On iPhone: tap Share → Add to Home Screen.
          </p>
        ) : null}
      </div>
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
