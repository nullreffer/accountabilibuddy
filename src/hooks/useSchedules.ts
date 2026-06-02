import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, type DocumentData, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Schedule } from '../types';

const toDate = (value: Timestamp | Date | undefined) => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const mapSchedule = (id: string, data: DocumentData): Schedule => ({
  id,
  name: (data.name as string) ?? '',
  frequency: (data.frequency as Schedule['frequency']) ?? 'daily',
  daysOfWeek: Array.isArray(data.daysOfWeek) ? (data.daysOfWeek as number[]) : [],
  time: (data.time as string) ?? '09:00',
  timezone: (data.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  createdAt: toDate(data.createdAt as Timestamp | Date | undefined)
});

export const useSchedules = (groupId: string) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'groups', groupId, 'schedules'), orderBy('createdAt', 'asc')),
      (snapshot) => {
        setSchedules(snapshot.docs.map((docSnapshot) => mapSchedule(docSnapshot.id, docSnapshot.data())));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  return { schedules, loading };
};

export const createSchedule = async (
  groupId: string,
  data: Omit<Schedule, 'id' | 'createdAt'>
): Promise<void> => {
  await addDoc(collection(db, 'groups', groupId, 'schedules'), {
    ...data,
    createdAt: new Date()
  });
};

export const deleteSchedule = async (groupId: string, scheduleId: string): Promise<void> => {
  await deleteDoc(doc(db, 'groups', groupId, 'schedules', scheduleId));
};
