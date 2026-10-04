import test from "node:test";
import assert from "node:assert/strict";

const makeStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
};

const storage = makeStorage();
(globalThis as any).window = {
  sessionStorage: storage,
  localStorage: storage,
};

const { clearStoredSession, createPortalSession, getStoredSession, setStoredSession } = await import("./auth.ts");

test("rejects credentials when the backend refuses login", async () => {
  clearStoredSession();
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: false,
    json: async () => ({ detail: "Incorrect username or password" }),
  });

  try {
    await assert.rejects(
      createPortalSession("unknown", "wrong-password", "Authority Officer"),
      /Incorrect username or password/,
    );
    assert.equal(getStoredSession(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stores the backend session without retaining the password", async () => {
  clearStoredSession();
  const originalFetch = globalThis.fetch;
  let submittedBody: Record<string, string> | undefined;
  (globalThis as any).fetch = async (_url: string, options: RequestInit) => {
    submittedBody = JSON.parse(String(options.body));
    return {
      ok: true,
      json: async () => ({
        role: "authority",
        username: "authority",
        displayName: "Authority Officer",
        expiresAt: Date.now() + 300_000,
      }),
    };
  };

  try {
    const session = await createPortalSession("authority", "server-verified", "Authority Officer");

    assert.equal(session.username, "authority");
    assert.equal(session.role, "authority");
    assert.equal("password" in session, false);
    assert.equal(submittedBody?.portal_role, "Authority Officer");
    assert.equal(getStoredSession()?.username, "authority");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a backend session for a different selected portal", async () => {
  clearStoredSession();
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      role: "inspector",
      username: "inspector",
      displayName: "Inspector",
      expiresAt: Date.now() + 300_000,
    }),
  });

  try {
    await assert.rejects(
      createPortalSession("inspector", "password", "Authority Officer"),
      /invalid session/,
    );
    assert.equal(getStoredSession(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects expired stored sessions", () => {
  clearStoredSession();
  setStoredSession({
    role: "authority",
    username: "authority",
    displayName: "Authority Officer",
    expiresAt: Date.now() - 1,
  });

  assert.equal(getStoredSession(), null);
  assert.equal(window.sessionStorage.getItem("satark-session"), null);
});

test("clearStoredSession removes all active auth session keys", () => {
  setStoredSession({ role: "authority", username: "authority", displayName: "Authority Officer", expiresAt: Date.now() + 300_000 });
  window.sessionStorage.setItem("satark-inspector-session", JSON.stringify({ role: "inspector", username: "inspector" }));

  clearStoredSession();

  assert.equal(window.sessionStorage.getItem("satark-session"), null);
  assert.equal(window.sessionStorage.getItem("satark-inspector-session"), null);
});
