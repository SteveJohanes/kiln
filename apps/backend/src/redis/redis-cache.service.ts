import { Injectable } from "@nestjs/common";
import type { StreamEvent } from "@streamdex/types";
import { RedisService } from "./redis.service";

@Injectable()
export class RedisCacheService {
  private readonly recentEventsKey =
    "kiln:events:recent";

  private readonly maxRecentEvents = 100;

  constructor(
    private readonly redisService: RedisService,
  ) {}

  async addRecentEvent(
    event: StreamEvent,
  ): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.lpush(
      this.recentEventsKey,
      JSON.stringify(event),
    );

    await client.ltrim(
      this.recentEventsKey,
      0,
      this.maxRecentEvents - 1,
    );
  }

  async getRecentEvents(
    limit = 20,
  ): Promise<StreamEvent[]> {
    const client =
      this.redisService.getClient();

    const values = await client.lrange(
      this.recentEventsKey,
      0,
      Math.max(limit, 1) - 1,
    );

    return values.map(
      (value) =>
        JSON.parse(value) as StreamEvent,
    );
  }

  async clearRecentEvents(): Promise<void> {
    const client =
      this.redisService.getClient();

    await client.del(this.recentEventsKey);
  }
}