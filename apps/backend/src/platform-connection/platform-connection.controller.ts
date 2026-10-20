import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { UserIdentity } from "../auth/auth.types";
import { PlatformConnectionService } from "./platform-connection.service";

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller("platform-connections")
@UseGuards(JwtAuthGuard)
export class PlatformConnectionController {
  constructor(
    private readonly platformConnectionService: PlatformConnectionService,
  ) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.platformConnectionService.findAllByUser(
      request.user.id,
    );
  }

  @Get(":id")
  findOne(
    @Param("id") connectionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.platformConnectionService.findOneByUser(
      request.user.id,
      connectionId,
    );
  }
}