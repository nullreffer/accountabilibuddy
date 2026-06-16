import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchInvites, createInvite as apiCreateInvite, revokeInvite as apiRevokeInvite, type Invite } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';

const InviteManager = ({ groupId, isOwner }: { groupId: string; isOwner: boolean }) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchInvites(groupId);
        if (!cancelled) setInvites(data);
      } catch {
        if (!cancelled) setInvites([]);
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
  }, [groupId]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => !invite.used && new Date(invite.expiresAt).getTime() > Date.now()),
    [invites]
  );

  const handleGenerateInvite = async () => {
    if (!user) return;

    try {
      setBusy(true);
      const result = await apiCreateInvite(groupId, null, false);
      const inviteUrl = result.inviteUrl ?? `${window.location.origin}/join/${result.token}`;
      setLastLink(inviteUrl);
      await navigator.clipboard.writeText(inviteUrl);
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
      await apiCreateInvite(groupId, email.trim(), true);
      setEmail('');
      window.alert('Invite email sent.');
    } catch (error) {
      console.error('Unable to send invite email', error);
      window.alert('Unable to send the invite email right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeInvite = async (token: string) => {
    try {
      setBusy(true);
      await apiRevokeInvite(groupId, token);
      setInvites((current) => current.filter((invite) => invite.token !== token));
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
            <h3>Bring in a new squadmate</h3>
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
                  <p className="helper-text">Expires {new Date(invite.expiresAt).toLocaleString()}</p>
                </div>
                <button
                  className="button button--ghost button--small"
                  disabled={busy}
                  onClick={() => void handleRevokeInvite(invite.token)}
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
