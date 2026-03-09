import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getMasterKey } from "../utils/keyStore";
import { decryptFile, decryptFileKey, gzipDecompressArrayBuffer } from "../utils/crypto";
import { apiFetch } from "../utils/api";
import mammoth from "mammoth";

function isDocxMime(mimeType) {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isTextMime(mimeType) {
  return mimeType.startsWith("text/");
}

function isVideoMime(mimeType) {
  return mimeType.startsWith("video/");
}

function FilePreviewModal({ file, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mimeType, setMimeType] = useState("");
  const [docxHtml, setDocxHtml] = useState("");
  const [textPreview, setTextPreview] = useState("");

  useEffect(() => {
    if (!file) return;
    let active = true;
    let nextPreviewUrl = null;

    const loadAndDecrypt = async () => {
      try {
        const masterKey = getMasterKey();
        if (!masterKey) {
          alert("Session expired. Please login again.");
          return;
        }

        // 1) Get metadata
        const metaRes = await apiFetch(`/vault/files/${file.id}/download`);
        const metaData = await metaRes.json();

        const { mime_type, iv, encrypted_key, key_iv, is_compressed, compression_algo } = metaData.metadata;

        // 2) Download encrypted blob
        const blobRes = await apiFetch(metaData.download_url);
        const encryptedBuffer = await blobRes.arrayBuffer();

        // 3) Decrypt file key
        const fileKey = await decryptFileKey(encrypted_key, key_iv, masterKey);

        // 4) Decrypt file
        const decryptedBuffer = await decryptFile(encryptedBuffer, iv, fileKey);
        const normalizedBuffer =
          is_compressed && compression_algo === "gzip"
            ? await gzipDecompressArrayBuffer(decryptedBuffer)
            : decryptedBuffer;

        // 5) Create preview URL
        const blob = new Blob([normalizedBuffer], { type: mime_type });
        if (isDocxMime(mime_type)) {
          const rendered = await mammoth.convertToHtml({ arrayBuffer: normalizedBuffer });
          if (!active) return;
          setDocxHtml(rendered.value || "<p>Unable to render DOCX preview.</p>");
          setTextPreview("");
        } else if (isTextMime(mime_type)) {
          const text = new TextDecoder("utf-8").decode(normalizedBuffer);
          if (!active) return;
          setTextPreview(text);
          setDocxHtml("");
        } else if (active) {
          setDocxHtml("");
          setTextPreview("");
        }
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
      } catch {
        if (!active) return;
        alert("Could not decrypt or decompress this file.");
        return;
      }
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
  const isDocx = isDocxMime(mimeType);
  const isText = isTextMime(mimeType);
  const isVideo = isVideoMime(mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex h-[92dvh] w-[95vw] max-w-5xl flex-col bg-white shadow-lg md:h-[90vh] md:rounded-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="truncate pr-3 font-semibold">{file.name}</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {previewUrl && isImage && (
            <div className="flex h-full w-full items-center justify-center overflow-hidden bg-black p-2">
              <img
                src={previewUrl}
                alt={file.name}
                className="block h-full w-full object-contain"
              />
            </div>
          )}
          {previewUrl && isPdf && (
            <object data={previewUrl} type="application/pdf" className="h-full w-full">
              <iframe src={previewUrl} title="File Preview" className="h-full w-full" />
            </object>
          )}
          {previewUrl && isDocx && (
            <div className="h-full w-full overflow-auto bg-white p-6">
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </div>
          )}
          {previewUrl && isText && (
            <div className="h-full w-full overflow-auto bg-white p-6">
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-900">{textPreview}</pre>
            </div>
          )}
          {previewUrl && isVideo && (
            <div className="h-full w-full bg-black">
              <video src={previewUrl} controls className="h-full w-full" />
            </div>
          )}
          {previewUrl && !isImage && !isPdf && !isDocx && !isText && !isVideo && (
            <iframe src={previewUrl} title="File Preview" className="h-full w-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;
