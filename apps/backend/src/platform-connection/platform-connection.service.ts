import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';

type YoutubeProfile = {
  platformUserId: string;
  platformUsername: string | null;
};

type YoutubeTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: Date | null;
  scopes: string[];
};

export type YoutubeStoredCredentials = {
  connectionId: string;
  refreshToken: string;
};

export type YoutubeStoredAccessCredentials = {
  connectionId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
};

@Injectable()
export class PlatformConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenEncryptionService: TokenEncryptionService,
  ) {}

  async findAllByUser(userId: string) {
    return this.prisma.platformConnection.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        tokenExpiresAt: true,
        scopes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(userId: string, connectionId: string) {
    const connection = await this.prisma.platformConnection.findFirst({
      where: {
        id: connectionId,
        userId,
      },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        tokenExpiresAt: true,
        scopes: true,
        status: true,
      },
    });

    if (!connection) {
      throw new NotFoundException('Koneksi platform tidak ditemukan.');
    }

    return connection;
  }

  async getYoutubeRefreshCredentials(
    userId: string,
    connectionId: string,
  ): Promise<YoutubeStoredCredentials> {
    const connection = await this.prisma.platformConnection.findFirst({
      where: {
        id: connectionId,
        userId,
        platform: 'youtube',
      },
      select: {
        id: true,
        refreshTokenEncrypted: true,
        status: true,
      },
    });

    if (!connection) {
      throw new NotFoundException('Koneksi YouTube tidak ditemukan.');
    }

    if (connection.status !== 'connected') {
      throw new UnauthorizedException('Koneksi YouTube tidak berstatus aktif.');
    }

    if (!connection.refreshTokenEncrypted) {
      throw new UnauthorizedException(
        'Refresh token YouTube tidak tersedia. Hubungkan ulang akun YouTube.',
      );
    }

    return {
      connectionId: connection.id,
      refreshToken: this.tokenEncryptionService.decrypt(
        connection.refreshTokenEncrypted,
      ),
    };
  }

  async getYoutubeAccessCredentials(
    userId: string,
    connectionId: string,
  ): Promise<YoutubeStoredAccessCredentials> {
    const connection = await this.prisma.platformConnection.findFirst({
      where: {
        id: connectionId,
        userId,
        platform: 'youtube',
      },
      select: {
        id: true,
        accessTokenEncrypted: true,
        tokenExpiresAt: true,
        status: true,
      },
    });

    if (!connection) {
      throw new NotFoundException('Koneksi YouTube tidak ditemukan.');
    }

    if (connection.status !== 'connected') {
      throw new UnauthorizedException('Koneksi YouTube tidak berstatus aktif.');
    }

    if (!connection.accessTokenEncrypted) {
      throw new UnauthorizedException('Access token YouTube tidak tersedia.');
    }

    return {
      connectionId: connection.id,
      accessToken: this.tokenEncryptionService.decrypt(
        connection.accessTokenEncrypted,
      ),
      tokenExpiresAt: connection.tokenExpiresAt,
    };
  }

  async saveYoutubeRefreshedAccessToken(
    userId: string,
    connectionId: string,
    accessToken: string,
    expiryDate: Date | null,
  ) {
    if (!accessToken) {
      throw new UnauthorizedException(
        'Google tidak memberikan access token baru.',
      );
    }

    const accessTokenEncrypted =
      this.tokenEncryptionService.encrypt(accessToken);

    const result = await this.prisma.platformConnection.updateMany({
      where: {
        id: connectionId,
        userId,
        platform: 'youtube',
        status: 'connected',
      },
      data: {
        accessTokenEncrypted,
        tokenExpiresAt: expiryDate,
      },
    });

    if (result.count !== 1) {
      throw new NotFoundException(
        'Koneksi YouTube tidak ditemukan atau sudah tidak aktif.',
      );
    }

    return { refreshed: true };
  }

  async saveYoutubeConnection(
    userId: string,
    profile: YoutubeProfile,
    tokens: YoutubeTokens,
  ) {
    const existing = await this.prisma.platformConnection.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'youtube',
          platformUserId: profile.platformUserId,
        },
      },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        'Channel YouTube ini sudah terhubung ke pengguna StreamDex lain.',
      );
    }

    const accessTokenEncrypted = this.tokenEncryptionService.encrypt(
      tokens.accessToken,
    );

    const refreshTokenEncrypted = tokens.refreshToken
      ? this.tokenEncryptionService.encrypt(tokens.refreshToken)
      : undefined;

    const connectionData = {
      platformUsername: profile.platformUsername,
      accessTokenEncrypted,
      tokenExpiresAt: tokens.expiryDate,
      scopes: tokens.scopes,
      status: 'connected' as const,
      ...(refreshTokenEncrypted ? { refreshTokenEncrypted } : {}),
    };

    try {
      if (existing) {
        return await this.prisma.platformConnection.update({
          where: { id: existing.id },
          data: connectionData,
          select: {
            id: true,
            platform: true,
            platformUserId: true,
            platformUsername: true,
            tokenExpiresAt: true,
            scopes: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return await this.prisma.platformConnection.create({
        data: {
          userId,
          platform: 'youtube',
          platformUserId: profile.platformUserId,
          ...connectionData,
          refreshTokenEncrypted: refreshTokenEncrypted ?? null,
        },
        select: {
          id: true,
          platform: true,
          platformUserId: true,
          platformUsername: true,
          tokenExpiresAt: true,
          scopes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Channel YouTube sudah terhubung ke akun StreamDex lain atau sedang diproses.',
        );
      }

      throw error;
    }
  }
}
