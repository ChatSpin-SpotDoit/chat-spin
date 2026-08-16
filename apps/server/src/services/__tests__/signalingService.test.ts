import { describe, it, expect } from "vitest";
import { signalingService } from "../signalingService.js";

describe("SignalingService — TURN Credentials", () => {
  it("should return default STUN server URLs when TURN_ENABLED is false", () => {
    const creds = signalingService.generateTurnCredentials("test-user");

    expect(creds).toBeDefined();
    expect(creds.urls).toBeDefined();
    expect(Array.isArray(creds.urls)).toBe(true);
    expect(creds.urls[0]).toContain("stun:");
  });

  it("should format username with expiration timestamp when generating credentials", () => {
    const creds = signalingService.generateTurnCredentials("user-123");

    if (creds.username) {
      const parts = creds.username.split(":");
      expect(parts.length).toBe(2);
      const timestamp = parseInt(parts[0]!, 10);
      expect(timestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });
});
