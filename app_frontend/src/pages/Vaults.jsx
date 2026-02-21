import { Folder, FileText, Share2, MoreVertical } from "lucide-react";
import ShareModal from "../components/ShareModal";
import AddItemModal from "../components/AddItemModal";
import FilePreviewModal from "../components/FilePreviewModal";
import { useEffect, useState } from "react";
import RenameModal from "../components/RenameModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { getMasterKey } from "../utils/keyStore";
import { apiFetch } from "../utils/api";

function Vaults() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renameItem, setRenameItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    const waitForKey = setInterval(() => {
      const key = getMasterKey();
      if (key) {
        setReady(true);
        clearInterval(waitForKey);
      }
    }, 50);
    return () => clearInterval(waitForKey);
  }, []);

  const fetchVaultItems = async (parentId = null) => {
    const query = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : "";
    const res = await apiFetch(`/vault/items${query}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  useEffect(() => {
    if (!ready) return;
    let active = true;
    (async () => {
      try {
        const data = await fetchVaultItems(currentFolderId);
        if (active) setItems(data);
      } catch (err) {
        console.error("Failed to load vault items", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentFolderId, ready]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Your Vaults</h2>
        <button
          className="bg-slate-900 text-white px-4 py-2 rounded-md"
          onClick={() => setShowAddModal(true)}
        >
          + Add File
        </button>
      </div>

      {currentFolderId && (
        <button
          className="text-sm text-blue-600"
          onClick={() => setCurrentFolderId(null)}
        >
          Back
        </button>
      )}

      <div className="bg-white rounded-lg shadow-sm divide-y">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center px-6 py-4 hover:bg-gray-50"
          >
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => {
                if (item.type === "folder") setCurrentFolderId(item.id);
                else setPreviewFile(item);
              }}
            >
              {item.type === "folder" ? (
                <Folder className="text-yellow-500" />
              ) : (
                <FileText className="text-gray-500" />
              )}

              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">
                  Created: {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative">
              {item.type === "file" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(item);
                  }}
                >
                  <Share2 size={18} />
                </button>
              )}

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === item.id ? null : item.id);
                  }}
                >
                  <MoreVertical size={18} />
                </button>

                {openMenuId === item.id && (
                  <div className="absolute right-0 mt-2 w-32 bg-white border rounded shadow-md z-50">
                    <button
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameItem(item);
                        setOpenMenuId(null);
                      }}
                    >
                      Rename
                    </button>

                    <button
                      className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteItem(item);
                        setOpenMenuId(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {renameItem && (
        <RenameModal
          item={renameItem}
          onClose={() => setRenameItem(null)}
          onRename={async (newName) => {
            await apiFetch(`/vault/items/${renameItem.id}/rename`, {
              method: "PUT",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `new_name=${encodeURIComponent(newName)}`,
            });
            const data = await fetchVaultItems(currentFolderId);
            setItems(data);
            setRenameItem(null);
          }}
        />
      )}

      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDelete={async () => {
            await apiFetch(`/vault/items/${deleteItem.id}`, { method: "DELETE" });
            const data = await fetchVaultItems(currentFolderId);
            setItems(data);
            setDeleteItem(null);
          }}
        />
      )}

      <ShareModal file={selectedFile} onClose={() => setSelectedFile(null)} />

      {showAddModal && (
        <AddItemModal
          parentFolderId={currentFolderId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchVaultItems(currentFolderId).then((data) => {
              setItems(data);
              setShowAddModal(false);
            });
          }}
        />
      )}

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}

export default Vaults;
