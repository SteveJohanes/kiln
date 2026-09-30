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

  async onModuleInit(): Promise<void> {
    const recoveredCount =
      await this.redisQueueService.requeueProcessingEvents();

    if (recoveredCount > 0) {
      console.log(
        `[EventProcessor] Memulihkan ${recoveredCount} event dari processing queue.`,
      );
    }

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
      let event: StreamEvent | null = null;

      try {
        event =
          await this.redisQueueService.dequeueEvent();

        if (!event) {
          await this.sleep(100);
          continue;
        }

        await this.processEvent(event);

        await this.redisQueueService.acknowledgeEvent(
          event,
        );
      } catch (error) {
        console.error(
          "[EventProcessor] Gagal memproses event:",
          error,
        );

        if (event) {
          console.error(
            "[EventProcessor] Event tetap berada di processing queue dan akan dipulihkan saat backend restart.",
          );
        }

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