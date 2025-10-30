import {
  IconBulb,
  IconMapPins,
  IconNote,
  IconPencil,
  IconRulerMeasure,
  IconUsers,
  IconVolume,
  IconWall
} from "@tabler/icons-react";

import type { SceneTool } from "./SceneTools.types";

export const SCENE_TOOLS: SceneTool[] = [
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
