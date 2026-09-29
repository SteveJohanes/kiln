import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import type { StreamEvent } from "@streamdex/types";
import { EventService } from "./event.service";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class EventGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly eventService: EventService) {
    this.eventService.subscribe((event) => {
      this.server.emit("stream:event", event);
    });
  }

  @SubscribeMessage("stream:publish")
  handlePublish(
    @MessageBody() event: StreamEvent,
    @ConnectedSocket() client: Socket,
  ): void {
    this.eventService.publish(event);

    client.emit("stream:published", {
      success: true,
      eventId: event.id,
    });
  }
}