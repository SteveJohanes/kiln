import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import type { StreamEvent } from "@streamdex/types";
import { RedisService } from "./redis.service";

export type RealtimeEventEnvelope = {
  userId: string;
  event: StreamEvent;
};

@Injectable()
export class RedisPubSubService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly channel = "kiln:events:realtime";

  private readonly subscriber: Redis;

  private readonly handlers = new Set<
    (envelope: RealtimeEventEnvelope) => void
  >();

  constructor(
    private readonly redisService: RedisService,
  ) {
    this.subscriber = this.redisService
      .getClient()
      .duplicate();
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on(
      "message",
      (channel, message) => {
        if (channel !== this.channel) {
          return;
        }

        let envelope: RealtimeEventEnvelope;

        try {
          const parsed: unknown = JSON.parse(message);

          if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("userId" in parsed) ||
            typeof parsed.userId !== "string" ||
            !parsed.userId ||
            !("event" in parsed) ||
            typeof parsed.event !== "object" ||
            parsed.event === null
          ) {
            console.error(
              "[RedisPubSub] Envelope event tidak valid.",
            );
            return;
          }

          envelope = parsed as RealtimeEventEnvelope;
        } catch (error) {
          console.error(
            "[RedisPubSub] Gagal membaca event:",
            error,
          );
          return;
        }

        for (const handler of this.handlers) {
          try {
            handler(envelope);
          } catch (error) {
            console.error(
              "[RedisPubSub] Handler gagal memproses event:",
              error,
            );
          }
        }
      },
    );

    await this.subscriber.subscribe(this.channel);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit();
  }

  async publish(
    event: StreamEvent,
    userId: string,
  ): Promise<void> {
    if (!userId.trim()) {
      throw new Error(
        "userId wajib diisi untuk publish event realtime.",
      );
    }

    const envelope: RealtimeEventEnvelope = {
      userId,
      event,
    };

    await this.redisService
      .getClient()
      .publish(this.channel, JSON.stringify(envelope));
  }

  subscribe(
    handler: (envelope: RealtimeEventEnvelope) => void,
  ): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }
}