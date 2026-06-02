import { useEffect, useState } from 'react';
import { fetchJars, resetJar as apiResetJar, type Jar } from '../lib/api';

export const useJar = (groupId: string) => {
  const [jars, setJars] = useState<Jar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setJars([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchJars(groupId);
        if (!cancelled) setJars(data);
      } catch {
        if (!cancelled) setJars([]);
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

  return { jars, loading };
};

export const resetJar = async (groupId: string, uid: string): Promise<void> => {
  await apiResetJar(groupId, uid);
};
