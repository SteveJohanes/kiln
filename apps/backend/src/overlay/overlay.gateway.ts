
import { OnModuleDestroy } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import { OverlayService } from "./overlay.service";
import { RedisPubSubService } from "../redis/redis-pubsub.service";

type OverlaySocket = Socket & {
  overlayTokenId?: string;
  overlayUserId?: string;
  overlaySessionId?: string;
};

@WebSocketGateway({
  namespace: "/overlay",
  cors: {
    origin: "*",
  },
})
export class OverlayGateway implements OnModuleDestroy {
  @WebSocketServer()
  server!: Namespace;

  private unsubscribe?: () => void;

  constructor(
    private readonly overlayService: OverlayService,
    private readonly redisPubSubService: RedisPubSubService,
  ) {
    this.unsubscribe = this.redisPubSubService.subscribe(
      ({ userId, event }) => {
        if (
          typeof userId !== "string" ||
          !userId.trim() ||
          !event.sessionId
        ) {
          return;
        }

        this.server
          ?.to(this.getSessionRoom(userId, event.sessionId))
          .emit("overlay:event", event);
      },
    );
  }

  afterInit(server: Namespace): void {
    server.use((socket, next) => {
      const client = socket as OverlaySocket;
      const token = socket.handshake.auth?.token;

      if (typeof token !== "string" || !token) {
        next(new Error("Token overlay diperlukan."));
        return;
      }

      void this.overlayService
        .validateToken(token)
        .then(({ tokenId, userId, sessionId }) => {
          client.overlayTokenId = tokenId;
          client.overlayUserId = userId;
          client.overlaySessionId = sessionId;
          next();
        })
        .catch(() => {
          next(new Error("Token overlay tidak valid."));
        });
    });

    server.on("connection", (socket: Socket) => {
      const client = socket as OverlaySocket;

      if (
        !client.overlayTokenId ||
        !client.overlayUserId ||
        !client.overlaySessionId
      ) {
        client.disconnect(true);
        return;
      }

      void client.join(
        this.getSessionRoom(
          client.overlayUserId,
          client.overlaySessionId,
        ),
      );
    });
  }

  disconnectTokenId(tokenId: string): void {
    for (const socket of this.server?.sockets.values() ?? []) {
      const client = socket as OverlaySocket;

      if (client.overlayTokenId === tokenId) {
        client.disconnect(true);
      }
    }
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private getSessionRoom(
    userId: string,
    sessionId: string,
  ): string {
    return `overlay:user:${userId}:session:${sessionId}`;
  }
}
