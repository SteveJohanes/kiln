import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  EventBus,
  type EventHandler,
} from "@streamdex/event-system";
import {
  KickAdapter,
  PlatformAdapterRegistry,
  TikTokAdapter,
  TwitchAdapter,
  YouTubeAdapter,
} from "@streamdex/platform-core";
import type {
  Platform,
  StreamEvent,
} from "@streamdex/types";
import { StreamEventPersistenceService } from "./stream-event-persistence.service";
import { RedisCacheService } from "../redis/redis-cache.service";
import { RedisQueueService } from "../redis/redis-queue.service";

@Injectable()
export class EventService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly eventBus = new EventBus();
  private readonly adapterRegistry =
    new PlatformAdapterRegistry();
  private readonly eventHistory: StreamEvent[] = [];

  constructor(
    private readonly persistenceService: StreamEventPersistenceService,
    private readonly redisCacheService: RedisCacheService,
    private readonly redisQueueService: RedisQueueService,
  ) {
    this.adapterRegistry.register(
      new YouTubeAdapter(),
    );
    this.adapterRegistry.register(
      new TikTokAdapter(),
    );
    this.adapterRegistry.register(
      new TwitchAdapter(),
    );
    this.adapterRegistry.register(
      new KickAdapter(),
    );
  }

  onModuleInit(): void {
    this.subscribe((event) => {
      console.log("[EventBus]", event);
    });

    for (const adapter of this.adapterRegistry.getAll()) {
      adapter.onEvent((event) => {
        this.publish(event);
      });

      void adapter.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const adapter of this.adapterRegistry.getAll()) {
      await adapter.disconnect();
    }
  }

  publish(
    event: StreamEvent,
    userId?: string,
  ): void {
    this.eventHistory.push(event);

    void this.redisCacheService
      .addRecentEvent(event)
      .catch((error) => {
        console.error(
          "[RedisCache] Gagal menyimpan event:",
          error,
        );
      });

    void this.redisQueueService
      .enqueueEvent(event)
      .catch((error) => {
        console.error(
          "[RedisQueue] Gagal memasukkan event ke queue:",
          error,
        );
      });

    if (userId) {
      void this.persistenceService
        .createEvent(
          event,
          userId,
          event.sessionId,
        )
        .catch((error) => {
          console.error(
            "[EventPersistence] Gagal menyimpan event:",
            error,
          );
        });
    }

    this.eventBus.publish(event);
  }

  subscribe(handler: EventHandler): () => void {
    return this.eventBus.subscribe(handler);
  }

  getRecentEvents(
    limit = 20,
  ): StreamEvent[] {
    return this.eventHistory
      .slice(-limit)
      .reverse();
  }

  getEventCount(): number {
    return this.eventHistory.length;
  }

  getAdapter(platform: Platform) {
    return this.adapterRegistry.get(platform);
  }

  getAllAdapters() {
    return this.adapterRegistry.getAll();
  }
}