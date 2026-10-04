import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePortalData, useUpdatePortalSettings } from "@/lib/portal-data";
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
  Radio,
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

export function DashboardPage() {
  const [range, setRange] = useState("This Month");
  const { dashboard, analytics, inspections, settings } = usePortalData();
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
          value={dashboard.totalOrganizations}
          detail={`${dashboard.activeDistricts} active districts`}
          icon={Building2}
        />
        <StatCard
          label="Inspections This Month"
          value={dashboard.inspectionsThisMonth}
          detail={dashboard.monthlyChange}
          icon={FileCheck2}
        />
        <StatCard
          label="Verified Inspections"
          value={dashboard.verifiedInspections}
          detail={dashboard.verificationRate}
          icon={ShieldCheck}
          toneName="success"
        />
        <StatCard
          label="Pending Verification"
          value={dashboard.pendingVerification}
          detail="Awaiting authority review"
          icon={Timer}
          toneName="warning"
        />
        <StatCard
          label="Flagged Inspections"
          value={dashboard.flaggedInspections}
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
              <AreaChart data={analytics}>
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
              <BarChart data={analytics}>
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
  return (
    <>
      <PageHeader
        eyebrow={records ? "Digital archive" : "Field operations"}
        title={records ? "Inspection Records" : "Inspections"}
        description={
          records
            ? "Search synchronized inspection history and review each connected evidence trail."
            : "Review active and completed inspections, evidence status and synchronization state."
        }
      />
      <DemoNote />
      <Filters placeholder="Search by inspection ID, organization or inspector..." />
      <InspectionTable rows={inspections} />
    </>
  );
}

export function InspectionDetailPage({ id }: { id: string }) {
  const { inspections, timeline, mapRadiusM } = usePortalData();
  const inspection = inspections.find((item) => item.id === id);
  if (!inspection) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Inspection not found.</div>;
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
  const { organizations } = usePortalData();
  return (
    <>
      <PageHeader
        eyebrow="Organization oversight"
        title="Organizations"
        description="Search registered organizations and review inspection coverage, verification history and attention indicators."
      />
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
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-muted-foreground">{l}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <GPSMap radiusM={mapRadiusM} />
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
            {timeline.map(({ title, time }) => (
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
  const { randomSchedule, randomScheduleStats } = usePortalData();
  return (
    <>
      <PageHeader
        eyebrow="Unpredictable scheduling"
        title="Random Inspection Engine"
        description="Inspection timings are generated unpredictably to reduce the possibility of organizations preparing specifically for an inspection."
        actions={<StatusBadge>Randomized</StatusBadge>}
      />
      <DemoNote />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming randomized"
          value={randomScheduleStats.upcoming}
          detail={`Across ${randomScheduleStats.districts} districts`}
          icon={Shuffle}
        />
        <StatCard
          label="Completed this month"
          value={randomScheduleStats.completedThisMonth}
          detail={randomScheduleStats.completionRate}
          icon={CheckCircle2}
          toneName="success"
        />
        <StatCard
          label="Monthly frequency"
          value={randomScheduleStats.monthlyFrequency}
          detail="High-attention organizations"
          icon={Activity}
        />
        <StatCard
          label="Schedule status"
          value={randomScheduleStats.status}
          detail={`Next generation ${randomScheduleStats.nextGeneration}`}
          icon={CalendarDays}
        />
      </div>
      <Section
        title="Randomized inspection schedule"
        description="Exact assignments remain available only to authorized officials."
      >
        <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b bg-muted/60">
              <tr>
                {[
                  "Schedule",
                  "Organization",
                  "Assigned inspector",
                  "Time window",
                  "Frequency",
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
              {randomSchedule.map((x) => (
                <tr key={x.id} className="border-b last:border-0">
                  <td className="px-4 py-4 font-mono font-semibold text-primary">
                    {x.id}
                  </td>
                  <td className="px-4 py-4 font-semibold">{x.organization}</td>
                  <td className="px-4 py-4">{x.inspector}</td>
                  <td className="px-4 py-4">{x.window}</td>
                  <td className="px-4 py-4">{x.frequency}</td>
                  <td className="px-4 py-4">
                    <StatusBadge>{x.state}</StatusBadge>
                  </td>
                </tr>
              ))}
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
  const { inspections, mapRadiusM } = usePortalData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = inspections.find((item) => item.id === selectedId) ?? inspections[0];
  if (!selected) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">No inspection records are available.</div>;
  }
  return (
    <>
      <PageHeader
        eyebrow="Authority review workspace"
        title="Evidence Verification"
        description="Review connected inspection evidence layer by layer before recording an authority decision."
        actions={<StatusBadge>{selected.status}</StatusBadge>}
      />
      <DemoNote />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-lg border bg-card p-3 shadow-card">
          <p className="px-2 py-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">
            Review queue
          </p>
          {inspections.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`mb-1 w-full rounded-md border p-3 text-left transition ${selected.id === item.id ? "border-primary bg-info-soft" : "border-transparent hover:bg-muted"}`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-mono text-[10px] font-bold text-primary">
                  {item.id}
                </span>
                <StatusBadge>{item.status}</StatusBadge>
              </div>
              <p className="mt-2 text-xs font-semibold">{item.organization}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {item.inspector} · {item.date}
              </p>
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-success">
                  Verification status: {selected.status.toUpperCase()}
                </p>
                <h2 className="mt-2 font-display text-xl font-bold">
                  {selected.organization}
                </h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {selected.id} · {selected.evidenceId}
                </p>
              </div>
              <ShieldCheck className="size-12 text-success" />
            </div>
          </div>
          <InspectionEvidenceCard inspection={selected} />
          <div className="grid gap-4 md:grid-cols-2">
            <PhotoViewer image={selected.photoUrl} inspection={selected} />
            <GPSMap flagged={selected.gps === "Outside radius"} radiusM={mapRadiusM} />
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-bold">Evidence components</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                [MapPin, "Location evidence", selected.gps],
                [
                  Timer,
                  "Timestamp recorded",
                  `${selected.date} · ${selected.time}`,
                ],
                [Camera, "Live photo captured", selected.photo],
                [Cloud, "Inspection record synchronized", selected.sync],
              ].map(([Icon, label, value]: any) => (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => toast.success("Inspection marked as verified")}
              >
                <CheckCircle2 />
                Verify evidence
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.warning("Inspection flagged for additional review")
                }
              >
                <AlertTriangle />
                Flag for review
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ReportsPage() {
  const { reports, analytics, organizations, inspections } = usePortalData();
  const inspectors = [...new Set(inspections.map((item) => item.inspector))];
  const exportReport = () => {
    const blob = new Blob(
      [["Status,Count", ...reports.pie.map((item) => `${item.name},${item.value}`)].join("\n")],
      { type: "text/csv" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "satark-drishti-demo-report.csv";
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
        <select className="h-10 rounded-md border bg-card px-3 text-xs">
          <option>This month</option>
          <option>This quarter</option>
        </select>
        <select className="h-10 rounded-md border bg-card px-3 text-xs">
          <option>All organizations</option>
          {organizations.map((x) => (
            <option key={x.id}>{x.name}</option>
          ))}
        </select>
        <select className="h-10 rounded-md border bg-card px-3 text-xs">
          <option>All inspectors</option>
          {inspectors.map((inspector) => <option key={inspector}>{inspector}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-card px-3 text-xs">
          <option>All verification states</option>
          <option>Verified</option>
          <option>Pending</option>
          <option>Flagged</option>
        </select>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total inspections"
          value={reports.totalInspections}
          detail="Selected period"
          icon={FileCheck2}
        />
        <StatCard
          label="Organizations inspected"
          value={reports.organizationsInspected}
          detail={reports.coverage}
          icon={Building2}
        />
        <StatCard
          label="Random inspections"
          value={reports.randomInspections}
          detail={reports.randomShare}
          icon={Shuffle}
        />
        <StatCard
          label="Offline inspections"
          value={reports.offlineInspections}
          detail={`${reports.offlineSynchronized} synchronized`}
          icon={CloudOff}
          toneName="warning"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="h-[360px] rounded-lg border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Inspection activity</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={analytics}>
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
                dataKey="random"
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
                data={reports.pie}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={95}
                paddingAngle={4}
              >
                {reports.pie.map((x) => (
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
