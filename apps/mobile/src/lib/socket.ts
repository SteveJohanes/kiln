
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./auth-storage";

const SOCKET_URL = "http://192.168.1.11:3000";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

let connecting = false;

export async function connectSocket(): Promise<void> {
  if (socket.connected || connecting) {
    return;
  }

  connecting = true;

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      // Belum login bukan kondisi fatal. Tunggu sampai pengguna login.
      return;
    }

    socket.auth = {
      token: accessToken,
    };

    socket.connect();
  } finally {
    connecting = false;
  }
}

export function disconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect();
  }
}
