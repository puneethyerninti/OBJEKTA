// backend/socket.js
const { Server } = require("socket.io");

let io = null;

function initSocket(server) {
  if (io) return io;
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected", socket.id);

    socket.on("join-dashboard", (info) => {
      // optional tracking
    });

    socket.on("join-project", (projectId) => {
      socket.join(projectId);
      // notify presence instantly if you want
      const clients = Array.from(io.sockets.adapter.rooms.get(projectId) || []);
      io.to(projectId).emit("presence_update", { projectId, users: clients });
    });

    socket.on("leave-project", (projectId) => {
      socket.leave(projectId);
      const clients = Array.from(io.sockets.adapter.rooms.get(projectId) || []);
      io.to(projectId).emit("presence_update", { projectId, users: clients });
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

module.exports = { initSocket, getIO };
