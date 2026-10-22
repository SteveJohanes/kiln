import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { EventService } from './event/event.service';
import { EventGateway } from './event/event.gateway';
import { StreamEventPersistenceService } from './event/stream-event-persistence.service';

import { StreamSessionService } from './stream/stream-session.service';
import { StreamSessionPersistenceService } from './stream/stream-session-persistence.service';
import { StreamSessionController } from './stream/stream-session.controller';

import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';

import { StreamHistoryService } from './history/stream-history.service';
import { StreamHistoryController } from './history/stream-history.controller';

import { AuthModule } from './auth/auth.module';

import { PrismaService } from './prisma/prisma.service';

import { RedisService } from './redis/redis.service';
import { RedisCacheService } from './redis/redis-cache.service';
import { RedisPubSubService } from './redis/redis-pubsub.service';

import { PlatformConnectionService } from './platform-connection/platform-connection.service';
import { PlatformConnectionController } from './platform-connection/platform-connection.controller';
import { TokenEncryptionService } from './platform-connection/token-encryption.service';
import { YoutubeOAuthService } from './platform-connection/youtube-oauth.service';
import { YoutubeOAuthController } from './platform-connection/youtube-oauth.controller';
import { YoutubeLiveChatService } from './platform-connection/youtube-live-chat.service';
import { YoutubeLiveChatPollingService } from './platform-connection/youtube-live-chat-polling.service';

import { ObsModule } from './obs/obs.module';

import { OverlayService } from './overlay/overlay.service';
import { OverlayController } from './overlay/overlay.controller';
import { OverlayGateway } from './overlay/overlay.gateway';

@Module({
  imports: [AuthModule, ObsModule],

  controllers: [
    AppController,
    StreamSessionController,
    DashboardController,
    StreamHistoryController,
    PlatformConnectionController,
    YoutubeOAuthController,
    OverlayController,
  ],

  providers: [
    AppService,
    PrismaService,

    RedisService,
    RedisCacheService,
    RedisPubSubService,

    EventService,
    EventGateway,
    StreamEventPersistenceService,

    StreamSessionService,
    StreamSessionPersistenceService,

    DashboardService,
    StreamHistoryService,

    PlatformConnectionService,
    TokenEncryptionService,
    YoutubeOAuthService,
    YoutubeLiveChatService,
    YoutubeLiveChatPollingService,

    OverlayService,
    OverlayGateway,
  ],
})
export class AppModule {}
