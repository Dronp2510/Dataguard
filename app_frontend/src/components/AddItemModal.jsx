import { X } from "lucide-react";
import { useState } from "react";

function AddItemModal({ onClose }) {
  const [mode, setMode] = useState(null);
  const [folderName, setFolderName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add to Vault</h3>
          <button onClick={onClose}><X /></button>
        </div>

        {/* Step 1: Choose action */}
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

        {/* Step 2A: Create folder */}
        {mode === "create-folder" && (
          <div className="space-y-4">
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <button className="w-full bg-slate-900 text-white py-2 rounded-md">
              Create Folder
            </button>
          </div>
        )}

        {/* Step 2B: Add to existing folder */}
        {mode === "existing-folder" && (
          <div className="space-y-4">
            <select className="w-full border rounded-md px-3 py-2">
              <option>Select folder</option>
              <option>Identity Docs</option>
              <option>Academic</option>
            </select>
            <input type="file" className="w-full" />
            <button className="w-full bg-slate-900 text-white py-2 rounded-md">
              Upload File
            </button>
          </div>
        )}

        {/* Step 2C: Direct file */}
        {mode === "direct-file" && (
          <div className="space-y-4">
            <input type="file" className="w-full" />
            <button className="w-full bg-slate-900 text-white py-2 rounded-md">
              Upload to Vault
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddItemModal;
