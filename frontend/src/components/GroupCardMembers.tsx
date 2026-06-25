import { useMemo } from 'react';
import { useCheckins } from '../hooks/useCheckins';
import { useMembers } from '../hooks/useMembers';
import { getAvatarFallback } from '../lib/avatar';

/** Returns the local calendar date as YYYY-MM-DD (resets at local midnight). */
const localDateStr = (d?: Date | string) =>
  new Date(d ?? Date.now()).toLocaleDateString('en-CA');

const GroupCardMembers = ({ groupId }: { groupId: string }) => {
  const { members } = useMembers(groupId);
  const { checkins } = useCheckins(groupId, 50);

  const todayLocal = localDateStr();

  const checkedInUids = useMemo(
    () =>
      new Set(
        checkins
          .filter((c) => c.status === 'completed' && localDateStr(c.completedAt) === todayLocal)
          .map((c) => c.uid)
      ),
    [checkins, todayLocal]
  );

  if (members.length === 0) return null;

  return (
    <div className="group-card-members">
      {members.map((m) => {
        const checked = checkedInUids.has(m.uid);
        return (
          <div
            className="member-status-avatar"
            key={m.uid}
            title={`${m.displayName}${checked ? ' ✓' : ''}`}
          >
            <img
              alt={m.displayName}
              className="avatar avatar--xs"
              src={m.photoURL || getAvatarFallback(m.displayName || 'AB')}
            />
            {checked ? <span className="member-status-check" aria-hidden="true">✓</span> : null}
          </div>
        );
      })}
    </div>
  );
};

export default GroupCardMembers;
