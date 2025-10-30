import type { ElementType } from "react";
import clsx from "clsx";

type Tool = {
  id: string;
  label: string;
  icon: ElementType;
  active?: boolean;
};

type SidebarProps = {
  tools: Tool[];
};

export default function Sidebar({ tools }: SidebarProps) {
  return (
    <nav className={clsx("panel", "scene-tools")} aria-label="Scene tools">
      {tools.map(({ id, icon: Icon, label, active }) => (
        <button
          key={id}
          className={clsx("scene-tool-button", { active })}
          type="button"
          aria-pressed={Boolean(active)}
          title={label}
        >
          <Icon size={26} stroke={1.7} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </nav>
  );
}
