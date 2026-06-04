import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { fetchInviteByToken, joinByInvite } from '../lib/api';

const JoinPage = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const loadInvite = async () => {
      try {
        setLoading(true);
        const data = await fetchInviteByToken(token);
        setGroupName(data.groupName);
        setError(null);
      } catch {
        setError('This invite link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    void loadInvite();
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      return;
    }

    try {
      setJoining(true);
      const { groupId } = await joinByInvite(token);
      navigate(`/group/${groupId}`);
    } catch (joinError) {
      console.error('Unable to join group', joinError);
      window.alert('Unable to join the group right now.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading invite..." />;
  }

  if (error) {
    return (
      <div className="page page--narrow empty-state empty-state--centered">
        <h1>Invite unavailable</h1>
        <p>{error}</p>
        <Link className="button button--ghost" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page page--narrow empty-state empty-state--centered">
        <h1>Sign in to join</h1>
        <p>You need to sign in before joining {groupName}.</p>
        <Link className="button button--primary" to="/login">
          Sign in with Google
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--narrow stack-lg">
      <section className="card stack-md">
        <p className="eyebrow">Join invite</p>
        <h1>{groupName}</h1>
        <p>You were invited to join this accountability group.</p>
        <button className="button button--primary" disabled={joining} onClick={() => void handleJoin()}>
          {joining ? 'Joining...' : 'Join Group'}
        </button>
      </section>
    </div>
  );
};

export default JoinPage;
