import {
  useCallback,
  useMemo,
  useState,
  type FormEventHandler,
  type ChangeEventHandler,
} from "react";

import type { ChatMessage } from "@/features/chat/types";

type ChatDockProps = {
  messages: ChatMessage[];
  onSendMessage?: (text: string) => void;
};

export default function ChatDock({ messages, onSendMessage }: ChatDockProps) {
  const [messageDraft, setMessageDraft] = useState("");

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => (
        <article key={message.id} className="chat-message">
          <header className="chat-message__header">
            <strong>{message.author}</strong>
            <time dateTime={message.timestamp}>{message.timestamp}</time>
          </header>

          <p
            className="chat-message__text"
            dangerouslySetInnerHTML={{ __html: message.text }}
          />

          {message.image && (
            <img
              src={message.image}
              alt=""
              style={{
                marginTop: "6px",
                maxWidth: "100%",
                borderRadius: "8px",
                boxShadow: "0 0 6px rgba(0,0,0,0.4)",
                objectFit: "cover",
              }}
            />
          )}
        </article>
      )),
    [messages]
  );

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault();

      const trimmedMessage = messageDraft.trim();
      if (!trimmedMessage) return;

      onSendMessage?.(trimmedMessage);
      setMessageDraft("");
    },
    [messageDraft, onSendMessage]
  );

  return (
    <section className="chat-dock" aria-label="Session chat">
      <header className="chat-dock__header">
        <h3>Chat</h3>
        <span>Party Channel</span>
      </header>
      <div className="chat-dock__messages">{renderedMessages}</div>
      <footer className="chat-dock__composer">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Press Enter to send a message"
            aria-label="Message input"
            value={messageDraft}
            onChange={((event) =>
              setMessageDraft(event.target.value)) satisfies ChangeEventHandler<HTMLInputElement>}
            disabled={!onSendMessage}
          />
        </form>
      </footer>
    </section>
  );
}
