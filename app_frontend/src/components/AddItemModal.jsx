import { X } from "lucide-react";
import { useState } from "react";
import { getMasterKey } from "../utils/keyStore";
import {
  generateFileKey,
  encryptFile,
  encryptFileKey,
} from "../utils/crypto";
import { apiFetch } from "../utils/api";


function AddItemModal({ onClose, parentFolderId = null, onSuccess }) {
  const [mode, setMode] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);


  // -------------------------
  // CREATE FOLDER
  // -------------------------
  const handleCreateFolder = async () => {
    if (!folderName) return;

    const formData = new FormData();
    formData.append("name", folderName);
    if (parentFolderId) {
      formData.append("parent_id", parentFolderId);
    }

    await apiFetch("/vault/folders", {
      method: "POST",
      body: formData,
    });

    onSuccess?.();
//     onClose();
  };

  // -------------------------
  // UPLOAD FILE
  // -------------------------
  const handleUploadFile = async () => {
  if (!selectedFile) return;

  const masterKey = getMasterKey();

  if (!masterKey) {
    alert("Encryption key missing. Please login again.");
    return;
  }

  // 🔐 Step 1: Generate per-file key
  const fileKey = await generateFileKey();

  // 🔐 Step 2: Encrypt file
  const { encryptedBuffer, iv } = await encryptFile(selectedFile, fileKey);

  // 🔐 Step 3: Encrypt file key using master key
  const { encryptedKey, keyIv } = await encryptFileKey(fileKey, masterKey);

  // Convert encrypted buffer to Blob for upload
  const encryptedBlob = new Blob([encryptedBuffer]);

  const formData = new FormData();
  formData.append("encrypted_file", encryptedBlob);
  formData.append("filename", selectedFile.name);
  formData.append("mime_type", selectedFile.type || "application/octet-stream");
  formData.append("encrypted_key", encryptedKey);
  formData.append("iv", iv);
  formData.append("key_iv", keyIv);
  if (parentFolderId) {
    formData.append("parent_folder_id", parentFolderId);
  }

  await apiFetch("/vault/files", {
    method: "POST",
    body: formData,
  });

  onSuccess?.();
};


  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add to Vault</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* Step 1 */}
        {!mode && (
          <div className="space-y-3">
            <button
              className="w-full border rounded-md p-3 text-left hover:bg-gray-50"
              onClick={() => setMode("create-folder")}
            >
              📁 Create new folder
            </button>

            <button
              className="w-full border rounded-md p-3 text-left hover:bg-gray-50"
              onClick={() => setMode("direct-file")}
            >
              📄 Add file directly to vault
            </button>
          </div>
        )}

        {/* Create folder */}
        {mode === "create-folder" && (
          <div className="space-y-4">
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <button
              onClick={handleCreateFolder}
              className="w-full bg-slate-900 text-white py-2 rounded-md"
            >
              Create Folder
            </button>
          </div>
        )}

        {/* Direct file */}
        {mode === "direct-file" && (
          <div className="space-y-4">
            <input
              type="file"
              className="w-full"
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />
            <button
              onClick={() => handleUploadFile(null)}
              className="w-full bg-slate-900 text-white py-2 rounded-md"
            >
              Upload to Vault
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddItemModal;
