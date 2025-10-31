import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEventHandler,
  type ChangeEventHandler,
} from "react";
import clsx from "clsx";

import type { ChatMessage } from "@/features/chat/types";

type ChatDockProps = {
  messages: ChatMessage[];
  onSendMessage?: (text: string) => void;
};

export default function ChatDock({ messages, onSendMessage }: ChatDockProps) {
  const [messageDraft, setMessageDraft] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldSmoothScroll = distanceFromBottom < 160;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: shouldSmoothScroll ? "smooth" : "auto",
    });
  }, [messages]);

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => (
        <article
          key={message.id}
          className={clsx(
            "chat-message",
            message.origin && `chat-message--${message.origin}`
          )}
        >
          {message.origin === "discord" && (
            <div className="chat-message__portrait" aria-hidden="true">
              {message.image ? (
                <img src={message.image} alt="" loading="lazy" />
              ) : (
                <span className="chat-message__portrait-initial">
                  {(message.author || "")
                    .trim()
                    .slice(0, 1)
                    .toUpperCase() || "?"}
                </span>
              )}
            </div>
          )}

          <div className="chat-message__body">
            <header className="chat-message__meta">
              <strong>{message.author}</strong>
              {message.origin === "discord" && (
                <span className="chat-message__badge">Discord Bot</span>
              )}
              <time
                dateTime={message.isoTimestamp ?? message.timestamp}
                aria-label={`Sent at ${message.timestamp}`}
              >
                {message.timestamp}
              </time>
            </header>

            <div className="chat-message__bubble">
              <div
                className="chat-message__text"
                dangerouslySetInnerHTML={{ __html: message.text }}
              />
            </div>
          </div>
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
      <div className="chat-dock__messages">
        <div
          ref={viewportRef}
          className="chat-dock__scroller"
          role="log"
          aria-live="polite"
        >
          {renderedMessages}
        </div>
      </div>
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
