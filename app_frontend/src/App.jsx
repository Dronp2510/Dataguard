import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { useEffect, useState } from "react";
import { restoreMasterKey } from "./utils/keyStore";

import Home from "./pages/Home";
import Vaults from "./pages/Vaults";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      await restoreMasterKey();
      setReady(true);
    }
    init();
  }, []);

  // ⛔ DO NOT RENDER ROUTES UNTIL KEY RESTORES
  if (!ready) return null; // or loading spinner

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

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
