import { Injectable } from "@nestjs/common";
import type { StreamEvent } from "@streamdex/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StreamEventPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createEvent(
    event: StreamEvent,
    userId: string,
    sessionId?: string,
  ) {
    return this.prisma.streamEvent.create({
      data: {
        id: event.id,
        userId,
        sessionId,
        platform: event.platform,
        type: event.type,
        username: event.username,
        message: event.message,
        amount: event.amount,
        currency: event.currency,
        timestamp: new Date(event.timestamp),
      },
    });
  }

  async findById(id: string) {
    return this.prisma.streamEvent.findUnique({
      where: {
        id,
      },
    });
  }

  async countByUserId(userId: string) {
    return this.prisma.streamEvent.count({
      where: {
        userId,
      },
    });
  }

  async findAllByUserId(
    userId: string,
    limit = 100,
  ) {
    return this.prisma.streamEvent.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: this.normalizeLimit(limit),
    });
  }

  async findAllBySessionId(
    sessionId: string,
    userId: string,
    limit = 100,
  ) {
    return this.prisma.streamEvent.findMany({
      where: {
        sessionId,
        userId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: this.normalizeLimit(limit),
    });
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit)) {
      return 100;
    }

    return Math.min(500, Math.max(1, Math.trunc(limit)));
  }
}