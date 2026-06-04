import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <h1 className="section-title" style={{ marginBottom: '1.5rem' }}>Profile</h1>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="profile-header" style={{ marginBottom: '1.5rem' }}>
          <img
            className="avatar--large"
            src={user.photoUrl || getAvatarFallback(user.displayName)}
            alt={user.displayName}
          />
          <div>
            <p className="profile-header__name">{user.displayName}</p>
            <p className="profile-header__email">{user.email}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="form-field">
            <span className="field__label" style={{ marginBottom: '0.15rem' }}>Member since</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{joinDate}</span>
          </div>
          <div className="form-field">
            <span className="field__label" style={{ marginBottom: '0.15rem' }}>Email verified</span>
            <span style={{ color: user.emailVerified ? 'var(--secondary)' : 'var(--warning)', fontSize: '0.95rem', fontWeight: 600 }}>
              {user.emailVerified ? '✓ Verified' : '⚠ Not verified'}
            </span>
          </div>
        </div>
      </div>

      <button className="button button--ghost" style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
};

export default ProfilePage;
