import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Settings,
  LogOut,
  Folder,
  Clock,
} from "lucide-react";
import { clearSession, getAccessToken, getUser, setUser } from "../utils/session";
import { clearMasterKey } from "../utils/keyStore";
import { apiFetch } from "../utils/api";

function formatDateTime(value) {
  if (!value) return "Not available";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Not available";
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function UserDropdown() {
  const [open, setOpen] = useState(false);
  const [user, setUserState] = useState(() => getUser());
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const syncUser = () => setUserState(getUser());
    window.addEventListener("auth-changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("auth-changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    if (!getAccessToken()) return;
    let active = true;

    (async () => {
      try {
        const res = await apiFetch("/auth/me");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !active) return;
        const nextUser = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          last_login: data.last_login,
          created_at: data.created_at,
          total_documents: data.total_documents ?? 0,
        };
        setUser(nextUser);
        setUserState(nextUser);
      } catch {
        // Keep previously cached user details.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold"
      >
        {user?.username?.[0]?.toUpperCase() || "U"}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed left-3 right-3 top-20 z-50 rounded-xl border border-gray-100 bg-white shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-72">
          
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
                {user?.total_documents ?? 0}
              </span>
            </div>

            <div className="flex items-center text-sm text-gray-700">
              <Clock className="w-4 h-4 mr-2 text-slate-500" />
              Last Login:
              <span className="ml-auto text-gray-600">
                {formatDateTime(user?.last_login)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              className="flex items-center w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100"
              onClick={() => {
                setOpen(false);
                navigate("/app/profile");
              }}
            >
              <User className="w-4 h-4 mr-2" />
              View Profile
            </button>

            <button
              className="flex items-center w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100"
              onClick={() => {
                setOpen(false);
                navigate("/app/settings");
              }}
            >
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
