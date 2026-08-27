import { useAuthenticator } from '@aws-amplify/ui-react';
import { NavLink, Outlet } from 'react-router-dom';
import { apiConfigured } from '../lib/api';
import { Banner } from './ui';

const NAV: { group: string; items: { to: string; label: string; icon: string }[] }[] = [
  { group: 'Library', items: [{ to: 'upload', label: 'Upload media', icon: '⬆️' }] },
  {
    group: 'Search',
    items: [
      { to: 'search/tags', label: 'Tags + counts', icon: '🔢' },
      { to: 'search/species', label: 'Species', icon: '🐾' },
      { to: 'search/thumbnail', label: 'Thumbnail URL', icon: '🖼️' },
      { to: 'search/file', label: 'By uploaded file', icon: '📎' },
    ],
  },
  {
    group: 'Manage',
    items: [
      { to: 'tags', label: 'Bulk tag edit', icon: '🏷️' },
      { to: 'delete', label: 'Delete files', icon: '🗑️' },
      { to: 'notifications', label: 'Notifications', icon: '🔔' },
    ],
  },
  { group: 'Account', items: [{ to: 'account', label: 'Account & tokens', icon: '🔑' }] },
];

export default function Layout() {
  const { user, signOut } = useAuthenticator((c) => [c.user]);
  const email = user?.signInDetails?.loginId ?? '';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          🦘 Aussie EcoLens <span className="dot">●</span>
        </div>
        <div className="topbar__user">
          {email && <span>{email}</span>}
          <button className="btn btn--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell">
        <nav className="sidebar">
          {NAV.map((group) => (
            <div key={group.group}>
              <div className="sidebar__group">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main className="content">
          <div className="content__inner">
            {!apiConfigured && (
              <Banner kind="info">
                Backend not connected yet. The UI is fully wired — set <code>VITE_API_BASE_URL</code> in{' '}
                <code>frontend/.env</code> once the team’s API is live, and every page below will work.
              </Banner>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
