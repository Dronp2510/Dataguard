import { useEffect, useState } from "react";
import { Folder, FileText, Share2 } from "lucide-react";
import { apiFetch } from "../utils/api";

function Home() {
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  async function loadRecent() {
    try {
      const res = await apiFetch("/vault/recent?limit=3");

      const data = await res.json();

      if (res.ok) {
        setRecent(data);
      }
    } catch (err) {
      console.error("Failed to load recent uploads:", err);
    } finally {
      setLoading(false);
    }
  }

  loadRecent();
}, []);


  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">Welcome, User 👋</h1>
        <p className="text-gray-500">
          View. Don’t Download. Never Leak.
        </p>
      </div>

      {/* Recent Uploads */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Uploads</h2>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {recent.map(item => (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  {item.type === "folder" ? (
                    <Folder className="text-yellow-500" size={20} />
                  ) : (
                    <FileText className="text-blue-500" size={20} />
                  )}

                  <span className="font-medium truncate w-32">
                    {item.name}
                  </span>
                </div>

                <Share2 size={16} className="text-gray-400 cursor-pointer" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-500">Total Documents</p>
          <h3 className="text-2xl font-bold">
            {recent.filter(r => r.type === "file").length}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-500">Active Sessions</p>
          <h3 className="text-2xl font-bold">3</h3>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-500">Security Alerts</p>
          <h3 className="text-2xl font-bold">0</h3>
        </div>
      </div>
    </div>
  );
}

export default Home;
