import { getAccessToken } from "./auth-storage";
import type { UserIdentity } from "./auth-types";

export const API_BASE_URL = "http://192.168.1.6:3000";

export type Platform =
  | "youtube"
  | "tiktok"
  | "twitch"
  | "kick";

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
    throw new Error(
      `Request gagal. Status: ${response.status}`,
    );
  }

  return response.json();
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await request<LoginResponse>(
    `${API_BASE_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  return response;
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("User belum login.");
  }

  return request<CurrentUserResponse>(
    `${API_BASE_URL}/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

async function getAuthHeaders(): Promise<
  Record<string, string>
> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("User belum login.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const headers = await getAuthHeaders();

  return request<DashboardData>(
    `${API_BASE_URL}/dashboard`,
    {
      headers,
    },
  );
}

export async function createSession(
  platforms: Platform[],
): Promise<StreamSession> {
  const headers = await getAuthHeaders();

  return request<StreamSession>(
    `${API_BASE_URL}/sessions`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platforms,
      }),
    },
  );
}

export async function startSession(
  sessionId: string,
): Promise<StreamSession> {
  const headers = await getAuthHeaders();

  return request<StreamSession>(
    `${API_BASE_URL}/sessions/${sessionId}/start`,
    {
      method: "POST",
      headers,
    },
  );
}

export async function endSession(
  sessionId: string,
): Promise<StreamSession> {
  const headers = await getAuthHeaders();

  return request<StreamSession>(
    `${API_BASE_URL}/sessions/${sessionId}/end`,
    {
      method: "POST",
      headers,
    },
  );
}
