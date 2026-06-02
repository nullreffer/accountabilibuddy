import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user]);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signIn();
      navigate(destination, { replace: true });
    } catch (error) {
      console.error('Unable to sign in', error);
      window.alert('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">AB</div>
        <h1>Accountabilibuddy</h1>
        <p className="auth-card__tagline">Hold each other accountable.</p>
        <button className="button button--primary button--large" disabled={loading} onClick={() => void handleSignIn()}>
          {loading ? 'Signing you in...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
