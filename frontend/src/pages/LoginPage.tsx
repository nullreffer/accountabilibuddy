import { GoogleLogin } from '@react-oauth/google';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';

const LoginPage = () => {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandMark className="auth-card__logo" />
        <h1>Accountabilibuddy</h1>
        <p className="auth-card__tagline">Hold each other accountable.</p>
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              void signIn(credentialResponse.credential).then(() => {
                navigate('/dashboard', { replace: true });
              });
            }
          }}
          onError={() => {
            window.alert('Google sign-in failed. Please try again.');
          }}
        />
      </div>
    </div>
  );
};

export default LoginPage;
