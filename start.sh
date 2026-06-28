#!/bin/bash
# Start Elias Web Console
cd "$(dirname "$0")"

if systemctl is-active elias-web &>/dev/null 2>&1; then
  echo "Restarting elias-web (systemd)..."
  sudo systemctl restart elias-web
else
  echo "Starting elias-web..."
  if command -v setsid &>/dev/null; then
    setsid npx tsx src/server.ts > elias-web.log 2>&1 &
  else
    nohup npx tsx src/server.ts > elias-web.log 2>&1 &
  fi
  sleep 2
  echo "elias-web started (PID $!)"
fi
