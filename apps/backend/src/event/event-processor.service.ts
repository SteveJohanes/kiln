import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { StreamEvent } from "@streamdex/types";
import { RedisQueueService } from "../redis/redis-queue.service";

@Injectable()
export class EventProcessorService
  implements OnModuleInit, OnModuleDestroy
{
  private isRunning = false;
  private processingPromise: Promise<void> | null =
    null;

  constructor(
    private readonly redisQueueService: RedisQueueService,
  ) {}

  onModuleInit(): void {
    this.isRunning = true;

    this.processingPromise =
      this.processQueue();
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;

    if (this.processingPromise) {
      await this.processingPromise;
    }
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        const event =
          await this.redisQueueService.dequeueEvent();

        if (!event) {
          await this.sleep(100);
          continue;
        }

        await this.processEvent(event);
      } catch (error) {
        console.error(
          "[EventProcessor] Gagal memproses event:",
          error,
        );

        await this.sleep(500);
      }
    }
  }

  private async processEvent(
    event: StreamEvent,
  ): Promise<void> {
    console.log(
      "[EventProcessor] Memproses event:",
      event,
    );
  }

  private sleep(
    milliseconds: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}