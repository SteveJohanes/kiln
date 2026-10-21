
import {
  Injectable,
  OnModuleDestroy,
} from "@nestjs/common";
import type { StreamSession } from "@streamdex/types";
import { PlatformConnectionService } from "./platform-connection.service";
import { YoutubeLiveChatService } from "./youtube-live-chat.service";

type PollingTask = {
  userId: string;
  connectionId: string;
  sessionId: string;
  timer?: ReturnType<typeof setTimeout>;
  stopped: boolean;
  pageToken?: string;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 30_000;

@Injectable()
export class YoutubeLiveChatPollingService
  implements OnModuleDestroy
{
  private readonly tasks = new Map<string, PollingTask>();

  constructor(
    private readonly platformConnectionService: PlatformConnectionService,
    private readonly youtubeLiveChatService: YoutubeLiveChatService,
  ) {}

  async startForSession(
    userId: string,
    session: StreamSession,
  ): Promise<void> {
    if (
      session.userId !== userId ||
      session.status !== "live" ||
      !session.platforms.includes("youtube")
    ) {
      this.stopForUser(userId);
      return;
    }

    const connections =
      await this.platformConnectionService.findAllByUser(userId);

    const youtubeConnections = connections.filter(
      (connection) =>
        connection.platform === "youtube" &&
        connection.status === "connected",
    );

    const activeConnectionIds = new Set(
      youtubeConnections.map((connection) => connection.id),
    );

    for (const [key, task] of this.tasks) {
      if (
        task.userId === userId &&
        (
          task.sessionId !== session.id ||
          !activeConnectionIds.has(task.connectionId)
        )
      ) {
        this.stopTask(key);
      }
    }

    for (const connection of youtubeConnections) {
      const key = this.getTaskKey(userId, connection.id);
      const existing = this.tasks.get(key);

      if (existing && existing.sessionId === session.id) {
        continue;
      }

      const task: PollingTask = {
        userId,
        connectionId: connection.id,
        sessionId: session.id,
        stopped: false,
      };

      this.tasks.set(key, task);
      this.scheduleNextPoll(key, task, 0);
    }
  }

  stopForUser(userId: string): void {
    for (const [key, task] of this.tasks) {
      if (task.userId === userId) {
        this.stopTask(key);
      }
    }
  }

  stopForSession(userId: string, sessionId: string): void {
    for (const [key, task] of this.tasks) {
      if (
        task.userId === userId &&
        task.sessionId === sessionId
      ) {
        this.stopTask(key);
      }
    }
  }

  onModuleDestroy(): void {
    for (const key of this.tasks.keys()) {
      this.stopTask(key);
    }
  }

  private scheduleNextPoll(
    key: string,
    task: PollingTask,
    delayMs: number,
  ): void {
    if (task.stopped || this.tasks.get(key) !== task) {
      return;
    }

    task.timer = setTimeout(() => {
      void this.runPoll(key, task);
    }, delayMs);
  }

  private async runPoll(
    key: string,
    task: PollingTask,
  ): Promise<void> {
    if (task.stopped || this.tasks.get(key) !== task) {
      return;
    }

    let nextDelayMs = DEFAULT_POLL_INTERVAL_MS;

    try {
      const result =
        await this.youtubeLiveChatService.pollMessages(
          task.userId,
          task.connectionId,
          task.pageToken,
        );

      if (
        task.stopped ||
        this.tasks.get(key) !== task
      ) {
        return;
      }

      if (result.sessionId !== task.sessionId) {
        this.stopTask(key);
        return;
      }

      task.pageToken = result.nextPageToken ?? undefined;

      const requestedInterval = result.pollingIntervalMillis;

      if (
        typeof requestedInterval === "number" &&
        Number.isFinite(requestedInterval)
      ) {
        nextDelayMs = Math.min(
          MAX_POLL_INTERVAL_MS,
          Math.max(
            MIN_POLL_INTERVAL_MS,
            requestedInterval,
          ),
        );
      }
    } catch (error) {
      if (task.stopped || this.tasks.get(key) !== task) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `[YouTube Polling] Gagal memproses koneksi ${task.connectionId}: ${message}`,
      );

      // Jangan mengulang page token lama setelah kegagalan API.
      // Poll berikutnya dimulai tanpa token agar dapat pulih
      // dari token pagination yang kedaluwarsa atau tidak valid.
      task.pageToken = undefined;
    }

    this.scheduleNextPoll(key, task, nextDelayMs);
  }

  private stopTask(key: string): void {
    const task = this.tasks.get(key);

    if (!task) {
      return;
    }

    task.stopped = true;

    if (task.timer) {
      clearTimeout(task.timer);
    }

    this.tasks.delete(key);
  }

  private getTaskKey(
    userId: string,
    connectionId: string,
  ): string {
    return `${userId}:${connectionId}`;
  }
}
