import type { FastifyInstance } from "fastify";
import { friendsService } from "../services/friendsService.js";
import { db } from "../lib/db.js";
import { directMessages } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export async function friendsRoutes(app: FastifyInstance) {
  // Get friends list with real-time presence
  app.get("/api/friends", async (req, reply) => {
    const sessionId = (req.headers["x-session-id"] as string) || "";
    if (!sessionId) {
      return reply.status(401).send({ error: "x-session-id header required" });
    }

    const friends = await friendsService.getFriendsList(sessionId);
    return reply.status(200).send({ friends });
  });

  // Unfriend contact
  app.delete<{
    Params: { friendshipId: string };
  }>("/api/friends/:friendshipId", async (req, reply) => {
    const { friendshipId } = req.params;
    const sessionId = (req.headers["x-session-id"] as string) || "";

    if (!sessionId) {
      return reply.status(401).send({ error: "x-session-id header required" });
    }

    await friendsService.removeFriend(friendshipId, sessionId);
    return reply.status(200).send({ status: "ok" });
  });

  // Get DM messages history with friend
  app.get<{
    Params: { friendshipId: string };
  }>("/api/friends/:friendshipId/messages", async (req, reply) => {
    const { friendshipId } = req.params;

    const messages = await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.friendshipId, friendshipId))
      .orderBy(directMessages.sentAt);

    return reply.status(200).send({ messages });
  });
}
