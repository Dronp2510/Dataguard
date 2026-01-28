import { Link } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSession } from "../utils/session";


function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="w-1/2 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col justify-center items-center px-10">
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
      <div className="w-1/2 flex items-center justify-center bg-gray-50">
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

              const res = await fetch("http://localhost:8000/auth/login", {
                method: "POST",
                body: formData,
              });


            const data = await res.json();

            if (res.ok) {
              setSession({
                user_id: data.user_id,
                salt: data.salt,
              });

              navigate("/vaults");
            } else {
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
