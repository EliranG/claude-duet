import { describe, it, expect, afterEach } from "vitest";
import { createOffer, createAnswer } from "../peer.js";

const ICE_SERVERS = ["stun:stun.l.google.com:19302"];

describe("peer P2P transport", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups) {
      try { cleanup(); } catch {}
    }
    cleanups.length = 0;
  });

  it("createOffer produces an offer code string", async () => {
    const offer = await createOffer("cd-test123", ICE_SERVERS);
    cleanups.push(offer.cleanup);

    expect(typeof offer.offerCode).toBe("string");
    expect(offer.offerCode.length).toBeGreaterThan(0);
    expect(typeof offer.acceptAnswer).toBe("function");
    expect(offer.transport).toBeInstanceOf(Promise);
  });

  it("createAnswer decodes offer and produces an answer code", async () => {
    const offer = await createOffer("cd-test456", ICE_SERVERS);
    cleanups.push(offer.cleanup);

    const answer = await createAnswer(offer.offerCode, ICE_SERVERS);
    cleanups.push(answer.cleanup);

    expect(typeof answer.answerCode).toBe("string");
    expect(answer.answerCode.length).toBeGreaterThan(0);
    expect(answer.sessionCode).toBe("cd-test456");
  });

  it("full offer → answer → connect roundtrip", async () => {
    const offer = await createOffer("cd-roundtrip", ICE_SERVERS);
    cleanups.push(offer.cleanup);

    const answer = await createAnswer(offer.offerCode, ICE_SERVERS);
    cleanups.push(answer.cleanup);

    offer.acceptAnswer(answer.answerCode);

    // Both transports should resolve once the data channel opens
    const [hostTransport, guestTransport] = await Promise.all([
      Promise.race([
        offer.transport,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Host transport timed out")), 15000)),
      ]),
      Promise.race([
        answer.transport,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Guest transport timed out")), 15000)),
      ]),
    ]);

    expect(hostTransport.isOpen()).toBe(true);
    expect(guestTransport.isOpen()).toBe(true);

    // Test bidirectional messaging
    const hostReceived: string[] = [];
    const guestReceived: string[] = [];

    hostTransport.on("message", (data: string) => hostReceived.push(data));
    guestTransport.on("message", (data: string) => guestReceived.push(data));

    guestTransport.send("hello from guest");
    hostTransport.send("hello from host");

    await new Promise((r) => setTimeout(r, 200));

    expect(hostReceived).toContain("hello from guest");
    expect(guestReceived).toContain("hello from host");

    hostTransport.close();
    guestTransport.close();
  }, 20000);

  it("createAnswer throws on invalid offer code", async () => {
    await expect(createAnswer("invalid-garbage", ICE_SERVERS)).rejects.toThrow();
  });
});
