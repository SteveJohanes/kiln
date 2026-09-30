import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Platform, StreamEvent } from "@streamdex/types";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import type { UserIdentity } from "./auth/auth.types";
import { EventService } from "./event/event.service";

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

type TestEventBody = StreamEvent & {
  sessionId: string;
};

@Controller("events")
@UseGuards(JwtAuthGuard)
export class AppController {
  constructor(
    private readonly eventService: EventService,
  ) {}

  @Post("test")
  publishTestEvent(
    @Body() event: TestEventBody,
    @Req() request: AuthenticatedRequest,
  ): StreamEvent {
    this.eventService.publish(
      event,
      request.user.id,
    );

    return event;
  }

  @Post("youtube-test")
  publishYouTubeTestEvent(
    @Body() event: TestEventBody,
    @Req() request: AuthenticatedRequest,
  ): StreamEvent {
    return this.publishPlatformTestEvent(
      "youtube",
      event,
      request.user.id,
    );
  }

  @Post("tiktok-test")
  publishTikTokTestEvent(
    @Body() event: TestEventBody,
    @Req() request: AuthenticatedRequest,
  ): StreamEvent {
    return this.publishPlatformTestEvent(
      "tiktok",
      event,
      request.user.id,
    );
  }

  @Post("twitch-test")
  publishTwitchTestEvent(
    @Body() event: TestEventBody,
    @Req() request: AuthenticatedRequest,
  ): StreamEvent {
    return this.publishPlatformTestEvent(
      "twitch",
      event,
      request.user.id,
    );
  }

  @Post("kick-test")
  publishKickTestEvent(
    @Body() event: TestEventBody,
    @Req() request: AuthenticatedRequest,
  ): StreamEvent {
    return this.publishPlatformTestEvent(
      "kick",
      event,
      request.user.id,
    );
  }

  private publishPlatformTestEvent(
    platform: Platform,
    event: TestEventBody,
    userId: string,
  ): StreamEvent {
    const adapter =
      this.eventService.getAdapter(platform);

    if (!adapter) {
      throw new Error(
        `Adapter untuk platform "${platform}" tidak ditemukan.`,
      );
    }

    if (!("emitTestEvent" in adapter)) {
      throw new Error(
        `Adapter untuk platform "${platform}" tidak mendukung test event.`,
      );
    }

    (
      adapter as typeof adapter & {
        emitTestEvent: (
          event: StreamEvent,
        ) => void;
      }
    ).emitTestEvent(event);

    this.eventService.publish(
      event,
      userId,
    );

    return event;
  }
}