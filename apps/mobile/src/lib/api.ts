export const API_BASE_URL = "http://localhost:3000";

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

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>(
    `${API_BASE_URL}/dashboard`,
  );
}

export async function createSession(
  platforms: Platform[],
): Promise<StreamSession> {
  return request<StreamSession>(
    `${API_BASE_URL}/sessions`,
    {
      method: "POST",
      headers: {
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
  return request<StreamSession>(
    `${API_BASE_URL}/sessions/${sessionId}/start`,
    {
      method: "POST",
    },
  );
}

export async function endSession(
  sessionId: string,
): Promise<StreamSession> {
  return request<StreamSession>(
    `${API_BASE_URL}/sessions/${sessionId}/end`,
    {
      method: "POST",
    },
  );
}