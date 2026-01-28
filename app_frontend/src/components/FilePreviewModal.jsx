import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getMasterKey } from "../utils/keyStore";
import { decryptFileKey, decryptFile } from "../utils/crypto";


function FilePreviewModal({ file, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) return;

    const loadAndDecrypt = async () => {
      const masterKey = getMasterKey();
      if (!masterKey) {
        alert("Session expired. Please login again.");
        return;
      }

      // 1️⃣ Get metadata
      const metaRes = await fetch(
        `http://localhost:8000/vault/files/${file.id}/download`
      );
      const metaData = await metaRes.json();

      const { filename, mime_type, iv, encrypted_key, key_iv } =
        metaData.metadata;

      // 2️⃣ Download encrypted blob
      const blobRes = await fetch(
        `http://localhost:8000${metaData.download_url}`
      );
      const encryptedBuffer = await blobRes.arrayBuffer();

      // 3️⃣ Decrypt file key
      const fileKey = await decryptFileKey(
        encrypted_key,
        key_iv,
        masterKey
      );

      // 4️⃣ Decrypt file
      const decryptedBuffer = await decryptFile(
        encryptedBuffer,
        iv,
        fileKey
      );

      // 5️⃣ Create preview URL
      const blob = new Blob([decryptedBuffer], { type: mime_type });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    };

    loadAndDecrypt();
  }, [file]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-lg shadow-lg flex flex-col">
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <h3 className="font-semibold">{file.name}</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="flex-1">
          {previewUrl && (
            <iframe
              src={previewUrl}
              title="File Preview"
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;