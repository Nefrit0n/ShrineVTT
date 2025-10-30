import { useState } from "react";

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

  return (
    <section className="chat-dock" aria-label="Session chat">
      <header className="chat-dock__header">
        <h3>Chat</h3>
        <span>Party Channel</span>
      </header>
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
