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
import type { Platform } from "@streamdex/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { UserIdentity } from "../auth/auth.types";
import { StreamSessionService } from "./stream-session.service";

type CreateSessionBody = {
  platforms: Platform[];
};

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller("sessions")
@UseGuards(JwtAuthGuard)
export class StreamSessionController {
  constructor(
    private readonly streamSessionService: StreamSessionService,
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
  startSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.startSession(
      id,
      request.user.id,
    );
  }

  @Post(":id/end")
  endSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.endSession(
      id,
      request.user.id,
    );
  }

  @Post(":id/status")
  updateSessionStatus(
    @Param("id") id: string,
    @Body() body: { status: "idle" | "live" | "ended" },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.streamSessionService.updateSessionStatus(
      id,
      request.user.id,
      body.status,
    );
  }

  @Post(":id/delete")
  deleteSession(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      success: this.streamSessionService.deleteSession(
        id,
        request.user.id,
      ),
    };
  }
}