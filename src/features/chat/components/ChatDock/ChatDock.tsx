import { useState } from "react";

const ROLL_VISIBILITY_OPTIONS = [
  { value: "public", label: "Public Roll" },
  { value: "private-gm", label: "Private GM Roll" },
  { value: "blind-gm", label: "Blind GM Roll" },
  { value: "self", label: "Self-Roll" }
];

const INITIAL_MESSAGES = [
  {
    id: "1",
    author: "Aeryn",
    content: "Spotted a hidden passage beneath the altar.",
    timestamp: "20:14"
  },
  {
    id: "2",
    author: "Kael",
    content: "I'll send the familiar first—stand by.",
    timestamp: "20:15"
  }
];

export default function ChatDock() {
  const [messages] = useState(INITIAL_MESSAGES);
  const [rollVisibility, setRollVisibility] = useState<string>(ROLL_VISIBILITY_OPTIONS[0]!.value);

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
      <div className="chat-dock__messages">
        {messages.map((message) => (
          <article key={message.id} className="chat-message">
            <header>
              <strong>{message.author}</strong>
              <time dateTime={message.timestamp}>{message.timestamp}</time>
            </header>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <footer className="chat-dock__composer">
        <input type="text" placeholder="Press Enter to send a message" aria-label="Message input" />
      </footer>
    </section>
  );
}
