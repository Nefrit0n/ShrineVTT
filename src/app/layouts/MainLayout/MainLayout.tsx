import { useMemo } from "react";
import {
  IconLayoutKanban,
  IconMessageCircle,
  IconNotebook,
  IconUsers
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

export default function MainLayout() {
  const sidebarSections = useMemo<WorldSidebarSection[]>(
    () => [
      {
        id: "chat",
        title: "Chat",
        icon: IconMessageCircle,
        description: "Coordinate tactics, share roleplay beats, and keep everyone on the same page.",
        content: <ChatDock />
      },
      {
        id: "players",
        title: "Players",
        icon: IconUsers,
        description: "Track who is currently present in the session and review their characters.",
        content: <PlayersOnline players={MOCK_PLAYERS} />
      },
      {
        id: "scenes",
        title: "Scenes",
        icon: IconLayoutKanban,
        description: "Manage the active scene, swap to previous maps, or prepare the next reveal.",
        content: (
          <p className="sidebar-placeholder">
            Scene management tools will live here, providing quick access to your prepared worlds.
          </p>
        )
      },
      {
        id: "journal",
        title: "Journal",
        icon: IconNotebook,
        description: "Reference lore, NPC dossiers, and session notes without leaving the table view.",
        content: (
          <p className="sidebar-placeholder">
            Attachments, handouts, and lore articles will surface for your players here.
          </p>
        )
      }
    ],
    []
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
