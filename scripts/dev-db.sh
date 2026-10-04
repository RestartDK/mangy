#!/usr/bin/env bash
set -euo pipefail

DB_DIR="${MANGY_DB_DIR:-.mangy-postgres}"
PORT="${MANGY_DB_PORT:-5432}"
SOCKET="${MANGY_DB_SOCKET:-/tmp}"
DB_NAME="${MANGY_DB_NAME:-mangy}"

case "${1:-}" in
start)
  if [ ! -f "$DB_DIR/PG_VERSION" ]; then
    initdb -D "$DB_DIR" -U postgres --auth=trust >/dev/null
  fi
  pg_ctl -D "$DB_DIR" -o "-p $PORT -k $SOCKET" -l "$DB_DIR/postgres.log" start
  createdb -h "$SOCKET" -p "$PORT" -U postgres "$DB_NAME" 2>/dev/null || true
  ;;
stop)
  pg_ctl -D "$DB_DIR" stop
  ;;
status)
  pg_ctl -D "$DB_DIR" status
  ;;
*)
  echo "usage: $0 start|stop|status" >&2
  exit 1
  ;;
esac