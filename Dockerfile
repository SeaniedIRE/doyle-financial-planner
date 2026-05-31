# ─────────────────────────────────────────────────────────────────────────────
# Doyle Financial Planner — All-In-One Image
# Contains: nginx (serves React SPA) + uvicorn (FastAPI) + SQLite
# One container = one Unraid install = one "Check for Updates" button
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ .
RUN npm run build

# Stage 2: Final all-in-one image
FROM python:3.12-slim

LABEL org.opencontainers.image.title="Doyle Financial Planner"
LABEL org.opencontainers.image.description="Private Canadian financial planning for the Doyle family"
LABEL org.opencontainers.image.source="https://github.com/SeaniedIRE/doyle-financial-planner"
LABEL org.opencontainers.image.licenses="Private"

# Install nginx and supervisor
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/app ./app
COPY backend/alembic.ini .
COPY backend/alembic ./alembic

# Copy built React frontend
COPY --from=frontend-builder /build/dist /app/static

# Copy nginx config
COPY nginx/app.conf /etc/nginx/sites-enabled/default
RUN rm -f /etc/nginx/sites-enabled/default.conf 2>/dev/null || true

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/app.conf

# Create data dir and backups dir (will be volume-mounted from host)
RUN mkdir -p /app/data/backups

# Startup script — backs up DB then runs migrations then starts supervisor
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
