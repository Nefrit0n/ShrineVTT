import { IconBrush, IconDownload, IconFlame, IconLayersIntersect, IconPrompt, IconRulerMeasure, IconSettings, IconSparkles, IconUsersGroup, IconWriting } from "@tabler/icons-react";
import Sidebar from "../components/Sidebar";
import CanvasArea from "../components/CanvasArea";
import SidebarRight from "../components/SidebarRight";
import PlayerList from "../components/PlayerList";

const sceneTools = [
  { id: "select", label: "Select", icon: IconPrompt, active: true },
  { id: "measure", label: "Measure", icon: IconRulerMeasure },
  { id: "draw", label: "Draw", icon: IconBrush },
  { id: "actors", label: "Actors", icon: IconUsersGroup },
  { id: "tiles", label: "Tiles", icon: IconLayersIntersect },
  { id: "effects", label: "Effects", icon: IconSparkles },
  { id: "lights", label: "Lights", icon: IconFlame },
  { id: "config", label: "Config", icon: IconSettings }
];

const players = [
  { name: "Aster", character: "Seren of the Veil", role: "GM", color: "#60a5fa" },
  { name: "Mira", character: "Ilyra Dawnpetal", role: "Artificer", color: "#a855f7" },
  { name: "Corin", character: "Thalos Emberborn", role: "Paladin", color: "#f97316" },
  { name: "Jun", character: "Ashen Whisper", role: "Rogue", color: "#38bdf8" }
];

const macros = [
  "Arcane Blast",
  "Healing Word",
  "Flame Strike",
  "Shadowstep",
  "Divine Shield",
  "Summon Sprite",
  "Chrono Shift",
  "Lunar Arrow",
  "Crystal Barrier",
  "Guidance"
];

const referenceSections = [
  {
    title: "Getting Started",
    items: [
      "Open the Scene Tools to reveal interaction layers.",
      "Invite players from the lobby section and assign characters.",
      "Upload battlemaps, then drag them into the canvas to stage the scene."
    ]
  },
  {
    title: "Session Beats",
    items: [
      "The party awakens within the Shrine of Echoes.",
      "Solve the mirrored sigil puzzle to reveal the inner sanctum.",
      "Defeat the guardian warden to recover the Astral Keystone."
    ]
  }
];

const quickNotes = [
  {
    heading: "Macro Tips",
    body: "Drag abilities or dice expressions onto the macro bar to bind them for the whole party."
  },
  {
    heading: "Scene Status",
    body: "Pause the game from the canvas overlay to freeze tokens and hide GM-only updates."
  }
];

const sessionLog = {
  lastUpdated: "Last updated 5m ago",
  description:
    "The mirrored hallway hums with latent energy as the party approaches the shrine altar. Arcane light gathers around the keystone, awaiting the final incantation."
};

export default function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar tools={sceneTools} />
      <CanvasArea />
      <SidebarRight referenceSections={referenceSections} quickNotes={quickNotes} sessionLog={sessionLog} />
      <footer className="panel macro-bar" aria-label="Macro bar">
        {macros.map((macro) => (
          <button key={macro} type="button" className="macro-slot">
            {macro}
          </button>
        ))}
      </footer>
      <PlayerList players={players} />
      <div className="tag" style={{ position: "absolute", top: 32, right: 32, gap: 8 }}>
        <IconWriting size={16} />
        Session Notes Synced
      </div>
      <button
        type="button"
        className="scene-tool-button"
        style={{
          position: "absolute",
          top: 28,
          right: 180,
          height: 42,
          width: "auto",
          paddingInline: 18,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          letterSpacing: "0.04em",
          textTransform: "uppercase"
        }}
      >
        <IconDownload size={18} /> Export Scene
      </button>
    </div>
  );
}
