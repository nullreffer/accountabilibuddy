import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Checkin } from '../types';

const toDate = (value: Timestamp | Date | undefined) => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const mapCheckin = (id: string, data: DocumentData): Checkin => ({
  id,
  uid: (data.uid as string) ?? '',
  scheduleId: (data.scheduleId as string) ?? 'manual',
  date: (data.date as string) ?? '',
  completedAt: toDate(data.completedAt as Timestamp | Date | undefined),
  photoURL: (data.photoURL as string | null) ?? null,
  status: (data.status as Checkin['status']) ?? 'completed',
  userDisplayName: (data.userDisplayName as string) ?? '',
  userPhotoURL: (data.userPhotoURL as string) ?? ''
});

export const useCheckins = (groupId: string, limitCount = 20) => {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setCheckins([]);
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [orderBy('completedAt', 'desc')];
    if (limitCount > 0) {
      constraints.push(limit(limitCount));
    }

    const checkinsQuery = query(collection(db, 'groups', groupId, 'checkins'), ...constraints);
    const unsubscribe = onSnapshot(checkinsQuery, (snapshot) => {
      setCheckins(snapshot.docs.map((docSnapshot) => mapCheckin(docSnapshot.id, docSnapshot.data())));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, limitCount]);

  return { checkins, loading };
};

export const useAllCheckins = (groupId: string, dateRange: '7d' | '30d' | 'all') => {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setCheckins([]);
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [orderBy('completedAt', 'asc')];
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
      constraints.push(where('completedAt', '>=', startDate));
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'groups', groupId, 'checkins'), ...constraints),
      (snapshot) => {
        setCheckins(snapshot.docs.map((docSnapshot) => mapCheckin(docSnapshot.id, docSnapshot.data())));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [dateRange, groupId]);

  return { checkins, loading };
};
