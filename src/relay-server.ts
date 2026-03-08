import { WebSocketServer, WebSocket } from "ws";

// A minimal WebSocket relay server (~50 LOC) that teams can self-host.
// It pairs two clients into a "room" and relays messages between them.
// It sees only ciphertext (E2E encrypted by the clients).

interface Room {
  host?: WebSocket;
  guest?: WebSocket;
}

export function startRelayServer(port: number): void {
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ port });

  console.log(`pair-vibe relay listening on ws://0.0.0.0:${port}`);

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const roomId = url.searchParams.get("room");
    const role = url.searchParams.get("role"); // "host" or "guest"

    if (!roomId || !role) {
      ws.close(4000, "Missing room or role query param");
      return;
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = {};
      rooms.set(roomId, room);
    }

    if (role === "host") {
      if (room.host) {
        ws.close(4001, "Room already has a host");
        return;
      }
      room.host = ws;
    } else {
      if (room.guest) {
        ws.close(4002, "Room already has a guest");
        return;
      }
      room.guest = ws;
    }

    // Relay messages to the other peer (opaque — we don't parse them)
    ws.on("message", (data) => {
      const peer = role === "host" ? room!.guest : room!.host;
      if (peer?.readyState === WebSocket.OPEN) {
        peer.send(data);
      }
    });

    ws.on("close", () => {
      if (role === "host") room!.host = undefined;
      else room!.guest = undefined;
      // Clean up empty rooms
      if (!room!.host && !room!.guest) {
        rooms.delete(roomId);
      }
    });
  });
}
