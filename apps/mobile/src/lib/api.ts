
import { getAccessToken } from "./auth-storage";
import type { UserIdentity } from "./auth-types";

export const API_BASE_URL = "http://192.168.1.11:3000";

export type Platform = "youtube" | "tiktok" | "twitch" | "kick";

export type StreamSession = {
  id: string;
  status: "idle" | "live" | "ended";
  platforms: Platform[];
  startedAt?: number;
  endedAt?: number;
};

export type DashboardEvent = {
  id: string;
  platform: string;
  type: string;
  username: string;
  message?: string;
  amount?: number;
  currency?: string;
  timestamp: number;
};

export type DashboardData = {
  session: StreamSession | null;
  events: {
    total: number;
    recent: DashboardEvent[];
  };
};

export type LoginResponse = {
  accessToken: string;
  user: UserIdentity;
};

export type CurrentUserResponse = {
  user: UserIdentity;
};

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Request gagal. Status: ${response.status}`;

    try {
      const errorData = await response.json();

      if (typeof errorData.message === "string") {
        message = errorData.message;
      } else if (Array.isArray(errorData.message)) {
        message = errorData.message.join(", ");
      }
    } catch {
      // Gunakan pesan status jika respons bukan JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("User belum login.");
  }

  return request<CurrentUserResponse>(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("User belum login.");
  }

  return { Authorization: `Bearer ${accessToken}` };
}

export async function getDashboard(): Promise<DashboardData> {
  const headers = await getAuthHeaders();

  return request<DashboardData>(`${API_BASE_URL}/dashboard`, {
    headers,
  });
}

export async function createSession(
  platforms: Platform[],
): Promise<StreamSession> {
  const headers = await getAuthHeaders();

  return request<StreamSession>(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ platforms }),
  });
}

export async function startSession(
  sessionId: string,
): Promise<StreamSession> {
  const headers = await getAuthHeaders();

  return request<StreamSession>(
    `${API_BASE_URL}/sessions/${sessionId}/start`,
    { method: "POST", headers },
  );
}

export async function endSession(
  sessionId: string,
): Promise<StreamSession> {
  const headers = await getAuthHeaders();

  return request<StreamSession>(
    `${API_BASE_URL}/sessions/${sessionId}/end`,
    { method: "POST", headers },
  );
}

// Overlay API

export type OverlayToken = {
  id: string;
  sessionId: string;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
};

export type CreatedOverlayToken = {
  id: string;
  sessionId: string;
  createdAt: string;
  token: string;
  url: string;
  warning?: string;
};

export type CreateOverlayTokenBody = {
  sessionId: string;
};

export type RevokeOverlayTokenResponse = {
  success: boolean;
  alreadyRevoked?: boolean;
};

export async function getOverlayTokens(): Promise<OverlayToken[]> {
  const headers = await getAuthHeaders();

  return request<OverlayToken[]>(`${API_BASE_URL}/overlay/tokens`, {
    headers,
  });
}

export async function createOverlayToken(
  sessionId: string,
): Promise<CreatedOverlayToken> {
  const headers = await getAuthHeaders();

  return request<CreatedOverlayToken>(
    `${API_BASE_URL}/overlay/tokens`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    },
  );
}

export async function revokeOverlayToken(
  tokenId: string,
): Promise<RevokeOverlayTokenResponse> {
  const headers = await getAuthHeaders();

  return request<RevokeOverlayTokenResponse>(
    `${API_BASE_URL}/overlay/tokens/${encodeURIComponent(tokenId)}`,
    {
      method: "DELETE",
      headers,
    },
  );
}

// OBS Studio API

export type ObsStatus = {
  connected: boolean;
  obsVersion: string;
  obsWebSocketVersion: string;
  currentScene: string;
  scenes: string[];
  streaming: boolean;
  recording: boolean;
};

export type ObsScene = {
  name: string;
  index: number;
};

export type ObsScenesResult = {
  currentScene: string;
  scenes: ObsScene[];
};

export type ObsStreamStatus = {
  streaming: boolean;
  reconnecting: boolean;
  duration: number;
  bytes: number;
  congestion: number;
};

export type ObsActionResult = {
  success: boolean;
  message?: string;
  connected?: boolean;
  currentScene?: string;
};

async function obsRequest<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<T> {
  const headers = await getAuthHeaders();

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return request<T>(`${API_BASE_URL}/obs${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function connectObs(password?: string): Promise<ObsStatus> {
  return obsRequest<ObsStatus>(
    "/connect",
    "POST",
    password === undefined ? {} : { password },
  );
}

export function disconnectObs(): Promise<ObsActionResult> {
  return obsRequest<ObsActionResult>("/disconnect", "POST");
}

export function getObsStatus(): Promise<ObsStatus> {
  return obsRequest<ObsStatus>("/status");
}

export function getObsScenes(): Promise<ObsScenesResult> {
  return obsRequest<ObsScenesResult>("/scenes");
}

export function setObsScene(
  sceneName: string,
): Promise<ObsActionResult> {
  return obsRequest<ObsActionResult>("/scenes", "POST", { sceneName });
}

export function getObsStreamStatus(): Promise<ObsStreamStatus> {
  return obsRequest<ObsStreamStatus>("/stream/status");
}

export function startObsStream(): Promise<ObsActionResult> {
  return obsRequest<ObsActionResult>("/stream/start", "POST");
}

export function stopObsStream(): Promise<ObsActionResult> {
  return obsRequest<ObsActionResult>("/stream/stop", "POST");
}
