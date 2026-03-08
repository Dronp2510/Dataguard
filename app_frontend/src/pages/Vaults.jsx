import { Folder, FileText, Share2, MoreVertical, ShieldCheck, Upload, FolderOpen } from "lucide-react";
import ShareModal from "../components/ShareModal";
import AddItemModal from "../components/AddItemModal";
import FilePreviewModal from "../components/FilePreviewModal";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import RenameModal from "../components/RenameModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { getMasterKey } from "../utils/keyStore";
import { apiFetch } from "../utils/api";

function Vaults() {
  const { searchQuery = "" } = useOutletContext() || {};
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renameItem, setRenameItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);

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
        setLoadingItems(true);
        const data = await fetchVaultItems(currentFolder?.id || null);
        if (active) setItems(data);
      } catch (err) {
        console.error("Failed to load vault items", err);
      } finally {
        if (active) setLoadingItems(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentFolder, ready]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => String(item.name || "").toLowerCase().includes(q));
  }, [items, searchQuery]);
  const fileCount = useMemo(() => filteredItems.filter((item) => item.type === "file").length, [filteredItems]);
  const folderCount = useMemo(() => filteredItems.filter((item) => item.type === "folder").length, [filteredItems]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 px-7 py-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Encrypted Vault</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">My Vaults</h2>
            <p className="mt-1 text-sm text-blue-100">Manage, preview, and share your protected files.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            onClick={() => setShowAddModal(true)}
          >
            <Upload size={16} />
            Add File
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Items in current view</p>
          <p className="text-2xl font-bold text-slate-900">{filteredItems.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Files</p>
          <p className="text-2xl font-bold text-slate-900">{fileCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Folders</p>
          <p className="text-2xl font-bold text-slate-900">{folderCount}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-visible">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FolderOpen size={16} />
            {currentFolder ? `Inside folder: ${currentFolder.name}` : "Root Vault"}
          </div>
          {currentFolder && (
            <button className="text-sm text-blue-700 hover:underline" onClick={() => setCurrentFolder(null)}>
              Back to root
            </button>
          )}
        </div>

        {loadingItems ? (
          <p className="px-6 py-6 text-sm text-gray-500">Loading vault items...</p>
        ) : filteredItems.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500">No files or folders found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  onClick={() => {
                    if (item.type === "folder") setCurrentFolder({ id: item.id, name: item.name });
                    else setPreviewFile(item);
                  }}
                >
                  <div className="rounded-lg bg-slate-100 p-2">
                    {item.type === "folder" ? (
                      <Folder className="text-amber-500" size={18} />
                    ) : (
                      <FileText className="text-blue-500" size={18} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{item.name}</p>
                    <p className="text-sm text-gray-500">Created: {new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                </button>

                <div className="flex items-center gap-3 relative">
                  {item.type === "file" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(item);
                      }}
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      title="Share file"
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
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {openMenuId === item.id && (
                      <div className="absolute bottom-full right-0 z-50 mb-2 w-32 rounded-md border bg-white shadow-md">
                        <button
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameItem(item);
                            setOpenMenuId(null);
                          }}
                        >
                          Rename
                        </button>

                        <button
                          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
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
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 p-4 text-sm text-slate-700">
        <div className="inline-flex items-center gap-2 font-medium text-slate-900">
          <ShieldCheck size={16} />
          Vault policy reminder
        </div>
        <p className="mt-1">Files are decrypted only in your browser and never exposed in plaintext to the server.</p>
      </section>

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
            const data = await fetchVaultItems(currentFolder?.id || null);
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
            const data = await fetchVaultItems(currentFolder?.id || null);
            setItems(data);
            setDeleteItem(null);
          }}
        />
      )}

      <ShareModal file={selectedFile} onClose={() => setSelectedFile(null)} />

      {showAddModal && (
        <AddItemModal
          parentFolderId={currentFolder?.id || null}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchVaultItems(currentFolder?.id || null).then((data) => {
              setItems(data);
              setShowAddModal(false);
            });
          }}
        />
      )}

      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

export default Vaults;
