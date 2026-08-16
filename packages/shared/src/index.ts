// Session states — server-authoritative
export enum SessionState {
  CONNECTING = "CONNECTING",
  READY = "READY",
  SEARCHING = "SEARCHING",
  MATCH_FOUND = "MATCH_FOUND",
  IN_CALL = "IN_CALL",
  DISCONNECTED = "DISCONNECTED",
}

// Match states
export enum MatchState {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  ENDING = "ENDING",
  ENDED = "ENDED",
}

// Match end reasons
export enum MatchEndReason {
  SKIP = "skip",
  DISCONNECT = "disconnect",
  BAN = "ban",
  ERROR = "error",
  TIMEOUT = "timeout",
}

// Friend call states
export enum FriendCallState {
  RINGING = "ringing",
  ACTIVE = "active",
  ENDED = "ended",
  DECLINED = "declined",
  NO_ANSWER = "no-answer",
}

// Friendship origin
export enum FriendshipOrigin {
  AUTO_DURATION = "auto_duration",
}

// WebRTC peer roles
export enum PeerRole {
  OFFERER = "offerer",
  ANSWERER = "answerer",
}

// Identity type
export enum IdentityType {
  ANONYMOUS = "anonymous",
  GOOGLE = "google",
}

// Chat deletion scope
export enum ChatDeleteScope {
  ME = "me",
  EVERYONE = "everyone",
}

// WS error codes
export enum WsErrorCode {
  PROTOCOL_VERSION_MISMATCH = "PROTOCOL_VERSION_MISMATCH",
  DUPLICATE_SESSION = "DUPLICATE_SESSION",
  AUTH_ERROR = "AUTH_ERROR",
  BANNED = "BANNED",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_STATE = "INVALID_STATE",
  MATCH_NOT_FOUND = "MATCH_NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  FRIEND_OFFLINE = "FRIEND_OFFLINE",
  FRIEND_BUSY = "FRIEND_BUSY",
  NOT_FRIENDS = "NOT_FRIENDS",
}

// Presence states
export enum PresenceState {
  ONLINE = "online",
  BUSY = "busy",
  OFFLINE = "offline",
}

// Current WebSocket protocol version
export const PROTOCOL_VERSION = 1 as const;

// Heartbeat interval the client should use (ms)
export const HEARTBEAT_INTERVAL_MS = 15_000 as const;

// How long the server waits before marking a session disconnected (ms)
export const SESSION_HEARTBEAT_TIMEOUT_MS = 30_000 as const;

// Presence TTL in Redis (ms)
export const PRESENCE_TTL_MS = 35_000 as const;

// How long after disconnect a client can reconnect to restore their session (ms)
export const SESSION_RECONNECT_WINDOW_MS = 10_000 as const;

// Max text chat message length (chars) — enforced at app + DB level
export const CHAT_MAX_MESSAGE_LENGTH = 1_000 as const;

// Max DM message length (chars)
export const DM_MAX_MESSAGE_LENGTH = 2_000 as const;

// "Delete for everyone" window (ms)
export const CHAT_DELETE_EVERYONE_WINDOW_MS = 300_000 as const;

// Retention purge threshold (days)
export const CHAT_RETENTION_DAYS = 7 as const;
