import { Injectable } from "@nestjs/common";
import type {
  Platform,
  StreamSessionStatus,
} from "@streamdex/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StreamSessionPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findById(id: string) {
    return this.prisma.streamSession.findUnique({
      where: {
        id,
      },
    });
  }

  async findAllByUserId(userId: string) {
    return this.prisma.streamSession.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findActiveByUserId(userId: string) {
    return this.prisma.streamSession.findFirst({
      where: {
        userId,
        status: "live",
      },
      orderBy: {
        startedAt: "desc",
      },
    });
  }

  async createSession(
    id: string,
    userId: string,
    platforms: Platform[],
  ) {
    return this.prisma.streamSession.create({
      data: {
        id,
        userId,
        status: "idle",
        platforms,
      },
    });
  }

  async updateStatus(
    id: string,
    status: StreamSessionStatus,
    startedAt?: Date,
    endedAt?: Date,
  ) {
    return this.prisma.streamSession.update({
      where: {
        id,
      },
      data: {
        status,
        ...(startedAt !== undefined && {
          startedAt,
        }),
        ...(endedAt !== undefined && {
          endedAt,
        }),
      },
    });
  }

  async deleteSession(id: string) {
    return this.prisma.streamSession.delete({
      where: {
        id,
      },
    });
  }
}
