import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, Mail, User as UserIcon } from "lucide-react";
import { apiFetch } from "../utils/api";
import { deriveMasterKey } from "../utils/crypto";
import { setMasterKey } from "../utils/keyStore";
import { setSession, setUser } from "../utils/session";

const storageQuotaBytes = 15 * 1024 * 1024 * 1024;
const slideDurationMs = 500;
const signupDelayMs = 1000;

const panelCopy = {
  signup: {
    gradientTitle: "Welcome Back, Friend!",
    gradientSubtitle: "Store and share your data safely with DataGuard",
    switchLabel: "LOG IN",
    formTitle: "Create Account",
    submitLabel: "SIGN UP",
    helperText: "",
  },
  login: {
    gradientTitle: "Hello, Friend!",
    gradientSubtitle: "Store and share your data safely with DataGuard",
    switchLabel: "SIGN UP",
    formTitle: "Log In To DataGuard",
    submitLabel: "LOG IN",
    helperText: "Forgot your password?",
  },
};

function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeMode = location.pathname === "/signup" ? "signup" : "login";
  const [visualMode, setVisualMode] = useState(routeMode);
  const [email, setEmail] = useState(location.state?.email || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.message || "");
  const [submitting, setSubmitting] = useState(false);
  const transitionTimerRef = useRef(null);
  const signupTimerRef = useRef(null);
  const routeTimerRef = useRef(null);

  useEffect(() => {
    setVisualMode(routeMode);
    setError("");
    setPassword("");
    setConfirm("");
    if (location.state?.email) {
      setEmail(location.state.email);
    }
    if (routeMode === "login") {
      setSuccess(location.state?.message || "");
    } else if (!signupTimerRef.current) {
      setSuccess("");
    }
  }, [routeMode, location.state]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
      if (signupTimerRef.current) window.clearTimeout(signupTimerRef.current);
      if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current);
    };
  }, []);

  const isSignup = visualMode === "signup";
  const copy = panelCopy[visualMode];
  const isLoginRoute = routeMode === "login";
  const switchToMode = isSignup ? "login" : "signup";
  const SwitchIcon = isSignup ? ArrowRight : ArrowLeft;

  const cleanupTimers = () => {
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    if (signupTimerRef.current) window.clearTimeout(signupTimerRef.current);
    if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current);
    transitionTimerRef.current = null;
    signupTimerRef.current = null;
    routeTimerRef.current = null;
  };

  const handleModeSwitch = () => {
    if (submitting) return;
    cleanupTimers();
    setError("");
    setSuccess("");
    setVisualMode(switchToMode);
    transitionTimerRef.current = window.setTimeout(() => {
      navigate(`/${switchToMode}`, { replace: false });
    }, slideDurationMs);
  };

  const handleSignup = async () => {
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("username", username);
      formData.append("password", password);

      const res = await apiFetch("/auth/signup", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      setSuccess("Account created successfully.");
      signupTimerRef.current = window.setTimeout(() => {
        setVisualMode("login");
        routeTimerRef.current = window.setTimeout(() => {
          navigate("/login", {
            state: {
              message: "Account created successfully.",
              email,
            },
          });
        }, slideDurationMs);
      }, signupDelayMs);
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      setUser({
        user_id: data.user_id,
        username: data.username,
        email: data.email,
        last_login: data.last_login,
        total_documents: 0,
        used_storage_bytes: 0,
        storage_quota_bytes: storageQuotaBytes,
        remaining_storage_bytes: storageQuotaBytes,
      });

      setSession({
        user_id: data.user_id,
        salt: data.salt,
        token: data.access_token,
        expires_at: data.expires_at,
      });

      const masterKey = await deriveMasterKey(password, data.salt);
      await setMasterKey(masterKey);

      navigate("/app");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F9FB]">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[820px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-300/25 to-indigo-400/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 via-white to-[#2563EB]/20" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-4 md:px-8">
        <div className="w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_30px_80px_rgba(30,58,138,0.18)] backdrop-blur">
          <div className="flex flex-col md:hidden">
            <div className="order-1 bg-white px-6 py-8">
              <MobileForm
                isSignup={isSignup}
                copy={copy}
                email={email}
                username={username}
                password={password}
                confirm={confirm}
                error={error}
                success={success}
                submitting={submitting}
                onEmailChange={setEmail}
                onUsernameChange={setUsername}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirm}
                onSubmit={isSignup ? handleSignup : handleLogin}
              />
            </div>

            <div className="order-2 bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#60A5FA] px-6 py-10 text-white">
              <GradientPanel
                title={copy.gradientTitle}
                subtitle={copy.gradientSubtitle}
                buttonLabel={copy.switchLabel}
                onSwitch={handleModeSwitch}
                icon={SwitchIcon}
                mobile
              />
            </div>
          </div>

          <div className="relative hidden h-[min(720px,calc(100vh-32px))] md:grid md:grid-cols-2">
            <div
              className={[
                "absolute inset-y-0 left-0 z-10 w-1/2 bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#60A5FA] transition-transform duration-500 ease-in-out",
                isSignup ? "translate-x-0" : "translate-x-full",
              ].join(" ")}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.28),_transparent_38%)]" />
              <div className="absolute -bottom-16 right-[-72px] h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -left-8 top-16 h-28 w-28 rounded-full bg-white/10 blur-xl" />
            </div>

            <div className="relative z-20 flex items-center justify-center px-8 py-10">
              {isSignup ? (
                <GradientPanel
                  title={copy.gradientTitle}
                  subtitle={copy.gradientSubtitle}
                  buttonLabel={copy.switchLabel}
                  onSwitch={handleModeSwitch}
                  icon={SwitchIcon}
                />
              ) : (
                <FormPanel
                  isSignup={false}
                  title={copy.formTitle}
                  helperText={copy.helperText}
                  email={email}
                  username={username}
                  password={password}
                  confirm={confirm}
                  error={error}
                  success={isLoginRoute ? success : ""}
                  submitting={submitting}
                  onEmailChange={setEmail}
                  onUsernameChange={setUsername}
                  onPasswordChange={setPassword}
                  onConfirmChange={setConfirm}
                  onSubmit={handleLogin}
                />
              )}
            </div>

            <div className="relative z-20 flex items-center justify-center px-8 py-10">
              {isSignup ? (
                <FormPanel
                  isSignup
                  title={copy.formTitle}
                  helperText={copy.helperText}
                  email={email}
                  username={username}
                  password={password}
                  confirm={confirm}
                  error={error}
                  success={success}
                  submitting={submitting}
                  onEmailChange={setEmail}
                  onUsernameChange={setUsername}
                  onPasswordChange={setPassword}
                  onConfirmChange={setConfirm}
                  onSubmit={handleSignup}
                />
              ) : (
                <GradientPanel
                  title={copy.gradientTitle}
                  subtitle={copy.gradientSubtitle}
                  buttonLabel={copy.switchLabel}
                  onSwitch={handleModeSwitch}
                  icon={SwitchIcon}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradientPanel({ title, subtitle, buttonLabel, onSwitch, icon: Icon, mobile = false }) {
  return (
    <div className={mobile ? "" : "max-w-[24rem] text-center text-white"}>
      <h2 className={mobile ? "text-3xl font-bold" : "text-4xl font-bold leading-tight"}>{title}</h2>
      <p className={mobile ? "mt-3 max-w-sm text-sm text-blue-50" : "mt-5 text-base leading-7 text-blue-50"}>
        {subtitle}
      </p>
      <button
        type="button"
        onClick={onSwitch}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#2563EB] shadow-lg transition hover:scale-[1.02] hover:shadow-xl"
      >
        <span>{buttonLabel}</span>
        <Icon size={16} />
      </button>
    </div>
  );
}

function FormPanel({
  isSignup,
  title,
  helperText,
  email,
  username,
  password,
  confirm,
  error,
  success,
  submitting,
  onEmailChange,
  onUsernameChange,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
}) {
  return (
    <div className="w-full max-w-[25rem]">
      <div className="mb-8 flex items-center justify-between">
        <Link to="/" className="text-2xl font-semibold text-slate-900">
          DataGuard
        </Link>
      </div>

      <h1 className="text-4xl font-bold text-slate-900">{title}</h1>

      {success && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting) return;
          onSubmit();
        }}
      >
        <Field
          icon={Mail}
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="Email"
          autoComplete="email"
        />

        {isSignup && (
          <Field
            icon={UserIcon}
            type="text"
            value={username}
            onChange={onUsernameChange}
            placeholder="Username"
            autoComplete="username"
          />
        )}

        <Field
          icon={Lock}
          type="password"
          value={password}
          onChange={onPasswordChange}
          placeholder="Password"
          autoComplete={isSignup ? "new-password" : "current-password"}
        />

        {isSignup && (
          <Field
            icon={Lock}
            type="password"
            value={confirm}
            onChange={onConfirmChange}
            placeholder="Re-enter Password"
            autoComplete="new-password"
          />
        )}

        {!isSignup && <p className="text-right text-sm text-slate-500">{helperText}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (isSignup ? "SIGNING UP..." : "LOGGING IN...") : isSignup ? "SIGN UP" : "LOG IN"}
        </button>
      </form>
    </div>
  );
}

function MobileForm(props) {
  return <FormPanel {...props} />;
}

function Field({ icon: Icon, type, value, onChange, placeholder, autoComplete }) {
  return (
    <div className="relative">
      <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-2xl border border-slate-800 bg-[#0F172A] py-3.5 pl-12 pr-4 text-white outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(96,165,250,0.18)]"
      />
    </div>
  );
}

export default AuthPage;
