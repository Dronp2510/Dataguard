import { Link } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSession, setUser } from "../utils/session";
import { deriveMasterKey } from "../utils/crypto";
import { setMasterKey } from "../utils/keyStore";
import { apiFetch } from "../utils/api";



function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="w-full lg:w-1/2 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col justify-center items-center px-6 py-10 lg:px-10">
        <h2 className="text-3xl font-bold mb-4">Hello, Friend!</h2>
        <p className="text-center text-gray-300 mb-8">
          Store and share your data safely with DataGuard
        </p>
        <Link
          to="/signup"
          className="border border-white px-8 py-2 rounded-full hover:bg-white hover:text-slate-900 transition"
        >
          SIGN UP
        </Link>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-4 py-8 lg:px-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-8 text-center">
            Log In To DataGuard
          </h1>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <p className="text-sm text-gray-500 text-right cursor-pointer">
              Forgot Your Password?
            </p>

            <button 
            className="w-full bg-slate-900 text-white py-3 rounded-full mt-6 hover:bg-slate-800 transition"
            onClick={async () => {
              const formData = new FormData();
              formData.append("email", email);
              formData.append("password", password);

              const res = await apiFetch("/auth/login", {
                method: "POST",
                body: formData,
              });


            const data = await res.json();

            if (res.ok) {
                setUser({
                  user_id: data.user_id,
                  username: data.username,
                  email: data.email,
                  last_login: data.last_login,
                  total_documents: 0,
                  used_storage_bytes: 0,
                  storage_quota_bytes: 15 * 1024 * 1024 * 1024,
                  remaining_storage_bytes: 15 * 1024 * 1024 * 1024,
                });

                setSession({
                  user_id: data.user_id,
                  salt: data.salt,
                  token: data.access_token,
                  expires_at: data.expires_at,
                });

              const masterKey = await deriveMasterKey(password, data.salt);
              setMasterKey(masterKey);

                navigate("/app");
            }else {
              alert(data.detail || "Login failed");
            }
          }}  >
              LOG IN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
