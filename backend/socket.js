// backend/socket.js
const { Server } = require("socket.io");
const Project = require("./models/Project");
const User = require("./models/User");
const { registerMarketplaceEvents } = require("./socket/marketplace");
const { verifyAccessToken } = require("./middleware/authMiddleware");

let io = null;

function parseCookieToken(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== "string") return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith("objekta_token=")) {
      return decodeURIComponent(part.slice("objekta_token=".length));
    }
    if (part.startsWith("accessToken=")) {
      return decodeURIComponent(part.slice("accessToken=".length));
    }
  }
  return null;
}

function getSocketToken(handshake) {
  const fromAuth = handshake?.auth?.token;
  if (typeof fromAuth === "string" && fromAuth.trim()) return fromAuth.trim();

  const authHeader = handshake?.headers?.authorization || handshake?.headers?.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1] || null;
  }

  const fromCookie = parseCookieToken(handshake?.headers?.cookie);
  if (fromCookie) return fromCookie;

  const fromQuery = handshake?.query?.token;
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim();

  return null;
}

async function canAccessProject(projectId, userId) {
  try {
    if (!projectId || !userId) return false;
    const project = await Project.findById(projectId).select("user collaborators").lean();
    if (!project) return false;

    const uid = String(userId);
    const ownerId = project.user?._id ? String(project.user._id) : project.user ? String(project.user) : null;
    if (ownerId && ownerId === uid) return true;

    if (Array.isArray(project.collaborators)) {
      return project.collaborators.some((c) => {
        const cid = c?._id ? String(c._id) : String(c);
        return cid === uid;
      });
    }

    return false;
  } catch (err) {
    return false;
  }
}

function normalizeProjectId(input) {
  if (!input) return null;
  if (typeof input === "string") return input.trim() || null;
  if (typeof input === "object") {
    return (input.projectId || input.id || null)?.toString?.() || null;
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

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket.handshake);
      const decoded = verifyAccessToken(token);
      if (!decoded?.id) return next(new Error("Unauthorized"));

      const user = await User.findById(decoded.id).select("role suspended").lean();
      if (!user || user.suspended) return next(new Error("Unauthorized"));

      socket.data.userId = String(user._id);
      socket.data.userRole = user.role || "buyer";
      return next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected", socket.id);
    socket.data.projectId = null;
    socket.join(`user:${socket.data.userId}`);
    socket.join(`dashboard:${socket.data.userId}`);

    socket.on("join-dashboard", () => {
      socket.join(`dashboard:${socket.data.userId}`);
    });

    const joinProject = async (payload) => {
      const projectId = normalizeProjectId(payload);
      if (!projectId) return;

      const allowed = await canAccessProject(projectId, socket.data.userId);
      if (!allowed) {
        socket.emit("project:error", { projectId, message: "Forbidden" });
        return;
      }

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

    socket.on("project:update", async (payload) => {
      const projectId = normalizeProjectId(payload);
      if (!projectId) return;
      if (!socket.rooms.has(projectId)) return;
      const allowed = await canAccessProject(projectId, socket.data.userId);
      if (!allowed) return;
      socket.to(projectId).emit("project:patched", payload);
    });

    socket.on("project:patch", async (payload) => {
      const projectId = normalizeProjectId(payload);
      if (!projectId) return;
      if (!socket.rooms.has(projectId)) return;
      const allowed = await canAccessProject(projectId, socket.data.userId);
      if (!allowed) return;
      socket.to(projectId).emit("project:patched", payload);
    });

    socket.on("scene:push", async (payload) => {
      const projectId = normalizeProjectId(payload) || socket.data.projectId;
      if (!projectId) return;
      if (!socket.rooms.has(projectId)) return;
      const allowed = await canAccessProject(projectId, socket.data.userId);
      if (!allowed) return;
      socket.to(projectId).emit("scene:push", { ...payload, projectId });
    });

    socket.on("project_save_progress", async ({ projectId, progress }) => {
      const normalizedProjectId = normalizeProjectId(projectId || socket.data.projectId);
      if (!normalizedProjectId) return;
      if (!socket.rooms.has(normalizedProjectId)) return;
      const allowed = await canAccessProject(normalizedProjectId, socket.data.userId);
      if (!allowed) return;
      const safeProgress = Number(progress);
      if (!Number.isFinite(safeProgress)) return;
      io.to(normalizedProjectId).emit("project_save_progress", {
        projectId: normalizedProjectId,
        progress: Math.max(0, Math.min(1, safeProgress)),
      });
    });

    // ──── Marketplace events ────
    registerMarketplaceEvents(io, socket, { userId: socket.data.userId, userRole: socket.data.userRole });

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
