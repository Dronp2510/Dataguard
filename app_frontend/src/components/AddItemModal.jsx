import { X } from "lucide-react";
import { useState } from "react";

const API_BASE = "http://localhost:8000"; // adjust if needed

function AddItemModal({ onClose, parentFolderId = null, onSuccess }) {
  const [mode, setMode] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState("");

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

    await fetch(`${API_BASE}/vault/folders`, {
      method: "POST",
      body: formData,
    });

    onSuccess?.();
    onClose();
  };

  // -------------------------
  // UPLOAD FILE
  // -------------------------
  const handleUploadFile = async (targetFolderId = null) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("encrypted_file", selectedFile); // NOT encrypted yet
    formData.append("filename", selectedFile.name);
    formData.append("mime_type", selectedFile.type || "application/octet-stream");
    formData.append("encrypted_key", "test-key");
    formData.append("iv", "test-iv");

    if (targetFolderId) {
      formData.append("parent_folder_id", targetFolderId);
    }

    await fetch(`${API_BASE}/vault/files`, {
      method: "POST",
      body: formData,
    });

    onSuccess?.();
    onClose();
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
              onClick={() => setMode("existing-folder")}
            >
              📂 Add file to existing folder
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

        {/* Add to existing folder */}
        {mode === "existing-folder" && (
          <div className="space-y-4">
            {/* TEMP: folder selection will be dynamic later */}
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Folder ID"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
            />

            <input
              type="file"
              className="w-full"
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />

            <button
              onClick={() => handleUploadFile(selectedFolder)}
              className="w-full bg-slate-900 text-white py-2 rounded-md"
            >
              Upload File
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
