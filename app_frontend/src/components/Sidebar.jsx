import { NavLink } from "react-router-dom";
import { Activity, FolderOpen, Home, Settings } from "lucide-react";
import DataGuardLogo from "./DataGuardLogo";

const items = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/vaults", label: "My Vaults", icon: FolderOpen },
  { to: "/app/activity", label: "My Activity", icon: Activity },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function Sidebar({ collapsed = false, mobileOpen = false, onClose }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-slate-800 bg-gradient-to-b from-slate-900 via-blue-900 to-blue-700 text-white shadow-2xl transition-all duration-300 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-200">
          <DataGuardLogo
            className="scale-[0.56]"
            iconColor="#DBEAFE"
            shieldSize={30}
            eyeSize={14}
            shieldStrokeWidth={2}
            eyeStrokeWidth={1.8}
          />
        </div>
        {!collapsed && <span className="text-lg font-semibold tracking-wide">DataGuard</span>}
      </div>

      <nav className="space-y-2 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `group flex items-center rounded-lg px-3 py-2.5 text-sm transition ${
                  collapsed ? "justify-center" : "gap-3"
                } ${
                  isActive
                    ? "bg-blue-600/20 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
