import { useEffect, useState } from 'react';
import {
  fetchMembers,
  updateMember,
  removeMember as apiRemoveMember,
  type GroupMember
} from '../lib/api';

export const useMembers = (groupId: string) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchMembers(groupId);
        if (!cancelled) setMembers(data);
      } catch {
        if (!cancelled) setMembers([]);
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

  return { members, loading };
};

export const promoteToCoOwner = async (groupId: string, uid: string): Promise<void> => {
  await updateMember(groupId, uid, { role: 'coowner' });
};

export const removeMember = async (groupId: string, uid: string): Promise<void> => {
  await apiRemoveMember(groupId, uid);
};

export const updateNotifications = async (
  groupId: string,
  uid: string,
  enabled: boolean
): Promise<void> => {
  await updateMember(groupId, uid, { notificationsEnabled: enabled });
};
