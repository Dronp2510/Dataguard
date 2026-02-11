function DeleteConfirmModal({ item, onClose, onDelete }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-96 p-6 space-y-4">
        <h2 className="text-xl font-semibold text-red-600">Delete Item</h2>

        <p className="text-gray-600">
          Are you sure you want to delete <b>{item.name}</b>?
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="px-4 py-2 rounded-md border"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 rounded-md bg-red-600 text-white"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
