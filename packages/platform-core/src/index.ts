
import type { StreamEvent, Platform } from "@streamdex/types";

export interface PlatformAdapter {
  readonly platform: Platform;

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  isConnected(): boolean;

  onEvent(handler: (event: StreamEvent) => void): () => void;
}

export { YouTubeAdapter } from "./adapters/youtube/youtube.adapter";
export { TikTokAdapter } from "./adapters/tiktok/tiktok.adapter";
export { TwitchAdapter } from "./adapters/twitch/twitch.adapter";
export { KickAdapter } from "./adapters/kick/kick.adapter";

export { PlatformAdapterRegistry } from "./registry/platform-adapter.registry";
