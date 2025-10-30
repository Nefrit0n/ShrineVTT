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

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    author: "Аэрин",
    text: "Нашла тайный проход под алтарём.",
    timestamp: "20:14",
    type: "text"
  },
  {
    id: "2",
    author: "Каэл",
    text: "Отправлю фамильяра вперёд — наготове.",
    timestamp: "20:15",
    type: "text"
  }
];

export default function MainLayout() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  }, []);

  const handleSendChatMessage = useCallback(
    (text: string) => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      addChatMessage({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        author: "You",
        text,
        timestamp,
        type: "text",
      });
    },
    [addChatMessage]
  );

  const sidebarSections = useMemo<WorldSidebarSection[]>(
    () => [
      {
        id: "chat",
        title: "Chat",
        icon: IconMessageCircle,
        description:
          "Chat messages and whispers will appear here so you can keep track of the table talk at a glance.",
        content: <ChatDock messages={chatMessages} onSendMessage={handleSendChatMessage} />
      },
      {
        id: "combat",
        title: "Combat",
        icon: IconSwords,
        description: "Start and track Encounters here.",
        content: (
          <p className="sidebar-placeholder">
            Queue turns, monitor initiative, and resolve combat effects in one focused view.
          </p>
        )
      },
      {
        id: "scenes",
        title: "Scenes",
        icon: IconLayoutKanban,
        description:
          "Scenes for theater of the mind moments and tactical battle maps are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Swap prepared battle maps or narrative scenes without interrupting the flow of the session.
          </p>
        )
      },
      {
        id: "actors",
        title: "Actors",
        icon: IconMasksTheater,
        description:
          "Characters for your players, creatures, and NPCs are stored here.",
        content: <PlayersOnline players={MOCK_PLAYERS} />
      },
      {
        id: "items",
        title: "Items",
        icon: IconBackpack,
        description: "Items, spells, character abilities, and more are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Drag equipment, treasure, and abilities into actor sheets or scenes when you need them.
          </p>
        )
      },
      {
        id: "journal",
        title: "Journal Entries",
        icon: IconBook2,
        description:
          "Journal entries for planning your adventures, tracking progress, and any other note taking are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Keep campaign prep, session notes, and player handouts organised for quick reference.
          </p>
        )
      },
      {
        id: "roll-tables",
        title: "Roll Tables",
        icon: IconDice3,
        description:
          "Roll tables, which are tables of options that can be rolled on for a random result, are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Fire off random encounters, treasure drops, and story prompts directly from curated tables.
          </p>
        )
      },
      {
        id: "cards",
        title: "Cards",
        icon: IconCards,
        description: "Decks/stacks of cards and hands are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Manage initiative decks, inspiration tokens, or custom mini-games that rely on card play.
          </p>
        )
      },
      {
        id: "music",
        title: "Music",
        icon: IconMusic,
        description:
          "Playlists and soundboards are stored here. Each player can also independently control their volume from this tab.",
        content: (
          <p className="sidebar-placeholder">
            Layer ambient tracks, sound effects, and dramatic stingers with quick access to volume.
          </p>
        )
      },
      {
        id: "compendium",
        title: "Compendium Packs",
        icon: IconArchive,
        description:
          "Compendium Packs are long term storage for everything we just covered (except Encounters). You can think of it as cold storage for your data which will make your World load more quickly.",
        content: (
          <p className="sidebar-placeholder">
            Archive modules, lore, and reusable content without slowing down your active world.
          </p>
        )
      },
      {
        id: "settings",
        title: "Settings",
        icon: IconSettings,
        description:
          "This tab contains a number of useful tools that let you: configure your settings, controls, manage Modules, edit your World's details, manage the Users in your World, explore Foundry's features with Tours, generate a Support Report, check out the official documentation, the community Wiki, get your Invitation Links, log out, and Return to Setup. Some of these options are only available for Gamemasters.",
        content: (
          <p className="sidebar-placeholder">
            Quickly adjust world configuration, manage installed modules, and reach documentation or support.
          </p>
        )
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
