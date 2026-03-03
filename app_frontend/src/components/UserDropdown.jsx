import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Settings,
  LogOut,
  Folder,
  Clock,
} from "lucide-react";
import { clearSession } from "../utils/session";
import { clearMasterKey } from "../utils/keyStore";
import { apiFetch } from "../utils/api";

function UserDropdown() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const user = JSON.parse(
    sessionStorage.getItem("user") || localStorage.getItem("user") || "{}"
  );

  return (
    <div className="relative">
      {/* Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold"
      >
        {user?.username?.[0]?.toUpperCase() || "U"}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
          
          {/* User Info */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="font-semibold text-gray-800">
              {user?.username}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {user?.email}
            </p>
          </div>

          {/* Stats */}
          <div className="p-4 space-y-3 border-b border-gray-100">
            <div className="flex items-center text-sm text-gray-700">
              <Folder className="w-4 h-4 mr-2 text-slate-500" />
              Total Documents:
              <span className="ml-auto font-semibold">
                {user?.totalDocuments || 0}
              </span>
            </div>

            <div className="flex items-center text-sm text-gray-700">
              <Clock className="w-4 h-4 mr-2 text-slate-500" />
              Last Login:
              <span className="ml-auto text-gray-600">
                {user?.lastLogin}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button className="flex items-center w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100">
              <User className="w-4 h-4 mr-2" />
              View Profile
            </button>

            <button className="flex items-center w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>

            <button
              className="flex items-center w-full px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50"
              onClick={async () => {
                try {
                  await apiFetch("/auth/logout", { method: "POST" });
                } catch {
                  // Client cleanup should proceed even if request fails.
                }
                clearMasterKey();
                clearSession();
                navigate("/login");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDropdown;
