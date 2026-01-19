import { Folder, FileText, Share2, MoreVertical } from "lucide-react";
import ShareModal from "../components/ShareModal";
import AddItemModal from "../components/AddItemModal";
import { useEffect, useState } from "react";


function Vaults() {
  const [items, setItems] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
  fetch("http://localhost:8000/vault/items")
    .then(res => res.json())
    .then(data => setItems(data))
    .catch(err => console.error("Failed to load vault items", err));

  }, []);

  const folders = items.filter(i => i.type === "folder");
  const files = items.filter(i => i.type === "file");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Your Vaults</h2>
        <button
          className="bg-slate-900 text-white px-4 py-2 rounded-md"
          onClick={() => setShowAddModal(true)}
        >
          + Add File
        </button>
      </div>

      {/* Vault list */}
      <div className="bg-white rounded-lg shadow-sm divide-y">
        {[...folders, ...files].map(item => (
          <div
            key={item.id}
            className="flex justify-between items-center px-6 py-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-4">
              {item.type === "folder" ? (
                <Folder className="text-yellow-500" />
              ) : (
                <FileText className="text-gray-500" />
              )}
              <div>
                <p className="font-medium">
                    {item.type === "folder" ? "Folder" : "Encrypted File"}
                    </p>
                <p className="text-sm text-gray-500">
                  Created: {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {item.type === "file" && (
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedFile(item)}>
                  <Share2 size={18} />
                </button>
                <MoreVertical size={18} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      <ShareModal
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />

      {showAddModal && (
        <AddItemModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

export default Vaults;
