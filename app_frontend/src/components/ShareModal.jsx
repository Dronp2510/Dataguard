import { X, Copy, Check, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { getMasterKey } from "../utils/keyStore";
import { deriveShareKey, randomBase64, rewrapFileKeyForShare } from "../utils/crypto";
import { apiFetch } from "../utils/api";

function dataUrlToFile(dataUrl, filename) {
  const [header, body] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mimeType });
}

function ShareModal({ file, onClose }) {
  const [expiry, setExpiry] = useState("10");
  const [busy, setBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharingQr, setSharingQr] = useState(false);

  const shareOrigin = useMemo(
    () => import.meta.env.VITE_PUBLIC_SHARE_ORIGIN || window.location.origin,
    []
  );

  useEffect(() => {
    if (!generatedLink) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(generatedLink, { margin: 1, width: 180 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [generatedLink]);

  useEffect(() => {
    if (!linkCopied) return undefined;
    const timeoutId = window.setTimeout(() => setLinkCopied(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [linkCopied]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Share Document</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500">Document</p>
          <p className="font-medium">{file.name}</p>
        </div>

        <div className="space-y-3">
          <select
            className="w-full border rounded-md px-3 py-2"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            <option value="5">Expires in 5 minutes</option>
            <option value="10">Expires in 10 minutes</option>
            <option value="30">Expires in 30 minutes</option>
            <option value="forever">Never expires (--)</option>
          </select>
        </div>

        {window.location.hostname === "localhost" && (
          <p className="text-xs text-amber-700 mt-2">
            For other devices, run frontend with host IP and set `VITE_PUBLIC_SHARE_ORIGIN`.
          </p>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        {generatedLink && (
          <div className="mt-4 p-3 bg-gray-50 rounded border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Share URL</p>
              <button
                className="text-xs flex items-center gap-1 text-slate-700 hover:text-black"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(generatedLink);
                    setLinkCopied(true);
                  } catch {
                    setError("Unable to copy share link");
                  }
                }}
              >
                {linkCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {linkCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-sm break-all">{generatedLink}</p>
            {qrDataUrl && (
              <>
                <div className="mt-3 flex justify-center">
                  <img src={qrDataUrl} alt="Share QR" className="w-40 h-40 border rounded" />
                </div>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    disabled={sharingQr}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-70"
                    onClick={async () => {
                      if (!generatedLink) return;
                      setSharingQr(true);
                      setError("");
                      try {
                        if (!navigator.share) {
                          throw new Error("This browser does not support direct sharing");
                        }

                        const sharePayload = {
                          title: `Shared document: ${file.name}`,
                          text: `Open the secure share for ${file.name}`,
                          url: generatedLink,
                        };

                        if (qrDataUrl) {
                          const qrFile = dataUrlToFile(qrDataUrl, `${file.name}-share-qr.png`);
                          if (navigator.canShare?.({ files: [qrFile] })) {
                            await navigator.share({ ...sharePayload, files: [qrFile] });
                          } else {
                            await navigator.share(sharePayload);
                          }
                        } else {
                          await navigator.share(sharePayload);
                        }
                      } catch (err) {
                        if (err?.name !== "AbortError") {
                          setError(err.message || "Unable to share QR code");
                        }
                      } finally {
                        setSharingQr(false);
                      }
                    }}
                  >
                    <Share2 size={15} />
                    {sharingQr ? "Sharing..." : "Share QR Code"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {generatedLink && linkCopied && (
          <p className="mt-3 text-center text-sm font-medium text-green-600">
            Link successfully copied
          </p>
        )}

        <button
          disabled={busy}
          className="w-full mt-5 bg-slate-900 text-white py-2 rounded-md hover:bg-slate-800 disabled:opacity-70"
          onClick={async () => {
            setBusy(true);
            setError("");
            setLinkCopied(false);
            try {
              const masterKey = getMasterKey();
              if (!masterKey) throw new Error("Session expired. Please login again.");

              const metadataRes = await apiFetch(`/vault/files/${file.id}/download`);
              if (!metadataRes.ok) {
                const body = await metadataRes.json().catch(() => ({}));
                throw new Error(body.detail || "Could not load file metadata");
              }
              const metadata = await metadataRes.json();
              const { encrypted_key, key_iv } = metadata.metadata;

              const linkSecret = randomBase64(24);
              const keySalt = randomBase64(16);
              const shareKey = await deriveShareKey(linkSecret, keySalt);
              const wrapped = await rewrapFileKeyForShare(encrypted_key, key_iv, masterKey, shareKey);

              const formData = new FormData();
              formData.append("file_id", file.id);
              formData.append("encrypted_key", wrapped.encryptedKey);
              formData.append("key_iv", wrapped.keyIv);
              formData.append("key_salt", keySalt);
              formData.append("expiry_option", expiry);

              const shareRes = await apiFetch("/share/create", { method: "POST", body: formData });
              const shareData = await shareRes.json();
              if (!shareRes.ok) throw new Error(shareData.detail || "Failed to create share");

              const link = `${shareOrigin}${shareData.share_url}#k=${encodeURIComponent(linkSecret)}`;
              setGeneratedLink(link);
            } catch (err) {
              setError(err.message || "Share generation failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Generating..." : "Generate Secure Share"}
        </button>
      </div>
    </div>
  );
}

export default ShareModal;

