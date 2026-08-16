import { z } from "zod";
import {
  PROTOCOL_VERSION,
  WsErrorCode,
  ChatDeleteScope,
} from "@chatspin/shared";

const uuid = z.string().uuid();
const requestId = z.string().uuid();

// ─── Client -> Server Messages ───────────────────────────────────────────────

export const SessionInitSchema = z.object({
  type: z.literal("session:init"),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  deviceToken: uuid,
  authToken: z.string().optional(),
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

export const ChatMessageDeleteSchema = z.object({
  type: z.literal("chat:message-delete"),
  matchId: uuid,
  messageId: uuid,
  scope: z.nativeEnum(ChatDeleteScope),
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
  ChatMessageDeleteSchema,
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

// ─── Server -> Client Message Interfaces ─────────────────────────────────────

export interface SessionReadyMessage {
  type: "session:ready";
  sessionId: string;
  identityType: string;
}

export interface HeartbeatAckMessage {
  type: "heartbeat:ack";
}

export interface QueueJoinedMessage {
  type: "queue:joined";
  joinedAtMs: number;
}

export interface QueueLeftMessage {
  type: "queue:left";
}

export interface MatchFoundMessage {
  type: "match:found";
  matchId: string;
  peerSessionId: string;
  role: "offerer" | "answerer";
  turnCredentials: {
    urls: string[];
    username: string;
    credential: string;
  };
}

export interface MatchSkippedMessage {
  type: "match:skipped";
  matchId: string;
}

export interface PeerDisconnectedMessage {
  type: "peer:disconnected";
  matchId: string;
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
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface ChatMessageRelayMessage {
  type: "chat:message";
  matchId: string;
  messageId: string;
  senderSessionId: string;
  content: string;
  sentAt: string;
}

export interface ChatMessageDeletedRelayMessage {
  type: "chat:message-deleted";
  matchId: string;
  messageId: string;
  scope: ChatDeleteScope;
}

export interface FriendAutoConnectedMessage {
  type: "friend:auto-connected";
  friendshipId: string;
  friendSessionId: string;
}

export interface FriendPresenceMessage {
  type: "friend:presence";
  friendSessionId: string;
  status: "online" | "busy" | "offline";
}

export interface FriendIncomingCallMessage {
  type: "friend:incoming-call";
  callId: string;
  friendshipId: string;
  callerSessionId: string;
}

export interface FriendCallDeclinedMessage {
  type: "friend:call-declined";
  callId: string;
  reason: string;
}

export interface FriendCallConnectedMessage {
  type: "friend:call-connected";
  callId: string;
  role: "offerer" | "answerer";
}

export interface FriendCallEndedMessage {
  type: "friend:call-ended";
  callId: string;
}

export interface FriendWebRtcOfferMessage {
  type: "friend:webrtc:offer";
  callId: string;
  sdp: string;
}

export interface FriendWebRtcAnswerMessage {
  type: "friend:webrtc:answer";
  callId: string;
  sdp: string;
}

export interface FriendWebRtcIceCandidateMessage {
  type: "friend:webrtc:ice-candidate";
  callId: string;
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface FriendRemovedMessage {
  type: "friend:removed";
  friendshipId: string;
}

export interface DmMessageRelayMessage {
  type: "dm:message";
  friendshipId: string;
  messageId: string;
  senderSessionId: string;
  content: string;
  sentAt: string;
}

export interface ErrorMessage {
  type: "error";
  code: WsErrorCode;
  message: string;
  requestId?: string;
}

export type ServerMessage =
  | SessionReadyMessage
  | HeartbeatAckMessage
  | QueueJoinedMessage
  | QueueLeftMessage
  | MatchFoundMessage
  | MatchSkippedMessage
  | PeerDisconnectedMessage
  | WebRtcOfferRelayMessage
  | WebRtcAnswerRelayMessage
  | WebRtcIceCandidateRelayMessage
  | ChatMessageRelayMessage
  | ChatMessageDeletedRelayMessage
  | FriendAutoConnectedMessage
  | FriendPresenceMessage
  | FriendIncomingCallMessage
  | FriendCallDeclinedMessage
  | FriendCallConnectedMessage
  | FriendCallEndedMessage
  | FriendWebRtcOfferMessage
  | FriendWebRtcAnswerMessage
  | FriendWebRtcIceCandidateMessage
  | FriendRemovedMessage
  | DmMessageRelayMessage
  | ErrorMessage;
