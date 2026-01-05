import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Vaults from "./pages/Vaults";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout Route */}
        <Route path="/" element={<AppLayout />}>
          {/* Pages rendered inside <Outlet /> */}
          <Route index element={<Home />} />
          <Route path="vaults" element={<Vaults />} />
          <Route path="activity" element={<Activity />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
