import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AuthorityEvidenceReview, type SubmittedInspection } from "@/components/satark/camera-evidence";
import { GpsMapFrame } from "@/components/satark/gps-map-frame";
import { ReverseGeocodedAddress } from "@/components/satark/reverse-geocoded-address";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePortalData, useReloadPortalData, useUpdatePortalSettings } from "@/lib/portal-data";
import type { Inspection } from "@/lib/demo-data";
import {
  DemoNote,
  Filters,
  GPSMap,
  Icons,
  InspectionEvidenceCard,
  InspectionTable,
  PageHeader,
  PhotoViewer,
  Section,
  StatCard,
  StatusBadge,
  SyncPanel,
} from "@/components/satark/portal";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleDot,
  Cloud,
  CloudOff,
  Crosshair,
  Download,
  Eye,
  FileCheck2,
  FileText,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Signal,
  SlidersHorizontal,
  Timer,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

const chartTooltip = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 700 },
};

type ScheduledInspection = {
  id: string;
  organization: string;
  location: string;
  date: string;
  time: string;
  inspector: string;
  status: string;
  site_latitude: number | null;
  site_longitude: number | null;
  site_radius_m: number | null;
};

const scheduleApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export function DashboardPage() {
  const [range, setRange] = useState("This Month");
  const { dashboard, inspections, organizations, settings } = usePortalData();
  const currentDate = new Date();
  const monthlyInspections = inspections.filter((inspection) => {
    const timestamp = new Date(`${inspection.date} ${inspection.time}`);
    return !Number.isNaN(timestamp.getTime())
      && timestamp.getMonth() === currentDate.getMonth()
      && timestamp.getFullYear() === currentDate.getFullYear();
  });
  const verifiedCount = monthlyInspections.filter((inspection) => inspection.status === "Verified").length;
  const pendingCount = monthlyInspections.filter((inspection) => inspection.status === "Submitted" || inspection.status === "Pending").length;
  const flaggedCount = monthlyInspections.filter((inspection) => inspection.status === "Flagged" || inspection.gps === "Outside radius").length;
  const verificationRate = monthlyInspections.length
    ? `${Math.round((verifiedCount / monthlyInspections.length) * 100)}% of records`
    : "No records this month";
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    const days = range === "Today" ? 1 : range === "This Week" ? 7 : range === "This Month" ? today.getDate() : 30;
    if (range === "This Month") start.setDate(1);
    else start.setDate(today.getDate() - days + 1);

    const groups = new Map<string, { day: string; total: number; verified: number; pending: number; random: number; flagged: number }>();
    for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      groups.set(key, {
        day: cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        total: 0,
        verified: 0,
        pending: 0,
        random: 0,
        flagged: 0,
      });
    }

    for (const inspection of inspections) {
      const timestamp = new Date(`${inspection.date} ${inspection.time}`);
      if (Number.isNaN(timestamp.getTime())) continue;
      const key = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`;
      const group = groups.get(key);
      if (!group) continue;
      group.total += 1;
      if (inspection.status === "Verified") group.verified += 1;
      if (inspection.status === "Submitted" || inspection.status === "Pending") group.pending += 1;
      if (inspection.status === "Flagged" || inspection.gps === "Outside radius") group.flagged += 1;
      if (inspection.scheduleId) group.random += 1;
    }
    return [...groups.values()];
  }, [inspections, range]);
  const primaryInspection = inspections[0];
  return (
    <>
      <DemoNote />
      <div className="mb-7 rounded-lg border bg-primary p-6 text-primary-foreground shadow-brand md:p-7">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">
              Authority Command Centre
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold text-white md:text-3xl">
              Good Morning, {settings.displayName} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">
              Monitor inspections, verify evidence and maintain transparent
              organizational oversight.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
            </span>
            <div>
              <p className="text-xs font-bold">System operational</p>
              <p className="text-[10px] opacity-70">Last updated {dashboard.updatedAt}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Organizations"
          value={organizations.length}
          detail={`${dashboard.activeDistricts} active districts`}
          icon={Building2}
        />
        <StatCard
          label="Inspections This Month"
          value={monthlyInspections.length}
          detail="From stored inspections"
          icon={FileCheck2}
        />
        <StatCard
          label="Verified Inspections"
          value={verifiedCount}
          detail={verificationRate}
          icon={ShieldCheck}
          toneName="success"
        />
        <StatCard
          label="Pending Verification"
          value={pendingCount}
          detail="Awaiting authority review"
          icon={Timer}
          toneName="warning"
        />
        <StatCard
          label="Flagged Inspections"
          value={flaggedCount}
          detail="Requires attention"
          icon={AlertTriangle}
          toneName="danger"
        />
        <StatCard
          label="Offline Sync Pending"
          value={dashboard.offlineSyncPending}
          detail="Queued for upload"
          icon={CloudOff}
          toneName="warning"
        />
      </div>
      <Section
        title="What strengthens the inspection trail"
        description="Satark Drishti connects multiple evidence layers instead of relying on a report alone."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              Shuffle,
              "Random Inspection Scheduling",
              "Unpredictable windows reduce advance preparation.",
            ],
            [
              Camera,
              "Live Photo Capture",
              "Photos are captured during the inspection workflow.",
            ],
            [
              MapPin,
              "GPS-Based Presence Verification",
              "Recorded presence is checked against an authorized boundary.",
            ],
            [
              Cloud,
              "Offline Inspection + Auto Sync",
              "Field work continues through poor connectivity and syncs later.",
            ],
          ].map(([Icon, title, text]: any) => (
            <div
              key={title}
              className="group rounded-lg border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="mb-4 grid size-10 place-items-center rounded-md bg-evidence text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {text}
              </p>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Inspection overview"
        description="Inspection activity and evidence status over the selected period."
        action={
          <div className="hidden rounded-md border bg-card p-1 sm:flex">
            {["Today", "This Week", "This Month", "Custom Range"].map(
              (item) => (
                <Button
                  key={item}
                  variant={range === item ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setRange(item)}
                >
                  {item}
                </Button>
              ),
            )}
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <div className="h-[330px] rounded-lg border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold">Inspections over time</p>
              <StatusBadge>{range}</StatusBadge>
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...chartTooltip} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total inspections"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#areaTotal)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[330px] rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs font-bold">Evidence outcomes</p>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  dataKey="verified"
                  name="Verified"
                  stackId="a"
                  fill="var(--success)"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="pending"
                  name="Pending"
                  stackId="a"
                  fill="var(--warning)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="flagged"
                  name="Flagged"
                  stackId="a"
                  fill="var(--destructive)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>
      <Section
        title="Recent inspections"
        description="The newest evidence records submitted by field inspectors."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/inspections">
              View all
              <ArrowRight />
            </Link>
          </Button>
        }
      >
        <InspectionTable rows={inspections} limit={5} />
      </Section>
      <Section
        title="Complete evidence at a glance"
        description="Inspection evidence should tell the complete story, not just provide a report."
      >
        <InspectionEvidenceCard inspection={primaryInspection} />
      </Section>
    </>
  );
}

export function InspectionsPage({ records = false }: { records?: boolean }) {
  const { inspections } = usePortalData();
  const reloadPortalData = useReloadPortalData();
  const [schedules, setSchedules] = useState<ScheduledInspection[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(!records);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleRefresh, setScheduleRefresh] = useState(0);

  useEffect(() => {
    if (records) return;
    let active = true;
    let loading = false;
    const controller = new AbortController();
    async function loadSchedules() {
      if (loading) return;
      loading = true;
      setScheduleLoading(true);
      try {
        const response = await fetch(`${scheduleApiBaseUrl}/api/schedule`, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || `Schedule request failed (${response.status}).`);
        if (active) {
          setSchedules(payload as ScheduledInspection[]);
          setScheduleError("");
        }
      } catch (requestError: unknown) {
        if (active && !controller.signal.aborted) {
          setScheduleError(requestError instanceof Error ? requestError.message : "Could not load scheduled inspections.");
        }
      } finally {
        loading = false;
        if (active) setScheduleLoading(false);
      }
    }
    const refreshOnFocus = () => void loadSchedules();
    void loadSchedules();
    const timer = window.setInterval(() => void loadSchedules(), 5_000);
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("online", refreshOnFocus);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("online", refreshOnFocus);
    };
  }, [records, scheduleRefresh]);

  if (records) {
    return (
      <>
        <PageHeader
          eyebrow="Digital archive"
          title="Inspection Records"
          description="Persisted inspection records, including Inspector submissions and seeded examples."
        />
        <DemoNote />
        <AuthorityEvidenceReview />
        <Filters placeholder="Search by inspection ID, organization or inspector..." />
      </>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Field operations"
        title="Inspections"
        description="Review scheduled assignments and submitted inspection records from the backend."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setScheduleRefresh((value) => value + 1);
              reloadPortalData();
            }}
            disabled={scheduleLoading}
          >
            <RefreshCw className={scheduleLoading ? "animate-spin" : ""} />
            Refresh data
          </Button>
        }
      />
      <DemoNote />
      {scheduleError && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">{scheduleError}</div>}
      <Section
        title="Inspection activity"
        description="Assignments that have not been submitted yet. Submitted and completed inspections are available in Inspection Records."
      >
        {(() => {
          const liveBySchedule = new Map<string, Inspection>();
          for (const inspection of inspections) {
            if (inspection.isLive && inspection.scheduleId && !liveBySchedule.has(inspection.scheduleId)) {
              liveBySchedule.set(inspection.scheduleId, inspection);
            }
          }
          const scheduleRows: Inspection[] = schedules
            .filter((schedule) => schedule.status !== "Completed" && !liveBySchedule.has(schedule.id))
            .map((schedule) => ({
              id: schedule.id,
              organization: schedule.organization,
              organizationId: "",
              location: schedule.location,
              inspector: schedule.inspector,
              date: new Date(`${schedule.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
              time: schedule.time,
              scheduledTime: `${schedule.date} · ${schedule.time}`,
              gps: "Pending",
              photo: "Pending",
              status: "Scheduled",
              sync: "Not submitted",
              duration: "Not recorded",
              distance: "Not available",
              coordinates: "Not captured",
              evidenceId: schedule.id,
              scheduleId: schedule.id,
              isScheduleOnly: true,
            }));
          return <InspectionTable rows={scheduleRows} />;
        })()}
      </Section>
      <Filters placeholder="Search by inspection ID, organization or inspector..." />
    </>
  );
}

type LiveInspectionDetail = {
  id: string;
  organization: string;
  location: string;
  date: string;
  time: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  inspector: string;
  status: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  location_captured_at: string | null;
  photo_captured_at: string | null;
  submitted_at: string | null;
  location_distance_m: number | null;
  location_check_status: string | null;
  schedule_id: string | null;
  photo_media_id: string | null;
};

const inspectorApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function LiveInspectorRecordDetail({ id, mapRadiusM }: { id: string; mapRadiusM: number }) {
  const { organizations } = usePortalData();
  const [record, setRecord] = useState<LiveInspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPhotoFailed(false);
    fetch(`${inspectorApiBaseUrl}/api/inspections/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || `Inspection request failed (${response.status}).`);
        setRecord(payload as LiveInspectionDetail);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Could not load this inspection.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  if (loading) return <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">Loading submitted inspection…</div>;
  if (error || !record) return <div className="rounded-lg border p-6 text-sm text-muted-foreground">{error || "Inspection not found."}</div>;

  const hasLocation = record.latitude != null && record.longitude != null;
  const boundaryRadiusM = organizations.find((organization) => organization.name === record.organization)?.radius_m ?? mapRadiusM;
  const latitude = record.latitude ?? 0;
  const longitude = record.longitude ?? 0;
  const photoUrl = record.photo_media_id
    ? `${inspectorApiBaseUrl}/api/media/${encodeURIComponent(record.photo_media_id)}`
    : null;
  const gpsStatus = record.location_check_status === "verified"
    ? "Verified"
    : record.location_check_status === "outside_radius" ? "Outside radius" : "Pending";
  const actualInspectionTime = record.location_captured_at
    ? new Date(record.location_captured_at).toLocaleString("en-IN")
    : record.submitted_at ? new Date(record.submitted_at).toLocaleString("en-IN") : "Not recorded";
  const scheduledInspectionTime = record.scheduled_date && record.scheduled_time
    ? `${new Date(`${record.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${record.scheduled_time}`
    : "Not recorded";
  const evidenceSummary: Inspection = {
    id: record.id,
    organization: record.organization,
    organizationId: "",
    inspector: record.inspector,
    date: new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: record.time,
    scheduledTime: scheduledInspectionTime,
    gps: gpsStatus,
    photo: record.photo_media_id ? "Captured" : "Pending",
    status: record.status === "Verified" || record.status === "Flagged" ? record.status : "Submitted",
    sync: "Synced",
    duration: "Not recorded",
    distance: record.location_distance_m == null ? "Not available" : `${record.location_distance_m} m`,
    coordinates: hasLocation ? `${latitude.toFixed(5)}° , ${longitude.toFixed(5)}°` : "Not captured",
    evidenceId: record.id,
    photoMediaId: record.photo_media_id,
    photoUrl,
  };
  const timeline = [
    ...(record.schedule_id ? [{ title: "Inspection scheduled", time: scheduledInspectionTime, detail: `Assigned schedule ${record.schedule_id}` }] : []),
    ...(record.location_captured_at ? [{ title: "GPS position captured", time: actualInspectionTime, detail: hasLocation ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)} · accuracy ±${record.location_accuracy_m ?? "unknown"} m` : "Location timestamp recorded" }] : []),
    ...(record.photo_media_id ? [{ title: "Photo evidence attached", time: record.photo_captured_at ? new Date(record.photo_captured_at).toLocaleString("en-IN") : "Capture time not recorded", detail: "Photo saved with the inspection record" }] : []),
    ...(record.submitted_at ? [{ title: "Inspection record stored", time: new Date(record.submitted_at).toLocaleString("en-IN"), detail: "Record is available to Authority reviewers" }] : [{ title: "Inspection record stored", time: "Receipt time not recorded", detail: "Record is available to Authority reviewers" }]),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Inspection evidence record"
        title={record.id}
        description="Review the submitted evidence. GPS presence is one layer and does not independently establish identity."
        actions={<StatusBadge>{record.status}</StatusBadge>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Organization", record.organization],
          ["Inspector", record.inspector],
          ["Scheduled time", scheduledInspectionTime],
          ["Actual inspection", actualInspectionTime],
          ["Duration", "Not recorded"],
          ["Inspection status", record.status],
          ["Evidence ID", record.id],
          ["Sync status", "Synced"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {record.notes && <div className="mb-6 rounded-lg border bg-card p-4"><p className="text-xs font-bold text-muted-foreground">Inspector notes</p><p className="mt-2 whitespace-pre-wrap text-sm">{record.notes}</p></div>}
      <Section title="Location verification" description="Captured GPS position and its server-side check against the scheduled site boundary.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
          {hasLocation
            ? <div>
              <GpsMapFrame latitude={latitude} longitude={longitude} radiusM={boundaryRadiusM} title={`Captured GPS location for ${record.organization}`} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Map marker is the Inspector’s saved GPS fix.</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open captured location in Google Maps
                </a>
              </div>
            </div>
            : <div className="grid min-h-[310px] place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">No GPS coordinates recorded.</div>}
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-3"><div className="grid size-11 place-items-center rounded-full bg-success-soft text-success"><MapPin /></div><StatusBadge>{gpsStatus}</StatusBadge></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-success">GPS {gpsStatus.toUpperCase()}</p>
            <h3 className="mt-2 font-display text-xl font-bold">{record.location_distance_m == null ? "Distance not available" : `${record.location_distance_m} m from registered location`}</h3>
            <div className="mt-5 space-y-3 border-t pt-4 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Organization location</span><span className="text-right font-semibold">{record.location}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Captured coordinates</span><span className="text-right font-semibold">{evidenceSummary.coordinates}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">GPS accuracy</span><span className="font-semibold">{record.location_accuracy_m == null ? "Unavailable" : `±${record.location_accuracy_m} m`}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Boundary</span><span className="font-semibold">{record.location_check_status === "not_configured" ? "Not configured" : `Authorized radius · ${boundaryRadiusM} metres`}</span></div>
              {hasLocation && <ReverseGeocodedAddress latitude={latitude} longitude={longitude} />}
            </div>
          </div>
        </div>
      </Section>
      <Section title="Live photo evidence" description="Photo attached to the Inspector submission.">
        {photoUrl && !photoFailed
          ? <div className="overflow-hidden rounded-lg border bg-black"><img crossOrigin="anonymous" src={photoUrl} alt={`Inspection evidence for ${record.organization}`} onError={() => setPhotoFailed(true)} className="max-h-[520px] w-full object-contain" /><div className="flex items-center justify-between gap-3 bg-card px-4 py-3"><span className="text-sm font-semibold">Captured photo evidence</span><StatusBadge>Captured</StatusBadge></div></div>
          : <div className="grid min-h-48 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">{photoFailed ? "The evidence photo could not be loaded." : "No photo attached to this record."}</div>}
      </Section>
      <Section title="Evidence summary" description="The evidence linked to this inspection record.">
        <InspectionEvidenceCard inspection={evidenceSummary} />
      </Section>
      <Section title="Evidence timeline" description="Only timestamps captured or stored with this record are shown.">
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <div className="relative ml-2 border-l border-border pl-7">
            {timeline.map(({ title, time, detail }) => (
              <div key={title} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[35px] top-0 grid size-4 place-items-center rounded-full bg-success ring-4 ring-success-soft"><CheckCircle2 className="size-2.5 text-primary-foreground" /></span>
                <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><time className="text-[11px] font-medium text-muted-foreground">{time}</time></div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

export function InspectionDetailPage({ id }: { id: string }) {
  const { inspections, timeline, mapRadiusM } = usePortalData();
  const inspection = inspections.find((item) => item.id === id);
  if (!inspection || inspection.isPersisted) {
    return <LiveInspectorRecordDetail id={id} mapRadiusM={mapRadiusM} />;
  }
  return (
    <>
      <PageHeader
        eyebrow="Inspection evidence record"
        title={inspection.id}
        description="Review the complete evidence trail. GPS presence is one layer of evidence and does not independently establish identity."
        actions={<StatusBadge>{inspection.status}</StatusBadge>}
      />
      <DemoNote />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Organization", inspection.organization],
          ["Inspector", inspection.inspector],
          ["Scheduled time", inspection.scheduledTime],
          ["Actual inspection", `${inspection.date} · ${inspection.time}`],
          ["Duration", inspection.duration],
          ["Inspection status", inspection.status],
          ["Evidence ID", inspection.evidenceId],
          ["Sync status", inspection.sync],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border bg-card p-4 shadow-card"
          >
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <Section
        title="Location verification"
        description="Organization location and captured inspector GPS position within the configured boundary."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
          <GPSMap flagged={inspection.gps === "Outside radius"} radiusM={mapRadiusM} />
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
                <MapPin />
              </div>
              <StatusBadge>
                {inspection.gps === "Verified" ? "Verified" : "Flagged"}
              </StatusBadge>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-success">
              GPS {inspection.gps.toUpperCase()}
            </p>
            <h3 className="mt-2 font-display text-xl font-bold">
              {inspection.distance} from registered location
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {inspection.gps === "Verified"
                ? "Inspector device was detected within the authorized inspection boundary."
                : "Captured position was outside the authorized boundary and requires authority review."}
            </p>
            <div className="mt-5 space-y-3 border-t pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Organization location
                </span>
                <span className="font-semibold">Registered site</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Captured coordinates
                </span>
                <span className="font-semibold">{inspection.coordinates}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Boundary</span>
                <span className="font-semibold">{mapRadiusM} m radius</span>
              </div>
            </div>
          </div>
        </div>
      </Section>
      <Section
        title="Live photo evidence"
        description="Captured during the inspection and linked to its timestamp and GPS record."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
          <PhotoViewer image={inspection.photoUrl} inspection={inspection} />
          <InspectionEvidenceCard compact inspection={inspection} />
        </div>
      </Section>
      <Section
        title="Evidence timeline"
        description="A chronological trail from randomized scheduling through authority review."
      >
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <div className="relative ml-2 border-l border-border pl-7">
            {timeline.map(({ title, time, detail }) => (
              <div key={title} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[35px] top-0 grid size-4 place-items-center rounded-full bg-success ring-4 ring-success-soft">
                  <CheckCircle2 className="size-2.5 text-primary-foreground" />
                </span>
                <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                  </div>
                  <time className="text-[11px] font-medium text-muted-foreground">
                    {time}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

export function OrganizationsPage() {
  const { organizations, retry } = usePortalData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [organizationForm, setOrganizationForm] = useState({
    name: "",
    reg: "",
    location: "",
    address: "",
    latitude: "",
    longitude: "",
    radius_m: "100",
  });

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${scheduleApiBaseUrl}/api/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organizationForm.name.trim(),
          reg: organizationForm.reg.trim(),
          location: organizationForm.location.trim(),
          address: organizationForm.address.trim(),
          latitude: Number(organizationForm.latitude),
          longitude: Number(organizationForm.longitude),
          radius_m: Number(organizationForm.radius_m),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || `Organization could not be saved (${response.status}).`);
      setDialogOpen(false);
      setOrganizationForm({ name: "", reg: "", location: "", address: "", latitude: "", longitude: "", radius_m: "100" });
      retry();
      toast.success("Organization added to the registry");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Organization could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Organization oversight"
        title="Organizations"
        description="Search registered organizations and review inspection coverage, verification history and attention indicators."
        actions={<Button onClick={() => setDialogOpen(true)}><Plus />Add organization</Button>}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add organization</DialogTitle>
            <DialogDescription>Register the organization and its real inspection boundary.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void createOrganization(event)}>
            <label className="text-xs font-medium">Organization name<input required maxLength={150} value={organizationForm.name} onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            <label className="text-xs font-medium">Registration ID<input required maxLength={80} value={organizationForm.reg} onChange={(event) => setOrganizationForm((current) => ({ ...current, reg: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            <label className="text-xs font-medium">District / location<input required maxLength={150} value={organizationForm.location} onChange={(event) => setOrganizationForm((current) => ({ ...current, location: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            <label className="text-xs font-medium sm:col-span-2">Registered address<input required maxLength={300} value={organizationForm.address} onChange={(event) => setOrganizationForm((current) => ({ ...current, address: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            <label className="text-xs font-medium">Site latitude<input required type="number" step="any" min="-90" max="90" value={organizationForm.latitude} onChange={(event) => setOrganizationForm((current) => ({ ...current, latitude: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            <label className="text-xs font-medium">Site longitude<input required type="number" step="any" min="-180" max="180" value={organizationForm.longitude} onChange={(event) => setOrganizationForm((current) => ({ ...current, longitude: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            <label className="text-xs font-medium">Authorized radius (metres)<input required type="number" min="1" max="100000" value={organizationForm.radius_m} onChange={(event) => setOrganizationForm((current) => ({ ...current, radius_m: event.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
            {error && <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save organization"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <DemoNote />
      <Filters placeholder="Search organization, registration ID or location..." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {organizations.map((org) => (
          <Link
            key={org.id}
            to="/organizations/$organizationId"
            params={{ organizationId: org.id }}
            className="group rounded-lg border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-evidence text-primary">
                <Building2 className="size-5" />
              </div>
              <StatusBadge>{org.verification}</StatusBadge>
            </div>
            <h2 className="mt-5 font-display text-base font-bold group-hover:text-primary">
              {org.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {org.reg}
            </p>
            <div className="mt-4 space-y-2 border-t pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-semibold">{org.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last inspection</span>
                <span className="font-semibold">{org.last}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inspections</span>
                <span className="font-semibold">{org.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attention</span>
                <span className="font-semibold">{org.risk}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function OrganizationProfilePage({ id }: { id: string }) {
  const { organizations, inspections, timeline, mapRadiusM } = usePortalData();
  const org = organizations.find((item) => item.id === id);
  if (!org) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Organization not found.</div>;
  }
  const rows = inspections.filter((x) => x.organizationId === org.id);
  const liveRows = rows.filter((item) => item.isLive);
  const profileTimeline = liveRows.length > 0
    ? liveRows.flatMap((item) => [
      ...(item.scheduleId ? [{ title: "Random inspection scheduled", time: item.scheduledTime, detail: `Assignment ${item.scheduleId}` }] : []),
      ...(item.locationCapturedAt ? [{ title: "Inspector GPS captured", time: new Date(item.locationCapturedAt).toLocaleString(), detail: `${item.coordinates} · accuracy ±${item.locationAccuracyM ?? "not recorded"} m` }] : []),
      ...(item.photoMediaId ? [{ title: "Inspection photo attached", time: item.photoCapturedAt ? new Date(item.photoCapturedAt).toLocaleString() : "Capture time not recorded", detail: "Camera evidence linked to the inspection" }] : []),
      { title: "Inspection submitted", time: item.submittedAt ? new Date(item.submittedAt).toLocaleString() : `${item.date} · ${item.time}`, detail: `Live inspection record ${item.id}` },
    ])
    : timeline;
  return (
    <>
      <PageHeader
        eyebrow="Organization profile"
        title={org.name}
        description={`${org.reg} · ${org.location}`}
        actions={<StatusBadge>{org.verification}</StatusBadge>}
      />
      <DemoNote />
      <div className="mb-6 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold">Organization information</h2>
          <div className="mt-4 space-y-4 text-xs">
            {[
              [
                "Registered address",
                org.address,
              ],
              ["Registration ID", org.reg],
              ["Last inspection", org.last],
              ["Total inspections", String(org.count)],
              ["Attention indicator", org.risk],
              ["Verification boundary", org.radius_m == null ? "Not configured" : `Authorized radius · ${org.radius_m} metres`],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-muted-foreground">{l}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>
        {org.latitude != null && org.longitude != null
          ? <GpsMapFrame latitude={org.latitude} longitude={org.longitude} radiusM={org.radius_m ?? mapRadiusM} title={`Registered location for ${org.name}`} />
          : <GPSMap radiusM={mapRadiusM} />}
      </div>
      <Section
        title="Inspection and verification history"
        description="Previous evidence records associated with this organization."
      >
        <InspectionTable rows={rows} />
      </Section>
      <Section title="Previous inspection trail">
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <div className="border-l pl-6">
            {profileTimeline.map(({ title, time }) => (
              <div key={title} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[29px] size-3 rounded-full bg-success ring-4 ring-success-soft" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{time}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

export function RandomSchedulePage() {
  const [schedules, setSchedules] = useState<ScheduledInspection[]>([]);
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${scheduleApiBaseUrl}/api/schedule`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || `Schedule request failed (${response.status}).`);
        setSchedules(payload as ScheduledInspection[]);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load the schedule.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshToken]);

  async function generateRandomAssignments() {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(`${scheduleApiBaseUrl}/api/schedule/generate?count=${count}`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || `Schedule generation failed (${response.status}).`);
      setRefreshToken((value) => value + 1);
      toast.success(`${payload.length} randomized assignments added`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not generate assignments.";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  const unsubmittedSchedules = schedules.filter((item) => item.status.trim().toLowerCase() !== "completed");
  const upcomingCount = unsubmittedSchedules.filter((item) => item.status === "Scheduled").length;
  const organizationCount = new Set(unsubmittedSchedules.map((item) => item.organization)).size;
  const inspectorCount = new Set(unsubmittedSchedules.map((item) => item.inspector)).size;

  return (
    <>
      <PageHeader
        eyebrow="Unpredictable scheduling"
        title="Random Inspection Engine"
        description="Generate future inspection assignments from the seeded organization registry and review their GPS boundaries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium" htmlFor="schedule-count">
              Assignments
              <select id="schedule-count" value={count} onChange={(event) => setCount(Number(event.target.value))} className="h-10 rounded-md border bg-background px-2 text-sm">
                {[1, 3, 5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <Button onClick={() => void generateRandomAssignments()} disabled={generating || loading}>
              <Shuffle />{generating ? "Generating…" : "Generate schedule"}
            </Button>
            <Button variant="outline" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading || generating}>
              <RefreshCw className={loading ? "animate-spin" : ""} />Refresh
            </Button>
          </div>
        }
      />
      <DemoNote />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming randomized"
          value={upcomingCount}
          detail="Assignments stored in SQLite"
          icon={Shuffle}
        />
        <StatCard
          label="Organizations scheduled"
          value={organizationCount}
          detail="Fictional demo registry"
          icon={CheckCircle2}
          toneName="success"
        />
        <StatCard
          label="Assigned inspectors"
          value={inspectorCount}
          detail="Available demo accounts"
          icon={Activity}
        />
        <StatCard
          label="Schedule status"
          value={error ? "Unavailable" : loading ? "Loading" : "Ready"}
          detail="Backend schedule service"
          icon={CalendarDays}
        />
      </div>
      <Section
        title="Randomized inspection schedule"
        description="Generated assignments are future-dated, persisted, and initially marked Scheduled. Demo coordinates are illustrative, not verified organization addresses."
      >
        {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">{error}</div>}
        <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b bg-muted/60">
              <tr>
                {[
                  "Schedule",
                  "Organization",
                  "Assigned inspector",
                  "Location",
                  "Date",
                  "Time",
                  "GPS radius",
                  "Status",
                ].map((x) => (
                  <th
                    key={x}
                    className="px-4 py-3 text-[10px] uppercase tracking-[.12em] text-muted-foreground"
                  >
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unsubmittedSchedules.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-4 font-mono font-semibold text-primary">
                    {item.id}
                  </td>
                  <td className="px-4 py-4 font-semibold">{item.organization}</td>
                  <td className="px-4 py-4">{item.inspector}</td>
                  <td className="px-4 py-4">{item.location}</td>
                  <td className="px-4 py-4">{item.date}</td>
                  <td className="px-4 py-4">{item.time}</td>
                  <td className="px-4 py-4">{item.site_radius_m == null ? "Not configured" : `${item.site_radius_m} m`}</td>
                  <td className="px-4 py-4">
                    <StatusBadge>{item.status}</StatusBadge>
                  </td>
                </tr>
              ))}
              {!loading && unsubmittedSchedules.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No unsubmitted assignments. Generate a schedule to add new assignments.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

export function LiveMonitoringPage() {
  const { cameras } = usePortalData();
  return (
    <>
      <PageHeader
        eyebrow="Authorized monitoring"
        title="Live Monitoring"
        description="View available organization camera feeds and operational status when live monitoring has been authorized."
      />
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-warning" />
        <span>
          <b>Restricted access.</b> Live monitoring is available only to
          authorized officials.
        </span>
      </div>
      <DemoNote />
      <div className="grid gap-4 md:grid-cols-2">
        {cameras.map((cam) => (
          <Dialog key={cam.name}>
            <div className="overflow-hidden rounded-lg border bg-card shadow-card">
              <div className="relative aspect-video overflow-hidden bg-sidebar">
                <div className="absolute inset-0 camera-grid opacity-30" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center text-sidebar-muted">
                    <Camera className="mx-auto size-9" />
                    <p className="mt-2 text-xs">Demonstration camera feed</p>
                  </div>
                </div>
                <div className="absolute left-3 top-3">
                  <StatusBadge pulse={cam.status === "Online"}>
                    {cam.status === "Online" ? "LIVE" : "Offline"}
                  </StatusBadge>
                </div>
                <div className="absolute bottom-3 right-3 font-mono text-[10px] text-sidebar-foreground">
                  {cam.timestamp}
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{cam.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {cam.org} · {cam.last}
                  </p>
                </div>
                <DialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Open ${cam.name}`}
                  >
                    <Eye />
                  </Button>
                </DialogTrigger>
              </div>
            </div>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>{cam.name}</DialogTitle>
                <DialogDescription>
                  {cam.org} · Authorized demonstration feed
                </DialogDescription>
              </DialogHeader>
              <div className="relative aspect-video overflow-hidden rounded-md bg-sidebar">
                <div className="absolute inset-0 camera-grid opacity-30" />
                <div className="absolute inset-0 grid place-items-center text-sidebar-muted">
                  <Camera className="size-14" />
                </div>
                <div className="absolute left-3 top-3">
                  <StatusBadge pulse>LIVE</StatusBadge>
                </div>
                <div className="absolute bottom-3 right-3 font-mono text-xs text-sidebar-foreground">
                  {cam.timestamp}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </>
  );
}

export function OfflineSyncPage() {
  const { sync, inspections } = usePortalData();
  return (
    <>
      <PageHeader
        eyebrow="Resilient field operations"
        title="Offline Sync"
        description="Track inspection evidence collected without connectivity and synchronize it when a stable connection returns."
      />
      <DemoNote />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending uploads"
          value={sync.pendingUploads}
          detail={`${sync.pendingEvidenceFiles} evidence files`}
          icon={Upload}
          toneName="warning"
        />
        <StatCard
          label="Successfully synchronized"
          value={sync.synchronizedThisMonth}
          detail="This month"
          icon={Cloud}
          toneName="success"
        />
        <StatCard
          label="Failed synchronization"
          value={sync.failedSynchronizations}
          detail="Retry scheduled"
          icon={WifiOff}
          toneName="danger"
        />
        <StatCard
          label="Last synchronization"
          value={sync.lastSyncTime}
          detail={sync.lastSyncDate}
          icon={Wifi}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SyncPanel syncData={sync} />
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />
              <span className="relative inline-flex size-3 rounded-full bg-success" />
            </span>
            <div>
              <p className="text-sm font-bold">Connection {sync.connectionStatus.toLowerCase()}</p>
              <p className="text-xs text-muted-foreground">
                {sync.networkLabel}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Queued records</span>
              <b>{sync.queuedRecords}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Queued evidence</span>
              <b>{sync.queuedEvidenceSize}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Automatic retry</span>
              <b>{sync.automaticRetry ? "Enabled" : "Disabled"}</b>
            </div>
          </div>
        </div>
      </div>
      <Section className="mt-7" title="Offline inspection queue">
        <InspectionTable
          rows={inspections.filter((x) => x.sync !== "Synced")}
        />
      </Section>
    </>
  );
}

export function EvidenceVerificationPage() {
  const { mapRadiusM, timeline } = usePortalData();
  const reloadPortalData = useReloadPortalData();
  const [liveRecords, setLiveRecords] = useState<SubmittedInspection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveError, setLiveError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [reviewingRecord, setReviewingRecord] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function refreshLiveRecords() {
      try {
        const response = await fetch(`${inspectorApiBaseUrl}/api/inspections`, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || `Inspection request failed (${response.status}).`);
        setLiveRecords(payload as SubmittedInspection[]);
        setLiveError("");
      } catch (error) {
        if (!controller.signal.aborted) setLiveError(error instanceof Error ? error.message : "Could not load submitted inspections.");
      }
    }
    void refreshLiveRecords();
    const handleResume = () => void refreshLiveRecords();
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);
    const timer = window.setInterval(() => void refreshLiveRecords(), 5_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [refreshToken]);

  const liveInspections: Inspection[] = liveRecords.slice().reverse().map((record) => ({
    id: record.id,
    organization: record.organization,
    organizationId: "",
    inspector: record.inspector,
    date: new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: record.time,
    scheduledTime: `${record.date} · ${record.time}`,
    gps: record.location_check_status === "verified" ? "Verified" : record.location_check_status === "outside_radius" ? "Outside radius" : "Pending",
    photo: record.photo_media_id ? "Captured" : "Pending",
    status: record.status === "Verified" || record.status === "Flagged" ? record.status : "Submitted",
    sync: "Synced",
    duration: "Not recorded",
    distance: record.location_distance_m == null ? "Not available" : `${record.location_distance_m} m`,
    coordinates: record.latitude == null || record.longitude == null ? "Not captured" : `${record.latitude.toFixed(5)}° , ${record.longitude.toFixed(5)}°`,
    evidenceId: record.id,
    photoMediaId: record.photo_media_id,
    photoUrl: record.photo_media_id ? `${inspectorApiBaseUrl}/api/media/${encodeURIComponent(record.photo_media_id)}` : null,
    isLive: Boolean(record.client_submission_id),
    isPersisted: true,
  }));
  const reviewRecords = liveInspections
    .filter((inspection) => inspection.status === "Submitted" || inspection.status === "Flagged");
  const selected = reviewRecords.find((item) => item.id === selectedId) ?? reviewRecords[0];
  const selectedLiveRecord = liveRecords.find((record) => record.id === selected?.id);

  async function updateSelectedReviewStatus(status: "Verified" | "Flagged") {
    if (!selectedLiveRecord || reviewingRecord) return;
    setReviewingRecord(true);
    try {
      const response = await fetch(`${inspectorApiBaseUrl}/api/inspections/${encodeURIComponent(selectedLiveRecord.id)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || `Inspection review update failed (${response.status}).`);
      }
      setLiveRecords((current) => current.map((record) => record.id === payload.id ? payload as SubmittedInspection : record));
      reloadPortalData();
      toast.success(`Inspection ${selectedLiveRecord.id} marked ${status.toLowerCase()}`);
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : "Could not update the inspection review.");
    } finally {
      setReviewingRecord(false);
    }
  }

  if (!selected) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">No submitted or flagged inspection records are awaiting review.</div>;
  }

  const hasLiveCoordinates = selectedLiveRecord?.latitude != null && selectedLiveRecord.longitude != null;
  const liveLatitude = selectedLiveRecord?.latitude ?? 0;
  const liveLongitude = selectedLiveRecord?.longitude ?? 0;
  const liveCapturedAt = selectedLiveRecord?.location_captured_at
    ? new Date(selectedLiveRecord.location_captured_at).toLocaleString()
    : "Capture time not recorded";
  const liveTimeline = selectedLiveRecord ? [
    ...(selectedLiveRecord.location_captured_at ? [{ title: "GPS position captured", time: liveCapturedAt, detail: selectedLiveRecord.latitude == null || selectedLiveRecord.longitude == null ? "Location timestamp stored" : `${selectedLiveRecord.latitude.toFixed(6)}, ${selectedLiveRecord.longitude.toFixed(6)} · accuracy ±${selectedLiveRecord.location_accuracy_m ?? "unknown"} m` }] : []),
    ...(selectedLiveRecord.photo_media_id ? [{ title: "Photo evidence attached", time: "Capture time not recorded", detail: "Camera photo stored with inspection" }] : []),
    { title: "Inspector submission received", time: "Receipt time not recorded", detail: `Record ${selectedLiveRecord.id} is stored in the inspection database` },
  ] : timeline;

  return (
    <>
      <PageHeader
        eyebrow="Authority review workspace"
        title="Evidence Verification"
        description="Review sample and live Inspector records with their linked GPS and photo evidence."
        actions={<div className="flex items-center gap-2"><StatusBadge>{selected.status}</StatusBadge><Button variant="outline" size="sm" onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw />Refresh</Button></div>}
      />
      {liveError && <div className="mb-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm" role="status">Live submissions are unavailable: {liveError}</div>}
      <DemoNote />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-lg border bg-card p-3 shadow-card">
          <p className="px-2 py-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Review queue · submitted and flagged</p>
          {reviewRecords.map((item) => {
            const isPersisted = liveRecords.some((record) => record.id === item.id);
            return (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`mb-1 w-full rounded-md border p-3 text-left transition ${selected.id === item.id ? "border-primary bg-info-soft" : "border-transparent hover:bg-muted"}`}>
                <div className="flex justify-between gap-2"><span className="font-mono text-[10px] font-bold text-primary">{item.id}</span><StatusBadge>{item.status}</StatusBadge></div>
                <p className="mt-2 text-xs font-semibold">{item.organization}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.inspector} · {item.date}</p>
                <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{isPersisted ? "Persisted inspection record" : "Sample preview · read-only"}</p>
              </button>
            );
          })}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-success">Verification status: {selected.status.toUpperCase()}</p>
                <h2 className="mt-2 font-display text-xl font-bold">{selected.organization}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{selected.id} · {selected.evidenceId}</p>
              </div>
              <ShieldCheck className="size-12 text-success" />
            </div>
          </div>
          <InspectionEvidenceCard inspection={selected} />
          <div className="grid gap-4 md:grid-cols-2">
            <PhotoViewer image={selected.photoUrl} inspection={selected} />
            {selectedLiveRecord ? (
              <div className="space-y-3 rounded-lg border bg-card p-4 shadow-card">
                {hasLiveCoordinates ? <GpsMapFrame latitude={liveLatitude} longitude={liveLongitude} radiusM={mapRadiusM} title={`Captured location for ${selected.organization}`} /> : <div className="grid h-[260px] place-items-center rounded-md border border-dashed text-sm text-muted-foreground">No captured coordinates</div>}
                <div className="space-y-2 text-xs"><p><b>Boundary check:</b> {selectedLiveRecord.location_check_status?.replaceAll("_", " ") ?? "Not configured"}</p><p><b>Coordinates:</b> {selected.coordinates}</p><p><b>Accuracy:</b> {selectedLiveRecord.location_accuracy_m == null ? "Not recorded" : `±${selectedLiveRecord.location_accuracy_m} m`}</p><p><b>Distance:</b> {selectedLiveRecord.location_distance_m == null ? "Not available" : `${selectedLiveRecord.location_distance_m} m from registered site`}</p></div>
              </div>
            ) : <GPSMap flagged={selected.gps === "Outside radius"} radiusM={mapRadiusM} />}
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-bold">Evidence components</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[[MapPin, "Location evidence", selected.gps], [Timer, "Timestamp recorded", selectedLiveRecord ? liveCapturedAt : `${selected.date} · ${selected.time}`], [Camera, "Live photo captured", selected.photo], [Cloud, "Inspection record synchronized", selected.sync]].map(([Icon, label, value]: any) => (
                <div key={label} className="flex items-start gap-3 rounded-md border p-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /><div><p className="text-xs font-bold">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">{value}</p></div></div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled={!selectedLiveRecord || reviewingRecord} onClick={() => void updateSelectedReviewStatus("Verified")}>
                <CheckCircle2 />{reviewingRecord ? "Saving…" : "Verify evidence"}
              </Button>
              <Button variant="outline" disabled={!selectedLiveRecord || selected.status === "Flagged" || reviewingRecord} onClick={() => void updateSelectedReviewStatus("Flagged")}>
                <AlertTriangle />Flag for review
              </Button>
            </div>
            {!selectedLiveRecord && <p className="mt-2 text-xs text-muted-foreground">This sample preview is not a persisted database record and cannot be changed.</p>}
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-bold">Evidence timeline</h3>
            <p className="mt-1 mb-5 text-xs text-muted-foreground">{selectedLiveRecord ? "Timeline entries reflect timestamps stored with this submission." : "Sample demonstration timeline."}</p>
            <div className="relative ml-2 border-l border-border pl-7">
              {liveTimeline.map(({ title, time, detail }) => <div key={title} className="relative pb-6 last:pb-0"><span className="absolute -left-[35px] top-0 grid size-4 place-items-center rounded-full bg-success ring-4 ring-success-soft"><CheckCircle2 className="size-2.5 text-primary-foreground" /></span><div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><time className="text-[11px] font-medium text-muted-foreground">{time}</time></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ReportsPage() {
  const { organizations, inspections } = usePortalData();
  const [period, setPeriod] = useState("month");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [inspectorFilter, setInspectorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const persistedInspections = inspections.filter((item) => item.isPersisted);
  const inspectors = [...new Set(persistedInspections.map((item) => item.inspector))].sort();
  const filteredInspections = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return persistedInspections.filter((item) => {
      const inspectionDate = item.submittedAt ? new Date(item.submittedAt) : new Date(item.date);
      if (Number.isNaN(inspectionDate.getTime())) return false;
      if (inspectionDate > now) return false;
      if (period === "month" && inspectionDate < startOfMonth) return false;
      if (period === "quarter" && inspectionDate < startOfQuarter) return false;
      if (period === "year" && inspectionDate < startOfYear) return false;
      if (organizationFilter && item.organization !== organizationFilter) return false;
      if (inspectorFilter && item.inspector !== inspectorFilter) return false;
      if (statusFilter === "Verified" && item.status !== "Verified") return false;
      if (statusFilter === "Flagged" && item.status !== "Flagged") return false;
      if (statusFilter === "Pending" && (item.status === "Verified" || item.status === "Flagged")) return false;
      return true;
    });
  }, [persistedInspections, period, organizationFilter, inspectorFilter, statusFilter]);
  const reportAnalytics = useMemo(() => {
    const grouped = new Map<string, { day: string; verified: number; scheduled: number }>();
    for (const item of filteredInspections) {
      const date = item.submittedAt ? new Date(item.submittedAt) : new Date(item.date);
      const key = date.toISOString().slice(0, 10);
      const day = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      const group = grouped.get(key) ?? { day, verified: 0, scheduled: 0 };
      if (item.status === "Verified") group.verified += 1;
      if (item.scheduleId) group.scheduled += 1;
      grouped.set(key, group);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [filteredInspections]);
  const statusBreakdown = [
    { name: "Verified", value: filteredInspections.filter((item) => item.status === "Verified").length, color: "var(--success)" },
    { name: "Pending", value: filteredInspections.filter((item) => item.status !== "Verified" && item.status !== "Flagged").length, color: "var(--warning)" },
    { name: "Flagged", value: filteredInspections.filter((item) => item.status === "Flagged").length, color: "var(--destructive)" },
  ];
  const organizationsInspected = new Set(filteredInspections.map((item) => item.organization)).size;
  const scheduledInspections = filteredInspections.filter((item) => item.scheduleId).length;
  const scheduledShare = filteredInspections.length
    ? `${((scheduledInspections / filteredInspections.length) * 100).toFixed(1)}% of total`
    : "0% of total";
  const capturedEvidence = filteredInspections.filter((item) => item.photo === "Captured").length;
  const exportReport = () => {
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ["Inspection ID", "Organization", "Inspector", "Date", "Time", "Status", "GPS", "Photo", "Schedule ID", "Submitted at"],
      ...filteredInspections.map((item) => [
        item.id,
        item.organization,
        item.inspector,
        item.date,
        item.time,
        item.status,
        item.gps,
        item.photo,
        item.scheduleId ?? "",
        item.submittedAt ?? "",
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "satark-drishti-inspection-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Report exported");
  };
  return (
    <>
      <PageHeader
        eyebrow="Operational intelligence"
        title="Reports"
        description="Analyze inspection coverage, evidence outcomes and synchronization performance."
        actions={
          <Button onClick={exportReport}>
            <Download />
            Export Report
          </Button>
        }
      />
      <DemoNote />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <select className="h-10 rounded-md border bg-card px-3 text-xs" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="month">This month</option>
          <option value="quarter">This quarter</option>
          <option value="year">This year</option>
          <option value="all">All time</option>
        </select>
        <select className="h-10 rounded-md border bg-card px-3 text-xs" value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}>
          <option value="">All organizations</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.name}>{organization.name}</option>
          ))}
        </select>
        <select className="h-10 rounded-md border bg-card px-3 text-xs" value={inspectorFilter} onChange={(event) => setInspectorFilter(event.target.value)}>
          <option value="">All inspectors</option>
          {inspectors.map((inspector) => <option key={inspector} value={inspector}>{inspector}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-card px-3 text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All verification states</option>
          <option value="Verified">Verified</option>
          <option value="Pending">Pending</option>
          <option value="Flagged">Flagged</option>
        </select>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total inspections"
          value={filteredInspections.length}
          detail="Selected period"
          icon={FileCheck2}
        />
        <StatCard
          label="Organizations inspected"
          value={organizationsInspected}
          detail={`${organizations.length ? ((organizationsInspected / organizations.length) * 100).toFixed(1) : "0.0"}% of registered organizations`}
          icon={Building2}
        />
        <StatCard
          label="Scheduled inspections"
          value={scheduledInspections}
          detail={scheduledShare}
          icon={Shuffle}
        />
        <StatCard
          label="Evidence captured"
          value={capturedEvidence}
          detail={`${filteredInspections.filter((item) => item.gps === "Verified").length} GPS verified`}
          icon={Camera}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="h-[360px] rounded-lg border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Inspection activity</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={reportAnalytics}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="verified"
                fill="var(--success)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="scheduled"
                name="Scheduled"
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[360px] rounded-lg border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Verification breakdown</p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={statusBreakdown}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={95}
                paddingAngle={4}
              >
                {statusBreakdown.map((x) => (
                  <Cell key={x.name} fill={x.color} />
                ))}
              </Pie>
              <Tooltip {...chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { settings } = usePortalData();
  const updateSettings = useUpdatePortalSettings();
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [oversightUnit, setOversightUnit] = useState(settings.oversightUnit);
  const [alerts, setAlerts] = useState(settings.criticalInspectionAlerts);
  const [sync, setSync] = useState(settings.automaticSynchronization);
  const saveSettings = async () => {
    try {
      await updateSettings({
        displayName,
        oversightUnit,
        criticalInspectionAlerts: alerts,
        automaticSynchronization: sync,
      });
      toast.success("Portal preferences saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Portal preferences"
        title="Settings"
        description="Manage authority portal notifications, synchronization and evidence review preferences."
      />
      <DemoNote />
      <div className="max-w-3xl space-y-4">
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold">Authority profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Oversight unit
              <input
                value={oversightUnit}
                onChange={(event) => setOversightUnit(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>
        </div>
        {[
          [
            "Critical inspection alerts",
            "Receive alerts for flagged evidence and boundary exceptions",
            alerts,
            setAlerts,
          ],
          [
            "Automatic synchronization",
            "Upload offline evidence when a stable connection returns",
            sync,
            setSync,
          ],
        ].map(([title, text, value, setter]: any) => (
          <div
            key={title}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border bg-card p-5 shadow-card"
          >
            <div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{text}</p>
            </div>
            <Switch checked={value} onCheckedChange={setter} />
          </div>
        ))}
        <Button onClick={saveSettings}>
          Save preferences
        </Button>
      </div>
    </>
  );
}
