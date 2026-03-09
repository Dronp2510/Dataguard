import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMasterKey } from "../utils/keyStore";
import { encryptFile, encryptFileKey, generateFileKey, gzipCompressBlob, supportsCompressionStreams } from "../utils/crypto";
import { apiFetch } from "../utils/api";

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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}

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

  const compressionSupported = supportsCompressionStreams();
  const extension = getFileExtension(selectedFile?.name || "");
  const likelyUnhelpfulCompression = NON_COMPRESSIBLE_EXTENSIONS.has(extension);

  useEffect(() => {
    setCompressBeforeUpload(false);
    setCompressionBusy(false);
    setCompressionError("");
    setCompressedBlob(null);
  }, [selectedFile]);

  useEffect(() => {
    let active = true;
    const runCompression = async () => {
      if (!selectedFile || !compressBeforeUpload) return;
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
  }, [selectedFile, compressBeforeUpload, compressionSupported]);

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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Upload failed");
      }
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
            <input type="file" className="w-full" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />

            {selectedFile && (
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-slate-800">{selectedFile.name}</p>
                <p className="mt-1 text-gray-600">Original size: {formatBytes(selectedFile.size)}</p>
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
                    disabled={!compressionSupported || compressionBusy}
                    onChange={(e) => setCompressBeforeUpload(e.target.checked)}
                  />
                  <span>Compress before upload (gzip)</span>
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
                      </>
                    )}
                    {!compressionBusy && compressionError && <p className="text-red-600">{compressionError}</p>}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleUploadFile}
              disabled={!selectedFile || uploadBusy || compressionBusy}
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
