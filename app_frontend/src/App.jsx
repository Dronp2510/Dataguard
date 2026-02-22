import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { useEffect, useState } from "react";
import { restoreMasterKey } from "./utils/keyStore";
import { getAccessToken } from "./utils/session";

import Home from "./pages/Home";
import Vaults from "./pages/Vaults";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ShareAccess from "./pages/ShareAccess";
import Landing from "./pages/Landing";


function App() {
  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(Boolean(getAccessToken()));

  useEffect(() => {
    async function init() {
      await restoreMasterKey();
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    const syncAuth = () => setIsAuthed(Boolean(getAccessToken()));
    window.addEventListener("auth-changed", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth-changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={isAuthed ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/share/:token" element={<ShareAccess />} />

        
<Route path="/" element={<Landing />} />

<Route path="/app" element={isAuthed ? <AppLayout /> : <Navigate to="/login" replace />}>
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
