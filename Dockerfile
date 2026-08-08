FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_SYNC_ARGS="--extra api --extra postgres --extra neo4j --extra llama-index --extra fastembed --extra ollama --extra mistral --extra groq --extra anthropic"

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY README.md pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync $UV_SYNC_ARGS --frozen --no-install-project --no-dev --no-editable

COPY cognee ./cognee
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync $UV_SYNC_ARGS --frozen --no-dev --no-editable


FROM python:3.12-slim-bookworm AS runtime

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 cognee \
    && adduser --system --uid 1001 --gid 1001 --home /home/cognee cognee \
    && mkdir -p /data \
    && chown cognee:cognee /data

WORKDIR /app

COPY --from=builder --chown=cognee:cognee /app /app
COPY --chown=cognee:cognee entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

USER cognee

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
