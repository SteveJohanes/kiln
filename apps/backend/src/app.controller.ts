
import { Body, Controller, Post } from "@nestjs/common";
import type { Platform, StreamEvent } from "@streamdex/types";
import { EventService } from "./event/event.service";

@Controller("events")
export class AppController {
  constructor(private readonly eventService: EventService) {}

  @Post("test")
  publishTestEvent(@Body() event: StreamEvent): StreamEvent {
    this.eventService.publish(event);

    return event;
  }

  @Post("youtube-test")
  publishYouTubeTestEvent(@Body() event: StreamEvent): StreamEvent {
    return this.publishPlatformTestEvent("youtube", event);
  }

  @Post("tiktok-test")
  publishTikTokTestEvent(@Body() event: StreamEvent): StreamEvent {
    return this.publishPlatformTestEvent("tiktok", event);
  }

  @Post("twitch-test")
  publishTwitchTestEvent(@Body() event: StreamEvent): StreamEvent {
    return this.publishPlatformTestEvent("twitch", event);
  }

  @Post("kick-test")
  publishKickTestEvent(@Body() event: StreamEvent): StreamEvent {
    return this.publishPlatformTestEvent("kick", event);
  }

  private publishPlatformTestEvent(
    platform: Platform,
    event: StreamEvent,
  ): StreamEvent {
    const adapter = this.eventService.getAdapter(platform);

    if (!adapter) {
      throw new Error(`Adapter untuk platform "${platform}" tidak ditemukan.`);
    }

    if (!("emitTestEvent" in adapter)) {
      throw new Error(
        `Adapter untuk platform "${platform}" tidak mendukung test event.`,
      );
    }

    (
      adapter as typeof adapter & {
        emitTestEvent: (event: StreamEvent) => void;
      }
    ).emitTestEvent(event);

    return event;
  }
}
