import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from './ui.jsx';

export function ProtectedRoute({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading label="Checking your session" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
