import { Injectable } from "@nestjs/common";
import type { StreamEvent } from "@streamdex/types";
import { RedisService } from "./redis.service";

@Injectable()
export class RedisQueueService {
  private readonly eventQueueKey =
    "kiln:events:queue";

  constructor(
    private readonly redisService: RedisService,
  ) {}

  async enqueueEvent(
    event: StreamEvent,
  ): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.rpush(
      this.eventQueueKey,
      JSON.stringify(event),
    );
  }

  async dequeueEvent(): Promise<StreamEvent | null> {
    const client =
      this.redisService.getClient();

    const value = await client.lpop(
      this.eventQueueKey,
    );

    if (!value) {
      return null;
    }

    return JSON.parse(value) as StreamEvent;
  }

  async getQueueLength(): Promise<number> {
    const client =
      this.redisService.getClient();

    return client.llen(
      this.eventQueueKey,
    );
  }

  async clearQueue(): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.del(
      this.eventQueueKey,
    );
  }
}