import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { EventService } from "./event/event.service";
import { EventGateway } from "./event/event.gateway";
import { StreamEventPersistenceService } from "./event/stream-event-persistence.service";

import { StreamSessionService } from "./stream/stream-session.service";
import { StreamSessionPersistenceService } from "./stream/stream-session-persistence.service";
import { StreamSessionController } from "./stream/stream-session.controller";

import { DashboardService } from "./dashboard/dashboard.service";
import { DashboardController } from "./dashboard/dashboard.controller";

import { StreamHistoryService } from "./history/stream-history.service";
import { StreamHistoryController } from "./history/stream-history.controller";

import { AuthModule } from "./auth/auth.module";

import { PrismaService } from "./prisma/prisma.service";

@Module({
  imports: [AuthModule],

  controllers: [
    AppController,
    StreamSessionController,
    DashboardController,
    StreamHistoryController,
  ],

  providers: [
    AppService,

    PrismaService,

    EventService,
    EventGateway,
    StreamEventPersistenceService,

    StreamSessionService,
    StreamSessionPersistenceService,

    DashboardService,

    StreamHistoryService,
  ],
})
export class AppModule {}
