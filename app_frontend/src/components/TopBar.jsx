import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation } from "react-router-dom";
import UserDropdown from "./UserDropdown";

function TopBar({
  sidebarCollapsed = false,
  onToggleSidebar,
  onToggleMobileSidebar,
  searchQuery = "",
  onSearchChange = () => {},
}) {
  const location = useLocation();
  const title = location.pathname.includes("/vaults")
    ? "Vaults"
    : location.pathname.includes("/activity")
    ? "My Activity"
    : location.pathname.includes("/settings")
    ? "Settings"
    : "Dashboard";

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-3 md:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="inline-flex rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          title="Open sidebar"
        >
          <Menu size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:inline-flex rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <h2 className="text-base font-semibold text-gray-800 md:text-xl">{title}</h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="hidden rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:block"
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
