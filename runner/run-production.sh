#!/usr/bin/env bash
set -euo pipefail

: "${EXECUTION_API_KEY:?EXECUTION_API_KEY is required}"

IMAGE="${RUNNER_IMAGE:-skillforge-runner:latest}"
PORT="${RUNNER_PORT:-8080}"

exec docker run --rm --name "skillforge-runner-${RANDOM}" \
  --user 10001:10001 \
  --network=none \
  --ipc=none \
  --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=32m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --pids-limit=64 \
  --memory=768m \
  --memory-swap=768m \
  --cpus=1.0 \
  --ulimit nofile=64:64 \
  --ulimit nproc=16:16 \
  -e EXECUTION_API_KEY="$EXECUTION_API_KEY" \
  -e PYTHONNOUSERSITE=1 \
  -p "127.0.0.1:${PORT}:8080" \
  "$IMAGE"
