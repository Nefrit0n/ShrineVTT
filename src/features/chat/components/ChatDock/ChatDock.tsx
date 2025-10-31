import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEventHandler,
  type ChangeEventHandler,
  type ReactNode,
} from "react";
import clsx from "clsx";

import type { ChatMessage } from "@/features/chat/types";

type DiscordSection = {
  heading: string | null;
  lines: string[];
};

function splitBlocks(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function splitLines(block: string): string[] {
  return block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderInline(text: string): ReactNode {
  if (!text.includes("**")) return text;

  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
}

function buildDiscordSections(text: string): {
  title: string | null;
  primaryLines: string[];
  extraSections: DiscordSection[];
} {
  const blocks = splitBlocks(text);
  if (!blocks.length) {
    return { title: null, primaryLines: [], extraSections: [] };
  }

  const [firstBlock, ...restBlocks] = blocks;
  const firstLines = splitLines(firstBlock);
  const [title = null, ...primaryLines] = firstLines;

  const extraSections = restBlocks
    .map((block) => {
      const lines = splitLines(block);
      if (!lines.length) {
        return null;
      }

      const [rawHeading, ...rest] = lines;
      const isHeadingBold = /^\*\*.+\*\*$/.test(rawHeading);

      return {
        heading: isHeadingBold ? rawHeading : null,
        lines: isHeadingBold ? rest : lines,
      } satisfies DiscordSection;
    })
    .filter((section): section is DiscordSection => Boolean(section));

  return {
    title,
    primaryLines,
    extraSections,
  };
}

function buildStandardBlocks(text: string): string[][] {
  return splitBlocks(text).map(splitLines);
}

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
      messages.map((message) => {
        const discordSections =
          message.origin === "discord"
            ? buildDiscordSections(message.text)
            : null;
        const standardBlocks =
          message.origin !== "discord" ? buildStandardBlocks(message.text) : [];
        const displayAuthor =
          message.origin === "discord"
            ? message.characterName?.trim() || message.author
            : message.author;
        const viaLabel =
          message.origin === "discord" && message.author && displayAuthor !== message.author
            ? message.author
            : null;

        return (
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
                <div className="chat-message__identity">
                  <strong className="chat-message__name">{displayAuthor}</strong>
                  {viaLabel && (
                    <span className="chat-message__via">via {viaLabel}</span>
                  )}
                </div>
                <time
                  dateTime={message.isoTimestamp ?? message.timestamp}
                  aria-label={`Sent at ${message.timestamp}`}
                >
                  {message.timestamp}
                </time>
              </header>

              <div className="chat-message__bubble">
                {message.origin === "discord" && discordSections ? (
                  <div className="chat-message__discord-card">
                    {discordSections.title && (
                      <div className="chat-message__discord-title">
                        {renderInline(discordSections.title)}
                      </div>
                    )}

                    {discordSections.primaryLines.length > 0 && (
                      <ul
                        className="chat-message__discord-roll"
                        role="list"
                      >
                        {discordSections.primaryLines.map((line, index) => (
                          <li key={`primary-${index}`}>
                            {renderInline(line)}
                          </li>
                        ))}
                      </ul>
                    )}

                    {discordSections.extraSections.map((section, sectionIndex) => (
                      <div
                        className="chat-message__discord-section"
                        key={`section-${sectionIndex}`}
                      >
                        {section.heading && (
                          <div className="chat-message__discord-section-title">
                            {renderInline(section.heading)}
                          </div>
                        )}

                        {section.lines.length > 0 && (
                          <ul className="chat-message__discord-roll" role="list">
                            {section.lines.map((line, lineIndex) => (
                              <li key={`section-${sectionIndex}-line-${lineIndex}`}>
                                {renderInline(line)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="chat-message__text">
                    {standardBlocks.map((block, blockIndex) => (
                      <p key={`block-${blockIndex}`}>
                        {block.map((line, lineIndex) => (
                          <Fragment key={`block-${blockIndex}-line-${lineIndex}`}>
                            {lineIndex > 0 && <br />}
                            {renderInline(line)}
                          </Fragment>
                        ))}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      }),
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
