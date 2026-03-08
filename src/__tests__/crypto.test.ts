import { describe, it, expect } from "vitest";
import { deriveKey, encrypt, decrypt } from "../crypto.js";

describe("crypto", () => {
  it("derives deterministic keys from password + session code", () => {
    const key1 = deriveKey("mypassword", "cd-abc123");
    const key2 = deriveKey("mypassword", "cd-abc123");
    expect(key1).toEqual(key2);
  });

  it("derives different keys for different passwords", () => {
    const key1 = deriveKey("password1", "cd-abc123");
    const key2 = deriveKey("password2", "cd-abc123");
    expect(key1).not.toEqual(key2);
  });

  it("encrypts and decrypts a message roundtrip", () => {
    const key = deriveKey("mypassword", "cd-abc123");
    const plaintext = JSON.stringify({ type: "prompt", text: "hello" });
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", () => {
    const key1 = deriveKey("password1", "cd-abc123");
    const key2 = deriveKey("password2", "cd-abc123");
    const encrypted = encrypt("secret", key1);
    expect(() => decrypt(encrypted, key2)).toThrow();
  });
});
