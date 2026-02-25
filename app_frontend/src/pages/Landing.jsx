import LandingNavbar from "../components/LandingNavbar";
import { Link } from "react-router-dom";
import { FileText, Key, Link as LinkIcon, Lock, Shield } from "lucide-react";

function Landing() {
  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <LandingNavbar />

      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-gradient-to-br from-[#1E3A8A]/10 via-white to-[#2563EB]/20">
        <div className="pointer-events-none absolute left-1/2 top-[-200px] h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-300/30 to-indigo-400/30 opacity-40 blur-3xl [animation:pulse_8s_ease-in-out_infinite]" />

        <Lock className="pointer-events-none absolute left-[7%] top-[18%] hidden text-slate-800/20 blur-sm [animation:floatY_8s_ease-in-out_infinite] md:block" size={44} />
        <FileText className="pointer-events-none absolute right-[9%] top-[20%] hidden text-slate-800/20 blur-sm [animation:floatY_6s_ease-in-out_infinite] md:block" size={42} />
        <Shield className="pointer-events-none absolute left-[12%] top-[54%] hidden text-slate-800/20 blur-sm [animation:floatY_10s_ease-in-out_infinite] md:block" size={48} />
        <LinkIcon className="pointer-events-none absolute right-[11%] top-[56%] hidden text-slate-800/20 blur-sm [animation:floatY_8s_ease-in-out_infinite] md:block" size={44} />
        <Key className="pointer-events-none absolute bottom-[12%] left-1/2 hidden -translate-x-1/2 text-slate-800/20 blur-sm [animation:floatY_6s_ease-in-out_infinite] md:block" size={42} />

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <h1 className="translate-y-4 text-5xl font-extrabold tracking-tight text-slate-900 opacity-0 [animation:fadeUp_700ms_ease-out_forwards] md:text-6xl">
            Your Private{" "}
            <span className="bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] bg-clip-text text-transparent">
              Digital Vault
            </span>
          </h1>

          <p className="mt-6 translate-y-4 mx-auto max-w-2xl text-lg text-gray-600 opacity-0 [animation:fadeUp_700ms_ease-out_150ms_forwards]">
            End-to-end encrypted document storage with zero-knowledge architecture.
          </p>

          <div className="mt-8 flex translate-y-4 flex-wrap justify-center gap-4 opacity-0 [animation:fadeUp_700ms_ease-out_300ms_forwards]">
            <Link
              to="/signup"
              className="rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-6 py-3 text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-gray-300 px-6 py-3 text-slate-700 transition hover:bg-gray-100"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      <style>
        {`
          @keyframes floatY {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }

          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
}

export default Landing;
