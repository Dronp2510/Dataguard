import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getMasterKey } from "../utils/keyStore";
import { decryptFileKey, decryptFile } from "../utils/crypto";
import { apiFetch } from "../utils/api";

function FilePreviewModal({ file, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mimeType, setMimeType] = useState("");

  useEffect(() => {
    if (!file) return;
    let active = true;
    let nextPreviewUrl = null;

    const loadAndDecrypt = async () => {
      const masterKey = getMasterKey();
      if (!masterKey) {
        alert("Session expired. Please login again.");
        return;
      }

      // 1) Get metadata
      const metaRes = await apiFetch(`/vault/files/${file.id}/download`);
      const metaData = await metaRes.json();

      const { mime_type, iv, encrypted_key, key_iv } = metaData.metadata;

      // 2) Download encrypted blob
      const blobRes = await apiFetch(metaData.download_url);
      const encryptedBuffer = await blobRes.arrayBuffer();

      // 3) Decrypt file key
      const fileKey = await decryptFileKey(encrypted_key, key_iv, masterKey);

      // 4) Decrypt file
      const decryptedBuffer = await decryptFile(encryptedBuffer, iv, fileKey);

      // 5) Create preview URL
      const blob = new Blob([decryptedBuffer], { type: mime_type });
      const url = URL.createObjectURL(blob);
      nextPreviewUrl = url;
      if (!active) {
        URL.revokeObjectURL(url);
        return;
      }
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setMimeType(mime_type || "");
    };

    loadAndDecrypt();
    return () => {
      active = false;
      if (nextPreviewUrl) URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [file]);

  if (!file) return null;

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex h-[92dvh] w-[95vw] max-w-5xl flex-col bg-white shadow-lg md:h-[90vh] md:rounded-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="truncate pr-3 font-semibold">{file.name}</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="flex-1">
          {previewUrl && isImage && (
            <div className="h-full w-full overflow-auto bg-black">
              <img src={previewUrl} alt={file.name} className="mx-auto block h-auto max-w-full" />
            </div>
          )}
          {previewUrl && isPdf && (
            <object data={previewUrl} type="application/pdf" className="h-full w-full">
              <iframe src={previewUrl} title="File Preview" className="h-full w-full" />
            </object>
          )}
          {previewUrl && !isImage && !isPdf && <iframe src={previewUrl} title="File Preview" className="h-full w-full" />}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;
