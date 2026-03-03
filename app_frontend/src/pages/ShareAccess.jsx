import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { decryptFile, decryptSharedFileKey, deriveShareKey } from "../utils/crypto";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

function getOrCreateGuestId(token) {
  const key = `dg_guest_${token}`;
  const existing = localStorage.getItem(key) || sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `guest-${token.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(key, created);
  sessionStorage.setItem(key, created);
  return created;
}

function readLinkSecretFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#")) return "";
  const params = new URLSearchParams(hash.slice(1));
  return params.get("k") || "";
}

function bufferToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function openBlobInNewTab(blob, fallbackFilename) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackFilename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function buildWatermarkedHtml(dataUrl, filename, watermarkText) {
  return `<!doctype html><html><head><meta charset='utf-8'><title>${filename}</title><style>body{margin:0;font-family:Arial} .wrap{position:relative;height:100vh} iframe{width:100%;height:100%;border:0} .wm{position:absolute;inset:0;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='220'><text x='10' y='120' fill='rgba(0,0,0,0.15)' font-size='18' transform='rotate(-24 140,90)'>${encodeURIComponent(
    watermarkText
  )}</text></svg>");background-repeat:repeat}</style></head><body><div class='wrap'><iframe src='${dataUrl}'></iframe><div class='wm'></div></div></body></html>`;
}

async function buildWatermarkedPdfBlob(pdfBlob, watermarkText) {
  const src = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(src);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    for (let y = -120; y < height + 120; y += 180) {
      for (let x = -220; x < width + 220; x += 320) {
        page.drawText(watermarkText, {
          x,
          y,
          size: 18,
          font,
          color: rgb(0.15, 0.15, 0.15),
          opacity: 0.18,
          rotate: degrees(-25),
        });
      }
    }
  }

  const out = await pdfDoc.save();
  return new Blob([out], { type: "application/pdf" });
}

function ShareAccess() {
  const { token } = useParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [decryptedBlob, setDecryptedBlob] = useState(null);
  const [watermarkText, setWatermarkText] = useState("");
  const stampedPdfRef = useRef(null);

  const guestId = useMemo(() => getOrCreateGuestId(token), [token]);
  const watermarkStyle = useMemo(() => {
    const text = encodeURIComponent(watermarkText || "Protected Share");
    return {
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='220'><text x='10' y='120' fill='rgba(0,0,0,0.15)' font-size='18' transform='rotate(-24 140,90)'>${text}</text></svg>")`,
      backgroundRepeat: "repeat",
    };
  }, [watermarkText]);

  useEffect(() => {
    let active = true;
    let createdUrl = null;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const linkSecret = readLinkSecretFromHash();
        if (!linkSecret) {
          throw new Error("Invalid share link: missing key fragment.");
        }

        const headers = { "X-Guest-Id": guestId };
        const metaRes = await apiFetch(`/share/${token}`, { headers });
        const meta = await metaRes.json();
        if (!metaRes.ok) throw new Error(meta.detail || "Invalid share");

        const { encrypted_key, key_iv, key_salt, iv, filename, mime_type } = meta.metadata;
        const shareKey = await deriveShareKey(linkSecret, key_salt);
        const fileKey = await decryptSharedFileKey(encrypted_key, key_iv, shareKey);

        const blobRes = await apiFetch(`${meta.download_url}?action=preview`, { headers });
        if (!blobRes.ok) {
          const body = await blobRes.json().catch(() => ({}));
          throw new Error(body.detail || "Unable to fetch file");
        }
        const encryptedBuffer = await blobRes.arrayBuffer();
        const decryptedBuffer = await decryptFile(encryptedBuffer, iv, fileKey);
        const originalBlob = new Blob([decryptedBuffer], { type: mime_type });
        const wmText = meta.watermark_text || `Share: ${guestId} | Link: ${token.slice(0, 8)}`;

        let previewBlob = originalBlob;
        if (mime_type === "application/pdf") {
          const stamped = await buildWatermarkedPdfBlob(originalBlob, wmText);
          stampedPdfRef.current = stamped;
          previewBlob = stamped;
        } else {
          stampedPdfRef.current = null;
        }

        const url = URL.createObjectURL(previewBlob);
        createdUrl = url;

        if (!active) return;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setFilename(filename);
        setMimeType(mime_type);
        setDecryptedBlob(originalBlob);
        setWatermarkText(wmText);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to open shared file");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [guestId, token]);

  const getStampedPdf = async () => {
    if (!decryptedBlob || mimeType !== "application/pdf") return null;
    if (stampedPdfRef.current) return stampedPdfRef.current;
    const stamped = await buildWatermarkedPdfBlob(decryptedBlob, watermarkText);
    stampedPdfRef.current = stamped;
    return stamped;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Shared File</h1>

        {loading && <p className="text-gray-600">Opening shared file...</p>}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {!loading && previewUrl && (
          <div className="border rounded-md overflow-hidden">
            <div className="px-3 py-2 text-sm bg-gray-50 border-b flex justify-between items-center">
              <span>{filename}</span>
              <div className="flex items-center gap-3">
                {mimeType === "application/pdf" && (
                  <button
                    className="text-sm text-blue-700 hover:underline"
                    onClick={async () => {
                      if (!decryptedBlob) return;
                      const headers = { "X-Guest-Id": guestId };
                      await apiFetch(`/share/${token}/blob?action=preview`, { headers });
                      const stamped = await getStampedPdf();
                      if (!stamped) return;
                      openBlobInNewTab(stamped, filename);
                    }}
                  >
                    Open PDF
                  </button>
                )}
                <button
                  className="text-sm text-blue-700 hover:underline"
                  onClick={async () => {
                    if (!decryptedBlob) return;
                    const headers = { "X-Guest-Id": guestId };
                    await apiFetch(`/share/${token}/blob?action=download`, { headers });
                    if (mimeType === "application/pdf") {
                      const stamped = await getStampedPdf();
                      if (!stamped) return;
                      downloadBlob(filename, stamped);
                      return;
                    }
                    const dataUrl = await bufferToDataUrl(decryptedBlob);
                    const html = buildWatermarkedHtml(dataUrl, filename, watermarkText);
                    downloadBlob(`${filename}.watermarked.html`, new Blob([html], { type: "text/html" }));
                  }}
                >
                  Download Watermarked Copy
                </button>
              </div>
            </div>
            <div className="relative w-full h-[75vh]">
              {mimeType.startsWith("image/") ? (
                <img src={previewUrl} alt={filename} className="w-full h-full object-contain bg-white" />
              ) : (
                <iframe title="shared-preview" src={previewUrl} className="w-full h-full" />
              )}
              {mimeType !== "application/pdf" && (
                <div className="absolute inset-0 pointer-events-none" style={watermarkStyle} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareAccess;
