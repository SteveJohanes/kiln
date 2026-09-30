import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { UserIdentity } from "./auth.types";
import { UserPersistenceService } from "../user/user-persistence.service";

@Injectable()
export class AuthService {
  private readonly demoPasswordHash = bcrypt.hashSync(
    "kiln123",
    10,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly userPersistenceService: UserPersistenceService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserIdentity | null> {
    const user =
      await this.userPersistenceService.findByEmail(
        email,
      );

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      this.demoPasswordHash,
    );

    if (!passwordMatches) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.getTime(),
    };
  }

  async login(
    email: string,
    password: string,
  ) {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    let user =
      await this.userPersistenceService.findByEmail(
        normalizedEmail,
      );

    if (!user && normalizedEmail === "demo@kiln.app") {
      user =
        await this.userPersistenceService.createUser(
          "user-001",
          normalizedEmail,
        );
    }

    if (!user) {
      throw new UnauthorizedException(
        "Email atau password salah.",
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      this.demoPasswordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        "Email atau password salah.",
      );
    }

    const userIdentity: UserIdentity = {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.getTime(),
    };

    const payload = {
      sub: userIdentity.id,
      email: userIdentity.email,
      createdAt: userIdentity.createdAt,
    };

    const accessToken =
      await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: userIdentity,
    };
  }
}
