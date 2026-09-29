import { Injectable } from "@nestjs/common";
import type {
  Platform,
  StreamSession,
  StreamSessionStatus,
} from "@streamdex/types";

@Injectable()
export class StreamSessionService {
  private readonly sessions = new Map<string, StreamSession>();

  createSession(platforms: Platform[]): StreamSession {
    const session: StreamSession = {
      id: crypto.randomUUID(),
      status: "idle",
      platforms,
    };

    this.sessions.set(session.id, session);

    return session;
  }

  getSession(id: string): StreamSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): StreamSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSession(): StreamSession | undefined {
    return Array.from(this.sessions.values()).find(
      (session) => session.status === "live",
    );
  }

  getLatestSession(): StreamSession | undefined {
    const sessions = this.getAllSessions();

    if (sessions.length === 0) {
      return undefined;
    }

    return sessions.reduce((latest, current) => {
      const latestTime =
        latest.startedAt ??
        latest.endedAt ??
        0;

      const currentTime =
        current.startedAt ??
        current.endedAt ??
        0;

      return currentTime >= latestTime
        ? current
        : latest;
    });
  }

  startSession(id: string): StreamSession | undefined {
    const session = this.sessions.get(id);

    if (!session) {
      return undefined;
    }

    session.status = "live";
    session.startedAt = Date.now();
    delete session.endedAt;

    this.sessions.set(id, session);

    return session;
  }

  endSession(id: string): StreamSession | undefined {
    const session = this.sessions.get(id);

    if (!session) {
      return undefined;
    }

    session.status = "ended";
    session.endedAt = Date.now();

    this.sessions.set(id, session);

    return session;
  }

  updateSessionStatus(
    id: string,
    status: StreamSessionStatus,
  ): StreamSession | undefined {
    const session = this.sessions.get(id);

    if (!session) {
      return undefined;
    }

    session.status = status;

    if (status === "live" && !session.startedAt) {
      session.startedAt = Date.now();
    }

    if (status === "ended" && !session.endedAt) {
      session.endedAt = Date.now();
    }

    this.sessions.set(id, session);

    return session;
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }
}