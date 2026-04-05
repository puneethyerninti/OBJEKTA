# ── Stage 1: Build frontend ──────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Stage 2: Backend + serve static ─────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install backend deps
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/dist ./dist

# Ensure upload directories exist
RUN mkdir -p backend/uploads/marketplace/thumbnails backend/uploads/scenes backend/uploads/thumbnails backend/uploads/tus

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start backend (which also serves static /dist if configured)
ENV NODE_ENV=production
CMD ["node", "backend/server.js"]
