import { useState } from "react";

function RenameModal({ item, onClose, onRename }) {
  const [newName, setNewName] = useState(item.name);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-96 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Rename</h2>

        <input
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="px-4 py-2 rounded-md border"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 rounded-md bg-slate-900 text-white"
            onClick={() => onRename(newName)}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

export default RenameModal;
