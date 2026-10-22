import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OverlayService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createToken(userId: string, sessionId: string) {
    const session = await this.prisma.streamSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, userId: true },
    });

    if (!session) {
      throw new NotFoundException('Stream session tidak ditemukan.');
    }

    const token = randomBytes(32).toString('hex');

    const record = await this.prisma.streamOverlayToken.create({
      data: {
        userId,
        sessionId: session.id,
        tokenHash: this.hashToken(token),
      },
      select: {
        id: true,
        sessionId: true,
        createdAt: true,
      },
    });

    return {
      ...record,
      token,
      url: `/overlay/${token}`,
      warning:
        'Simpan token ini dengan aman. Token mentah hanya ditampilkan saat dibuat.',
    };
  }

  async listTokens(userId: string) {
    return this.prisma.streamOverlayToken.findMany({
      where: { userId },
      select: {
        id: true,
        sessionId: true,
        createdAt: true,
        revokedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeToken(userId: string, id: string) {
    const token = await this.prisma.streamOverlayToken.findFirst({
      where: { id, userId },
      select: { id: true, revokedAt: true },
    });

    if (!token) {
      throw new NotFoundException('Token overlay tidak ditemukan.');
    }

    if (token.revokedAt) {
      return { success: true, alreadyRevoked: true };
    }

    await this.prisma.streamOverlayToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async validateToken(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new UnauthorizedException('Token overlay tidak valid.');
    }

    const record = await this.prisma.streamOverlayToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        session: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
      },
    });

    if (
      !record ||
      record.revokedAt ||
      (record.expiresAt && record.expiresAt <= new Date())
    ) {
      throw new UnauthorizedException(
        'Token overlay tidak valid, dicabut, atau kedaluwarsa.',
      );
    }

    if (record.userId !== record.session.userId) {
      throw new ForbiddenException(
        'Token tidak cocok dengan pemilik stream session.',
      );
    }

    if (record.session.status === 'ended') {
      throw new UnauthorizedException('Stream session sudah berakhir.');
    }

    return {
      tokenId: record.id,
      userId: record.userId,
      sessionId: record.sessionId,
    };
  }
}
