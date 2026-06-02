import { collection, onSnapshot, orderBy, query, setDoc, doc, updateDoc, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Jar } from '../types';

const mapJar = (id: string, data: DocumentData): Jar => ({
  uid: id,
  count: Number(data.count ?? 0),
  totalOwed: Number(data.totalOwed ?? 0),
  displayName: (data.displayName as string) ?? 'Member'
});

export const useJar = (groupId: string) => {
  const [jars, setJars] = useState<Jar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setJars([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'groups', groupId, 'jars'), orderBy('totalOwed', 'desc')),
      (snapshot) => {
        setJars(snapshot.docs.map((docSnapshot) => mapJar(docSnapshot.id, docSnapshot.data())));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  return { jars, loading };
};

export const resetJar = async (groupId: string, uid: string): Promise<void> => {
  const jarRef = doc(db, 'groups', groupId, 'jars', uid);

  try {
    await updateDoc(jarRef, {
      count: 0,
      totalOwed: 0
    });
  } catch {
    await setDoc(
      jarRef,
      {
        count: 0,
        totalOwed: 0,
        displayName: 'Member'
      },
      { merge: true }
    );
  }
};
