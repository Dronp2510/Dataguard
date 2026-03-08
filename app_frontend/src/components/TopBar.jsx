import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation } from "react-router-dom";
import UserDropdown from "./UserDropdown";

function TopBar({ sidebarCollapsed = false, onToggleSidebar }) {
  const location = useLocation();
  const title = location.pathname.includes("/vaults")
    ? "Vaults"
    : location.pathname.includes("/activity")
    ? "My Activity"
    : location.pathname.includes("/settings")
    ? "Settings"
    : "Dashboard";

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:inline-flex rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search documents..."
          className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Bell icon */}
        <button className="relative p-2 rounded-full hover:bg-gray-100">
          <Bell size={20} className="text-gray-600" />
          {/* notification dot */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User avatar */}
        <UserDropdown />
      </div>
    </header>
  );
}

export default TopBar;
