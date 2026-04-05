// backend/socket.js
const { Server } = require("socket.io");
const { registerMarketplaceEvents } = require("./socket/marketplace");

let io = null;

function normalizeProjectId(input) {
  if (!input) return null;
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    return input.projectId || input.id || null;
  }
  return null;
}

function emitPresence(projectId) {
  if (!io || !projectId) return;
  const clients = Array.from(io.sockets.adapter.rooms.get(projectId) || []);
  io.to(projectId).emit("presence_update", { projectId, users: clients });
}

function initSocket(server) {
  if (io) return io;

  const parseOrigins = (value) =>
    (value || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

  const envOrigins = parseOrigins(process.env.FRONTEND_ORIGIN);
  const extraOrigins = parseOrigins(process.env.EXTRA_CORS_ORIGINS);
  const allowLocalhost = process.env.NODE_ENV !== "production";
  const allowedOrigins = new Set([...envOrigins, ...extraOrigins]);
  const isLocalOrigin = (origin) => {
    if (!origin) return false;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  };

  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    if (allowLocalhost && isLocalOrigin(origin)) return true;
    return false;
  };

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`Not allowed by socket CORS: ${origin || "<unknown>"}`));
      },
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected", socket.id);
    socket.data.projectId = null;

    socket.on("join-dashboard", (_info) => {
      // optional tracking
    });

    const joinProject = (payload) => {
      const projectId = normalizeProjectId(payload);
      if (!projectId) return;
      if (socket.data.projectId && socket.data.projectId !== projectId) {
        socket.leave(socket.data.projectId);
        emitPresence(socket.data.projectId);
      }
      socket.join(projectId);
      socket.data.projectId = projectId;
      emitPresence(projectId);
    };

    const leaveProject = (payload) => {
      const explicitProjectId = normalizeProjectId(payload);
      const projectId = explicitProjectId || socket.data.projectId;
      if (!projectId) return;
      socket.leave(projectId);
      if (!explicitProjectId || explicitProjectId === socket.data.projectId) {
        socket.data.projectId = null;
      }
      emitPresence(projectId);
    };

    // Canonical + backward compatible aliases
    socket.on("join-project", joinProject);
    socket.on("joinProject", joinProject);
    socket.on("join", joinProject);

    socket.on("leave-project", leaveProject);
    socket.on("leaveProject", leaveProject);
    socket.on("leave", leaveProject);

    socket.on("project:update", (payload) => {
      const projectId = normalizeProjectId(payload);
      if (projectId) {
        socket.to(projectId).emit("project:patched", payload);
        return;
      }
      socket.broadcast.emit("project:patched", payload);
    });

    socket.on("project:patch", (payload) => {
      const projectId = normalizeProjectId(payload);
      if (projectId) {
        socket.to(projectId).emit("project:patched", payload);
        return;
      }
      socket.broadcast.emit("project:patched", payload);
    });

    socket.on("scene:push", (payload) => {
      const projectId = normalizeProjectId(payload);
      if (projectId) {
        socket.to(projectId).emit("scene:push", payload);
        return;
      }
      socket.broadcast.emit("scene:push", payload);
    });

    // ──── Marketplace events ────
    registerMarketplaceEvents(io, socket);

    socket.on("disconnect", () => {
      if (socket.data.projectId) {
        emitPresence(socket.data.projectId);
      }
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
