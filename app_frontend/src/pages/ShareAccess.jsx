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

function buildPdfInlineViewerHtml(pdfUrl, filename) {
  return `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>${filename}</title><style>html,body{height:100%;margin:0;background:#0b0b0b} .frame{height:100%;width:100%} .fallback{position:fixed;left:0;right:0;bottom:0;background:#111;color:#fff;padding:10px;font-family:Arial,sans-serif;font-size:13px;text-align:center} a{color:#7dd3fc}</style></head><body><object class='frame' data='${pdfUrl}' type='application/pdf'><embed class='frame' src='${pdfUrl}' type='application/pdf' /></object><div class='fallback'>If PDF is not visible, <a href='${pdfUrl}' target='_blank' rel='noopener noreferrer'>open it directly</a>.</div></body></html>`;
}

function normalizeWatermarkText(value) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Protected Share";
  if (cleaned.length <= 120) return cleaned;
  return `${cleaned.slice(0, 117)}...`;
}

function buildWatermarkedHtml(dataUrl, filename, watermarkText) {
  return `<!doctype html><html><head><meta charset='utf-8'><title>${filename}</title><style>body{margin:0;font-family:Arial} .wrap{position:relative;height:100vh} iframe{width:100%;height:100%;border:0} .wm{position:absolute;inset:0;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='220'><text x='10' y='120' fill='rgba(0,0,0,0.15)' font-size='18' transform='rotate(-24 140,90)'>${encodeURIComponent(
    watermarkText
  )}</text></svg>");background-repeat:repeat}</style></head><body><div class='wrap'><iframe src='${dataUrl}'></iframe><div class='wm'></div></div></body></html>`;
}

async function buildWatermarkedImageBlob(imageBlob, watermarkText, mimeType) {
  const imageUrl = URL.createObjectURL(imageBlob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to watermark image");

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const text = normalizeWatermarkText(watermarkText);
    const fontSize = Math.max(28, Math.min(64, Math.round(Math.min(canvas.width, canvas.height) / 14)));
    const yGap = Math.max(170, Math.round(fontSize * 2.4));

    ctx.font = `700 ${fontSize}px Arial`;
    const textWidth = Math.ceil(ctx.measureText(text).width);
    const xGap = Math.max(Math.round(textWidth + 110), Math.round(canvas.width / 2.5));

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#111";
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = Math.max(2, Math.round(fontSize / 12));
    ctx.textBaseline = "middle";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((-25 * Math.PI) / 180);
    for (let y = -canvas.height * 1.5; y <= canvas.height * 1.5; y += yGap) {
      for (let x = -canvas.width * 1.5; x <= canvas.width * 1.5; x += xGap) {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();

    const targetMime = mimeType && mimeType.startsWith("image/") ? mimeType : "image/png";
    const resultBlob = await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), targetMime, 0.92);
    });
    if (!resultBlob) throw new Error("Unable to export watermarked image");
    return resultBlob;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
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
  const [watermarkedBlob, setWatermarkedBlob] = useState(null);
  const [watermarkText, setWatermarkText] = useState("");
  const stampedPdfRef = useRef(null);
  const isMobile = useMemo(
    () => typeof window !== "undefined" && /android|iphone|ipad|ipod/i.test(window.navigator.userAgent || ""),
    []
  );

  const guestId = useMemo(() => getOrCreateGuestId(token), [token]);
  const watermarkStyle = useMemo(() => {
    const text = encodeURIComponent(normalizeWatermarkText(watermarkText || "Protected Share"));
    const alpha = "0.24";
    return {
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='260'><text x='16' y='140' fill='rgba(0,0,0,${alpha})' stroke='rgba(255,255,255,0.55)' stroke-width='0.7' font-size='24' font-family='Arial,sans-serif' transform='rotate(-24 180,120)'>${text}</text></svg>")`,
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
        const wmText = normalizeWatermarkText(meta.watermark_text || `Share: ${guestId} | Link: ${token.slice(0, 8)}`);

        let previewBlob = originalBlob;
        if (mime_type === "application/pdf") {
          const stamped = await buildWatermarkedPdfBlob(originalBlob, wmText);
          stampedPdfRef.current = stamped;
          previewBlob = stamped;
        } else if (mime_type.startsWith("image/")) {
          const stamped = await buildWatermarkedImageBlob(originalBlob, wmText, mime_type);
          stampedPdfRef.current = null;
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
        setWatermarkedBlob(previewBlob);
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

  const shouldOverlayWatermark = mimeType !== "application/pdf" && !mimeType.startsWith("image/");

  return (
    <div className="min-h-screen bg-gray-100 p-3 md:p-6">
      <div className="mx-auto max-w-5xl rounded-lg bg-white p-3 shadow md:p-6">
        <h1 className="mb-4 text-xl font-bold md:text-2xl">Shared File</h1>

        {loading && <p className="text-gray-600">Opening shared file...</p>}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {!loading && previewUrl && (
          <div className="border rounded-md overflow-hidden">
            <div className="flex flex-col gap-2 border-b bg-gray-50 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
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
                {mimeType === "application/pdf" && (
                  <button
                    className="text-sm text-blue-700 hover:underline"
                    onClick={async () => {
                      const stamped = await getStampedPdf();
                      if (!stamped) return;
                      const stampedUrl = URL.createObjectURL(stamped);
                      const html = buildPdfInlineViewerHtml(stampedUrl, filename);
                      openBlobInNewTab(new Blob([html], { type: "text/html" }), `${filename}.viewer.html`);
                      setTimeout(() => URL.revokeObjectURL(stampedUrl), 45000);
                    }}
                  >
                    Open Inline Viewer
                  </button>
                )}
                <button
                  className="text-sm text-blue-700 hover:underline"
                  onClick={async () => {
                    if (!decryptedBlob || !watermarkedBlob) return;
                    const headers = { "X-Guest-Id": guestId };
                    await apiFetch(`/share/${token}/blob?action=download`, { headers });
                    if (mimeType === "application/pdf") {
                      const stamped = await getStampedPdf();
                      if (!stamped) return;
                      downloadBlob(filename, stamped);
                      return;
                    }
                    if (mimeType.startsWith("image/")) {
                      downloadBlob(filename, watermarkedBlob);
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
            <div className="relative h-[68vh] w-full bg-black md:h-[75vh]">
              {mimeType.startsWith("image/") ? (
                <div className="h-full w-full overflow-auto">
                  <img src={previewUrl} alt={filename} className="mx-auto block h-auto max-w-full bg-black" />
                </div>
              ) : mimeType === "application/pdf" ? (
                <object data={previewUrl} type="application/pdf" className="h-full w-full bg-white">
                  <iframe title="shared-preview" src={previewUrl} className="h-full w-full" />
                </object>
              ) : (
                <iframe title="shared-preview" src={previewUrl} className="w-full h-full" />
              )}
              {shouldOverlayWatermark && <div className="absolute inset-0 pointer-events-none" style={watermarkStyle} />}
            </div>
            {mimeType === "application/pdf" && isMobile && (
              <p className="px-3 py-2 text-xs text-gray-600">
                If your mobile browser does not render the PDF here, use "Open Inline Viewer".
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareAccess;
