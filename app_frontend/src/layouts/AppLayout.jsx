import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div
        className={`min-h-screen transition-[margin] duration-300 ${
          sidebarCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="p-4 md:p-8">
          <Outlet context={{ searchQuery }} />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
