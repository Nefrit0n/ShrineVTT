import { useMemo, useState } from "react";
import clsx from "clsx";

import { Panel } from "@/shared/components/Panel";

import type { SceneTool } from "./SceneTools.types";
import { SCENE_TOOLS } from "./sceneTools.constants";

export default function SceneTools() {
  const [activeToolId, setActiveToolId] = useState<string>(SCENE_TOOLS[0]?.id ?? "tokens");

  const activeTool = useMemo<SceneTool | undefined>(
    () => SCENE_TOOLS.find((tool) => tool.id === activeToolId),
    [activeToolId]
  );

  return (
    <Panel className="scene-tools" padding="lg">
      <header className="scene-tools__intro">
        <h2>Scene Tools</h2>
        <p>
          The Scene Tools let you and your players interact with everything on the canvas. When no Scene is open these tools are
          unavailable.
        </p>
      </header>

      <div className="scene-tools__body">
        <nav className="scene-tools__toolbar" aria-label="Scene tool shortcuts" role="tablist">
          {SCENE_TOOLS.map(({ id, label, icon: Icon }) => {
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
                <span className="sr-only">{label}</span>
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
    </Panel>
  );
}
