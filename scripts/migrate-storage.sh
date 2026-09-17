#!/usr/bin/env bash
# Binosoz.tj — migrate storage files from Lovable Cloud to self-hosted VPS Supabase
# Requires rclone and S3-compatible credentials for the source bucket.
# Run as root on the VPS.
set -euo pipefail

SOURCE_REMOTE="${1:-lovable}"
DEST_DIR="/opt/supabase/volumes/storage"
BUCKETS=(
  "customer-passports"
  "warehouse-docs"
  "worker-faces"
  "construction-photos"
  "contract-templates"
  "project-covers"
  "receipt-documents"
  "passport-documents"
)

echo "==> Checking rclone"
if ! command -v rclone &>/dev/null; then
  echo "Installing rclone..."
  apt-get update && apt-get install -y rclone
fi

echo "==> Ensure destination storage directory exists"
mkdir -p "$DEST_DIR"

for bucket in "${BUCKETS[@]}"; do
  echo "==> Migrating bucket: $bucket"
  if rclone ls "$SOURCE_REMOTE:$bucket" &>/dev/null; then
    rclone copy "$SOURCE_REMOTE:$bucket" "$DEST_DIR/$bucket" --transfers 16 --progress
  else
    echo "    Bucket $bucket not found in source remote; creating empty directory."
    mkdir -p "$DEST_DIR/$bucket"
  fi
done

echo ""
echo "================================================="
echo " Storage migration complete."
echo " Next: restart Supabase storage service if needed."
echo "================================================="
