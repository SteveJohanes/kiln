import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { UserIdentity } from "./auth.types";

type LoginBody = {
  email: string;
  password: string;
};

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post("login")
  async login(@Body() body: LoginBody) {
    return this.authService.login(
      body.email,
      body.password,
    );
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getCurrentUser(
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      user: request.user,
    };
  }
}