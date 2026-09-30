import { Injectable } from "@nestjs/common";
import { StreamEventPersistenceService } from "../event/stream-event-persistence.service";
import { StreamSessionService } from "../stream/stream-session.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly eventPersistenceService: StreamEventPersistenceService,
    private readonly streamSessionService: StreamSessionService,
  ) {}

  async getDashboard(userId: string) {
    const [latestSession, totalEvents, recentEvents] =
      await Promise.all([
        this.streamSessionService.getLatestSession(
          userId,
        ),
        this.eventPersistenceService.countByUserId(
          userId,
        ),
        this.eventPersistenceService.findAllByUserId(
          userId,
          20,
        ),
      ]);

    return {
      session: latestSession ?? null,
      events: {
        total: totalEvents,
        recent: recentEvents.map((event) => ({
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
        })),
      },
    };
  }
}
