import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import CreateGroupPage from './pages/CreateGroupPage';
import Dashboard from './pages/Dashboard';
import GroupPage from './pages/GroupPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import JoinPage from './pages/JoinPage';
import LoginPage from './pages/LoginPage';

const AppLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const showNavbar = Boolean(user) && location.pathname !== '/login';

  return (
    <div className="app-shell">
      {showNavbar ? <Navbar /> : null}
      <main className="app-shell__content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-group"
            element={
              <PrivateRoute>
                <CreateGroupPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/group/:groupId"
            element={
              <PrivateRoute>
                <GroupPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/group/:groupId/settings"
            element={
              <PrivateRoute>
                <GroupSettingsPage />
              </PrivateRoute>
            }
          />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
