import { describe, expect, it } from "vitest";

import {
  latchChatActivation,
  shouldKeepChatHost,
} from "./chat-activation";

describe("chat host activation latch", () => {
  it("stays false until a keep-alive route is visited, then sticks", () => {
    expect(latchChatActivation(false, false)).toBe(false);
    expect(latchChatActivation(false, true)).toBe(true);
    expect(latchChatActivation(true, false)).toBe(true);
  });

  it("keeps the host for chat and the Agents spawn tree, not overlay dests", () => {
    expect(shouldKeepChatHost("/chat")).toBe(true);
    expect(shouldKeepChatHost("/chat/")).toBe(true);
    expect(shouldKeepChatHost("/agents")).toBe(true);
    expect(shouldKeepChatHost("/agents/")).toBe(true);
    expect(shouldKeepChatHost("/starmap")).toBe(false);
    expect(shouldKeepChatHost("/cron")).toBe(false);
    expect(shouldKeepChatHost("/skills")).toBe(false);
    expect(shouldKeepChatHost("/")).toBe(false);
  });
});
