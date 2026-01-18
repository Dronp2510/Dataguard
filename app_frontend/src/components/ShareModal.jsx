import { X } from "lucide-react";

function ShareModal({ file, onClose }) {
  if (!file) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      {/* Modal box */}
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Share Document
          </h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* File info */}
        <div className="mb-4">
          <p className="text-sm text-gray-500">Document</p>
          <p className="font-medium">{file.name}</p>
        </div>

        {/* Share type */}
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">
            Share Method
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="shareType" defaultChecked />
              Link
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="shareType" />
              QR Code
            </label>
          </div>
        </div>

        {/* Expiry */}
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">
            Expiry Time
          </p>
          <select className="w-full border rounded-md px-3 py-2">
            <option>10 minutes</option>
            <option>30 minutes</option>
            <option>1 hour</option>
            <option>24 hours</option>
          </select>
        </div>

        {/* Action */}
        <button className="w-full bg-slate-900 text-white py-2 rounded-md hover:bg-slate-800">
          Generate Secure Share
        </button>
      </div>
    </div>
  );
}

export default ShareModal;
