import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { UserIdentity } from "../auth/auth.types";
import { StreamHistoryService } from "./stream-history.service";

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller("history")
@UseGuards(JwtAuthGuard)
export class StreamHistoryController {
  constructor(
    private readonly historyService: StreamHistoryService,
  ) {}

  @Get()
  getUserHistory(
    @Req() request: AuthenticatedRequest,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit
      ? Number.parseInt(limit, 10)
      : 100;

    return this.historyService.getUserHistory(
      request.user.id,
      parsedLimit,
    );
  }

  @Get("session/:sessionId")
  getSessionHistory(
    @Param("sessionId") sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit
      ? Number.parseInt(limit, 10)
      : 100;

    return this.historyService.getSessionHistory(
      request.user.id,
      sessionId,
      parsedLimit,
    );
  }
}
