import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createInspection, fetchScheduleItem } from '../data/api';
import { removePendingInspection, savePendingInspection } from '../data/offlineQueue';
import { inspector } from '../data/inspections';

function stopStream(stream, video) {
  stream?.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}

export default function OnSiteInspection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const submissionIdRef = useRef(globalThis.crypto?.randomUUID?.() || `submission-${Date.now()}`);
  const [item, setItem] = useState(null);
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoCapturedAt, setPhotoCapturedAt] = useState(null);
  const [location, setLocation] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Camera is closed.');
  const [queued, setQueued] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => stopStream(streamRef.current, videoRef.current), []);

  useEffect(() => {
    function handleInspectionSynced(event) {
      const record = event.detail;
      if (record?.client_submission_id === submissionIdRef.current) {
        navigate(`/records/${record.id}`);
      }
    }
    window.addEventListener('satark-inspection-synced', handleInspectionSynced);
    return () => window.removeEventListener('satark-inspection-synced', handleInspectionSynced);
  }, [navigate]);

  useEffect(() => {
    fetchScheduleItem(id)
      .then((result) => {
        if (!result) throw new Error('Inspection not found.');
        setItem(result);
      })
      .catch((err) => setError(err.message || 'Could not load the inspection.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires localhost or HTTPS and a supported browser.');
      return;
    }
    try {
      stopStream(streamRef.current, videoRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
      setCameraStatus('Live camera ready.');
    } catch {
      setCameraOpen(false);
      setCameraStatus('Camera access was denied or no camera is available.');
    }
  }

  function closeCamera() {
    stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraOpen(false);
    setCameraStatus('Camera is closed.');
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError('The camera is still starting. Try again in a moment.');
      return;
    }
    const scale = Math.min(1, 1600 / video.videoWidth, 1200 / video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not capture a photo from the camera.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 6_000_000) {
      setError('The captured photo is too large to submit. Retake it in lower resolution.');
      return;
    }
    setPhotoDataUrl(dataUrl);
    setPhotoCapturedAt(new Date().toISOString());
    setError('');
    closeCamera();
    setCameraStatus('Photo captured.');
  }

  function captureLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('Location access is unavailable in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        capturedAt: new Date(position.timestamp).toISOString(),
      }),
      () => setError('Could not get your location. Allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function handleComplete() {
    if (!item) return;
    if (!photoDataUrl || !location) {
      setError('Capture both a live photo and your location before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      organization: item.organization,
      location: item.location,
      date: item.date,
      time: item.time,
      scheduled_date: item.date,
      scheduled_time: item.time,
      inspector: item.inspector || inspector.name,
      status: 'Submitted',
      notes: notes.trim() || null,
      schedule_id: item.id,
      latitude: location.latitude,
      longitude: location.longitude,
      location_accuracy_m: location.accuracy,
      location_captured_at: location.capturedAt,
      photo_captured_at: photoCapturedAt,
      client_submission_id: submissionIdRef.current,
      photo_data_url: photoDataUrl,
    };
    try {
      await savePendingInspection(payload);
      if (!navigator.onLine) {
        setQueued(true);
        return;
      }
      try {
        const record = await createInspection(payload);
        await removePendingInspection(payload.client_submission_id);
        navigate(`/records/${record.id}`);
      } catch {
        setQueued(true);
        setError('Saved on this device. It will synchronize automatically when the connection returns.');
      }
    } catch {
      setError('Could not save this inspection on the device. Check browser storage and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="list-empty">Loading inspection…</div>;
  if (error && !item) return <><Link to="/schedule" className="back-link">‹ Back to schedule</Link><div className="list-empty">{error}</div></>;

  return (
    <>
      <Link to={`/schedule/${item.id}`} className="back-link">‹ Back to inspection details</Link>
      <div className="page-header">
        <div className="page-eyebrow">On-site Inspection · {item.id}</div>
        <h1 className="page-title">{item.organization}</h1>
        <p className="page-description">{item.location}</p>
      </div>
      <div className="workflow-panel">
        <div className="workflow-section">
          <div className="workflow-section-title">GPS location</div>
          <p className="workflow-section-note">
            {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} · ±${location.accuracy} m` : 'No location captured yet.'}
            {item.site_radius_m ? ` · Site boundary ${item.site_radius_m} m` : ''}
          </p>
          <button type="button" className="btn btn-secondary" onClick={captureLocation}>{location ? 'Refresh location' : 'Capture location'}</button>
        </div>
        <div className="workflow-section">
          <div className="workflow-section-title">Live photo evidence</div>
          <p className="workflow-section-note" role="status">{cameraStatus}</p>
          <video ref={videoRef} autoPlay playsInline muted hidden={!cameraOpen} style={{ width: '100%', maxHeight: 420, aspectRatio: '16 / 9', background: '#000', objectFit: 'contain', marginTop: 12 }} />
          {!cameraOpen && photoDataUrl && <img src={photoDataUrl} alt="Captured inspection evidence" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', marginTop: 12 }} />}
          <div className="detail-actions">
            {!cameraOpen
              ? <button type="button" className="btn btn-primary" onClick={() => void openCamera()}>{photoDataUrl ? 'Retake photo' : 'Open camera'}</button>
              : <><button type="button" className="btn btn-primary" onClick={capturePhoto}>Take photo</button><button type="button" className="btn btn-secondary" onClick={closeCamera}>Close camera</button></>}
          </div>
        </div>
        <div className="workflow-section">
          <div className="workflow-section-title">Live CCTV monitoring</div>
          <p className="workflow-section-note">Authorized officials can view organization CCTV feeds from the Authority Live Monitoring page.</p>
        </div>
        <div className="workflow-section">
          <div className="workflow-section-title">Inspection Notes</div>
          <p className="workflow-section-note">Record observations from the site visit.</p>
          <textarea className="workflow-textarea" placeholder="Enter observations from the site visit..." value={notes} onChange={(event) => setNotes(event.target.value)} disabled={submitting} />
        </div>
        {error && <div className="workflow-banner" role="alert">{error}</div>}
        {queued && <div className="workflow-banner" role="status">Inspection saved offline and queued for automatic synchronization.</div>}
        <div className="detail-actions">
          <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleComplete}>{submitting ? 'Submitting…' : queued ? 'Retry submission' : 'Complete Inspection'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/records')}>View Inspection Records</button>
        </div>
      </div>
    </>
  );
}
