import { describe, it, expect } from "vitest";
import { encodeSDP, decodeSDP } from "../sdp-codec.js";

describe("sdp-codec", () => {
  const payload = {
    sdp: "v=0\r\no=- 1234 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n",
    candidates: [
      { candidate: "candidate:1 1 UDP 2130706431 192.168.1.5 12345 typ host", mid: "0" },
      { candidate: "candidate:2 1 UDP 1694498815 203.0.113.5 54321 typ srflx", mid: "0" },
    ],
    sessionCode: "cd-abc12345",
  };

  it("roundtrips encode → decode", () => {
    const encoded = encodeSDP(payload);
    const decoded = decodeSDP(encoded);

    expect(decoded.sdp).toBe(payload.sdp);
    expect(decoded.candidates).toEqual(payload.candidates);
    expect(decoded.sessionCode).toBe(payload.sessionCode);
  });

  it("produces a base64url string (no +, /, or =)", () => {
    const encoded = encodeSDP(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("throws on invalid input", () => {
    expect(() => decodeSDP("not-valid-base64!!!")).toThrow();
  });

  it("throws when required fields are missing", () => {
    const bad = { candidates: [], sessionCode: "" };
    const encoded = encodeSDP(bad as any);
    expect(() => decodeSDP(encoded)).toThrow("Invalid offer/answer code");
  });

  it("handles empty candidates", () => {
    const minimal = { sdp: "v=0\r\n", candidates: [], sessionCode: "cd-test" };
    const encoded = encodeSDP(minimal);
    const decoded = decodeSDP(encoded);
    expect(decoded.candidates).toEqual([]);
    expect(decoded.sdp).toBe("v=0\r\n");
  });
});
