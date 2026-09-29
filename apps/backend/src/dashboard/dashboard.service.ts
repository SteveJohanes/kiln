import { Injectable } from "@nestjs/common";
import { EventService } from "../event/event.service";
import { StreamSessionService } from "../stream/stream-session.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly eventService: EventService,
    private readonly streamSessionService: StreamSessionService,
  ) {}

  getDashboard() {
    const latestSession =
      this.streamSessionService.getLatestSession();

    return {
      session: latestSession ?? null,
      events: {
        total: this.eventService.getEventCount(),
        recent: this.eventService.getRecentEvents(),
      },
    };
  }
}
