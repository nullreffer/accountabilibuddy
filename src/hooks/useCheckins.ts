import { useEffect, useState } from 'react';
import { fetchCheckins, fetchAllCheckins, type Checkin } from '../lib/api';

export const useCheckins = (groupId: string, limitCount = 20) => {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setCheckins([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchCheckins(groupId, limitCount);
        if (!cancelled) setCheckins(data);
      } catch {
        if (!cancelled) setCheckins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => void load(), 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchAllCheckins(groupId, dateRange);
        if (!cancelled) setCheckins(data);
      } catch {
        if (!cancelled) setCheckins([]);
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
  }, [groupId, dateRange]);

  return { checkins, loading };
};

