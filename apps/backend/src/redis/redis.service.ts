import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly client: Redis;

  constructor() {
    const redisUrl =
      process.env.REDIS_URL ?? "redis://localhost:6379";

    this.client = new Redis(redisUrl);
  }

  async onModuleInit(): Promise<void> {
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }
}