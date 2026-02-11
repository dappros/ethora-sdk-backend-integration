#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${TEST_LOG_FILE:-test_output.log}"
LOG_DIR="$(dirname "$LOG_FILE")"

mkdir -p "$LOG_DIR"

{
  echo "=== Test run started: $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
  echo "Log file: $LOG_FILE"
  npm run build
  node --test test/*.test.js
  echo "=== Test run finished: $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
} 2>&1 | tee "$LOG_FILE"
