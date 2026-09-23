const API =
  (typeof window !== "undefined" && (window as unknown as { __API__?: string }).__API__) ||
  "http://localhost:8787";

export function apiBase() {
  return API.replace(/\/$/, "");
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error((err as { message?: string }).message || "request failed"), {
      status: res.status,
      body: err,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type PlanSnapshot = {
  plan: string;
  period: string;
  limits: {
    channels: number;
    team: boolean;
    aiImages: number;
    aiVideos: number;
    aiClipMinutes: number;
    aiCopilot: number;
  };
  used: Record<string, number>;
};

export type Workspace = {
  id: string;
  name: string;
  plan: string;
  theme: string;
  signature: string | null;
  accountKind?: "solo" | "agency" | null;
  onboardingCompleted?: boolean;
};

const PLACEHOLDER_NAME = "My workspace";

export function spaceName(ws: { name?: string | null } | null | undefined, fallback = "Account") {
  const n = (ws?.name || "").trim();
  if (!n || n === PLACEHOLDER_NAME) return fallback;
  return n;
}

export function isOnboarded(ws: Pick<Workspace, "name" | "onboardingCompleted">) {
  if (ws.onboardingCompleted === true) return true;
  if (ws.onboardingCompleted === false) return false;
  const n = (ws.name || "").trim();
  return !!n && n !== PLACEHOLDER_NAME;
}

export async function nextAfterAuth() {
  try {
    const me = await api<{ workspace: Workspace }>("/v1/workspaces/me");
    return isOnboarded(me.workspace) ? "/app" : "/onboarding";
  } catch {
    return "/onboarding";
  }
}
