export type Platform =
  | "youtube"
  | "tiktok"
  | "twitch"
  | "kick";

export type StreamEventType =
  | "chat"
  | "donation"
  | "follow"
  | "subscribe"
  | "member"
  | "raid"
  | "system";

export type StreamEvent = {
  id: string;
  platform: Platform;
  type: StreamEventType;
  username: string;
  message?: string;
  amount?: number;
  currency?: string;
  timestamp: number;
  sessionId?: string;
};

export type StreamSessionStatus =
  | "idle"
  | "live"
  | "ended";

export type StreamSession = {
  id: string;
  userId: string;
  status: StreamSessionStatus;
  platforms: Platform[];
  startedAt?: number;
  endedAt?: number;
};
