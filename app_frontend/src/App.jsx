import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";

import Home from "./pages/Home";
import Vaults from "./pages/Vaults";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Main App Layout */}
        <Route path="/" element={<AppLayout />}>
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
