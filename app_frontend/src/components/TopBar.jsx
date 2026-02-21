import { Bell } from "lucide-react";
import UserDropdown from "./UserDropdown";

function TopBar() {
  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
      {/* Left */}
      <h2 className="text-xl font-semibold text-gray-800">
        Dashboard
      </h2>

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
