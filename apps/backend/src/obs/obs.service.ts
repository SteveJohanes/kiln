
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import OBSWebSocket from 'obs-websocket-js';

interface ObsStatus {
  connected: boolean;
  obsVersion: string;
  obsWebSocketVersion: string;
  currentScene: string;
  scenes: string[];
  streaming: boolean;
  recording: boolean;
}

interface ObsScene {
  name: string;
  index: number;
}

interface ObsScenesResult {
  currentScene: string;
  scenes: ObsScene[];
}

interface ObsStreamStatus {
  streaming: boolean;
  reconnecting: boolean;
  duration: number;
  bytes: number;
  congestion: number;
}

interface ObsActionResult {
  success: boolean;
  message?: string;
  connected?: boolean;
  currentScene?: string;
}

@Injectable()
export class ObsService implements OnModuleDestroy {
  private readonly logger = new Logger(ObsService.name);
  private readonly obs = new OBSWebSocket();

  private connected = false;
  private connecting = false;

  private readonly streamStatusTimeoutMs = 8000;
  private readonly streamStatusPollIntervalMs = 250;

  constructor() {
    this.obs.on('ConnectionClosed', () => {
      this.connected = false;
      this.logger.warn('Koneksi OBS WebSocket terputus.');
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.obs.disconnect();
    } catch {
      this.logger.warn('Gagal memutuskan koneksi OBS saat shutdown.');
    } finally {
      this.connected = false;
    }
  }

  async connect(password?: string): Promise<ObsStatus> {
    if (this.connected && this.obs.identified) {
      return this.getStatus();
    }

    if (this.connecting) {
      throw new ServiceUnavailableException(
        'Koneksi OBS sedang diproses. Coba lagi sebentar.',
      );
    }

    this.connecting = true;

    try {
      const url = process.env.OBS_WEBSOCKET_URL ?? 'ws://127.0.0.1:4455';
      const configuredPassword =
        password ?? process.env.OBS_WEBSOCKET_PASSWORD;

      await this.obs.connect(url, configuredPassword);

      this.connected = true;
      this.logger.log(`Terhubung ke OBS WebSocket: ${url}`);

      return await this.getStatus();
    } catch (error: unknown) {
      this.connected = false;

      const message =
        error instanceof Error ? error.message : 'Kesalahan tidak diketahui';

      this.logger.error(`Koneksi OBS gagal: ${message}`);

      throw new ServiceUnavailableException(
        `Tidak dapat terhubung ke OBS. Pastikan OBS aktif, WebSocket Server aktif, dan alamat serta password benar. Detail: ${message}`,
      );
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<ObsActionResult> {
    if (this.connected) {
      try {
        await this.obs.disconnect();
      } finally {
        this.connected = false;
      }
    }

    return {
      connected: false,
      success: true,
      message: 'Koneksi OBS diputus.',
    };
  }

  async getStatus(): Promise<ObsStatus> {
    this.ensureConnected();

    const [version, streamStatus, sceneList, recordStatus] =
      await Promise.all([
        this.obs.call('GetVersion'),
        this.obs.call('GetStreamStatus'),
        this.obs.call('GetSceneList'),
        this.obs.call('GetRecordStatus'),
      ]);

    const scenes = sceneList.scenes
      .map((scene): string | null => {
        const name: unknown = scene.sceneName;
        return typeof name === 'string' ? name : null;
      })
      .filter((name): name is string => name !== null);

    return {
      connected: true,
      obsVersion: version.obsVersion,
      obsWebSocketVersion: version.obsWebSocketVersion,
      currentScene: sceneList.currentProgramSceneName,
      scenes,
      streaming: streamStatus.outputActive,
      recording: recordStatus.outputActive,
    };
  }

  async getScenes(): Promise<ObsScenesResult> {
    this.ensureConnected();

    const result = await this.obs.call('GetSceneList');

    const scenes = result.scenes
      .map((scene): ObsScene | null => {
        const name: unknown = scene.sceneName;
        const index: unknown = scene.sceneIndex;

        if (typeof name !== 'string' || typeof index !== 'number') {
          return null;
        }

        return { name, index };
      })
      .filter((scene): scene is ObsScene => scene !== null);

    return {
      currentScene: result.currentProgramSceneName,
      scenes,
    };
  }

  async setScene(sceneName: string): Promise<ObsActionResult> {
    this.ensureConnected();

    const normalizedSceneName = sceneName.trim();

    if (!normalizedSceneName) {
      return {
        success: false,
        message: 'Nama scene tidak boleh kosong.',
      };
    }

    const result = await this.obs.call('GetSceneList');

    const exists = result.scenes.some(
      (scene) => scene.sceneName === normalizedSceneName,
    );

    if (!exists) {
      return {
        success: false,
        message: `Scene "${normalizedSceneName}" tidak ditemukan.`,
      };
    }

    await this.obs.call('SetCurrentProgramScene', {
      sceneName: normalizedSceneName,
    });

    return {
      success: true,
      currentScene: normalizedSceneName,
      message: 'Scene OBS berhasil diganti.',
    };
  }

  async getStreamStatus(): Promise<ObsStreamStatus> {
    this.ensureConnected();

    const result = await this.obs.call('GetStreamStatus');

    return {
      streaming: result.outputActive,
      reconnecting: result.outputReconnecting,
      duration: result.outputDuration,
      bytes: result.outputBytes,
      congestion: result.outputCongestion,
    };
  }

  async startStream(): Promise<ObsActionResult> {
    this.ensureConnected();

    const status = await this.obs.call('GetStreamStatus');

    if (status.outputActive) {
      return {
        success: true,
        message: 'Siaran OBS sudah berjalan.',
      };
    }

    await this.obs.call('StartStream');

    const isStreaming = await this.waitForStreamState(true);

    if (!isStreaming) {
      return {
        success: false,
        message:
          'OBS menerima perintah mulai, tetapi streaming belum terkonfirmasi setelah 8 detik. Periksa status dan log OBS.',
      };
    }

    return {
      success: true,
      message: 'Siaran OBS sudah aktif.',
    };
  }

  async stopStream(): Promise<ObsActionResult> {
    this.ensureConnected();

    const status = await this.obs.call('GetStreamStatus');

    if (!status.outputActive) {
      return {
        success: true,
        message: 'Siaran OBS memang tidak sedang berjalan.',
      };
    }

    await this.obs.call('StopStream');

    const isStreaming = await this.waitForStreamState(false);

    if (isStreaming) {
      return {
        success: false,
        message:
          'OBS menerima perintah berhenti, tetapi streaming masih terdeteksi setelah 8 detik. Periksa status OBS.',
      };
    }

    return {
      success: true,
      message: 'Siaran OBS sudah berhenti.',
    };
  }

  private async waitForStreamState(
    expectedStreaming: boolean,
  ): Promise<boolean> {
    this.ensureConnected();

    const deadline = Date.now() + this.streamStatusTimeoutMs;

    while (Date.now() < deadline) {
      const status = await this.obs.call('GetStreamStatus');

      if (status.outputActive === expectedStreaming) {
        return true;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.streamStatusPollIntervalMs);
      });

      this.ensureConnected();
    }

    const finalStatus = await this.obs.call('GetStreamStatus');

    return finalStatus.outputActive === expectedStreaming;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.obs.identified) {
      throw new ServiceUnavailableException(
        'OBS belum terhubung. Hubungkan OBS terlebih dahulu.',
      );
    }
  }
}
