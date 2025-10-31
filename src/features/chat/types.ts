export type ChatMessageOrigin = "discord" | "player" | "system";

export type ChatMessage = {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  isoTimestamp?: string;
  type: "text";
  image?: string;
  origin?: ChatMessageOrigin;
};
