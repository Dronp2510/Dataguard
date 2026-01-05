import { NavLink } from "react-router-dom";

const navItemClass = ({ isActive }) =>
  `block px-3 py-2 rounded transition ${
    isActive
      ? "bg-slate-800 text-white font-semibold"
      : "text-gray-300 hover:bg-slate-800 hover:text-white"
  }`;

function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-10">🛡️ DataGuard</h1>

      <nav className="space-y-4">
        <NavLink to="/" end className={navItemClass}>
          Home
        </NavLink>

        <NavLink to="/vaults" className={navItemClass}>
          All Vaults
        </NavLink>

        <NavLink to="/activity" className={navItemClass}>
          My Activity
        </NavLink>

        <NavLink to="/settings" className={navItemClass}>
          Settings
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
