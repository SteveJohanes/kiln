import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { google } from "googleapis";
import type { StreamEvent } from "@streamdex/types";
import { EventService } from "../event/event.service";
import { RedisService } from "../redis/redis.service";
import { StreamSessionService } from "../stream/stream-session.service";
import { PlatformConnectionService } from "./platform-connection.service";
import { YoutubeOAuthService } from "./youtube-oauth.service";

const MESSAGE_DEDUPE_TTL_SECONDS = 24 * 60 * 60;
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const MAX_MESSAGES_PER_POLL = 200;

@Injectable()
export class YoutubeLiveChatService {
  constructor(
    private readonly platformConnectionService: PlatformConnectionService,
    private readonly youtubeOAuthService: YoutubeOAuthService,
    private readonly streamSessionService: StreamSessionService,
    private readonly eventService: EventService,
    private readonly redisService: RedisService,
  ) {}

  async pollMessages(
    userId: string,
    connectionId: string,
    pageToken?: string,
  ) {
    const session =
      await this.streamSessionService.getActiveSession(userId);

    if (!session || !session.platforms.includes("youtube")) {
      throw new BadRequestException(
        "Tidak ada sesi live aktif yang mencakup YouTube.",
      );
    }

    let credentials =
      await this.platformConnectionService.getYoutubeAccessCredentials(
        userId,
        connectionId,
      );

    if (
      !credentials.tokenExpiresAt ||
      credentials.tokenExpiresAt.getTime() <=
        Date.now() + TOKEN_REFRESH_BUFFER_MS
    ) {
      await this.youtubeOAuthService.refreshConnectionAccessToken(
        userId,
        connectionId,
      );

      credentials =
        await this.platformConnectionService.getYoutubeAccessCredentials(
          userId,
          connectionId,
        );
    }

    const oauthClient = new google.auth.OAuth2();
    oauthClient.setCredentials({
      access_token: credentials.accessToken,
    });

    const youtube = google.youtube({
      version: "v3",
      auth: oauthClient,
    });

    try {
      const broadcasts = await youtube.liveBroadcasts.list({
        part: ["id", "snippet", "status"],
        mine: true,
        maxResults: 50,
      });

      const liveChatId = broadcasts.data.items?.find(
        (broadcast) =>
          broadcast.status?.lifeCycleStatus === "live" &&
          Boolean(broadcast.snippet?.liveChatId),
      )?.snippet?.liveChatId;

      if (!liveChatId) {
        throw new BadRequestException(
          "Tidak ditemukan siaran YouTube aktif dengan Live Chat.",
        );
      }

      const response = await youtube.liveChatMessages.list({
        liveChatId,
        part: ["id", "snippet", "authorDetails"],
        maxResults: MAX_MESSAGES_PER_POLL,
        ...(pageToken ? { pageToken } : {}),
      });

      const redis = this.redisService.getClient();
      let messagesProcessed = 0;

      for (const message of response.data.items ?? []) {
        if (!message.id) {
          continue;
        }

        const dedupeKey =
          `youtube:livechat:seen:${connectionId}:${message.id}`;

        const accepted = await redis.set(
          dedupeKey,
          "1",
          "EX",
          MESSAGE_DEDUPE_TTL_SECONDS,
          "NX",
        );

        if (accepted !== "OK") {
          continue;
        }

        const snippet = message.snippet;
        const timestamp = snippet?.publishedAt
          ? Date.parse(snippet.publishedAt)
          : Date.now();

        const event: StreamEvent = {
          id: `youtube:${message.id}`,
          platform: "youtube",
          type: "chat",
          username:
            message.authorDetails?.displayName ?? "YouTube user",
          ...(snippet?.displayMessage
            ? { message: snippet.displayMessage }
            : {}),
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
          sessionId: session.id,
        };

        this.eventService.publish(event, userId);
        messagesProcessed += 1;
      }

      return {
        connectionId,
        sessionId: session.id,
        messagesProcessed,
        nextPageToken: response.data.nextPageToken ?? null,
        pollingIntervalMillis:
          response.data.pollingIntervalMillis ?? 5000,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const apiError = error as {
        message?: unknown;
        code?: unknown;
        response?: {
          status?: unknown;
          data?: {
            error?: {
              message?: unknown;
              errors?: Array<{ reason?: unknown }>;
            };
          };
        };
      };

      console.error("[YouTube Live Chat] API request failed", {
        code: apiError.code,
        status: apiError.response?.status,
        message: apiError.response?.data?.error?.message ?? apiError.message,
        reasons: apiError.response?.data?.error?.errors?.map(
          (item) => item.reason,
        ),
      });

      throw new BadGatewayException(
        "Gagal mengambil pesan YouTube Live Chat. Periksa status siaran, izin akun, dan kuota YouTube API.",
      );
    }
  }
}
