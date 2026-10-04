import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, RefreshCw, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { InspectionTable } from "@/components/satark/portal";
import type { Inspection } from "@/lib/demo-data";
import { useReloadPortalData } from "@/lib/portal-data";
import { removePendingInspection, savePendingInspection, type OfflineInspectionSubmission } from "@/lib/offline-inspections";

export type InspectionScheduleItem = {
  id: string;
  organization: string;
  location: string;
  date: string;
  time: string;
  inspector: string;
  site_latitude?: number | null;
  site_longitude?: number | null;
  site_radius_m?: number | null;
};

export type SubmittedInspection = {
  id: string;
  organization: string;
  location: string;
  date: string;
  time: string;
  inspector: string;
  status: string;
  schedule_id?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy_m?: number | null;
  location_captured_at?: string | null;
  location_check_status?: string | null;
  location_distance_m?: number | null;
  photo_media_id?: string | null;
  client_submission_id?: string | null;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function InspectorCameraCapture({
  item,
  inspector,
  onCancel,
  onQueued,
  onSubmitted,
}: {
  item: InspectionScheduleItem;
  inspector: string;
  onCancel: () => void;
  onQueued: (submission: OfflineInspectionSubmission) => void;
  onSubmitted: (inspection: SubmittedInspection) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clientSubmissionIdRef = useRef(globalThis.crypto?.randomUUID?.() || `submission-${Date.now()}`);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera is closed.");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [queueNotice, setQueueNotice] = useState("");

  useEffect(() => () => stopStream(streamRef.current), []);

  useEffect(() => {
    const handleInspectionSynced = (event: Event) => {
      const record = (event as CustomEvent<SubmittedInspection>).detail;
      if (record?.client_submission_id !== clientSubmissionIdRef.current) return;
      setQueued(false);
      setQueueNotice("Inspection synchronized successfully.");
    };
    window.addEventListener("satark-inspection-synced", handleInspectionSynced);
    return () => window.removeEventListener("satark-inspection-synced", handleInspectionSynced);
  }, []);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires localhost or HTTPS and a supported browser.");
      return;
    }
    try {
      stopStream(streamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
      setCameraStatus("Live camera ready.");
    } catch {
      setCameraOpen(false);
      setCameraStatus("Camera access was denied or no camera is available.");
    }
  }

  function closeCamera() {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraStatus("Camera is closed.");
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera is still starting. Try again in a moment.");
      return;
    }
    const scale = Math.min(1, 1600 / video.videoWidth, 1200 / video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture a photo from the camera.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 6_000_000) {
      setError("The captured photo is too large to submit. Retake it in lower resolution.");
      return;
    }
    setPhotoDataUrl(dataUrl);
    setError("");
    closeCamera();
    setCameraStatus("Photo captured.");
  }

  function captureLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Location access is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      () => setError("Could not get your location. Allow location access and try again."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function submitInspection() {
    if (!photoDataUrl || !location) {
      setError("Capture both a live photo and your location before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    const submission: OfflineInspectionSubmission = {
      organization: item.organization,
      location: item.location,
      date: item.date,
      time: item.time,
      inspector: item.inspector || inspector,
      status: "Submitted",
      notes: notes.trim() || null,
      schedule_id: item.id,
      latitude: location.latitude,
      longitude: location.longitude,
      location_accuracy_m: location.accuracy,
      location_captured_at: location.capturedAt,
      client_submission_id: clientSubmissionIdRef.current,
      photo_data_url: photoDataUrl,
    };
    try {
      await savePendingInspection(submission);
    } catch {
      setSubmitting(false);
      setError("Could not save this inspection on the device. Check browser storage and try again.");
      return;
    }
    if (!navigator.onLine) {
      onQueued(submission);
      setQueued(true);
      setQueueNotice("Saved on this device. It will upload automatically when the connection returns.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const responseError = new Error(payload?.detail || `Inspection submission failed (${response.status}).`) as Error & { status: number };
        responseError.status = response.status;
        throw responseError;
      }
      await removePendingInspection(submission.client_submission_id);
      setQueueNotice("");
      setQueued(false);
      onSubmitted(payload as SubmittedInspection);
    } catch (submitError) {
      const status = (submitError as { status?: number }).status;
      if (status == null || status >= 500) {
        onQueued(submission);
        setQueued(true);
        setQueueNotice("Connection unavailable. Saved on this device and queued for automatic sync.");
      } else {
        await removePendingInspection(submission.client_submission_id).catch(() => undefined);
        setError(submitError instanceof Error ? submitError.message : "Could not submit this inspection.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="page-header">
        <div className="page-eyebrow">On-site inspection · {item.id}</div>
        <h1 className="page-title">{item.organization}</h1>
        <p className="page-description">{item.location} · {item.date} · {item.time}</p>
      </div>
      <div className="workflow-panel">
        <section className="workflow-section">
          <div className="workflow-section-title">Live photo evidence</div>
          <div className="mt-3 overflow-hidden rounded-md bg-black">
            <video ref={videoRef} className="aspect-video w-full object-contain" autoPlay playsInline muted hidden={!cameraOpen} />
            {!cameraOpen && (photoDataUrl ? (
              <img src={photoDataUrl} alt="Captured inspection evidence" className="aspect-video w-full object-contain" />
            ) : (
              <div className="grid aspect-video place-items-center text-sm text-white/75">Camera is closed</div>
            ))}
          </div>
          <p className="workflow-section-note" role="status">{cameraStatus}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!cameraOpen ? (
              <Button type="button" onClick={() => void openCamera()}><Camera />{photoDataUrl ? "Retake photo" : "Open camera"}</Button>
            ) : (
              <>
                <Button type="button" onClick={capturePhoto}><Camera />Take photo</Button>
                <Button type="button" variant="outline" onClick={closeCamera}><X />Close camera</Button>
              </>
            )}
          </div>
        </section>
        <section className="workflow-section">
          <div className="workflow-section-title">GPS location</div>
          <p className="workflow-section-note">
            {location
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} · ±${location.accuracy} m`
              : "No location captured yet."}
          </p>
          <Button className="mt-3" type="button" variant="outline" onClick={captureLocation}><MapPin />{location ? "Refresh location" : "Capture location"}</Button>
        </section>
        <section className="workflow-section">
          <div className="workflow-section-title">Inspection notes</div>
          <textarea className="workflow-textarea" placeholder="Enter observations from the site visit..." value={notes} onChange={(event) => setNotes(event.target.value)} disabled={submitting} />
        </section>
        {error && <div className="workflow-banner" role="alert">{error}</div>}
        {queueNotice && <div className="rounded-md border border-info/30 bg-info-soft p-3 text-sm" role="status">{queueNotice}</div>}
        <div className="detail-actions">
          <Button type="button" disabled={submitting} onClick={() => void submitInspection()}>{submitting ? "Submitting…" : queued ? "Retry submission" : "Submit inspection"}</Button>
          <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}><RotateCcw />Back to schedule</Button>
        </div>
      </div>
    </section>
  );
}

export function AuthorityEvidenceReview() {
  const reloadPortalData = useReloadPortalData();
  const [records, setRecords] = useState<SubmittedInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [recordToDelete, setRecordToDelete] = useState<Inspection | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedRecords = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function refreshRecords() {
      if (!hasLoadedRecords.current) setLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/inspections`, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || `Inspection request failed (${response.status}).`);
        setRecords(payload as SubmittedInspection[]);
        setError("");
        setLastUpdated(new Date());
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load inspection evidence.");
        }
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedRecords.current = true;
          setLoading(false);
        }
      }
    }
    void refreshRecords();
    const handleResume = () => void refreshRecords();
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);
    const refreshTimer = window.setInterval(() => void refreshRecords(), 5_000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [refreshToken]);

  const liveRows: Inspection[] = records.slice().reverse().map((record) => ({
    id: record.id,
    organization: record.organization,
    organizationId: "",
    inspector: record.inspector,
    date: new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: record.time,
    scheduledTime: `${record.date} · ${record.time}`,
    gps: record.location_check_status === "verified"
      ? "Verified"
      : record.location_check_status === "outside_radius" ? "Outside radius" : "Pending",
    photo: record.photo_media_id ? "Captured" : "Pending",
    status: record.status === "Verified" || record.status === "Flagged" ? record.status : "Submitted",
    sync: "Synced",
    duration: "—",
    distance: record.location_distance_m == null ? "Not configured" : `${record.location_distance_m} m`,
    coordinates: record.latitude == null || record.longitude == null
      ? "Not captured"
      : `${record.latitude.toFixed(5)}° , ${record.longitude.toFixed(5)}°`,
    evidenceId: record.id,
    photoMediaId: record.photo_media_id,
    photoUrl: record.photo_media_id
      ? `${apiBaseUrl}/api/media/${encodeURIComponent(record.photo_media_id)}`
      : null,
    isLive: Boolean(record.client_submission_id),
    isPersisted: true,
  }));
  const reviewRows = liveRows.filter((record) => !statusFilter || record.status === statusFilter);

  async function deleteRecord() {
    if (!recordToDelete?.isPersisted || deletingRecord) return;
    setDeletingRecord(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/inspections/${encodeURIComponent(recordToDelete.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || `Inspection deletion failed (${response.status}).`);
      }
      setRecords((current) => current.filter((record) => record.id !== recordToDelete.id));
      setRecordToDelete(null);
      reloadPortalData();
      toast.success(`Inspection ${recordToDelete.id} deleted`);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not delete the inspection.");
    } finally {
      setDeletingRecord(false);
    }
  }

  return (
    <section className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Inspection records</h2>
          <p className="mt-1 text-sm text-muted-foreground">Database inspection records appear here. Auto-refreshes every 5 seconds.</p>
          {lastUpdated && <p className="mt-1 text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</p>}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading}>
          <RefreshCw />{loading ? "Refreshing…" : "Refresh records"}
        </Button>
      </div>
      <label className="flex w-fit items-center gap-2 text-xs font-medium text-muted-foreground">
        Filter by status
        <select
          className="h-9 rounded-md border bg-card px-3 text-xs text-foreground"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Verified">Verified</option>
          <option value="Submitted">Submitted</option>
          <option value="Flagged">Flagged</option>
        </select>
      </label>
      {loading && <p className="text-sm text-muted-foreground">Loading submitted evidence…</p>}
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">{error}</p>}
      {!loading && !error && reviewRows.length === 0 && <p className="text-sm text-muted-foreground">No {statusFilter ? `${statusFilter.toLowerCase()} ` : ""}inspection records found.</p>}
      {reviewRows.length > 0 && <InspectionTable rows={reviewRows} onDeleteRecord={setRecordToDelete} />}
      <AlertDialog open={Boolean(recordToDelete)} onOpenChange={(open) => !open && !deletingRecord && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inspection record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes inspection record {recordToDelete?.id} and its unreferenced photo evidence. It will also be removed from inspection reports and charts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRecord}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingRecord}
              onClick={(event) => {
                event.preventDefault();
                void deleteRecord();
              }}
            >
              {deletingRecord ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}