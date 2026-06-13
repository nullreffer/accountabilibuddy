import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import { useState } from 'react';

const ProfilePage = () => {
  const { user, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const joinDate = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      window.alert('Display name is required.');
      return;
    }

    try {
      setSaving(true);
      await updateProfile({
        displayName: displayName.trim(),
        photoUrl: photoUrl.trim()
      });
    } catch (error) {
      console.error('Unable to update profile', error);
      window.alert(error instanceof Error ? error.message : 'Unable to update your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page page--narrow stack-lg">
      <h1 className="section-title">Profile</h1>

      <div className="card stack-lg">
        <div className="profile-header">
          <img
            className="avatar--large"
            src={photoUrl || user.photoUrl || getAvatarFallback(displayName || user.displayName)}
            alt={displayName || user.displayName}
          />
          <div>
            <p className="profile-header__name">{displayName || user.displayName}</p>
            <p className="profile-header__email">{user.email}</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field field--full">
            <span>Display name</span>
            <input className="input" onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
          </label>
          <label className="field field--full">
            <span>Profile photo URL</span>
            <input
              className="input"
              onChange={(event) => setPhotoUrl(event.target.value)}
              placeholder="https://example.com/avatar.png"
              type="url"
              value={photoUrl}
            />
          </label>
          <div className="field">
            <span className="field__label" style={{ marginBottom: '0.15rem' }}>Member since</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{joinDate}</span>
          </div>
          <div className="field">
            <span className="field__label" style={{ marginBottom: '0.15rem' }}>Email verified</span>
            <span style={{ color: user.emailVerified ? 'var(--secondary)' : 'var(--warning)', fontSize: '0.95rem', fontWeight: 600 }}>
              {user.emailVerified ? '✓ Verified' : '⚠ Not verified'}
            </span>
          </div>
        </div>

        <div className="form-actions">
          <button className="button button--primary" disabled={saving} onClick={() => void handleSave()} type="button">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>

      <button className="button button--ghost profile-signout" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
};

export default ProfilePage;
