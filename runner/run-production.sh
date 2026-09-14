#!/usr/bin/env bash
set -euo pipefail
: "${EXECUTION_API_KEY:?EXECUTION_API_KEY is required}"
docker run --rm --name skillforge-runner \
  --network=none \
  --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=32m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --pids-limit=64 \
  --memory=768m \
  --cpus=1.0 \
  -e EXECUTION_API_KEY="$EXECUTION_API_KEY" \
  -p 127.0.0.1:8080:8080 \
  skillforge-runner:latest
