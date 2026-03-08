// ---- Base ----

export interface BaseMessage {
  type: string;
  timestamp: number;
}

// ---- Client → Server ----

export interface PromptMessage extends BaseMessage {
  type: "prompt";
  id: string;
  user: string;
  text: string;
}

export interface TypingMessage extends BaseMessage {
  type: "typing";
  user: string;
  isTyping: boolean;
}

export interface ApprovalResponse extends BaseMessage {
  type: "approval_response";
  promptId: string;
  approved: boolean;
}

export interface JoinRequest extends BaseMessage {
  type: "join";
  user: string;
  passwordHash: string;
}

// ---- Server → Client(s) ----

export interface JoinAccepted extends BaseMessage {
  type: "join_accepted";
  sessionId: string;
  hostUser: string;
  approvalMode: boolean;
}

export interface JoinRejected extends BaseMessage {
  type: "join_rejected";
  reason: string;
}

export interface PromptReceived extends BaseMessage {
  type: "prompt_received";
  promptId: string;
  user: string;
  text: string;
}

export interface ApprovalRequest extends BaseMessage {
  type: "approval_request";
  promptId: string;
  user: string;
  text: string;
}

export interface StreamChunk extends BaseMessage {
  type: "stream_chunk";
  text: string;
}

export interface ToolUseMessage extends BaseMessage {
  type: "tool_use";
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolResultMessage extends BaseMessage {
  type: "tool_result";
  tool: string;
  output: string;
}

export interface TurnComplete extends BaseMessage {
  type: "turn_complete";
  cost: number;
  durationMs: number;
}

export interface PresenceMessage extends BaseMessage {
  type: "presence";
  users: Array<{ name: string; role: "host" | "guest" }>;
}

export interface NoticeMessage extends BaseMessage {
  type: "notice";
  message: string;
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  message: string;
}

// ---- Union Types ----

export type ClientMessage =
  | PromptMessage
  | TypingMessage
  | ApprovalResponse
  | JoinRequest;

export type ServerMessage =
  | JoinAccepted
  | JoinRejected
  | PromptReceived
  | ApprovalRequest
  | StreamChunk
  | ToolUseMessage
  | ToolResultMessage
  | TurnComplete
  | PresenceMessage
  | NoticeMessage
  | ErrorMessage;

export type Message = ClientMessage | ServerMessage;

// ---- Type Guards ----

export function isPromptMessage(msg: unknown): msg is PromptMessage {
  return isObject(msg) && msg.type === "prompt";
}

export function isStreamChunk(msg: unknown): msg is StreamChunk {
  return isObject(msg) && msg.type === "stream_chunk";
}

export function isApprovalRequest(msg: unknown): msg is ApprovalRequest {
  return isObject(msg) && msg.type === "approval_request";
}

export function isApprovalResponse(msg: unknown): msg is ApprovalResponse {
  return isObject(msg) && msg.type === "approval_response";
}

export function isPresenceMessage(msg: unknown): msg is PresenceMessage {
  return isObject(msg) && msg.type === "presence";
}

export function isJoinRequest(msg: unknown): msg is JoinRequest {
  return isObject(msg) && msg.type === "join";
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && "type" in val;
}
