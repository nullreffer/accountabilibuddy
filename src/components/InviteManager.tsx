import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { app, db } from '../lib/firebase';
import type { Invite } from '../types';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const toDate = (value: Timestamp | Date | undefined) => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const mapInvite = (id: string, data: DocumentData): Invite => ({
  token: id,
  groupId: (data.groupId as string) ?? '',
  createdBy: (data.createdBy as string) ?? '',
  email: (data.email as string | null) ?? null,
  createdAt: toDate(data.createdAt as Timestamp | Date | undefined),
  expiresAt: toDate(data.expiresAt as Timestamp | Date | undefined),
  used: Boolean(data.used)
});

const functions = getFunctions(app, 'us-central1');
const sendInviteEmail = httpsCallable<
  { groupId: string; email: string; groupName: string; inviteUrl: string; inviterName: string },
  { success: boolean }
>(functions, 'sendInviteEmail');

const InviteManager = ({ groupId, isOwner }: { groupId: string; isOwner: boolean }) => {
  const { userProfile } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [groupName, setGroupName] = useState('this group');
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'groups', groupId, 'invites'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const mapped = snapshot.docs.map((docSnapshot) => mapInvite(docSnapshot.id, docSnapshot.data()));
        setInvites(mapped);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'groups', groupId), (snapshot) => {
      setGroupName((snapshot.data()?.name as string) ?? 'this group');
    });

    return () => unsubscribe();
  }, [groupId]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => !invite.used && invite.expiresAt.getTime() > Date.now()),
    [invites]
  );

  const createInvite = async (inviteEmail: string | null) => {
    const token = crypto.randomUUID();
    const inviteUrl = `${window.location.origin}/join/${token}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await setDoc(doc(db, 'groups', groupId, 'invites', token), {
      token,
      groupId,
      createdBy: userProfile?.uid ?? '',
      email: inviteEmail,
      createdAt: new Date(),
      expiresAt,
      used: false
    });

    setLastLink(inviteUrl);
    await navigator.clipboard.writeText(inviteUrl);
    return inviteUrl;
  };

  const handleGenerateInvite = async () => {
    try {
      setBusy(true);
      await createInvite(null);
      window.alert('Invite link copied to your clipboard.');
    } catch (error) {
      console.error('Unable to create invite link', error);
      window.alert('Unable to create invite link right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      window.alert('Please enter an email address.');
      return;
    }

    try {
      setBusy(true);
      const inviteUrl = await createInvite(email.trim());
      await sendInviteEmail({
        groupId,
        email: email.trim(),
        groupName,
        inviteUrl,
        inviterName: userProfile?.displayName ?? 'A friend'
      });
      setEmail('');
      window.alert('Invite email sent.');
    } catch (error) {
      console.error('Unable to send invite email', error);
      window.alert('Unable to send the invite email right now.');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (token: string) => {
    try {
      setBusy(true);
      await deleteDoc(doc(db, 'groups', groupId, 'invites', token));
    } catch (error) {
      console.error('Unable to revoke invite', error);
      window.alert('Unable to revoke invite right now.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) {
    return <div className="empty-state">Only group leaders can manage invites.</div>;
  }

  return (
    <div className="stack-lg">
      <div className="card">
        <div className="card__header">
          <div>
            <p className="eyebrow">Invite links</p>
            <h3>Bring in a new accountability buddy</h3>
          </div>
          <button className="button button--primary" disabled={busy} onClick={() => void handleGenerateInvite()}>
            Generate Invite Link
          </button>
        </div>
        {lastLink ? <p className="helper-text">Latest invite copied: {lastLink}</p> : null}
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <p className="eyebrow">Email invite</p>
            <h3>Send a direct invite</h3>
          </div>
        </div>
        <form className="form-inline" onSubmit={(event) => void handleEmailInvite(event)}>
          <input
            className="input"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="friend@example.com"
            type="email"
            value={email}
          />
          <button className="button button--secondary" disabled={busy} type="submit">
            Send Email Invite
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <p className="eyebrow">Pending invites</p>
            <h3>Outstanding links</h3>
          </div>
        </div>
        {loading ? (
          <LoadingSpinner label="Loading invites..." />
        ) : pendingInvites.length ? (
          <div className="list-group">
            {pendingInvites.map((invite) => (
              <div className="list-group__item" key={invite.token}>
                <div>
                  <p>{invite.email || 'Shareable invite link'}</p>
                  <p className="helper-text">Expires {invite.expiresAt.toLocaleString()}</p>
                </div>
                <button
                  className="button button--ghost button--small"
                  disabled={busy}
                  onClick={() => void revokeInvite(invite.token)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No pending invites.</div>
        )}
      </div>
    </div>
  );
};

export default InviteManager;
