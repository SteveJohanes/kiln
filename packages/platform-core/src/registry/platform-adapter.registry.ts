
import type { Platform } from "@streamdex/types";
import type { PlatformAdapter } from "../index";

export class PlatformAdapterRegistry {
  private readonly adapters = new Map<Platform, PlatformAdapter>();

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: Platform): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(platform: Platform): boolean {
    return this.adapters.has(platform);
  }

  remove(platform: Platform): boolean {
    return this.adapters.delete(platform);
  }
}