import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import { RedisService } from '../redis/redis.service';
import { PlatformConnectionService } from './platform-connection.service';

const STATE_TTL_SECONDS = 600;

@Injectable()
export class YoutubeOAuthService {
  constructor(
    private readonly redisService: RedisService,
    private readonly platformConnectionService: PlatformConnectionService,
  ) {}

  private getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'Konfigurasi Google OAuth belum lengkap.',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  async createAuthorizationUrl(userId: string): Promise<string> {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const state = randomBytes(32).toString('hex');
    const redisKey = `oauth:youtube:state:${state}`;

    await this.redisService
      .getClient()
      .set(redisKey, userId, 'EX', STATE_TTL_SECONDS, 'NX');

    return this.getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: ['https://www.googleapis.com/auth/youtube.readonly'],
      state,
    });
  }

  async consumeState(state: string): Promise<string> {
    if (!state || !/^[a-f0-9]{64}$/.test(state)) {
      throw new BadRequestException('OAuth state tidak valid.');
    }

    const redisKey = `oauth:youtube:state:${state}`;
    const redis = this.redisService.getClient();
    const userId = await redis.call('GETDEL', redisKey);

    if (typeof userId !== 'string' || !userId) {
      throw new BadRequestException(
        'OAuth state kedaluwarsa atau sudah digunakan.',
      );
    }

    return userId;
  }

  async exchangeAuthorizationCode(code: string) {
    if (!code) {
      throw new BadRequestException(
        'Authorization code dari Google tidak tersedia.',
      );
    }

    const oauthClient = this.getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.access_token) {
      throw new BadRequestException('Google tidak mengembalikan access token.');
    }

    const oauthScopes = tokens.scope ? tokens.scope.split(' ') : [];

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: oauthScopes,
    };
  }

  async getGoogleProfile(accessToken: string) {
    const oauthClient = this.getOAuthClient();

    oauthClient.setCredentials({
      access_token: accessToken,
    });

    const youtube = google.youtube({
      version: 'v3',
      auth: oauthClient,
    });

    const response = await youtube.channels.list({
      part: ['id', 'snippet'],
      mine: true,
    });

    const channel = response.data.items?.[0];

    if (!channel?.id) {
      throw new BadRequestException(
        'Tidak ditemukan channel YouTube pada akun ini.',
      );
    }

    return {
      platformUserId: channel.id,
      platformUsername: channel.snippet?.title ?? null,
    };
  }

  async getConnectionProfile(userId: string, connectionId: string) {
    const credentials =
      await this.platformConnectionService.getYoutubeAccessCredentials(
        userId,
        connectionId,
      );

    return this.getGoogleProfile(credentials.accessToken);
  }

  async refreshConnectionAccessToken(userId: string, connectionId: string) {
    const storedCredentials =
      await this.platformConnectionService.getYoutubeRefreshCredentials(
        userId,
        connectionId,
      );

    const oauthClient = this.getOAuthClient();

    oauthClient.setCredentials({
      refresh_token: storedCredentials.refreshToken,
    });

    let credentials;

    try {
      const result = await oauthClient.refreshAccessToken();
      credentials = result.credentials;
    } catch {
      throw new BadGatewayException(
        'Google gagal memperbarui access token YouTube. Otorisasi mungkin perlu diulang.',
      );
    }

    if (!credentials.access_token) {
      throw new BadGatewayException(
        'Google tidak mengembalikan access token baru.',
      );
    }

    const expiryDate = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null;

    await this.platformConnectionService.saveYoutubeRefreshedAccessToken(
      userId,
      connectionId,
      credentials.access_token,
      expiryDate,
    );

    return {
      message: 'Access token YouTube berhasil diperbarui.',
      connectionId,
      tokenExpiresAt: expiryDate,
    };
  }
}
