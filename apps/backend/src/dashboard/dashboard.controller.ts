import {
  Controller,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { UserIdentity } from "../auth/auth.types";

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getDashboard(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dashboardService.getDashboard(
      request.user.id,
    );
  }
}