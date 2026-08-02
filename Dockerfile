# ── Build stage ──────────────────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Build toolchain (only needed for building native extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    git \
    cmake \
    clang \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (layer cache: pyproject + lock first)
COPY README.md pyproject.toml uv.lock entrypoint.sh ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --extra api --extra postgres --extra neo4j --extra llama-index \
    --extra fastembed --extra ollama --extra mistral --extra groq --extra anthropic \
    --frozen --no-install-project --no-dev --no-editable

# Copy source and install
COPY ./cognee /app/cognee
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --extra api --extra postgres --extra neo4j --extra llama-index \
    --extra fastembed --extra ollama --extra mistral --extra groq --extra anthropic \
    --frozen --no-dev --no-editable

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user with a real home directory (avoids /nonexistent fallback)
RUN addgroup --system --gid 1001 cognee \
    && adduser --system --uid 1001 --gid 1001 --home /home/cognee cognee \
    && mkdir -p /home/cognee && chown cognee:cognee /home/cognee

# Data directory for uploaded files — mount a volume here in production
RUN mkdir -p /data && chown cognee:cognee /data

WORKDIR /app

# Copy artifacts from builder
COPY --from=builder --chown=cognee:cognee /app /app

# Fix line endings and set executable
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV ENV=production

USER cognee

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
