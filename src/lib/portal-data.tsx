import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Inspection } from "@/lib/demo-data";

export interface OrganizationRecord {
  id: string;
  name: string;
  reg: string;
  location: string;
  address: string;
  last: string;
  next: string;
  verification: string;
  risk: string;
  count: number;
  latitude?: number | null;
  longitude?: number | null;
  radius_m?: number | null;
}

export interface PortalData {
  mapRadiusM: number;
  dashboard: {
    updatedAt: string;
    totalOrganizations: number;
    activeDistricts: number;
    inspectionsThisMonth: number;
    monthlyChange: string;
    verifiedInspections: number;
    verificationRate: string;
    pendingVerification: number;
    flaggedInspections: number;
    offlineSyncPending: number;
  };
  inspections: Inspection[];
  organizations: OrganizationRecord[];
  analytics: Array<{ day: string; total: number; verified: number; pending: number; random: number; flagged: number }>;
  randomSchedule: Array<{ id: string; organization: string; inspector: string; window: string; frequency: string; state: string }>;
  randomScheduleStats: {
    upcoming: number;
    districts: number;
    completedThisMonth: number;
    completionRate: string;
    monthlyFrequency: number;
    nextGeneration: string;
    status: string;
  };
  timeline: Array<{ title: string; time: string; detail: string }>;
  cameras: Array<{ name: string; org: string; status: string; last: string; timestamp: string }>;
  sync: {
    pendingUploads: number;
    pendingEvidenceFiles: number;
    synchronizedThisMonth: number;
    failedSynchronizations: number;
    lastSyncTime: string;
    lastSyncDate: string;
    queuedRecords: number;
    queuedEvidenceSize: string;
    progress: number;
    automaticRetry: boolean;
    connectionStatus: string;
    networkLabel: string;
  };
  reports: {
    totalInspections: number;
    organizationsInspected: number;
    coverage: string;
    randomInspections: number;
    randomShare: string;
    offlineInspections: number;
    offlineSynchronized: number;
    pie: Array<{ name: string; value: number; color: string }>;
  };
  settings: {
    displayName: string;
    oversightUnit: string;
    criticalInspectionAlerts: boolean;
    automaticSynchronization: boolean;
  };
}

interface PortalDataState {
  data: PortalData | null;
  error: string;
  retry: () => void;
  reload: () => void;
  updateSettings: (settings: PortalData["settings"]) => Promise<void>;
}

const PortalDataContext = createContext<PortalDataState | null>(null);
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function inspectionTimestamp(record: Record<string, unknown>): number {
  const submittedAt = typeof record.submitted_at === "string" ? Date.parse(record.submitted_at) : Number.NaN;
  if (!Number.isNaN(submittedAt)) return submittedAt;

  const date = new Date(`${String(record.date ?? "")}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const time = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(record.time ?? ""));
  if (time) {
    const hour = Number(time[1]) % 12 + (time[3].toUpperCase() === "PM" ? 12 : 0);
    date.setHours(hour, Number(time[2]), 0, 0);
  }
  return date.getTime();
}

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let loading = false;
    const mediaObjectUrls: string[] = [];

    async function loadPortalData() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch(`${API_BASE_URL}/api/portal-data`, { signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail || `Portal data request failed (${response.status})`);
        }
        const payload = await response.json() as PortalData;
        const [inspectionResponse, organizationResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/inspections`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/organizations`, { signal: controller.signal }),
        ]);
        if (!inspectionResponse.ok) {
          throw new Error(`Inspection records request failed (${inspectionResponse.status}).`);
        }
        if (!organizationResponse.ok) {
          throw new Error(`Organizations request failed (${organizationResponse.status}).`);
        }
        const liveRecords = await inspectionResponse.json() as Array<Record<string, unknown>>;
        liveRecords.sort((left, right) => {
          const leftIsSubmission = Boolean(left.client_submission_id);
          const rightIsSubmission = Boolean(right.client_submission_id);
          if (leftIsSubmission !== rightIsSubmission) return leftIsSubmission ? -1 : 1;
          return inspectionTimestamp(right) - inspectionTimestamp(left);
        });
        const registeredOrganizations = await organizationResponse.json() as OrganizationRecord[];
        const organizationsByName = new Map(payload.organizations.map((item) => [item.name, item]));
        for (const organization of registeredOrganizations) {
          const sample = organizationsByName.get(organization.name);
          organizationsByName.set(organization.name, sample ? {
            ...sample,
            ...organization,
            last: organization.last ? formatDate(organization.last) : sample.last || "No inspections",
            count: organization.count,
          } : organization);
        }
        const organizationIds = new Map([...organizationsByName.values()].map((item) => [item.name, item.id]));
        const liveInspections: Inspection[] = liveRecords.map((record) => {
          const date = String(record.date ?? "");
          const coordinatesAvailable = typeof record.latitude === "number" && typeof record.longitude === "number";
          const checkStatus = typeof record.location_check_status === "string" ? record.location_check_status : null;
          return {
            id: String(record.id),
            organization: String(record.organization),
            organizationId: organizationIds.get(String(record.organization)) ?? "",
            location: String(record.location ?? "Location not recorded"),
            inspector: String(record.inspector),
            date: date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not recorded",
            time: String(record.time ?? "Not recorded"),
            scheduledTime: record.scheduled_date && record.scheduled_time
              ? `${formatDate(String(record.scheduled_date))} · ${String(record.scheduled_time)}`
              : String(record.schedule_id ?? "Not recorded"),
            gps: checkStatus === "verified" ? "Verified" : checkStatus === "outside_radius" ? "Outside radius" : coordinatesAvailable ? "Pending" : "Pending",
            photo: record.photo_media_id ? "Captured" : "Pending",
            status: record.status === "Verified" || record.status === "Flagged" ? record.status : "Submitted",
            sync: "Synced",
            duration: "Not recorded",
            distance: typeof record.location_distance_m === "number" ? `${record.location_distance_m} m` : "Not available",
            coordinates: coordinatesAvailable ? `${Number(record.latitude).toFixed(5)}° , ${Number(record.longitude).toFixed(5)}°` : "Not captured",
            evidenceId: String(record.id),
            photoMediaId: typeof record.photo_media_id === "string" ? record.photo_media_id : null,
            photoCapturedAt: typeof record.photo_captured_at === "string" ? record.photo_captured_at : null,
            locationCapturedAt: typeof record.location_captured_at === "string" ? record.location_captured_at : null,
            submittedAt: typeof record.submitted_at === "string" ? record.submitted_at : null,
            locationAccuracyM: typeof record.location_accuracy_m === "number" ? record.location_accuracy_m : null,
            locationDistanceM: typeof record.location_distance_m === "number" ? record.location_distance_m : null,
            locationCheckStatus: checkStatus,
            scheduleId: typeof record.schedule_id === "string" ? record.schedule_id : null,
            notes: typeof record.notes === "string" ? record.notes : null,
            isLive: Boolean(record.client_submission_id),
            isPersisted: true,
          };
        });
        const mergedInspections = liveInspections;
        const mediaUrls = new Map<string, string>();
        const mediaIds = [...new Set(mergedInspections.map((item) => item.photoMediaId).filter((mediaId): mediaId is string => Boolean(mediaId)))];
        await Promise.all(mediaIds.map(async (mediaId) => {
          try {
            const mediaResponse = await fetch(`${API_BASE_URL}/api/media/${encodeURIComponent(mediaId)}`, { signal: controller.signal });
            if (!mediaResponse.ok) return;
            const objectUrl = URL.createObjectURL(await mediaResponse.blob());
            mediaObjectUrls.push(objectUrl);
            mediaUrls.set(mediaId, objectUrl);
          } catch (mediaError) {
            if (controller.signal.aborted) throw mediaError;
          }
        }));

        if (cancelled) return;
        setData({
          ...payload,
          dashboard: {
            ...payload.dashboard,
            totalOrganizations: organizationsByName.size,
            updatedAt: new Date().toLocaleTimeString("en-IN"),
          },
          organizations: [...organizationsByName.values()],
          inspections: mergedInspections.map((item) => ({
            ...item,
            photoUrl: item.photoMediaId ? mediaUrls.get(item.photoMediaId) ?? `${API_BASE_URL}/api/media/${encodeURIComponent(item.photoMediaId)}` : null,
          })),
        });
        setError("");
      } catch (requestError: unknown) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Could not load portal data.");
      } finally {
        loading = false;
      }
    }

    void loadPortalData();
    const refreshTimer = window.setInterval(() => void loadPortalData(), 5_000);
    window.addEventListener("focus", loadPortalData);
    window.addEventListener("online", loadPortalData);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", loadPortalData);
      window.removeEventListener("online", loadPortalData);
      mediaObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [attempt]);

  async function updateSettings(settings: PortalData["settings"]) {
    const response = await fetch(`${API_BASE_URL}/api/portal-data/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.detail || `Settings update failed (${response.status})`);
    }
    setData((current) => current ? { ...current, settings: body } : current);
  }

  if (!data && !error) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Loading portal data…</div>;
  }

  if (!data) {
    return (
      <div className="mx-auto grid min-h-[50vh] max-w-lg content-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold">Portal data unavailable</p>
        <p className="text-sm text-muted-foreground">{error}. Start the FastAPI backend and try again.</p>
        <button type="button" className="mx-auto rounded-md border px-4 py-2 text-sm font-semibold" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </div>
    );
  }

  return <PortalDataContext.Provider value={{ data, error, retry: () => setAttempt((value) => value + 1), reload: () => setAttempt((value) => value + 1), updateSettings }}>{children}</PortalDataContext.Provider>;
}

export function usePortalData(): PortalData {
  const context = useContext(PortalDataContext);
  if (!context?.data) throw new Error("usePortalData must be used inside PortalDataProvider");
  return context.data;
}

export function useUpdatePortalSettings(): PortalDataState["updateSettings"] {
  const context = useContext(PortalDataContext);
  if (!context) throw new Error("useUpdatePortalSettings must be used inside PortalDataProvider");
  return context.updateSettings;
}

export function useReloadPortalData(): PortalDataState["retry"] {
  const context = useContext(PortalDataContext);
  if (!context) throw new Error("useReloadPortalData must be used inside PortalDataProvider");
  return context.reload;
}
