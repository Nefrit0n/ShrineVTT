import { useState } from "react";
import clsx from "clsx";

import { SCENE_TOOLS } from "./sceneTools.constants";

export default function SceneTools() {
  const [activeToolId, setActiveToolId] = useState<string>(SCENE_TOOLS[0]?.id ?? "tokens");

  return (
    <div className="scene-tools">
      <nav className="scene-tools__toolbar" aria-label="Scene tool shortcuts" role="toolbar">
        {SCENE_TOOLS.map(({ id, label, icon: Icon }) => {
          const active = id === activeToolId;

          return (
            <button
              key={id}
              type="button"
              className={clsx("scene-tools__tool", { active })}
              onClick={() => setActiveToolId(id)}
              title={label}
              aria-pressed={active}
            >
              <span className="sr-only">{label}</span>
              <Icon stroke={1.6} size={24} aria-hidden="true" />
            </button>
          );
        })}
      </nav>
    </div>
  );
}