import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import InstallPrompt from './InstallPrompt';

const Navbar = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <span className="navbar__logo">AB</span>
        <div>
          <p className="navbar__title">Accountabilibuddy</p>
          <p className="navbar__subtitle">Hold each other accountable.</p>
        </div>
      </div>

      <nav className="navbar__links" aria-label="Primary navigation">
        <NavLink
          className={({ isActive }) => `navbar__link${isActive ? ' navbar__link--active' : ''}`}
          to="/dashboard"
        >
          Dashboard
        </NavLink>
      </nav>

      <div className="navbar__actions">
        <InstallPrompt compact />
        <div className="navbar__profile">
          <img
            className="avatar avatar--small"
            src={user?.photoUrl || getAvatarFallback(user?.displayName || 'AB')}
            alt={user?.displayName || 'Profile'}
          />
          <button className="button button--ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
