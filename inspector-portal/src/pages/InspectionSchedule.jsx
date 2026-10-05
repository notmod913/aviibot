import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { fetchSchedule } from '../data/api';

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InspectionSchedule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let loadingSchedule = false;
    async function loadSchedule() {
      if (loadingSchedule) return;
      loadingSchedule = true;
      setLoading(true);
      try {
        const schedule = await fetchSchedule();
        if (active) {
          setItems(schedule.filter((item) => item.status !== 'Completed'));
          setError('');
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load the inspection schedule.');
      } finally {
        loadingSchedule = false;
        if (active) setLoading(false);
      }
    }
    const refreshOnFocus = () => void loadSchedule();
    void loadSchedule();
    const timer = window.setInterval(() => void loadSchedule(), 5000);
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('online', refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('online', refreshOnFocus);
    };
  }, [refreshKey]);

  return (
    <>
      <div className="page-header">
        <div className="page-eyebrow">Inspector Portal</div>
        <h1 className="page-title">Inspection Schedule</h1>
        <p className="page-description">Inspections assigned to you by the Satark Drishti backend.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh schedule'}
        </button>
      </div>

      <div className="list-panel">
        {loading && <div className="list-empty">Loading schedule…</div>}
        {!loading && error && (
          <div className="list-empty">
            {error}<br />
            <span className="scope-note">Make sure the FastAPI backend is running on port 8000.</span>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="list-empty">No inspections assigned yet.</div>
        )}
        {!loading && !error && items.map((item) => (
          <Link key={item.id} to={`/schedule/${item.id}`} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">{item.location}</div>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <StatusBadge status={item.status} />
          </Link>
        ))}
      </div>
    </>
  );
}
