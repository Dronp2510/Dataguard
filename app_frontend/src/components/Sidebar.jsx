function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-10">🛡️ DataGuard</h1>

      <nav className="space-y-4">
        <button className="block w-full text-left px-3 py-2 rounded hover:bg-slate-800">
          Home
        </button>
        <button className="block w-full text-left px-3 py-2 rounded hover:bg-slate-800">
          All Vaults
        </button>
        <button className="block w-full text-left px-3 py-2 rounded hover:bg-slate-800">
          My Activity
        </button>
        <button className="block w-full text-left px-3 py-2 rounded hover:bg-slate-800">
          Settings
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;
