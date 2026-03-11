export const DEFAULT_MAX_UPLOAD_BYTES = (3 * 1024 * 1024 * 1024) / 2;
export const DEFAULT_STORAGE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024;
export const ENCRYPTION_OVERHEAD_BYTES = 16;

export function estimateEncryptedSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 0;
  return bytes + ENCRYPTION_OVERHEAD_BYTES;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}
