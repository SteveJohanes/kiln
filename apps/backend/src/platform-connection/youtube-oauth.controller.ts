
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { UserIdentity } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformConnectionService } from './platform-connection.service';
import { YoutubeOAuthService } from './youtube-oauth.service';
import { YoutubeLiveChatService } from './youtube-live-chat.service';

type AuthenticatedRequest = Request & {
  user: UserIdentity;
};

@Controller('platform-connections/youtube')
export class YoutubeOAuthController {
  constructor(
    private readonly youtubeOAuthService: YoutubeOAuthService,
    private readonly platformConnectionService: PlatformConnectionService,
    private readonly youtubeLiveChatService: YoutubeLiveChatService,
  ) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  async connect(@Req() request: AuthenticatedRequest) {
    const authorizationUrl =
      await this.youtubeOAuthService.createAuthorizationUrl(request.user.id);

    return { authorizationUrl };
  }

  @Post(':connectionId/refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(
    @Param('connectionId') connectionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!connectionId?.trim()) {
      throw new BadRequestException('ID koneksi YouTube wajib diisi.');
    }

    return this.youtubeOAuthService.refreshConnectionAccessToken(
      request.user.id,
      connectionId,
    );
  }

  @Get(':connectionId/live-chat')
  @UseGuards(JwtAuthGuard)
  async pollLiveChat(
    @Param('connectionId') connectionId: string,
    @Query('pageToken') pageToken: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!connectionId?.trim()) {
      throw new BadRequestException('ID koneksi YouTube wajib diisi.');
    }

    return this.youtubeLiveChatService.pollMessages(
      request.user.id,
      connectionId,
      pageToken,
    );
  }

  @Get(':connectionId/profile')
  @UseGuards(JwtAuthGuard)
  async getConnectionProfile(
    @Param('connectionId') connectionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.youtubeOAuthService.getConnectionProfile(
      request.user.id,
      connectionId,
    );
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() response: Response,
  ) {
    if (oauthError) {
      return response.status(400).json({
        message: 'Otorisasi YouTube dibatalkan atau ditolak.',
      });
    }

    if (!code || !state) {
      return response.status(400).json({
        message: 'Callback OAuth tidak memiliki code atau state.',
      });
    }

    try {
      const userId = await this.youtubeOAuthService.consumeState(state);

      const tokens =
        await this.youtubeOAuthService.exchangeAuthorizationCode(code);

      const profile = await this.youtubeOAuthService.getGoogleProfile(
        tokens.accessToken,
      );

      const connection =
        await this.platformConnectionService.saveYoutubeConnection(
          userId,
          profile,
          tokens,
        );

      return response.status(200).json({
        message: 'Akun YouTube berhasil dihubungkan.',
        connection,
      });
    } catch {
      return response.status(400).json({
        message:
          'Koneksi YouTube gagal. Periksa otorisasi dan konfigurasi OAuth, lalu coba lagi.',
      });
    }
  }
}
