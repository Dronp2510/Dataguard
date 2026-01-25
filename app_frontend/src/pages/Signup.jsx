import { Link } from "react-router-dom";

function Signup() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="w-1/2 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col justify-center items-center px-10">
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
      <div className="w-1/2 flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-8 text-center">
            Create Account
          </h1>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <input
              type="text"
              placeholder="Username"
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <input
              type="password"
              placeholder="Re-enter Password"
              className="w-full px-4 py-3 rounded-md bg-slate-900 text-white placeholder-gray-400 focus:outline-none"
            />

            <button className="w-full bg-slate-900 text-white py-3 rounded-full mt-6 hover:bg-slate-800 transition">
              SIGN UP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
