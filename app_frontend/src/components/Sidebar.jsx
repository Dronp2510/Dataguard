import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-10">🛡️ DataGuard</h1>

      <nav className="space-y-4">
        <NavLink
          to="/"
          className="block px-3 py-2 rounded hover:bg-slate-800"
        >
          Home
        </NavLink>

        <NavLink
          to="/vaults"
          className="block px-3 py-2 rounded hover:bg-slate-800"
        >
          All Vaults
        </NavLink>

        <NavLink
          to="/activity"
          className="block px-3 py-2 rounded hover:bg-slate-800"
        >
          My Activity
        </NavLink>

        <NavLink
          to="/settings"
          className="block px-3 py-2 rounded hover:bg-slate-800"
        >
          Settings
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
