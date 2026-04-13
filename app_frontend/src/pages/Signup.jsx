import { Link } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "../utils/api";

function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="w-full lg:w-1/2 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col justify-center items-center px-6 py-10 lg:px-10">
        <h2 className="text-3xl font-bold mb-4">Welcome Back, Friend!</h2>
        <p className="text-center text-gray-300 mb-8">
          Store and share your data safely with DataGuard
        </p>
        <Link
          to="/login"
          className="border border-white px-8 py-2 rounded-full hover:bg-white hover:text-slate-900 transition"
        >
          LOG IN
        </Link>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-4 py-8 lg:px-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-8 text-center">
            Create Account
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
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-slate-900 px-4 py-3 pr-12 text-white placeholder-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md bg-slate-900 px-4 py-3 pr-12 text-white placeholder-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-white"
                aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                title={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button 
            className="w-full bg-slate-900 text-white py-3 rounded-full mt-6 hover:bg-slate-800 transition"
              onClick={async () => {
              if (password !== confirm) {
                alert("Passwords do not match");
                return;
              }

              const formData = new FormData();
              formData.append("email", email);
              formData.append("username", username);
              formData.append("password", password);

              const res = await apiFetch("/auth/signup", {
                method: "POST",
                body: formData,
              });


              const data = await res.json();

              if (res.ok) {
                alert("Signup successful. Please login.");
                navigate("/login");
              } else {
                alert(data.detail || "Signup failed");
              }
            }}>
              SIGN UP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
