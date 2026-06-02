import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchGroup, fetchMembers, type Group, type GroupMember } from '../lib/api';

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

    let cancelled = false;

    const load = async () => {
      try {
        const [groupData, members] = await Promise.all([
          fetchGroup(groupId),
          fetchMembers(groupId)
        ]);

        if (cancelled) return;

        setGroup(groupData);
        setError(null);

        const me = members.find((m) => m.uid === user.id) ?? null;
        setMember(me);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load group');
          setGroup(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void load();
    const interval = setInterval(() => void load(), 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [groupId, user]);

  return { group, member, loading, error };
};
