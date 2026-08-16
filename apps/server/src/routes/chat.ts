import type { FastifyInstance } from "fastify";
import { chatService } from "../services/chatService.js";
import { db } from "../lib/db.js";
import { meetHistory, chatMessages } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export async function chatRoutes(app: FastifyInstance) {
  // Delete a specific chat message
  app.delete<{
    Params: { messageId: string };
    Querystring: { scope?: "me" | "everyone" };
  }>("/api/chat/messages/:messageId", async (req, reply) => {
    const { messageId } = req.params;
    const scope = req.query.scope ?? "me";
    const sessionId = (req.headers["x-session-id"] as string) || "";

    if (!sessionId) {
      return reply.status(401).send({ error: "x-session-id header required" });
    }

    const result = await chatService.deleteMessage({
      messageId,
      sessionId,
      scope,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(200).send({ status: "ok", scope });
  });

  // Delete an entire chat session view for user
  app.delete<{
    Params: { matchId: string };
  }>("/api/chat/sessions/:matchId", async (req, reply) => {
    const { matchId } = req.params;
    const sessionId = (req.headers["x-session-id"] as string) || "";

    if (!sessionId) {
      return reply.status(401).send({ error: "x-session-id header required" });
    }

    await chatService.deleteSessionChat(matchId, sessionId);
    return reply.status(200).send({ status: "ok" });
  });

  // Get past meets history
  app.get("/api/chat/history", async (req, reply) => {
    const sessionId = (req.headers["x-session-id"] as string) || "";
    if (!sessionId) {
      return reply.status(401).send({ error: "x-session-id header required" });
    }

    const history = await db
      .select()
      .from(meetHistory)
      .orderBy(desc(meetHistory.startedAt))
      .limit(50);

    return reply.status(200).send({ history });
  });

  // Get messages for a match
  app.get<{
    Params: { matchId: string };
  }>("/api/chat/:matchId/messages", async (req, reply) => {
    const { matchId } = req.params;

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.matchId, matchId))
      .orderBy(chatMessages.sentAt);

    return reply.status(200).send({ messages });
  });
}
