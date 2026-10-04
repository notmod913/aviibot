export type AuthRole = "authority" | "inspector";

export interface AuthSession {
  role: AuthRole;
  username: string;
  displayName: string;
  expiresAt: number;
}

export const portalRoles = ["Authority Officer", "Inspector"] as const;
export type PortalRole = (typeof portalRoles)[number];

const SESSION_KEY = "satark-session";
const INSPECTOR_SESSION_KEY = "satark-inspector-session";
const AUTH_SESSION_KEYS = [SESSION_KEY, INSPECTOR_SESSION_KEY] as const;
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.role || !parsed.username || !parsed.displayName) return null;
    if (
      !["authority", "inspector"].includes(parsed.role) ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      clearStoredSession();
      return null;
    }

    return {
      role: parsed.role as AuthRole,
      username: parsed.username,
      displayName: parsed.displayName,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function createPortalSession(username: string, password: string, portalRole: PortalRole) {
  if (typeof window === "undefined") throw new Error("Sign-in is only available in the browser.");

  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password, portal_role: portalRole }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Could not sign in. Check your account and try again.");
  }

  const session = result as AuthSession;
  const expectedRole: AuthRole = portalRole === "Inspector" ? "inspector" : "authority";
  if (session.role !== expectedRole || typeof session.expiresAt !== "number") {
    throw new Error("The authentication service returned an invalid session.");
  }

  clearStoredSession();
  setStoredSession(session);
  if (session.role === "inspector") {
    window.sessionStorage.setItem(
      INSPECTOR_SESSION_KEY,
      JSON.stringify({ username: session.username, role: session.role, expiresAt: session.expiresAt }),
    );
  }

  return session;
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;

  AUTH_SESSION_KEYS.forEach((key) => {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  });
}

