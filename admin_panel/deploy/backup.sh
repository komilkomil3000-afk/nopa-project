#!/bin/bash
# Nightly backup of everything that cannot be rebuilt from git:
#   1. the PostgreSQL database (chat texts, users, progress ...)  -> pg_dump, gzip
#   2. chat files (voices, photos, videos, documents)             -> tar.gz of CHAT_FILES_DIR
#   3. public uploads (covers, avatars, lesson media)             -> tar.gz of uploads/
#   4. the real .env (secrets; JWT secret signs file links)       -> copied into the encrypted archive
# Install on the BACKEND server (chmod +x), then:  crontab -e
#   30 3 * * * /home/ubuntu/nopa/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Settings (override with env vars in the crontab line or in /home/ubuntu/backup.env):
#   BACKUP_DIR        where archives go (default /home/ubuntu/backups). Better a different disk.
#   APP_DIR           deployed app (default /home/ubuntu/nopa)
#   CHAT_FILES_DIR    same value as the app's .env (default $APP_DIR/chat-files)
#   DB_CONTAINER      docker container of the database (default supabase-db). If the DB is
#                     reachable directly, set DATABASE_URL instead and pg_dump is used on the host.
#   BACKUP_GPG_RECIPIENT  gpg key id/email: archives are encrypted for it (strongly recommended)
#   BACKUP_PASSPHRASE_FILE  alternative: file holding a passphrase for symmetric gpg encryption
#   OFFSITE_TARGET    rsync destination of ANOTHER machine, e.g. backup@host:/srv/nopa-backups/
#                     (or an rclone remote like "rclone:remote:nopa"). Local-only backups die with the server.
#   KEEP_DAYS         how many days of daily backups to keep (default 14)
set -Eeuo pipefail
umask 077

[ -f /home/ubuntu/backup.env ] && . /home/ubuntu/backup.env

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
APP_DIR="${APP_DIR:-/home/ubuntu/nopa}"
CHAT_FILES_DIR="${CHAT_FILES_DIR:-$APP_DIR/chat-files}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F_%H%M)"
WORK="$BACKUP_DIR/$STAMP"

mkdir -p "$WORK"
trap 'rm -rf "$WORK"' ERR

echo "[$(date -Is)] backup start -> $WORK"

# 1. Database. --clean/--if-exists makes the dump restorable over an existing database.
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --clean --if-exists --no-owner "$DATABASE_URL" | gzip > "$WORK/db.sql.gz"
else
  docker exec "$DB_CONTAINER" pg_dump -U postgres --clean --if-exists --no-owner postgres | gzip > "$WORK/db.sql.gz"
fi
# A truncated dump is worse than none: it must at least decompress and contain the chat table
gzip -t "$WORK/db.sql.gz"
zcat "$WORK/db.sql.gz" | grep -q 'ChatMessage' || { echo "dump looks empty (no ChatMessage)"; exit 1; }

# 2 + 3. Files
[ -d "$CHAT_FILES_DIR" ] && tar -czf "$WORK/chat-files.tar.gz" -C "$CHAT_FILES_DIR" .
[ -d "$APP_DIR/uploads" ] && tar -czf "$WORK/uploads.tar.gz" -C "$APP_DIR/uploads" .

# 4. Secrets
[ -f "$APP_DIR/.env" ] && cp "$APP_DIR/.env" "$WORK/app.env"

# One archive per run, encrypted when a key is configured
ARCHIVE="$BACKUP_DIR/nopa_$STAMP.tar"
tar -cf "$ARCHIVE" -C "$WORK" .
rm -rf "$WORK"

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --batch --yes --trust-model always -r "$BACKUP_GPG_RECIPIENT" -o "$ARCHIVE.gpg" -e "$ARCHIVE"
  rm -f "$ARCHIVE"; ARCHIVE="$ARCHIVE.gpg"
elif [ -n "${BACKUP_PASSPHRASE_FILE:-}" ]; then
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" -o "$ARCHIVE.gpg" -c "$ARCHIVE"
  rm -f "$ARCHIVE"; ARCHIVE="$ARCHIVE.gpg"
else
  echo "WARNING: no BACKUP_GPG_RECIPIENT / BACKUP_PASSPHRASE_FILE set: this archive holds secrets and private chats UNENCRYPTED"
fi
chmod 600 "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"

# Copy to another machine
if [ -n "${OFFSITE_TARGET:-}" ]; then
  case "$OFFSITE_TARGET" in
    rclone:*) rclone copy "$ARCHIVE" "${OFFSITE_TARGET#rclone:}" ;;
    *)        rsync -a "$ARCHIVE" "$ARCHIVE.sha256" "$OFFSITE_TARGET" ;;
  esac
else
  echo "WARNING: OFFSITE_TARGET not set: the only copy is on this server"
fi

# Retention
find "$BACKUP_DIR" -maxdepth 1 -name 'nopa_*' -mtime "+$KEEP_DAYS" -delete

echo "[$(date -Is)] backup done: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
