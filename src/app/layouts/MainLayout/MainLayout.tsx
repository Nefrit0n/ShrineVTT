import { useMemo } from "react";
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
  IconSwords,
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
        id: "scenes",
        title: "Scenes",
        icon: IconLayoutKanban,
        description:
          "Scenes for theater of the mind moments and tactical battle maps are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Scene management tools will live here, providing quick access to your prepared worlds.
          </p>
        )
      },
      {
        id: "combat",
        title: "Combat",
        icon: IconSwords,
        description: "Start and track Encounters here.",
        content: (
          <p className="sidebar-placeholder">
            Build turn orders, apply initiative modifiers, and keep the battle pacing sharp from this view.
          </p>
        )
      },
      {
        id: "actors",
        title: "Actors",
        icon: IconMasksTheater,
        description:
          "Characters for your players, creatures, and NPCs are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Organise heroes, villains, and supporting cast members so they are always ready for the next scene.
          </p>
        )
      },
      {
        id: "items",
        title: "Items",
        icon: IconBackpack,
        description:
          "Items, spells, character abilities, and more are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Prepare loot drops, treasure parcels, and magical upgrades without disrupting the session flow.
          </p>
        )
      },
      {
        id: "journal",
        title: "Journal",
        icon: IconBook2,
        description:
          "Journal entries for planning your adventures, tracking progress, and any other note taking are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Reference lore, NPC dossiers, and session notes without leaving the table view.
          </p>
        )
      },
      {
        id: "players",
        title: "Players",
        icon: IconUsers,
        description: "Track who is currently present in the session and review their characters.",
        content: <PlayersOnline players={MOCK_PLAYERS} />
      },
      {
        id: "roll-tables",
        title: "Roll Tables",
        icon: IconDice3,
        description:
          "Roll tables, which are tables of options that can be rolled on for a random result, are stored here.",
        content: (
          <p className="sidebar-placeholder">
            Quickly surface curated random encounters, treasure bundles, or story prompts at the table.
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
            Blend ambience, sound effects, and dramatic cues while keeping per-player volume controls handy.
          </p>
        )
      },
      {
        id: "compendium",
        title: "Compendium Packs",
        icon: IconArchive,
        description:
          "Compendium Packs are long term storage for everything we just covered (except Encounters).",
        content: (
          <p className="sidebar-placeholder">
            Think of it as cold storage for your data which keeps your world loading fast while remaining searchable.
          </p>
        )
      },
      {
        id: "settings",
        title: "Settings",
        icon: IconSettings,
        description:
          "Configure your settings, manage modules, adjust users, run tours, and access documentation or support tools.",
        content: (
          <p className="sidebar-placeholder">
            This tab collects world configuration, module management, invitation links, and access to setup tools.
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
