const URL_ATTRS = new Set(["href", "src", "xlink:href", "formaction"]);

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");

  doc.querySelectorAll("script, iframe, object, embed, link, meta, base, form").forEach((node) => node.remove());

  doc.body.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || "").trim().toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "style") {
        node.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRS.has(name) && (value.startsWith("javascript:") || value.startsWith("data:text/html"))) {
        node.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
}
