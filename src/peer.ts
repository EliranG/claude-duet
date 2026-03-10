import { EventEmitter } from "node:events";
import nodeDataChannel from "node-datachannel";
import type { DuetTransport } from "./transport.js";
import { encodeSDP, decodeSDP } from "./sdp-codec.js";

const { PeerConnection } = nodeDataChannel;

const ICE_GATHERING_TIMEOUT_MS = 10000;

const DEFAULT_ICE_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

class DataChannelTransport extends EventEmitter implements DuetTransport {
  private dc: nodeDataChannel.DataChannel;

  constructor(dc: nodeDataChannel.DataChannel) {
    super();
    this.dc = dc;

    dc.onMessage((msg) => {
      const data = typeof msg === "string" ? msg : Buffer.from(msg as Uint8Array).toString("utf-8");
      this.emit("message", data);
    });

    dc.onClosed(() => {
      this.emit("close");
    });

    dc.onError((err) => {
      this.emit("error", new Error(err));
    });
  }

  send(data: string): void {
    if (this.dc.isOpen()) {
      this.dc.sendMessage(data);
    }
  }

  close(): void {
    try {
      this.dc.close();
    } catch {
      // Already closed
    }
  }

  isOpen(): boolean {
    try {
      return this.dc.isOpen();
    } catch {
      return false;
    }
  }
}

function waitForGathering(pc: nodeDataChannel.PeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.gatheringState() === "complete") {
      resolve();
      return;
    }

    const timeout = setTimeout(() => resolve(), ICE_GATHERING_TIMEOUT_MS);

    pc.onGatheringStateChange((state) => {
      if (state === "complete") {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

interface OfferResult {
  offerCode: string;
  acceptAnswer: (answerCode: string) => void;
  transport: Promise<DuetTransport>;
  cleanup: () => void;
}

export function createOffer(sessionCode: string, iceServers = DEFAULT_ICE_SERVERS): Promise<OfferResult> {
  return new Promise((resolve, reject) => {
    const pc = new PeerConnection("host", { iceServers });
    const candidates: Array<{ candidate: string; mid: string }> = [];

    let transportResolved = false;
    let transportResolve: (t: DuetTransport) => void;
    let transportReject: (e: Error) => void;
    const transportPromise = new Promise<DuetTransport>((res, rej) => {
      transportResolve = (t) => { transportResolved = true; res(t); };
      transportReject = rej;
    });
    // Prevent unhandled rejection when cleanup closes the peer connection
    transportPromise.catch(() => {});

    const dc = pc.createDataChannel("duet");

    dc.onOpen(() => {
      const transport = new DataChannelTransport(dc);
      transportResolve(transport);
    });

    dc.onError((err) => {
      transportReject(new Error(`Data channel error: ${err}`));
    });

    pc.onLocalCandidate((candidate, mid) => {
      candidates.push({ candidate, mid });
    });

    pc.onStateChange((state) => {
      if ((state === "failed" || state === "closed") && !transportResolved) {
        transportReject(new Error(`Peer connection ${state}`));
      }
    });

    pc.setLocalDescription("offer");

    waitForGathering(pc).then(() => {
      const desc = pc.localDescription();
      if (!desc) {
        reject(new Error("Failed to create local description"));
        return;
      }

      const offerCode = encodeSDP({
        sdp: desc.sdp,
        candidates,
        sessionCode,
      });

      resolve({
        offerCode,
        acceptAnswer: (answerCode: string) => {
          const answer = decodeSDP(answerCode);
          pc.setRemoteDescription(answer.sdp, "answer");
          for (const c of answer.candidates) {
            pc.addRemoteCandidate(c.candidate, c.mid);
          }
        },
        transport: transportPromise,
        cleanup: () => {
          try { dc.close(); } catch {}
          try { pc.close(); } catch {}
        },
      });
    });
  });
}

interface AnswerResult {
  answerCode: string;
  sessionCode: string;
  transport: Promise<DuetTransport>;
  cleanup: () => void;
}

export function createAnswer(offerCode: string, iceServers = DEFAULT_ICE_SERVERS): Promise<AnswerResult> {
  return new Promise((resolve, reject) => {
    const offer = decodeSDP(offerCode);
    const pc = new PeerConnection("guest", { iceServers });
    const candidates: Array<{ candidate: string; mid: string }> = [];

    let transportResolved = false;
    let transportResolve: (t: DuetTransport) => void;
    let transportReject: (e: Error) => void;
    const transportPromise = new Promise<DuetTransport>((res, rej) => {
      transportResolve = (t) => { transportResolved = true; res(t); };
      transportReject = rej;
    });
    // Prevent unhandled rejection when cleanup closes the peer connection
    transportPromise.catch(() => {});

    pc.onDataChannel((dc) => {
      dc.onOpen(() => {
        const transport = new DataChannelTransport(dc);
        transportResolve(transport);
      });

      dc.onError((err) => {
        transportReject(new Error(`Data channel error: ${err}`));
      });
    });

    pc.onLocalCandidate((candidate, mid) => {
      candidates.push({ candidate, mid });
    });

    pc.onStateChange((state) => {
      if ((state === "failed" || state === "closed") && !transportResolved) {
        transportReject(new Error(`Peer connection ${state}`));
      }
    });

    pc.setRemoteDescription(offer.sdp, "offer");
    for (const c of offer.candidates) {
      pc.addRemoteCandidate(c.candidate, c.mid);
    }

    waitForGathering(pc).then(() => {
      const desc = pc.localDescription();
      if (!desc) {
        reject(new Error("Failed to create local description"));
        return;
      }

      const answerCode = encodeSDP({
        sdp: desc.sdp,
        candidates,
        sessionCode: offer.sessionCode,
      });

      resolve({
        answerCode,
        sessionCode: offer.sessionCode,
        transport: transportPromise,
        cleanup: () => {
          try { pc.close(); } catch {}
        },
      });
    });
  });
}
