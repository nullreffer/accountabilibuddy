import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAllCheckins } from '../hooks/useCheckins';
import { promoteToCoOwner, removeMember, updateNotifications, useMembers } from '../hooks/useMembers';
import { useSchedules } from '../hooks/useSchedules';
import { getAvatarFallback } from '../lib/avatar';
import { getScheduleDateKey, hasScheduleStarted } from '../lib/schedules';
import { pokeMember } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';

const MemberList = ({ groupId, currentUserRole }: { groupId: string; currentUserRole: string }) => {
  const { user } = useAuth();
  const { members, loading } = useMembers(groupId);
  const { schedules } = useSchedules(groupId);
  const { checkins } = useAllCheckins(groupId, '7d');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const canManage = currentUserRole === 'owner' || currentUserRole === 'coowner';
  const isOwner = currentUserRole === 'owner';
  const pendingByMember = useMemo(() => {
    const now = new Date();
    const dueSchedules = schedules.filter((schedule) => hasScheduleStarted(schedule, now));
    const completedIds = new Set(
      checkins.filter((checkin) => checkin.status === 'completed').map((checkin) => checkin.id)
    );

    return new Map(
      members.map((member) => {
        const overdueSchedules = dueSchedules.filter(
          (schedule) =>
            !completedIds.has(`${schedule.id}_${member.uid}_${getScheduleDateKey(schedule, now)}`)
        );

        return [
          member.uid,
          {
            count: overdueSchedules.length,
            labels: overdueSchedules.map((schedule) => schedule.name)
          }
        ];
      })
    );
  }, [checkins, members, schedules]);

  const handlePromote = async (uid: string) => {
    try {
      setBusyAction(`promote-${uid}`);
      await promoteToCoOwner(groupId, uid);
    } catch (error) {
      console.error('Unable to promote member', error);
      window.alert('Unable to promote that member right now.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemove = async (uid: string) => {
    const confirmed = window.confirm('Remove this member from the group?');
    if (!confirmed) {
      return;
    }

    try {
      setBusyAction(`remove-${uid}`);
      await removeMember(groupId, uid);
    } catch (error) {
      console.error('Unable to remove member', error);
      window.alert('Unable to remove that member right now.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleNotificationToggle = async (uid: string, enabled: boolean) => {
    try {
      setBusyAction(`notifications-${uid}`);
      await updateNotifications(groupId, uid, enabled);
    } catch (error) {
      console.error('Unable to update notifications', error);
      window.alert('Unable to update notifications right now.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePoke = async (uid: string) => {
    try {
      setBusyAction(`poke-${uid}`);
      await pokeMember(groupId, uid);
      window.alert('Poke sent.');
    } catch (error) {
      console.error('Unable to send poke', error);
      window.alert(error instanceof Error ? error.message : 'Unable to send a poke right now.');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading members..." />;
  }

  return (
    <div className="member-list">
      {members.map((member, index) => {
        const isSelf = member.uid === user?.id;
        const canPromote = isOwner && member.role === 'member';
        const canRemove = canManage && !isSelf && member.role !== 'owner';
        const pending = pendingByMember.get(member.uid) ?? { count: 0, labels: [] };
        const canPoke = !isSelf && pending.count > 0;
        const showActions = canManage || canPoke;

        return (
          <article className={`member-card${pending.count ? ' member-card--pending' : ''}`} key={member.uid}>
            <div className="member-card__identity">
              <span className="leaderboard-rank">#{index + 1}</span>
              <img
                className="avatar"
                src={member.photoURL || getAvatarFallback(member.displayName || 'AB')}
                alt={member.displayName}
              />
              <div>
                <h3>{member.displayName}</h3>
                <p>{member.email}</p>
              </div>
            </div>
            <div className="member-card__meta">
              <span className="badge badge--warning">⭐ {member.starCount}</span>
              <span className="badge badge--neutral">{member.role}</span>
              <label className="toggle-inline">
                <input
                  checked={member.notificationsEnabled}
                  disabled={!isSelf || busyAction === `notifications-${member.uid}`}
                  onChange={(event) =>
                    void handleNotificationToggle(member.uid, event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                Notifications
              </label>
            </div>
            {showActions ? (
              <div className="member-card__actions">
                {canPoke ? (
                  <button
                    className="button button--secondary button--small"
                    disabled={busyAction === `poke-${member.uid}`}
                    onClick={() => void handlePoke(member.uid)}
                  >
                    Poke
                  </button>
                ) : null}
                {canPromote ? (
                  <button
                    className="button button--ghost button--small"
                    disabled={busyAction === `promote-${member.uid}`}
                    onClick={() => void handlePromote(member.uid)}
                  >
                    Promote to co-owner
                  </button>
                ) : null}
                {canRemove ? (
                  <button
                    className="button button--danger button--small"
                    disabled={busyAction === `remove-${member.uid}`}
                    onClick={() => void handleRemove(member.uid)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ) : null}
            {pending.count ? (
              <p className="helper-text member-card__status">
                Waiting on {pending.count} task{pending.count === 1 ? '' : 's'}
                {pending.labels.length ? `: ${pending.labels.join(', ')}` : ''}.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
};

export default MemberList;
