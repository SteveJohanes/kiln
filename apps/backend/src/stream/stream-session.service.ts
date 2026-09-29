import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Platform,
  StreamSession,
  StreamSessionStatus,
} from "@streamdex/types";

@Injectable()
export class StreamSessionService {
  private readonly sessions = new Map<
    string,
    StreamSession
  >();

  createSession(
    userId: string,
    platforms: Platform[],
  ): StreamSession {
    const session: StreamSession = {
      id: crypto.randomUUID(),
      userId,
      status: "idle",
      platforms,
    };

    this.sessions.set(session.id, session);

    return session;
  }

  getSession(
    id: string,
    userId: string,
  ): StreamSession {
    const session = this.sessions.get(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    return session;
  }

  getAllSessions(
    userId: string,
  ): StreamSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId,
    );
  }

  getActiveSession(
    userId: string,
  ): StreamSession | undefined {
    return Array.from(this.sessions.values()).find(
      (session) =>
        session.userId === userId &&
        session.status === "live",
    );
  }

  getLatestSession(
    userId: string,
  ): StreamSession | undefined {
    const sessions = this.getAllSessions(userId);

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

  startSession(
    id: string,
    userId: string,
  ): StreamSession {
    const session = this.sessions.get(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    session.status = "live";
    session.startedAt = Date.now();
    delete session.endedAt;

    this.sessions.set(id, session);

    return session;
  }

  endSession(
    id: string,
    userId: string,
  ): StreamSession {
    const session = this.sessions.get(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    session.status = "ended";
    session.endedAt = Date.now();

    this.sessions.set(id, session);

    return session;
  }

  updateSessionStatus(
    id: string,
    userId: string,
    status: StreamSessionStatus,
  ): StreamSession {
    const session = this.sessions.get(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
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

  deleteSession(
    id: string,
    userId: string,
  ): boolean {
    const session = this.sessions.get(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    return this.sessions.delete(id);
  }
}