import { gzipSync, gunzipSync } from "node:zlib";

interface SDPPayload {
  sdp: string;
  candidates: Array<{ candidate: string; mid: string }>;
  sessionCode: string;
}

// Compact format for smaller codes
interface CompactPayload {
  s: string;  // sdp (stripped)
  c: string[]; // candidates as "mid|candidate" strings
  k: string;  // sessionCode
}

// SDP lines that are unnecessary for data-channel-only connections
const STRIP_PREFIXES = [
  "a=extmap",
  "a=rtpmap",
  "a=fmtp",
  "a=rtcp-fb",
  "a=msid",
  "a=ssrc",
  "a=rid",
  "a=simulcast",
  "b=",
];

function stripSDP(sdp: string): string {
  if (!sdp) return "";
  return sdp
    .split("\r\n")
    .filter((line) => !STRIP_PREFIXES.some((p) => line.startsWith(p)))
    .join("\r\n");
}

function toCompact(payload: SDPPayload): CompactPayload {
  return {
    s: stripSDP(payload.sdp),
    c: payload.candidates.map((c) => `${c.mid}|${c.candidate}`),
    k: payload.sessionCode,
  };
}

function fromCompact(compact: CompactPayload): SDPPayload {
  return {
    sdp: compact.s,
    candidates: compact.c.map((entry) => {
      const sep = entry.indexOf("|");
      return { mid: entry.slice(0, sep), candidate: entry.slice(sep + 1) };
    }),
    sessionCode: compact.k,
  };
}

export function encodeSDP(payload: SDPPayload): string {
  const compact = toCompact(payload);
  const json = JSON.stringify(compact);
  const compressed = gzipSync(Buffer.from(json, "utf-8"), { level: 9 });
  return compressed.toString("base64url");
}

export function decodeSDP(code: string): SDPPayload {
  const compressed = Buffer.from(code, "base64url");
  const json = gunzipSync(compressed).toString("utf-8");
  const raw = JSON.parse(json);

  // Support both compact (s/c/k) and legacy (sdp/candidates/sessionCode) formats
  if (raw.s !== undefined) {
    const payload = fromCompact(raw as CompactPayload);
    if (!payload.sdp || !payload.sessionCode) {
      throw new Error("Invalid offer/answer code");
    }
    return payload;
  }

  const payload = raw as SDPPayload;
  if (!payload.sdp || !payload.sessionCode) {
    throw new Error("Invalid offer/answer code");
  }
  return payload;
}
