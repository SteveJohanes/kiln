import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import {
  ExtractJwt,
  Strategy,
} from "passport-jwt";
import type { UserIdentity } from "./auth.types";

type JwtPayload = {
  sub: string;
  email: string;
  createdAt: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ??
        "kiln-development-secret",
    });
  }

  validate(payload: JwtPayload): UserIdentity {
    return {
      id: payload.sub,
      email: payload.email,
      createdAt: payload.createdAt,
    };
  }
}