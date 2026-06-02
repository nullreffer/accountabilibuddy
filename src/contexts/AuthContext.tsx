import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  userProfile: UserProfile | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toDate = (value: Timestamp | Date | undefined) => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const mapUserProfile = (uid: string, data: DocumentData | undefined): UserProfile | null => {
  if (!data) {
    return null;
  }

  return {
    uid,
    displayName: (data.displayName as string) ?? '',
    email: (data.email as string) ?? '',
    photoURL: (data.photoURL as string) ?? '',
    createdAt: toDate(data.createdAt as Timestamp | Date | undefined),
    fcmTokens: Array.isArray(data.fcmTokens) ? (data.fcmTokens as string[]) : []
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = undefined;
      }

      if (!firebaseUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
        setUserProfile(mapUserProfile(firebaseUser.uid, snapshot.data()));
        setLoading(false);
      });
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const userRef = doc(db, 'users', result.user.uid);
    const existing = await getDoc(userRef);

    await setDoc(
      userRef,
      {
        uid: result.user.uid,
        displayName: result.user.displayName ?? 'AccountabiliBuddy User',
        email: result.user.email ?? '',
        photoURL: result.user.photoURL ?? '',
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        fcmTokens: existing.exists() && Array.isArray(existing.data().fcmTokens) ? existing.data().fcmTokens : []
      },
      { merge: true }
    );
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      userProfile
    }),
    [loading, user, userProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
