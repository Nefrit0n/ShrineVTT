import { useCallback, useMemo, useState } from "react";
import {
  IconArchive,
  IconBackpack,
  IconBook2,
  IconCards,
  IconDice3,
  IconLayoutKanban,
  IconMasksTheater,
  IconMessageCircle,
  IconMusic,
  IconSettings,
  IconSwords
} from "@tabler/icons-react";

import { ChatDock } from "@/features/chat/components/ChatDock";
import { PlayersOnline } from "@/features/players/components/PlayersOnline";
import { SceneCanvas } from "@/features/scene/components/SceneCanvas";
import { SceneTools } from "@/features/scene/components/SceneTools";
import {
  WorldSidebar,
  type WorldSidebarSection
} from "@/features/sidebar/components/WorldSidebar";
import { MOCK_PLAYERS } from "@/shared/data/mockPlayers";
import type { ChatMessage } from "@/features/chat/types";
import { useShrineSocket } from "@/shared/utils/useShrineSocket";

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function MainLayout() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const handleSocketMessage = useCallback((data: any) => {
    if (data.type === "chat_message") {
      const isoTimestamp =
        typeof data.timestamp === "string" ? data.timestamp : new Date().toISOString();
      const messageId: string =
        data.messageId || data.clientMessageId || data.id || crypto.randomUUID();

      const msg: ChatMessage = {
        id: messageId,
        author: data.author || "System",
        text: data.text ?? "",
        timestamp: formatTimestamp(isoTimestamp),
        isoTimestamp,
        type: "text",
        image: data.image || undefined,
        characterName:
          typeof data.characterName === "string" && data.characterName.trim()
            ? data.characterName.trim()
            : undefined,
        origin:
          data.origin === "discord"
            ? "discord"
            : data.origin === "player"
              ? "player"
              : data.origin ?? "system",
      };

      setChatMessages((prev) => {
        if (prev.some((existing) => existing.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
    }
  }, []);

  const wsRef = useShrineSocket(handleSocketMessage);

  const handleSendChatMessage = useCallback(
    (text: string) => {
      const now = new Date();
      const isoTimestamp = now.toISOString();
      const messageId = crypto.randomUUID();

      const message: ChatMessage = {
        id: messageId,
        author: "You",
        text,
        timestamp: formatTimestamp(isoTimestamp),
        isoTimestamp,
        type: "text",
        origin: "player",
      };

      setChatMessages((prev) => [...prev, message]);

      // отправляем сообщение на сервер
      wsRef.current?.send(
        JSON.stringify({
          type: "chat_message",
          author: "You",
          text,
          timestamp: isoTimestamp,
          origin: "player",
          clientMessageId: messageId,
        })
      );
    },
    [wsRef]
  );

  const placeholderSectionDefaults: Pick<
    WorldSidebarSection,
    "hideHeader" | "panelChrome" | "panelPadding"
  > = {
    hideHeader: true,
    panelChrome: false,
    panelPadding: "none",
  };

  const sidebarSections = useMemo<WorldSidebarSection[]>(() => [
    {
      id: "chat",
      title: "Chat",
      icon: IconMessageCircle,
      hideHeader: true,
      panelPadding: "none",
      panelChrome: false,
      contentClassName: "world-sidebar__content--chat",
      bodyClassName: "world-sidebar__content-body--chat",
      content: <ChatDock messages={chatMessages} onSendMessage={handleSendChatMessage} />
    },
    {
      id: "combat",
      title: "Combat",
      icon: IconSwords,
      ...placeholderSectionDefaults,
    },
    {
      id: "scenes",
      title: "Scenes",
      icon: IconLayoutKanban,
      ...placeholderSectionDefaults,
    },
    {
      id: "actors",
      title: "Actors",
      icon: IconMasksTheater,
      content: <PlayersOnline players={MOCK_PLAYERS} />
    },
    {
      id: "items",
      title: "Items",
      icon: IconBackpack,
      ...placeholderSectionDefaults,
    },
    {
      id: "journal",
      title: "Journal Entries",
      icon: IconBook2,
      ...placeholderSectionDefaults,
    },
    {
      id: "roll-tables",
      title: "Roll Tables",
      icon: IconDice3,
      ...placeholderSectionDefaults,
    },
    {
      id: "cards",
      title: "Cards",
      icon: IconCards,
      ...placeholderSectionDefaults,
    },
    {
      id: "music",
      title: "Music",
      icon: IconMusic,
      ...placeholderSectionDefaults,
    },
    {
      id: "compendium",
      title: "Compendium Packs",
      icon: IconArchive,
      ...placeholderSectionDefaults,
    },
    {
      id: "settings",
      title: "Settings",
      icon: IconSettings,
      ...placeholderSectionDefaults,
    }
  ],
    [chatMessages, handleSendChatMessage]
  );

  return (
    <div className="workspace">
      <SceneCanvas />
      <div className="workspace-overlay">
        <SceneTools />
        <WorldSidebar sections={sidebarSections} />
      </div>
    </div>
  );
}