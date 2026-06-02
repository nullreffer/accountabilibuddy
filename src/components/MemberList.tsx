import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { promoteToCoOwner, removeMember, updateNotifications, useMembers } from '../hooks/useMembers';
import { getAvatarFallback } from '../lib/avatar';
import LoadingSpinner from './LoadingSpinner';

const MemberList = ({ groupId, currentUserRole }: { groupId: string; currentUserRole: string }) => {
  const { user } = useAuth();
  const { members, loading } = useMembers(groupId);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const canManage = currentUserRole === 'owner' || currentUserRole === 'coowner';
  const isOwner = currentUserRole === 'owner';

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

  if (loading) {
    return <LoadingSpinner label="Loading members..." />;
  }

  return (
    <div className="member-list">
      {members.map((member) => {
        const isSelf = member.uid === user?.uid;
        const canPromote = isOwner && member.role === 'member';
        const canRemove = canManage && !isSelf && member.role !== 'owner';

        return (
          <article className="member-card" key={member.uid}>
            <div className="member-card__identity">
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
            {canManage ? (
              <div className="member-card__actions">
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
          </article>
        );
      })}
    </div>
  );
};

export default MemberList;
