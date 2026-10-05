import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { API_BASE_URL, fetchInspection } from '../data/api';
import { inspector } from '../data/inspections';
import { fetchReverseGeocodedAddress, formatNearbyAddress } from '../../../src/lib/reverse-geocode';

function mapUrls(latitude, longitude) {
  const latitudePadding = Math.max(0.003, 500 / 111320);
  const longitudePadding = latitudePadding / Math.max(Math.cos(latitude * Math.PI / 180), 0.2);
  const bounds = [
    longitude - longitudePadding,
    latitude - latitudePadding,
    longitude + longitudePadding,
    latitude + latitudePadding,
  ].map((value) => value.toFixed(6)).join(',');
  const marker = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik&marker=${marker}`,
    external: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
  };
}

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function InspectionRecordDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState(false);
  const [capturedAddress, setCapturedAddress] = useState(null);
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    fetchInspection(id)
      .then((value) => {
        setRecord(value);
        setPhotoError(false);
      })
      .catch((err) => setError(err.message || 'Could not load the record.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (record?.latitude == null || record?.longitude == null) return undefined;
    const controller = new AbortController();
    setCapturedAddress(null);
    setAddressError('');
    fetchReverseGeocodedAddress(record.latitude, record.longitude, controller.signal)
      .then((result) => setCapturedAddress(formatNearbyAddress(result)))
      .catch((lookupError) => {
        if (!controller.signal.aborted) {
          setAddressError(lookupError.message || 'Could not look up a nearby address.');
        }
      });
    return () => controller.abort();
  }, [record?.latitude, record?.longitude]);

  if (loading) return <div className="list-empty">Loading record…</div>;
  if (error || !record) return <><Link to="/records" className="back-link">‹ Back to records</Link><div className="list-empty">{error || 'Record not found.'}</div></>;

  const locationMap = record.latitude == null || record.longitude == null
    ? null
    : mapUrls(record.latitude, record.longitude);

  return (
    <>
      <Link to="/records" className="back-link">‹ Back to records</Link>
      <div className="page-header">
        <div className="page-eyebrow">Inspection Record</div>
        <h1 className="page-title">{record.organization}</h1>
        <p className="page-description">{record.location}</p>
      </div>
      <div className="detail-panel">
        <div className="detail-grid">
          <div><div className="detail-field-label">Inspection date</div><div className="detail-field-value">{formatDate(record.date)}</div></div>
          <div><div className="detail-field-label">Inspection time</div><div className="detail-field-value">{record.time}</div></div>
          <div><div className="detail-field-label">Status</div><div className="detail-field-value"><StatusBadge status={record.status} /></div></div>
          <div><div className="detail-field-label">Record ID</div><div className="detail-field-value mono">{record.id}</div></div>
          <div><div className="detail-field-label">Inspector</div><div className="detail-field-value">{record.inspector || inspector.name}</div></div>
        </div>
        {record.notes && <><div className="detail-divider" /><div><div className="detail-field-label">Notes</div><p style={{ marginTop: 6, fontSize: 14 }}>{record.notes}</p></div></>}
        <div className="detail-divider" />
        <div className="detail-grid">
          <div><div className="detail-field-label">GPS boundary check</div><div className="detail-field-value">{record.location_check_status?.replaceAll('_', ' ') || 'Not configured'}</div></div>
          <div><div className="detail-field-label">Inspector GPS coordinates</div><div className="detail-field-value">{record.latitude == null || record.longitude == null ? 'Not captured' : `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`}</div></div>
          <div><div className="detail-field-label">GPS accuracy</div><div className="detail-field-value">{record.location_accuracy_m == null ? 'Unavailable' : `±${record.location_accuracy_m} m`}</div></div>
          <div><div className="detail-field-label">GPS capture time</div><div className="detail-field-value">{record.location_captured_at ? new Date(record.location_captured_at).toLocaleString() : 'Unavailable'}</div></div>
        </div>
        {record.latitude != null && record.longitude != null && (
          <>
            <div className="detail-divider" />
            <div>
              <div className="detail-field-label">Inspector GPS location · approximate mapped address</div>
              {!capturedAddress && !addressError && <div className="detail-field-value">Looking up nearby street and city…</div>}
              {addressError && <div className="detail-field-value">{addressError}</div>}
              {capturedAddress && (
                <>
                  <div className="detail-field-value">{capturedAddress.street}</div>
                  {capturedAddress.locality && <div className="detail-field-value">{capturedAddress.locality}</div>}
                  {capturedAddress.region && <div className="detail-field-value">{capturedAddress.region}</div>}
                  <a className="back-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Address data © OpenStreetMap contributors</a>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <section className="workflow-panel">
        <div className="workflow-section">
          <div className="workflow-section-title">Captured photo evidence</div>
          {record.photo_media_id && !photoError
            ? <img crossOrigin="anonymous" src={`${API_BASE_URL}/api/media/${encodeURIComponent(record.photo_media_id)}`} alt={`Inspection evidence for ${record.organization}`} onError={() => setPhotoError(true)} style={{ display: 'block', width: '100%', maxHeight: 520, objectFit: 'contain', marginTop: 12, background: '#000' }} />
            : <p className="workflow-section-note">{photoError ? 'The evidence photo could not be loaded.' : 'No photo is attached to this record.'}</p>}
        </div>
      </section>
      <section className="workflow-panel">
        <div className="workflow-section">
          <div className="workflow-section-title">Inspection location</div>
          {locationMap ? (
            <>
              <iframe
                title={`Map showing captured inspection location for ${record.organization}`}
                src={locationMap.embed}
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ display: 'block', width: '100%', height: 360, marginTop: 12, border: 0, borderRadius: 6 }}
              />
              <a className="back-link" href={locationMap.external} target="_blank" rel="noreferrer">Open location in OpenStreetMap ↗</a>
              <p className="workflow-section-note">Map marker uses the inspector’s captured GPS coordinates. Map display requires internet access.</p>
            </>
          ) : <p className="workflow-section-note">No GPS coordinates are available for this inspection.</p>}
        </div>
      </section>
    </>
  );
}
