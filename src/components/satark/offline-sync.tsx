import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/satark/portal";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { getPendingInspections, type OfflineInspectionSubmission } from "@/lib/offline-inspections";

type InspectionRecord = {
  id: string;
  organization: string;
  inspector: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  location_check_status: string | null;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export function OfflineSyncPage() {
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [pendingInspections, setPendingInspections] = useState<OfflineInspectionSubmission[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function refreshPendingInspections() {
    const pending = await getPendingInspections().catch(() => []);
    setPendingInspections(pending);
  }

  async function refreshRecords() {
    await refreshPendingInspections();
    if (!navigator.onLine) {
      setIsOnline(false);
      setApiReachable(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/inspections`);
      if (!response.ok) throw new Error(`API request failed (${response.status}).`);
      setRecords(await response.json());
      setIsOnline(true);
      setApiReachable(true);
      setLastUpdated(new Date());
    } catch (requestError) {
      setApiReachable(false);
      setError(requestError instanceof Error ? requestError.message : "Could not reach the inspection API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void refreshRecords();
    };
    const onOffline = () => {
      setIsOnline(false);
      setApiReachable(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void refreshRecords();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Synchronization status"
        title="Offline Sync"
        description="Review inspections accepted by the backend and check whether synchronization services are reachable."
        actions={<Button variant="outline" onClick={() => void refreshRecords()} disabled={loading || !isOnline}><RefreshCw />Refresh</Button>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Browser network</p>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">{isOnline ? <Wifi className="size-4 text-success" /> : <WifiOff className="size-4 text-destructive" />}{isOnline ? "Online" : "Offline"}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Inspection API</p>
          <div className="mt-2"><StatusBadge>{apiReachable === null ? "Checking" : apiReachable ? "Reachable" : "Unavailable"}</StatusBadge></div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Queued on this device</p>
          <p className="mt-2 text-xl font-bold tabular-nums">{pendingInspections.length}</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Unsent inspections remain in this browser’s IndexedDB queue and retry automatically when online. Accepted records and photo evidence persist in the backend’s SQLite database.</p>
      {error && <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm" role="status">{error}</div>}
      {lastUpdated && <p className="mb-3 text-xs text-muted-foreground">Last refreshed {lastUpdated.toLocaleTimeString()}</p>}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs text-muted-foreground">
              <tr><th className="px-4 py-3">Record</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Inspector</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Location check</th></tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{record.id}</td>
                  <td className="px-4 py-3">{record.organization}</td>
                  <td className="px-4 py-3">{record.inspector}</td>
                  <td className="px-4 py-3">{record.date}</td>
                  <td className="px-4 py-3">{record.location_check_status?.replaceAll("_", " ") ?? (record.latitude != null && record.longitude != null ? "not configured" : "not captured")}</td>
                </tr>
              ))}
              {pendingInspections.map((record) => (
                <tr key={record.client_submission_id} className="border-b last:border-0 bg-warning-soft/40">
                  <td className="px-4 py-3 font-mono text-xs">Pending sync</td>
                  <td className="px-4 py-3">{record.organization}</td>
                  <td className="px-4 py-3">{record.inspector}</td>
                  <td className="px-4 py-3">{record.date}</td>
                  <td className="px-4 py-3">{record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}</td>
                </tr>
              ))}
              {!loading && records.length === 0 && pendingInspections.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">{apiReachable ? "No inspections have been accepted or queued yet." : "Inspection records are unavailable while the API is offline."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}