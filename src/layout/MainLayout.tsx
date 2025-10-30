import CanvasArea from "../components/CanvasArea";
import SidebarRight from "../components/SidebarRight";

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
    <div className="workspace">
      <CanvasArea />
      <div className="workspace-overlay">
        <SidebarRight referenceSections={referenceSections} quickNotes={quickNotes} sessionLog={sessionLog} />
      </div>
    </div>
  );
}
