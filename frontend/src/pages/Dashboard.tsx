import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CreateGroupForm from '../components/CreateGroupForm';
import GroupCardMembers from '../components/GroupCardMembers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { fetchGroups, type Group } from '../lib/api';

interface DashboardGroup extends Group {
  memberCount: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<DashboardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
    return <LoadingSpinner label="Loading your Squad-Goals groups..." />;
  }

  return (
    <div className="page page--wide stack-xl">
      {groups.length ? (
        <section className="dashboard-group-list" aria-label="Your groups">
          {groups.map((group) => (
            <Link className="group-card group-card--link" key={group.id} to={`/group/${group.id}`}>
              <div className="group-card__body">
                <div className="group-card__meta">
                  <span className="badge badge--neutral">{group.memberCount} members</span>
                  {group.settings.jarEnabled ? <span className="badge badge--warning">Jar on</span> : null}
                </div>
                <h2>{group.name}</h2>
                <p>{group.description || 'No description yet.'}</p>
                <GroupCardMembers groupId={group.id} />
              </div>
              <div className="group-card__footer">
                <span className="button button--ghost">Open group</span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="empty-state empty-state--centered">
          <h2>No groups yet</h2>
          <p>Create your first group to start checking in together.</p>
          <button className="button button--primary" onClick={() => setCreateModalOpen(true)} type="button">
            Create your first group
          </button>
        </div>
      )}

      <button
        aria-label="Create new group"
        className="fab"
        onClick={() => setCreateModalOpen(true)}
        title="Create new group"
        type="button"
      >
        +
      </button>

      {createModalOpen ? (
        <div aria-modal="true" className="modal-backdrop" onClick={() => setCreateModalOpen(false)} role="dialog">
          <section className="modal-sheet modal-sheet--form" onClick={(event) => event.stopPropagation()}>
            <CreateGroupForm
              onCancel={() => setCreateModalOpen(false)}
              onCreated={(groupId) => {
                setCreateModalOpen(false);
                navigate(`/group/${groupId}`);
              }}
              submitLabel="Create group"
            />
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
