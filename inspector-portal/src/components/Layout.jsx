import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { createInspection } from '../data/api';
import { inspector } from '../data/inspections';
import { getPendingInspections, removePendingInspection } from '../data/offlineQueue';
import { clearStoredSession } from '../../../src/lib/auth';

const NAV_ITEMS = [
  { to: '/schedule', label: 'Inspection Schedule' },
  { to: '/records', label: 'Inspection Records' },
];

export default function Layout({ inspectorName = inspector.name }) {
  useEffect(() => {
    let syncing = false;

    async function syncPendingInspections() {
      if (syncing || !navigator.onLine) return;
      syncing = true;
      try {
        const pending = await getPendingInspections();
        for (const submission of pending) {
          if (!navigator.onLine) break;
          try {
            const record = await createInspection(submission);
            await removePendingInspection(submission.client_submission_id);
            window.dispatchEvent(new CustomEvent('satark-inspection-synced', { detail: record }));
          } catch {
            break;
          }
        }
      } catch {
        // Keep queued records locally if IndexedDB or the API is unavailable.
      } finally {
        syncing = false;
      }
    }

    window.addEventListener('online', syncPendingInspections);
    void syncPendingInspections();
    const retryTimer = window.setInterval(() => void syncPendingInspections(), 15000);
    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener('online', syncPendingInspections);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-title">Satark Drishti</div>
          <div className="sidebar-brand-subtitle">Inspector Portal</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'sidebar-nav-link active' : 'sidebar-nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {inspectorName}
          <br />
          {inspector.designation}
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => {
              clearStoredSession();
              window.location.assign('/');
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="mobile-topbar">
        <span className="mobile-topbar-title">Satark Drishti · Inspector Portal</span>
      </div>
      <nav className="mobile-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'mobile-nav-link active' : 'mobile-nav-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="app-main">
        <header className="app-header">
          <div />
          <div className="app-header-inspector">
            <div className="app-header-inspector-name">{inspectorName}</div>
            <div className="app-header-inspector-role">{inspector.region}</div>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
