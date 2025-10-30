export type ChatMessage = {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  type: "text";
  image?: string;
};
