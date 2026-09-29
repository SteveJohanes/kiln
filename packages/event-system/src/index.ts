import type { StreamEvent } from "@streamdex/types";

export type EventHandler = (event: StreamEvent) => void;

export class EventBus {
  private handlers: Set<EventHandler> = new Set();

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  publish(event: StreamEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
