import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ObsService } from './obs.service';

interface ConnectObsDto {
  password?: string;
}

interface SetObsSceneDto {
  sceneName: string;
}

@Controller('obs')
@UseGuards(AuthGuard('jwt'))
export class ObsController {
  constructor(private readonly obsService: ObsService) {}

  @Post('connect')
  async connect(
    @Body() body: ConnectObsDto = {},
  ): Promise<object> {
    if (
      body.password !== undefined &&
      (typeof body.password !== 'string' || body.password.length > 256)
    ) {
      throw new BadRequestException('Password OBS tidak valid.');
    }

    return this.obsService.connect(body.password);
  }

  @Post('disconnect')
  @HttpCode(200)
  async disconnect(): Promise<object> {
    return this.obsService.disconnect();
  }

  @Get('status')
  async getStatus(): Promise<object> {
    return this.obsService.getStatus();
  }

  @Get('scenes')
  async getScenes(): Promise<object> {
    return this.obsService.getScenes();
  }

  @Post('scenes')
  async setScene(
    @Body() body: SetObsSceneDto,
  ): Promise<object> {
    if (
      typeof body?.sceneName !== 'string' ||
      body.sceneName.trim().length === 0 ||
      body.sceneName.length > 128
    ) {
      throw new BadRequestException('Nama scene tidak valid.');
    }

    return this.obsService.setScene(body.sceneName);
  }

  @Get('stream/status')
  async getStreamStatus(): Promise<object> {
    return this.obsService.getStreamStatus();
  }

  @Post('stream/start')
  async startStream(): Promise<object> {
    return this.obsService.startStream();
  }

  @Post('stream/stop')
  async stopStream(): Promise<object> {
    return this.obsService.stopStream();
  }
}
