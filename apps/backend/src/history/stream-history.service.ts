import { Injectable } from "@nestjs/common";
import type { StreamEvent } from "@streamdex/types";
import { StreamEventPersistenceService } from "../event/stream-event-persistence.service";

@Injectable()
export class StreamHistoryService {
  constructor(
    private readonly eventPersistenceService: StreamEventPersistenceService,
  ) {}

  async getUserHistory(
    userId: string,
    limit = 100,
  ): Promise<StreamEvent[]> {
    const events =
      await this.eventPersistenceService.findAllByUserId(
        userId,
        limit,
      );

    return events.map((event) => ({
      id: event.id,
      platform: event.platform,
      type: event.type,
      username: event.username,
      ...(event.message !== null && {
        message: event.message,
      }),
      ...(event.amount !== null && {
        amount: event.amount,
      }),
      ...(event.currency !== null && {
        currency: event.currency,
      }),
      timestamp: event.timestamp.getTime(),
      ...(event.sessionId !== null && {
        sessionId: event.sessionId,
      }),
    }));
  }

  async getSessionHistory(
    userId: string,
    sessionId: string,
    limit = 100,
  ): Promise<StreamEvent[]> {
    const events =
      await this.eventPersistenceService.findAllBySessionId(
        sessionId,
        limit,
      );

    return events
      .filter((event) => event.userId === userId)
      .map((event) => ({
        id: event.id,
        platform: event.platform,
        type: event.type,
        username: event.username,
        ...(event.message !== null && {
          message: event.message,
        }),
        ...(event.amount !== null && {
          amount: event.amount,
        }),
        ...(event.currency !== null && {
          currency: event.currency,
        }),
        timestamp: event.timestamp.getTime(),
        ...(event.sessionId !== null && {
          sessionId: event.sessionId,
        }),
      }));
  }
}
