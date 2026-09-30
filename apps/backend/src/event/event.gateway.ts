import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import type { StreamEvent } from "@streamdex/types";
import { EventService } from "./event.service";
import { RedisPubSubService } from "../redis/redis-pubsub.service";

type JwtPayload = {
  sub: string;
  email: string;
  createdAt: number;
};

type AuthenticatedSocket = Socket & {
  userId?: string;
};

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class EventGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly eventService: EventService,
    private readonly jwtService: JwtService,
    private readonly redisPubSubService: RedisPubSubService,
  ) {
    this.redisPubSubService.subscribe((event) => {
      this.server.emit("stream:event", event);
    });
  }

  afterInit(server: Server): void {
    server.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;

        if (typeof token !== "string" || !token) {
          return next(
            new UnauthorizedException(
              "Token autentikasi diperlukan.",
            ),
          );
        }

        const payload =
          this.jwtService.verify<JwtPayload>(token);

        const authenticatedSocket =
          socket as AuthenticatedSocket;

        authenticatedSocket.userId = payload.sub;

        next();
      } catch {
        next(
          new UnauthorizedException(
            "Token tidak valid atau sudah kedaluwarsa.",
          ),
        );
      }
    });
  }

  @SubscribeMessage("stream:publish")
  handlePublish(
    @MessageBody() event: StreamEvent,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    if (!client.userId) {
      client.emit("stream:error", {
        message: "User belum terautentikasi.",
      });

      return;
    }

    this.eventService.publish(
      event,
      client.userId,
    );

    client.emit("stream:published", {
      success: true,
      eventId: event.id,
    });
  }
}