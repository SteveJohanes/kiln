import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
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
import type { Platform, StreamEvent } from "@streamdex/types";

@Injectable()
export class EventService implements OnModuleInit, OnModuleDestroy {
  private readonly eventBus = new EventBus();
  private readonly adapterRegistry = new PlatformAdapterRegistry();
  private readonly eventHistory: StreamEvent[] = [];

  constructor() {
    this.adapterRegistry.register(new YouTubeAdapter());
    this.adapterRegistry.register(new TikTokAdapter());
    this.adapterRegistry.register(new TwitchAdapter());
    this.adapterRegistry.register(new KickAdapter());
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

  publish(event: StreamEvent): void {
    this.eventHistory.push(event);
    this.eventBus.publish(event);
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