import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { StreamSession } from "@streamdex/types";
import { StreamSessionService } from "../stream/stream-session.service";
import { PlatformConnectionService } from "./platform-connection.service";
import { YoutubeLiveChatService } from "./youtube-live-chat.service";

type PollingTask = {
  userId: string;
  connectionId: string;
  sessionId: string;
  timer?: ReturnType<typeof setTimeout>;
  stopped: boolean;
  pageToken?: string;
  waitingForLive?: boolean;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 30_000;

const NO_ACTIVE_LIVE_MESSAGE =
  "Tidak ditemukan siaran YouTube aktif dengan Live Chat";

@Injectable()
export class YoutubeLiveChatPollingService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly tasks = new Map<string, PollingTask>();

  constructor(
    private readonly streamSessionService: StreamSessionService,
    private readonly platformConnectionService: PlatformConnectionService,
    private readonly youtubeLiveChatService: YoutubeLiveChatService,
  ) {}

  async onModuleInit(): Promise<void> {
    console.log(
      "[YouTube Polling] Memeriksa sesi aktif untuk pemulihan...",
    );

    try {
      const sessions =
        await this.streamSessionService.getAllActiveSessions();

      const youtubeSessions = sessions.filter(
        (session) =>
          session.status === "live" &&
          session.platforms.includes("youtube"),
      );

      if (youtubeSessions.length === 0) {
        console.log(
          "[YouTube Polling] Tidak ada sesi YouTube aktif untuk dipulihkan.",
        );
        return;
      }

      for (const session of youtubeSessions) {
        try {
          await this.startForSession(session.userId, session);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          console.error(
            `[YouTube Polling] Gagal memulihkan sesi ${session.id}: ${message}`,
          );
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.error(
        `[YouTube Polling] Gagal memeriksa sesi aktif: ${message}`,
      );
    }
  }

  async startForSession(
    userId: string,
    session: StreamSession,
  ): Promise<void> {
    if (session.userId !== userId) {
      console.warn(
        `[YouTube Polling] Sesi ${session.id} tidak cocok dengan pemilik.`,
      );
      this.stopForUser(userId);
      return;
    }

    if (
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

    if (youtubeConnections.length === 0) {
      console.warn(
        "[YouTube Polling] Tidak ada koneksi YouTube aktif.",
      );
    }

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

      console.log(
        `[YouTube Polling] Dimulai untuk sesi ${session.id}.`,
      );

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

      if (task.stopped || this.tasks.get(key) !== task) {
        return;
      }

      if (result.sessionId !== task.sessionId) {
        console.warn(
          "[YouTube Polling] Sesi berubah. Task dihentikan.",
        );
        this.stopTask(key);
        return;
      }

      if (task.waitingForLive) {
        console.log(
          "[YouTube Polling] Siaran aktif terdeteksi kembali.",
        );
        task.waitingForLive = false;
      }

      task.pageToken = result.nextPageToken ?? undefined;

      const requestedInterval = result.pollingIntervalMillis;

      if (
        typeof requestedInterval === "number" &&
        Number.isFinite(requestedInterval)
      ) {
        nextDelayMs = Math.min(
          MAX_POLL_INTERVAL_MS,
          Math.max(MIN_POLL_INTERVAL_MS, requestedInterval),
        );
      }
    } catch (error) {
      if (task.stopped || this.tasks.get(key) !== task) {
        return;
      }

      const message =
        error instanceof Error ? error.message : String(error);

      if (message.includes(NO_ACTIVE_LIVE_MESSAGE)) {
        if (!task.waitingForLive) {
          console.log(
            "[YouTube Polling] Belum ada siaran YouTube aktif. Pemeriksaan dilanjutkan setiap 30 detik.",
          );
        }

        task.waitingForLive = true;
        task.pageToken = undefined;
        nextDelayMs = MAX_POLL_INTERVAL_MS;
      } else {
        console.error(
          `[YouTube Polling] Gagal: ${message}`,
        );
      }
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

    console.log(
      `[YouTube Polling] Dihentikan untuk sesi ${task.sessionId}.`,
    );
  }

  private getTaskKey(
    userId: string,
    connectionId: string,
  ): string {
    return `${userId}:${connectionId}`;
  }
}