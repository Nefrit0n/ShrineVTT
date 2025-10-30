import { useMemo, useState } from "react";
import clsx from "clsx";

import { Panel } from "@/shared/components/Panel";

import type { WorldSidebarProps, WorldSidebarSection } from "./WorldSidebar.types";

export default function WorldSidebar({ sections, initialSectionId }: WorldSidebarProps) {
  const [activeTab, setActiveTab] = useState<string>(
    initialSectionId ?? sections[0]?.id ?? "chat"
  );

  const activeSection = useMemo<WorldSidebarSection | undefined>(
    () => sections.find((section) => section.id === activeTab),
    [activeTab, sections]
  );

  const ActiveIcon = activeSection?.icon;

  return (
    <aside className="world-sidebar" aria-label="World sidebar">
      <nav className="world-sidebar__tabs" role="tablist" aria-label="World navigation">
        {sections.map(({ id, title, icon: Icon }) => {
          const isActive = id === activeTab;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`world-sidebar-tab-${id}`}
              aria-controls={`world-sidebar-tabpanel-${id}`}
              className={clsx("world-sidebar__tab", { "world-sidebar__tab--active": isActive })}
              title={title}
              onClick={() => setActiveTab(id)}
            >
              <Icon aria-hidden="true" stroke={1.6} />
              <span className="sr-only">{title}</span>
            </button>
          );
        })}
      </nav>

      <Panel
        padding="lg"
        className="world-sidebar__content"
        aria-labelledby={activeSection ? `world-sidebar-tab-${activeSection.id}` : undefined}
        role="tabpanel"
        id={activeSection ? `world-sidebar-tabpanel-${activeSection.id}` : undefined}
      >
        {ActiveIcon && (
          <div className="world-sidebar__content-icon" aria-hidden="true">
            <ActiveIcon stroke={1.6} />
          </div>
        )}
        {activeSection && (
          <header>
            <h3>{activeSection.title}</h3>
            {activeSection.description && <p>{activeSection.description}</p>}
          </header>
        )}
        {activeSection?.content}
      </Panel>
    </aside>
  );
}
