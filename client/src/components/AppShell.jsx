import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../context/AuthContext.jsx';

const NAV_BY_ROLE = {
  admin: [
    { to: '/', label: 'Overview', end: true },
    { to: '/sessions', label: 'Sessions' },
    { to: '/apprentices', label: 'Apprentices' },
    { to: '/users', label: 'People' },
    { to: '/results', label: 'Results' },
    { to: '/activity', label: 'Activity log' },
  ],
  coordinator: [
    { to: '/', label: 'Sessions', end: true },
    { to: '/sessions/schedule', label: 'Schedule a session' },
    { to: '/apprentices', label: 'Apprentices' },
    { to: '/results', label: 'Results' },
  ],
  chief_examiner: [
    { to: '/', label: 'My sessions', end: true },
    { to: '/results', label: 'Past evaluations' },
  ],
  support_examiner: [
    { to: '/', label: 'My sessions', end: true },
    { to: '/results', label: 'Past evaluations' },
  ],
};

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const links = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail-mark">
          NAITA
          <span>Project Evaluation</span>
        </div>

        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/profile">My profile</NavLink>
        </nav>

        <div className="rail-foot">
          <div className="who">{user.name}</div>
          <div className="role">{ROLE_LABELS[user.role]}</div>
          <button
            type="button"
            className="btn ghost small"
            style={{ marginTop: 10, color: '#dfe6e3', borderColor: 'rgba(255,255,255,0.25)' }}
            onClick={() => { signOut(); navigate('/sign-in'); }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
