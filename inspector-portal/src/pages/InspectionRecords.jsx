import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { fetchInspections } from '../data/api';
import { getPendingInspections } from '../data/offlineQueue';

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InspectionRecords() {
  const [records, setRecords] = useState([]);
  const [pendingInspections, setPendingInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function refreshRecords() {
      if (refreshing) return;
      refreshing = true;
      setLoading(true);
      try {
        const latest = await fetchInspections();
        if (active) {
          setRecords(latest);
          setError('');
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load inspection records.');
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    }

    async function refreshPending() {
      const pending = await getPendingInspections().catch(() => []);
      if (active) setPendingInspections(pending);
    }
    const refreshOnFocus = () => {
      void refreshRecords();
      void refreshPending();
    };
    void refreshRecords();
    void refreshPending();
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('online', refreshOnFocus);
    const refreshTimer = window.setInterval(refreshOnFocus, 5000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('online', refreshOnFocus);
    };
  }, [refreshKey]);

  const filteredRecords = records.filter((item) => statusFilter === 'All' || item.status === statusFilter);
  const filteredPendingInspections = pendingInspections.filter((item) => statusFilter === 'All' || statusFilter === 'Submitted');

  return (
    <>
      <div className="page-header">
        <div className="page-eyebrow">Inspector Portal</div>
        <h1 className="page-title">Inspection Records</h1>
        <p className="page-description">Inspection records returned by the backend and refreshed automatically.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh records'}
        </button>
        <label className="records-status-filter">
          Filter by status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            <option value="Verified">Verified</option>
            <option value="Submitted">Submitted</option>
            <option value="Flagged">Flagged</option>
          </select>
        </label>
      </div>
      <div className="list-panel">
        {loading && <div className="list-empty">Loading records…</div>}
        {!loading && error && <div className="list-empty">{error}</div>}
        {!loading && !error && filteredRecords.length === 0 && filteredPendingInspections.length === 0 && <div className="list-empty">No {statusFilter === 'All' ? '' : `${statusFilter.toLowerCase()} `}inspection records found.</div>}
        {!loading && !error && filteredRecords.map((item) => (
          <Link key={item.id} to={`/records/${item.id}`} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">{item.location}</div>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <StatusBadge status={item.status} />
          </Link>
        ))}
        {filteredPendingInspections.map((item) => (
          <div key={item.client_submission_id} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">Saved on this device · {item.location}</div>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <span className="status-badge status-submitted">Pending sync</span>
          </div>
        ))}
      </div>
    </>
  );
}
