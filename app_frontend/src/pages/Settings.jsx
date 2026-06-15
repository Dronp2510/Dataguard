import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Lock, LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { clearMasterKey, setMasterKey } from "../utils/keyStore";
import { clearSession, getAccessToken, getSalt, getUser, setSession } from "../utils/session";
import { apiFetch } from "../utils/api";
import { deriveMasterKey, randomBase64, rewrapEncryptedFileKey } from "../utils/crypto";

function formatDateTime(value) {
  if (!value) return "Not available";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Not available";
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function Settings() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const user = useMemo(() => getUser(), []);

  const sessionExpiry = sessionStorage.getItem("dg_session_expires_at");

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (passwordBusy) return;

    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password confirmation does not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from the current password.");
      return;
    }

    const currentSalt = getSalt();
    if (!currentSalt) {
      setPasswordError("Missing encryption salt. Please log in again.");
      return;
    }

    setPasswordBusy(true);
    try {
      const currentMasterKey = await deriveMasterKey(currentPassword, currentSalt);
      const nextSalt = randomBase64(16);
      const nextMasterKey = await deriveMasterKey(newPassword, nextSalt);

      const wrappingRes = await apiFetch("/auth/key-wrappings");
      const wrappingData = await wrappingRes.json().catch(() => ({}));
      if (!wrappingRes.ok) {
        throw new Error(wrappingData.detail || "Failed to load encrypted keys");
      }

      const wrappedKeys = await Promise.all(
        (wrappingData.items || []).map(async (item) => {
          const rotated = await rewrapEncryptedFileKey(
            item.encrypted_key,
            item.key_iv,
            currentMasterKey,
            nextMasterKey
          );
          return {
            vault_item_id: item.vault_item_id,
            encrypted_key: rotated.encryptedKey,
            key_iv: rotated.keyIv,
          };
        })
      );

      const changeRes = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_salt: nextSalt,
          wrapped_keys: wrappedKeys,
        }),
      });
      const changeData = await changeRes.json().catch(() => ({}));
      if (!changeRes.ok) {
        throw new Error(changeData.detail || "Password change failed");
      }

      await setMasterKey(nextMasterKey);
      setSession({
        user_id: user.user_id,
        salt: changeData.salt || nextSalt,
        token: getAccessToken(),
        expires_at: sessionExpiry,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated. Existing encrypted files remain accessible.");
    } catch (err) {
      setPasswordError(err.message || "Password change failed");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 px-7 py-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Preferences</p>
        <h2 className="mt-3 text-3xl font-bold">Settings</h2>
        <p className="mt-2 text-sm text-blue-100">Manage account context and session security controls.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg text-left"
            onClick={() => {
              setPasswordPanelOpen((value) => !value);
              setPasswordError("");
              setPasswordMessage("");
            }}
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Password</h3>
              <p className="mt-1 text-sm text-slate-500">Click to change your account password and rotate wrapped file keys.</p>
            </div>
            <span className="rounded-full bg-slate-100 p-2 text-slate-600">
              {passwordPanelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {passwordPanelOpen && (
            <form className="mt-5 space-y-3 border-t border-slate-200 pt-5" onSubmit={handlePasswordChange}>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                required
              />
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              {passwordMessage && <p className="text-sm text-emerald-700">{passwordMessage}</p>}
              <button
                type="submit"
                disabled={passwordBusy}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <ShieldCheck size={15} />
                {passwordBusy ? "Updating..." : "Change password"}
              </button>
              <p className="text-xs text-slate-500">
                File blobs stay encrypted as-is. Only the per-file wrapped keys are re-encrypted with your new password-derived key.
              </p>
            </form>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Account</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <User size={16} className="text-slate-500" />
              <span className="text-slate-600">Username:</span>
              <span className="font-medium text-slate-900">{user.username || "Not set"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-slate-500" />
              <span className="text-slate-600">Email:</span>
              <span className="font-medium text-slate-900">{user.email || "Not set"}</span>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Session Security</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-slate-500" />
              <span className="text-slate-600">Session expires:</span>
              <span className="font-medium text-slate-900">{formatDateTime(sessionExpiry)}</span>
            </div>
            <button
              className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={async () => {
                try {
                  await apiFetch("/auth/logout", { method: "POST" });
                } catch {
                  // Continue with local cleanup.
                }
                clearMasterKey();
                clearSession();
                navigate("/login");
              }}
            >
              <LogOut size={15} />
              Logout from this device
            </button>
          </div>
        </article>
      </section>

    </div>
  );
}

export default Settings;
