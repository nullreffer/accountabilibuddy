import { useState } from 'react';
import { resetJar, useJar } from '../hooks/useJar';
import LoadingSpinner from './LoadingSpinner';

const JarDisplay = ({ groupId, isOwner }: { groupId: string; isOwner: boolean }) => {
  const { jars, loading } = useJar(groupId);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const handleReset = async (uid: string) => {
    try {
      setBusyUid(uid);
      await resetJar(groupId, uid);
    } catch (error) {
      console.error('Unable to reset jar', error);
      window.alert('Unable to reset jar totals right now.');
    } finally {
      setBusyUid(null);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading accountability jar..." />;
  }

  if (!jars.length) {
    return <div className="empty-state">Jar totals will appear once misses are tracked.</div>;
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Misses</th>
            <th>Total Owed</th>
            {isOwner ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {jars.map((jar) => (
            <tr key={jar.uid}>
              <td>{jar.displayName}</td>
              <td>{jar.count}</td>
              <td>${jar.totalOwed.toFixed(2)}</td>
              {isOwner ? (
                <td>
                  <button
                    className="button button--ghost button--small"
                    disabled={busyUid === jar.uid}
                    onClick={() => void handleReset(jar.uid)}
                  >
                    {busyUid === jar.uid ? 'Resetting...' : 'Reset'}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default JarDisplay;
