import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import BrandMark from './BrandMark';
import InstallPrompt from './InstallPrompt';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
      if (window.innerWidth > 1024) {
        setNavMenuOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (navMenuRef.current && !navMenuRef.current.contains(target)) {
        setNavMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const menuLinkClass = ({ isActive }: { isActive: boolean }) =>
    `menu-dropdown__link${isActive ? ' menu-dropdown__link--active' : ''}`;

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
        <Link className="navbar__brand-link" to="/dashboard">
          <BrandMark className="navbar__logo" />
          <div>
            <p className="navbar__title">Accountabilibuddy</p>
            <p className="navbar__subtitle">Hold each other accountable.</p>
          </div>
        </Link>
        <div className="menu-trigger" ref={navMenuRef}>
          <button
            aria-expanded={navMenuOpen}
            aria-label="Open navigation menu"
            className="icon-btn icon-btn--menu"
            onClick={() => {
              setNavMenuOpen((current) => !current);
              setProfileMenuOpen(false);
            }}
            type="button"
          >
            {navMenuOpen ? '✕' : '☰'}
          </button>
          {navMenuOpen ? (
            <nav className="menu-dropdown menu-dropdown--nav" aria-label="Primary navigation">
              <NavLink className={menuLinkClass} onClick={() => setNavMenuOpen(false)} to="/dashboard">
                Dashboard
              </NavLink>
              <NavLink className={menuLinkClass} onClick={() => setNavMenuOpen(false)} to="/create-group">
                Create group
              </NavLink>
              <NavLink className={menuLinkClass} onClick={() => setNavMenuOpen(false)} to="/profile">
                Profile settings
              </NavLink>
            </nav>
          ) : null}
        </div>
      </div>

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

        <div className="menu-trigger" ref={profileMenuRef}>
          <button
            aria-expanded={profileMenuOpen}
            aria-label="Open profile menu"
            className="avatar-button"
            onClick={() => {
              setProfileMenuOpen((current) => !current);
              setNavMenuOpen(false);
            }}
            type="button"
          >
            <img
              className="avatar avatar--small"
              src={user?.photoUrl || getAvatarFallback(user?.displayName || 'AB')}
              alt={user?.displayName || 'Profile'}
            />
          </button>

          {profileMenuOpen ? (
            <div className="menu-dropdown menu-dropdown--profile" role="menu">
              <div className="menu-dropdown__user">
                <p className="menu-dropdown__name">{user?.displayName}</p>
                <p className="menu-dropdown__email">{user?.email}</p>
              </div>
              <NavLink className={menuLinkClass} onClick={() => setProfileMenuOpen(false)} to="/profile">
                Profile settings
              </NavLink>
              <button className="menu-dropdown__link" onClick={cycleTheme} type="button">
                {themeLabel}
              </button>
              <button
                className="menu-dropdown__link menu-dropdown__link--danger"
                onClick={() => {
                  setProfileMenuOpen(false);
                  void signOut();
                }}
                type="button"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
