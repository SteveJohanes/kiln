import { Module } from '@nestjs/common';
import { ObsController } from './obs.controller';
import { ObsService } from './obs.service';

@Module({
  controllers: [ObsController],
  providers: [ObsService],
  exports: [ObsService],
})
export class ObsModule {}
