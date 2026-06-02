import { collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { Group } from '../types';

interface DashboardGroup extends Group {
  memberCount: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<DashboardGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const membershipQuery = query(collectionGroup(db, 'members'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(membershipQuery, async (snapshot) => {
      if (!snapshot.docs.length) {
        setGroups([]);
        setLoading(false);
        return;
      }

      try {
        const nextGroups = await Promise.all(
          snapshot.docs.map(async (membershipDoc) => {
            const groupRef = membershipDoc.ref.parent.parent;
            if (!groupRef) {
              return null;
            }

            const [groupSnapshot, membersSnapshot] = await Promise.all([
              getDoc(doc(db, 'groups', groupRef.id)),
              getDocs(collection(db, 'groups', groupRef.id, 'members'))
            ]);

            if (!groupSnapshot.exists()) {
              return null;
            }

            const groupData = groupSnapshot.data();
            return {
              id: groupSnapshot.id,
              name: (groupData.name as string) ?? '',
              description: (groupData.description as string) ?? '',
              ownerId: (groupData.ownerId as string) ?? '',
              coOwnerIds: Array.isArray(groupData.coOwnerIds) ? (groupData.coOwnerIds as string[]) : [],
              createdAt: groupData.createdAt?.toDate?.() ?? new Date(),
              settings: {
                photoProofRequired: Boolean(groupData.settings?.photoProofRequired),
                jarEnabled: Boolean(groupData.settings?.jarEnabled),
                jarAmount: Number(groupData.settings?.jarAmount ?? 0)
              },
              memberCount: membersSnapshot.size
            } satisfies DashboardGroup;
          })
        );

        setGroups(nextGroups.filter((group): group is DashboardGroup => Boolean(group)));
      } catch (error) {
        console.error('Unable to load groups', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <LoadingSpinner label="Loading your accountability circles..." />;
  }

  return (
    <div className="page page--wide stack-xl">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Your accountability groups</h1>
          <p className="hero-card__text">Track progress, keep momentum, and celebrate every completed check-in.</p>
        </div>
        <Link className="button button--primary" to="/create-group">
          Create New Group
        </Link>
      </section>

      {groups.length ? (
        <section className="group-grid">
          {groups.map((group) => (
            <article className="group-card" key={group.id}>
              <div className="group-card__body">
                <div className="group-card__meta">
                  <span className="badge badge--neutral">{group.memberCount} members</span>
                  {group.settings.jarEnabled ? <span className="badge badge--warning">Jar on</span> : null}
                </div>
                <h2>{group.name}</h2>
                <p>{group.description || 'No description yet.'}</p>
              </div>
              <div className="group-card__footer">
                <Link className="button button--ghost" to={`/group/${group.id}`}>
                  View
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state empty-state--centered">
          <h2>No groups yet</h2>
          <p>Create your first group to start checking in together.</p>
          <Link className="button button--primary" to="/create-group">
            Create your first group
          </Link>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
