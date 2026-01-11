import { Server } from "socket.io";

let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔥 User connected: ${socket.id}`);

    // Join project room
    socket.on("join-project", (projectId) => {
      socket.join(projectId);
      console.log(`User joined project room: ${projectId}`);
      socket.to(projectId).emit("user-joined", socket.id);
    });

    // Presence event
    socket.on("cursor-move", ({ projectId, position }) => {
      socket.to(projectId).emit("cursor-update", { userId: socket.id, position });
    });

    // Scene sync placeholder
    socket.on("scene-update", ({ projectId, data }) => {
      socket.to(projectId).emit("scene-update", { userId: socket.id, data });
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("⚠️ Socket.io not initialized");
  return io;
}
