/**
 * Cifratura simmetrica AES-256-GCM per segreti applicativi (OAuth token, ecc).
 *
 * Il formato del ciphertext e': base64( IV(12) || ciphertext || authTag(16) ).
 * GCM fornisce sia confidenzialita' che integrita': un tampering del DB
 * fa fallire la decifratura invece di restituire dati silenziosamente corrotti.
 *
 * La chiave vive SOLO in `process.env.APP_ENC_KEY` (32 byte random in base64).
 * Genera con:   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm" as const;
const IV_LENGTH = 12;          // 96 bit — standard GCM
const AUTH_TAG_LENGTH = 16;    // 128 bit

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENC_KEY;
  if (!raw) {
    throw new Error("APP_ENC_KEY mancante: imposta una chiave a 32 byte in base64 in .env.local");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`APP_ENC_KEY deve essere 32 byte (ora: ${key.length}).`);
  }
  cachedKey = key;
  return key;
}

/** Cifra una stringa UTF-8 e restituisce un blob base64 autocontenuto. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

/** Decifra un blob prodotto da `encryptSecret`. Solleva se l'autenticazione fallisce. */
export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Ciphertext corrotto o troppo corto");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
