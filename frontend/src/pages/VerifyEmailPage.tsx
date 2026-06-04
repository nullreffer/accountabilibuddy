import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { verifyEmail, sendVerificationEmail } from '../lib/api';

const VerifyEmailPage = () => {
  const { user, refreshUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  // If not logged in, redirect to login
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // If already verified, go to dashboard
  useEffect(() => {
    if (user?.emailVerified) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await verifyEmail(code.trim());
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    setError('');
    try {
      await sendVerificationEmail();
      setResent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend. Try again.';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="auth-card card" style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📬</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.6rem' }}>Check your email</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
          We sent a 6-digit code to <strong>{user.email}</strong>. Enter it below to verify your account.
        </p>

        <form onSubmit={e => void handleSubmit(e)} style={{ display: 'grid', gap: '1rem' }}>
          <input
            className="input verify-code-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            autoFocus
          />

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', margin: 0 }}>{error}</p>}
          {resent && <p style={{ color: 'var(--secondary)', fontSize: '0.9rem', margin: 0 }}>Code resent! Check your inbox.</p>}

          <button className="button button--primary" type="submit" disabled={submitting || code.length !== 6}>
            {submitting ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <button className="button button--ghost button--small" onClick={() => void handleResend()} disabled={resending}>
            {resending ? 'Sending…' : 'Resend code'}
          </button>
          <button
            className="button button--ghost button--small"
            style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}
            onClick={() => { signOut(); navigate('/login', { replace: true }); }}
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
