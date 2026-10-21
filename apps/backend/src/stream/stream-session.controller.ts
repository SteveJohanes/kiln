
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  Platform,
  StreamSessionStatus,
} from "@streamdex/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { UserIdentity } from "../auth/auth.types";
import { StreamSessionService } from "./stream-session.service";
import { YoutubeLiveChatPollingService } from "../platform-connection/youtube-live-chat-polling.service";

type CreateSessionBody = {
  platforms: Platform[];
};

type UpdateSessionStatusBody = {
  status: StreamSessionStatus;
};

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller("sessions")
@UseGuards(JwtAuthGuard)
export class StreamSessionController {
  constructor(
    private readonly streamSessionService: StreamSessionService,
    private readonly youtubeLiveChatPollingService: YoutubeLiveChatPollingService,
  ) {}

  @Post()
  createSession(
    @Body() body: CreateSessionBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.createSession(
      request.user.id,
      body.platforms,
    );
  }

  @Get()
  getAllSessions(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.getAllSessions(
      request.user.id,
    );
  }

  @Get("active")
  getActiveSession(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.getActiveSession(
      request.user.id,
    );
  }

  @Get(":id")
  getSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.getSession(
      id,
      request.user.id,
    );
  }

  @Post(":id/start")
  async startSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const session = await this.streamSessionService.startSession(
      id,
      request.user.id,
    );

    await this.youtubeLiveChatPollingService.startForSession(
      request.user.id,
      session,
    );

    return session;
  }

  @Post(":id/end")
  async endSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const session = await this.streamSessionService.endSession(
      id,
      request.user.id,
    );

    this.youtubeLiveChatPollingService.stopForSession(
      request.user.id,
      session.id,
    );

    return session;
  }

  @Post(":id/status")
  async updateSessionStatus(
    @Param("id") id: string,
    @Body() body: UpdateSessionStatusBody,
    @Req() request: AuthenticatedRequest,
  ) {
    const session =
      await this.streamSessionService.updateSessionStatus(
        id,
        request.user.id,
        body.status,
      );

    if (session.status === "live") {
      await this.youtubeLiveChatPollingService.startForSession(
        request.user.id,
        session,
      );
    } else {
      this.youtubeLiveChatPollingService.stopForSession(
        request.user.id,
        session.id,
      );
    }

    return session;
  }

  @Post(":id/delete")
  async deleteSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const session = await this.streamSessionService.getSession(
      id,
      request.user.id,
    );

    const deleted = await this.streamSessionService.deleteSession(
      id,
      request.user.id,
    );

    this.youtubeLiveChatPollingService.stopForSession(
      request.user.id,
      session.id,
    );

    return { success: deleted };
  }
}
