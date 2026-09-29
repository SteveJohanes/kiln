import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { EventService } from "./event/event.service";
import { EventGateway } from "./event/event.gateway";
import { StreamSessionService } from "./stream/stream-session.service";
import { StreamSessionController } from "./stream/stream-session.controller";
import { DashboardService } from "./dashboard/dashboard.service";
import { DashboardController } from "./dashboard/dashboard.controller";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [
    AppController,
    StreamSessionController,
    DashboardController,
  ],
  providers: [
    AppService,
    EventService,
    EventGateway,
    StreamSessionService,
    DashboardService,
  ],
})
export class AppModule {}