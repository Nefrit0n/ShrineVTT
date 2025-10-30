export type ChatMessage =
  | {
      id: string;
      author: string;
      timestamp: string;
      type: "text";
      text: string;
    }
  | {
      id: string;
      author: string;
      timestamp: string;
      type: "roll";
      roll: {
        title: string;
        notation: string;
        total: number;
        breakdown: string;
        detail: string;
      };
    };

export type AddChatMessage = (message: ChatMessage) => void;
