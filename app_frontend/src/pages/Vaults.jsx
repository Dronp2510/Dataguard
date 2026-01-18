import { useState } from "react";
import { Folder, FileText, Share2, MoreVertical } from "lucide-react";
import ShareModal from "../components/ShareModal";
import AddItemModal from "../components/AddItemModal";

const mockItems = [
  { id: 1, type: "folder", name: "Identity Docs", modified: "3 days ago" },
  { id: 2, type: "folder", name: "Academic", modified: "1 week ago" },
  { id: 3, type: "file", name: "Aadhaar_Card.pdf", modified: "2 days ago" },
  { id: 4, type: "file", name: "PAN_Card.pdf", modified: "5 days ago" },
];

function Vaults() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const folders = mockItems.filter(i => i.type === "folder");
  const files = mockItems.filter(i => i.type === "file");

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
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">
                  Last modified: {item.modified}
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
