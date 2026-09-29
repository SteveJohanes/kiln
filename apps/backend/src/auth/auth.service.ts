import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { UserIdentity } from './auth.types';

@Injectable()
export class AuthService {
  private readonly demoUser = {
    id: 'user-001',
    email: 'demo@kiln.app',
    passwordHash: bcrypt.hashSync('kiln123', 10),
    createdAt: Date.now(),
  };

  constructor(private readonly jwtService: JwtService) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserIdentity | null> {
    if (email !== this.demoUser.email) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      this.demoUser.passwordHash,
    );

    if (!passwordMatches) {
      return null;
    }

    return {
      id: this.demoUser.id,
      email: this.demoUser.email,
      createdAt: this.demoUser.createdAt,
    };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
    };
  }
}
