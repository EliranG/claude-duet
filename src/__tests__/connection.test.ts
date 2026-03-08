import { describe, it, expect } from "vitest";
import { getLocalIP, formatConnectionInfo } from "../connection.js";

describe("connection utilities", () => {
  it("detects a local IP address", () => {
    const ip = getLocalIP();
    // Should return a non-loopback IPv4 address
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(ip).not.toBe("127.0.0.1");
  });

  it("formats connection info for LAN mode", () => {
    const info = formatConnectionInfo({ mode: "lan", host: "192.168.1.42", port: 9876 });
    expect(info.url).toBe("ws://192.168.1.42:9876");
    expect(info.displayUrl).toBe("ws://192.168.1.42:9876");
  });

  it("formats connection info for tunnel mode", () => {
    const info = formatConnectionInfo({
      mode: "tunnel",
      host: "random-slug.trycloudflare.com",
      port: 443,
    });
    expect(info.url).toBe("wss://random-slug.trycloudflare.com");
  });
});
