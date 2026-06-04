import { useState } from 'react';
import { resetJar, updateJar, useJar } from '../hooks/useJar';
import LoadingSpinner from './LoadingSpinner';

const JarDisplay = ({ groupId, isOwner }: { groupId: string; isOwner: boolean }) => {
  const { jars, loading } = useJar(groupId);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [editCount, setEditCount] = useState('');
  const [editOwed, setEditOwed] = useState('');

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

  const openEdit = (uid: string, count: number, totalOwed: number) => {
    setEditUid(uid);
    setEditCount(String(count));
    setEditOwed(totalOwed.toFixed(2));
  };

  const handleUpdate = async (uid: string) => {
    const count = Number(editCount);
    const totalOwed = Number(editOwed);
    if (isNaN(count) || count < 0 || isNaN(totalOwed) || totalOwed < 0) {
      window.alert('Please enter valid non-negative values.');
      return;
    }
    try {
      setBusyUid(uid);
      await updateJar(groupId, uid, { count, totalOwed });
      setEditUid(null);
    } catch (error) {
      console.error('Unable to update jar', error);
      window.alert('Unable to update jar contribution right now.');
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
            <>
              <tr key={jar.uid}>
                <td>{jar.displayName}</td>
                <td>{jar.count}</td>
                <td>${jar.totalOwed.toFixed(2)}</td>
                {isOwner ? (
                  <td>
                    <button
                      className="button button--ghost button--small"
                      disabled={busyUid === jar.uid}
                      onClick={() => openEdit(jar.uid, jar.count, jar.totalOwed)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Edit
                    </button>
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
              {isOwner && editUid === jar.uid ? (
                <tr key={`${jar.uid}-edit`}>
                  <td colSpan={4}>
                    <div className="stack-md" style={{ padding: '0.75rem 0' }}>
                      <label className="field">
                        <span>Misses</span>
                        <input
                          className="input"
                          min="0"
                          onChange={(e) => setEditCount(e.target.value)}
                          step="1"
                          type="number"
                          value={editCount}
                        />
                      </label>
                      <label className="field">
                        <span>Total Owed ($)</span>
                        <input
                          className="input"
                          min="0"
                          onChange={(e) => setEditOwed(e.target.value)}
                          step="0.01"
                          type="number"
                          value={editOwed}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="button button--primary button--small"
                          disabled={busyUid === jar.uid}
                          onClick={() => void handleUpdate(jar.uid)}
                        >
                          {busyUid === jar.uid ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => setEditUid(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default JarDisplay;
