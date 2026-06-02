import { useEffect, useState } from 'react';
import {
  fetchSchedules,
  createSchedule as apiCreateSchedule,
  deleteSchedule as apiDeleteSchedule,
  type Schedule
} from '../lib/api';

export const useSchedules = (groupId: string) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchSchedules(groupId);
        if (!cancelled) setSchedules(data);
      } catch {
        if (!cancelled) setSchedules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => void load(), 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [groupId]);

  return { schedules, loading };
};

export const createSchedule = async (
  groupId: string,
  data: Omit<Schedule, 'id' | 'createdAt'>
): Promise<void> => {
  await apiCreateSchedule(groupId, data);
};

export const deleteSchedule = async (groupId: string, scheduleId: string): Promise<void> => {
  await apiDeleteSchedule(groupId, scheduleId);
};
