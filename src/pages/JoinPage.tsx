import { collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { Invite } from '../types';

const JoinPage = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, userProfile, signIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const loadInvite = async () => {
      try {
        setLoading(true);
        const inviteQuery = query(collectionGroup(db, 'invites'), where('token', '==', token));
        const inviteSnapshot = await getDocs(inviteQuery);

        if (inviteSnapshot.empty) {
          setError('This invite link is invalid.');
          setInvite(null);
          return;
        }

        const inviteDoc = inviteSnapshot.docs[0];
        const data = inviteDoc.data();
        const loadedInvite: Invite = {
          token: inviteDoc.id,
          groupId: (data.groupId as string) ?? '',
          createdBy: (data.createdBy as string) ?? '',
          email: (data.email as string | null) ?? null,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          expiresAt: data.expiresAt?.toDate?.() ?? new Date(),
          used: Boolean(data.used)
        };

        if (loadedInvite.used) {
          setError('This invite link has already been used.');
          setInvite(null);
          return;
        }

        if (loadedInvite.expiresAt.getTime() < Date.now()) {
          setError('This invite link has expired.');
          setInvite(null);
          return;
        }

        const groupSnapshot = await getDoc(doc(db, 'groups', loadedInvite.groupId));
        setGroupName((groupSnapshot.data()?.name as string) ?? 'Accountability group');
        setInvite(loadedInvite);
        setError(null);
      } catch (loadError) {
        console.error('Unable to load invite', loadError);
        setError('Unable to load this invite right now.');
      } finally {
        setLoading(false);
      }
    };

    void loadInvite();
  }, [token]);

  const handleJoin = async () => {
    if (!user || !userProfile || !invite) {
      return;
    }

    try {
      setJoining(true);
      const groupSnapshot = await getDoc(doc(db, 'groups', invite.groupId));
      const groupData = groupSnapshot.data();
      await setDoc(doc(db, 'groups', invite.groupId, 'members', user.uid), {
        uid: user.uid,
        role: 'member',
        notificationsEnabled: true,
        joinedAt: new Date(),
        displayName: userProfile.displayName,
        email: userProfile.email,
        photoURL: userProfile.photoURL
      });

      if (groupData?.settings?.jarEnabled) {
        await setDoc(doc(db, 'groups', invite.groupId, 'jars', user.uid), {
          uid: user.uid,
          count: 0,
          totalOwed: 0,
          displayName: userProfile.displayName
        });
      }

      await updateDoc(doc(db, 'groups', invite.groupId, 'invites', invite.token), {
        used: true
      });
      navigate(`/group/${invite.groupId}`);
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
        <button className="button button--primary" onClick={() => void signIn()}>
          Continue with Google
        </button>
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
