import { z } from "zod";
import {
  PROTOCOL_VERSION,
  ChatDeleteScope,
  PeerRole,
  WsErrorCode,
} from "@chatspin/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uuid = z.string().uuid();
const requestId = uuid.describe("client-generated idempotency key");

// ─── Client → Server Messages ─────────────────────────────────────────────────

export const SessionInitSchema = z.object({
  type: z.literal("session:init"),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  deviceToken: uuid.describe("UUID from localStorage — always present"),
  authToken: z.string().optional().describe("NextAuth JWT — present if logged in"),
  requestId,
});

export const HeartbeatSchema = z.object({
  type: z.literal("heartbeat"),
});

export const QueueJoinSchema = z.object({
  type: z.literal("queue:join"),
  requestId,
});

export const QueueLeaveSchema = z.object({
  type: z.literal("queue:leave"),
  requestId,
});

export const MatchSkipSchema = z.object({
  type: z.literal("match:skip"),
  matchId: uuid,
  requestId,
});

export const MatchReportSchema = z.object({
  type: z.literal("match:report"),
  matchId: uuid,
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  requestId,
});

export const MatchBlockSchema = z.object({
  type: z.literal("match:block"),
  matchId: uuid,
  requestId,
});

export const WebRtcOfferSchema = z.object({
  type: z.literal("webrtc:offer"),
  matchId: uuid,
  sdp: z.string().min(1),
  requestId,
});

export const WebRtcAnswerSchema = z.object({
  type: z.literal("webrtc:answer"),
  matchId: uuid,
  sdp: z.string().min(1),
  requestId,
});

export const WebRtcIceCandidateSchema = z.object({
  type: z.literal("webrtc:ice-candidate"),
  matchId: uuid,
  candidate: z.string(),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().int().nullable(),
  requestId,
});

export const ChatMessageSchema = z.object({
  type: z.literal("chat:message"),
  matchId: uuid,
  messageId: uuid.describe("client-generated UUID for idempotency"),
  content: z.string().min(1).max(1000),
  requestId,
});

export const FriendCallSchema = z.object({
  type: z.literal("friend:call"),
  friendshipId: uuid,
  callId: uuid.describe("client-generated call UUID"),
  requestId,
});

export const FriendCallAcceptSchema = z.object({
  type: z.literal("friend:call-accept"),
  callId: uuid,
  requestId,
});

export const FriendCallDeclineSchema = z.object({
  type: z.literal("friend:call-decline"),
  callId: uuid,
  requestId,
});

export const FriendCallEndSchema = z.object({
  type: z.literal("friend:call-end"),
  callId: uuid,
  requestId,
});

export const FriendWebRtcOfferSchema = z.object({
  type: z.literal("friend:webrtc:offer"),
  callId: uuid,
  sdp: z.string().min(1),
  requestId,
});

export const FriendWebRtcAnswerSchema = z.object({
  type: z.literal("friend:webrtc:answer"),
  callId: uuid,
  sdp: z.string().min(1),
  requestId,
});

export const FriendWebRtcIceCandidateSchema = z.object({
  type: z.literal("friend:webrtc:ice-candidate"),
  callId: uuid,
  candidate: z.string(),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().int().nullable(),
  requestId,
});

export const DmMessageSchema = z.object({
  type: z.literal("dm:message"),
  friendshipId: uuid,
  messageId: uuid.describe("client-generated UUID for idempotency"),
  content: z.string().min(1).max(2000),
  requestId,
});

export const DmMessageDeleteSchema = z.object({
  type: z.literal("dm:message-delete"),
  messageId: uuid,
  scope: z.nativeEnum(ChatDeleteScope),
  requestId,
});

// ─── Union of all inbound messages ───────────────────────────────────────────

export const ClientMessageSchema = z.discriminatedUnion("type", [
  SessionInitSchema,
  HeartbeatSchema,
  QueueJoinSchema,
  QueueLeaveSchema,
  MatchSkipSchema,
  MatchReportSchema,
  MatchBlockSchema,
  WebRtcOfferSchema,
  WebRtcAnswerSchema,
  WebRtcIceCandidateSchema,
  ChatMessageSchema,
  FriendCallSchema,
  FriendCallAcceptSchema,
  FriendCallDeclineSchema,
  FriendCallEndSchema,
  FriendWebRtcOfferSchema,
  FriendWebRtcAnswerSchema,
  FriendWebRtcIceCandidateSchema,
  DmMessageSchema,
  DmMessageDeleteSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ─── Server → Client Messages ─────────────────────────────────────────────────

export interface SessionReadyMessage {
  type: "session:ready";
  sessionId: string;
  identityType: "anonymous" | "google";
}

export interface HeartbeatAckMessage {
  type: "heartbeat:ack";
  serverTime: number;
}

export interface WsErrorMessage {
  type: "error";
  code: WsErrorCode;
  message: string;
  requestId?: string;
}

export interface QueueJoinedMessage {
  type: "queue:joined";
  position: number;
  requestId: string;
}

export interface QueueLeftMessage {
  type: "queue:left";
  requestId: string;
}

export interface MatchFoundMessage {
  type: "match:found";
  matchId: string;
  role: PeerRole;
  turnCredentials: {
    urls: string[];
    username: string;
    credential: string;
  };
}

export interface PeerDisconnectedMessage {
  type: "peer:disconnected";
  matchId: string;
  reason: string;
}

export interface WebRtcOfferRelayMessage {
  type: "webrtc:offer";
  matchId: string;
  sdp: string;
}

export interface WebRtcAnswerRelayMessage {
  type: "webrtc:answer";
  matchId: string;
  sdp: string;
}

export interface WebRtcIceCandidateRelayMessage {
  type: "webrtc:ice-candidate";
  matchId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface ChatMessageDeliveryMessage {
  type: "chat:message";
  matchId: string;
  messageId: string;
  content: string;
  senderSessionId: string;
  sentAt: string; // ISO 8601
}

export interface ChatMessageDeletedMessage {
  type: "chat:message-deleted";
  matchId: string;
  messageId: string;
}

export interface FriendAutoConnectedMessage {
  type: "friend:auto-connected";
  friendshipId: string;
}

export interface FriendIncomingCallMessage {
  type: "friend:incoming-call";
  callId: string;
  friendshipId: string;
  fromDisplayName: string;
}

export interface FriendCallAcceptedMessage {
  type: "friend:call-accepted";
  callId: string;
  role: PeerRole;
  turnCredentials: {
    urls: string[];
    username: string;
    credential: string;
  };
}

export interface FriendCallDeclinedMessage {
  type: "friend:call-declined";
  callId: string;
}

export interface FriendCallNoAnswerMessage {
  type: "friend:call-no-answer";
  callId: string;
}

export interface FriendPresenceMessage {
  type: "friend:online" | "friend:offline" | "friend:busy" | "friend:free";
  friendshipId: string;
}

export interface FriendRemovedMessage {
  type: "friend:removed";
  friendshipId: string;
}

export interface DmMessageDeliveryMessage {
  type: "dm:message";
  friendshipId: string;
  messageId: string;
  content: string;
  senderSessionId: string;
  sentAt: string; // ISO 8601
}

export interface DmMessageDeletedMessage {
  type: "dm:message-deleted";
  friendshipId: string;
  messageId: string;
}

export interface FriendWebRtcOfferRelayMessage {
  type: "friend:webrtc:offer";
  callId: string;
  sdp: string;
}

export interface FriendWebRtcAnswerRelayMessage {
  type: "friend:webrtc:answer";
  callId: string;
  sdp: string;
}

export interface FriendWebRtcIceCandidateRelayMessage {
  type: "friend:webrtc:ice-candidate";
  callId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type ServerMessage =
  | SessionReadyMessage
  | HeartbeatAckMessage
  | WsErrorMessage
  | QueueJoinedMessage
  | QueueLeftMessage
  | MatchFoundMessage
  | PeerDisconnectedMessage
  | WebRtcOfferRelayMessage
  | WebRtcAnswerRelayMessage
  | WebRtcIceCandidateRelayMessage
  | ChatMessageDeliveryMessage
  | ChatMessageDeletedMessage
  | FriendAutoConnectedMessage
  | FriendIncomingCallMessage
  | FriendCallAcceptedMessage
  | FriendCallDeclinedMessage
  | FriendCallNoAnswerMessage
  | FriendPresenceMessage
  | FriendRemovedMessage
  | DmMessageDeliveryMessage
  | DmMessageDeletedMessage
  | FriendWebRtcOfferRelayMessage
  | FriendWebRtcAnswerRelayMessage
  | FriendWebRtcIceCandidateRelayMessage;
