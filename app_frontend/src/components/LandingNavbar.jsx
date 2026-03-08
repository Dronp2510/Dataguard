import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import DataGuardLogo from "../components/DataGuardLogo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "How It Works", href: "#how-it-works" },
];

function LandingNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={[
        "sticky top-0 z-50 h-[72px] w-full border-b border-gray-200 bg-white/70 backdrop-blur-md",
        "transition-all duration-[400ms] ease-out",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-[10px] opacity-0",
      ].join(" ")}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label="DataGuard Home"
          onClick={closeMobileMenu}
        >
          <DataGuardLogo />
          <span className="text-xl font-semibold tracking-wide text-slate-900">DataGuard</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative text-gray-600 transition-colors duration-300 hover:text-slate-900"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 bg-slate-900 transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-lg border border-gray-300 px-4 py-2 text-slate-700 transition hover:bg-gray-100"
          >
            Log In
          </Link>

          <Link
            to="/signup"
            className="rounded-lg bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-4 py-2 text-white transition duration-300 hover:scale-105 hover:shadow-lg"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={toggleMobileMenu}
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 transition hover:bg-gray-100 md:hidden"
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu size={22} />
        </button>
      </div>

      <div
        className={[
          "absolute left-0 top-[72px] w-full border-b border-gray-200 bg-white/95 backdrop-blur-md md:hidden",
          "transition-all duration-300 ease-out",
          isMobileMenuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4">
          {navLinks.map((link) => (
            <a
              key={`mobile-${link.href}`}
              href={link.href}
              className="text-gray-700 transition-colors duration-300 hover:text-slate-900"
              onClick={closeMobileMenu}
            >
              {link.label}
            </a>
          ))}

          <Link
            to="/login"
            onClick={closeMobileMenu}
            className="rounded-lg border border-gray-300 px-4 py-2 text-center text-slate-700 transition hover:bg-gray-100"
          >
            Log In
          </Link>

          <Link
            to="/signup"
            onClick={closeMobileMenu}
            className="rounded-lg bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-4 py-2 text-center text-white transition duration-300 hover:scale-[1.02] hover:shadow-lg"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default LandingNavbar;
