import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  arrayUnion,
  arrayRemove,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { GroupMember } from '../types';

const toDate = (value: Timestamp | Date | undefined) => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const mapMember = (data: DocumentData): GroupMember => ({
  uid: (data.uid as string) ?? '',
  role: (data.role as GroupMember['role']) ?? 'member',
  notificationsEnabled: Boolean(data.notificationsEnabled),
  joinedAt: toDate(data.joinedAt as Timestamp | Date | undefined),
  displayName: (data.displayName as string) ?? '',
  email: (data.email as string) ?? '',
  photoURL: (data.photoURL as string) ?? ''
});

export const useMembers = (groupId: string) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc')),
      (snapshot) => {
        setMembers(snapshot.docs.map((docSnapshot) => mapMember(docSnapshot.data())));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  return { members, loading };
};

export const promoteToCoOwner = async (groupId: string, uid: string): Promise<void> => {
  await updateDoc(doc(db, 'groups', groupId, 'members', uid), {
    role: 'coowner'
  });

  await updateDoc(doc(db, 'groups', groupId), {
    coOwnerIds: arrayUnion(uid)
  });
};

export const removeMember = async (groupId: string, uid: string): Promise<void> => {
  await deleteDoc(doc(db, 'groups', groupId, 'members', uid));
  await updateDoc(doc(db, 'groups', groupId), {
    coOwnerIds: arrayRemove(uid)
  });
};

export const updateNotifications = async (
  groupId: string,
  uid: string,
  enabled: boolean
): Promise<void> => {
  await updateDoc(doc(db, 'groups', groupId, 'members', uid), {
    notificationsEnabled: enabled
  });
};
