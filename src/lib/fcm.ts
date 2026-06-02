import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { app, db } from './firebase';

let messagingPromise: Promise<ReturnType<typeof getMessaging> | null> | null = null;

const getMessagingInstance = async () => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(app) : null))
      .catch(() => null);
  }

  return messagingPromise;
};

export const requestNotificationPermission = async (uid: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const messaging = await getMessagingInstance();
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!messaging || !vapidKey) {
      return false;
    }

    const token = await getToken(messaging, { vapidKey });
    if (!token) {
      return false;
    }

    await setDoc(
      doc(db, 'users', uid),
      {
        fcmTokens: arrayUnion(token)
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error('Unable to enable notifications', error);
    return false;
  }
};

export const onForegroundMessage = async (
  callback: (payload: MessagePayload) => void
): Promise<() => void> => {
  const messaging = await getMessagingInstance();
  if (!messaging) {
    return () => undefined;
  }

  return onMessage(messaging, callback);
};
