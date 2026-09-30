import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import type { StreamEvent } from "@streamdex/types";
import { RedisService } from "./redis.service";

@Injectable()
export class RedisPubSubService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly channel =
    "kiln:events:realtime";

  private readonly subscriber: Redis;

  private readonly handlers = new Set<
    (event: StreamEvent) => void
  >();

  constructor(
    private readonly redisService: RedisService,
  ) {
    this.subscriber =
      this.redisService
        .getClient()
        .duplicate();
  }

  async onModuleInit(): Promise<void> {
    await this.subscriber.subscribe(
      this.channel,
    );

    this.subscriber.on(
      "message",
      (channel, message) => {
        if (channel !== this.channel) {
          return;
        }

        let event: StreamEvent;

        try {
          event =
            JSON.parse(message) as StreamEvent;
        } catch (error) {
          console.error(
            "[RedisPubSub] Gagal membaca event:",
            error,
          );

          return;
        }

        console.log(
          "[RedisPubSub] Event diterima:",
          event,
        );

        for (const handler of this.handlers) {
          try {
            handler(event);
          } catch (error) {
            console.error(
              "[RedisPubSub] Handler gagal memproses event:",
              error,
            );
          }
        }
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit();
  }

  async publish(
    event: StreamEvent,
  ): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.publish(
      this.channel,
      JSON.stringify(event),
    );
  }

  subscribe(
    handler: (event: StreamEvent) => void,
  ): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }
}