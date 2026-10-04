export type Status = "Verified" | "Pending" | "Flagged";
export type SyncStatus = "Synced" | "Offline Sync Pending" | "Failed";

export type Inspection = {
  id: string;
  organization: string;
  organizationId: string;
  inspector: string;
  date: string;
  time: string;
  scheduledTime: string;
  gps: "Verified" | "Outside radius" | "Pending";
  photo: "Captured" | "Pending";
  status: Status;
  sync: SyncStatus;
  duration: string;
  distance: string;
  coordinates: string;
  evidenceId: string;
  photoMediaId?: string | null;
  photoUrl?: string | null;
};

