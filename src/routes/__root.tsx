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

import appCss from "../styles.css?url";
import inspectorPortalCss from "../../inspector-portal/src/styles/global.css?url";
import { PortalShell } from "../components/satark/portal";
import { Toaster } from "../components/ui/sonner";
import { PortalRoleLoginPage } from "@/components/satark/auth-login";
import { clearStoredSession, getStoredSession } from "@/lib/auth";
import { PortalDataProvider } from "@/lib/portal-data";

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
  const [schedule, setSchedule] = useState<Array<{ id: string; organization: string; location: string; date: string; time: string; inspector: string; status: string }>>([]);
  const [records, setRecords] = useState<Array<{ id: string; organization: string; location: string; date: string; time: string; inspector: string; status: string; notes?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [activeView, setActiveView] = useState<"schedule" | "records">("schedule");
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
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
    async function loadInspectorData() {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/schedule");
        if (!response.ok) throw new Error("Unable to load schedule");
        const payload = await response.json();
        setSchedule(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load schedule");
      } finally {
        setLoading(false);
      }
    }

    async function loadInspectionRecords() {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/inspections");
        if (!response.ok) throw new Error("Unable to load inspection records");
        const payload = await response.json();
        setRecords(payload);
      } catch (loadError) {
        setRecordsError(loadError instanceof Error ? loadError.message : "Unable to load inspection records");
      } finally {
        setRecordsLoading(false);
      }
    }

    void loadInspectorData();
    void loadInspectionRecords();
  }, []);

  function formatDate(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  const navItems = [
    { to: "schedule", label: "Inspection Schedule" },
    { to: "records", label: "Inspection Records" },
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
        {!loading && error && (
          <div className="list-empty">
            {error}
            <br />
            <span className="scope-note">Make sure the FastAPI backend is running on port 8000.</span>
          </div>
        )}
        {!loading && !error && schedule.length === 0 && <div className="list-empty">No inspections assigned yet.</div>}
        {!loading && !error && schedule.map((item) => (
          <div key={item.id} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">{item.location}</div>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <span className="status-badge status-scheduled">{item.status}</span>
          </div>
        ))}
      </div>
    </>
  );

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
        {!recordsLoading && !recordsError && records.length === 0 && <div className="list-empty">No inspection records yet.</div>}
        {!recordsLoading && !recordsError && records.map((item) => (
          <div key={item.id} className="list-row">
            <div>
              <div className="list-row-org">{item.organization}</div>
              <div className="list-row-sector">{item.location}</div>
            </div>
            <div className="list-row-date">{formatDate(item.date)}</div>
            <div className="list-row-time">{item.time}</div>
            <span className="status-badge status-scheduled">{item.status}</span>
          </div>
        ))}
      </div>
    </>
  );

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
              onClick={() => setActiveView(item.to as "schedule" | "records")}
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
            onClick={() => setActiveView(item.to as "schedule" | "records")}
            className={item.to === activeView ? "mobile-nav-link active" : "mobile-nav-link"}
          >
            {item.label}
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
          {activeView === "schedule" ? renderSchedule() : renderRecords()}
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
        <InspectorPortalShell />
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
