import nacl from "tweetnacl";
import {
  decodeUTF8,
  encodeUTF8,
  encodeBase64,
  decodeBase64,
} from "tweetnacl-util";
import { scryptSync } from "node:crypto";

const KEY_LENGTH = nacl.secretbox.keyLength; // 32 bytes

export function deriveKey(password: string, sessionCode: string): Uint8Array {
  const salt = decodeUTF8(sessionCode);
  const keyBuffer = scryptSync(password, salt, KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return new Uint8Array(keyBuffer);
}

export function encrypt(plaintext: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = decodeUTF8(plaintext);
  const box = nacl.secretbox(messageBytes, nonce, key);
  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);
  return encodeBase64(fullMessage);
}

export function decrypt(ciphertext: string, key: Uint8Array): string {
  const fullMessage = decodeBase64(ciphertext);
  const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
  const box = fullMessage.slice(nacl.secretbox.nonceLength);
  const decrypted = nacl.secretbox.open(box, nonce, key);
  if (!decrypted) {
    throw new Error("Decryption failed — wrong password or corrupted message");
  }
  return encodeUTF8(decrypted);
}
