import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMasterKey } from "../utils/keyStore";
import { encryptFile, encryptFileKey, generateFileKey, gzipCompressBlob, supportsCompressionStreams } from "../utils/crypto";
import { apiFetch } from "../utils/api";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_STORAGE_QUOTA_BYTES,
  estimateEncryptedSize,
  formatBytes,
} from "../utils/storage";

const NON_COMPRESSIBLE_EXTENSIONS = new Set([
  "zip",
  "rar",
  "7z",
  "gz",
  "bz2",
  "xz",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "mp4",
  "mkv",
  "mov",
  "mp3",
  "wav",
  "pdf",
]);

function getFileExtension(filename = "") {
  const idx = filename.lastIndexOf(".");
  if (idx < 0 || idx === filename.length - 1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

function AddItemModal({ onClose, parentFolderId = null, onSuccess }) {
  const [mode, setMode] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [compressBeforeUpload, setCompressBeforeUpload] = useState(false);
  const [compressionBusy, setCompressionBusy] = useState(false);
  const [compressionError, setCompressionError] = useState("");
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [storageSummary, setStorageSummary] = useState(null);
  const [storageError, setStorageError] = useState("");

  const compressionSupported = supportsCompressionStreams();
  const extension = getFileExtension(selectedFile?.name || "");
  const likelyUnhelpfulCompression = NON_COMPRESSIBLE_EXTENSIONS.has(extension);
  const maxUploadBytes = storageSummary?.max_upload_bytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const storageQuotaBytes = storageSummary?.storage_quota_bytes ?? DEFAULT_STORAGE_QUOTA_BYTES;
  const remainingStorageBytes = storageSummary?.remaining_storage_bytes ?? storageQuotaBytes;
  const usedStorageBytes = storageSummary?.used_storage_bytes ?? 0;
  const requiresCompression = Boolean(selectedFile) && estimateEncryptedSize(selectedFile.size) > maxUploadBytes;
  const cannotAutoCompressPractically = requiresCompression && likelyUnhelpfulCompression;

  useEffect(() => {
    setCompressBeforeUpload(false);
    setCompressionBusy(false);
    setCompressionError("");
    setCompressedBlob(null);
  }, [selectedFile]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/vault/storage");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || "Failed to load storage details");
        }
        if (!active) return;
        setStorageSummary(data);
        setStorageError("");
      } catch (err) {
        if (!active) return;
        setStorageError(err.message || "Failed to load storage details");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    if (cannotAutoCompressPractically) {
      setCompressBeforeUpload(false);
      setCompressedBlob(null);
      setCompressionError("This file is already in a compressed media/archive format and is above the 1.5 GB upload limit. Upload is not allowed.");
      return;
    }
    if (!requiresCompression) return;
    if (!compressionSupported) {
      setCompressionError("This file exceeds the 1.5 GB upload limit and cannot be auto-compressed in this browser.");
      return;
    }
    setCompressBeforeUpload(true);
  }, [selectedFile, requiresCompression, compressionSupported, cannotAutoCompressPractically]);

  useEffect(() => {
    let active = true;
    const runCompression = async () => {
      if (!selectedFile || !compressBeforeUpload) return;
      if (cannotAutoCompressPractically) return;
      if (!compressionSupported) {
        setCompressionError("Compression is not supported in this browser.");
        return;
      }
      setCompressionBusy(true);
      setCompressionError("");
      try {
        const result = await gzipCompressBlob(selectedFile);
        if (!active) return;
        setCompressedBlob(result);
        if (estimateEncryptedSize(result.size) > maxUploadBytes) {
          setCompressionError("Compressed file is still above the 1.5 GB upload limit.");
        }
      } catch {
        if (!active) return;
        setCompressionError("Could not compress this file.");
        setCompressBeforeUpload(false);
        setCompressedBlob(null);
      } finally {
        if (active) setCompressionBusy(false);
      }
    };
    runCompression();
    return () => {
      active = false;
    };
  }, [selectedFile, compressBeforeUpload, compressionSupported, maxUploadBytes, cannotAutoCompressPractically]);

  const compressionStats = useMemo(() => {
    if (!selectedFile || !compressedBlob) return null;
    const originalSize = selectedFile.size;
    const compressedSize = compressedBlob.size;
    const delta = originalSize - compressedSize;
    const ratio = originalSize > 0 ? (delta / originalSize) * 100 : 0;
    return {
      originalSize,
      compressedSize,
      savedBytes: delta,
      savedPercent: ratio,
    };
  }, [selectedFile, compressedBlob]);

  const estimatedUploadBytes = useMemo(() => {
    if (!selectedFile) return null;
    if (!compressBeforeUpload) return estimateEncryptedSize(selectedFile.size);
    if (!compressedBlob) return null;
    return estimateEncryptedSize(compressedBlob.size);
  }, [selectedFile, compressBeforeUpload, compressedBlob]);

  const compressedStillTooLarge = Boolean(compressBeforeUpload && compressedBlob) && estimatedUploadBytes > maxUploadBytes;
  const storageWouldOverflow = estimatedUploadBytes !== null && estimatedUploadBytes > remainingStorageBytes;
  const uploadBlocked =
    !selectedFile ||
    uploadBusy ||
    compressionBusy ||
    (requiresCompression && !compressBeforeUpload) ||
    cannotAutoCompressPractically ||
    compressedStillTooLarge ||
    storageWouldOverflow ||
    Boolean(compressionError && requiresCompression);

  const handleCreateFolder = async () => {
    if (!folderName) return;

    const formData = new FormData();
    formData.append("name", folderName);
    if (parentFolderId) formData.append("parent_id", parentFolderId);
    await apiFetch("/vault/folders", { method: "POST", body: formData });
    onSuccess?.();
  };

  const handleUploadFile = async () => {
    if (!selectedFile) return;
    if (uploadBusy) return;

    const masterKey = getMasterKey();
    if (!masterKey) {
      alert("Encryption key missing. Please login again.");
      return;
    }

    setUploadBusy(true);
    try {
      let sourceBlob = selectedFile;
      let isCompressed = false;
      let compressedSize = null;

      if (compressBeforeUpload) {
        const prepared = compressedBlob || (await gzipCompressBlob(selectedFile));
        sourceBlob = prepared;
        isCompressed = true;
        compressedSize = prepared.size;
      }

      const estimatedBytes = estimateEncryptedSize(sourceBlob.size);
      if (estimatedBytes > maxUploadBytes) {
        throw new Error("This file is above the 1.5 GB upload limit.");
      }
      if (estimatedBytes > remainingStorageBytes) {
        throw new Error("Not enough storage remaining in this account for this upload.");
      }

      const fileKey = await generateFileKey();
      const { encryptedBuffer, iv } = await encryptFile(sourceBlob, fileKey);
      const { encryptedKey, keyIv } = await encryptFileKey(fileKey, masterKey);

      const formData = new FormData();
      formData.append("encrypted_file", new Blob([encryptedBuffer]));
      formData.append("filename", selectedFile.name);
      formData.append("mime_type", selectedFile.type || "application/octet-stream");
      formData.append("encrypted_key", encryptedKey);
      formData.append("iv", iv);
      formData.append("key_iv", keyIv);
      formData.append("is_compressed", isCompressed ? "true" : "false");
      formData.append("compression_algo", isCompressed ? "gzip" : "");
      formData.append("original_filename", selectedFile.name);
      formData.append("original_size", String(selectedFile.size));
      if (compressedSize !== null) formData.append("compressed_size", String(compressedSize));
      if (parentFolderId) formData.append("parent_folder_id", parentFolderId);

      const res = await apiFetch("/vault/files", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Upload failed");
      }
      setStorageSummary((prev) => ({
        ...(prev || {}),
        ...data,
      }));
      onSuccess?.();
    } catch (err) {
      alert(err.message || "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add to Vault</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {!mode && (
          <div className="space-y-3">
            <button
              className="w-full rounded-md border p-3 text-left hover:bg-gray-50"
              onClick={() => setMode("create-folder")}
            >
              Create new folder
            </button>
            <button
              className="w-full rounded-md border p-3 text-left hover:bg-gray-50"
              onClick={() => setMode("direct-file")}
            >
              Add file directly to vault
            </button>
          </div>
        )}

        {mode === "create-folder" && (
          <div className="space-y-4">
            <input
              className="w-full rounded-md border px-3 py-2"
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <button onClick={handleCreateFolder} className="w-full rounded-md bg-slate-900 py-2 text-white">
              Create Folder
            </button>
          </div>
        )}

        {mode === "direct-file" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800">Storage usage</span>
                <span className="text-slate-600">
                  {formatBytes(usedStorageBytes)} / {formatBytes(storageQuotaBytes)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{ width: `${Math.min(100, storageQuotaBytes ? (usedStorageBytes / storageQuotaBytes) * 100 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Remaining: {formatBytes(remainingStorageBytes)}. Per-file limit: {formatBytes(maxUploadBytes)}.
              </p>
              {storageError && <p className="mt-2 text-xs text-red-600">{storageError}</p>}
            </div>

            <input type="file" className="w-full" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />

            {selectedFile && (
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-slate-800">{selectedFile.name}</p>
                <p className="mt-1 text-gray-600">Original size: {formatBytes(selectedFile.size)}</p>
                <p className="mt-1 text-gray-600">
                  Estimated encrypted upload size: {estimatedUploadBytes !== null ? formatBytes(estimatedUploadBytes) : "Preparing..."}
                </p>
                {requiresCompression && (
                  <p className="mt-1 text-xs text-blue-700">
                    {cannotAutoCompressPractically
                      ? "This file is above the 1.5 GB limit and this format is not suitable for automatic compression."
                      : "This file is above the 1.5 GB limit, so compression has been enabled automatically."}
                  </p>
                )}
                {likelyUnhelpfulCompression && (
                  <p className="mt-1 text-xs text-amber-700">
                    This file type is usually already compressed. Compression may not reduce size.
                  </p>
                )}
                {!compressionSupported && (
                  <p className="mt-1 text-xs text-red-600">Browser compression API is not available.</p>
                )}
                <label className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={compressBeforeUpload}
                    disabled={!compressionSupported || compressionBusy || requiresCompression || cannotAutoCompressPractically}
                    onChange={(e) => setCompressBeforeUpload(e.target.checked)}
                  />
                  <span>
                    {cannotAutoCompressPractically
                      ? "Automatic compression unavailable for this file type"
                      : requiresCompression
                      ? "Compression required for this file (gzip)"
                      : "Compress before upload (gzip)"}
                  </span>
                </label>
                {compressBeforeUpload && (
                  <div className="mt-2 text-xs text-gray-700">
                    {compressionBusy && <p>Compressing to estimate final size...</p>}
                    {!compressionBusy && compressionStats && (
                      <>
                        <p>Compressed size: {formatBytes(compressionStats.compressedSize)}</p>
                        <p>
                          Saved: {formatBytes(Math.max(0, compressionStats.savedBytes))} (
                          {Math.max(0, compressionStats.savedPercent).toFixed(1)}%)
                        </p>
                        <p>Estimated encrypted upload size: {formatBytes(estimateEncryptedSize(compressionStats.compressedSize))}</p>
                      </>
                    )}
                    {!compressionBusy && compressionError && <p className="text-red-600">{compressionError}</p>}
                  </div>
                )}
                {storageWouldOverflow && (
                  <p className="mt-2 text-xs text-red-600">
                    This upload exceeds the remaining account storage of {formatBytes(remainingStorageBytes)}.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleUploadFile}
              disabled={uploadBlocked}
              className="w-full rounded-md bg-slate-900 py-2 text-white disabled:opacity-60"
            >
              {uploadBusy ? "Uploading..." : "Upload to Vault"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddItemModal;
