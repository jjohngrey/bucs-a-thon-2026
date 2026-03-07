import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { registerSocketHandlers } from "./registerHandlers.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("[socket:connect]", {
      socketId: socket.id,
    });

    registerSocketHandlers(io, socket);
  });

  return io;
}
