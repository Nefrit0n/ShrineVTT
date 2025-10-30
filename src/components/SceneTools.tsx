import { useMemo, useState } from "react";
import {
  IconBulb,
  IconMapPins,
  IconNote,
  IconPencil,
  IconRulerMeasure,
  IconVolume,
  IconWall,
  IconUsers
} from "@tabler/icons-react";
import clsx from "clsx";

export type SceneTool = {
  id: string;
  label: string;
  description: string;
  icon: typeof IconUsers;
};

const TOOLS: SceneTool[] = [
  {
    id: "tokens",
    label: "Tokens",
    description:
      "Tokens represent Actors that you have placed in the Scene. Use the token tools to select, move, and manage them across the canvas.",
    icon: IconUsers
  },
  {
    id: "rulers",
    label: "Rulers",
    description:
      "Rulers let you measure distances and drop area of effect templates directly onto the map so everyone can plan their moves.",
    icon: IconRulerMeasure
  },
  {
    id: "tiles",
    label: "Tiles",
    description:
      "Use tiles to place, move, and layer images or videos in the Scene, transforming the battlefield on the fly.",
    icon: IconMapPins
  },
  {
    id: "drawings",
    label: "Drawings",
    description:
      "Quickly sketch shapes, freehand notes, or text callouts right on the canvas to guide your players in the moment.",
    icon: IconPencil
  },
  {
    id: "walls",
    label: "Walls",
    description:
      "Walls — including doors and windows — control vision and fog of war so you can reveal your World at just the right pace.",
    icon: IconWall
  },
  {
    id: "lights",
    label: "Lights",
    description:
      "Drop animated light sources to illuminate the Scene and help your players see every dramatic detail.",
    icon: IconBulb
  },
  {
    id: "ambient-audio",
    label: "Ambient Audio",
    description:
      "Place positional sounds across the Scene so explorers hear the world shift as they approach key locations.",
    icon: IconVolume
  },
  {
    id: "notes",
    label: "Notes",
    description:
      "Pin pages from your Journal Entries directly in the Scene for quick references that float above the action.",
    icon: IconNote
  }
];

export default function SceneTools() {
  const [activeToolId, setActiveToolId] = useState<string>(TOOLS[0]?.id ?? "tokens");

  const activeTool = useMemo(
    () => TOOLS.find((tool) => tool.id === activeToolId) ?? TOOLS[0],
    [activeToolId]
  );

  return (
    <aside className="panel scene-tools" aria-label="Scene tools">
      <header className="scene-tools__intro">
        <h2>Scene Tools</h2>
        <p>
          The Scene Tools let you and your players interact with everything on the canvas. When no Scene is open these
          tools are unavailable.
        </p>
      </header>

      <div className="scene-tools__body">
        <nav className="scene-tools__toolbar" aria-label="Scene tool shortcuts" role="tablist">
          {TOOLS.map(({ id, label, icon: Icon }) => {
            const active = id === activeToolId;

            return (
              <button
                key={id}
                id={`scene-tool-${id}`}
                type="button"
                className={clsx("scene-tools__tool", { active })}
                onClick={() => setActiveToolId(id)}
                role="tab"
                aria-selected={active}
                aria-controls={`scene-tool-panel-${id}`}
                title={label}
              >
                <span className="scene-tools__sr-only">{label}</span>
                <Icon stroke={1.6} size={24} aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        {activeTool && (
          <section
            key={activeTool.id}
            className="scene-tools__details"
            role="tabpanel"
            id={`scene-tool-panel-${activeTool.id}`}
            aria-labelledby={`scene-tool-${activeTool.id}`}
          >
            <h3>{activeTool.label}</h3>
            <p>{activeTool.description}</p>
          </section>
        )}
      </div>
    </aside>
  );
}
