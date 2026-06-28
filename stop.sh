#!/bin/bash
# Stop Elias Web Console
if systemctl is-active elias-web &>/dev/null 2>&1; then
  echo "Stopping elias-web (systemd)..."
  sudo systemctl stop elias-web
else
  echo "Stopping elias-web..."
  pkill -f "tsx.*src/server.ts" 2>/dev/null
  pkill -f "cli.mjs.*src/server.ts" 2>/dev/null
  echo "elias-web stopped."
fi
