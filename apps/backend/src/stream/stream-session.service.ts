import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Platform,
  StreamSession,
  StreamSessionStatus,
} from "@streamdex/types";
import { StreamSessionPersistenceService } from "./stream-session-persistence.service";

@Injectable()
export class StreamSessionService {
  constructor(
    private readonly persistenceService: StreamSessionPersistenceService,
  ) {}

  private toStreamSession(
    session: {
      id: string;
      userId: string;
      status: StreamSessionStatus;
      platforms: Platform[];
      startedAt: Date | null;
      endedAt: Date | null;
    },
  ): StreamSession {
    return {
      id: session.id,
      userId: session.userId,
      status: session.status,
      platforms: session.platforms,
      ...(session.startedAt && {
        startedAt: session.startedAt.getTime(),
      }),
      ...(session.endedAt && {
        endedAt: session.endedAt.getTime(),
      }),
    };
  }

  async createSession(
    userId: string,
    platforms: Platform[],
  ): Promise<StreamSession> {
    const session =
      await this.persistenceService.createSession(
        crypto.randomUUID(),
        userId,
        platforms,
      );

    return this.toStreamSession(session);
  }

  async getSession(
    id: string,
    userId: string,
  ): Promise<StreamSession> {
    const session =
      await this.persistenceService.findById(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    return this.toStreamSession(session);
  }

  async getAllSessions(
    userId: string,
  ): Promise<StreamSession[]> {
    const sessions =
      await this.persistenceService.findAllByUserId(
        userId,
      );

    return sessions.map((session) =>
      this.toStreamSession(session),
    );
  }

  async getActiveSession(
    userId: string,
  ): Promise<StreamSession | undefined> {
    const session =
      await this.persistenceService.findActiveByUserId(
        userId,
      );

    if (!session) {
      return undefined;
    }

    return this.toStreamSession(session);
  }

  async getLatestSession(
    userId: string,
  ): Promise<StreamSession | undefined> {
    const sessions =
      await this.persistenceService.findAllByUserId(
        userId,
      );

    if (sessions.length === 0) {
      return undefined;
    }

    const latest = sessions.reduce(
      (latestSession, currentSession) => {
        const latestTime =
          latestSession.startedAt ??
          latestSession.endedAt ??
          latestSession.createdAt.getTime();

        const currentTime =
          currentSession.startedAt ??
          currentSession.endedAt ??
          currentSession.createdAt.getTime();

        return currentTime >= latestTime
          ? currentSession
          : latestSession;
      },
    );

    return this.toStreamSession(latest);
  }

  async startSession(
    id: string,
    userId: string,
  ): Promise<StreamSession> {
    const session =
      await this.persistenceService.findById(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    const updatedSession =
      await this.persistenceService.updateStatus(
        id,
        "live",
        new Date(),
        undefined,
      );

    return this.toStreamSession(updatedSession);
  }

  async endSession(
    id: string,
    userId: string,
  ): Promise<StreamSession> {
    const session =
      await this.persistenceService.findById(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    const updatedSession =
      await this.persistenceService.updateStatus(
        id,
        "ended",
        undefined,
        new Date(),
      );

    return this.toStreamSession(updatedSession);
  }

  async updateSessionStatus(
    id: string,
    userId: string,
    status: StreamSessionStatus,
  ): Promise<StreamSession> {
    const session =
      await this.persistenceService.findById(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    const startedAt =
      status === "live" && !session.startedAt
        ? new Date()
        : undefined;

    const endedAt =
      status === "ended" && !session.endedAt
        ? new Date()
        : undefined;

    const updatedSession =
      await this.persistenceService.updateStatus(
        id,
        status,
        startedAt,
        endedAt,
      );

    return this.toStreamSession(updatedSession);
  }

  async deleteSession(
    id: string,
    userId: string,
  ): Promise<boolean> {
    const session =
      await this.persistenceService.findById(id);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        "Session tidak ditemukan.",
      );
    }

    await this.persistenceService.deleteSession(id);

    return true;
  }
}
