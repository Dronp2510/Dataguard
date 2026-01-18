import { useState } from "react";
import { Share2, MoreVertical, FileText } from "lucide-react";
import ShareModal from "../components/ShareModel";

const mockVaults = [
  { id: 1, name: "Aadhaar_Card.pdf", modified: "2 days ago" },
  { id: 2, name: "PAN_Card.pdf", modified: "5 days ago" },
  { id: 3, name: "Result_Sem7.pdf", modified: "1 week ago" },
];

function Vaults() {
  const [selectedFile, setSelectedFile ] = useState(null);
  return(
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Your Vaults</h2>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800">
          + Add File
        </button>
      </div>

      {/* Vault list */}
      <div className="bg-white rounded-lg shadow-sm divide-y">
        {mockVaults.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
          >
            {/* Left */}
            <div className="flex items-center gap-4">
              <FileText className="text-gray-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  Last modified: {file.modified}
                </p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-4">
              <button className="p-2 rounded hover:bg-gray-100" onClick={() => setSelectedFile(file)} >
              <Share2 size={18} />
              </button>

              <button className="p-2 rounded hover:bg-gray-100">
                <MoreVertical size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <ShareModal file={selectedFile} onClose={() => setSelectedFile(null)}/>
    </div>
  
  );
}

export default Vaults;
