import { doc, onSnapshot, type DocumentData, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { Group, GroupMember } from '../types';

const toDate = (value: Timestamp | Date | undefined) => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const mapGroup = (groupId: string, data: DocumentData): Group => ({
  id: groupId,
  name: (data.name as string) ?? '',
  description: (data.description as string) ?? '',
  ownerId: (data.ownerId as string) ?? '',
  coOwnerIds: Array.isArray(data.coOwnerIds) ? (data.coOwnerIds as string[]) : [],
  createdAt: toDate(data.createdAt as Timestamp | Date | undefined),
  settings: {
    photoProofRequired: Boolean(data.settings?.photoProofRequired),
    jarEnabled: Boolean(data.settings?.jarEnabled),
    jarAmount: Number(data.settings?.jarAmount ?? 0)
  }
});

const mapMember = (data: DocumentData): GroupMember => ({
  uid: (data.uid as string) ?? '',
  role: (data.role as GroupMember['role']) ?? 'member',
  notificationsEnabled: Boolean(data.notificationsEnabled),
  joinedAt: toDate(data.joinedAt as Timestamp | Date | undefined),
  displayName: (data.displayName as string) ?? '',
  email: (data.email as string) ?? '',
  photoURL: (data.photoURL as string) ?? ''
});

export const useGroup = (groupId: string) => {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !user) {
      setGroup(null);
      setMember(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      onSnapshot(
        doc(db, 'groups', groupId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setError('Group not found.');
            setGroup(null);
            setLoading(false);
            return;
          }

          setGroup(mapGroup(snapshot.id, snapshot.data()));
          setError(null);
          setLoading(false);
        },
        (snapshotError) => {
          setError(snapshotError.message);
          setLoading(false);
        }
      )
    );

    unsubscribers.push(
      onSnapshot(doc(db, 'groups', groupId, 'members', user.uid), (snapshot) => {
        setMember(snapshot.exists() ? mapMember(snapshot.data()) : null);
      })
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [groupId, user]);

  return { group, member, loading, error };
};
