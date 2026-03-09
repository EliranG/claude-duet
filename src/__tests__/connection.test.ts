import { describe, it, expect, vi } from "vitest";
import { getLocalIP, formatConnectionInfo, startLocaltunnel } from "../connection.js";

vi.mock("localtunnel", () => ({
  default: vi.fn(),
}));

import localtunnel from "localtunnel";

const mockedLocaltunnel = vi.mocked(localtunnel);

describe("connection utilities", () => {
  it("detects a local IP address", () => {
    const ip = getLocalIP();
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

describe("startLocaltunnel", () => {
  it("returns ConnectionInfo with wss URL on success", async () => {
    const closeFn = vi.fn();
    mockedLocaltunnel.mockResolvedValueOnce({
      url: "https://abcdef.loca.lt",
      close: closeFn,
    } as unknown as localtunnel.Tunnel);

    const result = await startLocaltunnel(9876);

    expect(result).not.toBeNull();
    expect(result!.url).toBe("wss://abcdef.loca.lt");
    expect(result!.displayUrl).toBe("wss://abcdef.loca.lt");
    expect(result!.mode).toBe("tunnel");

    result!.cleanup!();
    expect(closeFn).toHaveBeenCalled();
  });

  it("returns null when localtunnel throws", async () => {
    mockedLocaltunnel.mockRejectedValueOnce(new Error("connection refused"));

    const result = await startLocaltunnel(9876);

    expect(result).toBeNull();
  });
});
