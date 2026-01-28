// crypto.js

// ---------- helpers ----------
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ---------- 1. Derive Master Key from password + salt ----------
export async function deriveMasterKey(password, saltB64) {
  const salt = base64ToBuf(saltB64);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---------- 2. Generate random file key ----------
export async function generateFileKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ---------- 3. Encrypt file ----------
export async function encryptFile(file, fileKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    fileKey,
    fileBuffer
  );

  return {
    encryptedBuffer: encrypted,
    iv: bufToBase64(iv),
  };
}

// ---------- 4. Encrypt file key with master key ----------
export async function encryptFileKey(fileKey, masterKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const rawKey = await crypto.subtle.exportKey("raw", fileKey);

  const encryptedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    rawKey
  );

  return {
    encryptedKey: bufToBase64(encryptedKey),
    keyIv: bufToBase64(iv),
  };
}

// ---------- 5. Decrypt file key ----------
export async function decryptFileKey(encryptedKeyB64, keyIvB64, masterKey) {
  const encryptedKey = base64ToBuf(encryptedKeyB64);
  const iv = base64ToBuf(keyIvB64);

  const rawKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    encryptedKey
  );

  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

// ---------- 6. Decrypt file ----------
export async function decryptFile(encryptedBuffer, ivB64, fileKey) {
  const iv = base64ToBuf(ivB64);

  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    fileKey,
    encryptedBuffer
  );
}
