import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import appCss from "../styles.css?url";
import inspectorPortalCss from "../../inspector-portal/src/styles/global.css?url";
import { PortalShell } from "../components/satark/portal";
import { Toaster } from "../components/ui/sonner";
import { PortalRoleLoginPage } from "@/components/satark/auth-login";
import { InspectorCameraCapture, type InspectionScheduleItem, type SubmittedInspection } from "@/components/satark/camera-evidence";
import { clearStoredSession, getStoredSession } from "@/lib/auth";
import {
  cacheSchedules,
  getCachedSchedules,
  getPendingInspections,
  removePendingInspection,
  type OfflineInspectionSubmission,
} from "@/lib/offline-inspections";
import { PortalDataProvider } from "@/lib/portal-data";
import { InspectorPortalRoutes } from "../../inspector-portal/src/App.jsx";

const INSPECTOR_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Satark Drishti" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: inspectorPortalCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" },
      { rel: "icon", href: "/logo.jpg", type: "image/jpeg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function InspectorPortalShell() {
  type InspectorView = "schedule" | "scheduleDetails" | "capture" | "records" | "recordDetail";
  const [schedule, setSchedule] = useState<Array<InspectionScheduleItem & { status: string }>>([]);
  const [records, setRecords] = useState<SubmittedInspection[]>([]);
  const [pendingInspections, setPendingInspections] = useState<OfflineInspectionSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [activeView, setActiveView] = useState<InspectorView>("schedule");
  const [selectedSchedule, setSelectedSchedule] = useState<InspectionScheduleItem | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SubmittedInspection | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/app-sw.js").catch(() => undefined);
    }
  }, []);

  const session = hasHydrated ? getStoredSession() : null;

  const inspector = {
    id: "INS-001",
    name: session?.displayName || "Ramesh Kadam",
    designation: "Field Inspector",
    region: "Pune Division",
  };

  useEffect(() => {
    document.title = "Satark Drishti — Inspector Portal";
    return () => {
      document.title = "Satark Drishti";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInspectorData() {
      try {
        const response = await fetch(`${INSPECTOR_API_BASE_URL}/api/schedule`);
        if (!response.ok) throw new Error("Unable to load schedule");
        const payload = await response.json();
        await cacheSchedules(payload);
        if (!cancelled) {
          setSchedule(payload);
          setError("");
        }
      } catch (loadError) {
        const cachedSchedule = await getCachedSchedules().catch(() => []);
        if (!cancelled) {
          setSchedule(cachedSchedule);
          setError(cachedSchedule.length > 0
            ? "Backend unavailable. Showing the last cached schedule."
            : loadError instanceof Error ? loadError.message : "Unable to load schedule");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadInspectionRecords() {
      try {
        const response = await fetch(`${INSPECTOR_API_BASE_URL}/api/inspections`);
        if (!response.ok) throw new Error("Unable to load inspection records");
        const payload = await response.json();
        if (!cancelled) {
          setRecords(payload);
          setRecordsError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setRecordsError(loadError instanceof Error ? loadError.message : "Unable to load inspection records");
        }
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    }

    async function syncPendingInspections() {
      if (!navigator.onLine) return;
      const pending = await getPendingInspections().catch(() => []);
      if (!cancelled) setPendingInspections(pending);

      for (const submission of pending) {
        if (!navigator.onLine) break;
        try {
          const response = await fetch(`${INSPECTOR_API_BASE_URL}/api/inspections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submission),
          });
          if (!response.ok) break;
          const record = await response.json() as SubmittedInspection;
          await removePendingInspection(submission.client_submission_id);
          if (!cancelled) {
            setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
            if (record.schedule_id) {
              setSchedule((current) => current.map((item) => item.id === record.schedule_id ? { ...item, status: "Completed" } : item));
            }
            setPendingInspections((current) => current.filter((item) => item.client_submission_id !== submission.client_submission_id));
            window.dispatchEvent(new CustomEvent("satark-inspection-synced", { detail: record }));
          }
        } catch {
          break;
        }
      }

      const remaining = await getPendingInspections().catch(() => []);
      if (!cancelled) setPendingInspections(remaining);
    }

    async function loadPendingInspections() {
      const pending = await getPendingInspections().catch(() => []);
      if (!cancelled) setPendingInspections(pending);
    }

    function handleOnline() {
      setIsOnline(true);
      void loadInspectorData();
      void loadInspectionRecords();
      void syncPendingInspections();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void loadInspectorData();
    void loadInspectionRecords();
    void loadPendingInspections();
    void syncPendingInspections();
    const retryTimer = window.setInterval(() => void syncPendingInspections(), 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(retryTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function formatDate(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  const navItems = [
    { to: "schedule", label: "Inspection Schedule", mobileLabel: "Schedule", disabled: false },
    { to: "scheduleDetails", label: "Inspection Details", mobileLabel: "Details", disabled: !selectedSchedule },
    { to: "capture", label: "On-site Inspection", mobileLabel: "On-site", disabled: !selectedSchedule },
    { to: "records", label: "Inspection Records", mobileLabel: "Records", disabled: false },
    { to: "recordDetail", label: "Inspection Record Detail", mobileLabel: "Record", disabled: !selectedRecord },
  ];

  const renderSchedule = () => (
    <>
      <div className="page-header">
        <div className="page-eyebrow">Inspector Portal</div>
        <h1 className="page-title">Inspection Schedule</h1>
        <p className="page-description">Inspections assigned to you by the Satark Drishti backend.</p>
      </div>

      <div className="list-panel">
        {loading && <div className="list-empty">Loading schedule…</div>}
        {!loading && error && schedule.length === 0 && (
          <div className="list-empty">
            {error}
            <br />
            <span className="scope-note">Make sure the FastAPI backend is running on port 8000.</span>
          </div>
        )}
        {!loading && error && schedule.length > 0 && <div className="workflow-banner" role="status">{error}</div>}
        {!loading && !error && schedule.length === 0 && <div className="list-empty">No inspections assigned yet.</div>}
        {!loading && !error && schedule.map((item) => (
          <div key={item.id} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">{item.location}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => { setSelectedSchedule(item); setActiveView("scheduleDetails"); }}>View details</button>
                <button type="button" className="btn btn-primary" disabled={item.status === "Completed"} onClick={() => { setSelectedSchedule(item); setActiveView("capture"); }}>Start inspection</button>
              </div>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <span className="status-badge status-scheduled">{item.status}</span>
          </div>
        ))}
      </div>
    </>
  );

  const renderScheduleDetails = () => {
    if (!selectedSchedule) return renderSchedule();
    return (
      <>
        <button type="button" className="back-link" onClick={() => setActiveView("schedule")}>‹ Back to schedule</button>
        <div className="page-header">
          <div className="page-eyebrow">Assigned Inspection · {selectedSchedule.id}</div>
          <h1 className="page-title">{selectedSchedule.organization}</h1>
          <p className="page-description">{selectedSchedule.location}</p>
        </div>
        <div className="detail-panel">
          <div className="detail-grid">
            <div><div className="detail-field-label">Scheduled date</div><div className="detail-field-value">{formatDate(selectedSchedule.date)}</div></div>
            <div><div className="detail-field-label">Scheduled time</div><div className="detail-field-value">{selectedSchedule.time}</div></div>
            <div><div className="detail-field-label">Status</div><div className="detail-field-value">{selectedSchedule.status}</div></div>
            <div><div className="detail-field-label">Assigned inspector</div><div className="detail-field-value">{selectedSchedule.inspector || inspector.name}</div></div>
            <div><div className="detail-field-label">Registered GPS boundary</div><div className="detail-field-value">{selectedSchedule.site_radius_m == null ? "Not configured" : `${selectedSchedule.site_radius_m} m radius`}</div></div>
            <div><div className="detail-field-label">Site coordinates</div><div className="detail-field-value">{selectedSchedule.site_latitude == null || selectedSchedule.site_longitude == null ? "Not configured" : `${selectedSchedule.site_latitude.toFixed(6)}, ${selectedSchedule.site_longitude.toFixed(6)}`}</div></div>
          </div>
          <div className="detail-divider" />
          <div className="detail-actions">
            <button type="button" className="btn btn-primary" disabled={selectedSchedule.status === "Completed"} onClick={() => setActiveView("capture")}>Start on-site inspection</button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveView("schedule")}>Back to schedule</button>
          </div>
        </div>
      </>
    );
  };

  const renderRecords = () => (
    <>
      <div className="page-header">
        <div className="page-eyebrow">Inspector Portal</div>
        <h1 className="page-title">Inspection Records</h1>
        <p className="page-description">Inspection records returned by the backend.</p>
      </div>

      <div className="list-panel">
        {recordsLoading && <div className="list-empty">Loading records…</div>}
        {!recordsLoading && recordsError && <div className="list-empty">{recordsError}</div>}
        {!recordsLoading && !recordsError && records.length === 0 && pendingInspections.length === 0 && <div className="list-empty">No inspection records yet.</div>}
        {!recordsLoading && !recordsError && records.map((item) => (
          <div key={item.id} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">{item.location}</div>
              <button type="button" className="list-row-action mt-2" onClick={() => { setSelectedRecord(item); setActiveView("recordDetail"); }}>View record details</button>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <span className="status-badge status-scheduled">{item.status}</span>
          </div>
        ))}
        {pendingInspections.map((item) => (
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

  const renderRecordDetails = () => {
    if (!selectedRecord) return renderRecords();
    const photoUrl = selectedRecord.photo_media_id
      ? `${INSPECTOR_API_BASE_URL}/api/media/${encodeURIComponent(selectedRecord.photo_media_id)}`
      : null;
    return (
      <>
        <button type="button" className="back-link" onClick={() => setActiveView("records")}>‹ Back to records</button>
        <div className="page-header">
          <div className="page-eyebrow">Inspection Record · {selectedRecord.id}</div>
          <h1 className="page-title">{selectedRecord.organization}</h1>
          <p className="page-description">{selectedRecord.location}</p>
        </div>
        <div className="detail-panel">
          <div className="detail-grid">
            <div><div className="detail-field-label">Inspection date</div><div className="detail-field-value">{formatDate(selectedRecord.date)}</div></div>
            <div><div className="detail-field-label">Inspection time</div><div className="detail-field-value">{selectedRecord.time}</div></div>
            <div><div className="detail-field-label">Status</div><div className="detail-field-value">{selectedRecord.status}</div></div>
            <div><div className="detail-field-label">Inspector</div><div className="detail-field-value">{selectedRecord.inspector}</div></div>
            <div><div className="detail-field-label">GPS check</div><div className="detail-field-value">{selectedRecord.location_check_status?.replaceAll("_", " ") ?? "Not configured"}</div></div>
            <div><div className="detail-field-label">Coordinates / accuracy</div><div className="detail-field-value">{selectedRecord.latitude == null || selectedRecord.longitude == null ? "Not captured" : `${selectedRecord.latitude.toFixed(6)}, ${selectedRecord.longitude.toFixed(6)} · ±${selectedRecord.location_accuracy_m ?? "?"} m`}</div></div>
          </div>
          {selectedRecord.notes && <><div className="detail-divider" /><div className="detail-field-label">Inspection notes</div><p className="mt-2 text-sm">{selectedRecord.notes}</p></>}
          <div className="detail-divider" />
          <div className="detail-field-label">Live photo evidence</div>
          {photoUrl
            ? <img src={photoUrl} alt={`Inspection evidence for ${selectedRecord.organization}`} className="mt-3 max-h-[480px] w-full rounded-md border bg-black object-contain" />
            : <p className="mt-2 text-sm text-muted-foreground">No photo was attached to this record.</p>}
        </div>
      </>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-title">Satark Drishti</div>
          <div className="sidebar-brand-subtitle">Inspector Portal</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.to}
              type="button"
              disabled={item.disabled}
              onClick={() => setActiveView(item.to)}
              className={item.to === activeView ? "sidebar-nav-link active" : "sidebar-nav-link"}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {inspector.name}
          <br />
          {inspector.designation}
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => {
              clearStoredSession();
              window.location.assign("/");
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
        {navItems.map((item) => (
          <button
            key={item.to}
            type="button"
            disabled={item.disabled}
            onClick={() => setActiveView(item.to)}
            className={item.to === activeView ? "mobile-nav-link active" : "mobile-nav-link"}
          >
            {item.mobileLabel}
          </button>
        ))}
      </nav>

      <div className="app-main">
        <header className="app-header">
          <div />
          <div className="app-header-inspector">
            <div className="app-header-inspector-name">{inspector.name}</div>
            <div className="app-header-inspector-role">{inspector.region}</div>
          </div>
        </header>

        <main className="app-content">
          {(!isOnline || pendingInspections.length > 0) && (
            <div className="mb-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm" role="status">
              {!isOnline ? "Offline mode: cached assignments are available. " : ""}
              {pendingInspections.length > 0
                ? `${pendingInspections.length} inspection${pendingInspections.length === 1 ? "" : "s"} queued for automatic sync.`
                : "New captures will be saved on this device until you reconnect."}
            </div>
          )}
          {activeView === "capture" && selectedSchedule ? (
            <InspectorCameraCapture
              item={selectedSchedule}
              inspector={inspector.name}
              onCancel={() => setActiveView("scheduleDetails")}
              onQueued={(submission) => setPendingInspections((current) => [
                submission,
                ...current.filter((item) => item.client_submission_id !== submission.client_submission_id),
              ])}
              onSubmitted={(record) => {
                setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
                if (record.schedule_id) {
                  setSchedule((current) => current.map((item) => item.id === record.schedule_id ? { ...item, status: "Completed" } : item));
                }
                setPendingInspections((current) => current.filter((item) => item.client_submission_id !== record.client_submission_id));
                setRecordsError("");
                setRecordsLoading(false);
                setSelectedRecord(record);
                setSelectedSchedule(null);
                setActiveView("recordDetail");
              }}
            />
          ) : activeView === "scheduleDetails" ? renderScheduleDetails()
            : activeView === "recordDetail" ? renderRecordDetails()
              : activeView === "schedule" ? renderSchedule() : renderRecords()}
        </main>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/app-sw.js").catch(() => undefined);
    }
  }, []);

  const session = hasHydrated ? getStoredSession() : null;

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-background" aria-live="polite" aria-busy="true" />
    );
  }

  if (!session) {
    return (
      <QueryClientProvider client={queryClient}>
        <PortalRoleLoginPage />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    );
  }

  if (session.role === "inspector") {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/schedule"]}>
          <InspectorPortalRoutes inspectorName={session.displayName} />
        </MemoryRouter>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PortalDataProvider>
        <PortalShell>
          <Outlet />
        </PortalShell>
      </PortalDataProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
