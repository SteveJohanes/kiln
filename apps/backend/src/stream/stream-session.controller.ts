
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import type { Platform } from "@streamdex/types";
import { StreamSessionService } from "./stream-session.service";

type CreateSessionBody = {
  platforms: Platform[];
};

@Controller("sessions")
export class StreamSessionController {
  constructor(
    private readonly streamSessionService: StreamSessionService,
  ) {}

  @Post()
  createSession(@Body() body: CreateSessionBody) {
    return this.streamSessionService.createSession(body.platforms);
  }

  @Get()
  getAllSessions() {
    return this.streamSessionService.getAllSessions();
  }

  @Get("active")
  getActiveSession() {
    return this.streamSessionService.getActiveSession();
  }

  @Get(":id")
  getSession(@Param("id") id: string) {
    return this.streamSessionService.getSession(id);
  }

  @Post(":id/start")
  startSession(@Param("id") id: string) {
    return this.streamSessionService.startSession(id);
  }

  @Post(":id/end")
  endSession(@Param("id") id: string) {
    return this.streamSessionService.endSession(id);
  }

  @Post(":id/status")
  updateSessionStatus(
    @Param("id") id: string,
    @Body() body: { status: "idle" | "live" | "ended" },
  ) {
    return this.streamSessionService.updateSessionStatus(
      id,
      body.status,
    );
  }

  @Post(":id/delete")
  deleteSession(@Param("id") id: string) {
    return {
      success: this.streamSessionService.deleteSession(id),
    };
  }
}