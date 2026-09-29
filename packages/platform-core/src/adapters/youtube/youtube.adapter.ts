
import type { StreamEvent } from "@streamdex/types";
import type { PlatformAdapter } from "../../index";

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = "youtube" as const;

  private connected = false;

  private readonly handlers = new Set<
    (event: StreamEvent) => void
  >();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  onEvent(handler: (event: StreamEvent) => void): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  emitTestEvent(event: StreamEvent): void {
    if (!this.connected) {
      return;
    }

    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
