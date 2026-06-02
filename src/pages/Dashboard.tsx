import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { fetchGroups, type Group } from '../lib/api';

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

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchGroups();
        if (!cancelled) setGroups(data as DashboardGroup[]);
      } catch (error) {
        console.error('Unable to load groups', error);
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
