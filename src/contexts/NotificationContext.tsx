import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { requestNotificationPermission } from '../lib/push';
import { useAuth } from './AuthContext';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    void requestNotificationPermission();
  }, [user]);

  const dismissNotification = (id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  const value = useMemo(
    () => ({
      notifications,
      dismissNotification
    }),
    [notifications]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {notifications.map((item) => (
          <div className="toast" key={item.id}>
            <div>
              <p className="toast__title">{item.title}</p>
              <p className="toast__body">{item.body}</p>
            </div>
            <button className="button button--ghost button--small" onClick={() => dismissNotification(item.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }

  return context;
};
