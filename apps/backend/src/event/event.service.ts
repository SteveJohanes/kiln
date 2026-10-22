
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
import { RedisPubSubService } from "../redis/redis-pubsub.service";

@Injectable()
export class EventService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly eventBus = new EventBus();
  private readonly adapterRegistry =
    new PlatformAdapterRegistry();
  private readonly eventHistory: StreamEvent[] = [];

  private pendingOperations = 0;
  private overloadWarningActive = false;

  private readonly maxPendingOperations = 200;

  constructor(
    private readonly persistenceService: StreamEventPersistenceService,
    private readonly redisCacheService: RedisCacheService,
    private readonly redisPubSubService: RedisPubSubService,
  ) {
    this.adapterRegistry.register(new YouTubeAdapter());
    this.adapterRegistry.register(new TikTokAdapter());
    this.adapterRegistry.register(new TwitchAdapter());
    this.adapterRegistry.register(new KickAdapter());
  }

  onModuleInit(): void {
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

  publish(event: StreamEvent, userId?: string): void {
    this.eventHistory.push(event);

    if (this.eventHistory.length > 100) {
      this.eventHistory.splice(
        0,
        this.eventHistory.length - 100,
      );
    }

    this.trackOperation(
      this.redisCacheService.addRecentEvent(event),
      "[RedisCache] Gagal menyimpan event:",
    );

    if (userId) {
      this.trackOperation(
        this.redisPubSubService.publish(event, userId),
        "[RedisPubSub] Gagal publish event:",
      );

      this.trackOperation(
        this.persistenceService.createEvent(
          event,
          userId,
          event.sessionId,
        ),
        "[EventPersistence] Gagal menyimpan event:",
      );
    }

    this.eventBus.publish(event);
  }

  private trackOperation(
    operation: Promise<unknown>,
    errorMessage: string,
  ): void {
    this.pendingOperations += 1;

    if (
      this.pendingOperations >= this.maxPendingOperations &&
      !this.overloadWarningActive
    ) {
      this.overloadWarningActive = true;

      console.warn(
        `[EventService] Operasi tertunda mencapai ${this.pendingOperations}. Periksa beban Redis dan PostgreSQL.`,
      );
    }

    void operation
      .catch((error: unknown) => {
        console.error(errorMessage, error);
      })
      .finally(() => {
        this.pendingOperations = Math.max(
          0,
          this.pendingOperations - 1,
        );

        if (
          this.pendingOperations <
          this.maxPendingOperations / 2
        ) {
          this.overloadWarningActive = false;
        }
      });
  }

  subscribe(handler: EventHandler): () => void {
    return this.eventBus.subscribe(handler);
  }

  getRecentEvents(limit = 20): StreamEvent[] {
    return this.eventHistory.slice(-limit).reverse();
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
