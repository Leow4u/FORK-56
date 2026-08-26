export type { ChatMessage, ChatRole, ThinChatPhase } from "./types";
export { createMessageId } from "./types";
export { Composer } from "./composer";
export { EmptyHome } from "./empty-home";
export { MessageList } from "./message-list";
export { SessionView } from "./session-view";
export { ThinChat } from "./thin-chat";
export type { ThinChatProps } from "./thin-chat";
export {
  applyGatewayEvent,
  createThinChatTurnState,
  historyToChatMessages,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
} from "./gateway-protocol";
export type { ApplyGatewayEventResult, SessionInflightTurn, ThinChatTurnState } from "./gateway-protocol";
export {
  appendInflightProjection,
  buildResumeTranscript,
  reconcileResumeMessages,
  turnStateFromInflight,
} from "./resume-transcript";
export { useThinChatGateway } from "./use-thin-chat-gateway";
