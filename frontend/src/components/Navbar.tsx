import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import InstallPrompt from './InstallPrompt';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `navbar__link${isActive ? ' navbar__link--active' : ''}`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `mobile-menu__link${isActive ? ' mobile-menu__link--active' : ''}`;

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <Link to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="navbar__logo">AB</span>
          <div>
            <p className="navbar__title">Accountabilibuddy</p>
            <p className="navbar__subtitle">Hold each other accountable.</p>
          </div>
        </Link>
      </div>

      {/* Desktop navigation */}
      <nav className="navbar__links" aria-label="Primary navigation">
        <NavLink className={navLinkClass} to="/dashboard">Dashboard</NavLink>
        <NavLink className={navLinkClass} to="/profile">Profile</NavLink>
      </nav>

      <div className="navbar__actions">
        <InstallPrompt compact />

        <button
          className="icon-btn"
          onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Desktop profile */}
        <div className="navbar__profile">
          <Link to="/profile" aria-label="View profile">
            <img
              className="avatar avatar--small"
              src={user?.photoUrl || getAvatarFallback(user?.displayName || 'AB')}
              alt={user?.displayName || 'Profile'}
            />
          </Link>
          <button className="button button--ghost button--small" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="mobile-menu" aria-label="Mobile navigation">
          <div className="mobile-menu__user">
            <img
              className="avatar avatar--small"
              src={user?.photoUrl || getAvatarFallback(user?.displayName || 'AB')}
              alt={user?.displayName || 'Profile'}
            />
            <div>
              <p className="mobile-menu__name">{user?.displayName}</p>
              <p className="mobile-menu__email">{user?.email}</p>
            </div>
          </div>
          <NavLink className={mobileLinkClass} to="/dashboard" onClick={() => setMenuOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink className={mobileLinkClass} to="/profile" onClick={() => setMenuOpen(false)}>
            Profile
          </NavLink>
          <button
            className="mobile-menu__link mobile-menu__signout"
            onClick={() => { void signOut(); setMenuOpen(false); }}
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
};

export default Navbar;

