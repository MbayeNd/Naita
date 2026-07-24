import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { AppShell } from './components/AppShell.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Loading } from './components/ui.jsx';

import SignIn from './pages/SignIn.jsx';
import Profile from './pages/Profile.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import People from './pages/People.jsx';
import Apprentices from './pages/Apprentices.jsx';
import Sessions from './pages/Sessions.jsx';
import ScheduleSession from './pages/ScheduleSession.jsx';
import SessionResults from './pages/SessionResults.jsx';
import ExaminerHome from './pages/ExaminerHome.jsx';
import MarkingSheet from './pages/MarkingSheet.jsx';
import Results from './pages/Results.jsx';
import Activity from './pages/Activity.jsx';

const COORDINATION = ['admin', 'coordinator'];
const EXAMINERS = ['chief_examiner', 'support_examiner'];

/** FR2: the same path resolves to a different dashboard per role. */
function RoleHome() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminOverview />;
  if (user.role === 'coordinator') return <Sessions />;
  return <ExaminerHome />;
}

export default function App() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading label="Starting up" />;

  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHome />} />
        <Route path="profile" element={<Profile />} />
        <Route path="results" element={<Results />} />

        <Route path="sessions" element={<ProtectedRoute roles={COORDINATION}><Sessions /></ProtectedRoute>} />
        <Route path="sessions/schedule" element={<ProtectedRoute roles={COORDINATION}><ScheduleSession /></ProtectedRoute>} />
        <Route path="sessions/:id" element={<ProtectedRoute roles={COORDINATION}><SessionResults /></ProtectedRoute>} />

        <Route path="evaluate/:sessionId" element={<ProtectedRoute roles={EXAMINERS}><MarkingSheet /></ProtectedRoute>} />

        <Route path="apprentices" element={<ProtectedRoute roles={COORDINATION}><Apprentices /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['admin']}><People /></ProtectedRoute>} />
        <Route path="activity" element={<ProtectedRoute roles={['admin']}><Activity /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
