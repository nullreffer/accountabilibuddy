import { GoogleLogin } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';
import { apiUrl } from '../lib/api';

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

