const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function createRandomBase64(length = 16) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  return toBase64(randomBytes);
}

async function deriveKey(secretBase64, saltBase64) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    fromBase64(secretBase64),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltBase64),
      iterations: 120000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function hashValue(value) {
  const digest = await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(value));
  return toBase64(digest);
}

export async function encryptValue(value, secretBase64, saltBase64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secretBase64, saltBase64);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    TEXT_ENCODER.encode(value)
  );

  return {
    cipherText: toBase64(encrypted),
    iv: toBase64(iv)
  };
}

export async function decryptValue(cipherTextBase64, ivBase64, secretBase64, saltBase64) {
  const key = await deriveKey(secretBase64, saltBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivBase64) },
    key,
    fromBase64(cipherTextBase64)
  );

  return TEXT_DECODER.decode(decrypted);
}
