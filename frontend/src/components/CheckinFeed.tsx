import { useCheckins } from '../hooks/useCheckins';
import { getAvatarFallback } from '../lib/avatar';
import LoadingSpinner from './LoadingSpinner';

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const CheckinFeed = ({ groupId }: { groupId: string }) => {
  const { checkins, loading } = useCheckins(groupId, 20);

  if (loading) {
    return <LoadingSpinner label="Loading recent check-ins..." />;
  }

  if (!checkins.length) {
    return null;
  }

  return (
    <div className="feed-list">
      {checkins.map((checkin) => (
        <article className="feed-item" key={checkin.id}>
          <img
            className="avatar feed-item__avatar"
            src={checkin.userPhotoURL || getAvatarFallback(checkin.userDisplayName || 'AB')}
            alt={checkin.userDisplayName}
          />
          <div className="feed-item__content">
            <div className="feed-item__header">
              <div className="feed-item__info">
                <h3>{checkin.userDisplayName}</h3>
                <p>{new Date(checkin.completedAt).toLocaleString()}</p>
              </div>
              {checkin.status === 'completed' ? (
                checkin.durationSeconds != null ? (
                  <span className="badge badge--success feed-item__status feed-item__status--timer" title="Completed">
                    ✅ {formatDuration(checkin.durationSeconds)}
                  </span>
                ) : (
                  <span className="badge badge--success feed-item__status" title="Completed">✅</span>
                )
              ) : (
                <span className="badge badge--warning feed-item__status" title="Missed">⏳</span>
              )}
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
