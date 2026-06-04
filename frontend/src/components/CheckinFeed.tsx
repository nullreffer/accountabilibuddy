import { useCheckins } from '../hooks/useCheckins';
import { getAvatarFallback } from '../lib/avatar';
import LoadingSpinner from './LoadingSpinner';

const CheckinFeed = ({ groupId }: { groupId: string }) => {
  const { checkins, loading } = useCheckins(groupId, 20);

  if (loading) {
    return <LoadingSpinner label="Loading recent check-ins..." />;
  }

  if (!checkins.length) {
    return <div className="empty-state">No check-ins yet. Be the first to keep the streak alive.</div>;
  }

  return (
    <div className="feed-list">
      {checkins.map((checkin) => (
        <article className="feed-item" key={checkin.id}>
          <img
            className="avatar"
            src={checkin.userPhotoURL || getAvatarFallback(checkin.userDisplayName || 'AB')}
            alt={checkin.userDisplayName}
          />
          <div className="feed-item__content">
            <div className="feed-item__header">
              <div>
                <h3>{checkin.userDisplayName}</h3>
                <p>{new Date(checkin.completedAt).toLocaleString()}</p>
              </div>
              <span className={`badge ${checkin.status === 'completed' ? 'badge--success' : 'badge--warning'}`}>
                {checkin.status === 'completed' ? '✅ Completed' : '⚠️ Missed'}
              </span>
            </div>
            {checkin.photoURL ? (
              <img className="feed-item__photo" src={checkin.photoURL} alt="Check-in proof" />
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
};

export default CheckinFeed;
