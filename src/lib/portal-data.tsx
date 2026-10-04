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
  updateSettings: (settings: PortalData["settings"]) => Promise<void>;
}

const PortalDataContext = createContext<PortalDataState | null>(null);
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const mediaObjectUrls: string[] = [];
    setError("");

    async function loadPortalData() {
      const response = await fetch(`${API_BASE_URL}/api/portal-data`, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Portal data request failed (${response.status})`);
      }
      const payload = await response.json() as PortalData;
      const mediaUrls = new Map<string, string>();
      const mediaIds = [...new Set(payload.inspections.map((item) => item.photoMediaId).filter((id): id is string => Boolean(id)))];

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
        inspections: payload.inspections.map((item) => ({
          ...item,
          photoUrl: item.photoMediaId ? mediaUrls.get(item.photoMediaId) ?? null : null,
        })),
      });
    }

    loadPortalData().catch((requestError: unknown) => {
      if (controller.signal.aborted) return;
      setError(requestError instanceof Error ? requestError.message : "Could not load portal data.");
    });

    return () => {
      cancelled = true;
      controller.abort();
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

  return <PortalDataContext.Provider value={{ data, error, retry: () => setAttempt((value) => value + 1), updateSettings }}>{children}</PortalDataContext.Provider>;
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
