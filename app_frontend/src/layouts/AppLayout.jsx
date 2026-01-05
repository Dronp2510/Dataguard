import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

function AppLayout() {
  return (
    <div className="flex">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Right side */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <TopBar />

        {/* Page Content */}
        <main className="flex-1 bg-gray-100 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
