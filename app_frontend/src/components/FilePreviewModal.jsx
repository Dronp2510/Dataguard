import { X } from "lucide-react";

function FilePreviewModal({ file, onClose }) {
  if (!file) return null;

  const fileUrl = `http://localhost:8000/vault/files/${file.id}/blob`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <h3 className="font-semibold">{file.name}</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1">
          <iframe
            src={fileUrl}
            title="File Preview"
            className="w-full h-full"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end">
          <a
            href={fileUrl}
            download
            className="bg-slate-900 text-white px-4 py-2 rounded-md"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;
