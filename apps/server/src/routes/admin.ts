import type { FastifyInstance } from "fastify";
import { moderationService } from "../services/moderationService.js";

export async function adminRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      ipAddress?: string;
      fingerprint?: string;
      userId?: string;
      reason: string;
      durationHours?: number;
    };
  }>("/admin/bans", async (req, reply) => {
    const { ipAddress, fingerprint, userId, reason, durationHours } = req.body;

    if (!reason) {
      return reply.status(400).send({ error: "reason is required" });
    }

    const expiresAt = durationHours
      ? new Date(Date.now() + durationHours * 3600 * 1000)
      : undefined;

    await moderationService.applyBan({
      ipAddress,
      fingerprint,
      userId,
      reason,
      expiresAt,
    });

    return reply.status(200).send({ status: "ok", message: "Ban applied successfully" });
  });
}
