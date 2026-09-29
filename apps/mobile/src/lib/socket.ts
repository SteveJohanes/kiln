import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./auth-storage";

const SOCKET_URL = "http://192.168.1.6:3000";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export async function connectSocket(): Promise<void> {
  if (socket.connected) {
    return;
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "User belum login. Token WebSocket tidak tersedia.",
    );
  }

  socket.auth = {
    token: accessToken,
  };

  socket.connect();
}

export function disconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect();
  }
}