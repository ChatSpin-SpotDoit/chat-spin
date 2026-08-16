import { describe, it, expect } from "vitest";
import { ClientMessageSchema } from "@chatspin/protocol";
import { PROTOCOL_VERSION } from "@chatspin/shared";

describe("Protocol — Zod Message Schema Validation", () => {
  it("should validate a valid session:init message", () => {
    const validMsg = {
      type: "session:init",
      protocolVersion: PROTOCOL_VERSION,
      deviceToken: "123e4567-e89b-12d3-a456-426614174000",
      requestId: "123e4567-e89b-12d3-a456-426614174001",
    };

    const result = ClientMessageSchema.safeParse(validMsg);
    expect(result.success).toBe(true);
  });

  it("should reject session:init if protocol version does not match", () => {
    const invalidMsg = {
      type: "session:init",
      protocolVersion: 999, // Mismatched version
      deviceToken: "123e4567-e89b-12d3-a456-426614174000",
      requestId: "123e4567-e89b-12d3-a456-426614174001",
    };

    const result = ClientMessageSchema.safeParse(invalidMsg);
    expect(result.success).toBe(false);
  });

  it("should validate a valid chat:message payload", () => {
    const validChat = {
      type: "chat:message",
      matchId: "123e4567-e89b-12d3-a456-426614174000",
      messageId: "123e4567-e89b-12d3-a456-426614174001",
      content: "Hello world!",
      requestId: "123e4567-e89b-12d3-a456-426614174002",
    };

    const result = ClientMessageSchema.safeParse(validChat);
    expect(result.success).toBe(true);
  });

  it("should reject chat:message exceeding 1000 characters", () => {
    const longChat = {
      type: "chat:message",
      matchId: "123e4567-e89b-12d3-a456-426614174000",
      messageId: "123e4567-e89b-12d3-a456-426614174001",
      content: "a".repeat(1001),
      requestId: "123e4567-e89b-12d3-a456-426614174002",
    };

    const result = ClientMessageSchema.safeParse(longChat);
    expect(result.success).toBe(false);
  });
});
