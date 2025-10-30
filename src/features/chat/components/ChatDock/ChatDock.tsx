import { useMemo, useState } from "react";

import type { ChatMessage } from "@/features/chat/types";

const ROLL_VISIBILITY_OPTIONS = [
  { value: "public", label: "Public Roll" },
  { value: "private-gm", label: "Private GM Roll" },
  { value: "blind-gm", label: "Blind GM Roll" },
  { value: "self", label: "Self-Roll" }
];

type ChatDockProps = {
  messages: ChatMessage[];
};

export default function ChatDock({ messages }: ChatDockProps) {
  const [rollVisibility, setRollVisibility] = useState<string>(ROLL_VISIBILITY_OPTIONS[0]!.value);

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        if (message.type === "roll") {
          return (
            <article key={message.id} className="chat-message chat-message--roll">
              <header>
                <strong>{message.author}</strong>
                <time dateTime={message.timestamp}>{message.timestamp}</time>
              </header>
              <div className="chat-message__roll">
                <div className="chat-message__roll-title">{message.roll.title}</div>
                <div className="chat-message__roll-body">
                  <div className="chat-message__roll-expression">{message.roll.breakdown}</div>
                  <div className="chat-message__roll-total">{message.roll.total}</div>
                </div>
                <footer className="chat-message__roll-detail">{message.roll.detail}</footer>
              </div>
            </article>
          );
        }

        return (
          <article key={message.id} className="chat-message">
            <header>
              <strong>{message.author}</strong>
              <time dateTime={message.timestamp}>{message.timestamp}</time>
            </header>
            <p>{message.text}</p>
          </article>
        );
      }),
    [messages]
  );

  return (
    <section className="chat-dock" aria-label="Session chat">
      <header className="chat-dock__header">
        <h3>Chat</h3>
        <span>Party Channel</span>
      </header>
      <div className="chat-dock__controls">
        <label htmlFor="chat-roll-visibility">Roll visibility</label>
        <div className="chat-dock__visibility">
          <select
            id="chat-roll-visibility"
            value={rollVisibility}
            onChange={(event) => setRollVisibility(event.target.value)}
            aria-label="Roll visibility"
          >
            {ROLL_VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="chat-dock__messages">{renderedMessages}</div>
      <footer className="chat-dock__composer">
        <input type="text" placeholder="Press Enter to send a message" aria-label="Message input" />
      </footer>
    </section>
  );
}
