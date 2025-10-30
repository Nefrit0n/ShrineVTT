import { IconDice6 } from "@tabler/icons-react";
import clsx from "clsx";

export default function CanvasArea() {
  return (
    <section className={clsx("panel", "canvas")} aria-label="Scene canvas">
      <div className="canvas-content">
        <div className="canvas-status">
          <IconDice6 size={20} />
          Game Paused
        </div>
        <h1 className="canvas-title">Shrine VTT</h1>
        <p>
          Craft scenes, manage encounters and keep your friends immersed in your adventures with this bespoke tabletop
          experience.
        </p>
      </div>
    </section>
  );
}
