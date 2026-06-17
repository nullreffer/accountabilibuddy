import { GoogleLogin } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';
import { apiUrl } from '../lib/api';

const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined
  ?? window.location.origin;

const LoginPage = () => {
  const { user, signIn, signInWithToken } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'google' | 'phone' | 'apple'>('google');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [navigate, user]);

  const sendOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(apiUrl('/api/auth/phone/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = (await res.json()) as { sent?: boolean; devOtp?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return; }
      setOtpSent(true);
      if (data.devOtp) setOtp(data.devOtp);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(apiUrl('/api/auth/phone/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) { setError(data.error ?? 'Invalid code'); return; }
      signInWithToken(data.token);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const signInWithApple = async () => {
    if (!window.AppleID) { setError('Apple Sign In failed to load. Please refresh.'); return; }
    if (!APPLE_CLIENT_ID) { setError('Apple Sign In is not configured yet.'); return; }

    setError('');
    setBusy(true);
    try {
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: APPLE_REDIRECT_URI,
        usePopup: true
      });
      const response = await window.AppleID.auth.signIn();
      const idToken = response.authorization.id_token;
      const firstName = response.user?.name?.firstName;
      const lastName = response.user?.name?.lastName;
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
      const email = response.user?.email;

      const res = await fetch(apiUrl('/api/auth/apple'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, displayName, email })
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) { setError(data.error ?? 'Apple sign-in failed'); return; }
      signInWithToken(data.token);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      // User cancelled the popup — don't show an error
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('popup_closed') && !msg.includes('user_cancelled')) {
        setError('Apple sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandMark className="auth-card__logo" />
        <h1>SquadGoals</h1>
        <p className="auth-card__tagline">Hold each other accountable.</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'google' ? ' auth-tab--active' : ''}`}
            onClick={() => setTab('google')}
            type="button"
          >Google</button>
          <button
            className={`auth-tab${tab === 'apple' ? ' auth-tab--active' : ''}`}
            onClick={() => setTab('apple')}
            type="button"
          >Apple</button>
          <button
            className={`auth-tab${tab === 'phone' ? ' auth-tab--active' : ''}`}
            onClick={() => setTab('phone')}
            type="button"
          >Phone</button>
        </div>

        {tab === 'google' ? (
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse.credential) {
                void signIn(credentialResponse.credential).then(() => {
                  navigate('/dashboard', { replace: true });
                });
              }
            }}
            onError={() => { window.alert('Google sign-in failed. Please try again.'); }}
          />
        ) : tab === 'apple' ? (
          <div className="apple-auth">
            <button
              className="button button--apple"
              disabled={busy}
              onClick={() => void signInWithApple()}
              type="button"
            >
              <svg aria-hidden="true" height="18" viewBox="0 0 814 1000" width="18" xmlns="http://www.w3.org/2000/svg">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.5 0 303.1 0 247.8c0-82.2 53.3-145.4 127.7-145.4 45.4 0 83.8 29.6 112.5 29.6 27.5 0 70.3-31.3 124-31.3 19.3 0 90.8 1.9 137.6 72.3zm-171.1-99.9c22.7-26.6 39-64.4 39-102.2 0-5.1-.5-10.2-1.3-15.3-37.6 1.4-82.5 25.1-109.4 52.7-19.4 20.7-39 57.5-39 96.1 0 5.1.5 10.2 1.3 14.9 2.6.5 5.1.6 7.7.6 34.6 0 77.7-22.8 101.7-46.8z" fill="currentColor"/>
              </svg>
              {busy ? 'Signing in…' : 'Sign in with Apple'}
            </button>
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        ) : (
          <div className="phone-auth">
            {!otpSent ? (
              <>
                <input
                  aria-label="Phone number"
                  className="input"
                  disabled={busy}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  type="tel"
                  value={phone}
                />
                <button className="button button--primary" disabled={busy || !phone.trim()} onClick={() => void sendOtp()} type="button">
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </>
            ) : (
              <>
                <p className="auth-hint">Enter the 6-digit code sent to {phone}</p>
                <input
                  aria-label="OTP code"
                  className="input"
                  disabled={busy}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  type="text"
                  value={otp}
                />
                <button className="button button--primary" disabled={busy || otp.length < 6} onClick={() => void verifyOtp()} type="button">
                  {busy ? 'Verifying…' : 'Verify'}
                </button>
                <button className="button button--ghost" disabled={busy} onClick={() => { setOtpSent(false); setOtp(''); }} type="button">
                  ← Change number
                </button>
              </>
            )}
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

const LoginPage = () => {
  const { user, signIn, signInWithToken } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'google' | 'phone'>('google');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [navigate, user]);

  const sendOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(apiUrl('/api/auth/phone/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = (await res.json()) as { sent?: boolean; devOtp?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return; }
      setOtpSent(true);
      if (data.devOtp) setOtp(data.devOtp); // dev convenience
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(apiUrl('/api/auth/phone/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) { setError(data.error ?? 'Invalid code'); return; }
      signInWithToken(data.token);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandMark className="auth-card__logo" />
        <h1>SquadGoals</h1>
        <p className="auth-card__tagline">Hold each other accountable.</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'google' ? ' auth-tab--active' : ''}`}
            onClick={() => setTab('google')}
            type="button"
          >Google</button>
          <button
            className={`auth-tab${tab === 'phone' ? ' auth-tab--active' : ''}`}
            onClick={() => setTab('phone')}
            type="button"
          >Phone</button>
        </div>

        {tab === 'google' ? (
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse.credential) {
                void signIn(credentialResponse.credential).then(() => {
                  navigate('/dashboard', { replace: true });
                });
              }
            }}
            onError={() => { window.alert('Google sign-in failed. Please try again.'); }}
          />
        ) : (
          <div className="phone-auth">
            {!otpSent ? (
              <>
                <input
                  aria-label="Phone number"
                  className="input"
                  disabled={busy}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  type="tel"
                  value={phone}
                />
                <button className="button button--primary" disabled={busy || !phone.trim()} onClick={() => void sendOtp()} type="button">
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </>
            ) : (
              <>
                <p className="auth-hint">Enter the 6-digit code sent to {phone}</p>
                <input
                  aria-label="OTP code"
                  className="input"
                  disabled={busy}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  type="text"
                  value={otp}
                />
                <button className="button button--primary" disabled={busy || otp.length < 6} onClick={() => void verifyOtp()} type="button">
                  {busy ? 'Verifying…' : 'Verify'}
                </button>
                <button className="button button--ghost" disabled={busy} onClick={() => { setOtpSent(false); setOtp(''); }} type="button">
                  ← Change number
                </button>
              </>
            )}
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

