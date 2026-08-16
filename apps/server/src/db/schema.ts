import {
  pgTable,
  uuid,
  text,
  timestamp,
  inet,
  integer,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Anonymous device tokens (Tier 1 identity)
export const anonymousDevices = pgTable(
  "anonymous_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceToken: uuid("device_token").notNull().unique(),
    fingerprint: text("fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    purgeAfter: timestamp("purge_after", { withTimezone: true })
      .default(sql`NOW() + INTERVAL '30 days'`)
      .notNull(),
  },
  (table) => [
    index("idx_anon_devices_token").on(table.deviceToken),
    index("idx_anon_devices_purge").on(table.purgeAfter),
  ]
);

// Google-authenticated users (Tier 2 identity)
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleId: text("google_id").notNull().unique(),
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    banReason: text("ban_reason"),
  },
  (table) => [index("idx_users_google").on(table.googleId)]
);

// Sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id").references(() => anonymousDevices.id),
    userId: uuid("user_id").references(() => users.id),
    ipAddress: inet("ip_address").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    banReason: text("ban_reason"),
  },
  (table) => [
    index("idx_sessions_device").on(table.deviceId),
    index("idx_sessions_user").on(table.userId),
    index("idx_sessions_ip").on(table.ipAddress),
  ]
);

// Matches base table
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionAId: uuid("session_a_id").notNull().references(() => sessions.id),
    sessionBId: uuid("session_b_id").notNull().references(() => sessions.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason"),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("idx_matches_session_a").on(table.sessionAId),
    index("idx_matches_session_b").on(table.sessionBId),
  ]
);

// Meet history
export const meetHistory = pgTable(
  "meet_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id),
    viewerDeviceId: uuid("viewer_device_id").references(() => anonymousDevices.id),
    viewerUserId: uuid("viewer_user_id").references(() => users.id),
    peerFingerprint: text("peer_fingerprint"),
    peerUserId: uuid("peer_user_id").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms"),
    endReason: text("end_reason"),
    wasReported: boolean("was_reported").default(false).notNull(),
    wasBlocked: boolean("was_blocked").default(false).notNull(),
  },
  (table) => [
    index("idx_meet_history_device").on(table.viewerDeviceId),
    index("idx_meet_history_user").on(table.viewerUserId),
    index("idx_meet_history_started").on(table.startedAt),
  ]
);

// Reports
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").notNull().references(() => sessions.id),
    reportedId: uuid("reported_id").notNull().references(() => sessions.id),
    matchId: uuid("match_id").references(() => matches.id),
    category: text("category").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
  },
  (table) => [index("idx_reports_reported").on(table.reportedId)]
);

// Blocks
export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerSessionId: uuid("blocker_session_id").references(() => sessions.id),
    blockerUserId: uuid("blocker_user_id").references(() => users.id),
    blockerDeviceId: uuid("blocker_device_id").references(() => anonymousDevices.id),
    blockedFingerprint: text("blocked_fingerprint").notNull(),
    blockedUserId: uuid("blocked_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_blocks_device").on(table.blockerDeviceId),
    index("idx_blocks_user").on(table.blockerUserId),
  ]
);

// Bans
export const bans = pgTable(
  "bans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => sessions.id),
    userId: uuid("user_id").references(() => users.id),
    ipAddress: inet("ip_address"),
    fingerprint: text("fingerprint"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").default("system").notNull(),
  },
  (table) => [
    index("idx_bans_ip").on(table.ipAddress),
    index("idx_bans_fingerprint").on(table.fingerprint),
  ]
);

// Chat messages
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id),
    senderSessionId: uuid("sender_session_id").notNull().references(() => sessions.id),
    content: text("content").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    isDeletedForEveryone: boolean("is_deleted_for_everyone").default(false).notNull(),
    deletedForEveryoneAt: timestamp("deleted_for_everyone_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true })
      .default(sql`NOW() + INTERVAL '7 days'`)
      .notNull(),
  },
  (table) => [
    index("idx_chat_messages_match").on(table.matchId),
    index("idx_chat_messages_sender").on(table.senderSessionId),
    index("idx_chat_messages_purge").on(table.purgeAfter),
  ]
);

// Chat message deletions (soft delete for sender)
export const chatMessageDeletions = pgTable(
  "chat_message_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull().references(() => sessions.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.messageId, table.sessionId),
    index("idx_chat_deletions_message").on(table.messageId),
    index("idx_chat_deletions_session").on(table.sessionId),
  ]
);

// Chat session deletions (delete entire chat view for user)
export const chatSessionDeletions = pgTable(
  "chat_session_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id),
    sessionId: uuid("session_id").notNull().references(() => sessions.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.matchId, table.sessionId),
    index("idx_chat_session_del_match").on(table.matchId),
    index("idx_chat_session_del_session").on(table.sessionId),
  ]
);

// Friendships
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").references(() => matches.id),
    userASessionId: uuid("user_a_session_id").notNull().references(() => sessions.id),
    userAUserId: uuid("user_a_user_id").references(() => users.id),
    userADeviceId: uuid("user_a_device_id").references(() => anonymousDevices.id),
    userBSessionId: uuid("user_b_session_id").notNull().references(() => sessions.id),
    userBUserId: uuid("user_b_user_id").references(() => users.id),
    userBDeviceId: uuid("user_b_device_id").references(() => anonymousDevices.id),
    origin: text("origin").default("auto_duration").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userASessionId, table.userBSessionId),
    index("idx_friendships_a").on(table.userASessionId),
    index("idx_friendships_b").on(table.userBSessionId),
  ]
);

// Friend calls
export const friendCalls = pgTable(
  "friend_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    friendshipId: uuid("friendship_id").notNull().references(() => friendships.id),
    callerSessionId: uuid("caller_session_id").notNull().references(() => sessions.id),
    calleeSessionId: uuid("callee_session_id").notNull().references(() => sessions.id),
    status: text("status").default("ringing").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [index("idx_friend_calls_friendship").on(table.friendshipId)]
);

// Direct messages
export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    friendshipId: uuid("friendship_id").notNull().references(() => friendships.id),
    senderSessionId: uuid("sender_session_id").notNull().references(() => sessions.id),
    content: text("content").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    isDeletedForEveryone: boolean("is_deleted_for_everyone").default(false).notNull(),
    deletedForEveryoneAt: timestamp("deleted_for_everyone_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true })
      .default(sql`NOW() + INTERVAL '90 days'`)
      .notNull(),
  },
  (table) => [
    index("idx_dm_friendship").on(table.friendshipId),
    index("idx_dm_sender").on(table.senderSessionId),
    index("idx_dm_purge").on(table.purgeAfter),
  ]
);

// DM deletions
export const dmDeletions = pgTable(
  "dm_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => directMessages.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull().references(() => sessions.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.messageId, table.sessionId)]
);
