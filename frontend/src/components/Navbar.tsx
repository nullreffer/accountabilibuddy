import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import InstallPrompt from './InstallPrompt';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme-mode') as 'system' | 'light' | 'dark') || 'system';
    } catch (error) {
      void error;
      return 'system';
    }
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolvedTheme = themeMode === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : themeMode;
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    };

    applyTheme();
    const handleChange = () => applyTheme();
    mediaQuery.addEventListener('change', handleChange);

    try {
      localStorage.setItem('theme-mode', themeMode);
    } catch (error) {
      void error;
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [themeMode]);

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

  const cycleTheme = () => {
    setThemeMode((current) => {
      if (current === 'system') return 'dark';
      if (current === 'dark') return 'light';
      return 'system';
    });
  };

  const themeLabel = themeMode === 'system' ? 'Use dark theme' : themeMode === 'dark' ? 'Use light theme' : 'Use browser theme';
  const themeIcon = themeMode === 'system' ? '🖥️' : themeMode === 'dark' ? '🌙' : '☀️';

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
          onClick={cycleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          {themeIcon}
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
