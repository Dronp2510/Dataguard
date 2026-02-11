import { Folder, FileText, Share2, MoreVertical } from "lucide-react";
import ShareModal from "../components/ShareModal";
import AddItemModal from "../components/AddItemModal";
import FilePreviewModal from "../components/FilePreviewModal";
import { useEffect, useState } from "react";
import { getUserId } from "../utils/session";
import RenameModal from "../components/RenameModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";




function Vaults() {
  const [items, setItems] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renameItem, setRenameItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchVaultItems = (parentId = null) => {

    const userId = getUserId();
    const url = parentId
      ? `http://localhost:8000/vault/items?parent_id=${parentId}&user_id=${userId}`
      : `http://localhost:8000/vault/items?user_id=${userId}`;

    fetch(url)
    .then(res => res.json())
    .then(data => setItems(data))
    .catch(err => console.error("Failed to load vault items", err));
};
  useEffect(() => {
  fetchVaultItems(currentFolderId);
  }, [currentFolderId]);

  const handleOpenFile = (file) => {
        setPreviewFile(file);
    };
  
    useEffect(() => {
  const handleClickOutside = () => {
    setOpenMenuId(null);
  };

  window.addEventListener("click", handleClickOutside);
  return () => window.removeEventListener("click", handleClickOutside);
}, []);


  const folders = items.filter(i => i.type === "folder");
  const files = items.filter(i => i.type === "file");
  const [previewFile, setPreviewFile] = useState(null);

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

      {currentFolderId && (
          <button
            className="text-sm text-blue-600"
            onClick={() => setCurrentFolderId(null)}
          >
            ← Back
          </button>
        )}

      {/* Vault list */}
      <div className="bg-white rounded-lg shadow-sm divide-y">
          {items.map((item) => (
  <div
    key={item.id}
    className="flex justify-between items-center px-6 py-4 hover:bg-gray-50"
  >
    {/* LEFT SIDE */}
    <div
      className="flex items-center gap-4 cursor-pointer"
      onClick={() => {
        if (item.type === "folder") {
          setCurrentFolderId(item.id);
        } else {
          handleOpenFile(item);
        }
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

    {/* RIGHT SIDE ACTIONS */}
    <div className="flex items-center gap-4 relative">
      {/* Share only for files */}
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

      {/* 3 Dots */}
      <div className="relative"
       onClick={(e) => e.stopPropagation()}
       >
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


      {/* Modals */}
      
      {renameItem && (
        <RenameModal
          item={renameItem}
          onClose={() => setRenameItem(null)}
          onRename={(newName) => {
            fetch(`http://localhost:8000/vault/items/${renameItem.id}/rename`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: `new_name=${encodeURIComponent(newName)}`,
            }).then(() => {
              fetchVaultItems(currentFolderId);
              setRenameItem(null);
            });
          }}
        />
      )}

      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDelete={() => {
            fetch(`http://localhost:8000/vault/items/${deleteItem.id}`, {
              method: "DELETE",
            }).then(() => {
              fetchVaultItems(currentFolderId);
              setDeleteItem(null);
            });
          }}
        />
      )}

      <ShareModal
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />

      {showAddModal && (
        <AddItemModal
          parentFolderId={currentFolderId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchVaultItems(currentFolderId);
            setShowAddModal(false);
          }}
        />
  )}

      {previewFile && (
          <FilePreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
    </div>
  );
}

export default Vaults;
