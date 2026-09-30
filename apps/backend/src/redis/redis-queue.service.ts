import { Injectable } from "@nestjs/common";
import type { StreamEvent } from "@streamdex/types";
import { RedisService } from "./redis.service";

@Injectable()
export class RedisQueueService {
  private readonly eventQueueKey =
    "kiln:events:queue";

  private readonly processingQueueKey =
    "kiln:events:processing";

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

    const value = await client.rpoplpush(
      this.eventQueueKey,
      this.processingQueueKey,
    );

    if (!value) {
      return null;
    }

    return JSON.parse(value) as StreamEvent;
  }

  async acknowledgeEvent(
    event: StreamEvent,
  ): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.lrem(
      this.processingQueueKey,
      1,
      JSON.stringify(event),
    );
  }

  async requeueProcessingEvents(): Promise<number> {
    const client =
      this.redisService.getClient();

    let movedCount = 0;

    while (true) {
      const value = await client.rpoplpush(
        this.processingQueueKey,
        this.eventQueueKey,
      );

      if (!value) {
        break;
      }

      movedCount += 1;
    }

    return movedCount;
  }

  async getQueueLength(): Promise<number> {
    const client =
      this.redisService.getClient();

    return client.llen(
      this.eventQueueKey,
    );
  }

  async getProcessingQueueLength(): Promise<number> {
    const client =
      this.redisService.getClient();

    return client.llen(
      this.processingQueueKey,
    );
  }

  async clearQueue(): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.del(
      this.eventQueueKey,
    );
  }

  async clearProcessingQueue(): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.del(
      this.processingQueueKey,
    );
  }
}