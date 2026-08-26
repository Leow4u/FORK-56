/** Read-only agent background-process terminals (desktop contract subset). */

export interface AgentTerminalTab {
  processId: string;
  title: string;
  buffer: string;
}

export type TerminalActiveId = "shell" | `agent:${string}`;

export interface AgentTerminalState {
  tabs: AgentTerminalTab[];
  /** Which terminal buffer read_terminal / the UI focus. */
  activeId: TerminalActiveId;
}

export const EMPTY_AGENT_TERMINAL_STATE: AgentTerminalState = {
  tabs: [],
  activeId: "shell",
};

export function agentTabId(processId: string): TerminalActiveId {
  return `agent:${processId}`;
}

export function appendAgentOutput(
  state: AgentTerminalState,
  processId: string,
  chunk: string,
  title?: string,
): AgentTerminalState {
  const id = (processId || "").trim();
  if (!id) return state;
  const text = typeof chunk === "string" ? chunk : String(chunk ?? "");
  const existing = state.tabs.findIndex((t) => t.processId === id);
  if (existing >= 0) {
    const tabs = [...state.tabs];
    const prev = tabs[existing]!;
    tabs[existing] = {
      ...prev,
      title: title?.trim() || prev.title,
      buffer: prev.buffer + text,
    };
    return { ...state, tabs };
  }
  return {
    tabs: [
      ...state.tabs,
      {
        processId: id,
        title: title?.trim() || id,
        buffer: text,
      },
    ],
    activeId: state.activeId,
  };
}

export function closeAgentTerminal(
  state: AgentTerminalState,
  processId: string,
): AgentTerminalState {
  const id = (processId || "").trim();
  if (!id) return state;
  const tabs = state.tabs.filter((t) => t.processId !== id);
  let activeId = state.activeId;
  if (activeId === agentTabId(id)) {
    activeId = "shell";
  }
  return { tabs, activeId };
}

export function selectTerminalTab(
  state: AgentTerminalState,
  activeId: TerminalActiveId,
): AgentTerminalState {
  if (activeId === "shell") return { ...state, activeId };
  const pid = activeId.slice("agent:".length);
  if (!state.tabs.some((t) => t.processId === pid)) return state;
  return { ...state, activeId };
}

export function readAgentBuffer(
  state: AgentTerminalState,
  processId: string,
): string {
  return state.tabs.find((t) => t.processId === processId)?.buffer ?? "";
}
