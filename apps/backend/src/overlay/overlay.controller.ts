import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { OverlayService } from './overlay.service';
import { OverlayGateway } from './overlay.gateway';

type AuthenticatedRequest = Request & {
  user: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@Controller('overlay')
export class OverlayController {
  constructor(
    private readonly overlayService: OverlayService,
    private readonly overlayGateway: OverlayGateway,
  ) {}

  @Post('tokens')
  @UseGuards(AuthGuard('jwt'))
  createToken(
    @Req() request: AuthenticatedRequest,
    @Body() body: { sessionId?: string },
  ) {
    const sessionId = body?.sessionId;

    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new UnauthorizedException('sessionId wajib diisi.');
    }

    return this.overlayService.createToken(this.getUserId(request), sessionId);
  }

  @Get('tokens')
  @UseGuards(AuthGuard('jwt'))
  listTokens(@Req() request: AuthenticatedRequest) {
    return this.overlayService.listTokens(this.getUserId(request));
  }

  @Delete('tokens/:id')
  @UseGuards(AuthGuard('jwt'))
  async revokeToken(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const result = await this.overlayService.revokeToken(
      this.getUserId(request),
      id,
    );

    this.overlayGateway.disconnectTokenId(id);

    return result;
  }

  @Get(':token')
  async getOverlayPage(
    @Param('token') token: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      await this.overlayService.validateToken(token);
    } catch {
      response
        .status(401)
        .type('text/plain')
        .send('Token overlay tidak valid atau sudah dicabut.');
      return;
    }

    response
      .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      .setHeader('Pragma', 'no-cache')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .type('html')
      .send(this.renderOverlayPage(token));
  }

  private renderOverlayPage(token: string): string {
    const safeToken = JSON.stringify(token);

    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StreamDex Overlay</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    font-family: Inter, Arial, sans-serif;
    color: #fff;
  }
  #events {
    position: absolute;
    left: 24px;
    bottom: 24px;
    width: min(680px, calc(100% - 48px));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .event {
    background: rgba(12, 16, 28, .88);
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 16px rgba(0,0,0,.2);
    overflow-wrap: anywhere;
    animation: enter .2s ease-out;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 13px;
    color: #aebcff;
  }
  .platform {
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: .06em;
  }
  .username { font-weight: 700; font-size: 16px; }
  .message {
    font-size: 18px;
    line-height: 1.35;
    white-space: pre-wrap;
  }
  #status {
    position: absolute;
    top: 16px;
    right: 16px;
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(12,16,28,.7);
    color: #d1d5db;
    font-size: 12px;
  }
  #status.connected { color: #86efac; }
  @keyframes enter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>
<div id="status">Menghubungkan...</div>
<div id="events" aria-live="polite"></div>
<script>
(() => {
  const token = ${safeToken};
  const status = document.getElementById("status");
  const container = document.getElementById("events");

  let socket;
  let retryTimer;
  let activeSessionId = null;

  function setStatus(text, connected = false) {
    status.textContent = text;
    status.classList.toggle("connected", connected);
  }

  function clearEvents() {
    container.replaceChildren();
  }

  function addEvent(event) {
    if (!event || typeof event !== "object") return;

    if (
      typeof event.sessionId !== "string" ||
      !event.sessionId.trim()
    ) {
      return;
    }

    if (activeSessionId === null) {
      activeSessionId = event.sessionId;
    } else if (event.sessionId !== activeSessionId) {
      clearEvents();
      activeSessionId = event.sessionId;
    }

    const card = document.createElement("article");
    card.className = "event";

    const meta = document.createElement("div");
    meta.className = "meta";

    const platform = document.createElement("span");
    platform.className = "platform";
    platform.textContent = String(event.platform || "stream");

    const username = document.createElement("span");
    username.className = "username";
    username.textContent = String(event.username || "Penonton");

    meta.append(platform, username);
    card.append(meta);

    if (typeof event.message === "string" && event.message.length) {
      const message = document.createElement("div");
      message.className = "message";
      message.textContent = event.message;
      card.append(message);
    }

    container.append(card);

    while (container.children.length > 8) {
      container.firstElementChild.remove();
    }
  }

  function connect() {
    if (typeof window.io !== "function") {
      setStatus("Socket.IO client gagal dimuat");
      retryTimer = setTimeout(connect, 3000);
      return;
    }

    socket = window.io("/overlay", {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 5000
    });

    socket.on("connect", () => {
      clearEvents();
      activeSessionId = null;
      setStatus("Terhubung", true);
    });

    socket.on("overlay:event", addEvent);

    socket.on("disconnect", () => {
      clearEvents();
      activeSessionId = null;
      setStatus("Koneksi terputus");
    });

    socket.on("connect_error", () => {
      clearEvents();
      activeSessionId = null;
      setStatus("Gagal terhubung");
    });
  }

  const script = document.createElement("script");
  script.src = window.location.origin + "/socket.io/socket.io.js";
  script.onload = connect;
  script.onerror = () => {
    clearEvents();
    setStatus("Socket.IO client gagal dimuat");
    retryTimer = setTimeout(() => location.reload(), 5000);
  };

  document.head.append(script);

  window.addEventListener("beforeunload", () => {
    clearTimeout(retryTimer);
    if (socket) socket.disconnect();
  });
})();
</script>
</body>
</html>`;
  }

  private getUserId(request: AuthenticatedRequest): string {
    const user = request.user;
    const userId = user?.id ?? user?.userId ?? user?.sub;

    if (typeof userId !== 'string' || !userId.trim()) {
      throw new UnauthorizedException('Identitas pengguna tidak valid.');
    }

    return userId;
  }
}