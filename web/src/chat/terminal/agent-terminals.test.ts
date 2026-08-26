import { describe, expect, it } from "vitest";

import {
  EMPTY_AGENT_TERMINAL_STATE,
  agentTabId,
  appendAgentOutput,
  closeAgentTerminal,
  selectTerminalTab,
} from "./agent-terminals";

describe("agent-terminals", () => {
  it("appends chunks and creates a tab once", () => {
    let state = appendAgentOutput(EMPTY_AGENT_TERMINAL_STATE, "p1", "a");
    state = appendAgentOutput(state, "p1", "b", "build");
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]).toMatchObject({
      processId: "p1",
      title: "build",
      buffer: "ab",
    });
  });

  it("ignores empty process ids", () => {
    expect(appendAgentOutput(EMPTY_AGENT_TERMINAL_STATE, "  ", "x")).toEqual(
      EMPTY_AGENT_TERMINAL_STATE,
    );
  });

  it("closes agent tabs and resets focus to shell", () => {
    let state = appendAgentOutput(EMPTY_AGENT_TERMINAL_STATE, "p1", "hi");
    state = selectTerminalTab(state, agentTabId("p1"));
    state = closeAgentTerminal(state, "p1");
    expect(state.tabs).toEqual([]);
    expect(state.activeId).toBe("shell");
  });
});
